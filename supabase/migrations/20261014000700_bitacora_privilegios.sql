-- =====================================================================
-- 17 · Bitácora para las tablas nuevas y repaso final de privilegios
--   * La bitácora reconoce las tablas de las fases 2 y 3 (etiquetas legibles),
--     ignora campos calculados (existencia, vistas del portal...) y no guarda
--     los tokens del portal.
--   * Los cambios hechos desde el portal se atribuyen a "Cliente (portal)".
--   * Ninguna función queda disponible para "anon" salvo las tres del portal.
-- =====================================================================

create or replace function public.tg_bitacora()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_reg jsonb;
  v_cambios jsonb := '{}'::jsonb;
  v_accion text;
  v_etiqueta text;
  v_nombre text;
  v_id text;
  k text;
  -- Campos calculados o técnicos que no aportan al historial
  v_ignorar text[] := array[
    'updated_at', 'busqueda', 'subtotal', 'descuento', 'recargo', 'iva', 'total', 'pagado', 'saldo',
    'estado_pago', 'ultima_compra_at', 'fecha_vencimiento', 'importe', 'ultimo_acceso', 'enviada_at',
    'aceptada_at', 'entregado_at', 'finalizado_at', 'cancelado_at', 'cerrada_at', 'estado_anterior',
    'aprobacion_at', 'aprobacion_registrada_por', 'cancelado_por',
    -- Fases 2 y 3
    'existencia', 'bajo_minimo', 'existencia_resultante', 'vistas', 'ultimo_acceso_at',
    'completada_at', 'completada_por', 'revocado_at', 'revocado_por', 'token'
  ];
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_reg := v_new;
    v_accion := 'crear';
  elsif tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_reg := v_old;
    v_accion := 'eliminar';
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_reg := v_new;
    v_accion := 'modificar';
    for k in select jsonb_object_keys(v_new) loop
      continue when k = any (v_ignorar);
      if (v_new -> k) is distinct from (v_old -> k) then
        v_cambios := v_cambios || jsonb_build_object(k, jsonb_build_array(v_old -> k, v_new -> k));
      end if;
    end loop;

    if v_cambios = '{}'::jsonb then
      return null;
    end if;

    if v_cambios ? 'estado' then
      v_accion := case when v_new ->> 'estado' in ('cancelado', 'cancelada') then 'cancelar' else 'cambio_estado' end;
    elsif v_cambios ? 'etapa' then
      v_accion := 'cambio_estado';
    end if;
    if v_cambios ? 'cancelado' and (v_new ->> 'cancelado')::boolean then
      v_accion := 'cancelar';
    end if;
    if v_cambios ? 'estado_aprobacion' then
      v_accion := case when v_new ->> 'estado_aprobacion' = 'aprobado' then 'aprobar' else 'cambio_estado' end;
    end if;
    if v_cambios ? 'completada' then
      v_accion := 'cambio_estado';
    end if;
    if v_cambios ? 'revocado' and (v_new ->> 'revocado')::boolean then
      v_accion := 'cancelar';
    end if;
  end if;

  -- Los tokens del portal no se guardan en la bitácora.
  v_reg := v_reg - 'token';

  v_id := coalesce(v_reg ->> 'id', v_reg ->> 'partida_id', v_reg ->> 'producto_id', v_reg ->> 'material_id', v_reg ->> 'tipo');

  v_etiqueta := case tg_table_name
    when 'pagos' then
      'Pago de $' || to_char((v_reg ->> 'importe')::numeric, 'FM999,999,990.00') || ' · '
      || coalesce((select p.folio from public.pedidos p where p.id = (v_reg ->> 'pedido_id')::uuid), 'pedido')
    when 'partidas' then
      coalesce(
        (select c.folio from public.cotizaciones c where c.id = (v_reg ->> 'cotizacion_id')::uuid),
        (select p.folio from public.pedidos p where p.id = (v_reg ->> 'pedido_id')::uuid),
        ''
      ) || ' · ' || coalesce(v_reg ->> 'concepto', '')
    when 'partida_costos' then
      'Costos de partida'
    when 'producto_costos' then
      'Costos de ' || coalesce((select pr.nombre from public.productos pr where pr.id = (v_reg ->> 'producto_id')::uuid), 'producto')
    when 'configuracion' then
      'Configuración del negocio'
    when 'folios' then
      'Folios de ' || coalesce(v_reg ->> 'tipo', '')
    when 'producto_precios' then
      'Precio ' || coalesce(v_reg ->> 'lista', '') || ' de '
      || coalesce((select pr.nombre from public.productos pr where pr.id = (v_reg ->> 'producto_id')::uuid), 'producto')
    when 'material_costos' then
      'Costo de ' || coalesce((select m.nombre from public.materiales m where m.id = (v_reg ->> 'material_id')::uuid), 'material')
    when 'movimientos_inventario' then
      initcap(coalesce(v_reg ->> 'tipo', 'movimiento')) || ' de '
      || public.cantidad_texto((v_reg ->> 'cantidad')::numeric) || ' · '
      || coalesce((select m.nombre from public.materiales m where m.id = (v_reg ->> 'material_id')::uuid), 'material')
    when 'gastos' then
      'Gasto de $' || to_char((v_reg ->> 'monto')::numeric, 'FM999,999,990.00') || ' · ' || coalesce(v_reg ->> 'concepto', '')
    when 'cortes_caja' then
      'Corte de caja del ' || to_char((v_reg ->> 'fecha')::date, 'DD/MM/YYYY')
    when 'portal_enlaces' then
      'Enlace del portal · ' || coalesce(
        (select c.folio from public.cotizaciones c where c.id = (v_reg ->> 'cotizacion_id')::uuid),
        (select p.folio from public.pedidos p where p.id = (v_reg ->> 'pedido_id')::uuid),
        v_reg ->> 'tipo'
      )
    else
      coalesce(v_reg ->> 'folio', v_reg ->> 'nombre', v_reg ->> 'titulo', v_reg ->> 'clave', v_reg ->> 'email', v_id)
  end;

  select p.nombre into v_nombre from public.perfiles p where p.id = auth.uid();

  insert into public.bitacora (tabla, registro_id, accion, etiqueta, cambios, datos, usuario_id, usuario_nombre)
  values (
    tg_table_name,
    v_id,
    v_accion,
    v_etiqueta,
    case when tg_op = 'UPDATE' then v_cambios end,
    case when tg_op <> 'UPDATE' then v_reg end,
    auth.uid(),
    coalesce(
      v_nombre,
      case
        when auth.uid() is null and coalesce(auth.role(), '') = 'anon' then 'Cliente (portal)'
        when auth.uid() is null then 'Sistema'
      end
    )
  );

  return null;
end
$$;

-- ---------------------------------------------------------------------
-- Repaso de privilegios
-- ---------------------------------------------------------------------
-- Funciones de reglas automáticas: nunca por la API.
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

-- "anon" (sin sesión) solo puede usar el portal del cliente.
grant usage on schema public to anon;
revoke execute on all functions in schema public from public, anon;
grant execute on function public.portal_obtener(text) to anon;
grant execute on function public.portal_aprobar_cotizacion(text, text, text) to anon;
grant execute on function public.portal_responder_diseno(text, uuid, boolean, text, text) to anon;

-- Ninguna tabla para "anon"; sin TRUNCATE, REFERENCES ni TRIGGER para los roles de la API
-- (TRUNCATE ignora las reglas de acceso por fila).
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- La llave de servicio conserva acceso completo (solo vive en funciones del servidor).
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Recarga el esquema de la API.
notify pgrst, 'reload schema';
