-- =====================================================================
-- CRM Soluciones Impresiona · Actualización a las fases 2 y 3
-- Incluye: tareas y agenda, listas de precios, proveedores, inventario, gastos, corte de caja,
-- reportes, comisiones y portal del cliente.
--
-- SOLO para un proyecto de Supabase que YA tenía instalado supabase/instalar.sql
-- anterior a estas funciones. En un proyecto nuevo usa únicamente instalar.sql
-- (ya trae todo).
--
-- Pégalo completo en Supabase → SQL Editor → New query → Run, una sola vez.
-- Se aplica completo o nada (si algo falla, la base queda como estaba).
-- Generado a partir de supabase/migrations (12 archivos desde 20261014).
-- No lo edites a mano: ejecuta "npm run db:instalador".
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.pedidos') is null then
    raise exception 'Esta base no tiene el CRM instalado: ejecuta supabase/instalar.sql (no esta actualización).';
  end if;
  if to_regclass('public.tareas') is not null then
    raise exception 'Esta actualización ya se aplicó antes; no hace falta ejecutarla otra vez.';
  end if;
end
$$;

-- >>> 20261014000100_permisos_listas_precios.sql
-- =====================================================================
-- 11 · Fases 2 y 3: permisos nuevos y listas de precios por cliente
--
-- Permisos nuevos (solo administración por defecto, salvo donde se indica):
--   gestionar_inventario  materiales, entradas, ajustes de existencia y proveedores
--   registrar_consumos    registrar consumos y mermas de material (Producción por defecto)
--   registrar_gastos      gastos, compras de material y maquila (y proveedores)
--
-- Listas de precios: público (precio del catálogo), mayoreo y agencia/revendedor.
-- A cada cliente se le asigna su lista.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------
create or replace function public.lista_permisos()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'ver_precios',            -- Ver precios, totales y pagos
    'ver_costos',             -- Ver costos, márgenes y utilidades
    'ver_reportes',           -- Ver métricas financieras del negocio
    'gestionar_clientes',     -- Crear y editar clientes, prospectos y seguimientos
    'gestionar_cotizaciones', -- Crear, editar y enviar cotizaciones
    'gestionar_pedidos',      -- Crear, editar y cancelar pedidos
    'actualizar_produccion',  -- Cambiar etapas, agregar notas y subir archivos
    'aprobar_disenos',        -- Registrar aprobaciones de diseño
    'registrar_pagos',        -- Registrar cobros y comprobantes
    'cancelar_pagos',         -- Cancelar pagos y registrar devoluciones
    'editar_catalogo',        -- Editar productos, categorías y precios
    'exportar_datos',         -- Exportar información a Excel/CSV
    'eliminar_registros',     -- Eliminar clientes, cotizaciones y otros registros
    'gestionar_inventario',   -- Materiales, entradas, ajustes de existencia y proveedores
    'registrar_consumos',     -- Registrar consumos y mermas de material
    'registrar_gastos'        -- Registrar gastos, compras y maquila
  ]
$$;

-- Los permisos existentes no cambian. Lo único nuevo: Producción registra consumos de material.
create or replace function public.permiso_por_defecto(p_rol public.rol_usuario, p_permiso text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_rol
    when 'admin' then true
    when 'ventas' then p_permiso = any (array[
      'ver_precios', 'gestionar_clientes', 'gestionar_cotizaciones', 'gestionar_pedidos',
      'actualizar_produccion', 'aprobar_disenos', 'registrar_pagos'
    ])
    when 'diseno' then p_permiso = any (array['actualizar_produccion', 'aprobar_disenos'])
    when 'produccion' then p_permiso = any (array['actualizar_produccion', 'registrar_consumos'])
    else false
  end
$$;

-- ---------------------------------------------------------------------
-- Listas de precios
-- ---------------------------------------------------------------------
create type public.lista_precio as enum ('publico', 'mayoreo', 'agencia');

alter table public.clientes
  add column lista_precio public.lista_precio not null default 'publico';

comment on column public.clientes.lista_precio is
  'Lista de precios del cliente. "publico" usa productos.precio_venta; las demás, producto_precios.';

-- Precios especiales por lista. El precio "publico" sigue siendo productos.precio_venta,
-- por eso aquí solo se guardan mayoreo y agencia. Si un producto no tiene precio en la
-- lista del cliente, se usa el precio público.
create table public.producto_precios (
  producto_id uuid not null references public.productos (id) on delete cascade,
  lista public.lista_precio not null check (lista <> 'publico'),
  precio numeric(12, 2) not null check (precio >= 0),
  precio_minimo numeric(12, 2) check (precio_minimo >= 0),
  -- Precios por volumen: [{"desde": 12, "precio": 95.5}, ...] igual que productos.escalas
  escalas jsonb not null default '[]'::jsonb check (jsonb_typeof(escalas) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (producto_id, lista)
);

comment on table public.producto_precios is
  'Precios por lista (mayoreo, agencia). El precio público es productos.precio_venta.';

create index producto_precios_lista_idx on public.producto_precios (lista);

create trigger producto_precios_updated_at
before update on public.producto_precios
for each row execute function public.tg_updated_at();

create trigger producto_precios_bitacora
after insert or update or delete on public.producto_precios
for each row execute function public.tg_bitacora();

alter table public.producto_precios enable row level security;

revoke all on public.producto_precios from public, anon, authenticated;
grant select, insert, update, delete on public.producto_precios to authenticated;
grant all on public.producto_precios to service_role;

create policy "producto_precios: ver" on public.producto_precios
  for select to authenticated
  using ((select public.tiene_permiso('ver_precios')));

create policy "producto_precios: crear" on public.producto_precios
  for insert to authenticated
  with check ((select public.tiene_permiso('editar_catalogo')));

create policy "producto_precios: editar" on public.producto_precios
  for update to authenticated
  using ((select public.tiene_permiso('editar_catalogo')))
  with check ((select public.tiene_permiso('editar_catalogo')));

create policy "producto_precios: eliminar" on public.producto_precios
  for delete to authenticated
  using ((select public.tiene_permiso('editar_catalogo')));

-- >>> 20261014000200_tareas_agenda.sql
-- =====================================================================
-- 12 · Tareas, recordatorios y agenda
--
--   tareas   pendientes internos con responsable, fecha y hora opcionales,
--            ligados (opcionalmente) a un cliente, pedido, oportunidad o cotización.
--   agenda() calendario combinado: tareas, entregas e instalaciones de pedidos,
--            seguimientos del embudo y cotizaciones por vencer, según permisos.
--
-- Equipo pequeño: todo usuario activo ve todas las tareas (no llevan montos).
-- Crear: cualquier usuario activo. Editar o completar: responsable, creador o
-- administración. Eliminar: creador o administración.
-- =====================================================================

create type public.tipo_tarea as enum ('tarea', 'llamada', 'seguimiento', 'entrega', 'instalacion', 'recordatorio');

create table public.tareas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) between 1 and 200),
  descripcion text check (descripcion is null or length(descripcion) <= 4000),
  tipo public.tipo_tarea not null default 'tarea',
  fecha date not null default current_date,
  hora time,
  responsable_id uuid default auth.uid() references public.perfiles (id) on delete set null,
  cliente_id uuid references public.clientes (id) on delete set null,
  pedido_id uuid references public.pedidos (id) on delete set null,
  oportunidad_id uuid references public.oportunidades (id) on delete set null,
  cotizacion_id uuid references public.cotizaciones (id) on delete set null,
  prioridad public.prioridad not null default 'normal',
  completada boolean not null default false,
  completada_at timestamptz,
  completada_por uuid references public.perfiles (id) on delete set null,
  created_by uuid default auth.uid() references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tareas is 'Tareas y recordatorios del equipo ("Mis pendientes de hoy").';

create index tareas_pendientes_idx on public.tareas (responsable_id, fecha) where not completada;
create index tareas_fecha_idx on public.tareas (fecha);
create index tareas_cliente_idx on public.tareas (cliente_id);
create index tareas_pedido_idx on public.tareas (pedido_id);
create index tareas_oportunidad_idx on public.tareas (oportunidad_id);
create index tareas_cotizacion_idx on public.tareas (cotizacion_id);

-- Autor, fecha de cierre y cliente ligado se asignan solos.
create or replace function public.tg_tareas_antes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
    if new.completada then
      new.completada_at := now();
      new.completada_por := auth.uid();
    else
      new.completada_at := null;
      new.completada_por := null;
    end if;
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if new.completada and not old.completada then
      new.completada_at := now();
      new.completada_por := auth.uid();
    elsif not new.completada then
      new.completada_at := null;
      new.completada_por := null;
    else
      new.completada_at := old.completada_at;
      new.completada_por := old.completada_por;
    end if;
  end if;

  -- El cliente se toma del documento ligado si no se indicó.
  if new.cliente_id is null then
    if new.pedido_id is not null then
      select cliente_id into new.cliente_id from public.pedidos where id = new.pedido_id;
    elsif new.cotizacion_id is not null then
      select cliente_id into new.cliente_id from public.cotizaciones where id = new.cotizacion_id;
    elsif new.oportunidad_id is not null then
      select cliente_id into new.cliente_id from public.oportunidades where id = new.oportunidad_id;
    end if;
  end if;

  new.updated_at := now();
  return new;
end
$$;

create trigger tareas_antes
before insert or update on public.tareas
for each row execute function public.tg_tareas_antes();

create trigger tareas_bitacora
after insert or update or delete on public.tareas
for each row execute function public.tg_bitacora();

alter table public.tareas enable row level security;

revoke all on public.tareas from public, anon, authenticated;
grant select, insert, update, delete on public.tareas to authenticated;
grant all on public.tareas to service_role;

create policy "tareas: ver" on public.tareas
  for select to authenticated
  using ((select public.usuario_activo()));

create policy "tareas: crear" on public.tareas
  for insert to authenticated
  with check ((select public.usuario_activo()));

-- El responsable puede pasar la tarea a otra persona (por eso la verificación final solo
-- exige usuario activo); el autor no se puede cambiar.
create policy "tareas: editar" on public.tareas
  for update to authenticated
  using (
    (select public.usuario_activo())
    and (
      responsable_id = (select auth.uid())
      or created_by = (select auth.uid())
      or (select public.es_admin())
    )
  )
  with check ((select public.usuario_activo()));

create policy "tareas: eliminar" on public.tareas
  for delete to authenticated
  using (
    (select public.usuario_activo())
    and (created_by = (select auth.uid()) or (select public.es_admin()))
  );

-- ---------------------------------------------------------------------
-- Agenda combinada
--   origen: tarea | entrega | instalacion | seguimiento | cotizacion
--   Las entregas e instalaciones las ve todo el equipo (como las órdenes de trabajo).
--   Los seguimientos requieren "gestionar_clientes"; las cotizaciones por vencer,
--   "ver_precios" (sin montos).
-- ---------------------------------------------------------------------
create or replace function public.agenda(p_desde date, p_hasta date)
returns table (
  origen text,
  id uuid,
  fecha date,
  hora time,
  titulo text,
  detalle text,
  tipo text,
  prioridad public.prioridad,
  completada boolean,
  responsable_id uuid,
  cliente_id uuid,
  cliente text,
  pedido_id uuid,
  cotizacion_id uuid,
  oportunidad_id uuid,
  folio text,
  estado text
)
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'America/Mexico_City'
as $$
#variable_conflict use_column
declare
  v_precios boolean := public.tiene_permiso('ver_precios');
  v_comercial boolean := public.tiene_permiso('gestionar_clientes');
begin
  if not public.usuario_activo() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception 'Rango de fechas inválido';
  end if;
  if p_hasta - p_desde > 366 then
    raise exception 'Consulta como máximo un año a la vez';
  end if;

  return query
  select * from (
    select
      'tarea'::text, t.id, t.fecha, t.hora, t.titulo, t.descripcion, t.tipo::text, t.prioridad, t.completada,
      t.responsable_id, t.cliente_id, c.nombre, t.pedido_id, t.cotizacion_id, t.oportunidad_id,
      null::text, null::text
    from public.tareas t
    left join public.clientes c on c.id = t.cliente_id
    where t.fecha between p_desde and p_hasta

    union all

    select
      case when p.requiere_instalacion then 'instalacion' else 'entrega' end,
      p.id, p.fecha_entrega, null::time, p.titulo, null::text, null::text, p.prioridad,
      p.estado in ('entregado', 'finalizado'),
      p.responsable_id, p.cliente_id, c.nombre, p.id, p.cotizacion_id, null::uuid,
      p.folio, p.estado::text
    from public.pedidos p
    join public.clientes c on c.id = p.cliente_id
    where p.fecha_entrega between p_desde and p_hasta
      and p.estado <> 'cancelado'

    union all

    select
      'seguimiento', o.id, o.proxima_accion_fecha, null::time, o.titulo, o.proxima_accion, null::text,
      null::public.prioridad, false,
      o.responsable_id, o.cliente_id, c.nombre, null::uuid, null::uuid, o.id,
      null::text, o.etapa::text
    from public.oportunidades o
    join public.clientes c on c.id = o.cliente_id
    where v_comercial
      and o.proxima_accion_fecha between p_desde and p_hasta
      and o.etapa not in ('ganado', 'perdido')

    union all

    select
      'cotizacion', q.id, q.fecha_vencimiento, null::time,
      coalesce(nullif(trim(q.titulo), ''), 'Cotización ' || q.folio), 'Vence la cotización', null::text,
      null::public.prioridad, false,
      q.vendedor_id, q.cliente_id, c.nombre, null::uuid, q.id, q.oportunidad_id,
      q.folio, q.estado::text
    from public.cotizaciones q
    join public.clientes c on c.id = q.cliente_id
    where v_precios
      and q.estado = 'enviada'
      and q.fecha_vencimiento between p_desde and p_hasta
  ) x
  order by 3, 4 nulls last, 5;
end
$$;

revoke execute on function public.tg_tareas_antes() from public, anon, authenticated;
revoke execute on function public.agenda(date, date) from public, anon;
grant execute on function public.agenda(date, date) to authenticated, service_role;

-- >>> 20261014000300_proveedores_inventario.sql
-- =====================================================================
-- 13 · Proveedores e inventario de materiales
--
--   proveedores             proveedores de material y maquila
--   materiales              papel, vinil, lonas, tintas... con existencia y stock mínimo
--   material_costos         costo unitario (solo con "ver_costos")
--   movimientos_inventario  entradas, consumos, mermas y ajustes (no se editan ni se borran)
--
-- La existencia de cada material la calcula la base de datos a partir de sus
-- movimientos; nadie la escribe a mano. Un consumo o merma que la dejaría en
-- negativo se rechaza; solo un ajuste explícito puede dejarla así.
--
-- Permisos:
--   Ver materiales y movimientos: todo usuario activo.
--   Consumos y mermas: "registrar_consumos" (Producción) o "gestionar_inventario".
--   Entradas, ajustes y catálogo de materiales: "gestionar_inventario".
--   Proveedores: ver con "gestionar_inventario", "registrar_gastos" o "ver_costos";
--   crear y editar con "gestionar_inventario" o "registrar_gastos".
-- =====================================================================

-- ---------------------------------------------------------------------
-- Proveedores
-- ---------------------------------------------------------------------
create table public.proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) between 1 and 200),
  contacto text,
  telefono text,
  whatsapp text,
  email text,
  rfc text,
  categoria text,
  notas text,
  activo boolean not null default true,
  busqueda text generated always as (
    public.normalizar(
      nombre || ' ' || coalesce(contacto, '') || ' ' || coalesce(telefono, '') || ' '
      || coalesce(whatsapp, '') || ' ' || coalesce(email, '') || ' ' || coalesce(rfc, '') || ' '
      || coalesce(categoria, '')
    )
  ) stored,
  created_by uuid default auth.uid() references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.proveedores is 'Proveedores de material, servicios y maquila.';

create index proveedores_busqueda_idx on public.proveedores using gin (busqueda extensions.gin_trgm_ops);
create index proveedores_nombre_idx on public.proveedores (nombre);

create trigger proveedores_updated_at
before update on public.proveedores
for each row execute function public.tg_updated_at();

create trigger proveedores_bitacora
after insert or update or delete on public.proveedores
for each row execute function public.tg_bitacora();

alter table public.proveedores enable row level security;

revoke all on public.proveedores from public, anon, authenticated;
grant select, insert, update, delete on public.proveedores to authenticated;
grant all on public.proveedores to service_role;

create policy "proveedores: ver" on public.proveedores
  for select to authenticated
  using (
    (select public.tiene_permiso('gestionar_inventario'))
    or (select public.tiene_permiso('registrar_gastos'))
    or (select public.tiene_permiso('ver_costos'))
  );

create policy "proveedores: crear" on public.proveedores
  for insert to authenticated
  with check (
    (select public.tiene_permiso('gestionar_inventario'))
    or (select public.tiene_permiso('registrar_gastos'))
  );

create policy "proveedores: editar" on public.proveedores
  for update to authenticated
  using (
    (select public.tiene_permiso('gestionar_inventario'))
    or (select public.tiene_permiso('registrar_gastos'))
  )
  with check (
    (select public.tiene_permiso('gestionar_inventario'))
    or (select public.tiene_permiso('registrar_gastos'))
  );

-- Mejor desactivar (activo = false) que borrar: los gastos conservan el historial.
create policy "proveedores: eliminar" on public.proveedores
  for delete to authenticated
  using ((select public.tiene_permiso('eliminar_registros')));

-- ---------------------------------------------------------------------
-- Materiales
-- ---------------------------------------------------------------------
create type public.unidad_material as enum ('m2', 'metro', 'hoja', 'pieza', 'litro', 'rollo', 'kg', 'millar');

create type public.tipo_movimiento as enum ('entrada', 'consumo', 'ajuste', 'merma');

create table public.materiales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) between 1 and 200),
  categoria text,
  unidad public.unidad_material not null default 'pieza',
  -- Calculada con los movimientos. Al crear el material se puede indicar la existencia
  -- inicial: se registra sola como un ajuste "Existencia inicial".
  existencia numeric(14, 3) not null default 0,
  stock_minimo numeric(14, 3) not null default 0 check (stock_minimo >= 0),
  bajo_minimo boolean generated always as (
    activo and (existencia < 0 or (stock_minimo > 0 and existencia <= stock_minimo))
  ) stored,
  proveedor_id uuid references public.proveedores (id) on delete set null,
  ubicacion text,
  notas text,
  activo boolean not null default true,
  busqueda text generated always as (
    public.normalizar(nombre || ' ' || coalesce(categoria, '') || ' ' || coalesce(ubicacion, ''))
  ) stored,
  created_by uuid default auth.uid() references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.materiales is 'Inventario de materiales. La existencia la mantienen los movimientos.';
