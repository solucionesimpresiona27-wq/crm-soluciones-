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
