-- =====================================================================
-- 24 · Revisión de seguridad (ronda 2): ajustes a 20261019000200
--
-- 2d-bis. Panel (dashboard_resumen().tareas_hoy): el nombre del cliente de una tarea sigue la
--         misma regla que agenda(): sin permiso de clientes, solo si es cliente de algún pedido.
--         Además, quien no ve clientes solo liga sus tareas a clientes con pedidos (los que ve
--         en clientes_operacion), para que no pueda "preguntar" por cualquier cliente.
-- 3b.     Portal: el cliente aprueba la versión que vio. portal_obtener entrega una huella
--         (version) de lo que muestra; portal_aprobar_cotizacion la exige y la compara con la
--         vigente bajo candado. Si el asesor cambió algo, la aprobación se rechaza.
-- 3c.     Carrera al aprobar o convertir: las reglas de partidas y sus costos toman el candado
--         de la cotización antes de revisar si está cerrada, así esperan a la aprobación o la
--         conversión en curso y la ven confirmada.
-- 2c-bis. clientes_operacion.contacto_visible: el contacto existe pero el rol no lo ve.
-- 3d.     Los ON DELETE SET NULL (autor, contacto, producto) vuelven a funcionar con
--         cotizaciones cerradas: solo se permite pasar esos campos a nulo.
-- Pruebas en tests/db/seguridad_revision.test.ts (ronda 2).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 2d-bis. Panel: tareas_hoy sin nombres de clientes ajenos (igual que agenda()).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dashboard_resumen()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r jsonb;
  v_uid uuid := auth.uid();
  v_precios boolean := public.tiene_permiso('ver_precios');
  v_reportes boolean := public.tiene_permiso('ver_reportes');
  v_costos boolean := public.tiene_permiso('ver_costos');
  v_comercial boolean := public.tiene_permiso('gestionar_clientes');
  v_clientes boolean := public.puede_ver_clientes();
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
        select t.id, t.titulo, t.tipo, t.fecha, t.hora, t.prioridad,
               case when v_clientes or exists (select 1 from public.pedidos px where px.cliente_id = t.cliente_id)
                 then t.cliente_id end as cliente_id,
               case when v_clientes or exists (select 1 from public.pedidos px where px.cliente_id = t.cliente_id)
                 then c.nombre end as cliente,
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
$function$;

-- Tareas: sin permiso de clientes, el cliente ligado debe ser cliente de algún pedido.
-- Se revisa solo si el cliente cambia (completar o editar una tarea que otro ligó sigue igual).
create or replace function public.tg_tareas_antes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
    if new.completada then
      new.completada_at := now();
      new.completada_por := auth.uid();
    else
      new.completada_at := null;
      new.completada_por := null;
    end if;
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if new.completada and not old.completada then
      new.completada_at := now();
      new.completada_por := auth.uid();
    elsif not new.completada then
      new.completada_at := null;
      new.completada_por := null;
    else
      new.completada_at := old.completada_at;
      new.completada_por := old.completada_por;
    end if;
  end if;

  -- El cliente se toma del documento ligado si no se indicó.
  if new.cliente_id is null then
    if new.pedido_id is not null then
      select cliente_id into new.cliente_id from public.pedidos where id = new.pedido_id;
    elsif new.cotizacion_id is not null then
      select cliente_id into new.cliente_id from public.cotizaciones where id = new.cotizacion_id;
    elsif new.oportunidad_id is not null then
      select cliente_id into new.cliente_id from public.oportunidades where id = new.oportunidad_id;
    end if;
  end if;

  if new.cliente_id is not null
     and (tg_op = 'INSERT' or new.cliente_id is distinct from old.cliente_id)
     and auth.uid() is not null
     and not public.puede_ver_clientes()
     and not exists (select 1 from public.pedidos px where px.cliente_id = new.cliente_id) then
    raise exception 'Solo puedes ligar la tarea a clientes con pedidos. Pide a Ventas que la ligue si hace falta.'
      using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end
$$;

