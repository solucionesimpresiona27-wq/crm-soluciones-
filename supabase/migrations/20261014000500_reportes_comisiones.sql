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
