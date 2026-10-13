-- =====================================================================
-- CRM Soluciones Impresiona · Instalador de la base de datos
--
-- Pégalo completo en Supabase → SQL Editor → New query → Run, UNA sola vez,
-- en un proyecto nuevo. Generado a partir de supabase/migrations (10 archivos).
-- No lo edites a mano: ejecuta "npm run db:instalador".
-- =====================================================================

-- >>> 20261013000100_base.sql
-- =====================================================================
-- CRM Soluciones Impresiona
-- 01 · Base: tipos, perfiles de usuario, permisos y configuración
-- =====================================================================

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Fechas "de hoy" en hora de Guadalajara (el servidor usa UTC).
do $$
begin
  execute format('alter database %I set timezone to %L', current_database(), 'America/Mexico_City');
end
$$;
set timezone to 'America/Mexico_City';

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.rol_usuario as enum ('admin', 'ventas', 'diseno', 'produccion');

create type public.metodo_calculo as enum (
  'pieza', 'm2', 'metro_lineal', 'millar', 'hora', 'servicio', 'proyecto', 'mensualidad'
);

create type public.etapa_comercial as enum (
  'prospecto_nuevo', 'contactado', 'interesado', 'cotizacion_enviada', 'en_seguimiento', 'ganado', 'perdido'
);

create type public.estado_cotizacion as enum ('borrador', 'enviada', 'aceptada', 'rechazada', 'cancelada');

create type public.estado_pedido as enum (
  'nuevo', 'en_diseno', 'esperando_aprobacion', 'aprobado', 'en_produccion', 'acabados',
  'listo_entrega', 'en_instalacion', 'entregado', 'finalizado', 'pausado', 'cancelado'
);

create type public.estado_pago as enum ('pendiente', 'anticipo', 'parcial', 'liquidado', 'reembolsado');

create type public.metodo_pago as enum ('transferencia', 'efectivo', 'deposito', 'tarjeta');

create type public.tipo_pago as enum ('anticipo', 'abono', 'liquidacion', 'devolucion');

create type public.tipo_partida as enum ('concepto', 'instalacion', 'transporte', 'diseno', 'extra');

create type public.prioridad as enum ('baja', 'normal', 'alta', 'urgente');

create type public.estado_archivo as enum ('no_aplica', 'pendiente', 'aprobado', 'cambios', 'rechazado');

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------
create or replace function public.tg_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- Texto normalizado (minúsculas y sin acentos) para búsquedas rápidas.
create or replace function public.normalizar(t text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, '')))
$$;

-- ---------------------------------------------------------------------
-- Perfiles de usuario (1 a 1 con auth.users)
-- ---------------------------------------------------------------------
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null default '',
  email text not null default '',
  telefono text,
  puesto text,
  rol public.rol_usuario not null default 'ventas',
  activo boolean not null default false,
  -- Permisos personalizados que reemplazan los del rol, p. ej. {"ver_costos": true}
  permisos jsonb not null default '{}'::jsonb check (jsonb_typeof(permisos) = 'object'),
  comision_pct numeric(5, 2) not null default 0 check (comision_pct between 0 and 100),
  ultimo_acceso timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.perfiles is 'Usuarios del CRM: rol, estado y permisos personalizados.';

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
    'eliminar_registros'      -- Eliminar clientes, cotizaciones y otros registros
  ]
$$;

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
    when 'produccion' then p_permiso = any (array['actualizar_produccion'])
    else false
  end
$$;

create or replace function public.usuario_activo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.activo from public.perfiles p where p.id = auth.uid()), false)
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p where p.id = auth.uid() and p.activo and p.rol = 'admin'
  )
$$;

create or replace function public.tiene_permiso(p_permiso text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when p.rol = 'admin' then true
      when jsonb_typeof(p.permisos -> p_permiso) = 'boolean' then (p.permisos ->> p_permiso)::boolean
      else public.permiso_por_defecto(p.rol, p_permiso)
    end
    from public.perfiles p
    where p.id = auth.uid() and p.activo
  ), false)
$$;

-- Permisos efectivos del usuario actual: {"ver_precios": true, ...}
create or replace function public.mis_permisos()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(k, public.tiene_permiso(k)), '{}'::jsonb)
  from unnest(public.lista_permisos()) as k
$$;

-- ---------------------------------------------------------------------
-- Protección de perfiles
-- ---------------------------------------------------------------------
create or replace function public.tg_perfiles_proteger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- auth.uid() es nulo cuando actúa el sistema (service role o editor SQL).
  if auth.uid() is not null and not public.es_admin() then
    if new.rol is distinct from old.rol
       or new.activo is distinct from old.activo
       or new.permisos is distinct from old.permisos
       or new.email is distinct from old.email
       or new.comision_pct is distinct from old.comision_pct then
      raise exception 'Solo un administrador puede cambiar el rol, estado, permisos o comisión de un usuario'
        using errcode = '42501';
    end if;
  end if;

  if old.rol = 'admin' and old.activo and (new.rol <> 'admin' or not new.activo) then
    if not exists (
      select 1 from public.perfiles p where p.rol = 'admin' and p.activo and p.id <> old.id
    ) then
      raise exception 'Debe existir al menos un administrador activo';
    end if;
  end if;

  new.updated_at := now();
  return new;
end
$$;

create trigger perfiles_proteger
before update on public.perfiles
for each row execute function public.tg_perfiles_proteger();

-- Al crear un usuario en Auth se crea su perfil.
-- El primer usuario del sistema se vuelve administrador automáticamente.
-- Los demás quedan inactivos hasta que un administrador los active,
-- salvo que se creen desde el CRM (app_metadata con rol y activo).
create or replace function public.tg_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hay_admin boolean;
  v_rol public.rol_usuario := 'ventas';
  v_activo boolean := false;
begin
  select exists (select 1 from public.perfiles where rol = 'admin') into v_hay_admin;

  begin
    v_rol := coalesce(nullif(new.raw_app_meta_data ->> 'rol', '')::public.rol_usuario, 'ventas');
  exception when others then
    v_rol := 'ventas';
  end;

  if jsonb_typeof(new.raw_app_meta_data -> 'activo') = 'boolean' then
    v_activo := (new.raw_app_meta_data ->> 'activo')::boolean;
  end if;

  insert into public.perfiles (id, email, nombre, rol, activo)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(new.raw_app_meta_data ->> 'nombre', ''),
      nullif(new.raw_user_meta_data ->> 'nombre', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    case when v_hay_admin then v_rol else 'admin' end,
    case when v_hay_admin then v_activo else true end
  )
  on conflict (id) do nothing;

  return new;
end
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.tg_nuevo_usuario();

-- Supabase Auth guarda app_metadata en un segundo paso al crear usuarios con la llave de servicio;
-- solo el servidor puede escribir app_metadata, por lo que es confiable.
create or replace function public.tg_usuario_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol public.rol_usuario;
begin
  if new.raw_app_meta_data is not distinct from old.raw_app_meta_data
     or (new.raw_app_meta_data ->> 'rol') is null then
    return new;
  end if;
  if (new.raw_app_meta_data ->> 'rol') is not distinct from (old.raw_app_meta_data ->> 'rol')
     and (new.raw_app_meta_data -> 'activo') is not distinct from (old.raw_app_meta_data -> 'activo') then
    return new;
  end if;

  begin
    v_rol := (new.raw_app_meta_data ->> 'rol')::public.rol_usuario;
  exception when others then
    return new;
  end;

  update public.perfiles
  set rol = v_rol,
      activo = case when jsonb_typeof(new.raw_app_meta_data -> 'activo') = 'boolean'
                    then (new.raw_app_meta_data ->> 'activo')::boolean else activo end,
      nombre = coalesce(nullif(new.raw_app_meta_data ->> 'nombre', ''), nombre)
  where id = new.id;
  return new;
end
$$;

create trigger on_auth_user_app_metadata
after update of raw_app_meta_data on auth.users
for each row execute function public.tg_usuario_app_metadata();

create or replace function public.tg_usuario_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.perfiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end
$$;

create trigger on_auth_user_email
after update of email on auth.users
for each row execute function public.tg_usuario_email();

-- Registra el último acceso (lo llama la app al iniciar sesión).
create or replace function public.registrar_acceso()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.perfiles set ultimo_acceso = now() where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- Configuración del negocio (una sola fila)
-- ---------------------------------------------------------------------
create table public.configuracion (
  id smallint primary key default 1 check (id = 1),
  nombre_comercial text not null default 'Soluciones Impresiona',
  eslogan text,
  ciudad text default 'Guadalajara, Jalisco, México',
  direccion text,
  telefono text,
  whatsapp text default '+52 33 3492 2524',
  email text default 'solucionesimpresiona27@gmail.com',
  sitio_web text,
  instagram text default '@solucionesimpresiona',
  facebook text default 'Soluciones Impresiona',
  tiktok text default '@solucionesimpresiona',
  -- Datos fiscales: no se muestran en los PDF hasta activar "mostrar_datos_fiscales"
  rfc text,
  razon_social text,
  regimen_fiscal text,
  mostrar_datos_fiscales boolean not null default false,
  -- Datos bancarios para transferencias (opcional, se muestran en el PDF si existen)
  datos_bancarios text,
  -- Identidad visual (nulo = logo incluido en la aplicación)
  logo_url text,
  color_primario text not null default '#22426B',
  color_secundario text not null default '#F9C206',
  -- Condiciones comerciales por defecto
  iva_pct numeric(5, 2) not null default 16 check (iva_pct between 0 and 100),
  anticipo_pct numeric(5, 2) not null default 50 check (anticipo_pct between 0 and 100),
  vigencia_dias integer not null default 15 check (vigencia_dias between 1 and 365),
  tiempo_entrega_default text default 'Variable según el producto, la cantidad y la complejidad del trabajo.',
  condiciones_cotizacion text,
  notas_pie_cotizacion text,
  metodos_pago_activos public.metodo_pago[] not null default array['transferencia', 'efectivo', 'deposito']::public.metodo_pago[],
  prefijo_cotizacion text not null default 'COT',
  prefijo_pedido text not null default 'PED',
  dias_reactivacion integer not null default 90 check (dias_reactivacion > 0),
  updated_at timestamptz not null default now()
);

comment on table public.configuracion is 'Datos de la empresa, identidad y condiciones comerciales por defecto.';

insert into public.configuracion (id, condiciones_cotizacion, notas_pie_cotizacion)
values (
  1,
  E'Pago restante: 50% antes de entregar o instalar, según el proyecto.\n'
  || E'La producción inicia una vez confirmado el anticipo y aprobados los diseños, cuando aplique.\n'
  || E'Los tiempos de entrega varían según el producto, la cantidad y la complejidad del trabajo.\n'
  || E'Cualquier modificación posterior a la aprobación del diseño podrá generar costos adicionales.\n'
  || E'La instalación y el transporte se cotizan por separado.\n'
  || E'Los trabajos urgentes pueden tener un recargo adicional.\n'
  || 'Precios en pesos mexicanos (MXN). El IVA se desglosa por separado cuando corresponde.',
  'Gracias por su preferencia.'
);

create trigger configuracion_updated_at
before update on public.configuracion
for each row execute function public.tg_updated_at();

-- ---------------------------------------------------------------------
-- Folios consecutivos
-- ---------------------------------------------------------------------
create table public.folios (
  tipo text primary key check (tipo in ('cotizacion', 'pedido')),
  siguiente integer not null default 1 check (siguiente > 0)
);

insert into public.folios (tipo) values ('cotizacion'), ('pedido');

create or replace function public.tg_asignar_folio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo text := tg_argv[0];
  v_num integer;
  v_prefijo text;
begin
  if new.folio is not null and new.folio <> '' then
    return new;
  end if;

  update public.folios set siguiente = siguiente + 1
  where tipo = v_tipo
  returning siguiente - 1 into v_num;

  select case v_tipo when 'cotizacion' then prefijo_cotizacion else prefijo_pedido end
  into v_prefijo
  from public.configuracion where id = 1;

  new.folio := coalesce(nullif(v_prefijo, ''), upper(left(v_tipo, 3))) || '-' || lpad(v_num::text, 4, '0');
  return new;
end
$$;

-- >>> 20261013000200_comercial.sql
-- =====================================================================
-- 02 · Comercial: clientes, contactos, oportunidades y actividades
-- =====================================================================

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'empresa' check (tipo in ('persona', 'empresa')),
  nombre text not null check (length(trim(nombre)) > 0),
  telefono text,
  whatsapp text,
  email text,
  direccion text,
  ciudad text,
  notas text,
  etiquetas text[] not null default '{}',
  origen text,
  -- Datos fiscales (la facturación se hace por fuera del CRM)
  requiere_factura boolean not null default false,
  rfc text,
  razon_social text,
  regimen_fiscal text,
  codigo_postal_fiscal text,
  uso_cfdi text,
  email_facturacion text,
  dias_credito integer not null default 0 check (dias_credito >= 0),
  vendedor_id uuid references public.perfiles (id) on delete set null,
  ultima_compra_at timestamptz,
  activo boolean not null default true,
  busqueda text generated always as (
    public.normalizar(
      nombre || ' ' || coalesce(telefono, '') || ' ' || coalesce(whatsapp, '') || ' '
      || coalesce(email, '') || ' ' || coalesce(rfc, '') || ' ' || coalesce(razon_social, '')
    )
  ) stored,
  created_by uuid default auth.uid() references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.clientes is 'Clientes y prospectos.';