-- ---------------------------------------------------------------------
-- 3b. Portal: huella de lo que ve el cliente y aprobación con control de versión.
-- ---------------------------------------------------------------------
-- Cambia si cambia cualquier dato que el cliente ve y aprueba (conceptos, precios, totales,
-- condiciones, notas, tiempo de entrega, anticipo). No cuenta el estado, el vencimiento ni lo
-- interno (vendedor, notas internas, PDF).
create or replace function public.portal_version_cotizacion(p_cotizacion uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select md5(jsonb_build_object(
    'titulo', q.titulo,
    'cliente_id', q.cliente_id,
    'contacto_id', q.contacto_id,
    'tiempo_entrega', q.tiempo_entrega,
    'anticipo_pct', q.anticipo_pct,
    'aplica_iva', q.aplica_iva,
    'iva_pct', q.iva_pct,
    'subtotal', q.subtotal,
    'descuento', q.descuento,
    'recargo_pct', q.recargo_pct,
    'recargo_concepto', q.recargo_concepto,
    'recargo', q.recargo,
    'iva', q.iva,
    'total', q.total,
    'condiciones', q.condiciones,
    'notas', q.notas,
    'partidas', public.portal_partidas(q.id, null)
  )::text)
  from public.cotizaciones q
  where q.id = p_cotizacion
$$;

CREATE OR REPLACE FUNCTION public.portal_obtener(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET "TimeZone" TO 'America/Mexico_City'
AS $function$
declare
  e public.portal_enlaces;
  conf public.configuracion;
  q public.cotizaciones;
  p public.pedidos;
  v_pedido uuid;
  r jsonb;
  v_etapas text[] := array['nuevo', 'en_diseno', 'esperando_aprobacion', 'aprobado', 'en_produccion',
                           'acabados', 'listo_entrega', 'en_instalacion', 'entregado'];
begin
  e := public.portal_enlace_vigente(p_token);

  update public.portal_enlaces
  set vistas = vistas + 1, ultimo_acceso_at = now()
  where id = e.id;

  select * into conf from public.configuracion where id = 1;

  r := jsonb_build_object(
    'tipo', e.tipo,
    'expira_at', e.expira_at,
    'empresa', jsonb_strip_nulls(jsonb_build_object(
      'nombre', conf.nombre_comercial,
      'eslogan', conf.eslogan,
      'ciudad', conf.ciudad,
      'direccion', conf.direccion,
      'telefono', conf.telefono,
      'whatsapp', conf.whatsapp,
      'email', conf.email,
      'sitio_web', conf.sitio_web,
      'instagram', conf.instagram,
      'facebook', conf.facebook,
      'tiktok', conf.tiktok,
      'logo_url', conf.logo_url,
      'color_primario', conf.color_primario,
      'color_secundario', conf.color_secundario,
      'datos_bancarios', conf.datos_bancarios,
      'rfc', case when conf.mostrar_datos_fiscales then conf.rfc end,
      'razon_social', case when conf.mostrar_datos_fiscales then conf.razon_social end,
      'regimen_fiscal', case when conf.mostrar_datos_fiscales then conf.regimen_fiscal end
    ))
  );

  if e.tipo = 'cotizacion' then
    select * into q from public.cotizaciones where id = e.cotizacion_id;
    r := r || jsonb_build_object('cotizacion', jsonb_build_object(
      'folio', q.folio,
      'titulo', q.titulo,
      'fecha', q.fecha,
      'fecha_vencimiento', q.fecha_vencimiento,
      'vigente', q.fecha_vencimiento >= current_date,
      'estado', q.estado,
      'cliente', (select c.nombre from public.clientes c where c.id = q.cliente_id),
      'contacto', (select ct.nombre from public.contactos ct where ct.id = q.contacto_id),
      'vendedor', (select u.nombre from public.perfiles u where u.id = q.vendedor_id),
      'tiempo_entrega', q.tiempo_entrega,
      'anticipo_pct', q.anticipo_pct,
      'anticipo', round(q.total * q.anticipo_pct / 100, 2),
      'aplica_iva', q.aplica_iva,
      'iva_pct', q.iva_pct,
      'subtotal', q.subtotal,
      'descuento', q.descuento,
      'recargo_pct', q.recargo_pct,
      'recargo_concepto', q.recargo_concepto,
      'recargo', q.recargo,
      'iva', q.iva,
      'total', q.total,
      'condiciones', q.condiciones,
      'notas', q.notas,
      'enviada_at', q.enviada_at,
      'aceptada_at', q.aceptada_at,
      'puede_aprobar', q.estado in ('borrador', 'enviada') and q.pedido_id is null
                       and q.fecha_vencimiento >= current_date,
      'aprobacion', (
        select jsonb_build_object('nombre', pr.nombre, 'fecha', pr.created_at)
        from public.portal_respuestas pr
        where pr.cotizacion_id = q.id and pr.accion = 'aprobar_cotizacion'
        order by pr.created_at desc
        limit 1
      ),
      'partidas', public.portal_partidas(q.id, null),
      -- Huella de lo que ve el cliente: la aprobación debe traer la misma (R3b).
      'version', public.portal_version_cotizacion(q.id)
    ));
  end if;

  v_pedido := public.portal_pedido_de_enlace(e);

  if v_pedido is not null then
    select * into p from public.pedidos where id = v_pedido;
    r := r || jsonb_build_object('pedido', jsonb_build_object(
      'folio', p.folio,
      'titulo', p.titulo,
      'estado', p.estado,
      'estado_pago', p.estado_pago,
      'cliente', (select c.nombre from public.clientes c where c.id = p.cliente_id),
      'fecha_entrega', p.fecha_entrega,
      'requiere_instalacion', p.requiere_instalacion,
      'created_at', p.created_at,
      'entregado_at', p.entregado_at,
      'anticipo_pct', p.anticipo_pct,
      'subtotal', p.subtotal,
      'descuento', p.descuento,
      'recargo', p.recargo,
      'iva', p.iva,
      'total', p.total,
      'pagado', p.pagado,
      'saldo', p.saldo,
      'condiciones', p.condiciones,
      'etapas', (
        select coalesce(jsonb_agg(et order by ord), '[]'::jsonb)
        from unnest(v_etapas) with ordinality as u(et, ord)
        where not (et::public.estado_pedido = any (p.etapas_omitidas))
      ),
      'linea_tiempo', (
        select coalesce(jsonb_agg(jsonb_build_object('estado', ev.estado_a, 'fecha', ev.created_at)
                                  order by ev.created_at, ev.id), '[]'::jsonb)
        from public.pedido_eventos ev
        where ev.pedido_id = p.id and ev.tipo in ('creado', 'estado') and ev.estado_a is not null
      ),
      'partidas', public.portal_partidas(null, p.id),
      'disenos', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', a.id,
          'nombre', a.nombre,
          'version', a.version,
          'estado_aprobacion', a.estado_aprobacion,
          'mime', a.mime,
          'tiene_archivo', a.path is not null,
          'enlace_externo', case when a.enlace_externo ~* '^https?://' then a.enlace_externo end,
          'created_at', a.created_at,
          'aprobado_por_nombre', a.aprobado_por_nombre,
          'aprobacion_at', a.aprobacion_at,
          'puede_responder', a.estado_aprobacion = 'pendiente' and p.estado not in ('cancelado', 'finalizado')
        ) order by a.version desc nulls last, a.created_at desc), '[]'::jsonb)
        from public.archivos a
        where a.pedido_id = p.id and a.categoria = 'diseno'
      )
    ));
  end if;

  return r;