comment on column public.materiales.bajo_minimo is
  'Alerta de stock: activo y existencia en o por debajo del mínimo (o negativa).';

create unique index materiales_nombre_unico on public.materiales (public.normalizar(nombre));
create index materiales_busqueda_idx on public.materiales using gin (busqueda extensions.gin_trgm_ops);
create index materiales_bajo_minimo_idx on public.materiales (nombre) where bajo_minimo;
create index materiales_proveedor_idx on public.materiales (proveedor_id);

-- Costo unitario por unidad del material (restringido a "ver_costos").
create table public.material_costos (
  material_id uuid primary key references public.materiales (id) on delete cascade,
  costo_unitario numeric(12, 4) not null default 0 check (costo_unitario >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.material_costos is 'Costo por unidad de cada material. Se usa para valuar consumos.';

create trigger material_costos_updated_at
before update on public.material_costos
for each row execute function public.tg_updated_at();

-- ---------------------------------------------------------------------
-- Movimientos de inventario
-- ---------------------------------------------------------------------
create table public.movimientos_inventario (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materiales (id) on delete restrict,
  tipo public.tipo_movimiento not null,
  cantidad numeric(14, 3) not null,
  -- Existencia del material inmediatamente después del movimiento (para el kárdex).
  existencia_resultante numeric(14, 3) not null default 0,
  pedido_id uuid references public.pedidos (id) on delete set null,
  proveedor_id uuid references public.proveedores (id) on delete set null,
  referencia text check (referencia is null or length(referencia) <= 200),
  notas text check (notas is null or length(notas) <= 2000),
  usuario_id uuid default auth.uid() references public.perfiles (id) on delete set null,
  fecha timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint movimientos_cantidad_valida check (
    (tipo = 'ajuste' and cantidad <> 0) or (tipo <> 'ajuste' and cantidad > 0)
  )
);

comment on table public.movimientos_inventario is
  'Kárdex de materiales. No se modifican ni se borran: los errores se corrigen con un ajuste.';
comment on column public.movimientos_inventario.cantidad is
  'Entrada, consumo y merma: siempre positiva (el tipo indica si suma o resta). '
  'Ajuste: diferencia con signo (+5 suma, -5 resta).';

create index movimientos_material_idx on public.movimientos_inventario (material_id, fecha desc);
create index movimientos_pedido_idx on public.movimientos_inventario (pedido_id) where pedido_id is not null;
create index movimientos_proveedor_idx on public.movimientos_inventario (proveedor_id) where proveedor_id is not null;
create index movimientos_fecha_idx on public.movimientos_inventario (fecha desc);

-- Efecto de un movimiento sobre la existencia.
create or replace function public.delta_inventario(p_tipo public.tipo_movimiento, p_cantidad numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case when p_tipo in ('entrada', 'ajuste') then p_cantidad else -p_cantidad end
$$;

-- Cantidad legible: 2.500 → "2.5"
create or replace function public.cantidad_texto(p numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p is null then ''
    when position('.' in p::text) > 0 then rtrim(rtrim(p::text, '0'), '.')
    else p::text
  end
$$;

-- Materiales: la existencia solo cambia por movimientos.
create or replace function public.tg_materiales_antes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.existencia < 0 then
      raise exception 'La existencia inicial no puede ser negativa';
    end if;
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  -- Profundidad 1 = cambio hecho directamente por un usuario o función (no por un movimiento).
  if new.existencia is distinct from old.existencia and pg_trigger_depth() < 2 then
    raise exception 'La existencia se actualiza con movimientos de inventario (entrada, consumo, merma o ajuste)';
  end if;

  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end
$$;

create trigger materiales_antes
before insert or update on public.materiales
for each row execute function public.tg_materiales_antes();

-- La existencia inicial queda registrada como un ajuste.
create or replace function public.tg_materiales_inicial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.existencia <> 0 then
    insert into public.movimientos_inventario (material_id, tipo, cantidad, referencia, usuario_id)
    values (new.id, 'ajuste', new.existencia, 'Existencia inicial', auth.uid());
  end if;
  return null;
end
$$;

create trigger materiales_inicial
after insert on public.materiales
for each row execute function public.tg_materiales_inicial();

create trigger materiales_bitacora
after insert or update or delete on public.materiales
for each row execute function public.tg_bitacora();

create trigger material_costos_bitacora
after insert or update or delete on public.material_costos
for each row execute function public.tg_bitacora();

-- Movimientos: validan existencia suficiente y calculan el saldo.
create or replace function public.tg_movimientos_inventario_antes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mat public.materiales;
  v_actual numeric;
  v_nueva numeric;
begin
  -- Bloquea el material para que dos movimientos simultáneos no se pisen.
  select * into v_mat from public.materiales where id = new.material_id for update;
  if not found then
    raise exception 'Material no encontrado';
  end if;

  new.usuario_id := coalesce(auth.uid(), new.usuario_id);
  new.fecha := coalesce(new.fecha, now());
  new.created_at := now();
  if new.fecha > now() + interval '1 day' then
    raise exception 'La fecha del movimiento no puede ser futura';
  end if;

  select coalesce(sum(public.delta_inventario(m.tipo, m.cantidad)), 0)
  into v_actual
  from public.movimientos_inventario m
  where m.material_id = new.material_id;

  v_nueva := v_actual + public.delta_inventario(new.tipo, new.cantidad);

  if v_nueva < 0 and new.tipo in ('consumo', 'merma') then
    raise exception 'No hay suficiente existencia de %: quedan % %. Registra primero la entrada del material o pide un ajuste de inventario.',
      v_mat.nombre, public.cantidad_texto(v_actual), v_mat.unidad;
  end if;

  new.existencia_resultante := v_nueva;
  return new;
end
$$;

create trigger movimientos_inventario_antes
before insert on public.movimientos_inventario
for each row execute function public.tg_movimientos_inventario_antes();

create or replace function public.tg_movimientos_inventario_existencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_material uuid := coalesce(new.material_id, old.material_id);
begin
  update public.materiales
  set existencia = (
    select coalesce(sum(public.delta_inventario(m.tipo, m.cantidad)), 0)
    from public.movimientos_inventario m
    where m.material_id = v_material
  )
  where id = v_material;
  return null;
end
$$;

-- Solo inserciones (y borrados técnicos con la llave de servicio) cambian la existencia.
create trigger movimientos_inventario_existencia
after insert or delete on public.movimientos_inventario
for each row execute function public.tg_movimientos_inventario_existencia();

-- Inmutables: solo se permite que el pedido o proveedor ligado queden en nulo
-- (cuando se elimina ese pedido o proveedor).
create or replace function public.tg_movimientos_inventario_inmutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.material_id, new.tipo, new.cantidad, new.existencia_resultante, new.fecha, new.usuario_id,
      new.created_at, new.referencia, new.notas)
     is distinct from
     (old.material_id, old.tipo, old.cantidad, old.existencia_resultante, old.fecha, old.usuario_id,
      old.created_at, old.referencia, old.notas)
     or (new.pedido_id is distinct from old.pedido_id and new.pedido_id is not null)
     or (new.proveedor_id is distinct from old.proveedor_id and new.proveedor_id is not null) then
    raise exception 'Los movimientos de inventario no se modifican; registra un ajuste para corregir';
  end if;
  return new;
end
$$;

create trigger movimientos_inventario_inmutable
before update on public.movimientos_inventario
for each row execute function public.tg_movimientos_inventario_inmutable();

create trigger movimientos_inventario_bitacora
after insert or delete on public.movimientos_inventario
for each row execute function public.tg_bitacora();

-- ---------------------------------------------------------------------
-- Seguridad
-- ---------------------------------------------------------------------
alter table public.materiales enable row level security;
alter table public.material_costos enable row level security;
alter table public.movimientos_inventario enable row level security;

revoke all on public.materiales, public.material_costos, public.movimientos_inventario
  from public, anon, authenticated;
grant select, insert, update, delete on public.materiales to authenticated;
grant select, insert, update, delete on public.material_costos to authenticated;
-- Los movimientos solo se agregan: sin modificar ni borrar.
grant select, insert on public.movimientos_inventario to authenticated;
grant all on public.materiales, public.material_costos, public.movimientos_inventario to service_role;

create policy "materiales: ver" on public.materiales
  for select to authenticated
  using ((select public.usuario_activo()));

create policy "materiales: crear" on public.materiales
  for insert to authenticated
  with check ((select public.tiene_permiso('gestionar_inventario')));

create policy "materiales: editar" on public.materiales
  for update to authenticated
  using ((select public.tiene_permiso('gestionar_inventario')))
  with check ((select public.tiene_permiso('gestionar_inventario')));

-- Un material con movimientos no se puede borrar (se desactiva).
create policy "materiales: eliminar" on public.materiales
  for delete to authenticated
  using ((select public.tiene_permiso('gestionar_inventario')));

create policy "material_costos: ver" on public.material_costos
  for select to authenticated
  using ((select public.tiene_permiso('ver_costos')));

create policy "material_costos: administrar" on public.material_costos
  for all to authenticated
  using ((select public.tiene_permiso('ver_costos')) and (select public.tiene_permiso('gestionar_inventario')))
  with check ((select public.tiene_permiso('ver_costos')) and (select public.tiene_permiso('gestionar_inventario')));

create policy "movimientos_inventario: ver" on public.movimientos_inventario
  for select to authenticated
  using ((select public.usuario_activo()));

create policy "movimientos_inventario: registrar" on public.movimientos_inventario
  for insert to authenticated
  with check (
    (tipo in ('consumo', 'merma')
      and ((select public.tiene_permiso('registrar_consumos')) or (select public.tiene_permiso('gestionar_inventario'))))
    or (tipo in ('entrada', 'ajuste') and (select public.tiene_permiso('gestionar_inventario')))
  );

-- ---------------------------------------------------------------------
-- Conteo físico: deja la existencia en la cantidad contada con un ajuste.
-- ---------------------------------------------------------------------
create or replace function public.ajustar_existencia(
  p_material uuid,
  p_existencia numeric,
  p_notas text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actual numeric;
  v_mov uuid;
begin
  if not public.tiene_permiso('gestionar_inventario') then
    raise exception 'No tienes permiso para ajustar el inventario' using errcode = '42501';
  end if;
  if p_existencia is null then
    raise exception 'Indica la existencia contada';
  end if;

  select existencia into v_actual from public.materiales where id = p_material for update;
  if not found then
    raise exception 'Material no encontrado';
  end if;

  if p_existencia = v_actual then
    return jsonb_build_object('movimiento_id', null, 'existencia', v_actual, 'diferencia', 0);
  end if;

  insert into public.movimientos_inventario (material_id, tipo, cantidad, referencia, notas)
  values (p_material, 'ajuste', p_existencia - v_actual, 'Conteo físico', nullif(trim(p_notas), ''))
  returning id into v_mov;

  return jsonb_build_object(
    'movimiento_id', v_mov,
    'existencia', p_existencia,
    'diferencia', p_existencia - v_actual
  );
end
$$;

revoke execute on function public.tg_materiales_antes() from public, anon, authenticated;
revoke execute on function public.tg_materiales_inicial() from public, anon, authenticated;
revoke execute on function public.tg_movimientos_inventario_antes() from public, anon, authenticated;
revoke execute on function public.tg_movimientos_inventario_existencia() from public, anon, authenticated;
revoke execute on function public.tg_movimientos_inventario_inmutable() from public, anon, authenticated;
revoke execute on function public.delta_inventario(public.tipo_movimiento, numeric) from public, anon;
revoke execute on function public.cantidad_texto(numeric) from public, anon;
revoke execute on function public.ajustar_existencia(uuid, numeric, text) from public, anon;
grant execute on function public.delta_inventario(public.tipo_movimiento, numeric) to authenticated, service_role;
grant execute on function public.cantidad_texto(numeric) to authenticated, service_role;
grant execute on function public.ajustar_existencia(uuid, numeric, text) to authenticated, service_role;

-- >>> 20261014000400_gastos_caja.sql
-- =====================================================================
-- 14 · Gastos (compras, maquila y gastos generales) y corte de caja diario
--
--   gastos        salidas de dinero; ligadas a un pedido sirven para la utilidad real.
--                 No se borran: se cancelan con motivo (borrar requiere "eliminar_registros").
--   cortes_caja   cierre del día: efectivo esperado contra contado.
--
-- Permisos:
--   Gastos: ver con "registrar_gastos" o "ver_costos"; registrar, editar y cancelar
--   con "registrar_gastos". Comprobantes en el bucket "comprobantes", ruta gastos/<id>/...
--   Corte de caja: consultar con "registrar_pagos" o "ver_reportes"; cerrar con
--   "registrar_pagos"; reabrir (borrar el corte) solo administración.
--   Con la caja de un día cerrada, los pagos y gastos EN EFECTIVO de ese día ya no se
--   registran ni se modifican (salvo administración).
-- =====================================================================

create type public.categoria_gasto as enum (
  'material', 'maquila', 'servicios', 'renta', 'nomina', 'transporte', 'publicidad', 'impuestos', 'otros'
);

create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  concepto text not null check (length(trim(concepto)) between 1 and 300),
  categoria public.categoria_gasto not null default 'otros',
  proveedor_id uuid references public.proveedores (id) on delete set null,
  -- Ligar el gasto a un pedido (maquila, material comprado para ese trabajo) para la utilidad real.
  pedido_id uuid references public.pedidos (id) on delete set null,
  monto numeric(12, 2) not null check (monto > 0),
  metodo_pago public.metodo_pago not null default 'efectivo',
  referencia text check (referencia is null or length(referencia) <= 200),
  comprobante_path text,
  notas text check (notas is null or length(notas) <= 2000),
  cancelado boolean not null default false,
  motivo_cancelacion text,
  cancelado_por uuid references public.perfiles (id) on delete set null,
  cancelado_at timestamptz,
  usuario_id uuid default auth.uid() references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.gastos is 'Gastos, compras de material y maquila. Se cancelan con motivo en lugar de borrarse.';
comment on column public.gastos.monto is 'Importe pagado (con IVA si lo hubo).';

create index gastos_fecha_idx on public.gastos (fecha desc);
create index gastos_pedido_idx on public.gastos (pedido_id) where pedido_id is not null;
create index gastos_proveedor_idx on public.gastos (proveedor_id) where proveedor_id is not null;
create index gastos_categoria_idx on public.gastos (categoria, fecha desc);

create or replace function public.tg_gastos_validar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.usuario_id := coalesce(auth.uid(), new.usuario_id);
    new.cancelado := false;
    new.motivo_cancelacion := null;
    new.cancelado_por := null;
    new.cancelado_at := null;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  if old.cancelado and not new.cancelado then
    raise exception 'Un gasto cancelado no se puede reactivar; regístralo de nuevo';
  end if;

  if old.cancelado and (new.fecha, new.concepto, new.categoria, new.monto, new.metodo_pago, new.referencia,
                        new.comprobante_path, new.notas, new.motivo_cancelacion)
                       is distinct from
                       (old.fecha, old.concepto, old.categoria, old.monto, old.metodo_pago, old.referencia,
                        old.comprobante_path, old.notas, old.motivo_cancelacion) then
    raise exception 'Un gasto cancelado no se puede modificar';
  end if;

  if new.cancelado and not old.cancelado then
    if coalesce(trim(new.motivo_cancelacion), '') = '' then
      raise exception 'Indica el motivo de la cancelación del gasto';
    end if;
    new.cancelado_por := auth.uid();
    new.cancelado_at := now();
  elsif not new.cancelado then
    new.motivo_cancelacion := null;
    new.cancelado_por := null;
    new.cancelado_at := null;
  else
    new.cancelado_por := old.cancelado_por;
    new.cancelado_at := old.cancelado_at;
  end if;

  new.usuario_id := old.usuario_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end
$$;

create trigger gastos_validar
before insert or update on public.gastos
for each row execute function public.tg_gastos_validar();

create trigger gastos_bitacora
after insert or update or delete on public.gastos
for each row execute function public.tg_bitacora();

alter table public.gastos enable row level security;

revoke all on public.gastos from public, anon, authenticated;
grant select, insert, update, delete on public.gastos to authenticated;
grant all on public.gastos to service_role;

create policy "gastos: ver" on public.gastos
  for select to authenticated
  using ((select public.tiene_permiso('registrar_gastos')) or (select public.tiene_permiso('ver_costos')));

create policy "gastos: registrar" on public.gastos
  for insert to authenticated
  with check ((select public.tiene_permiso('registrar_gastos')));

create policy "gastos: editar o cancelar" on public.gastos
  for update to authenticated
  using ((select public.tiene_permiso('registrar_gastos')))
  with check ((select public.tiene_permiso('registrar_gastos')));

create policy "gastos: eliminar" on public.gastos
  for delete to authenticated
  using ((select public.tiene_permiso('eliminar_registros')));

-- ---------------------------------------------------------------------
-- Comprobantes de gastos: bucket "comprobantes", ruta gastos/<gasto_id>/archivo
-- Los comprobantes de pago (ruta pagos/...) siguen visibles con "ver_precios";
-- los de gastos ya no, solo con "registrar_gastos" o "ver_costos".
-- ---------------------------------------------------------------------
alter policy "comprobantes: ver" on storage.objects
  using (
    bucket_id = 'comprobantes'
    and coalesce((storage.foldername(name))[1], '') <> 'gastos'
    and (select public.tiene_permiso('ver_precios'))
  );

create policy "comprobantes de gastos: ver" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = 'gastos'
    and ((select public.tiene_permiso('registrar_gastos')) or (select public.tiene_permiso('ver_costos')))
  );

create policy "comprobantes de gastos: subir" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = 'gastos'
    and (select public.tiene_permiso('registrar_gastos'))
  );

create policy "comprobantes de gastos: eliminar propios" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = 'gastos'
    and owner_id = (select auth.uid())::text
    and (select public.tiene_permiso('registrar_gastos'))
  );

-- ---------------------------------------------------------------------
-- Corte de caja
-- ---------------------------------------------------------------------
create table public.cortes_caja (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  efectivo_inicial numeric(12, 2) not null default 0 check (efectivo_inicial >= 0),
  efectivo_contado numeric(12, 2) not null check (efectivo_contado >= 0),
  -- efectivo_inicial + cobros en efectivo − devoluciones en efectivo − gastos en efectivo
  esperado numeric(12, 2) not null,
  -- efectivo_contado − esperado (negativo = faltante, positivo = sobrante)
  diferencia numeric(12, 2) not null,
  -- Fotografía del día al cerrar (totales por método y por persona, sin detalle de gastos)
  resumen jsonb not null default '{}'::jsonb,
  notas text check (notas is null or length(notas) <= 2000),
  cerrado_por uuid default auth.uid() references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.cortes_caja is 'Cierres de caja diarios. Solo administración puede reabrir (borrar) un corte.';

create trigger cortes_caja_bitacora
after insert or update or delete on public.cortes_caja
for each row execute function public.tg_bitacora();

alter table public.cortes_caja enable row level security;

revoke all on public.cortes_caja from public, anon, authenticated;
-- Se escriben solo con las funciones cerrar_caja y reabrir_caja.
grant select on public.cortes_caja to authenticated;
grant all on public.cortes_caja to service_role;

create policy "cortes_caja: ver" on public.cortes_caja
  for select to authenticated
  using ((select public.tiene_permiso('registrar_pagos')) or (select public.tiene_permiso('ver_reportes')));

-- Con la caja cerrada, el efectivo de ese día queda bloqueado (salvo administración).
create or replace function public.tg_caja_cerrada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb;
  v_campo_metodo text := case tg_table_name when 'gastos' then 'metodo_pago' else 'metodo' end;
  v_campos text[] := case tg_table_name
    when 'gastos' then array['fecha', 'monto', 'metodo_pago', 'cancelado']
    else array['fecha', 'importe', 'tipo', 'metodo', 'cancelado'] end;
  k text;
  v_cambio boolean := false;
  v_fecha date;
begin
  if auth.uid() is null or public.es_admin() then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    foreach k in array v_campos loop
      if (v_new -> k) is distinct from (v_old -> k) then
        v_cambio := true;
      end if;
    end loop;
    if not v_cambio then
      return new;
    end if;
    if v_old ->> v_campo_metodo = 'efectivo'
       and exists (select 1 from public.cortes_caja c where c.fecha = (v_old ->> 'fecha')::date) then
      v_fecha := (v_old ->> 'fecha')::date;
    end if;
  end if;

  if v_fecha is null and v_new ->> v_campo_metodo = 'efectivo'
     and exists (select 1 from public.cortes_caja c where c.fecha = (v_new ->> 'fecha')::date) then
    v_fecha := (v_new ->> 'fecha')::date;
  end if;

  if v_fecha is not null then
    raise exception 'La caja del % ya está cerrada. Pide a administración que la reabra para registrar o cambiar movimientos en efectivo de ese día.',
      to_char(v_fecha, 'DD/MM/YYYY')
      using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger pagos_caja_cerrada
before insert or update on public.pagos
for each row execute function public.tg_caja_cerrada();

create trigger gastos_caja_cerrada
before insert or update on public.gastos
for each row execute function public.tg_caja_cerrada();

-- Cálculo del corte (uso interno). p_detalle_gastos agrega la lista de gastos del día.
create or replace function public.corte_caja_calcular(
  p_fecha date,
  p_efectivo_inicial numeric,
  p_detalle_gastos boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'America/Mexico_City'
as $$
declare
  v_corte public.cortes_caja;
  v_sugerido numeric;
  v_inicial numeric;
  v_ef_entradas numeric;
  v_ef_devoluciones numeric;
  v_ef_gastos numeric;
  v_entradas numeric;
  v_devoluciones numeric;
  r jsonb;
begin
  select * into v_corte from public.cortes_caja where fecha = p_fecha;

  select c.efectivo_contado into v_sugerido
  from public.cortes_caja c where c.fecha < p_fecha
  order by c.fecha desc limit 1;

  v_inicial := coalesce(p_efectivo_inicial, v_corte.efectivo_inicial, v_sugerido, 0);

  select
    coalesce(sum(pg.importe) filter (where pg.tipo <> 'devolucion'), 0),
    coalesce(sum(pg.importe) filter (where pg.tipo = 'devolucion'), 0),
    coalesce(sum(pg.importe) filter (where pg.tipo <> 'devolucion' and pg.metodo = 'efectivo'), 0),
    coalesce(sum(pg.importe) filter (where pg.tipo = 'devolucion' and pg.metodo = 'efectivo'), 0)
  into v_entradas, v_devoluciones, v_ef_entradas, v_ef_devoluciones
  from public.pagos pg
  where pg.fecha = p_fecha and not pg.cancelado;

  select coalesce(sum(g.monto), 0) into v_ef_gastos
  from public.gastos g
  where g.fecha = p_fecha and not g.cancelado and g.metodo_pago = 'efectivo';

  r := jsonb_build_object(
    'fecha', p_fecha,
    'cerrado', v_corte.id is not null,
    'efectivo_inicial', v_inicial,
    'efectivo_inicial_sugerido', v_sugerido,
    'totales', jsonb_build_object(
      'entradas', v_entradas,
      'devoluciones', v_devoluciones,
      'neto', v_entradas - v_devoluciones
    ),
    'efectivo', jsonb_build_object(
      'entradas', v_ef_entradas,
      'devoluciones', v_ef_devoluciones,
      'gastos', v_ef_gastos,
      'neto', v_ef_entradas - v_ef_devoluciones - v_ef_gastos
    ),
    'esperado', v_inicial + v_ef_entradas - v_ef_devoluciones - v_ef_gastos,
    'entradas_por_metodo', (
      select coalesce(jsonb_agg(jsonb_build_object('metodo', x.metodo, 'pagos', x.n, 'total', x.total)
                                order by x.metodo), '[]'::jsonb)
      from (
        select pg.metodo, count(*) as n, sum(pg.importe) as total
        from public.pagos pg
        where pg.fecha = p_fecha and not pg.cancelado and pg.tipo <> 'devolucion'
        group by pg.metodo
      ) x
    ),
    'devoluciones_por_metodo', (
      select coalesce(jsonb_agg(jsonb_build_object('metodo', x.metodo, 'pagos', x.n, 'total', x.total)
                                order by x.metodo), '[]'::jsonb)
      from (
        select pg.metodo, count(*) as n, sum(pg.importe) as total
        from public.pagos pg
        where pg.fecha = p_fecha and not pg.cancelado and pg.tipo = 'devolucion'
        group by pg.metodo
      ) x
    ),
    'por_usuario', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'usuario_id', x.registrado_por, 'nombre', coalesce(u.nombre, 'Sin usuario'),
               'pagos', x.n, 'entradas', x.entradas, 'devoluciones', x.devoluciones,
               'neto', x.entradas - x.devoluciones, 'efectivo_neto', x.efectivo
             ) order by coalesce(u.nombre, '')), '[]'::jsonb)
      from (
        select pg.registrado_por,
               count(*) as n,
               coalesce(sum(pg.importe) filter (where pg.tipo <> 'devolucion'), 0) as entradas,
               coalesce(sum(pg.importe) filter (where pg.tipo = 'devolucion'), 0) as devoluciones,
               coalesce(sum(case when pg.tipo = 'devolucion' then -pg.importe else pg.importe end)
                          filter (where pg.metodo = 'efectivo'), 0) as efectivo
        from public.pagos pg
        where pg.fecha = p_fecha and not pg.cancelado
        group by pg.registrado_por
      ) x
      left join public.perfiles u on u.id = x.registrado_por
    ),
    'pagos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', pg.id, 'pedido_id', pg.pedido_id, 'folio', p.folio, 'cliente', c.nombre,
               'tipo', pg.tipo, 'metodo', pg.metodo, 'importe', pg.importe, 'referencia', pg.referencia,
               'registrado_por', pg.registrado_por, 'usuario', u.nombre, 'created_at', pg.created_at
             ) order by pg.created_at), '[]'::jsonb)
      from public.pagos pg
      join public.pedidos p on p.id = pg.pedido_id
      left join public.clientes c on c.id = pg.cliente_id
      left join public.perfiles u on u.id = pg.registrado_por
      where pg.fecha = p_fecha and not pg.cancelado
    ),
    'cancelados', (
      select jsonb_build_object('pagos', count(*), 'total', coalesce(sum(pg.importe), 0))
      from public.pagos pg
      where pg.fecha = p_fecha and pg.cancelado
    ),
    'corte', case when v_corte.id is null then null else
      to_jsonb(v_corte) - 'resumen'
      || jsonb_build_object('cerrado_por_nombre', (select u.nombre from public.perfiles u where u.id = v_corte.cerrado_por))
    end
  );

  if p_detalle_gastos then
    r := r || jsonb_build_object(
      'gastos_por_metodo', (
        select coalesce(jsonb_agg(jsonb_build_object('metodo', x.metodo_pago, 'gastos', x.n, 'total', x.total)
                                  order by x.metodo_pago), '[]'::jsonb)
        from (
          select g.metodo_pago, count(*) as n, sum(g.monto) as total
          from public.gastos g
          where g.fecha = p_fecha and not g.cancelado
          group by g.metodo_pago
        ) x
      ),
      'gastos', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'id', g.id, 'concepto', g.concepto, 'categoria', g.categoria, 'monto', g.monto,
                 'metodo_pago', g.metodo_pago, 'proveedor', pr.nombre, 'pedido_id', g.pedido_id
               ) order by g.created_at), '[]'::jsonb)
        from public.gastos g
        left join public.proveedores pr on pr.id = g.proveedor_id
        where g.fecha = p_fecha and not g.cancelado
      )
    );
  end if;

  return r;