create index clientes_busqueda_idx on public.clientes using gin (busqueda extensions.gin_trgm_ops);
create index clientes_vendedor_idx on public.clientes (vendedor_id);
create index clientes_nombre_idx on public.clientes (nombre);

create trigger clientes_updated_at
before update on public.clientes
for each row execute function public.tg_updated_at();

create table public.contactos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  puesto text,
  telefono text,
  whatsapp text,
  email text,
  principal boolean not null default false,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contactos_cliente_idx on public.contactos (cliente_id);

create trigger contactos_updated_at
before update on public.contactos
for each row execute function public.tg_updated_at();

-- Oportunidades: flujo comercial independiente del flujo de producción.
create table public.oportunidades (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  titulo text not null check (length(trim(titulo)) > 0),
  descripcion text,
  etapa public.etapa_comercial not null default 'prospecto_nuevo',
  valor_estimado numeric(12, 2) check (valor_estimado >= 0),
  responsable_id uuid default auth.uid() references public.perfiles (id) on delete set null,
  origen text,
  proxima_accion text,
  proxima_accion_fecha date,
  motivo_perdida text,
  cerrada_at timestamptz,
  created_by uuid default auth.uid() references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index oportunidades_cliente_idx on public.oportunidades (cliente_id);
create index oportunidades_etapa_idx on public.oportunidades (etapa);
create index oportunidades_proxima_idx on public.oportunidades (proxima_accion_fecha)
  where etapa not in ('ganado', 'perdido');

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
  new.updated_at := now();
  return new;
end
$$;

create trigger oportunidades_etapa
before insert or update on public.oportunidades
for each row execute function public.tg_oportunidades_etapa();

-- Actividades: historial de seguimiento (llamadas, mensajes, visitas, notas).
create table public.actividades (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  oportunidad_id uuid references public.oportunidades (id) on delete set null,
  tipo text not null default 'nota' check (tipo in ('nota', 'llamada', 'whatsapp', 'correo', 'visita', 'reunion')),
  descripcion text not null check (length(trim(descripcion)) > 0),
  fecha timestamptz not null default now(),
  usuario_id uuid default auth.uid() references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index actividades_cliente_idx on public.actividades (cliente_id, fecha desc);
create index actividades_oportunidad_idx on public.actividades (oportunidad_id);

-- >>> 20261013000300_catalogo.sql
-- =====================================================================
-- 03 · Catálogo: categorías, productos/servicios y costos
-- =====================================================================

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  grupo text not null,
  nombre text not null check (length(trim(nombre)) > 0),
  descripcion text,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grupo, nombre)
);

create trigger categorias_updated_at
before update on public.categorias
for each row execute function public.tg_updated_at();

create table public.productos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid references public.categorias (id) on delete set null,
  nombre text not null check (length(trim(nombre)) > 0),
  descripcion text,
  sku text,
  metodo_calculo public.metodo_calculo not null default 'pieza',
  unidad text not null default 'pza',
  -- Precio de venta por unidad de cobro (m², metro lineal, pieza, millar, hora...).
  -- Nulo = todavía sin precio capturado.
  precio_venta numeric(12, 2) check (precio_venta >= 0),
  -- Importe mínimo a cobrar por partida (p. ej. mínimo 1 m²).
  precio_minimo numeric(12, 2) check (precio_minimo >= 0),
  -- Precios por volumen: [{"desde": 12, "precio": 95.5}, ...] sobre las unidades de cobro.
  escalas jsonb not null default '[]'::jsonb check (jsonb_typeof(escalas) = 'array'),
  -- Etapas de producción que normalmente requiere
  requiere_diseno boolean not null default true,
  requiere_produccion boolean not null default true,
  requiere_instalacion boolean not null default false,
  tiempo_entrega text,
  activo boolean not null default true,
  busqueda text generated always as (
    public.normalizar(nombre || ' ' || coalesce(sku, '') || ' ' || coalesce(descripcion, ''))
  ) stored,
  created_by uuid default auth.uid() references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index productos_categoria_idx on public.productos (categoria_id);
create index productos_busqueda_idx on public.productos using gin (busqueda extensions.gin_trgm_ops);

create trigger productos_updated_at
before update on public.productos
for each row execute function public.tg_updated_at();

-- Costos del producto: tabla separada para restringirla a quien tenga "ver_costos".
create table public.producto_costos (
  producto_id uuid primary key references public.productos (id) on delete cascade,
  costo_material numeric(12, 4) not null default 0 check (costo_material >= 0),
  costo_mano_obra numeric(12, 4) not null default 0 check (costo_mano_obra >= 0),
  costo_fijo numeric(12, 2) not null default 0 check (costo_fijo >= 0),
  desperdicio_pct numeric(5, 2) not null default 0 check (desperdicio_pct between 0 and 100),
  -- Ganancia deseada sobre el costo (markup): precio = costo × (1 + ganancia%)
  ganancia_pct numeric(7, 2) not null default 0 check (ganancia_pct >= 0),
  proveedor text,
  notas text,
  updated_at timestamptz not null default now()
);

create trigger producto_costos_updated_at
before update on public.producto_costos
for each row execute function public.tg_updated_at();