end
$function$;

drop function if exists public.portal_aprobar_cotizacion(text, text, text);

create function public.portal_aprobar_cotizacion(
  p_token text,
  p_nombre text,
  p_comentario text default null,
  p_version text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set timezone = 'America/Mexico_City'
as $$
declare
  e public.portal_enlaces;
  q public.cotizaciones;
  v_txt text[];
  v_origen text[];
begin
  e := public.portal_enlace_vigente(p_token);
  if e.tipo <> 'cotizacion' then
    raise exception 'Este enlace no es de una cotización';
  end if;
  v_txt := public.portal_texto_cliente(p_nombre, p_comentario);

  -- El candado espera a cualquier cambio en curso de la cotización o sus conceptos (3c).
  select * into q from public.cotizaciones where id = e.cotizacion_id for update;
  if q.estado = 'aceptada' or q.pedido_id is not null then
    raise exception 'Esta cotización ya fue aprobada. ¡Gracias!';
  end if;
  if q.estado not in ('borrador', 'enviada') then
    raise exception 'Esta cotización ya no se puede aprobar. Comunícate con tu asesor.';
  end if;
  if q.fecha_vencimiento < current_date then
    raise exception 'Esta cotización venció el %. Pide a tu asesor una cotización actualizada.',
      to_char(q.fecha_vencimiento, 'DD/MM/YYYY');
  end if;
  -- Lo que el cliente vio debe ser lo vigente (3b).
  if p_version is null or p_version is distinct from public.portal_version_cotizacion(q.id) then
    raise exception 'Tu asesor actualizó esta cotización mientras la revisabas. Revisa la versión actual y vuelve a aprobarla.';
  end if;

  update public.cotizaciones set estado = 'aceptada' where id = q.id;

  v_origen := public.portal_origen_solicitud();
  insert into public.portal_respuestas (enlace_id, accion, cotizacion_id, nombre, comentario, ip, user_agent)
  values (e.id, 'aprobar_cotizacion', q.id, v_txt[1], v_txt[2], v_origen[1], v_origen[2]);

  insert into public.actividades (cliente_id, oportunidad_id, tipo, descripcion, usuario_id)
  values (
    q.cliente_id, q.oportunidad_id, 'nota',
    'Cotización ' || q.folio || ' aprobada desde el portal por ' || v_txt[1]
      || coalesce('. Comentario: ' || v_txt[2], ''),
    null
  );

  return jsonb_build_object('ok', true, 'folio', q.folio, 'estado', 'aceptada');
end
$$;

-- ---------------------------------------------------------------------
-- 3c/3d. Partidas y costos de cotizaciones cerradas: candado antes de revisar; producto a nulo
--        (ON DELETE SET NULL del catálogo) permitido.
-- ---------------------------------------------------------------------
create or replace function public.tg_partidas_cotizacion_congelada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
begin
  -- Candado de la cotización: espera a una aprobación o conversión en curso (3c). El mismo nivel
  -- que toma tg_partidas_tocar_documento al recalcular, así dos partidas no se bloquean entre sí.
  if tg_op in ('UPDATE', 'DELETE') and old.cotizacion_id is not null then
    perform 1 from public.cotizaciones where id = old.cotizacion_id for no key update;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.cotizacion_id is not null
     and new.cotizacion_id is distinct from (case when tg_op = 'UPDATE' then old.cotizacion_id end) then
    perform 1 from public.cotizaciones where id = new.cotizacion_id for no key update;
  end if;

  -- 3d. Solo el producto pasa a nulo (se borró del catálogo): el concepto copiado no cambia.
  --     (importe es generada: en un BEFORE llega nula, por eso no se compara).
  if tg_op = 'UPDATE'
     and old.producto_id is not null and new.producto_id is null
     and (to_jsonb(new) - 'producto_id' - 'updated_at' - 'importe') = (to_jsonb(old) - 'producto_id' - 'updated_at' - 'importe') then
    return new;
  end if;

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
  -- 3d. Recalcular sin cambiar nada (tg_partida_costo_estimado al tocar la partida) no es un cambio.
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'updated_at') = (to_jsonb(old) - 'updated_at') then
    return new;
  end if;
  -- 3d. El producto se borró del catálogo (su partida quedó sin producto) y tg_partida_costo_estimado
  --     quita el costo que venía de ese producto: lo mismo que pasa con una cotización abierta.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1
     and coalesce(old.calculo ->> 'origen', '') = 'catalogo'
     and exists (select 1 from public.partidas pa where pa.id = old.partida_id and pa.producto_id is null) then
    return old;
  end if;

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
      perform 1 from public.cotizaciones where id = v_cot for no key update;
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