end
$$;

-- Resumen del día para la pantalla de corte de caja.
create or replace function public.corte_caja_resumen(
  p_fecha date default null,
  p_efectivo_inicial numeric default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'America/Mexico_City'
as $$
begin
  if not (public.tiene_permiso('registrar_pagos') or public.tiene_permiso('ver_reportes')) then
    raise exception 'No tienes permiso para consultar la caja' using errcode = '42501';
  end if;
  return public.corte_caja_calcular(
    coalesce(p_fecha, current_date),
    p_efectivo_inicial,
    public.tiene_permiso('registrar_gastos') or public.tiene_permiso('ver_costos')
  );
end
$$;

-- Cierra la caja de un día. Requiere "registrar_pagos".
create or replace function public.cerrar_caja(
  p_fecha date,
  p_efectivo_inicial numeric,
  p_efectivo_contado numeric,
  p_notas text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set timezone = 'America/Mexico_City'
as $$
declare
  v_fecha date := coalesce(p_fecha, current_date);
  v_res jsonb;
  v_esperado numeric;
  v_corte public.cortes_caja;
begin
  if not public.tiene_permiso('registrar_pagos') then
    raise exception 'No tienes permiso para cerrar la caja' using errcode = '42501';
  end if;
  if v_fecha > current_date then
    raise exception 'No se puede cerrar la caja de una fecha futura';
  end if;
  if p_efectivo_contado is null or p_efectivo_contado < 0 then
    raise exception 'Indica el efectivo contado en caja';
  end if;
  if coalesce(p_efectivo_inicial, 0) < 0 then
    raise exception 'El efectivo inicial no puede ser negativo';
  end if;
  if length(coalesce(p_notas, '')) > 2000 then
    raise exception 'Las notas pueden tener hasta 2000 caracteres';
  end if;

  -- Un solo cierre a la vez por fecha
  perform pg_advisory_xact_lock(hashtext('cortes_caja:' || v_fecha::text));
  if exists (select 1 from public.cortes_caja where fecha = v_fecha) then
    raise exception 'La caja del % ya está cerrada', to_char(v_fecha, 'DD/MM/YYYY');
  end if;

  v_res := public.corte_caja_calcular(v_fecha, coalesce(p_efectivo_inicial, 0), false);
  v_esperado := (v_res ->> 'esperado')::numeric;

  insert into public.cortes_caja (
    fecha, efectivo_inicial, efectivo_contado, esperado, diferencia, resumen, notas, cerrado_por
  ) values (
    v_fecha, coalesce(p_efectivo_inicial, 0), p_efectivo_contado, v_esperado,
    p_efectivo_contado - v_esperado,
    v_res - 'corte' - 'cerrado' - 'efectivo_inicial_sugerido',
    nullif(trim(p_notas), ''), auth.uid()
  )
  returning * into v_corte;

  return to_jsonb(v_corte);
end
$$;

-- Reabre la caja de un día (borra el corte). Solo administración, con motivo.
create or replace function public.reabrir_caja(p_fecha date, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_corte public.cortes_caja;
begin
  if not public.es_admin() then
    raise exception 'Solo administración puede reabrir la caja' using errcode = '42501';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Indica el motivo para reabrir la caja';
  end if;

  delete from public.cortes_caja where fecha = p_fecha returning * into v_corte;
  if not found then
    raise exception 'La caja de esa fecha no está cerrada';
  end if;

  insert into public.bitacora (tabla, registro_id, accion, etiqueta, datos, usuario_id, usuario_nombre)
  values (
    'cortes_caja', v_corte.id::text, 'cancelar',
    'Caja del ' || to_char(p_fecha, 'DD/MM/YYYY') || ' reabierta: ' || left(trim(p_motivo), 500),
    jsonb_build_object('motivo', left(trim(p_motivo), 500)),
    auth.uid(),
    (select nombre from public.perfiles where id = auth.uid())
  );
end
$$;

revoke execute on function public.tg_gastos_validar() from public, anon, authenticated;
revoke execute on function public.tg_caja_cerrada() from public, anon, authenticated;
revoke execute on function public.corte_caja_calcular(date, numeric, boolean) from public, anon, authenticated;
revoke execute on function public.corte_caja_resumen(date, numeric) from public, anon;
revoke execute on function public.cerrar_caja(date, numeric, numeric, text) from public, anon;
revoke execute on function public.reabrir_caja(date, text) from public, anon;
grant execute on function public.corte_caja_resumen(date, numeric) to authenticated, service_role;
grant execute on function public.cerrar_caja(date, numeric, numeric, text) to authenticated, service_role;
grant execute on function public.reabrir_caja(date, text) to authenticated, service_role;

-- >>> 20261014000500_reportes_comisiones.sql
-- =====================================================================
-- 15 · Reportes, utilidad real, comisiones, cobranza y reactivación
--
-- Todas las funciones validan permisos por dentro:
--   reporte_ventas, reporte_productos, reporte_vendedores, reporte_clientes  → "ver_reportes"
--   utilidad_pedidos                                                         → "ver_reportes" y "ver_costos"
--   clientes_inactivos   → "gestionar_clientes" (montos solo con "ver_precios")
--   comisiones, comisiones_detalle → cada quien ve las suyas; con "ver_reportes", las de todos
--   cuentas_por_cobrar   → "ver_precios"
--
-- Criterios:
--   vendido   = total de pedidos no cancelados, por fecha de creación del pedido.
--   cobrado   = pagos no cancelados menos devoluciones, por fecha del pago.
--   cotizado  = total de cotizaciones enviadas, aceptadas o rechazadas (sin borradores
--               ni canceladas), por fecha de la cotización.
--   Fechas en hora de Guadalajara.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Validaciones comunes (uso interno)
-- ---------------------------------------------------------------------
create or replace function public.validar_rango_reporte(p_desde date, p_hasta date, p_max_dias integer default 3660)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_desde is null or p_hasta is null then
    raise exception 'Indica las fechas del reporte';
  end if;
  if p_hasta < p_desde then
    raise exception 'La fecha final debe ser posterior a la inicial';
  end if;
  if p_hasta - p_desde > p_max_dias then
    raise exception 'El periodo es demasiado largo: consulta como máximo % días', p_max_dias;
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- Ventas por periodo (día, semana o mes)
-- ---------------------------------------------------------------------
create or replace function public.reporte_ventas(p_desde date, p_hasta date, p_agrupar text default 'dia')
returns table (
  periodo date,
  vendido numeric,
  pedidos integer,
  cobrado numeric,
  cotizado numeric,
  cotizaciones integer
)
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'America/Mexico_City'
as $$
#variable_conflict use_column
declare
  v_unidad text;
begin
  if not public.tiene_permiso('ver_reportes') then
    raise exception 'No tienes permiso para ver reportes' using errcode = '42501';
  end if;
  v_unidad := case coalesce(p_agrupar, 'dia')
    when 'dia' then 'day' when 'semana' then 'week' when 'mes' then 'month' end;
  if v_unidad is null then
    raise exception 'Agrupación inválida: usa dia, semana o mes';
  end if;
  perform public.validar_rango_reporte(p_desde, p_hasta,
    case v_unidad when 'day' then 400 when 'week' then 1830 else 3660 end);

  return query
  with periodos as (
    select gs::date as periodo
    from generate_series(
      date_trunc(v_unidad, p_desde::timestamp),
      date_trunc(v_unidad, p_hasta::timestamp),
      ('1 ' || v_unidad)::interval
    ) gs
  ),
  ped as (
    select date_trunc(v_unidad, (p.created_at)::date::timestamp)::date as periodo,
           sum(p.total) as vendido, count(*) as n
    from public.pedidos p
    where p.estado <> 'cancelado' and (p.created_at)::date between p_desde and p_hasta
    group by 1
  ),
  pag as (
    select date_trunc(v_unidad, pg.fecha::timestamp)::date as periodo,
           sum(case when pg.tipo = 'devolucion' then -pg.importe else pg.importe end) as cobrado
    from public.pagos pg
    where not pg.cancelado and pg.fecha between p_desde and p_hasta
    group by 1
  ),
  cot as (
    select date_trunc(v_unidad, q.fecha::timestamp)::date as periodo,
           sum(q.total) as cotizado, count(*) as n
    from public.cotizaciones q
    where q.estado in ('enviada', 'aceptada', 'rechazada') and q.fecha between p_desde and p_hasta
    group by 1
  )
  select per.periodo,
         coalesce(ped.vendido, 0)::numeric,
         coalesce(ped.n, 0)::integer,
         coalesce(pag.cobrado, 0)::numeric,
         coalesce(cot.cotizado, 0)::numeric,
         coalesce(cot.n, 0)::integer
  from periodos per
  left join ped on ped.periodo = per.periodo
  left join pag on pag.periodo = per.periodo
  left join cot on cot.periodo = per.periodo
  order by per.periodo;
end
$$;

-- ---------------------------------------------------------------------
-- Productos más vendidos (importe de partidas de pedidos no cancelados)
-- Los conceptos sin producto del catálogo se agrupan por tipo de partida.
-- ---------------------------------------------------------------------
create or replace function public.reporte_productos(p_desde date, p_hasta date, p_limite integer default 20)
returns table (
  producto_id uuid,
  producto text,
  categoria text,
  tipo text,
  unidad text,
  cantidad numeric,
  unidades numeric,
  importe numeric,
  pedidos integer
)
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'America/Mexico_City'
as $$
#variable_conflict use_column
begin
  if not public.tiene_permiso('ver_reportes') then
    raise exception 'No tienes permiso para ver reportes' using errcode = '42501';
  end if;
  perform public.validar_rango_reporte(p_desde, p_hasta);

  return query
  select
    x.producto_id,
    coalesce(pr.nombre, case x.tipo
      when 'instalacion' then 'Instalación'
      when 'transporte' then 'Transporte'
      when 'diseno' then 'Diseño'
      when 'extra' then 'Extras'
      else 'Conceptos sin producto' end),
    cat.nombre,
    x.tipo,
    pr.unidad,
    x.cantidad,
    x.unidades,
    x.importe,
    x.pedidos
  from (
    select
      pa.producto_id,
      case when pa.producto_id is null then pa.tipo::text end as tipo,
      sum(pa.cantidad) as cantidad,
      sum(public.unidades_cobro(pa.metodo_calculo, pa.cantidad, pa.ancho, pa.alto, pa.largo)) as unidades,
      sum(pa.importe) as importe,
      count(distinct pa.pedido_id)::integer as pedidos
    from public.partidas pa
    join public.pedidos p on p.id = pa.pedido_id
    where p.estado <> 'cancelado' and (p.created_at)::date between p_desde and p_hasta
    group by pa.producto_id, case when pa.producto_id is null then pa.tipo::text end
  ) x
  left join public.productos pr on pr.id = x.producto_id
  left join public.categorias cat on cat.id = pr.categoria_id
  order by x.importe desc, x.cantidad desc
  limit least(greatest(coalesce(p_limite, 20), 1), 200);
end
$$;

-- ---------------------------------------------------------------------
-- Desempeño por vendedor
-- ---------------------------------------------------------------------
create or replace function public.reporte_vendedores(p_desde date, p_hasta date)
returns table (
  vendedor_id uuid,
  nombre text,
  cotizaciones integer,
  cotizado numeric,
  aceptadas integer,
  rechazadas integer,
  tasa_cierre numeric,
  pedidos integer,
  vendido numeric,
  cobrado numeric,
  ticket_promedio numeric
)
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'America/Mexico_City'
as $$
#variable_conflict use_column
begin
  if not public.tiene_permiso('ver_reportes') then
    raise exception 'No tienes permiso para ver reportes' using errcode = '42501';
  end if;
  perform public.validar_rango_reporte(p_desde, p_hasta);

  return query
  with cot as (
    select q.vendedor_id,
           count(*) as n,
           sum(q.total) as total,
           count(*) filter (where q.estado = 'aceptada') as aceptadas,
           count(*) filter (where q.estado = 'rechazada') as rechazadas
    from public.cotizaciones q
    where q.estado in ('enviada', 'aceptada', 'rechazada') and q.fecha between p_desde and p_hasta
    group by q.vendedor_id
  ),
  ped as (
    select p.vendedor_id, count(*) as n, sum(p.total) as total
    from public.pedidos p
    where p.estado <> 'cancelado' and (p.created_at)::date between p_desde and p_hasta
    group by p.vendedor_id
  ),
  pag as (
    select p.vendedor_id,
           sum(case when pg.tipo = 'devolucion' then -pg.importe else pg.importe end) as total
    from public.pagos pg
    join public.pedidos p on p.id = pg.pedido_id
    where not pg.cancelado and pg.fecha between p_desde and p_hasta
    group by p.vendedor_id
  ),
  ids as (
    select cot.vendedor_id from cot
    union select ped.vendedor_id from ped
    union select pag.vendedor_id from pag
  )
  select
    ids.vendedor_id,
    coalesce(u.nombre, 'Sin vendedor'),
    coalesce(cot.n, 0)::integer,
    coalesce(cot.total, 0)::numeric,
    coalesce(cot.aceptadas, 0)::integer,
    coalesce(cot.rechazadas, 0)::integer,
    case when coalesce(cot.aceptadas, 0) + coalesce(cot.rechazadas, 0) = 0 then null
      else round(100.0 * cot.aceptadas / (cot.aceptadas + cot.rechazadas), 1) end,
    coalesce(ped.n, 0)::integer,
    coalesce(ped.total, 0)::numeric,
    coalesce(pag.total, 0)::numeric,
    case when coalesce(ped.n, 0) = 0 then null else round(ped.total / ped.n, 2) end
  from ids
  left join cot on cot.vendedor_id is not distinct from ids.vendedor_id
  left join ped on ped.vendedor_id is not distinct from ids.vendedor_id
  left join pag on pag.vendedor_id is not distinct from ids.vendedor_id
  left join public.perfiles u on u.id = ids.vendedor_id
  order by coalesce(ped.total, 0) desc, coalesce(u.nombre, '');
end
$$;

-- ---------------------------------------------------------------------
-- Mejores clientes
-- ---------------------------------------------------------------------
create or replace function public.reporte_clientes(p_desde date, p_hasta date, p_limite integer default 20)
returns table (
  cliente_id uuid,
  nombre text,
  whatsapp text,
  pedidos integer,
  vendido numeric,
  cobrado numeric,
  saldo numeric,
  ticket_promedio numeric,
  ultima_compra timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'America/Mexico_City'
as $$
#variable_conflict use_column
begin
  if not public.tiene_permiso('ver_reportes') then
    raise exception 'No tienes permiso para ver reportes' using errcode = '42501';
  end if;
  perform public.validar_rango_reporte(p_desde, p_hasta);

  return query
  with ped as (
    select p.cliente_id, count(*) as n, sum(p.total) as total, sum(greatest(p.saldo, 0)) as saldo
    from public.pedidos p
    where p.estado <> 'cancelado' and (p.created_at)::date between p_desde and p_hasta
    group by p.cliente_id
  ),
  pag as (
    select pg.cliente_id,
           sum(case when pg.tipo = 'devolucion' then -pg.importe else pg.importe end) as total
    from public.pagos pg
    where not pg.cancelado and pg.fecha between p_desde and p_hasta
    group by pg.cliente_id
  )
  select
    c.id,
    c.nombre,
    coalesce(c.whatsapp, c.telefono),
    ped.n::integer,
    ped.total::numeric,
    coalesce(pag.total, 0)::numeric,
    ped.saldo::numeric,
    round(ped.total / ped.n, 2),
    (select max(p2.created_at) from public.pedidos p2 where p2.cliente_id = c.id and p2.estado <> 'cancelado')
  from ped
  join public.clientes c on c.id = ped.cliente_id
  left join pag on pag.cliente_id = ped.cliente_id
  order by ped.total desc, c.nombre
  limit least(greatest(coalesce(p_limite, 20), 1), 200);
end
$$;

-- ---------------------------------------------------------------------
-- Utilidad por pedido: estimada (costos de partidas) y real (gastos ligados al
-- pedido + consumos y mermas de material ligados al pedido × costo unitario actual).
-- La venta es sin IVA.
-- ---------------------------------------------------------------------
create or replace function public.utilidad_pedidos(p_desde date, p_hasta date)
returns table (
  pedido_id uuid,
  folio text,
  titulo text,
  cliente_id uuid,
  cliente text,
  vendedor_id uuid,
  estado public.estado_pedido,
  estado_pago public.estado_pago,
  fecha date,
  venta numeric,
  costo_estimado numeric,
  gastos numeric,
  consumo_material numeric,
  costo_real numeric,
  utilidad_estimada numeric,
  utilidad_real numeric,
  margen_estimado_pct numeric,
  margen_real_pct numeric,
  consumos_sin_costo integer
)
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'America/Mexico_City'
as $$
#variable_conflict use_column
begin
  if not (public.tiene_permiso('ver_reportes') and public.tiene_permiso('ver_costos')) then
    raise exception 'No tienes permiso para ver costos y utilidades' using errcode = '42501';
  end if;
  perform public.validar_rango_reporte(p_desde, p_hasta);

  return query
  select
    x.id, x.folio, x.titulo, x.cliente_id, x.cliente, x.vendedor_id, x.estado, x.estado_pago, x.fecha,
    x.venta, x.costo_estimado, x.gastos, x.consumo,
    x.gastos + x.consumo,
    x.venta - x.costo_estimado,
    x.venta - (x.gastos + x.consumo),
    case when x.venta > 0 then round(100 * (x.venta - x.costo_estimado) / x.venta, 1) end,
    case when x.venta > 0 then round(100 * (x.venta - x.gastos - x.consumo) / x.venta, 1) end,
    x.sin_costo
  from (
    select
      p.id, p.folio, p.titulo, p.cliente_id, c.nombre as cliente, p.vendedor_id, p.estado, p.estado_pago,
      (p.created_at)::date as fecha,
      (p.total - p.iva) as venta,
      coalesce((
        select sum(pc.costo_total)
        from public.partidas pa join public.partida_costos pc on pc.partida_id = pa.id
        where pa.pedido_id = p.id
      ), 0)::numeric as costo_estimado,
      coalesce((
        select sum(g.monto) from public.gastos g where g.pedido_id = p.id and not g.cancelado
      ), 0)::numeric as gastos,
      coalesce((
        select round(sum(m.cantidad * coalesce(mc.costo_unitario, 0)), 2)
        from public.movimientos_inventario m
        left join public.material_costos mc on mc.material_id = m.material_id
        where m.pedido_id = p.id and m.tipo in ('consumo', 'merma')
      ), 0)::numeric as consumo,
      (
        select count(*)
        from public.movimientos_inventario m
        left join public.material_costos mc on mc.material_id = m.material_id
        where m.pedido_id = p.id and m.tipo in ('consumo', 'merma') and coalesce(mc.costo_unitario, 0) = 0
      )::integer as sin_costo
    from public.pedidos p
    join public.clientes c on c.id = p.cliente_id
    where p.estado <> 'cancelado' and (p.created_at)::date between p_desde and p_hasta
  ) x
  order by x.fecha desc, x.folio desc;
end
$$;

-- ---------------------------------------------------------------------
-- Clientes para reactivar: sin compras desde hace N días
-- (por defecto configuracion.dias_reactivacion).
-- ---------------------------------------------------------------------
create or replace function public.clientes_inactivos(p_dias integer default null)
returns table (
  cliente_id uuid,
  nombre text,
  whatsapp text,
  telefono text,
  email text,
  etiquetas text[],
  ultima_compra timestamptz,
  dias_sin_compra integer,
  pedidos integer,
  total_comprado numeric,
  vendedor_id uuid,
  vendedor text
)
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'America/Mexico_City'
as $$
#variable_conflict use_column
declare
  v_dias integer;
  v_precios boolean := public.tiene_permiso('ver_precios');
begin
  if not public.tiene_permiso('gestionar_clientes') then
    raise exception 'No tienes permiso para ver clientes por reactivar' using errcode = '42501';
  end if;
  v_dias := coalesce(p_dias, (select dias_reactivacion from public.configuracion where id = 1), 90);
  if v_dias < 1 or v_dias > 3650 then
    raise exception 'Indica un número de días entre 1 y 3650';
  end if;

  return query
  select
    c.id, c.nombre, c.whatsapp, c.telefono, c.email, c.etiquetas,
    x.ultima,
    (current_date - (x.ultima)::date)::integer,
    x.n::integer,
    case when v_precios then x.total end,
    coalesce(c.vendedor_id, x.ultimo_vendedor),
    u.nombre
  from (
    select p.cliente_id,
           max(p.created_at) as ultima,
           count(*) as n,
           sum(p.total) as total,
           (array_agg(p.vendedor_id order by p.created_at desc))[1] as ultimo_vendedor
    from public.pedidos p
    where p.estado <> 'cancelado'
    group by p.cliente_id
  ) x
  join public.clientes c on c.id = x.cliente_id
  left join public.perfiles u on u.id = coalesce(c.vendedor_id, x.ultimo_vendedor)
  where c.activo and x.ultima < now() - make_interval(days => v_dias)
  order by x.ultima desc;
end
$$;

-- ---------------------------------------------------------------------
-- Comisiones sobre ventas COBRADAS en el periodo.
--   cobrado        = pagos del periodo menos devoluciones, de pedidos que vendió la persona
--   base_comision  = lo cobrado sin IVA (proporcional al IVA de cada pedido)
--   comision       = base_comision × comision_pct del perfil
-- Sin "ver_reportes" cada quien ve solo lo suyo.
-- ---------------------------------------------------------------------
create or replace function public.comisiones_detalle(p_desde date, p_hasta date, p_vendedor uuid default null)
returns table (
  vendedor_id uuid,
  vendedor text,
  comision_pct numeric,
  pedido_id uuid,
  folio text,
  cliente text,
  pagos integer,
  cobrado numeric,
  base_comision numeric,
  comision numeric
)
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'America/Mexico_City'
as $$
#variable_conflict use_column
declare
  v_todos boolean := public.tiene_permiso('ver_reportes');
  v_vendedor uuid := p_vendedor;
begin
  if not public.usuario_activo() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  perform public.validar_rango_reporte(p_desde, p_hasta);
  if not v_todos then
    v_vendedor := auth.uid();
  end if;

  return query
  select
    p.vendedor_id,
    u.nombre,
    u.comision_pct,
    p.id,
    p.folio,
    c.nombre,
    count(*)::integer,
    sum(case when pg.tipo = 'devolucion' then -pg.importe else pg.importe end),
    round(sum(case when pg.tipo = 'devolucion' then -pg.importe else pg.importe end
              * case when p.total > 0 then (p.total - p.iva) / p.total else 1 end), 2),
    round(round(sum(case when pg.tipo = 'devolucion' then -pg.importe else pg.importe end
                    * case when p.total > 0 then (p.total - p.iva) / p.total else 1 end), 2)
          * coalesce(u.comision_pct, 0) / 100, 2)
  from public.pagos pg
  join public.pedidos p on p.id = pg.pedido_id
  join public.perfiles u on u.id = p.vendedor_id
  left join public.clientes c on c.id = p.cliente_id
  where not pg.cancelado
    and pg.fecha between p_desde and p_hasta
    and (v_vendedor is null or p.vendedor_id = v_vendedor)
  group by p.vendedor_id, u.nombre, u.comision_pct, p.id, p.folio, c.nombre
  order by u.nombre, p.folio;
end
$$;

create or replace function public.comisiones(p_desde date, p_hasta date)
returns table (
  vendedor_id uuid,
  nombre text,
  comision_pct numeric,
  pedidos integer,
  pagos integer,
  cobrado numeric,
  base_comision numeric,
  comision numeric
)
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'America/Mexico_City'
as $$
#variable_conflict use_column
declare
  v_todos boolean := public.tiene_permiso('ver_reportes');
begin
  if not public.usuario_activo() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  perform public.validar_rango_reporte(p_desde, p_hasta);

  return query
  with det as (
    select * from public.comisiones_detalle(p_desde, p_hasta, null)
  ),
  personas as (
    select u.id, u.nombre, u.comision_pct
    from public.perfiles u
    where (v_todos and (u.activo and u.comision_pct > 0 or u.id in (select det.vendedor_id from det)))
       or (not v_todos and u.id = auth.uid())
  )
  select
    pe.id,
    pe.nombre,
    pe.comision_pct,
    count(det.pedido_id)::integer,
    coalesce(sum(det.pagos), 0)::integer,
    coalesce(sum(det.cobrado), 0)::numeric,
    coalesce(sum(det.base_comision), 0)::numeric,
    coalesce(sum(det.comision), 0)::numeric
  from personas pe
  left join det on det.vendedor_id = pe.id
  group by pe.id, pe.nombre, pe.comision_pct
  order by coalesce(sum(det.comision), 0) desc, pe.nombre;
end
$$;

-- ---------------------------------------------------------------------
-- Cuentas por cobrar
--   fecha_limite: la del pedido; si no tiene, la creación + días de crédito del
--   cliente; si tampoco, la fecha en que se entregó (el saldo se cobra al entregar).
-- ---------------------------------------------------------------------
create or replace function public.cuentas_por_cobrar()
returns table (
  pedido_id uuid,
  folio text,
  titulo text,
  cliente_id uuid,
  cliente text,
  whatsapp text,
  vendedor_id uuid,
  vendedor text,
  estado public.estado_pedido,
  estado_pago public.estado_pago,
  total numeric,
  pagado numeric,
  saldo numeric,
  creado date,
  fecha_entrega date,
  fecha_limite date,
  dias_transcurridos integer,
  dias_vencido integer,
  vencido boolean
)
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'America/Mexico_City'
as $$
#variable_conflict use_column
begin
  if not public.tiene_permiso('ver_precios') then
    raise exception 'No tienes permiso para ver la cobranza' using errcode = '42501';
  end if;

  return query
  select
    x.id, x.folio, x.titulo, x.cliente_id, x.cliente, x.whatsapp, x.vendedor_id, x.vendedor,
    x.estado, x.estado_pago, x.total, x.pagado, x.saldo, x.creado, x.fecha_entrega, x.limite,
    (current_date - x.creado)::integer,
    case when x.limite is not null and x.limite < current_date then (current_date - x.limite)::integer else 0 end,
    coalesce(x.limite < current_date, false)
  from (
    select
      p.id, p.folio, p.titulo, p.cliente_id, c.nombre as cliente, coalesce(c.whatsapp, c.telefono) as whatsapp,
      p.vendedor_id, u.nombre as vendedor, p.estado, p.estado_pago, p.total, p.pagado, p.saldo,
      (p.created_at)::date as creado, p.fecha_entrega,
      coalesce(
        p.fecha_limite_pago,
        case when c.dias_credito > 0 then (p.created_at)::date + c.dias_credito end,
        (p.entregado_at)::date
      ) as limite
    from public.pedidos p
    join public.clientes c on c.id = p.cliente_id
    left join public.perfiles u on u.id = p.vendedor_id
    where p.estado <> 'cancelado' and p.saldo > 0
  ) x
  order by coalesce(x.limite < current_date, false) desc,
           case when x.limite is not null and x.limite < current_date then current_date - x.limite else 0 end desc,
           x.saldo desc;
end
$$;

-- ---------------------------------------------------------------------
-- Panel de control: misma respuesta que antes más tareas, stock bajo y caja.
--   tareas_hoy          mis tareas sin completar con fecha de hoy o anterior (hasta 10)
--   tareas_pendientes   cuántas son
--   stock_bajo          {cantidad, materiales: [...hasta 5]}
--   caja_hoy            {cerrada} (con "registrar_pagos")
-- ---------------------------------------------------------------------
create or replace function public.dashboard_resumen()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r jsonb;
  v_uid uuid := auth.uid();
  v_precios boolean := public.tiene_permiso('ver_precios');
  v_reportes boolean := public.tiene_permiso('ver_reportes');
  v_costos boolean := public.tiene_permiso('ver_costos');
  v_comercial boolean := public.tiene_permiso('gestionar_clientes');
  v_hoy date := current_date;
  v_mes date := date_trunc('month', current_date)::date;
  v_mes_ant date := (date_trunc('month', current_date) - interval '1 month')::date;
begin
  if not public.usuario_activo() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  -- Producción: visible para todos
  r := jsonb_build_object(
    'hoy', v_hoy,
    'pedidos_por_estado', (
      select coalesce(jsonb_object_agg(estado, n), '{}'::jsonb)
      from (
        select estado, count(*) as n from public.pedidos
        where estado not in ('finalizado', 'cancelado')
        group by estado
      ) s
    ),
    'pedidos_activos', (
      select count(*) from public.pedidos where estado not in ('entregado', 'finalizado', 'cancelado')
    ),
    'pedidos_atrasados', (
      select count(*) from public.pedidos
      where fecha_entrega < v_hoy and estado not in ('entregado', 'finalizado', 'cancelado')
    ),
    'pedidos_pausados', (select count(*) from public.pedidos where estado = 'pausado'),
    'entregas_proximas', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.fecha_entrega, x.folio), '[]'::jsonb)
      from (
        select p.id, p.folio, p.titulo, p.estado, p.prioridad, p.fecha_entrega, c.nombre as cliente,
               p.requiere_instalacion
        from public.pedidos p join public.clientes c on c.id = p.cliente_id
        where p.estado not in ('entregado', 'finalizado', 'cancelado')
          and p.fecha_entrega is not null and p.fecha_entrega <= v_hoy + 7
        order by p.fecha_entrega, p.folio
        limit 10
      ) x
    ),
    'mis_pendientes', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.fecha_entrega nulls last, x.folio), '[]'::jsonb)
      from (
        select p.id, p.folio, p.titulo, p.estado, p.prioridad, p.fecha_entrega, c.nombre as cliente
        from public.pedidos p join public.clientes c on c.id = p.cliente_id
        where p.estado not in ('entregado', 'finalizado', 'cancelado')
          and (p.responsable_id = v_uid or p.disenador_id = v_uid)
        order by p.fecha_entrega nulls last, p.folio
        limit 10
      ) x
    ),
    'disenos_pendientes', (
      select count(*) from public.archivos a join public.pedidos p on p.id = a.pedido_id
      where a.categoria = 'diseno' and a.estado_aprobacion = 'pendiente'
        and p.estado not in ('finalizado', 'cancelado')
    )
  );

  -- Cotizaciones
  if v_precios then
    r := r || jsonb_build_object(
      'cotizaciones_abiertas', (
        select jsonb_build_object('cantidad', count(*), 'total', coalesce(sum(total), 0))
        from public.cotizaciones
        where estado in ('borrador', 'enviada') and fecha_vencimiento >= v_hoy
      ),
      'cotizaciones_por_vencer', (
        select coalesce(jsonb_agg(to_jsonb(x) order by x.fecha_vencimiento), '[]'::jsonb)
        from (
          select q.id, q.folio, q.titulo, q.total, q.fecha_vencimiento, q.estado, c.nombre as cliente
          from public.cotizaciones q join public.clientes c on c.id = q.cliente_id
          where q.estado = 'enviada' and q.fecha_vencimiento between v_hoy and v_hoy + 3
          order by q.fecha_vencimiento
          limit 10
        ) x
      ),
      'tasa_cierre_90d', (
        select case when count(*) filter (where estado in ('aceptada', 'rechazada')) = 0 then null
          else round(100.0 * count(*) filter (where estado = 'aceptada')
                     / count(*) filter (where estado in ('aceptada', 'rechazada')), 1) end
        from public.cotizaciones
        where fecha >= v_hoy - 90
      )
    );
  end if;

  -- Finanzas
  if v_reportes then
    r := r || jsonb_build_object(
      'ventas_mes', (
        select coalesce(sum(total), 0) from public.pedidos
        where estado <> 'cancelado' and created_at >= v_mes
      ),
      'ventas_mes_anterior', (
        select coalesce(sum(total), 0) from public.pedidos
        where estado <> 'cancelado' and created_at >= v_mes_ant and created_at < v_mes
      ),
      'cobrado_mes', (
        select coalesce(sum(case when tipo = 'devolucion' then -importe else importe end), 0)
        from public.pagos where not cancelado and fecha >= v_mes
      ),
      'por_cobrar', (
        select jsonb_build_object('total', coalesce(sum(saldo), 0), 'pedidos', count(*))
        from public.pedidos where estado <> 'cancelado' and saldo > 0
      ),
      'pagos_vencidos', (
        select jsonb_build_object('total', coalesce(sum(saldo), 0), 'pedidos', count(*))
        from public.pedidos
        where estado <> 'cancelado' and saldo > 0 and fecha_limite_pago < v_hoy
      ),
      'serie_mensual', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'mes', to_char(m, 'YYYY-MM'),
          'ventas', (select coalesce(sum(total), 0) from public.pedidos
                     where estado <> 'cancelado' and created_at >= m and created_at < m + interval '1 month'),
          'cobrado', (select coalesce(sum(case when tipo = 'devolucion' then -importe else importe end), 0)
                      from public.pagos where not cancelado and fecha >= m::date and fecha < (m + interval '1 month')::date)
        ) order by m), '[]'::jsonb)
        from generate_series(date_trunc('month', current_date) - interval '5 months',
                             date_trunc('month', current_date), interval '1 month') as m
      )
    );
  end if;

  if v_reportes and v_costos then
    r := r || jsonb_build_object(
      'utilidad_estimada_mes', (
        select jsonb_build_object(
          'venta', coalesce(sum(p.total - p.iva), 0),
          'costo', coalesce(sum(cst.costo), 0),
          'utilidad', coalesce(sum(p.total - p.iva), 0) - coalesce(sum(cst.costo), 0)
        )
        from public.pedidos p
        left join lateral (
          select coalesce(sum(pc.costo_total), 0) as costo
          from public.partidas pa join public.partida_costos pc on pc.partida_id = pa.id
          where pa.pedido_id = p.id
        ) cst on true
        where p.estado <> 'cancelado' and p.created_at >= v_mes
      )
    );
  end if;

  -- Comercial
  if v_comercial then
    r := r || jsonb_build_object(
      'seguimientos', (
        select coalesce(jsonb_agg(to_jsonb(x) order by x.proxima_accion_fecha), '[]'::jsonb)
        from (
          select o.id, o.titulo, o.etapa, o.proxima_accion, o.proxima_accion_fecha, o.valor_estimado,
                 c.nombre as cliente, c.id as cliente_id, coalesce(c.whatsapp, c.telefono) as whatsapp
          from public.oportunidades o join public.clientes c on c.id = o.cliente_id
          where o.etapa not in ('ganado', 'perdido')
            and o.proxima_accion_fecha is not null and o.proxima_accion_fecha <= v_hoy
          order by o.proxima_accion_fecha
          limit 10
        ) x
      ),
      'embudo', (
        select coalesce(jsonb_object_agg(etapa, jsonb_build_object('cantidad', n, 'valor', v)), '{}'::jsonb)
        from (
          select etapa, count(*) as n, coalesce(sum(valor_estimado), 0) as v
          from public.oportunidades
          where etapa not in ('ganado', 'perdido') or cerrada_at >= v_mes
          group by etapa
        ) s
      )
    );
  end if;

  -- Fases 2 y 3: tareas del día y alerta de stock (todo el equipo)
  r := r || jsonb_build_object(
    'tareas_hoy', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.fecha, x.hora nulls last, x.titulo), '[]'::jsonb)
      from (
        select t.id, t.titulo, t.tipo, t.fecha, t.hora, t.prioridad, t.cliente_id, c.nombre as cliente,
               t.pedido_id, (t.fecha < v_hoy) as vencida
        from public.tareas t left join public.clientes c on c.id = t.cliente_id
        where t.responsable_id = v_uid and not t.completada and t.fecha <= v_hoy
        order by t.fecha, t.hora nulls last, t.titulo
        limit 10
      ) x
    ),
    'tareas_pendientes', (
      select count(*) from public.tareas t
      where t.responsable_id = v_uid and not t.completada and t.fecha <= v_hoy
    ),
    'stock_bajo', (
      select jsonb_build_object(
        'cantidad', (select count(*) from public.materiales m where m.bajo_minimo),
        'materiales', coalesce((
          select jsonb_agg(to_jsonb(x) order by x.nombre)
          from (
            select m.id, m.nombre, m.unidad, m.existencia, m.stock_minimo
            from public.materiales m
            where m.bajo_minimo
            order by m.nombre
            limit 5
          ) x
        ), '[]'::jsonb)
      )
    )
  );

  if public.tiene_permiso('registrar_pagos') then
    r := r || jsonb_build_object(
      'caja_hoy', jsonb_build_object(
        'cerrada', exists (select 1 from public.cortes_caja cc where cc.fecha = v_hoy)
      )
    );
  end if;

  return r;