-- Unidades sobre las que se cobra una partida.
create or replace function public.unidades_cobro(
  p_metodo public.metodo_calculo,
  p_cantidad numeric,
  p_ancho numeric,
  p_alto numeric,
  p_largo numeric
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case p_metodo
    when 'm2' then coalesce(p_ancho, 0) * coalesce(p_alto, 0) * coalesce(p_cantidad, 0)
    when 'metro_lineal' then coalesce(p_largo, 0) * coalesce(p_cantidad, 0)
    else coalesce(p_cantidad, 0)
  end
$$;

-- ---------------------------------------------------------------------
-- Catálogo inicial (sin precios: se capturan desde el CRM)
-- ---------------------------------------------------------------------
insert into public.categorias (grupo, nombre, orden) values
  ('Impresión y publicidad', 'Vinil', 10),
  ('Impresión y publicidad', 'Lonas y gran formato', 20),
  ('Impresión y publicidad', 'Rotulación', 30),
  ('Impresión y publicidad', 'Instalación de publicidad', 40),
  ('Impresión y publicidad', 'Señalética', 50),
  ('Impresión y publicidad', 'Letreros', 60),
  ('Impresión y publicidad', 'Cuadros decorativos y resina', 70),
  ('Promocionales y personalización', 'DTF', 110),
  ('Promocionales y personalización', 'Sublimación', 120),
  ('Promocionales y personalización', 'Artículos personalizados', 130),
  ('Promocionales y personalización', 'Corte y grabado láser', 140),
  ('Producción e instalación', 'Fabricación', 210),
  ('Producción e instalación', 'Instalaciones', 220),
  ('Producción e instalación', 'Mantenimiento y remodelación', 230),
  ('Servicios digitales', 'Desarrollo web', 310),
  ('Servicios digitales', 'Inteligencia artificial y automatización', 320),
  ('Servicios digitales', 'Edición y contenido', 330),
  ('Servicios digitales', 'Publicidad digital', 340);

with p (categoria, nombre, metodo, unidad, dis, prod, inst) as (
  values
    ('Vinil', 'Impresión de vinil', 'm2', 'm²', true, true, false),
    ('Vinil', 'Corte de vinil', 'm2', 'm²', true, true, false),
    ('Vinil', 'Vinil microperforado', 'm2', 'm²', true, true, false),
    ('Lonas y gran formato', 'Lona impresa', 'm2', 'm²', true, true, false),
    ('Lonas y gran formato', 'Impresión gran formato', 'm2', 'm²', true, true, false),
    ('Rotulación', 'Rotulación de cristales', 'm2', 'm²', true, true, true),
    ('Rotulación', 'Rotulación vehicular', 'proyecto', 'proyecto', true, true, true),
    ('Rotulación', 'Rotulación de negocios', 'm2', 'm²', true, true, true),
    ('Instalación de publicidad', 'Instalación de publicidad', 'servicio', 'servicio', false, false, true),
    ('Instalación de publicidad', 'Desinstalación de publicidad', 'servicio', 'servicio', false, false, true),
    ('Señalética', 'Señalética', 'pieza', 'pza', true, true, false),
    ('Letreros', 'Letrero de acrílico', 'pieza', 'pza', true, true, true),
    ('Letreros', 'Letras volumétricas', 'pieza', 'pza', true, true, true),
    ('Letreros', 'Letrero LED', 'pieza', 'pza', true, true, true),
    ('Letreros', 'Letrero de neón flex', 'pieza', 'pza', true, true, true),
    ('Cuadros decorativos y resina', 'Cuadro decorativo', 'pieza', 'pza', true, true, false),
    ('Cuadros decorativos y resina', 'Pieza en resina', 'pieza', 'pza', true, true, false),
    ('DTF', 'DTF textil', 'metro_lineal', 'm', true, true, false),
    ('DTF', 'DTF UV', 'metro_lineal', 'm', true, true, false),
    ('Sublimación', 'Sublimación', 'pieza', 'pza', true, true, false),
    ('Artículos personalizados', 'Termo personalizado', 'pieza', 'pza', true, true, false),
    ('Artículos personalizados', 'Taza personalizada', 'pieza', 'pza', true, true, false),
    ('Artículos personalizados', 'Playera / prenda personalizada', 'pieza', 'pza', true, true, false),
    ('Corte y grabado láser', 'Corte láser', 'pieza', 'pza', true, true, false),
    ('Corte y grabado láser', 'Grabado láser', 'pieza', 'pza', true, true, false),
    ('Fabricación', 'Fabricación de letrero', 'proyecto', 'proyecto', true, true, true),
    ('Fabricación', 'Mobiliario personalizado', 'proyecto', 'proyecto', true, true, true),
    ('Instalaciones', 'Instalación publicitaria', 'proyecto', 'proyecto', false, true, true),
    ('Mantenimiento y remodelación', 'Mantenimiento', 'servicio', 'servicio', false, true, true),
    ('Mantenimiento y remodelación', 'Remodelación', 'proyecto', 'proyecto', true, true, true),
    ('Desarrollo web', 'Desarrollo de página web', 'proyecto', 'proyecto', true, false, false),
    ('Desarrollo web', 'Mantenimiento web', 'mensualidad', 'mes', false, false, false),
    ('Inteligencia artificial y automatización', 'Asistente de inteligencia artificial', 'proyecto', 'proyecto', true, false, false),
    ('Inteligencia artificial y automatización', 'Automatización empresarial', 'proyecto', 'proyecto', true, false, false),
    ('Edición y contenido', 'Edición de fotografías', 'pieza', 'foto', true, false, false),
    ('Edición y contenido', 'Edición profesional de video', 'pieza', 'video', true, false, false),
    ('Edición y contenido', 'Contenido para redes sociales', 'mensualidad', 'mes', true, false, false),
    ('Publicidad digital', 'Campaña de Google Ads', 'mensualidad', 'mes', true, false, false),
    ('Publicidad digital', 'Campaña de Meta Ads', 'mensualidad', 'mes', true, false, false)
)
insert into public.productos (categoria_id, nombre, metodo_calculo, unidad, requiere_diseno, requiere_produccion, requiere_instalacion)
select c.id, p.nombre, p.metodo::public.metodo_calculo, p.unidad, p.dis, p.prod, p.inst
from p
join public.categorias c on c.nombre = p.categoria;

-- >>> 20261013000400_ventas.sql
-- =====================================================================
-- 04 · Ventas y operación: cotizaciones, pedidos, partidas, costos,
--      pagos, eventos de pedido y archivos
-- =====================================================================

-- ---------------------------------------------------------------------
-- Cotizaciones
-- ---------------------------------------------------------------------
create table public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  contacto_id uuid references public.contactos (id) on delete set null,
  oportunidad_id uuid references public.oportunidades (id) on delete set null,
  vendedor_id uuid default auth.uid() references public.perfiles (id) on delete set null,
  titulo text,
  fecha date not null default current_date,
  vigencia_dias integer not null default 15 check (vigencia_dias between 1 and 365),
  fecha_vencimiento date generated always as (fecha + vigencia_dias) stored,
  estado public.estado_cotizacion not null default 'borrador',
  motivo_rechazo text,
  tiempo_entrega text,
  anticipo_pct numeric(5, 2) not null default 50 check (anticipo_pct between 0 and 100),
  aplica_iva boolean not null default true,
  iva_pct numeric(5, 2) not null default 16 check (iva_pct between 0 and 100),
  descuento_tipo text not null default 'monto' check (descuento_tipo in ('monto', 'pct')),
  descuento_valor numeric(12, 2) not null default 0 check (descuento_valor >= 0),
  recargo_pct numeric(5, 2) not null default 0 check (recargo_pct between 0 and 100),
  recargo_concepto text not null default 'Recargo por urgencia',
  -- Totales calculados por la base de datos
  subtotal numeric(12, 2) not null default 0,
  descuento numeric(12, 2) not null default 0,
  recargo numeric(12, 2) not null default 0,
  iva numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  condiciones text,
  notas text,
  notas_internas text,
  pedido_id uuid,
  enviada_at timestamptz,
  aceptada_at timestamptz,
  pdf_path text,
  created_by uuid default auth.uid() references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.cotizaciones.recargo_pct is 'Recargo (p. ej. por urgencia) sobre el subtotal menos descuento.';

create index cotizaciones_cliente_idx on public.cotizaciones (cliente_id);
create index cotizaciones_estado_idx on public.cotizaciones (estado, fecha_vencimiento);
create index cotizaciones_fecha_idx on public.cotizaciones (fecha desc);
create index cotizaciones_oportunidad_idx on public.cotizaciones (oportunidad_id);

create trigger cotizaciones_folio
before insert on public.cotizaciones
for each row execute function public.tg_asignar_folio('cotizacion');

-- ---------------------------------------------------------------------
-- Pedidos / órdenes de trabajo
-- ---------------------------------------------------------------------
create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  cotizacion_id uuid references public.cotizaciones (id) on delete set null,
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  contacto_id uuid references public.contactos (id) on delete set null,
  vendedor_id uuid default auth.uid() references public.perfiles (id) on delete set null,
  responsable_id uuid references public.perfiles (id) on delete set null,
  disenador_id uuid references public.perfiles (id) on delete set null,
  titulo text not null check (length(trim(titulo)) > 0),
  descripcion text,
  estado public.estado_pedido not null default 'nuevo',
  estado_anterior public.estado_pedido,
  motivo_estado text,
  etapas_omitidas public.estado_pedido[] not null default '{}',
  prioridad public.prioridad not null default 'normal',
  fecha_entrega date,
  requiere_instalacion boolean not null default false,
  direccion_instalacion text,
  -- Montos
  anticipo_pct numeric(5, 2) not null default 50 check (anticipo_pct between 0 and 100),
  aplica_iva boolean not null default true,
  iva_pct numeric(5, 2) not null default 16 check (iva_pct between 0 and 100),
  descuento_tipo text not null default 'monto' check (descuento_tipo in ('monto', 'pct')),
  descuento_valor numeric(12, 2) not null default 0 check (descuento_valor >= 0),
  recargo_pct numeric(5, 2) not null default 0 check (recargo_pct between 0 and 100),
  recargo_concepto text not null default 'Recargo por urgencia',
  subtotal numeric(12, 2) not null default 0,
  descuento numeric(12, 2) not null default 0,
  recargo numeric(12, 2) not null default 0,
  iva numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  condiciones text,
  -- Cobranza (calculado a partir de los pagos)
  pagado numeric(12, 2) not null default 0,
  saldo numeric(12, 2) generated always as (total - pagado) stored,
  estado_pago public.estado_pago not null default 'pendiente',
  fecha_limite_pago date,
  -- Facturación externa
  requiere_factura boolean not null default false,
  facturado boolean not null default false,
  folio_factura text,
  fecha_factura date,
  notas_internas text,
  entregado_at timestamptz,
  finalizado_at timestamptz,
  cancelado_at timestamptz,
  created_by uuid default auth.uid() references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pedidos_cliente_idx on public.pedidos (cliente_id);
create index pedidos_estado_idx on public.pedidos (estado);
create index pedidos_entrega_idx on public.pedidos (fecha_entrega);
create index pedidos_responsable_idx on public.pedidos (responsable_id);
create index pedidos_disenador_idx on public.pedidos (disenador_id);
create index pedidos_saldo_idx on public.pedidos (estado_pago) where estado <> 'cancelado';

alter table public.cotizaciones
  add constraint cotizaciones_pedido_fk foreign key (pedido_id) references public.pedidos (id) on delete set null;

create trigger pedidos_folio
before insert on public.pedidos
for each row execute function public.tg_asignar_folio('pedido');

-- ---------------------------------------------------------------------
-- Partidas (conceptos) de cotizaciones y pedidos
-- ---------------------------------------------------------------------
create table public.partidas (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid references public.cotizaciones (id) on delete cascade,
  pedido_id uuid references public.pedidos (id) on delete cascade,
  orden integer not null default 0,
  tipo public.tipo_partida not null default 'concepto',
  producto_id uuid references public.productos (id) on delete set null,
  concepto text not null check (length(trim(concepto)) > 0),
  descripcion text,
  metodo_calculo public.metodo_calculo not null default 'pieza',
  unidad text not null default 'pza',
  ancho numeric(10, 3) check (ancho >= 0),
  alto numeric(10, 3) check (alto >= 0),
  largo numeric(10, 3) check (largo >= 0),
  cantidad numeric(12, 3) not null default 1 check (cantidad > 0),
  precio_unitario numeric(12, 2) not null default 0 check (precio_unitario >= 0),
  descuento_pct numeric(5, 2) not null default 0 check (descuento_pct between 0 and 100),
  importe numeric(12, 2) generated always as (
    round(cantidad * precio_unitario * (1 - descuento_pct / 100), 2)
  ) stored,
  notas_produccion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partidas_un_documento check (num_nonnulls(cotizacion_id, pedido_id) = 1)
);

comment on column public.partidas.cantidad is
  'Unidades de venta: piezas (m², metro lineal, pieza), millares, horas, meses, etc.';
comment on column public.partidas.precio_unitario is 'Precio por unidad de venta (por pieza en m² y metro lineal).';

create index partidas_cotizacion_idx on public.partidas (cotizacion_id, orden);
create index partidas_pedido_idx on public.partidas (pedido_id, orden);

create trigger partidas_updated_at
before update on public.partidas
for each row execute function public.tg_updated_at();

-- Costos por partida (restringido a "ver_costos")
create table public.partida_costos (
  partida_id uuid primary key references public.partidas (id) on delete cascade,
  costo_material numeric(12, 4) not null default 0 check (costo_material >= 0),
  costo_mano_obra numeric(12, 4) not null default 0 check (costo_mano_obra >= 0),
  costo_fijo numeric(12, 2) not null default 0 check (costo_fijo >= 0),
  desperdicio_pct numeric(5, 2) not null default 0 check (desperdicio_pct between 0 and 100),
  ganancia_pct numeric(7, 2) not null default 0 check (ganancia_pct >= 0),
  costo_total numeric(12, 2) not null default 0 check (costo_total >= 0),
  -- Detalle del cálculo; "origen": "catalogo" (estimado automático) o "manual"
  calculo jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger partida_costos_updated_at
before update on public.partida_costos
for each row execute function public.tg_updated_at();

-- ---------------------------------------------------------------------
-- Pagos
-- ---------------------------------------------------------------------
create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete restrict,
  cliente_id uuid references public.clientes (id) on delete restrict,
  fecha date not null default current_date,
  importe numeric(12, 2) not null check (importe > 0),
  tipo public.tipo_pago not null default 'abono',
  metodo public.metodo_pago not null,
  referencia text,
  comprobante_path text,
  notas text,
  registrado_por uuid default auth.uid() references public.perfiles (id) on delete set null,
  cancelado boolean not null default false,
  motivo_cancelacion text,
  cancelado_por uuid references public.perfiles (id) on delete set null,
  cancelado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pagos_pedido_idx on public.pagos (pedido_id);
create index pagos_cliente_idx on public.pagos (cliente_id);
create index pagos_fecha_idx on public.pagos (fecha desc);

-- ---------------------------------------------------------------------
-- Eventos (línea de tiempo) del pedido
-- ---------------------------------------------------------------------
create table public.pedido_eventos (
  id bigint generated always as identity primary key,
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  tipo text not null check (tipo in ('creado', 'estado', 'nota', 'pago', 'archivo', 'aprobacion', 'asignacion', 'factura')),
  estado_de public.estado_pedido,
  estado_a public.estado_pedido,
  mensaje text,
  usuario_id uuid default auth.uid() references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index pedido_eventos_pedido_idx on public.pedido_eventos (pedido_id, created_at desc);

-- ---------------------------------------------------------------------
-- Archivos: diseños (con versiones y aprobación), referencias y evidencias
-- ---------------------------------------------------------------------
create table public.archivos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references public.pedidos (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete cascade,
  categoria text not null default 'diseno' check (categoria in ('diseno', 'referencia', 'evidencia', 'otro')),
  nombre text not null check (length(trim(nombre)) > 0),
  path text,
  enlace_externo text,
  mime text,
  tamano bigint,
  version integer,
  estado_aprobacion public.estado_archivo not null default 'no_aplica',
  aprobado_por_nombre text,
  aprobacion_notas text,
  aprobacion_registrada_por uuid references public.perfiles (id) on delete set null,
  aprobacion_at timestamptz,
  subido_por uuid default auth.uid() references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint archivos_origen check (path is not null or enlace_externo is not null),
  constraint archivos_relacion check (pedido_id is not null or cliente_id is not null)
);

create index archivos_pedido_idx on public.archivos (pedido_id, created_at desc);
create index archivos_cliente_idx on public.archivos (cliente_id);

-- =====================================================================
-- Reglas automáticas
-- =====================================================================

-- Totales de cotizaciones y pedidos. Para pedidos también calcula pagado y estado de pago.
create or replace function public.tg_calcular_totales()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub numeric(12, 2);
  v_pagado numeric(12, 2);
  v_hubo_pagos boolean;
  v_solo_anticipos boolean;
begin
  if tg_table_name = 'cotizaciones' then
    select coalesce(sum(importe), 0) into v_sub from public.partidas where cotizacion_id = new.id;
  else
    select coalesce(sum(importe), 0) into v_sub from public.partidas where pedido_id = new.id;
  end if;

  new.subtotal := v_sub;
  new.descuento := least(v_sub, round(
    case when new.descuento_tipo = 'pct'
      then v_sub * least(new.descuento_valor, 100) / 100
      else new.descuento_valor
    end, 2));
  new.recargo := round((v_sub - new.descuento) * new.recargo_pct / 100, 2);
  new.iva := case when new.aplica_iva
    then round((v_sub - new.descuento + new.recargo) * new.iva_pct / 100, 2)
    else 0 end;
  new.total := v_sub - new.descuento + new.recargo + new.iva;

  if tg_table_name = 'pedidos' then
    select
      coalesce(sum(case when tipo = 'devolucion' then -importe else importe end), 0),
      coalesce(bool_or(tipo <> 'devolucion'), false),
      coalesce(bool_and(tipo = 'anticipo') filter (where tipo <> 'devolucion'), false)
    into v_pagado, v_hubo_pagos, v_solo_anticipos
    from public.pagos
    where pedido_id = new.id and not cancelado;

    new.pagado := v_pagado;
    new.estado_pago := case
      when v_pagado <= 0 and v_hubo_pagos then 'reembolsado'
      when v_pagado <= 0 then 'pendiente'
      when new.total > 0 and v_pagado >= new.total then 'liquidado'
      when v_solo_anticipos then 'anticipo'
      else 'parcial'
    end::public.estado_pago;
  end if;

  new.updated_at := now();
  return new;
end
$$;

create trigger cotizaciones_totales
before insert or update on public.cotizaciones
for each row execute function public.tg_calcular_totales();

create trigger pedidos_totales
before insert or update on public.pedidos
for each row execute function public.tg_calcular_totales();

-- Al cambiar partidas o pagos se "toca" el documento para recalcular sus totales.
create or replace function public.tg_partidas_tocar_documento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if old.cotizacion_id is not null then
      update public.cotizaciones set updated_at = now() where id = old.cotizacion_id;
    end if;
    if old.pedido_id is not null then
      update public.pedidos set updated_at = now() where id = old.pedido_id;
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    if new.cotizacion_id is not null
       and (tg_op = 'INSERT' or new.cotizacion_id is distinct from old.cotizacion_id) then
      update public.cotizaciones set updated_at = now() where id = new.cotizacion_id;
    end if;
    if new.pedido_id is not null
       and (tg_op = 'INSERT' or new.pedido_id is distinct from old.pedido_id) then
      update public.pedidos set updated_at = now() where id = new.pedido_id;
    end if;
  end if;
  return null;
end
$$;

create trigger partidas_tocar_documento
after insert or update or delete on public.partidas
for each row execute function public.tg_partidas_tocar_documento();

-- Costo estimado de cada partida.
-- Si la partida ya tiene costos (manuales o del catálogo) los usa por unidad;
-- si no, y viene de un producto con costos, toma los del catálogo.
create or replace function public.tg_partida_costo_estimado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pc public.partida_costos;
  v_cat public.producto_costos;
  v_unidades numeric;
begin
  v_unidades := public.unidades_cobro(new.metodo_calculo, new.cantidad, new.ancho, new.alto, new.largo);

  select * into v_pc from public.partida_costos where partida_id = new.id;

  if found then
    -- Si cambió el producto y el costo venía del catálogo, se vuelve a tomar del nuevo producto.
    if tg_op = 'UPDATE' and new.producto_id is distinct from old.producto_id
       and coalesce(v_pc.calculo ->> 'origen', 'manual') = 'catalogo' then
      delete from public.partida_costos where partida_id = new.id;
    else
      update public.partida_costos
      set costo_total = round(
            (costo_material * (1 + desperdicio_pct / 100) + costo_mano_obra) * v_unidades + costo_fijo, 2),
          calculo = calculo || jsonb_build_object('unidades', v_unidades)
      where partida_id = new.id;
      return null;
    end if;
  end if;

  if new.producto_id is null then
    return null;
  end if;

  select * into v_cat from public.producto_costos where producto_id = new.producto_id;
  if not found then
    return null;
  end if;

  insert into public.partida_costos (
    partida_id, costo_material, costo_mano_obra, costo_fijo, desperdicio_pct, ganancia_pct, costo_total, calculo
  ) values (
    new.id, v_cat.costo_material, v_cat.costo_mano_obra, v_cat.costo_fijo, v_cat.desperdicio_pct, v_cat.ganancia_pct,
    round((v_cat.costo_material * (1 + v_cat.desperdicio_pct / 100) + v_cat.costo_mano_obra) * v_unidades
          + v_cat.costo_fijo, 2),
    jsonb_build_object('origen', 'catalogo', 'unidades', v_unidades)
  )
  on conflict (partida_id) do nothing;

  return null;
end
$$;

create trigger partidas_costo_estimado
after insert or update of producto_id, metodo_calculo, cantidad, ancho, alto, largo on public.partidas
for each row execute function public.tg_partida_costo_estimado();

-- Estados de la cotización: fechas y avance de la oportunidad ligada.
create or replace function public.tg_cotizaciones_estado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.estado is distinct from old.estado then
    if new.estado = 'enviada' then
      new.enviada_at := coalesce(new.enviada_at, now());
    elsif new.estado = 'aceptada' then
      new.aceptada_at := coalesce(new.aceptada_at, now());
    end if;
    if new.estado <> 'rechazada' then
      new.motivo_rechazo := null;
    end if;
  end if;
  return new;
end
$$;

create trigger cotizaciones_estado
before insert or update of estado on public.cotizaciones
for each row execute function public.tg_cotizaciones_estado();

create or replace function public.tg_cotizaciones_oportunidad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.oportunidad_id is null then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.estado is not distinct from old.estado
     and new.oportunidad_id is not distinct from old.oportunidad_id then
    return null;
  end if;

  if new.estado = 'enviada' then
    update public.oportunidades set etapa = 'cotizacion_enviada'
    where id = new.oportunidad_id
      and etapa in ('prospecto_nuevo', 'contactado', 'interesado');
  elsif new.estado = 'aceptada' then
    update public.oportunidades set etapa = 'ganado'
    where id = new.oportunidad_id and etapa <> 'ganado';
  end if;
  return null;
end
$$;

create trigger cotizaciones_oportunidad
after insert or update of estado, oportunidad_id on public.cotizaciones
for each row execute function public.tg_cotizaciones_oportunidad();

-- Estados del pedido: validaciones, fechas y línea de tiempo.
create or replace function public.tg_pedidos_estado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.estado is not distinct from old.estado then
    return new;
  end if;

  if new.estado in ('pausado', 'cancelado') and coalesce(trim(new.motivo_estado), '') = '' then
    raise exception 'Indica el motivo para % el pedido',
      case new.estado when 'pausado' then 'pausar' else 'cancelar' end;
  end if;

  if new.estado = 'pausado' then
    if tg_op = 'UPDATE' and old.estado <> 'pausado' then
      new.estado_anterior := old.estado;
    end if;
  elsif new.estado <> 'cancelado' then
    new.motivo_estado := null;
    new.estado_anterior := null;
  end if;

  if new.estado = 'entregado' then
    new.entregado_at := coalesce(new.entregado_at, now());
  elsif new.estado = 'finalizado' then
    new.entregado_at := coalesce(new.entregado_at, now());
    new.finalizado_at := coalesce(new.finalizado_at, now());
  elsif new.estado = 'cancelado' then
    new.cancelado_at := now();
  end if;

  if tg_op = 'UPDATE' and old.estado = 'cancelado' then
    new.cancelado_at := null;
  end if;

  return new;
end
$$;

create trigger pedidos_estado
before insert or update of estado on public.pedidos
for each row execute function public.tg_pedidos_estado();

create or replace function public.tg_pedidos_eventos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text;
begin
  if tg_op = 'INSERT' then
    -- La conversión desde cotización registra su propio evento.
    if new.cotizacion_id is null then
      insert into public.pedido_eventos (pedido_id, tipo, estado_a, mensaje)
      values (new.id, 'creado', new.estado, 'Pedido creado');
    end if;
    -- Última compra del cliente (para reactivación)
    update public.clientes
    set ultima_compra_at = greatest(coalesce(ultima_compra_at, new.created_at), new.created_at)
    where id = new.cliente_id;
    return null;
  end if;

  if new.estado is distinct from old.estado then
    insert into public.pedido_eventos (pedido_id, tipo, estado_de, estado_a, mensaje)
    values (new.id, 'estado', old.estado, new.estado,
      case when new.estado in ('pausado', 'cancelado') then new.motivo_estado end);
  end if;

  if new.responsable_id is distinct from old.responsable_id and new.responsable_id is not null then
    select nombre into v_nombre from public.perfiles where id = new.responsable_id;
    insert into public.pedido_eventos (pedido_id, tipo, mensaje)
    values (new.id, 'asignacion', 'Responsable: ' || coalesce(v_nombre, 'sin nombre'));
  end if;

  if new.disenador_id is distinct from old.disenador_id and new.disenador_id is not null then
    select nombre into v_nombre from public.perfiles where id = new.disenador_id;
    insert into public.pedido_eventos (pedido_id, tipo, mensaje)
    values (new.id, 'asignacion', 'Diseño asignado a: ' || coalesce(v_nombre, 'sin nombre'));
  end if;

  if new.facturado and not old.facturado then
    insert into public.pedido_eventos (pedido_id, tipo, mensaje)
    values (new.id, 'factura', 'Marcado como facturado' ||
      coalesce(' (folio ' || nullif(trim(new.folio_factura), '') || ')', ''));
  end if;

  return null;
end
$$;

create trigger pedidos_eventos
after insert or update on public.pedidos
for each row execute function public.tg_pedidos_eventos();

-- Pagos: validaciones y protección del historial.
create or replace function public.tg_pagos_validar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos;
begin
  if tg_op = 'INSERT' then
    select * into v_pedido from public.pedidos where id = new.pedido_id;
    if not found then
      raise exception 'Pedido no encontrado';
    end if;
    if v_pedido.estado = 'cancelado' and new.tipo <> 'devolucion' then
      raise exception 'El pedido % está cancelado; solo se pueden registrar devoluciones', v_pedido.folio;
    end if;
    if new.tipo = 'devolucion' and not public.tiene_permiso('cancelar_pagos') and auth.uid() is not null then
      raise exception 'No tienes permiso para registrar devoluciones' using errcode = '42501';
    end if;
    new.cliente_id := v_pedido.cliente_id;
    new.registrado_por := coalesce(auth.uid(), new.registrado_por);
    new.cancelado := false;
    new.cancelado_por := null;
    new.cancelado_at := null;
    new.motivo_cancelacion := null;
    return new;
  end if;

  -- UPDATE
  if auth.uid() is not null and not public.es_admin() then
    if new.importe is distinct from old.importe
       or new.tipo is distinct from old.tipo
       or new.pedido_id is distinct from old.pedido_id
       or new.fecha is distinct from old.fecha
       or new.metodo is distinct from old.metodo then
      raise exception 'Solo un administrador puede modificar importe, tipo, fecha o método. Cancela el pago y regístralo de nuevo.'
        using errcode = '42501';
    end if;
  end if;

  if old.cancelado and not new.cancelado then
    raise exception 'Un pago cancelado no se puede reactivar; registra uno nuevo';
  end if;

  if new.cancelado and not old.cancelado then
    if auth.uid() is not null and not public.tiene_permiso('cancelar_pagos') then
      raise exception 'No tienes permiso para cancelar pagos' using errcode = '42501';
    end if;
    if coalesce(trim(new.motivo_cancelacion), '') = '' then
      raise exception 'Indica el motivo de la cancelación del pago';
    end if;
    new.cancelado_por := auth.uid();
    new.cancelado_at := now();
  end if;

  new.cliente_id := old.cliente_id;
  new.registrado_por := old.registrado_por;
  new.updated_at := now();
  return new;
end
$$;

create trigger pagos_validar
before insert or update on public.pagos
for each row execute function public.tg_pagos_validar();

create or replace function public.tg_pagos_actualizar_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_txt text;
begin
  update public.pedidos set updated_at = now() where id = new.pedido_id;

  if tg_op = 'INSERT' then
    v_txt := case new.tipo
      when 'anticipo' then 'Anticipo registrado'
      when 'liquidacion' then 'Liquidación registrada'
      when 'devolucion' then 'Devolución registrada'
      else 'Pago registrado' end
      || ' (' || new.metodo::text || ')';
    insert into public.pedido_eventos (pedido_id, tipo, mensaje) values (new.pedido_id, 'pago', v_txt);
  elsif new.cancelado and not old.cancelado then
    insert into public.pedido_eventos (pedido_id, tipo, mensaje)
    values (new.pedido_id, 'pago', 'Pago cancelado: ' || coalesce(new.motivo_cancelacion, ''));
  end if;
  return null;
end
$$;

create trigger pagos_actualizar_pedido
after insert or update on public.pagos
for each row execute function public.tg_pagos_actualizar_pedido();

-- Archivos: versión automática, aprobaciones y avance del pedido.
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
  end if;

  new.pedido_id := old.pedido_id;
  new.categoria := old.categoria;
  new.version := old.version;
  new.subido_por := old.subido_por;
  new.updated_at := now();
  return new;
end
$$;

create trigger archivos_antes
before insert or update on public.archivos
for each row execute function public.tg_archivos_antes();

create or replace function public.tg_archivos_despues()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado public.estado_pedido;
  v_omitidas public.estado_pedido[];
begin
  if new.pedido_id is null then
    return null;
  end if;

  select estado, etapas_omitidas into v_estado, v_omitidas from public.pedidos where id = new.pedido_id;

  if tg_op = 'INSERT' then
    insert into public.pedido_eventos (pedido_id, tipo, mensaje)
    values (new.pedido_id, 'archivo',
      case when new.categoria = 'diseno'
        then 'Diseño v' || new.version || ' subido: ' || new.nombre
        else 'Archivo agregado: ' || new.nombre end);

    -- Un diseño nuevo deja el pedido esperando aprobación.
    if new.categoria = 'diseno' and v_estado in ('nuevo', 'en_diseno')
       and not ('esperando_aprobacion' = any (v_omitidas)) then
      update public.pedidos set estado = 'esperando_aprobacion' where id = new.pedido_id;
    end if;
    return null;
  end if;

  if new.estado_aprobacion is distinct from old.estado_aprobacion then
    insert into public.pedido_eventos (pedido_id, tipo, mensaje)
    values (new.pedido_id, 'aprobacion',
      'Diseño v' || coalesce(new.version::text, '?') || ': '
      || case new.estado_aprobacion
           when 'aprobado' then 'aprobado'
           when 'cambios' then 'cambios solicitados'
           when 'rechazado' then 'rechazado'
           else 'pendiente de aprobación' end
      || coalesce(' por ' || nullif(trim(new.aprobado_por_nombre), ''), '')
      || coalesce('. ' || nullif(trim(new.aprobacion_notas), ''), ''));

    if new.estado_aprobacion = 'aprobado' and v_estado in ('nuevo', 'en_diseno', 'esperando_aprobacion')
       and not ('aprobado' = any (v_omitidas)) then
      update public.pedidos set estado = 'aprobado' where id = new.pedido_id;
    elsif new.estado_aprobacion in ('cambios', 'rechazado') and v_estado in ('esperando_aprobacion', 'aprobado')
       and not ('en_diseno' = any (v_omitidas)) then
      update public.pedidos set estado = 'en_diseno' where id = new.pedido_id;
    end if;
  end if;
  return null;
end
$$;

create trigger archivos_despues
after insert or update on public.archivos
for each row execute function public.tg_archivos_despues();

-- =====================================================================
-- Funciones de negocio (RPC)
-- =====================================================================

-- Cambia la etapa de un pedido. Diseño y producción la usan sin poder editar el pedido.
create or replace function public.cambiar_estado_pedido(
  p_pedido uuid,
  p_estado public.estado_pedido,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actual public.estado_pedido;
begin
  if not (public.tiene_permiso('actualizar_produccion') or public.tiene_permiso('gestionar_pedidos')) then
    raise exception 'No tienes permiso para cambiar la etapa del pedido' using errcode = '42501';
  end if;

  select estado into v_actual from public.pedidos where id = p_pedido for update;
  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  if (p_estado = 'cancelado' or v_actual in ('cancelado', 'finalizado'))
     and not public.tiene_permiso('gestionar_pedidos') then
    raise exception 'Solo ventas o administración pueden cancelar o reabrir pedidos' using errcode = '42501';
  end if;

  update public.pedidos
  set estado = p_estado,
      motivo_estado = case when p_estado in ('pausado', 'cancelado') then nullif(trim(p_motivo), '') else null end
  where id = p_pedido;
end
$$;

-- Nota en la línea de tiempo del pedido (cualquier usuario activo).
create or replace function public.agregar_nota_pedido(p_pedido uuid, p_mensaje text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if not public.usuario_activo() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if coalesce(trim(p_mensaje), '') = '' then
    raise exception 'Escribe la nota';
  end if;
  if not exists (select 1 from public.pedidos where id = p_pedido) then
    raise exception 'Pedido no encontrado';
  end if;
  insert into public.pedido_eventos (pedido_id, tipo, mensaje)
  values (p_pedido, 'nota', trim(p_mensaje))
  returning id into v_id;
  return v_id;
end
$$;

-- Copia partidas (con sus costos) de un documento a otro.
create or replace function public.copiar_partidas(
  p_origen_cotizacion uuid,
  p_origen_pedido uuid,
  p_destino_cotizacion uuid,
  p_destino_pedido uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.partidas;
  v_nueva uuid;
begin
  for r in
    select * from public.partidas
    where (p_origen_cotizacion is not null and cotizacion_id = p_origen_cotizacion)
       or (p_origen_pedido is not null and pedido_id = p_origen_pedido)
    order by orden, created_at
  loop
    insert into public.partidas (
      cotizacion_id, pedido_id, orden, tipo, producto_id, concepto, descripcion, metodo_calculo, unidad,
      ancho, alto, largo, cantidad, precio_unitario, descuento_pct, notas_produccion
    ) values (
      p_destino_cotizacion, p_destino_pedido, r.orden, r.tipo, r.producto_id, r.concepto, r.descripcion,
      r.metodo_calculo, r.unidad, r.ancho, r.alto, r.largo, r.cantidad, r.precio_unitario, r.descuento_pct,
      r.notas_produccion
    )
    returning id into v_nueva;

    insert into public.partida_costos (
      partida_id, costo_material, costo_mano_obra, costo_fijo, desperdicio_pct, ganancia_pct, costo_total, calculo
    )
    select v_nueva, pc.costo_material, pc.costo_mano_obra, pc.costo_fijo, pc.desperdicio_pct, pc.ganancia_pct,
           pc.costo_total, pc.calculo
    from public.partida_costos pc
    where pc.partida_id = r.id
    on conflict (partida_id) do update set
      costo_material = excluded.costo_material,
      costo_mano_obra = excluded.costo_mano_obra,
      costo_fijo = excluded.costo_fijo,
      desperdicio_pct = excluded.desperdicio_pct,
      ganancia_pct = excluded.ganancia_pct,
      costo_total = excluded.costo_total,
      calculo = excluded.calculo;
  end loop;
end
$$;

revoke execute on function public.copiar_partidas(uuid, uuid, uuid, uuid) from public, anon, authenticated;

-- Convierte una cotización en pedido sin volver a capturar la información.
create or replace function public.convertir_cotizacion_a_pedido(
  p_cotizacion uuid,
  p_fecha_entrega date default null,
  p_responsable uuid default null,
  p_titulo text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.cotizaciones;
  v_pedido uuid;
  v_omitidas public.estado_pedido[] := '{}';
  v_diseno boolean;
  v_produccion boolean;
  v_instalacion boolean;
  v_requiere_factura boolean;
begin
  if not public.tiene_permiso('gestionar_pedidos') then
    raise exception 'No tienes permiso para crear pedidos' using errcode = '42501';
  end if;

  select * into c from public.cotizaciones where id = p_cotizacion for update;
  if not found then
    raise exception 'Cotización no encontrada';
  end if;
  if c.pedido_id is not null then
    raise exception 'Esta cotización ya se convirtió en el pedido %',
      (select folio from public.pedidos where id = c.pedido_id);
  end if;
  if c.estado in ('rechazada', 'cancelada') then
    raise exception 'No se puede convertir una cotización rechazada o cancelada';
  end if;
  if not exists (select 1 from public.partidas where cotizacion_id = c.id) then
    raise exception 'La cotización no tiene conceptos';
  end if;

  select
    coalesce(bool_or(case when pa.tipo = 'diseno' then true
                          when pa.tipo in ('instalacion', 'transporte') then false
                          else coalesce(pr.requiere_diseno, true) end), false),
    coalesce(bool_or(case when pa.tipo in ('instalacion', 'transporte', 'diseno') then false
                          else coalesce(pr.requiere_produccion, true) end), false),
    coalesce(bool_or(pa.tipo = 'instalacion' or coalesce(pr.requiere_instalacion, false)), false)
  into v_diseno, v_produccion, v_instalacion
  from public.partidas pa
  left join public.productos pr on pr.id = pa.producto_id
  where pa.cotizacion_id = c.id;

  if not v_diseno then
    v_omitidas := v_omitidas || array['en_diseno', 'esperando_aprobacion', 'aprobado']::public.estado_pedido[];
  end if;
  if not v_produccion then
    v_omitidas := v_omitidas || array['en_produccion', 'acabados']::public.estado_pedido[];
  end if;
  if not v_instalacion then
    v_omitidas := v_omitidas || array['en_instalacion']::public.estado_pedido[];
  end if;

  select requiere_factura into v_requiere_factura from public.clientes where id = c.cliente_id;

  insert into public.pedidos (
    cotizacion_id, cliente_id, contacto_id, vendedor_id, responsable_id, titulo, descripcion,
    etapas_omitidas, fecha_entrega, requiere_instalacion,
    anticipo_pct, aplica_iva, iva_pct, descuento_tipo, descuento_valor, recargo_pct, recargo_concepto,
    condiciones, fecha_limite_pago, requiere_factura, notas_internas
  ) values (
    c.id, c.cliente_id, c.contacto_id, coalesce(c.vendedor_id, auth.uid()), p_responsable,
    coalesce(nullif(trim(p_titulo), ''), nullif(trim(c.titulo), ''), 'Pedido de cotización ' || c.folio),
    c.notas, v_omitidas, p_fecha_entrega, v_instalacion,
    c.anticipo_pct, c.aplica_iva, c.iva_pct, c.descuento_tipo, c.descuento_valor, c.recargo_pct, c.recargo_concepto,
    c.condiciones, p_fecha_entrega, coalesce(v_requiere_factura, false), c.notas_internas
  )
  returning id into v_pedido;

  perform public.copiar_partidas(c.id, null, null, v_pedido);

  -- Recalcula totales con las partidas copiadas
  update public.pedidos set updated_at = now() where id = v_pedido;

  update public.cotizaciones
  set estado = 'aceptada', pedido_id = v_pedido
  where id = c.id;

  insert into public.pedido_eventos (pedido_id, tipo, estado_a, mensaje)
  values (v_pedido, 'creado', 'nuevo', 'Pedido creado desde la cotización ' || c.folio);

  return v_pedido;
end
$$;

-- Duplica una cotización como borrador nuevo.
create or replace function public.duplicar_cotizacion(p_cotizacion uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.cotizaciones;
  v_nueva uuid;
  v_vigencia integer;
begin
  if not public.tiene_permiso('gestionar_cotizaciones') then
    raise exception 'No tienes permiso para crear cotizaciones' using errcode = '42501';
  end if;

  select * into c from public.cotizaciones where id = p_cotizacion;
  if not found then
    raise exception 'Cotización no encontrada';
  end if;

  select vigencia_dias into v_vigencia from public.configuracion where id = 1;

  insert into public.cotizaciones (
    cliente_id, contacto_id, oportunidad_id, vendedor_id, titulo, vigencia_dias, tiempo_entrega,
    anticipo_pct, aplica_iva, iva_pct, descuento_tipo, descuento_valor, recargo_pct, recargo_concepto,
    condiciones, notas, notas_internas
  ) values (
    c.cliente_id, c.contacto_id, null, auth.uid(),
    case when c.titulo is null then null else c.titulo || ' (copia)' end,
    coalesce(c.vigencia_dias, v_vigencia, 15), c.tiempo_entrega,
    c.anticipo_pct, c.aplica_iva, c.iva_pct, c.descuento_tipo, c.descuento_valor, c.recargo_pct, c.recargo_concepto,
    c.condiciones, c.notas, c.notas_internas
  )
  returning id into v_nueva;

  perform public.copiar_partidas(c.id, null, v_nueva, null);
  update public.cotizaciones set updated_at = now() where id = v_nueva;

  return v_nueva;
end
$$;

-- >>> 20261013000500_seguridad.sql
-- =====================================================================
-- 05 · Seguridad: permisos de acceso (Row Level Security) por rol
--
-- Reglas generales:
--   * Ningún dato es accesible sin sesión (rol "anon" sin permisos).
--   * Un usuario desactivado no puede leer ni escribir nada.
--   * Precios, pagos y totales: permiso "ver_precios".
--   * Costos y utilidades: permiso "ver_costos".
--   * Diseño y producción consultan pedidos a través de vistas sin montos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Privilegios base: todo cerrado para anon; authenticated depende de RLS
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- Funciones internas que no deben llamarse desde la API
revoke execute on function public.copiar_partidas(uuid, uuid, uuid, uuid) from authenticated;

-- Tablas que solo se modifican por reglas automáticas
revoke insert, update, delete on public.pedido_eventos from authenticated;
revoke insert, delete on public.perfiles from authenticated;
revoke insert, delete on public.configuracion from authenticated;
revoke insert, delete on public.folios from authenticated;

-- ---------------------------------------------------------------------
-- Activar RLS
-- ---------------------------------------------------------------------
alter table public.perfiles enable row level security;
alter table public.configuracion enable row level security;
alter table public.folios enable row level security;
alter table public.clientes enable row level security;
alter table public.contactos enable row level security;
alter table public.oportunidades enable row level security;
alter table public.actividades enable row level security;
alter table public.categorias enable row level security;
alter table public.productos enable row level security;
alter table public.producto_costos enable row level security;
alter table public.cotizaciones enable row level security;
alter table public.pedidos enable row level security;
alter table public.partidas enable row level security;
alter table public.partida_costos enable row level security;
alter table public.pagos enable row level security;
alter table public.pedido_eventos enable row level security;
alter table public.archivos enable row level security;

-- ---------------------------------------------------------------------
-- Perfiles
-- ---------------------------------------------------------------------
create policy "perfiles: ver" on public.perfiles
  for select to authenticated
  using ((select public.usuario_activo()) or id = (select auth.uid()));

create policy "perfiles: editar propio o admin" on public.perfiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.es_admin()))
  with check (id = (select auth.uid()) or (select public.es_admin()));

-- ---------------------------------------------------------------------
-- Configuración y folios
-- ---------------------------------------------------------------------
create policy "configuracion: ver" on public.configuracion
  for select to authenticated
  using ((select public.usuario_activo()));

create policy "configuracion: editar admin" on public.configuracion
  for update to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

create policy "folios: ver admin" on public.folios
  for select to authenticated
  using ((select public.es_admin()));

create policy "folios: editar admin" on public.folios
  for update to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

-- ---------------------------------------------------------------------
-- Clientes y contactos (lectura para todo el equipo activo)
-- ---------------------------------------------------------------------
create policy "clientes: ver" on public.clientes
  for select to authenticated
  using ((select public.usuario_activo()));

create policy "clientes: crear" on public.clientes
  for insert to authenticated
  with check ((select public.tiene_permiso('gestionar_clientes')));

create policy "clientes: editar" on public.clientes
  for update to authenticated
  using ((select public.tiene_permiso('gestionar_clientes')))
  with check ((select public.tiene_permiso('gestionar_clientes')));

create policy "clientes: eliminar" on public.clientes
  for delete to authenticated
  using ((select public.tiene_permiso('eliminar_registros')));

create policy "contactos: ver" on public.contactos
  for select to authenticated
  using ((select public.usuario_activo()));

create policy "contactos: crear" on public.contactos
  for insert to authenticated
  with check ((select public.tiene_permiso('gestionar_clientes')));

create policy "contactos: editar" on public.contactos
  for update to authenticated
  using ((select public.tiene_permiso('gestionar_clientes')))
  with check ((select public.tiene_permiso('gestionar_clientes')));

create policy "contactos: eliminar" on public.contactos
  for delete to authenticated
  using ((select public.tiene_permiso('gestionar_clientes')));

-- ---------------------------------------------------------------------
-- Oportunidades y actividades (equipo comercial)
-- ---------------------------------------------------------------------
create policy "oportunidades: ver" on public.oportunidades
  for select to authenticated
  using ((select public.tiene_permiso('gestionar_clientes')));

create policy "oportunidades: crear" on public.oportunidades
  for insert to authenticated
  with check ((select public.tiene_permiso('gestionar_clientes')));

create policy "oportunidades: editar" on public.oportunidades
  for update to authenticated
  using ((select public.tiene_permiso('gestionar_clientes')))
  with check ((select public.tiene_permiso('gestionar_clientes')));

create policy "oportunidades: eliminar" on public.oportunidades
  for delete to authenticated
  using ((select public.tiene_permiso('eliminar_registros')));

create policy "actividades: ver" on public.actividades
  for select to authenticated
  using ((select public.tiene_permiso('gestionar_clientes')));

create policy "actividades: crear" on public.actividades
  for insert to authenticated
  with check ((select public.tiene_permiso('gestionar_clientes')) and usuario_id = (select auth.uid()));

create policy "actividades: editar propias" on public.actividades
  for update to authenticated
  using (usuario_id = (select auth.uid()) or (select public.es_admin()))
  with check (usuario_id = (select auth.uid()) or (select public.es_admin()));

create policy "actividades: eliminar propias" on public.actividades
  for delete to authenticated
  using (usuario_id = (select auth.uid()) or (select public.es_admin()));

-- ---------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------
create policy "categorias: ver" on public.categorias
  for select to authenticated
  using ((select public.usuario_activo()));

create policy "categorias: administrar" on public.categorias
  for all to authenticated
  using ((select public.tiene_permiso('editar_catalogo')))
  with check ((select public.tiene_permiso('editar_catalogo')));

create policy "productos: ver" on public.productos
  for select to authenticated
  using ((select public.usuario_activo()));

create policy "productos: administrar" on public.productos
  for all to authenticated
  using ((select public.tiene_permiso('editar_catalogo')))
  with check ((select public.tiene_permiso('editar_catalogo')));

create policy "producto_costos: ver" on public.producto_costos
  for select to authenticated
  using ((select public.tiene_permiso('ver_costos')));

create policy "producto_costos: administrar" on public.producto_costos
  for all to authenticated
  using ((select public.tiene_permiso('ver_costos')) and (select public.tiene_permiso('editar_catalogo')))
  with check ((select public.tiene_permiso('ver_costos')) and (select public.tiene_permiso('editar_catalogo')));

-- ---------------------------------------------------------------------
-- Cotizaciones
-- ---------------------------------------------------------------------
create policy "cotizaciones: ver" on public.cotizaciones
  for select to authenticated
  using ((select public.tiene_permiso('ver_precios')));

create policy "cotizaciones: crear" on public.cotizaciones
  for insert to authenticated
  with check ((select public.tiene_permiso('gestionar_cotizaciones')));

create policy "cotizaciones: editar" on public.cotizaciones
  for update to authenticated
  using ((select public.tiene_permiso('gestionar_cotizaciones')))
  with check ((select public.tiene_permiso('gestionar_cotizaciones')));

create policy "cotizaciones: eliminar" on public.cotizaciones
  for delete to authenticated
  using (
    pedido_id is null and (
      (select public.tiene_permiso('eliminar_registros'))
      or ((select public.tiene_permiso('gestionar_cotizaciones')) and estado = 'borrador')
    )
  );

-- ---------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------
create policy "pedidos: ver" on public.pedidos
  for select to authenticated
  using ((select public.tiene_permiso('ver_precios')));

create policy "pedidos: crear" on public.pedidos
  for insert to authenticated
  with check ((select public.tiene_permiso('gestionar_pedidos')));

create policy "pedidos: editar" on public.pedidos
  for update to authenticated
  using ((select public.tiene_permiso('gestionar_pedidos')))
  with check ((select public.tiene_permiso('gestionar_pedidos')));

create policy "pedidos: eliminar" on public.pedidos
  for delete to authenticated
  using (
    (select public.tiene_permiso('eliminar_registros'))
    and not exists (select 1 from public.pagos pg where pg.pedido_id = pedidos.id)
  );

-- ---------------------------------------------------------------------
-- Partidas y costos
-- ---------------------------------------------------------------------
create policy "partidas: ver" on public.partidas
  for select to authenticated
  using ((select public.tiene_permiso('ver_precios')));

create policy "partidas: crear" on public.partidas
  for insert to authenticated
  with check (
    (cotizacion_id is not null and (select public.tiene_permiso('gestionar_cotizaciones')))
    or (pedido_id is not null and (select public.tiene_permiso('gestionar_pedidos')))
  );

create policy "partidas: editar" on public.partidas
  for update to authenticated
  using (
    (cotizacion_id is not null and (select public.tiene_permiso('gestionar_cotizaciones')))
    or (pedido_id is not null and (select public.tiene_permiso('gestionar_pedidos')))
  )
  with check (
    (cotizacion_id is not null and (select public.tiene_permiso('gestionar_cotizaciones')))
    or (pedido_id is not null and (select public.tiene_permiso('gestionar_pedidos')))
  );

create policy "partidas: eliminar" on public.partidas
  for delete to authenticated
  using (
    (cotizacion_id is not null and (select public.tiene_permiso('gestionar_cotizaciones')))
    or (pedido_id is not null and (select public.tiene_permiso('gestionar_pedidos')))
  );

create policy "partida_costos: ver" on public.partida_costos
  for select to authenticated
  using ((select public.tiene_permiso('ver_costos')));

create policy "partida_costos: administrar" on public.partida_costos
  for all to authenticated
  using ((select public.tiene_permiso('ver_costos')))
  with check ((select public.tiene_permiso('ver_costos')));

-- ---------------------------------------------------------------------
-- Pagos (no se eliminan: se cancelan con motivo)
-- ---------------------------------------------------------------------
create policy "pagos: ver" on public.pagos
  for select to authenticated
  using ((select public.tiene_permiso('ver_precios')));

create policy "pagos: registrar" on public.pagos
  for insert to authenticated
  with check ((select public.tiene_permiso('registrar_pagos')));

create policy "pagos: editar o cancelar" on public.pagos
  for update to authenticated
  using ((select public.tiene_permiso('registrar_pagos')) or (select public.tiene_permiso('cancelar_pagos')))
  with check ((select public.tiene_permiso('registrar_pagos')) or (select public.tiene_permiso('cancelar_pagos')));

revoke delete on public.pagos from authenticated;

-- ---------------------------------------------------------------------
-- Eventos de pedido (lectura; se escriben con reglas y funciones)
-- ---------------------------------------------------------------------
create policy "pedido_eventos: ver" on public.pedido_eventos
  for select to authenticated
  using ((select public.usuario_activo()));

-- ---------------------------------------------------------------------
-- Archivos
-- ---------------------------------------------------------------------
create policy "archivos: ver" on public.archivos
  for select to authenticated
  using ((select public.usuario_activo()));

create policy "archivos: subir" on public.archivos
  for insert to authenticated
  with check (
    (select public.tiene_permiso('actualizar_produccion'))
    or (select public.tiene_permiso('gestionar_pedidos'))
    or (select public.tiene_permiso('gestionar_clientes'))
  );

create policy "archivos: editar" on public.archivos
  for update to authenticated
  using (
    (select public.tiene_permiso('aprobar_disenos'))
    or (select public.tiene_permiso('actualizar_produccion'))
    or subido_por = (select auth.uid())
  )
  with check (
    (select public.tiene_permiso('aprobar_disenos'))
    or (select public.tiene_permiso('actualizar_produccion'))
    or subido_por = (select auth.uid())
  );

create policy "archivos: eliminar" on public.archivos
  for delete to authenticated
  using (
    (subido_por = (select auth.uid()) and estado_aprobacion <> 'aprobado')
    or (select public.es_admin())
  );

-- >>> 20261013000600_bitacora_plantillas.sql
-- =====================================================================
-- 06 · Bitácora de cambios y plantillas de mensajes de WhatsApp
-- =====================================================================

create table public.bitacora (
  id bigint generated always as identity primary key,
  tabla text not null,
  registro_id text,
  accion text not null check (accion in ('crear', 'modificar', 'eliminar', 'cambio_estado', 'aprobar', 'cancelar')),
  etiqueta text,
  -- Para modificaciones: {"campo": [antes, después]}
  cambios jsonb,
  -- Para altas y bajas: copia del registro
  datos jsonb,
  usuario_id uuid references public.perfiles (id) on delete set null,
  usuario_nombre text,
  created_at timestamptz not null default now()
);

comment on table public.bitacora is 'Registro de quién creó, modificó, aprobó, canceló o eliminó información.';

create index bitacora_fecha_idx on public.bitacora (created_at desc);
create index bitacora_registro_idx on public.bitacora (tabla, registro_id);
create index bitacora_usuario_idx on public.bitacora (usuario_id, created_at desc);

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
    'aprobacion_at', 'aprobacion_registrada_por', 'cancelado_por'
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
  end if;

  v_id := coalesce(v_reg ->> 'id', v_reg ->> 'partida_id', v_reg ->> 'producto_id', v_reg ->> 'tipo');

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
    coalesce(v_nombre, case when auth.uid() is null then 'Sistema' end)
  );

  return null;
end
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'perfiles', 'configuracion', 'folios', 'clientes', 'contactos', 'oportunidades', 'categorias',
    'productos', 'producto_costos', 'cotizaciones', 'pedidos', 'partidas', 'partida_costos', 'pagos', 'archivos'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.tg_bitacora()',
      t || '_bitacora', t
    );
  end loop;
end
$$;

alter table public.bitacora enable row level security;

revoke all on public.bitacora from anon;
grant select on public.bitacora to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy "bitacora: ver admin" on public.bitacora
  for select to authenticated
  using ((select public.es_admin()));

-- ---------------------------------------------------------------------
-- Plantillas de mensajes de WhatsApp
-- Variables disponibles: {cliente} {contacto} {folio} {titulo} {total} {saldo} {monto}
-- {anticipo} {vigencia} {fecha_entrega} {enlace} {empresa} {vendedor}
-- ---------------------------------------------------------------------
create table public.plantillas_mensaje (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  nombre text not null,
  contexto text not null default 'general' check (contexto in ('general', 'cliente', 'cotizacion', 'pedido', 'pago')),
  texto text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger plantillas_mensaje_updated_at
before update on public.plantillas_mensaje
for each row execute function public.tg_updated_at();

create trigger plantillas_mensaje_bitacora
after insert or update or delete on public.plantillas_mensaje
for each row execute function public.tg_bitacora();

alter table public.plantillas_mensaje enable row level security;

revoke all on public.plantillas_mensaje from anon;
grant select, insert, update, delete on public.plantillas_mensaje to authenticated;

create policy "plantillas: ver" on public.plantillas_mensaje
  for select to authenticated
  using ((select public.usuario_activo()));

create policy "plantillas: administrar" on public.plantillas_mensaje
  for all to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

insert into public.plantillas_mensaje (clave, nombre, contexto, orden, texto) values
  ('saludo', 'Saludo', 'cliente', 10,
   E'Hola {cliente} 👋, te saluda {vendedor} de {empresa}. ¿En qué te podemos ayudar?'),
  ('cotizacion_envio', 'Envío de cotización', 'cotizacion', 20,
   E'Hola {cliente} 👋, te compartimos la cotización *{folio}* por *{total}*.\n\n{enlace}\n\nVigencia: {vigencia}. Anticipo para iniciar: {anticipo}.\nQuedamos atentos a tus comentarios. ¡Gracias por considerar a {empresa}!'),
  ('cotizacion_seguimiento', 'Seguimiento de cotización', 'cotizacion', 30,
   E'Hola {cliente}, ¿pudiste revisar la cotización *{folio}*? Con gusto resolvemos tus dudas o hacemos ajustes. La cotización es válida hasta el {vigencia}.'),
  ('anticipo_recibido', 'Anticipo recibido', 'pago', 40,
   E'Hola {cliente}, confirmamos la recepción de tu anticipo de *{monto}* para el pedido *{folio}*. ✅\nSaldo pendiente: {saldo}.\n¡Comenzamos con tu proyecto!'),
  ('pago_recibido', 'Pago recibido', 'pago', 50,
   E'Hola {cliente}, recibimos tu pago de *{monto}* para el pedido *{folio}*. ✅\nSaldo pendiente: {saldo}.\n¡Gracias!'),
  ('diseno_revision', 'Diseño para aprobación', 'pedido', 60,
   E'Hola {cliente}, te compartimos la propuesta de diseño de tu pedido *{folio}*. Por favor revísala y confírmanos tu aprobación para pasar a producción. Cualquier cambio posterior a la aprobación puede generar costos adicionales.'),
  ('pedido_listo', 'Pedido listo', 'pedido', 70,
   E'Hola {cliente}, ¡tu pedido *{folio}* está listo! 🎉\nSaldo pendiente: {saldo}.\n¿Cuándo te gustaría recogerlo o coordinar la entrega/instalación?'),
  ('instalacion_programada', 'Instalación programada', 'pedido', 80,
   E'Hola {cliente}, te confirmamos la instalación de tu pedido *{folio}* para el {fecha_entrega}. Te avisaremos cuando vayamos en camino.'),
  ('recordatorio_pago', 'Recordatorio de pago', 'pago', 90,
   E'Hola {cliente}, te recordamos amablemente que el pedido *{folio}* tiene un saldo pendiente de *{saldo}*. Si ya realizaste el pago, por favor envíanos tu comprobante. ¡Gracias!'),
  ('agradecimiento', 'Agradecimiento', 'pedido', 100,
   E'Hola {cliente}, ¡gracias por confiar en {empresa}! Esperamos que tu pedido *{folio}* haya quedado como lo imaginaste. Nos encantaría ver tu opinión o una foto en nuestras redes 💛'),
  ('reactivacion', 'Volver a contactar', 'cliente', 110,
   E'Hola {cliente}, ¡hace tiempo que no sabemos de ti! En {empresa} tenemos nuevas opciones en impresión, publicidad y servicios digitales. ¿Tienes algún proyecto en mente?');

-- >>> 20261013000700_almacenamiento.sql
-- =====================================================================
-- 07 · Almacenamiento de archivos (Supabase Storage)
--
--   marca         público  · logo de la empresa para el CRM y los PDF
--   archivos      privado  · diseños, referencias y evidencias de pedidos
--                           ruta: pedidos/{pedido_id}/... o clientes/{cliente_id}/...
--   comprobantes  privado  · comprobantes de pago   ruta: pagos/{pedido_id}/...
--   documentos    privado  · PDF de cotizaciones compartidos por enlace temporal
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('marca', 'marca', true, 2097152,
    array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('archivos', 'archivos', false, 26214400, null),
  ('comprobantes', 'comprobantes', false, 10485760,
    array['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']),
  ('documentos', 'documentos', false, 10485760,
    array['application/pdf'])
on conflict (id) do nothing;

-- Marca: lectura pública por URL; solo administradores la modifican
create policy "marca: ver" on storage.objects
  for select to authenticated
  using (bucket_id = 'marca');

create policy "marca: subir admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'marca' and (select public.es_admin()));

create policy "marca: editar admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'marca' and (select public.es_admin()))
  with check (bucket_id = 'marca' and (select public.es_admin()));

create policy "marca: eliminar admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'marca' and (select public.es_admin()));

-- Archivos de pedidos y clientes
create policy "archivos: ver" on storage.objects
  for select to authenticated
  using (bucket_id = 'archivos' and (select public.usuario_activo()));

create policy "archivos: subir" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'archivos'
    and (storage.foldername(name))[1] in ('pedidos', 'clientes')
    and (
      (select public.tiene_permiso('actualizar_produccion'))
      or (select public.tiene_permiso('gestionar_pedidos'))
      or (select public.tiene_permiso('gestionar_clientes'))
    )
  );

create policy "archivos: eliminar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'archivos'
    and (owner_id = (select auth.uid())::text or (select public.es_admin()))
  );

-- Comprobantes de pago
create policy "comprobantes: ver" on storage.objects
  for select to authenticated
  using (bucket_id = 'comprobantes' and (select public.tiene_permiso('ver_precios')));

create policy "comprobantes: subir" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = 'pagos'
    and (select public.tiene_permiso('registrar_pagos'))
  );

create policy "comprobantes: eliminar admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'comprobantes' and (select public.es_admin()));

-- PDF de cotizaciones para compartir
create policy "documentos: ver" on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos' and (select public.tiene_permiso('ver_precios')));

create policy "documentos: subir" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] in ('cotizaciones', 'pedidos')
    and (select public.tiene_permiso('gestionar_cotizaciones'))
  );

create policy "documentos: reemplazar" on storage.objects
  for update to authenticated
  using (bucket_id = 'documentos' and (select public.tiene_permiso('gestionar_cotizaciones')))
  with check (bucket_id = 'documentos' and (select public.tiene_permiso('gestionar_cotizaciones')));

create policy "documentos: eliminar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documentos' and (select public.tiene_permiso('gestionar_cotizaciones')));

-- >>> 20261013000800_vistas_reportes.sql
-- =====================================================================
-- 08 · Vistas y funciones de consulta
--   ordenes_trabajo   pedidos para todo el equipo (montos solo con "ver_precios")
--   orden_partidas    conceptos de pedidos (precios solo con "ver_precios")
--   dashboard_resumen métricas del panel de control según permisos
--   resumen_cliente   totales de un cliente
--   busqueda_global   búsqueda rápida de clientes, cotizaciones y pedidos
-- =====================================================================

-- Las vistas se ejecutan con permisos del propietario y filtran por usuario activo;
-- los montos se ocultan cuando el usuario no tiene "ver_precios".
create view public.ordenes_trabajo
with (security_invoker = false)
as
select
  p.id,
  p.folio,
  p.cotizacion_id,
  p.cliente_id,
  c.nombre as cliente_nombre,
  coalesce(c.whatsapp, c.telefono) as cliente_whatsapp,
  p.contacto_id,
  p.vendedor_id,
  p.responsable_id,
  p.disenador_id,
  p.titulo,
  p.descripcion,
  p.estado,
  p.estado_anterior,
  p.motivo_estado,
  p.etapas_omitidas,
  p.prioridad,
  p.fecha_entrega,
  p.requiere_instalacion,
  p.direccion_instalacion,
  p.requiere_factura,
  p.facturado,
  p.estado_pago,
  (p.pagado > 0) as anticipo_recibido,
  (p.fecha_entrega is not null and p.fecha_entrega < current_date
    and p.estado not in ('entregado', 'finalizado', 'cancelado')) as atrasado,
  case when (select public.tiene_permiso('ver_precios')) then p.total end as total,
  case when (select public.tiene_permiso('ver_precios')) then p.pagado end as pagado,
  case when (select public.tiene_permiso('ver_precios')) then p.saldo end as saldo,
  (select count(*) from public.partidas pa where pa.pedido_id = p.id)::integer as num_partidas,
  (select count(*) from public.archivos a where a.pedido_id = p.id and a.categoria = 'diseno')::integer as num_disenos,
  p.entregado_at,
  p.finalizado_at,
  p.created_at,
  p.updated_at
from public.pedidos p
join public.clientes c on c.id = p.cliente_id
where (select public.usuario_activo());

comment on view public.ordenes_trabajo is 'Pedidos para todo el equipo. Los montos son nulos sin el permiso ver_precios.';

create view public.orden_partidas
with (security_invoker = false)
as
select
  pa.id,
  pa.pedido_id,
  pa.orden,
  pa.tipo,
  pa.producto_id,
  pa.concepto,
  pa.descripcion,
  pa.metodo_calculo,
  pa.unidad,
  pa.ancho,
  pa.alto,
  pa.largo,
  pa.cantidad,
  pa.notas_produccion,
  case when (select public.tiene_permiso('ver_precios')) then pa.precio_unitario end as precio_unitario,
  case when (select public.tiene_permiso('ver_precios')) then pa.descuento_pct end as descuento_pct,
  case when (select public.tiene_permiso('ver_precios')) then pa.importe end as importe
from public.partidas pa
where pa.pedido_id is not null
  and (select public.usuario_activo());

revoke all on public.ordenes_trabajo, public.orden_partidas from anon;
grant select on public.ordenes_trabajo, public.orden_partidas to authenticated;

-- Notas de producción por partida (diseño/producción pueden actualizarlas)
create or replace function public.actualizar_notas_partida(p_partida uuid, p_notas text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.tiene_permiso('actualizar_produccion') or public.tiene_permiso('gestionar_pedidos')) then
    raise exception 'No tienes permiso para editar notas de producción' using errcode = '42501';
  end if;
  update public.partidas set notas_produccion = nullif(trim(p_notas), '')
  where id = p_partida and pedido_id is not null;
  if not found then
    raise exception 'Concepto no encontrado';
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- Panel de control
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

  return r;
end
$$;

-- ---------------------------------------------------------------------
-- Resumen de un cliente
-- ---------------------------------------------------------------------
create or replace function public.resumen_cliente(p_cliente uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r jsonb;
begin
  if not public.usuario_activo() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  r := jsonb_build_object(
    'pedidos', (select count(*) from public.pedidos where cliente_id = p_cliente and estado <> 'cancelado'),
    'pedidos_activos', (select count(*) from public.pedidos
                        where cliente_id = p_cliente and estado not in ('entregado', 'finalizado', 'cancelado')),
    'cotizaciones', (select count(*) from public.cotizaciones where cliente_id = p_cliente),
    'ultima_compra', (select max(created_at) from public.pedidos where cliente_id = p_cliente and estado <> 'cancelado')
  );

  if public.tiene_permiso('ver_precios') then
    r := r || jsonb_build_object(
      'total_comprado', (select coalesce(sum(total), 0) from public.pedidos
                         where cliente_id = p_cliente and estado <> 'cancelado'),
      'total_pagado', (select coalesce(sum(pagado), 0) from public.pedidos
                       where cliente_id = p_cliente and estado <> 'cancelado'),
      'saldo', (select coalesce(sum(saldo), 0) from public.pedidos
                where cliente_id = p_cliente and estado <> 'cancelado' and saldo > 0),
      'cotizado_abierto', (select coalesce(sum(total), 0) from public.cotizaciones
                           where cliente_id = p_cliente and estado in ('borrador', 'enviada')
                             and fecha_vencimiento >= current_date)
    );
  end if;

  return r;
end
$$;

-- ---------------------------------------------------------------------
-- Búsqueda global (barra de búsqueda / Ctrl+K)
-- ---------------------------------------------------------------------
create or replace function public.busqueda_global(p_texto text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := '%' || public.normalizar(trim(coalesce(p_texto, ''))) || '%';
  v_folio text := '%' || upper(trim(coalesce(p_texto, ''))) || '%';
  r jsonb;
begin
  if not public.usuario_activo() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_texto, ''))) < 2 then
    return jsonb_build_object('clientes', '[]'::jsonb, 'cotizaciones', '[]'::jsonb, 'pedidos', '[]'::jsonb);
  end if;

  r := jsonb_build_object(
    'clientes', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
      from (
        select id, nombre, coalesce(whatsapp, telefono) as telefono, email
        from public.clientes
        where busqueda like v_q
        order by activo desc, nombre
        limit 6
      ) x
    ),
    'pedidos', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
      from (
        select p.id, p.folio, p.titulo, p.estado, c.nombre as cliente
        from public.pedidos p join public.clientes c on c.id = p.cliente_id
        where upper(p.folio) like v_folio
           or public.normalizar(p.titulo) like v_q
           or c.busqueda like v_q
        order by p.created_at desc
        limit 6
      ) x
    ),
    'cotizaciones', case when public.tiene_permiso('ver_precios') then (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
      from (
        select q.id, q.folio, q.titulo, q.estado, q.total, c.nombre as cliente
        from public.cotizaciones q join public.clientes c on c.id = q.cliente_id
        where upper(q.folio) like v_folio
           or public.normalizar(coalesce(q.titulo, '')) like v_q
           or c.busqueda like v_q
        order by q.created_at desc
        limit 6
      ) x
    ) else '[]'::jsonb end
  );
  return r;
