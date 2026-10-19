-- =====================================================================
-- 23 · Revisión de seguridad: precios, datos de clientes y del equipo, cotizaciones aprobadas
--
-- La interfaz solo oculta; aquí se cierra en la base de datos. Cada corrección tiene su
-- prueba con los cuatro roles en tests/db/seguridad_revision.test.ts.
--
-- R1. Precios de venta solo con "ver_precios"; costos solo con "ver_costos".
--     Auditoría de todo lo que tiene montos de venta:
--       productos (precio_venta, precio_minimo, escalas) ... ANTES lo leía cualquier usuario
--                                                         activo. Ahora "ver_precios" (1a).
--       producto_precios (listas y escalas) .............. ya era "ver_precios".
--       cotizaciones, pedidos, partidas, pagos ........... ya era "ver_precios".
--       ordenes_trabajo / orden_partidas (vistas) ........ montos nulos sin "ver_precios".
--       portal_enlaces ................................... "ver_precios" (20261014000900).
--       comisiones / comisiones_detalle .................. ANTES cualquier usuario activo veía lo
--                                                         cobrado de las ventas a su nombre. Ahora
--                                                         "ver_precios" (1c).
--       reportes, panel financiero, caja (con "ver_reportes") ANTES "ver_reportes" bastaba
--                                                         aunque se hubiera quitado "ver_precios".
--                                                         Ahora "ver_reportes" exige "ver_precios" (1b).
--       catálogo editable ("editar_catalogo") ............ igual: exige "ver_precios" (1b).
--       cortes_caja, corte_caja_resumen, cerrar_caja ..... "ver_precios" (+ registrar_pagos o ver_reportes).
--       cuentas_por_cobrar, resumen_cliente, agenda,
--       busqueda_global, clientes_inactivos, dashboard ... montos solo con "ver_precios" (ya estaba).
--       documentos y comprobantes (almacenamiento) ....... "ver_precios" (ya estaba).
--       producto_costos, partida_costos, material_costos,
--       utilidad_pedidos ................................. "ver_costos" (ya estaba).
--       gastos ........................................... "registrar_gastos" o "ver_costos": son
--                                                         egresos, no precios de venta.
--     Patrón elegido: reglas por renglón (RLS) en las tablas con montos y vistas/funciones
--     SECURITY DEFINER que entregan a Producción y Diseño solo columnas sin montos. Nada de
--     privilegios por columna en tablas con montos, así los select('*') de quien sí tiene
--     permiso siguen funcionando.
--
-- R2. Datos de clientes y del equipo.
--     Clientes y contactos completos (teléfono, correo, RFC, razón social, dirección, notas,
--     condiciones, lista de precio): quien los usa para vender o cobrar
--     (gestionar_clientes, ver_precios, gestionar_cotizaciones, gestionar_pedidos o
--     registrar_pagos) -> puede_ver_clientes() (2a).
--     Producción y Diseño (sin esos permisos) trabajan con:
--       * ordenes_trabajo: nombre del cliente de cada pedido; su WhatsApp/teléfono solo
--         mientras el pedido sigue en proceso (para avisar, pedir aprobación o coordinar
--         la entrega o instalación) (2b).
--       * clientes_operacion (vista nueva): id, nombre y tipo de los clientes que tienen
--         pedidos; WhatsApp y teléfono solo de los que tienen un pedido en proceso; correo,
--         RFC, dirección, notas y lista de precio nunca (2c).
--       * agenda(): el nombre del cliente de una tarea solo si es cliente de algún pedido (2d).
--       * busqueda_global(): sin la sección de clientes, y los pedidos se buscan por folio,
--         título o nombre del cliente (no por su teléfono, correo o RFC) (2d).
--       * resumen_cliente(): solo con puede_ver_clientes() (2d).
--       * archivos de un cliente que no son de un pedido: solo con puede_ver_clientes() (2e).
--     Equipo (perfiles): cualquiera lee id, nombre, puesto, rol y activo (para mostrar
--     responsables). Correo, teléfono, permisos a mano, comisión y último acceso: privilegio
--     por columna; se leen por la vista perfiles_detalle, que solo devuelve el propio
--     perfil o, a administración, todos (2f). El correo y teléfono del vendedor de una
--     cotización se entregan con contacto_vendedor() a quien puede ver esa cotización:
--     se imprimen en su PDF para que el cliente lo contacte (2g).
--
-- R3. Cotización aprobada por el cliente (portal), aceptada o convertida en pedido:
--     ya no se modifica por ningún camino (guardar_cotizacion, update directo a la
--     cotización o a sus partidas y costos, ni regresándola a borrador o enviada). Se
--     puede duplicar (versión nueva) y convertir en pedido. Se permite, además, cerrarla
--     como rechazada o cancelada si no se convirtió, y cambiar lo interno que no ve el
--     cliente: vendedor (sus propias reglas), oportunidad, notas internas y el PDF (3).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1b. Permisos que dependen de "ver_precios": "ver_reportes" (métricas con ventas, cobros y
--     caja) y "editar_catalogo" (edita precios). Sin "ver_precios" quedan apagados, también
--     en mis_permisos(), así la interfaz los oculta en vez de fallar.
-- ---------------------------------------------------------------------
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
      else
        (case when jsonb_typeof(p.permisos -> p_permiso) = 'boolean' then (p.permisos ->> p_permiso)::boolean
              else public.permiso_por_defecto(p.rol, p_permiso) end)
        and (
          p_permiso not in ('ver_reportes', 'editar_catalogo')
          or (case when jsonb_typeof(p.permisos -> 'ver_precios') = 'boolean' then (p.permisos ->> 'ver_precios')::boolean
                   else public.permiso_por_defecto(p.rol, 'ver_precios') end)
        )
    end
    from public.perfiles p
    where p.id = auth.uid() and p.activo
  ), false)