end
$$;

revoke execute on function public.validar_rango_reporte(date, date, integer) from public, anon;
revoke execute on function public.reporte_ventas(date, date, text) from public, anon;
revoke execute on function public.reporte_productos(date, date, integer) from public, anon;
revoke execute on function public.reporte_vendedores(date, date) from public, anon;
revoke execute on function public.reporte_clientes(date, date, integer) from public, anon;
revoke execute on function public.utilidad_pedidos(date, date) from public, anon;
revoke execute on function public.clientes_inactivos(integer) from public, anon;
revoke execute on function public.comisiones_detalle(date, date, uuid) from public, anon;
revoke execute on function public.comisiones(date, date) from public, anon;
revoke execute on function public.cuentas_por_cobrar() from public, anon;
grant execute on function public.validar_rango_reporte(date, date, integer) to authenticated, service_role;
grant execute on function public.reporte_ventas(date, date, text) to authenticated, service_role;
grant execute on function public.reporte_productos(date, date, integer) to authenticated, service_role;
grant execute on function public.reporte_vendedores(date, date) to authenticated, service_role;
grant execute on function public.reporte_clientes(date, date, integer) to authenticated, service_role;
grant execute on function public.utilidad_pedidos(date, date) to authenticated, service_role;
grant execute on function public.clientes_inactivos(integer) to authenticated, service_role;
grant execute on function public.comisiones_detalle(date, date, uuid) to authenticated, service_role;
grant execute on function public.comisiones(date, date) to authenticated, service_role;
grant execute on function public.cuentas_por_cobrar() to authenticated, service_role;