end
$$;

revoke execute on function public.dashboard_resumen() from anon, public;
revoke execute on function public.resumen_cliente(uuid) from anon, public;
revoke execute on function public.busqueda_global(text) from anon, public;
revoke execute on function public.actualizar_notas_partida(uuid, text) from anon, public;
grant execute on function public.dashboard_resumen() to authenticated;
grant execute on function public.resumen_cliente(uuid) to authenticated;
grant execute on function public.busqueda_global(text) to authenticated;
grant execute on function public.actualizar_notas_partida(uuid, text) to authenticated;

-- Las funciones de reglas automáticas (triggers) no deben poder llamarse por la API.
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

-- ---------------------------------------------------------------------
-- La llave de servicio (solo en el servidor, p. ej. la función admin-usuarios)
-- conserva acceso completo. Nunca se usa en el navegador.
-- ---------------------------------------------------------------------
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;

-- >>> 20261013000900_guardar_documentos.sql
-- =====================================================================
-- 09 · Guardado atómico de cotizaciones
-- Guarda encabezado, partidas y costos en una sola transacción.
-- Se ejecuta con los permisos del usuario (RLS aplica normalmente).
-- =====================================================================

create or replace function public.guardar_cotizacion(p_datos jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_datos ->> 'id', '')::uuid;
  v_folio text;
  v_pedido uuid;
  v_partida jsonb;
  v_costos jsonb;
  v_pid uuid;
  v_ids uuid[] := '{}';
  v_orden integer := 0;
  v_puede_costos boolean := public.tiene_permiso('ver_costos');
  v_conf public.configuracion;