$$;

-- ---------------------------------------------------------------------
-- 1a. Productos: el catálogo (con su precio público y escalas) solo con "ver_precios".
--     Escribir sigue siendo de "editar_catalogo" (que ya exige "ver_precios", 1b). Igual que
--     producto_precios. Producción y Diseño no usan el catálogo: sus órdenes copian el concepto.
-- ---------------------------------------------------------------------
drop policy if exists "productos: administrar" on public.productos;

alter policy "productos: ver" on public.productos
  using ((select public.tiene_permiso('ver_precios')));

create policy "productos: crear" on public.productos
  for insert to authenticated
  with check ((select public.tiene_permiso('editar_catalogo')));

create policy "productos: editar" on public.productos
  for update to authenticated
  using ((select public.tiene_permiso('editar_catalogo')))
  with check ((select public.tiene_permiso('editar_catalogo')));

create policy "productos: eliminar" on public.productos
  for delete to authenticated
  using ((select public.tiene_permiso('editar_catalogo')));

-- ---------------------------------------------------------------------
-- 1c. Comisiones: lo cobrado de cada venta es un monto de venta -> "ver_precios".
--     Con "ver_reportes" (que ya exige "ver_precios"), las de todo el equipo. Sin cambios en
--     el cálculo (20261014000500).
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
  if not public.tiene_permiso('ver_precios') then
    raise exception 'Para ver comisiones necesitas el permiso para ver precios y pagos' using errcode = '42501';
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
  if not public.tiene_permiso('ver_precios') then
    raise exception 'Para ver comisiones necesitas el permiso para ver precios y pagos' using errcode = '42501';
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
-- 2a. Clientes y contactos completos: quien los usa para vender, cotizar, entregar pedidos
--     o cobrar. Ventas y administración los tienen por defecto; Diseño y Producción, no.
-- ---------------------------------------------------------------------
create or replace function public.puede_ver_clientes()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.tiene_permiso('gestionar_clientes')
      or public.tiene_permiso('ver_precios')
      or public.tiene_permiso('gestionar_cotizaciones')
      or public.tiene_permiso('gestionar_pedidos')
      or public.tiene_permiso('registrar_pagos')
$$;

alter policy "clientes: ver" on public.clientes
  using ((select public.puede_ver_clientes()));

alter policy "contactos: ver" on public.contactos
  using ((select public.puede_ver_clientes()));

-- Estados en los que un pedido sigue en proceso (hay que avisar, aprobar, entregar o instalar).
create or replace function public.pedido_en_proceso(p_estado public.estado_pedido)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_estado not in ('entregado', 'finalizado', 'cancelado')
$$;

-- ---------------------------------------------------------------------
-- 2b. ordenes_trabajo: igual que antes (20261013000800), pero el WhatsApp/teléfono del cliente
--     solo llega a quien no ve clientes mientras el pedido sigue en proceso.
-- ---------------------------------------------------------------------
create or replace view public.ordenes_trabajo
with (security_invoker = false)
as
select
  p.id,
  p.folio,
  p.cotizacion_id,
  p.cliente_id,
  c.nombre as cliente_nombre,
  case when (select public.puede_ver_clientes()) or public.pedido_en_proceso(p.estado)
    then coalesce(c.whatsapp, c.telefono) end as cliente_whatsapp,
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