-- >>> 20261014000600_portal_cliente.sql
-- =====================================================================
-- 16 · Portal del cliente (enlace privado, sin cuenta)
--
-- El cliente abre un enlace con un token secreto de 256 bits y puede:
--   * ver su cotización o pedido (sin costos, sin notas internas, sin datos de otros clientes),
--   * aprobar la cotización (una sola vez, si está vigente),
--   * aprobar o pedir cambios a los diseños pendientes de su pedido.
--
-- Seguridad:
--   * El rol "anon" no puede leer ninguna tabla. Solo puede ejecutar portal_obtener,
--     portal_aprobar_cotizacion y portal_responder_diseno, que validan el token.
--   * Token inválido, vencido o revocado dan exactamente el mismo error.
--   * Los textos que escribe el cliente tienen límite de longitud.
--   * Las imágenes y PDF de diseño (bucket privado) se entregan con URL firmadas de corta
--     duración por la función de Edge "portal-cliente", que llama a portal_archivos_firmables
--     con la llave de servicio (esa función no está disponible para el navegador).
--
-- Usuarios del CRM: crear_enlace_portal y revocar_enlace_portal; las cotizaciones requieren
-- "gestionar_cotizaciones" y los pedidos "gestionar_pedidos".
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- Token aleatorio de 32 bytes (256 bits) en base64url, sin relleno: 43 caracteres.
create or replace function public.generar_token_portal()
returns text
language sql
volatile
set search_path = ''
as $$
  select translate(encode(extensions.gen_random_bytes(32), 'base64'), E'+/=\n', '-_')
$$;

create table public.portal_enlaces (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default public.generar_token_portal(),
  tipo text not null check (tipo in ('cotizacion', 'pedido')),
  cotizacion_id uuid references public.cotizaciones (id) on delete cascade,
  pedido_id uuid references public.pedidos (id) on delete cascade,
  expira_at timestamptz not null default (now() + interval '30 days'),
  revocado boolean not null default false,
  revocado_at timestamptz,
  revocado_por uuid references public.perfiles (id) on delete set null,
  vistas integer not null default 0,
  ultimo_acceso_at timestamptz,
  created_by uuid default auth.uid() references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint portal_enlaces_documento check (
    (tipo = 'cotizacion' and cotizacion_id is not null and pedido_id is null)
    or (tipo = 'pedido' and pedido_id is not null and cotizacion_id is null)
  ),
  constraint portal_enlaces_token_largo check (length(token) between 32 and 128)
);

comment on table public.portal_enlaces is
  'Enlaces privados del portal del cliente. Se crean y revocan con crear_enlace_portal y revocar_enlace_portal.';

create index portal_enlaces_cotizacion_idx on public.portal_enlaces (cotizacion_id) where cotizacion_id is not null;
create index portal_enlaces_pedido_idx on public.portal_enlaces (pedido_id) where pedido_id is not null;

create trigger portal_enlaces_bitacora
after insert or update or delete on public.portal_enlaces
for each row execute function public.tg_bitacora();