-- ---------------------------------------------------------------------
-- 3d. Encabezado: autor y contacto pueden pasar a nulo (borrado del usuario o del contacto).
-- ---------------------------------------------------------------------
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
    ])
    -- ON DELETE SET NULL de perfiles y contactos
    and not (n.key in ('created_by', 'contacto_id') and n.value = 'null'::jsonb);

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

-- ---------------------------------------------------------------------
-- 2c-bis. clientes_operacion dice si el contacto se oculta por permiso (contacto_visible), para
--         que la interfaz no diga "no tiene WhatsApp registrado" cuando sí lo tiene. Igual que en
--         20261019000200, más la columna al final.
-- ---------------------------------------------------------------------
create or replace view public.clientes_operacion
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
  c.activo,
  (pm.completo or coalesce(pe.en_proceso, false)) as contacto_visible
from public.clientes c
cross join (select public.puede_ver_clientes() as completo) pm
left join lateral (
  select bool_or(public.pedido_en_proceso(p.estado)) as en_proceso
  from public.pedidos p
  where p.cliente_id = c.id
) pe on true
where (select public.usuario_activo())
  and (pm.completo or pe.en_proceso is not null);

comment on column public.clientes_operacion.contacto_visible is
  'false: el cliente puede tener WhatsApp o teléfono, pero tu rol no lo ve porque sus pedidos ya se cerraron.';

-- ---------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------
revoke execute on function public.portal_version_cotizacion(uuid) from public, anon, authenticated;
grant execute on function public.portal_version_cotizacion(uuid) to service_role;
revoke execute on function public.portal_aprobar_cotizacion(text, text, text, text) from public;
grant execute on function public.portal_aprobar_cotizacion(text, text, text, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
