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