-- Respuestas del cliente desde el portal (evidencia de aprobación).
create table public.portal_respuestas (
  id bigint generated always as identity primary key,
  enlace_id uuid not null references public.portal_enlaces (id) on delete cascade,
  accion text not null check (accion in ('aprobar_cotizacion', 'aprobar_diseno', 'cambios_diseno')),
  cotizacion_id uuid references public.cotizaciones (id) on delete cascade,
  pedido_id uuid references public.pedidos (id) on delete cascade,
  archivo_id uuid references public.archivos (id) on delete set null,
  nombre text not null,
  comentario text,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

comment on table public.portal_respuestas is 'Aprobaciones y solicitudes de cambio hechas por clientes desde el portal.';

create index portal_respuestas_enlace_idx on public.portal_respuestas (enlace_id, created_at desc);
create index portal_respuestas_cotizacion_idx on public.portal_respuestas (cotizacion_id) where cotizacion_id is not null;
create index portal_respuestas_pedido_idx on public.portal_respuestas (pedido_id) where pedido_id is not null;

alter table public.portal_enlaces enable row level security;
alter table public.portal_respuestas enable row level security;

revoke all on public.portal_enlaces, public.portal_respuestas from public, anon, authenticated;
-- Solo lectura desde la API: se escriben con funciones.
grant select on public.portal_enlaces, public.portal_respuestas to authenticated;
grant all on public.portal_enlaces, public.portal_respuestas to service_role;

create policy "portal_enlaces: ver" on public.portal_enlaces
  for select to authenticated
  using (
    (tipo = 'cotizacion' and (select public.tiene_permiso('gestionar_cotizaciones')))
    or (tipo = 'pedido' and (select public.tiene_permiso('gestionar_pedidos')))
  );

create policy "portal_respuestas: ver" on public.portal_respuestas
  for select to authenticated
  using (
    (select public.tiene_permiso('gestionar_cotizaciones'))
    or (select public.tiene_permiso('gestionar_pedidos'))
    or (select public.tiene_permiso('aprobar_disenos'))
  );

-- ---------------------------------------------------------------------
-- Funciones para usuarios del CRM
-- ---------------------------------------------------------------------
-- Crea (o reutiliza) el enlace de una cotización o pedido.
-- Si ya hay un enlace vigente con más de un día por delante, lo devuelve,
-- salvo que p_nuevo = true. Respuesta: {id, token, tipo, expira_at, nuevo}
create or replace function public.crear_enlace_portal(
  p_tipo text,
  p_id uuid,
  p_dias integer default 30,
  p_nuevo boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.portal_enlaces;
begin
  if p_tipo = 'cotizacion' then
    if not public.tiene_permiso('gestionar_cotizaciones') then
      raise exception 'No tienes permiso para compartir cotizaciones' using errcode = '42501';
    end if;
    if not exists (select 1 from public.cotizaciones where id = p_id) then
      raise exception 'Cotización no encontrada';
    end if;
  elsif p_tipo = 'pedido' then
    if not public.tiene_permiso('gestionar_pedidos') then
      raise exception 'No tienes permiso para compartir pedidos' using errcode = '42501';
    end if;
    if not exists (select 1 from public.pedidos where id = p_id) then
      raise exception 'Pedido no encontrado';
    end if;
  else
    raise exception 'Tipo de enlace inválido: usa cotizacion o pedido';
  end if;

  if coalesce(p_dias, 30) not between 1 and 180 then
    raise exception 'La vigencia del enlace debe ser de 1 a 180 días';
  end if;

  if not coalesce(p_nuevo, false) then
    select * into e
    from public.portal_enlaces pe
    where pe.tipo = p_tipo
      and not pe.revocado
      and pe.expira_at > now() + interval '1 day'
      and (case p_tipo when 'cotizacion' then pe.cotizacion_id else pe.pedido_id end) = p_id
    order by pe.expira_at desc
    limit 1;
    if found then
      return jsonb_build_object('id', e.id, 'token', e.token, 'tipo', e.tipo, 'expira_at', e.expira_at, 'nuevo', false);
    end if;
  end if;

  insert into public.portal_enlaces (tipo, cotizacion_id, pedido_id, expira_at, created_by)
  values (
    p_tipo,
    case when p_tipo = 'cotizacion' then p_id end,
    case when p_tipo = 'pedido' then p_id end,
    now() + make_interval(days => coalesce(p_dias, 30)),
    auth.uid()
  )
  returning * into e;

  return jsonb_build_object('id', e.id, 'token', e.token, 'tipo', e.tipo, 'expira_at', e.expira_at, 'nuevo', true);
end
$$;

create or replace function public.revocar_enlace_portal(p_enlace uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.portal_enlaces;
begin
  select * into e from public.portal_enlaces where id = p_enlace for update;
  if not found then
    raise exception 'Enlace no encontrado';
  end if;
  if not ((e.tipo = 'cotizacion' and public.tiene_permiso('gestionar_cotizaciones'))
          or (e.tipo = 'pedido' and public.tiene_permiso('gestionar_pedidos'))) then
    raise exception 'No tienes permiso para revocar este enlace' using errcode = '42501';
  end if;
  if e.revocado then
    return;
  end if;
  update public.portal_enlaces
  set revocado = true, revocado_at = now(), revocado_por = auth.uid()
  where id = p_enlace;
end
$$;

-- ---------------------------------------------------------------------
-- Utilidades internas del portal (no se exponen al navegador)
-- ---------------------------------------------------------------------
-- Devuelve el enlace si el token es válido, vigente y no revocado. Cualquier otro
-- caso da el mismo error, sin revelar si el token existe.
create or replace function public.portal_enlace_vigente(p_token text)
returns public.portal_enlaces
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.portal_enlaces;
begin
  if p_token is null or length(p_token) not between 32 and 128 or p_token !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Este enlace no es válido o ya venció. Pide uno nuevo a tu asesor.' using errcode = 'PT404';
  end if;
  select * into e
  from public.portal_enlaces pe
  where pe.token = p_token and not pe.revocado and pe.expira_at > now();
  if not found then
    raise exception 'Este enlace no es válido o ya venció. Pide uno nuevo a tu asesor.' using errcode = 'PT404';
  end if;
  return e;
end
$$;

-- Pedido que se puede consultar con el enlace: el del enlace o el que salió de la cotización.
create or replace function public.portal_pedido_de_enlace(e public.portal_enlaces)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case e.tipo
    when 'pedido' then e.pedido_id
    else (select q.pedido_id from public.cotizaciones q where q.id = e.cotizacion_id)
  end
$$;

-- Conceptos visibles para el cliente (sin costos ni notas de producción).
create or replace function public.portal_partidas(p_cotizacion uuid, p_pedido uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'orden', pa.orden,
    'tipo', pa.tipo,
    'concepto', pa.concepto,
    'descripcion', pa.descripcion,
    'metodo_calculo', pa.metodo_calculo,
    'unidad', pa.unidad,
    'ancho', pa.ancho,
    'alto', pa.alto,
    'largo', pa.largo,
    'cantidad', pa.cantidad,
    'precio_unitario', pa.precio_unitario,
    'descuento_pct', pa.descuento_pct,
    'importe', pa.importe
  ) order by pa.orden, pa.created_at), '[]'::jsonb)
  from public.partidas pa
  where (p_cotizacion is not null and pa.cotizacion_id = p_cotizacion)
     or (p_pedido is not null and pa.pedido_id = p_pedido)
$$;

-- Nombre y comentario del cliente: espacios normalizados y longitud limitada.
create or replace function public.portal_texto_cliente(p_nombre text, p_comentario text)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_nombre text := trim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  v_comentario text := nullif(trim(coalesce(p_comentario, '')), '');
begin
  if length(v_nombre) < 2 or length(v_nombre) > 120 then
    raise exception 'Escribe tu nombre (de 2 a 120 caracteres)';
  end if;
  if length(coalesce(v_comentario, '')) > 1000 then
    raise exception 'El comentario puede tener hasta 1000 caracteres';
  end if;
  return array[v_nombre, v_comentario];
end
$$;

-- IP y navegador de quien responde (evidencia), si la API los proporciona.
create or replace function public.portal_origen_solicitud()
returns text[]
language plpgsql
stable
set search_path = ''
as $$
declare
  h jsonb;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    h := null;
  end;
  return array[
    left(coalesce(h ->> 'cf-connecting-ip', h ->> 'x-real-ip', trim(split_part(h ->> 'x-forwarded-for', ',', 1))), 100),
    left(h ->> 'user-agent', 300)
  ];
end
$$;

-- ---------------------------------------------------------------------
-- Funciones públicas (rol anon) del portal
-- ---------------------------------------------------------------------
-- Datos saneados del documento. Respuesta:
-- { tipo, expira_at,
--   empresa: {nombre, eslogan, ciudad, direccion, telefono, whatsapp, email, sitio_web, instagram,
--             facebook, tiktok, logo_url, color_primario, color_secundario, datos_bancarios,
--             rfc?, razon_social?, regimen_fiscal? (solo si mostrar_datos_fiscales)},
--   cotizacion?: {folio, titulo, fecha, fecha_vencimiento, vigente, estado, cliente, contacto, vendedor,
--                 tiempo_entrega, anticipo_pct, anticipo, aplica_iva, iva_pct, subtotal, descuento,
--                 recargo_pct, recargo_concepto, recargo, iva, total, condiciones, notas, enviada_at,
--                 aceptada_at, puede_aprobar, aprobacion: {nombre, fecha}?, partidas: [...]},
--   pedido?: {folio, titulo, estado, estado_pago, cliente, fecha_entrega, requiere_instalacion,
--             created_at, entregado_at, anticipo_pct, subtotal, descuento, recargo, iva, total, pagado,
--             saldo, condiciones, etapas: [...], linea_tiempo: [{estado, fecha}], partidas: [...],
--             disenos: [{id, nombre, version, estado_aprobacion, mime, tiene_archivo, enlace_externo,
--                        created_at, aprobado_por_nombre, aprobacion_at, puede_responder}]} }
create or replace function public.portal_obtener(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'America/Mexico_City'
as $$
declare
  e public.portal_enlaces;
  conf public.configuracion;
  q public.cotizaciones;
  p public.pedidos;
  v_pedido uuid;
  r jsonb;
  v_etapas text[] := array['nuevo', 'en_diseno', 'esperando_aprobacion', 'aprobado', 'en_produccion',
                           'acabados', 'listo_entrega', 'en_instalacion', 'entregado'];
begin
  e := public.portal_enlace_vigente(p_token);

  update public.portal_enlaces
  set vistas = vistas + 1, ultimo_acceso_at = now()
  where id = e.id;

  select * into conf from public.configuracion where id = 1;

  r := jsonb_build_object(
    'tipo', e.tipo,
    'expira_at', e.expira_at,
    'empresa', jsonb_strip_nulls(jsonb_build_object(
      'nombre', conf.nombre_comercial,
      'eslogan', conf.eslogan,
      'ciudad', conf.ciudad,
      'direccion', conf.direccion,
      'telefono', conf.telefono,
      'whatsapp', conf.whatsapp,
      'email', conf.email,
      'sitio_web', conf.sitio_web,
      'instagram', conf.instagram,
      'facebook', conf.facebook,
      'tiktok', conf.tiktok,
      'logo_url', conf.logo_url,
      'color_primario', conf.color_primario,
      'color_secundario', conf.color_secundario,
      'datos_bancarios', conf.datos_bancarios,
      'rfc', case when conf.mostrar_datos_fiscales then conf.rfc end,
      'razon_social', case when conf.mostrar_datos_fiscales then conf.razon_social end,
      'regimen_fiscal', case when conf.mostrar_datos_fiscales then conf.regimen_fiscal end
    ))
  );

  if e.tipo = 'cotizacion' then
    select * into q from public.cotizaciones where id = e.cotizacion_id;
    r := r || jsonb_build_object('cotizacion', jsonb_build_object(
      'folio', q.folio,
      'titulo', q.titulo,
      'fecha', q.fecha,
      'fecha_vencimiento', q.fecha_vencimiento,
      'vigente', q.fecha_vencimiento >= current_date,
      'estado', q.estado,
      'cliente', (select c.nombre from public.clientes c where c.id = q.cliente_id),
      'contacto', (select ct.nombre from public.contactos ct where ct.id = q.contacto_id),
      'vendedor', (select u.nombre from public.perfiles u where u.id = q.vendedor_id),
      'tiempo_entrega', q.tiempo_entrega,
      'anticipo_pct', q.anticipo_pct,
      'anticipo', round(q.total * q.anticipo_pct / 100, 2),
      'aplica_iva', q.aplica_iva,
      'iva_pct', q.iva_pct,
      'subtotal', q.subtotal,
      'descuento', q.descuento,
      'recargo_pct', q.recargo_pct,
      'recargo_concepto', q.recargo_concepto,
      'recargo', q.recargo,
      'iva', q.iva,
      'total', q.total,
      'condiciones', q.condiciones,
      'notas', q.notas,
      'enviada_at', q.enviada_at,
      'aceptada_at', q.aceptada_at,
      'puede_aprobar', q.estado in ('borrador', 'enviada') and q.pedido_id is null
                       and q.fecha_vencimiento >= current_date,
      'aprobacion', (
        select jsonb_build_object('nombre', pr.nombre, 'fecha', pr.created_at)
        from public.portal_respuestas pr
        where pr.cotizacion_id = q.id and pr.accion = 'aprobar_cotizacion'
        order by pr.created_at desc
        limit 1
      ),
      'partidas', public.portal_partidas(q.id, null)
    ));
  end if;

  v_pedido := public.portal_pedido_de_enlace(e);

  if v_pedido is not null then
    select * into p from public.pedidos where id = v_pedido;
    r := r || jsonb_build_object('pedido', jsonb_build_object(
      'folio', p.folio,
      'titulo', p.titulo,
      'estado', p.estado,
      'estado_pago', p.estado_pago,
      'cliente', (select c.nombre from public.clientes c where c.id = p.cliente_id),
      'fecha_entrega', p.fecha_entrega,
      'requiere_instalacion', p.requiere_instalacion,
      'created_at', p.created_at,
      'entregado_at', p.entregado_at,
      'anticipo_pct', p.anticipo_pct,
      'subtotal', p.subtotal,
      'descuento', p.descuento,
      'recargo', p.recargo,
      'iva', p.iva,
      'total', p.total,
      'pagado', p.pagado,
      'saldo', p.saldo,
      'condiciones', p.condiciones,
      'etapas', (
        select coalesce(jsonb_agg(et order by ord), '[]'::jsonb)
        from unnest(v_etapas) with ordinality as u(et, ord)
        where not (et::public.estado_pedido = any (p.etapas_omitidas))
      ),
      'linea_tiempo', (
        select coalesce(jsonb_agg(jsonb_build_object('estado', ev.estado_a, 'fecha', ev.created_at)
                                  order by ev.created_at, ev.id), '[]'::jsonb)
        from public.pedido_eventos ev
        where ev.pedido_id = p.id and ev.tipo in ('creado', 'estado') and ev.estado_a is not null
      ),
      'partidas', public.portal_partidas(null, p.id),
      'disenos', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', a.id,
          'nombre', a.nombre,
          'version', a.version,
          'estado_aprobacion', a.estado_aprobacion,
          'mime', a.mime,
          'tiene_archivo', a.path is not null,
          'enlace_externo', case when a.enlace_externo ~* '^https?://' then a.enlace_externo end,
          'created_at', a.created_at,
          'aprobado_por_nombre', a.aprobado_por_nombre,
          'aprobacion_at', a.aprobacion_at,
          'puede_responder', a.estado_aprobacion = 'pendiente' and p.estado not in ('cancelado', 'finalizado')
        ) order by a.version desc nulls last, a.created_at desc), '[]'::jsonb)
        from public.archivos a
        where a.pedido_id = p.id and a.categoria = 'diseno'
      )
    ));
  end if;

  return r;
end
$$;