comment on view public.ordenes_trabajo is
  'Pedidos para todo el equipo. Montos nulos sin ver_precios; contacto del cliente solo con permiso de clientes o mientras el pedido está en proceso.';

-- ---------------------------------------------------------------------
-- 2c. clientes_operacion: lo mínimo de un cliente para trabajar sus pedidos.
--     Con puede_ver_clientes(): todos los clientes (sin datos fiscales ni notas; para eso, la tabla).
--     Sin él: solo clientes con pedidos; contacto solo si alguno sigue en proceso; correo nunca.
-- ---------------------------------------------------------------------
create view public.clientes_operacion
with (security_invoker = false)
as
select
  c.id,
  c.nombre,
  c.tipo,
  case when pm.completo or coalesce(pe.en_proceso, false) then c.whatsapp end as whatsapp,
  case when pm.completo or coalesce(pe.en_proceso, false) then c.telefono end as telefono,
  case when pm.completo then c.email end as email,
  case when pm.completo then c.requiere_factura else false end as requiere_factura,
  c.activo
from public.clientes c
cross join (select public.puede_ver_clientes() as completo) pm
left join lateral (
  select bool_or(public.pedido_en_proceso(p.estado)) as en_proceso
  from public.pedidos p
  where p.cliente_id = c.id
) pe on true
where (select public.usuario_activo())
  and (pm.completo or pe.en_proceso is not null);

comment on view public.clientes_operacion is
  'Datos mínimos de clientes para pedidos y producción. Sin permiso de clientes: solo clientes con pedidos y su contacto mientras haya un pedido en proceso.';

revoke all on public.clientes_operacion from public, anon, authenticated;
grant select on public.clientes_operacion to authenticated;
grant all on public.clientes_operacion to service_role;
revoke all on public.ordenes_trabajo from public, anon;
grant select on public.ordenes_trabajo to authenticated;
grant all on public.ordenes_trabajo to service_role;

-- ---------------------------------------------------------------------
-- 2d. Funciones que mostraban datos de clientes a todo el equipo
-- ---------------------------------------------------------------------
-- Agenda: igual que en 20261014000200, salvo el nombre del cliente de las tareas: sin permiso de
-- clientes solo aparece si es cliente de algún pedido.
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
  v_clientes boolean := public.puede_ver_clientes();
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
      t.responsable_id,
      case when v_clientes or exists (select 1 from public.pedidos px where px.cliente_id = t.cliente_id) then t.cliente_id end,
      case when v_clientes or exists (select 1 from public.pedidos px where px.cliente_id = t.cliente_id) then c.nombre end,
      t.pedido_id, t.cotizacion_id, t.oportunidad_id,
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

-- Búsqueda global: sin permiso de clientes no hay sección de clientes y los pedidos no se
-- encuentran por teléfono, correo o RFC del cliente (solo por folio, título o nombre).
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
  v_clientes boolean := public.puede_ver_clientes();
  r jsonb;