begin
  if not public.tiene_permiso('gestionar_cotizaciones') then
    raise exception 'No tienes permiso para guardar cotizaciones' using errcode = '42501';
  end if;
  if nullif(p_datos ->> 'cliente_id', '') is null then
    raise exception 'Selecciona un cliente';
  end if;
  if jsonb_typeof(coalesce(p_datos -> 'partidas', '[]'::jsonb)) <> 'array' then
    raise exception 'Formato de conceptos inválido';
  end if;

  select * into v_conf from public.configuracion where id = 1;

  if v_id is null then
    insert into public.cotizaciones (
      cliente_id, contacto_id, oportunidad_id, titulo, fecha, vigencia_dias, tiempo_entrega,
      anticipo_pct, aplica_iva, iva_pct, descuento_tipo, descuento_valor, recargo_pct, recargo_concepto,
      condiciones, notas, notas_internas
    ) values (
      (p_datos ->> 'cliente_id')::uuid,
      nullif(p_datos ->> 'contacto_id', '')::uuid,
      nullif(p_datos ->> 'oportunidad_id', '')::uuid,
      nullif(trim(p_datos ->> 'titulo'), ''),
      coalesce(nullif(p_datos ->> 'fecha', '')::date, current_date),
      coalesce(nullif(p_datos ->> 'vigencia_dias', '')::integer, v_conf.vigencia_dias, 15),
      nullif(trim(p_datos ->> 'tiempo_entrega'), ''),
      coalesce(nullif(p_datos ->> 'anticipo_pct', '')::numeric, v_conf.anticipo_pct, 50),
      coalesce((p_datos ->> 'aplica_iva')::boolean, true),
      coalesce(nullif(p_datos ->> 'iva_pct', '')::numeric, v_conf.iva_pct, 16),
      coalesce(nullif(p_datos ->> 'descuento_tipo', ''), 'monto'),
      coalesce(nullif(p_datos ->> 'descuento_valor', '')::numeric, 0),
      coalesce(nullif(p_datos ->> 'recargo_pct', '')::numeric, 0),
      coalesce(nullif(trim(p_datos ->> 'recargo_concepto'), ''), 'Recargo por urgencia'),
      p_datos ->> 'condiciones',
      nullif(p_datos ->> 'notas', ''),
      nullif(p_datos ->> 'notas_internas', '')
    )
    returning id, folio into v_id, v_folio;
  else
    select pedido_id into v_pedido from public.cotizaciones where id = v_id;
    if not found then
      raise exception 'Cotización no encontrada';
    end if;
    if v_pedido is not null then
      raise exception 'Esta cotización ya se convirtió en el pedido %; los cambios se hacen en el pedido',
        (select folio from public.pedidos where id = v_pedido);
    end if;

    update public.cotizaciones set
      cliente_id = (p_datos ->> 'cliente_id')::uuid,
      contacto_id = nullif(p_datos ->> 'contacto_id', '')::uuid,
      oportunidad_id = nullif(p_datos ->> 'oportunidad_id', '')::uuid,
      titulo = nullif(trim(p_datos ->> 'titulo'), ''),
      fecha = coalesce(nullif(p_datos ->> 'fecha', '')::date, fecha),
      vigencia_dias = coalesce(nullif(p_datos ->> 'vigencia_dias', '')::integer, vigencia_dias),
      tiempo_entrega = nullif(trim(p_datos ->> 'tiempo_entrega'), ''),
      anticipo_pct = coalesce(nullif(p_datos ->> 'anticipo_pct', '')::numeric, anticipo_pct),
      aplica_iva = coalesce((p_datos ->> 'aplica_iva')::boolean, aplica_iva),
      iva_pct = coalesce(nullif(p_datos ->> 'iva_pct', '')::numeric, iva_pct),
      descuento_tipo = coalesce(nullif(p_datos ->> 'descuento_tipo', ''), descuento_tipo),
      descuento_valor = coalesce(nullif(p_datos ->> 'descuento_valor', '')::numeric, 0),
      recargo_pct = coalesce(nullif(p_datos ->> 'recargo_pct', '')::numeric, 0),
      recargo_concepto = coalesce(nullif(trim(p_datos ->> 'recargo_concepto'), ''), recargo_concepto),
      condiciones = p_datos ->> 'condiciones',
      notas = nullif(p_datos ->> 'notas', ''),
      notas_internas = nullif(p_datos ->> 'notas_internas', '')
    where id = v_id
    returning folio into v_folio;

    if not found then
      raise exception 'No tienes permiso para modificar esta cotización' using errcode = '42501';
    end if;
  end if;

  for v_partida in select value from jsonb_array_elements(coalesce(p_datos -> 'partidas', '[]'::jsonb)) loop
    v_orden := v_orden + 1;
    v_pid := coalesce(nullif(v_partida ->> 'id', '')::uuid, gen_random_uuid());

    if exists (select 1 from public.partidas where id = v_pid and cotizacion_id is distinct from v_id) then
      raise exception 'Concepto inválido';
    end if;

    insert into public.partidas (
      id, cotizacion_id, orden, tipo, producto_id, concepto, descripcion, metodo_calculo, unidad,
      ancho, alto, largo, cantidad, precio_unitario, descuento_pct, notas_produccion
    ) values (
      v_pid, v_id, v_orden,
      coalesce(nullif(v_partida ->> 'tipo', ''), 'concepto')::public.tipo_partida,
      nullif(v_partida ->> 'producto_id', '')::uuid,
      trim(v_partida ->> 'concepto'),
      nullif(trim(v_partida ->> 'descripcion'), ''),
      coalesce(nullif(v_partida ->> 'metodo_calculo', ''), 'pieza')::public.metodo_calculo,
      coalesce(nullif(trim(v_partida ->> 'unidad'), ''), 'pza'),
      nullif(v_partida ->> 'ancho', '')::numeric,
      nullif(v_partida ->> 'alto', '')::numeric,
      nullif(v_partida ->> 'largo', '')::numeric,
      (v_partida ->> 'cantidad')::numeric,
      coalesce(nullif(v_partida ->> 'precio_unitario', '')::numeric, 0),
      coalesce(nullif(v_partida ->> 'descuento_pct', '')::numeric, 0),
      nullif(trim(v_partida ->> 'notas_produccion'), '')
    )
    on conflict (id) do update set
      orden = excluded.orden,
      tipo = excluded.tipo,
      producto_id = excluded.producto_id,
      concepto = excluded.concepto,
      descripcion = excluded.descripcion,
      metodo_calculo = excluded.metodo_calculo,
      unidad = excluded.unidad,
      ancho = excluded.ancho,
      alto = excluded.alto,
      largo = excluded.largo,
      cantidad = excluded.cantidad,
      precio_unitario = excluded.precio_unitario,
      descuento_pct = excluded.descuento_pct,
      notas_produccion = excluded.notas_produccion;

    v_ids := v_ids || v_pid;

    v_costos := v_partida -> 'costos';
    if v_puede_costos and jsonb_typeof(v_costos) = 'object' then
      insert into public.partida_costos (
        partida_id, costo_material, costo_mano_obra, costo_fijo, desperdicio_pct, ganancia_pct, costo_total, calculo
      )
      select
        p.id,
        coalesce(nullif(v_costos ->> 'costo_material', '')::numeric, 0),
        coalesce(nullif(v_costos ->> 'costo_mano_obra', '')::numeric, 0),
        coalesce(nullif(v_costos ->> 'costo_fijo', '')::numeric, 0),
        coalesce(nullif(v_costos ->> 'desperdicio_pct', '')::numeric, 0),
        coalesce(nullif(v_costos ->> 'ganancia_pct', '')::numeric, 0),
        round(
          (coalesce(nullif(v_costos ->> 'costo_material', '')::numeric, 0)
            * (1 + coalesce(nullif(v_costos ->> 'desperdicio_pct', '')::numeric, 0) / 100)
           + coalesce(nullif(v_costos ->> 'costo_mano_obra', '')::numeric, 0))
          * public.unidades_cobro(p.metodo_calculo, p.cantidad, p.ancho, p.alto, p.largo)
          + coalesce(nullif(v_costos ->> 'costo_fijo', '')::numeric, 0), 2),
        coalesce(v_costos -> 'calculo', '{}'::jsonb) || jsonb_build_object('origen', 'manual')
      from public.partidas p
      where p.id = v_pid
      on conflict (partida_id) do update set
        costo_material = excluded.costo_material,
        costo_mano_obra = excluded.costo_mano_obra,
        costo_fijo = excluded.costo_fijo,
        desperdicio_pct = excluded.desperdicio_pct,
        ganancia_pct = excluded.ganancia_pct,
        costo_total = excluded.costo_total,
        calculo = excluded.calculo;
    end if;
  end loop;

  delete from public.partidas where cotizacion_id = v_id and not (id = any (v_ids));

  return jsonb_build_object('id', v_id, 'folio', v_folio);
