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