begin
  if not public.usuario_activo() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_texto, ''))) < 2 then
    return jsonb_build_object('clientes', '[]'::jsonb, 'cotizaciones', '[]'::jsonb, 'pedidos', '[]'::jsonb);
  end if;

  r := jsonb_build_object(
    'clientes', case when v_clientes then (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
      from (
        select id, nombre, coalesce(whatsapp, telefono) as telefono, email
        from public.clientes
        where busqueda like v_q
        order by activo desc, nombre
        limit 6
      ) x
    ) else '[]'::jsonb end,
    'pedidos', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
      from (
        select p.id, p.folio, p.titulo, p.estado, c.nombre as cliente
        from public.pedidos p join public.clientes c on c.id = p.cliente_id
        where upper(p.folio) like v_folio
           or public.normalizar(p.titulo) like v_q
           or (case when v_clientes then c.busqueda else public.normalizar(c.nombre) end) like v_q
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

-- Resumen de la ficha del cliente: solo para quien puede ver clientes (igual que en
-- 20261013000800 en lo demás).
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
  if not public.puede_ver_clientes() then
    raise exception 'No tienes permiso para ver la ficha de los clientes' using errcode = '42501';
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
-- 2e. Archivos de un cliente que no pertenecen a un pedido (referencias, logotipos): solo
--     con permiso de clientes. Los de pedidos los sigue viendo todo el equipo.
-- ---------------------------------------------------------------------
alter policy "archivos: ver" on public.archivos
  using ((select public.usuario_activo()) and (pedido_id is not null or (select public.puede_ver_clientes())));

alter policy "archivos: ver" on storage.objects
  using (
    bucket_id = 'archivos'
    and (select public.usuario_activo())
    and (coalesce((storage.foldername(name))[1], '') <> 'clientes' or (select public.puede_ver_clientes()))
  );

-- ---------------------------------------------------------------------
-- 2f. Perfiles del equipo.
--     Lectura directa (y en los embebidos como responsable:perfiles(nombre)): solo id, nombre,
--     puesto, rol, activo y fechas. Lo demás, por perfiles_detalle: el propio perfil o, a
--     administración, todos. La edición sigue igual (propio o administración, con
--     tg_perfiles_proteger); quien edite debe pedir de vuelta solo columnas permitidas.
-- ---------------------------------------------------------------------
revoke select on public.perfiles from authenticated;
grant select (id, nombre, puesto, rol, activo, created_at, updated_at) on public.perfiles to authenticated;

create view public.perfiles_detalle
with (security_invoker = false)
as
select
  p.id,
  p.nombre,
  p.email,
  p.telefono,
  p.puesto,
  p.rol,
  p.activo,
  p.permisos,
  p.comision_pct,
  p.ultimo_acceso,
  p.created_at,
  p.updated_at
from public.perfiles p
where p.id = (select auth.uid()) or (select public.es_admin());

comment on view public.perfiles_detalle is
  'Perfil completo (correo, teléfono, permisos, comisión, último acceso): el propio o, para administración, todos.';

revoke all on public.perfiles_detalle from public, anon, authenticated;
grant select on public.perfiles_detalle to authenticated;
grant all on public.perfiles_detalle to service_role;

-- 2g. Contacto del vendedor que se imprime en la cotización (lo usa el PDF).
create or replace function public.contacto_vendedor(p_cotizacion uuid)
returns table (id uuid, nombre text, email text, telefono text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.nombre, nullif(u.email, ''), u.telefono
  from public.cotizaciones q
  join public.perfiles u on u.id = q.vendedor_id
  where q.id = p_cotizacion
    and public.tiene_permiso('ver_precios')
$$;

-- ---------------------------------------------------------------------
-- 3. Cotizaciones aprobadas, aceptadas o convertidas: ya no se modifican.
-- ---------------------------------------------------------------------
-- Motivo por el que una cotización ya no se edita (nulo = se puede editar).
--   * Convertida en pedido.
--   * Aprobada por el cliente en el portal.
--   * Aceptada (o lo fue alguna vez: aceptada_at se conserva aunque luego se rechace).
create or replace function public.cotizacion_bloqueo(p_cotizacion uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when c.pedido_id is not null then
      'Esta cotización ya se convirtió en el pedido '
      || coalesce((select pe.folio from public.pedidos pe where pe.id = c.pedido_id), '')
      || '; los cambios se hacen en el pedido. Si necesitas otra versión, duplícala.'
    when exists (
      select 1 from public.portal_respuestas r
      where r.cotizacion_id = c.id and r.accion = 'aprobar_cotizacion'
    ) then
      'El cliente aprobó esta cotización desde el portal y ya no se puede modificar. Duplícala para hacer una versión nueva.'
    when c.estado = 'aceptada' or c.aceptada_at is not null then
      'Esta cotización ya fue aceptada y no se puede modificar. Duplícala para hacer una versión nueva.'
  end
  from public.cotizaciones c
  where c.id = p_cotizacion
$$;

-- Encabezado: con la cotización cerrada solo cambian lo interno (vendedor, oportunidad, notas
-- internas, PDF), el vínculo con su pedido (lo valida tg_cotizaciones_integridad) y el estado
-- para cerrarla como rechazada o cancelada (si no es pedido) o dejarla aceptada. Los totales
-- se recalculan solos y no pueden cambiar porque las partidas tampoco.
-- Se dispara después de cotizaciones_integridad (orden alfabético), que da sus propios avisos
-- de folio y vínculo con el pedido.
create or replace function public.tg_cotizaciones_proteger_aceptada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text := public.cotizacion_bloqueo(old.id);
  v_old jsonb := to_jsonb(old);
  v_campos text[];
begin
  if v_motivo is null then
    return new;
  end if;

  select array_agg(n.key order by n.key) into v_campos
  from jsonb_each(to_jsonb(new)) n
  where n.value is distinct from v_old -> n.key
    and n.key <> all (array[
      'estado', 'motivo_rechazo', 'pedido_id', 'vendedor_id', 'oportunidad_id', 'notas_internas', 'pdf_path',
      'subtotal', 'descuento', 'recargo', 'iva', 'total', 'fecha_vencimiento', 'updated_at'
    ]);

  if v_campos is not null then
    raise exception '%', v_motivo using hint = 'Campos: ' || array_to_string(v_campos, ', ');
  end if;

  if new.estado is distinct from old.estado
     and not (new.estado = 'aceptada'
              or (new.estado in ('rechazada', 'cancelada') and new.pedido_id is null)) then
    raise exception '%', v_motivo;
  end if;

  return new;
end
$$;

drop trigger if exists cotizaciones_proteger_aceptada on public.cotizaciones;
create trigger cotizaciones_proteger_aceptada
before update on public.cotizaciones
for each row execute function public.tg_cotizaciones_proteger_aceptada();

-- Partidas: ninguna partida entra, cambia o sale de una cotización cerrada (antes solo se
-- revisaba la de destino y solo si ya era pedido). Al borrar la cotización completa (cascada)
-- se permite, como antes.
create or replace function public.tg_partidas_cotizacion_congelada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.cotizacion_id is not null then
    v_motivo := public.cotizacion_bloqueo(old.cotizacion_id);
    if v_motivo is not null then
      raise exception '%', v_motivo;
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.cotizacion_id is not null then
    v_motivo := public.cotizacion_bloqueo(new.cotizacion_id);
    if v_motivo is not null then
      raise exception '%', v_motivo;
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

-- Costos de las partidas de una cotización cerrada: tampoco cambian (al convertirla se copian
-- al pedido tal cual). Si la partida ya no existe (borrado en cascada) se permite.
create or replace function public.tg_partida_costos_cotizacion_cerrada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partidas uuid[] := '{}';
  v_partida uuid;
  v_cot uuid;
  v_motivo text;
begin
  if tg_op <> 'INSERT' then
    v_partidas := v_partidas || old.partida_id;
  end if;
  if tg_op <> 'DELETE' then
    v_partidas := v_partidas || new.partida_id;
  end if;
  foreach v_partida in array v_partidas loop
    v_cot := null;
    select pa.cotizacion_id into v_cot from public.partidas pa where pa.id = v_partida;
    if v_cot is not null then
      v_motivo := public.cotizacion_bloqueo(v_cot);
      if v_motivo is not null then
        raise exception '%', v_motivo;
      end if;
    end if;
  end loop;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

drop trigger if exists partida_costos_cotizacion_cerrada on public.partida_costos;
create trigger partida_costos_cotizacion_cerrada
before insert or update or delete on public.partida_costos
for each row execute function public.tg_partida_costos_cotizacion_cerrada();

-- ---------------------------------------------------------------------
-- Privilegios de lo nuevo
-- ---------------------------------------------------------------------
revoke execute on function public.tg_cotizaciones_proteger_aceptada() from public, anon, authenticated;
revoke execute on function public.tg_partida_costos_cotizacion_cerrada() from public, anon, authenticated;
-- Solo la usan las reglas de arriba (dice si una cotización existe y en qué pedido quedó).
revoke execute on function public.cotizacion_bloqueo(uuid) from public, anon, authenticated;
revoke execute on function public.puede_ver_clientes() from public, anon;
revoke execute on function public.pedido_en_proceso(public.estado_pedido) from public, anon;
revoke execute on function public.contacto_vendedor(uuid) from public, anon;
grant execute on function public.puede_ver_clientes() to authenticated;
grant execute on function public.pedido_en_proceso(public.estado_pedido) to authenticated;
grant execute on function public.contacto_vendedor(uuid) to authenticated;
grant execute on function public.cotizacion_bloqueo(uuid) to service_role;
grant execute on function public.tg_cotizaciones_proteger_aceptada() to service_role;
grant execute on function public.tg_partida_costos_cotizacion_cerrada() to service_role;
grant execute on function public.puede_ver_clientes() to service_role;
grant execute on function public.pedido_en_proceso(public.estado_pedido) to service_role;
grant execute on function public.contacto_vendedor(uuid) to service_role;

notify pgrst, 'reload schema';