end
$$;

revoke execute on function public.guardar_cotizacion(jsonb) from public, anon;
grant execute on function public.guardar_cotizacion(jsonb) to authenticated, service_role;

-- >>> 20261013001000_integridad.sql
-- =====================================================================
-- 10 · Integridad de documentos
--   * Folios inmutables.
--   * Una cotización convertida en pedido queda congelada (sus conceptos no se editan)
--     y su vínculo con el pedido no se puede alterar a mano.
--   * El vínculo pedido → cotización no se puede cambiar.
--   * Duplicar una cotización requiere poder ver precios.
-- =====================================================================

create or replace function public.tg_cotizaciones_integridad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.folio is distinct from old.folio then
    raise exception 'El folio no se puede modificar';
  end if;

  if new.pedido_id is distinct from old.pedido_id then
    if new.pedido_id is null then
      -- Solo se desliga si el pedido ya no existe (borrado con ON DELETE SET NULL)
      if exists (select 1 from public.pedidos where id = old.pedido_id) then
        raise exception 'La cotización está ligada a un pedido y no se puede desligar';
      end if;
    elsif not exists (select 1 from public.pedidos where id = new.pedido_id and cotizacion_id = new.id) then
      raise exception 'Vínculo con pedido inválido';
    end if;
  end if;

  return new;
