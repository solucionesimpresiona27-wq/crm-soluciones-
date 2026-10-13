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