-- El cliente aprueba la cotización (una sola vez, si está vigente y sin convertir).
create or replace function public.portal_aprobar_cotizacion(
  p_token text,
  p_nombre text,
  p_comentario text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'America/Mexico_City'
as $$
declare
  e public.portal_enlaces;
  q public.cotizaciones;
  v_txt text[];
  v_origen text[];
begin
  e := public.portal_enlace_vigente(p_token);
  if e.tipo <> 'cotizacion' then
    raise exception 'Este enlace no es de una cotización';
  end if;
  v_txt := public.portal_texto_cliente(p_nombre, p_comentario);

  select * into q from public.cotizaciones where id = e.cotizacion_id for update;
  if q.estado = 'aceptada' or q.pedido_id is not null then
    raise exception 'Esta cotización ya fue aprobada. ¡Gracias!';
  end if;
  if q.estado not in ('borrador', 'enviada') then
    raise exception 'Esta cotización ya no se puede aprobar. Comunícate con tu asesor.';
  end if;
  if q.fecha_vencimiento < current_date then
    raise exception 'Esta cotización venció el %. Pide a tu asesor una cotización actualizada.',
      to_char(q.fecha_vencimiento, 'DD/MM/YYYY');
  end if;

  update public.cotizaciones set estado = 'aceptada' where id = q.id;

  v_origen := public.portal_origen_solicitud();
  insert into public.portal_respuestas (enlace_id, accion, cotizacion_id, nombre, comentario, ip, user_agent)
  values (e.id, 'aprobar_cotizacion', q.id, v_txt[1], v_txt[2], v_origen[1], v_origen[2]);

  insert into public.actividades (cliente_id, oportunidad_id, tipo, descripcion, usuario_id)
  values (
    q.cliente_id, q.oportunidad_id, 'nota',
    'Cotización ' || q.folio || ' aprobada desde el portal por ' || v_txt[1]
      || coalesce('. Comentario: ' || v_txt[2], ''),
    null
  );

  return jsonb_build_object('ok', true, 'folio', q.folio, 'estado', 'aceptada');
end
$$;

-- El cliente aprueba un diseño o pide cambios (usa la lógica de aprobación de archivos:
-- el pedido avanza a "aprobado" o regresa a "en diseño").
create or replace function public.portal_responder_diseno(
  p_token text,
  p_archivo_id uuid,
  p_aprobado boolean,
  p_nombre text,
  p_comentario text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'America/Mexico_City'
as $$
declare
  e public.portal_enlaces;
  a public.archivos;
  v_pedido uuid;
  v_estado_pedido public.estado_pedido;
  v_txt text[];
  v_origen text[];
  v_nuevo public.estado_archivo;
begin
  e := public.portal_enlace_vigente(p_token);
  v_txt := public.portal_texto_cliente(p_nombre, p_comentario);
  if p_aprobado is null then
    raise exception 'Indica si apruebas el diseño o necesitas cambios';
  end if;
  if not p_aprobado and v_txt[2] is null then
    raise exception 'Cuéntanos qué cambios necesitas';
  end if;

  v_pedido := public.portal_pedido_de_enlace(e);
  if v_pedido is null then
    raise exception 'Este enlace no tiene diseños para revisar';
  end if;

  select * into a
  from public.archivos
  where id = p_archivo_id and pedido_id = v_pedido and categoria = 'diseno'
  for update;
  if not found then
    raise exception 'Diseño no encontrado';
  end if;
  if a.estado_aprobacion <> 'pendiente' then
    raise exception 'Este diseño ya tiene una respuesta registrada';
  end if;

  select estado into v_estado_pedido from public.pedidos where id = v_pedido;
  if v_estado_pedido in ('cancelado', 'finalizado') then
    raise exception 'Este pedido ya no admite cambios. Comunícate con tu asesor.';
  end if;

  v_nuevo := case when p_aprobado then 'aprobado' else 'cambios' end;

  update public.archivos
  set estado_aprobacion = v_nuevo,
      aprobado_por_nombre = v_txt[1],
      aprobacion_notas = 'Respuesta desde el portal del cliente' || coalesce(': ' || v_txt[2], '')
  where id = a.id;

  v_origen := public.portal_origen_solicitud();
  insert into public.portal_respuestas (enlace_id, accion, pedido_id, archivo_id, nombre, comentario, ip, user_agent)
  values (e.id, case when p_aprobado then 'aprobar_diseno' else 'cambios_diseno' end, v_pedido, a.id,
          v_txt[1], v_txt[2], v_origen[1], v_origen[2]);

  return jsonb_build_object(
    'ok', true,
    'archivo_id', a.id,
    'version', a.version,
    'estado_aprobacion', v_nuevo,
    'estado_pedido', (select estado from public.pedidos where id = v_pedido)
  );
end
$$;

-- Diseños con archivo que la función de Edge "portal-cliente" puede firmar.
-- Solo para la llave de servicio.
create or replace function public.portal_archivos_firmables(p_token text, p_archivo_id uuid default null)
returns table (id uuid, nombre text, path text, mime text, version integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  e public.portal_enlaces;
  v_pedido uuid;
begin
  e := public.portal_enlace_vigente(p_token);
  v_pedido := public.portal_pedido_de_enlace(e);
  if v_pedido is null then
    return;
  end if;
  return query
  select a.id, a.nombre, a.path, a.mime, a.version
  from public.archivos a
  where a.pedido_id = v_pedido
    and a.categoria = 'diseno'
    and a.path is not null
    and (p_archivo_id is null or a.id = p_archivo_id)
  order by a.version desc nulls last, a.created_at desc
  limit 50;
end
$$;

-- ---------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------
revoke execute on function public.generar_token_portal() from public, anon, authenticated;
revoke execute on function public.crear_enlace_portal(text, uuid, integer, boolean) from public, anon;
revoke execute on function public.revocar_enlace_portal(uuid) from public, anon;
revoke execute on function public.portal_enlace_vigente(text) from public, anon, authenticated;
revoke execute on function public.portal_pedido_de_enlace(public.portal_enlaces) from public, anon, authenticated;
revoke execute on function public.portal_partidas(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.portal_texto_cliente(text, text) from public, anon, authenticated;
revoke execute on function public.portal_origen_solicitud() from public, anon, authenticated;
revoke execute on function public.portal_archivos_firmables(text, uuid) from public, anon, authenticated;
revoke execute on function public.portal_obtener(text) from public;
revoke execute on function public.portal_aprobar_cotizacion(text, text, text) from public;
revoke execute on function public.portal_responder_diseno(text, uuid, boolean, text, text) from public;

grant execute on function public.generar_token_portal() to service_role;
grant execute on function public.crear_enlace_portal(text, uuid, integer, boolean) to authenticated, service_role;
grant execute on function public.revocar_enlace_portal(uuid) to authenticated, service_role;
grant execute on function public.portal_archivos_firmables(text, uuid) to service_role;
grant execute on function public.portal_obtener(text) to anon, authenticated, service_role;
grant execute on function public.portal_aprobar_cotizacion(text, text, text) to anon, authenticated, service_role;
grant execute on function public.portal_responder_diseno(text, uuid, boolean, text, text) to anon, authenticated, service_role;

-- >>> 20261014000700_bitacora_privilegios.sql
-- =====================================================================
-- 17 · Bitácora para las tablas nuevas y repaso final de privilegios
--   * La bitácora reconoce las tablas de las fases 2 y 3 (etiquetas legibles),
--     ignora campos calculados (existencia, vistas del portal...) y no guarda
--     los tokens del portal.
--   * Los cambios hechos desde el portal se atribuyen a "Cliente (portal)".
--   * Ninguna función queda disponible para "anon" salvo las tres del portal.
-- =====================================================================

create or replace function public.tg_bitacora()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_reg jsonb;
  v_cambios jsonb := '{}'::jsonb;
  v_accion text;
  v_etiqueta text;
  v_nombre text;
  v_id text;
  k text;
  -- Campos calculados o técnicos que no aportan al historial
  v_ignorar text[] := array[
    'updated_at', 'busqueda', 'subtotal', 'descuento', 'recargo', 'iva', 'total', 'pagado', 'saldo',
    'estado_pago', 'ultima_compra_at', 'fecha_vencimiento', 'importe', 'ultimo_acceso', 'enviada_at',
    'aceptada_at', 'entregado_at', 'finalizado_at', 'cancelado_at', 'cerrada_at', 'estado_anterior',
    'aprobacion_at', 'aprobacion_registrada_por', 'cancelado_por',
    -- Fases 2 y 3
    'existencia', 'bajo_minimo', 'existencia_resultante', 'vistas', 'ultimo_acceso_at',
    'completada_at', 'completada_por', 'revocado_at', 'revocado_por', 'token'
  ];
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_reg := v_new;
    v_accion := 'crear';
  elsif tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_reg := v_old;
    v_accion := 'eliminar';
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_reg := v_new;
    v_accion := 'modificar';
    for k in select jsonb_object_keys(v_new) loop
      continue when k = any (v_ignorar);
      if (v_new -> k) is distinct from (v_old -> k) then
        v_cambios := v_cambios || jsonb_build_object(k, jsonb_build_array(v_old -> k, v_new -> k));
      end if;
    end loop;

    if v_cambios = '{}'::jsonb then
      return null;
    end if;

    if v_cambios ? 'estado' then
      v_accion := case when v_new ->> 'estado' in ('cancelado', 'cancelada') then 'cancelar' else 'cambio_estado' end;
    elsif v_cambios ? 'etapa' then
      v_accion := 'cambio_estado';
    end if;
    if v_cambios ? 'cancelado' and (v_new ->> 'cancelado')::boolean then
      v_accion := 'cancelar';
    end if;
    if v_cambios ? 'estado_aprobacion' then
      v_accion := case when v_new ->> 'estado_aprobacion' = 'aprobado' then 'aprobar' else 'cambio_estado' end;
    end if;
    if v_cambios ? 'completada' then
      v_accion := 'cambio_estado';
    end if;
    if v_cambios ? 'revocado' and (v_new ->> 'revocado')::boolean then
      v_accion := 'cancelar';
    end if;
  end if;

  -- Los tokens del portal no se guardan en la bitácora.
  v_reg := v_reg - 'token';

  v_id := coalesce(v_reg ->> 'id', v_reg ->> 'partida_id', v_reg ->> 'producto_id', v_reg ->> 'material_id', v_reg ->> 'tipo');

  v_etiqueta := case tg_table_name
    when 'pagos' then
      'Pago de $' || to_char((v_reg ->> 'importe')::numeric, 'FM999,999,990.00') || ' · '
      || coalesce((select p.folio from public.pedidos p where p.id = (v_reg ->> 'pedido_id')::uuid), 'pedido')
    when 'partidas' then
      coalesce(
        (select c.folio from public.cotizaciones c where c.id = (v_reg ->> 'cotizacion_id')::uuid),
        (select p.folio from public.pedidos p where p.id = (v_reg ->> 'pedido_id')::uuid),
        ''
      ) || ' · ' || coalesce(v_reg ->> 'concepto', '')
    when 'partida_costos' then
      'Costos de partida'
    when 'producto_costos' then
      'Costos de ' || coalesce((select pr.nombre from public.productos pr where pr.id = (v_reg ->> 'producto_id')::uuid), 'producto')
    when 'configuracion' then
      'Configuración del negocio'
    when 'folios' then
      'Folios de ' || coalesce(v_reg ->> 'tipo', '')
    when 'producto_precios' then
      'Precio ' || coalesce(v_reg ->> 'lista', '') || ' de '
      || coalesce((select pr.nombre from public.productos pr where pr.id = (v_reg ->> 'producto_id')::uuid), 'producto')
    when 'material_costos' then
      'Costo de ' || coalesce((select m.nombre from public.materiales m where m.id = (v_reg ->> 'material_id')::uuid), 'material')
    when 'movimientos_inventario' then
      initcap(coalesce(v_reg ->> 'tipo', 'movimiento')) || ' de '
      || public.cantidad_texto((v_reg ->> 'cantidad')::numeric) || ' · '
      || coalesce((select m.nombre from public.materiales m where m.id = (v_reg ->> 'material_id')::uuid), 'material')
    when 'gastos' then
      'Gasto de $' || to_char((v_reg ->> 'monto')::numeric, 'FM999,999,990.00') || ' · ' || coalesce(v_reg ->> 'concepto', '')
    when 'cortes_caja' then
      'Corte de caja del ' || to_char((v_reg ->> 'fecha')::date, 'DD/MM/YYYY')
    when 'portal_enlaces' then
      'Enlace del portal · ' || coalesce(
        (select c.folio from public.cotizaciones c where c.id = (v_reg ->> 'cotizacion_id')::uuid),
        (select p.folio from public.pedidos p where p.id = (v_reg ->> 'pedido_id')::uuid),
        v_reg ->> 'tipo'
      )
    else
      coalesce(v_reg ->> 'folio', v_reg ->> 'nombre', v_reg ->> 'titulo', v_reg ->> 'clave', v_reg ->> 'email', v_id)
  end;

  select p.nombre into v_nombre from public.perfiles p where p.id = auth.uid();

  insert into public.bitacora (tabla, registro_id, accion, etiqueta, cambios, datos, usuario_id, usuario_nombre)
  values (
    tg_table_name,
    v_id,
    v_accion,
    v_etiqueta,
    case when tg_op = 'UPDATE' then v_cambios end,
    case when tg_op <> 'UPDATE' then v_reg end,
    auth.uid(),
    coalesce(
      v_nombre,
      case
        when auth.uid() is null and coalesce(auth.role(), '') = 'anon' then 'Cliente (portal)'
        when auth.uid() is null then 'Sistema'
      end
    )
  );

  return null;
end
$$;

-- ---------------------------------------------------------------------
-- Repaso de privilegios
-- ---------------------------------------------------------------------
-- Funciones de reglas automáticas: nunca por la API.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'tg\_%'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.firma);
  end loop;
end
$$;

-- "anon" (sin sesión) solo puede usar el portal del cliente.
grant usage on schema public to anon;
revoke execute on all functions in schema public from public, anon;
grant execute on function public.portal_obtener(text) to anon;
grant execute on function public.portal_aprobar_cotizacion(text, text, text) to anon;
grant execute on function public.portal_responder_diseno(text, uuid, boolean, text, text) to anon;

-- Ninguna tabla para "anon"; sin TRUNCATE, REFERENCES ni TRIGGER para los roles de la API
-- (TRUNCATE ignora las reglas de acceso por fila).
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- La llave de servicio conserva acceso completo (solo vive en funciones del servidor).
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Recarga el esquema de la API.
notify pgrst, 'reload schema';

-- >>> 20261014000800_plantillas_portal.sql
-- =====================================================================
-- 18 · Plantillas de WhatsApp para compartir el portal del cliente
-- {enlace} es el enlace privado del portal. Si ya existen (o se editaron), no se tocan.
-- =====================================================================

insert into public.plantillas_mensaje (clave, nombre, contexto, orden, texto) values
  ('portal_cotizacion', 'Cotización para aprobar en línea', 'cotizacion', 25,
   E'Hola {cliente} 👋, aquí puedes revisar y aprobar tu cotización *{folio}* por *{total}*:\n\n{enlace}\n\nVigencia: {vigencia}. Cualquier duda, con gusto te ayudamos.'),
  ('portal_pedido', 'Seguimiento del pedido en línea', 'pedido', 65,
   E'Hola {cliente}, en este enlace puedes ver el avance de tu pedido *{folio}* y aprobar los diseños cuando estén listos:\n\n{enlace}'),
  ('portal_diseno', 'Diseño para aprobar en línea', 'pedido', 66,
   E'Hola {cliente}, ya está lista la propuesta de diseño de tu pedido *{folio}*. Revísala y apruébala o pide cambios aquí:\n\n{enlace}\n\nCualquier cambio posterior a la aprobación puede generar costos adicionales.')
on conflict (clave) do nothing;

-- >>> 20261014000900_seguridad_fases_2_y_3.sql
-- =====================================================================
-- 19 · Revisión de seguridad de las fases 2 y 3
--
-- Correcciones (cada una tiene su prueba en tests/db/seguridad_fases2y3.test.ts):
--   1. Comisiones: solo administración cambia el vendedor de una cotización o pedido ya
--      asignado (antes Ventas podía ponerse como vendedor de la venta de otra persona y
--      cobrar su comisión).
--   2. Portal: crear o ver enlaces exige también "ver_precios" (el portal muestra precios;
--      con solo gestionar pedidos/cotizaciones se podían ver totales a través del enlace).
--   3. Corte de caja: un pago o gasto en efectivo que se guarda al mismo tiempo que se cierra
--      la caja ya no queda fuera del corte (candado por día entre el cierre y el efectivo).
--   4. Portal: el nombre y el comentario del cliente se rechazan por tamaño ANTES de
--      procesarlos (un texto de 10 MB ocupaba la base 3 s por llamada).
--   5. Portal: la función de Edge solo firma archivos guardados en pedidos/<id del pedido>/.
--   6. Diseños: la evidencia de una aprobación (quién aprobó, notas, quién la registró y
--      cuándo) solo la cambia quien puede registrar aprobaciones.
--   7. Proveedores: el autor lo pone la base de datos.
--   8. Privilegios por defecto: las funciones, tablas y secuencias que creen migraciones
--      futuras nacen cerradas para "anon" (antes cualquier función nueva era ejecutable
--      sin sesión, por el privilegio PUBLIC).
--
-- No cambia la forma de ninguna tabla ni columna: solo reglas, permisos y funciones.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Vendedor de cotizaciones y pedidos (base de las comisiones)
--    Administración lo cambia libremente. Los demás solo pueden tomar una venta que no
--    tenía vendedor, y únicamente para sí mismos.
-- ---------------------------------------------------------------------
create or replace function public.tg_vendedor_proteger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.vendedor_id is distinct from old.vendedor_id
     and auth.uid() is not null
     and not public.es_admin()
     and not (old.vendedor_id is null and new.vendedor_id = auth.uid()) then
    raise exception 'Solo administración puede cambiar el vendedor de una venta ya asignada (de él dependen las comisiones). Pide el cambio a administración.'
      using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger cotizaciones_vendedor
before update of vendedor_id on public.cotizaciones
for each row execute function public.tg_vendedor_proteger();

create trigger pedidos_vendedor
before update of vendedor_id on public.pedidos
for each row execute function public.tg_vendedor_proteger();

-- ---------------------------------------------------------------------
-- 2. Enlaces del portal: también requieren "ver_precios"
-- ---------------------------------------------------------------------
create or replace function public.crear_enlace_portal(
  p_tipo text,
  p_id uuid,
  p_dias integer default 30,
  p_nuevo boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.portal_enlaces;
begin
  -- El portal muestra precios y totales: compartirlo exige poder verlos.
  if not public.tiene_permiso('ver_precios') then
    raise exception 'No tienes permiso para compartir enlaces del portal: muestran precios y totales' using errcode = '42501';
  end if;

  if p_tipo = 'cotizacion' then
    if not public.tiene_permiso('gestionar_cotizaciones') then
      raise exception 'No tienes permiso para compartir cotizaciones' using errcode = '42501';
    end if;
    if not exists (select 1 from public.cotizaciones where id = p_id) then
      raise exception 'Cotización no encontrada';
    end if;
  elsif p_tipo = 'pedido' then
    if not public.tiene_permiso('gestionar_pedidos') then
      raise exception 'No tienes permiso para compartir pedidos' using errcode = '42501';
    end if;
    if not exists (select 1 from public.pedidos where id = p_id) then
      raise exception 'Pedido no encontrado';
    end if;
  else
    raise exception 'Tipo de enlace inválido: usa cotizacion o pedido';
  end if;

  if coalesce(p_dias, 30) not between 1 and 180 then
    raise exception 'La vigencia del enlace debe ser de 1 a 180 días';
  end if;

  if not coalesce(p_nuevo, false) then
    select * into e
    from public.portal_enlaces pe
    where pe.tipo = p_tipo
      and not pe.revocado
      and pe.expira_at > now() + interval '1 day'
      and (case p_tipo when 'cotizacion' then pe.cotizacion_id else pe.pedido_id end) = p_id
    order by pe.expira_at desc
    limit 1;
    if found then
      return jsonb_build_object('id', e.id, 'token', e.token, 'tipo', e.tipo, 'expira_at', e.expira_at, 'nuevo', false);
    end if;
  end if;

  insert into public.portal_enlaces (tipo, cotizacion_id, pedido_id, expira_at, created_by)
  values (
    p_tipo,
    case when p_tipo = 'cotizacion' then p_id end,
    case when p_tipo = 'pedido' then p_id end,
    now() + make_interval(days => coalesce(p_dias, 30)),
    auth.uid()
  )
  returning * into e;

  return jsonb_build_object('id', e.id, 'token', e.token, 'tipo', e.tipo, 'expira_at', e.expira_at, 'nuevo', true);
end
$$;

-- Los tokens de los enlaces (con los que se abre el portal) tampoco se leen sin "ver_precios".
alter policy "portal_enlaces: ver" on public.portal_enlaces
  using (
    (select public.tiene_permiso('ver_precios'))
    and (
      (tipo = 'cotizacion' and (select public.tiene_permiso('gestionar_cotizaciones')))
      or (tipo = 'pedido' and (select public.tiene_permiso('gestionar_pedidos')))
    )
  );

-- ---------------------------------------------------------------------
-- 3. Corte de caja sin carreras
--    cerrar_caja ya toma un candado exclusivo por día (pg_advisory_xact_lock). Ahora cada
--    pago o gasto en efectivo toma el mismo candado en modo compartido mientras se guarda:
--    el corte espera a que terminen los que ya pasaron la revisión (y los incluye), y los
--    que llegan después esperan al cierre y ya ven la caja cerrada.
-- ---------------------------------------------------------------------
create or replace function public.tg_caja_cerrada()
returns trigger
language plpgsql
security definer
set search_path = ''
set datestyle = 'ISO, MDY'
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb;
  v_campo_metodo text := case tg_table_name when 'gastos' then 'metodo_pago' else 'metodo' end;
  v_campos text[] := case tg_table_name
    when 'gastos' then array['fecha', 'monto', 'metodo_pago', 'cancelado']
    else array['fecha', 'importe', 'tipo', 'metodo', 'cancelado'] end;
  k text;
  v_cambio boolean := false;
  v_dia_antes date;
  v_dia_nuevo date;
  v_fecha date;
begin
  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    foreach k in array v_campos loop
      if (v_new -> k) is distinct from (v_old -> k) then
        v_cambio := true;
      end if;
    end loop;
    if not v_cambio then
      return new;
    end if;
    if v_old ->> v_campo_metodo = 'efectivo' then
      v_dia_antes := (v_old ->> 'fecha')::date;
    end if;
  end if;
  if v_new ->> v_campo_metodo = 'efectivo' then
    v_dia_nuevo := (v_new ->> 'fecha')::date;
  end if;

  -- Candado compartido del día (o de los dos días, en orden) hasta que termine la transacción.
  if v_dia_antes is not null or v_dia_nuevo is not null then
    perform pg_advisory_xact_lock_shared(hashtext('cortes_caja:' || least(v_dia_antes, v_dia_nuevo)::text));
    if v_dia_antes <> v_dia_nuevo then
      perform pg_advisory_xact_lock_shared(hashtext('cortes_caja:' || greatest(v_dia_antes, v_dia_nuevo)::text));
    end if;
  end if;

  if auth.uid() is null or public.es_admin() then
    return new;
  end if;

  if v_dia_antes is not null and exists (select 1 from public.cortes_caja c where c.fecha = v_dia_antes) then
    v_fecha := v_dia_antes;
  elsif v_dia_nuevo is not null and exists (select 1 from public.cortes_caja c where c.fecha = v_dia_nuevo) then
    v_fecha := v_dia_nuevo;
  end if;

  if v_fecha is not null then
    raise exception 'La caja del % ya está cerrada. Pide a administración que la reabra para registrar o cambiar movimientos en efectivo de ese día.',
      to_char(v_fecha, 'DD/MM/YYYY')
      using errcode = '42501';
  end if;
  return new;
end
$$;

-- La llave del candado usa fecha::text: el mismo formato en el cierre y en el efectivo.
alter function public.cerrar_caja(date, numeric, numeric, text) set datestyle = 'ISO, MDY';

-- ---------------------------------------------------------------------
-- 4. Textos del cliente en el portal: tamaño bruto primero
-- ---------------------------------------------------------------------
create or replace function public.portal_texto_cliente(p_nombre text, p_comentario text)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_nombre text;
  v_comentario text;
begin
  -- Un texto enorme se rechaza sin procesarlo (la normalización con expresiones regulares
  -- de varios MB ocupaba la base segundos por llamada).
  if length(coalesce(p_nombre, '')) > 500 then
    raise exception 'Escribe tu nombre (de 2 a 120 caracteres)';
  end if;
  if length(coalesce(p_comentario, '')) > 4000 then
    raise exception 'El comentario puede tener hasta 1000 caracteres';
  end if;

  v_nombre := trim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  v_comentario := nullif(trim(coalesce(p_comentario, '')), '');
  if length(v_nombre) < 2 or length(v_nombre) > 120 then
    raise exception 'Escribe tu nombre (de 2 a 120 caracteres)';
  end if;
  if length(coalesce(v_comentario, '')) > 1000 then
    raise exception 'El comentario puede tener hasta 1000 caracteres';
  end if;
  return array[v_nombre, v_comentario];
end
$$;

-- ---------------------------------------------------------------------
-- 5. Archivos que firma la función de Edge "portal-cliente": solo los guardados en la
--    carpeta del pedido del enlace (pedidos/<pedido_id>/...), sin saltos de carpeta.
--    Así un registro con una ruta equivocada no entrega al cliente un archivo de otro.
-- ---------------------------------------------------------------------
create or replace function public.portal_archivos_firmables(p_token text, p_archivo_id uuid default null)
returns table (id uuid, nombre text, path text, mime text, version integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  e public.portal_enlaces;
  v_pedido uuid;
begin
  e := public.portal_enlace_vigente(p_token);
  v_pedido := public.portal_pedido_de_enlace(e);
  if v_pedido is null then
    return;
  end if;
  return query
  select a.id, a.nombre, a.path, a.mime, a.version
  from public.archivos a
  where a.pedido_id = v_pedido
    and a.categoria = 'diseno'
    and a.path is not null
    and starts_with(a.path, 'pedidos/' || v_pedido::text || '/')
    and position('..' in a.path) = 0
    and (p_archivo_id is null or a.id = p_archivo_id)
  order by a.version desc nulls last, a.created_at desc
  limit 50;
end
$$;

-- ---------------------------------------------------------------------
-- 6. Evidencia de aprobación de diseños
--    Igual que antes, más: si no cambia el estado, "quién registró" y "cuándo" se conservan,
--    y el nombre de quien aprobó y las notas solo los cambia quien tiene "aprobar_disenos"
--    (el portal del cliente actúa sin usuario).
-- ---------------------------------------------------------------------
create or replace function public.tg_archivos_antes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.subido_por := coalesce(auth.uid(), new.subido_por);
    if new.pedido_id is not null and new.cliente_id is null then
      select cliente_id into new.cliente_id from public.pedidos where id = new.pedido_id;
    end if;
    if new.categoria = 'diseno' then
      if new.pedido_id is not null then
        select coalesce(max(version), 0) + 1 into new.version
        from public.archivos where pedido_id = new.pedido_id and categoria = 'diseno';
      end if;
      new.estado_aprobacion := 'pendiente';
    else
      new.version := null;
      new.estado_aprobacion := 'no_aplica';
    end if;
    new.aprobacion_registrada_por := null;
    new.aprobacion_at := null;
    return new;
  end if;

  if new.estado_aprobacion is distinct from old.estado_aprobacion then
    if old.categoria <> 'diseno' then
      raise exception 'Solo los diseños requieren aprobación';
    end if;
    if auth.uid() is not null and not public.tiene_permiso('aprobar_disenos') then
      raise exception 'No tienes permiso para registrar aprobaciones' using errcode = '42501';
    end if;
    new.aprobacion_registrada_por := auth.uid();
    new.aprobacion_at := now();
  else
    new.aprobacion_registrada_por := old.aprobacion_registrada_por;
    new.aprobacion_at := old.aprobacion_at;
    if (new.aprobado_por_nombre is distinct from old.aprobado_por_nombre
        or new.aprobacion_notas is distinct from old.aprobacion_notas)
       and auth.uid() is not null and not public.tiene_permiso('aprobar_disenos') then
      raise exception 'No tienes permiso para cambiar quién aprobó un diseño ni las notas de la aprobación'
        using errcode = '42501';
    end if;
  end if;

  new.pedido_id := old.pedido_id;
  new.categoria := old.categoria;
  new.version := old.version;
  new.subido_por := old.subido_por;
  new.updated_at := now();
  return new;
end
$$;

-- ---------------------------------------------------------------------
-- 7. Proveedores: autor y fecha de alta los pone la base de datos
-- ---------------------------------------------------------------------
create or replace function public.tg_proveedores_autor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end
$$;

create trigger proveedores_autor
before insert or update on public.proveedores
for each row execute function public.tg_proveedores_autor();

-- ---------------------------------------------------------------------
-- 8. Privilegios
-- ---------------------------------------------------------------------
-- Lo que creen migraciones FUTURAS (de este mismo usuario) nace cerrado para anon:
--   funciones: sin PUBLIC ni anon; sí authenticated (validan permisos por dentro) y service_role
--   tablas y secuencias: nada para anon; sin TRUNCATE/REFERENCES/TRIGGER para authenticated
-- Una función nueva para el portal debe darse a anon explícitamente con GRANT.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres in schema public grant execute on functions to authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

-- Secuencias existentes: nada para anon (bitacora_id_seq y portal_respuestas_id_seq tenían UPDATE).
revoke all on all sequences in schema public from anon;

-- Repaso final (cubre también las funciones de esta migración y cualquiera anterior).
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'tg\_%'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.firma);
  end loop;
end
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.portal_obtener(text) to anon;
grant execute on function public.portal_aprobar_cotizacion(text, text, text) to anon;
grant execute on function public.portal_responder_diseno(text, uuid, boolean, text, text) to anon;

revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

notify pgrst, 'reload schema';

-- >>> 20261014001000_seguridad_fases_2_y_3_b.sql
-- =====================================================================
-- 20 · Revisión de seguridad de las fases 2 y 3 (segunda parte)
--
-- Correcciones (cada una tiene su prueba en tests/db/seguridad_fases2y3.test.ts):
--   9. Diseños aprobados: el archivo que aprobó el cliente ya no se cambia. Antes Producción
--      (sin "aprobar_disenos") podía apuntar un diseño aprobado a otro archivo, y quien lo
--      subió podía borrarlo del almacenamiento y subir otro con la misma ruta: el pedido
--      seguía "aprobado" con un arte que el cliente nunca vio (y el almacenamiento no deja
--      rastro en la bitácora). Además, un archivo nuevo ya no puede llegar con "aprobado por"
--      y notas de aprobación precargados (aparecían luego como evidencia de la aprobación).
--  10. Corte de caja: ver el resumen del día, cerrar la caja o leer los cortes guardados
--      exige también "ver_precios" (el corte lista cada pago con cliente e importe; sin ese
--      permiso los pagos no se pueden leer en su tabla).
--  11. Corte de caja: con el día cerrado, los gastos en efectivo tampoco se BORRAN (antes solo
--      se bloqueaba crearlos o modificarlos), salvo administración.
--
-- No cambia la forma de ninguna tabla ni columna: solo reglas, permisos y funciones.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 9a. Archivos: el archivo de un diseño aprobado no se cambia (salvo administración).
--     Para corregir un arte aprobado se sube una versión nueva, o quien puede registrar
--     aprobaciones retira la aprobación (estado distinto de "aprobado") en el mismo cambio.
--     El resto es igual que en la migración 20261014000900.
-- ---------------------------------------------------------------------
create or replace function public.tg_archivos_antes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.subido_por := coalesce(auth.uid(), new.subido_por);
    if new.pedido_id is not null and new.cliente_id is null then
      select cliente_id into new.cliente_id from public.pedidos where id = new.pedido_id;
    end if;
    if new.categoria = 'diseno' then
      if new.pedido_id is not null then
        select coalesce(max(version), 0) + 1 into new.version
        from public.archivos where pedido_id = new.pedido_id and categoria = 'diseno';
      end if;
      new.estado_aprobacion := 'pendiente';
    else
      new.version := null;
      new.estado_aprobacion := 'no_aplica';
    end if;
    -- Un archivo nace sin aprobación: nadie deja precargado quién lo aprobó.
    new.aprobado_por_nombre := null;
    new.aprobacion_notas := null;
    new.aprobacion_registrada_por := null;
    new.aprobacion_at := null;
    return new;
  end if;

  if new.estado_aprobacion is distinct from old.estado_aprobacion then
    if old.categoria <> 'diseno' then
      raise exception 'Solo los diseños requieren aprobación';
    end if;
    if auth.uid() is not null and not public.tiene_permiso('aprobar_disenos') then
      raise exception 'No tienes permiso para registrar aprobaciones' using errcode = '42501';
    end if;
    new.aprobacion_registrada_por := auth.uid();
    new.aprobacion_at := now();
  else
    new.aprobacion_registrada_por := old.aprobacion_registrada_por;
    new.aprobacion_at := old.aprobacion_at;
    if (new.aprobado_por_nombre is distinct from old.aprobado_por_nombre
        or new.aprobacion_notas is distinct from old.aprobacion_notas)
       and auth.uid() is not null and not public.tiene_permiso('aprobar_disenos') then
      raise exception 'No tienes permiso para cambiar quién aprobó un diseño ni las notas de la aprobación'
        using errcode = '42501';
    end if;
    if old.estado_aprobacion = 'aprobado'
       and (new.path is distinct from old.path or new.enlace_externo is distinct from old.enlace_externo)
       and auth.uid() is not null and not public.es_admin() then
      raise exception 'Este diseño ya está aprobado y su archivo no se puede cambiar. Sube una versión nueva para que el cliente la apruebe.'
        using errcode = '42501';
    end if;
  end if;

  new.pedido_id := old.pedido_id;
  new.categoria := old.categoria;
  new.version := old.version;
  new.subido_por := old.subido_por;
  new.updated_at := now();
  return new;
end
$$;

-- ---------------------------------------------------------------------
-- 9b. Almacenamiento: quien subió un archivo puede borrarlo, salvo que sea el de un diseño
--     aprobado (como ya pasaba con el registro en la tabla "archivos"). Administración, sí.
--     No hay regla de UPDATE en este bucket, así que tampoco se sobrescribe ni se mueve.
-- ---------------------------------------------------------------------
alter policy "archivos: eliminar" on storage.objects
  using (
    bucket_id = 'archivos'
    and (
      (select public.es_admin())
      or (
        owner_id = (select auth.uid())::text
        and not exists (
          select 1 from public.archivos a
          where a.path = objects.name and a.estado_aprobacion = 'aprobado'
        )
      )
    )
  );

-- ---------------------------------------------------------------------
-- 10. Corte de caja: también requiere "ver_precios" (o "ver_reportes" para consultarlo).
--     Ventas y administración tienen ambos permisos por defecto: para ellos nada cambia.
-- ---------------------------------------------------------------------
create or replace function public.puede_ver_caja()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (public.tiene_permiso('registrar_pagos') and public.tiene_permiso('ver_precios'))
         or public.tiene_permiso('ver_reportes')
$$;

alter policy "cortes_caja: ver" on public.cortes_caja
  using ((select public.puede_ver_caja()));

create or replace function public.corte_caja_resumen(
  p_fecha date default null,
  p_efectivo_inicial numeric default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'America/Mexico_City'
as $$
begin
  if not public.puede_ver_caja() then
    raise exception 'No tienes permiso para consultar la caja' using errcode = '42501';
  end if;
  return public.corte_caja_calcular(
    coalesce(p_fecha, current_date),
    p_efectivo_inicial,
    public.tiene_permiso('registrar_gastos') or public.tiene_permiso('ver_costos')
  );
end
$$;

-- Igual que antes (incluido el candado por día), más el permiso "ver_precios".
create or replace function public.cerrar_caja(
  p_fecha date,
  p_efectivo_inicial numeric,
  p_efectivo_contado numeric,
  p_notas text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set timezone = 'America/Mexico_City'
set datestyle = 'ISO, MDY'
as $$
declare
  v_fecha date := coalesce(p_fecha, current_date);
  v_res jsonb;
  v_esperado numeric;
  v_corte public.cortes_caja;
begin
  if not (public.tiene_permiso('registrar_pagos') and public.tiene_permiso('ver_precios')) then
    raise exception 'No tienes permiso para cerrar la caja' using errcode = '42501';
  end if;
  if v_fecha > current_date then
    raise exception 'No se puede cerrar la caja de una fecha futura';
  end if;
  if p_efectivo_contado is null or p_efectivo_contado < 0 then
    raise exception 'Indica el efectivo contado en caja';
  end if;
  if coalesce(p_efectivo_inicial, 0) < 0 then
    raise exception 'El efectivo inicial no puede ser negativo';
  end if;
  if length(coalesce(p_notas, '')) > 2000 then
    raise exception 'Las notas pueden tener hasta 2000 caracteres';
  end if;

  -- Un solo cierre a la vez por fecha; espera a los pagos y gastos en efectivo en curso.
  perform pg_advisory_xact_lock(hashtext('cortes_caja:' || v_fecha::text));
  if exists (select 1 from public.cortes_caja where fecha = v_fecha) then
    raise exception 'La caja del % ya está cerrada', to_char(v_fecha, 'DD/MM/YYYY');
  end if;

  v_res := public.corte_caja_calcular(v_fecha, coalesce(p_efectivo_inicial, 0), false);
  v_esperado := (v_res ->> 'esperado')::numeric;

  insert into public.cortes_caja (
    fecha, efectivo_inicial, efectivo_contado, esperado, diferencia, resumen, notas, cerrado_por
  ) values (
    v_fecha, coalesce(p_efectivo_inicial, 0), p_efectivo_contado, v_esperado,
    p_efectivo_contado - v_esperado,
    v_res - 'corte' - 'cerrado' - 'efectivo_inicial_sugerido',
    nullif(trim(p_notas), ''), auth.uid()
  )
  returning * into v_corte;

  return to_jsonb(v_corte);
end
$$;

-- ---------------------------------------------------------------------
-- 11. Gastos en efectivo de un día cerrado: tampoco se borran (salvo administración).
--     Toma el mismo candado por día que los pagos y gastos (ver 20261014000900).
-- ---------------------------------------------------------------------
create or replace function public.tg_gastos_caja_cerrada_borrar()
returns trigger
language plpgsql
security definer
set search_path = ''
set datestyle = 'ISO, MDY'
as $$
begin
  if old.metodo_pago = 'efectivo' then
    perform pg_advisory_xact_lock_shared(hashtext('cortes_caja:' || old.fecha::text));
    if auth.uid() is not null and not public.es_admin()
       and exists (select 1 from public.cortes_caja c where c.fecha = old.fecha) then
      raise exception 'La caja del % ya está cerrada. Pide a administración que la reabra para borrar gastos en efectivo de ese día.',
        to_char(old.fecha, 'DD/MM/YYYY')
        using errcode = '42501';
    end if;
  end if;
  return old;
end
$$;

drop trigger if exists gastos_caja_cerrada_borrar on public.gastos;
create trigger gastos_caja_cerrada_borrar
before delete on public.gastos
for each row execute function public.tg_gastos_caja_cerrada_borrar();

-- ---------------------------------------------------------------------
-- Privilegios de lo nuevo
-- ---------------------------------------------------------------------
revoke execute on function public.tg_gastos_caja_cerrada_borrar() from public, anon, authenticated;
revoke execute on function public.puede_ver_caja() from public, anon;
grant execute on function public.puede_ver_caja() to authenticated, service_role;
revoke execute on function public.corte_caja_resumen(date, numeric) from public, anon;
revoke execute on function public.cerrar_caja(date, numeric, numeric, text) from public, anon;
grant execute on function public.corte_caja_resumen(date, numeric) to authenticated, service_role;
grant execute on function public.cerrar_caja(date, numeric, numeric, text) to authenticated, service_role;
grant execute on function public.tg_gastos_caja_cerrada_borrar() to service_role;

notify pgrst, 'reload schema';

-- >>> 20261014001100_seguridad_fases_2_y_3_c.sql
-- =====================================================================
-- 21 · Revisión de seguridad de las fases 2 y 3 (tercera parte)
--
-- Corrección (con su prueba en tests/db/seguridad_fases2y3.test.ts):
--  12. Respuestas del portal: con solo "aprobar_disenos" (Diseño) se leían TODAS las
--      respuestas del portal, incluidas las aprobaciones de cotizaciones (nombre y comentario
--      del cliente, IP y navegador). Ahora ese permiso solo alcanza las respuestas sobre
--      diseños; las de cotizaciones requieren "gestionar_cotizaciones" y las de pedidos
--      "gestionar_pedidos" (como los enlaces del portal).
--
-- No cambia la forma de ninguna tabla ni columna: solo reglas.
-- =====================================================================

alter policy "portal_respuestas: ver" on public.portal_respuestas
  using (
    (accion = 'aprobar_cotizacion' and (select public.tiene_permiso('gestionar_cotizaciones')))
    or (
      accion <> 'aprobar_cotizacion'
      and (
        (select public.tiene_permiso('gestionar_pedidos'))
        or (select public.tiene_permiso('aprobar_disenos'))
      )
    )
  );

notify pgrst, 'reload schema';

-- >>> 20261019000100_oportunidades_etapa_cambiada.sql
-- Fecha en que la oportunidad llegó a su etapa actual (para "días en la etapa" del embudo).
alter table public.oportunidades add column etapa_cambiada_at timestamptz not null default now();
update public.oportunidades set etapa_cambiada_at = updated_at;

create or replace function public.tg_oportunidades_etapa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.etapa in ('ganado', 'perdido') then
    if tg_op = 'INSERT' or old.etapa is distinct from new.etapa then
      new.cerrada_at := coalesce(new.cerrada_at, now());
    end if;
  else
    new.cerrada_at := null;
  end if;
  if new.etapa <> 'perdido' then
    new.motivo_perdida := null;
  end if;
  if tg_op = 'INSERT' then
    new.etapa_cambiada_at := now();
  elsif old.etapa is distinct from new.etapa then
    new.etapa_cambiada_at := now();
  else
    new.etapa_cambiada_at := old.etapa_cambiada_at;
  end if;
  new.updated_at := now();
  return new;
end
$$;

commit;