end
$$;

create trigger cotizaciones_integridad
before update on public.cotizaciones
for each row execute function public.tg_cotizaciones_integridad();

create or replace function public.tg_pedidos_integridad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.folio is distinct from old.folio then
    raise exception 'El folio no se puede modificar';
  end if;
  if new.cotizacion_id is distinct from old.cotizacion_id
     and not (new.cotizacion_id is null and not exists (select 1 from public.cotizaciones where id = old.cotizacion_id)) then
    raise exception 'El vínculo del pedido con su cotización no se puede modificar';
  end if;
  return new;
end
$$;

create trigger pedidos_integridad
before update on public.pedidos
for each row execute function public.tg_pedidos_integridad();

-- Conceptos de una cotización convertida: congelados
create or replace function public.tg_partidas_cotizacion_congelada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cot uuid := coalesce(new.cotizacion_id, old.cotizacion_id);
  v_folio text;
begin
  if v_cot is null then
    return coalesce(new, old);
  end if;
  -- Al borrar la cotización completa (cascada) se permite
  if tg_op = 'DELETE' and not exists (select 1 from public.cotizaciones where id = v_cot) then
    return old;
  end if;
  select p.folio into v_folio
  from public.cotizaciones c join public.pedidos p on p.id = c.pedido_id
  where c.id = v_cot;
  if v_folio is not null then
    raise exception 'Esta cotización ya se convirtió en el pedido %; los cambios se hacen en el pedido', v_folio;
  end if;
  return coalesce(new, old);
