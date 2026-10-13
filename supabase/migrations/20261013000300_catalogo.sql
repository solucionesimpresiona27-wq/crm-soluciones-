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
