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