end
$$;

create trigger partidas_cotizacion_congelada
before insert or update or delete on public.partidas
for each row execute function public.tg_partidas_cotizacion_congelada();

revoke execute on function public.tg_cotizaciones_integridad() from public, anon, authenticated;
revoke execute on function public.tg_pedidos_integridad() from public, anon, authenticated;
revoke execute on function public.tg_partidas_cotizacion_congelada() from public, anon, authenticated;

-- Duplicar exige poder ver precios (además de gestionar cotizaciones)
create or replace function public.duplicar_cotizacion(p_cotizacion uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.cotizaciones;
  v_nueva uuid;
  v_vigencia integer;
begin
  if not (public.tiene_permiso('gestionar_cotizaciones') and public.tiene_permiso('ver_precios')) then
    raise exception 'No tienes permiso para crear cotizaciones' using errcode = '42501';
  end if;

  select * into c from public.cotizaciones where id = p_cotizacion;
  if not found then
    raise exception 'Cotización no encontrada';
  end if;

  select vigencia_dias into v_vigencia from public.configuracion where id = 1;

  insert into public.cotizaciones (
    cliente_id, contacto_id, oportunidad_id, vendedor_id, titulo, vigencia_dias, tiempo_entrega,
    anticipo_pct, aplica_iva, iva_pct, descuento_tipo, descuento_valor, recargo_pct, recargo_concepto,
    condiciones, notas, notas_internas
  ) values (
    c.cliente_id, c.contacto_id, null, auth.uid(),
    case when c.titulo is null then null else c.titulo || ' (copia)' end,
    coalesce(c.vigencia_dias, v_vigencia, 15), c.tiempo_entrega,
    c.anticipo_pct, c.aplica_iva, c.iva_pct, c.descuento_tipo, c.descuento_valor, c.recargo_pct, c.recargo_concepto,
    c.condiciones, c.notas, c.notas_internas
  )
  returning id into v_nueva;

  perform public.copiar_partidas(c.id, null, v_nueva, null);
  update public.cotizaciones set updated_at = now() where id = v_nueva;

  return v_nueva;
end
$$;
