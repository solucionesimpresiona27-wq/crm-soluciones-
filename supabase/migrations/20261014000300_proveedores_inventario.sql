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
