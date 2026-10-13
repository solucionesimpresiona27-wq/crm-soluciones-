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
