-- =====================================================================
-- 10 · Integridad de documentos
--   * Folios inmutables.
--   * Una cotización convertida en pedido queda congelada (sus conceptos no se editan)
--     y su vínculo con el pedido no se puede alterar a mano.
--   * El vínculo pedido → cotización no se puede cambiar.
--   * Duplicar una cotización requiere poder ver precios.
-- =====================================================================

create or replace function public.tg_cotizaciones_integridad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.folio is distinct from old.folio then
    raise exception 'El folio no se puede modificar';
  end if;

  if new.pedido_id is distinct from old.pedido_id then
    if new.pedido_id is null then
      -- Solo se desliga si el pedido ya no existe (borrado con ON DELETE SET NULL)
      if exists (select 1 from public.pedidos where id = old.pedido_id) then
        raise exception 'La cotización está ligada a un pedido y no se puede desligar';
      end if;
    elsif not exists (select 1 from public.pedidos where id = new.pedido_id and cotizacion_id = new.id) then
      raise exception 'Vínculo con pedido inválido';
    end if;
  end if;

  return new;
end
$$;

create trigger cotizaciones_integridad
before update on public.cotizaciones
for each row execute function public.tg_cotizaciones_integridad();

create or replace function public.tg_pedidos_integridad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.folio is distinct from old.folio then
    raise exception 'El folio no se puede modificar';
  end if;
  if new.cotizacion_id is distinct from old.cotizacion_id
     and not (new.cotizacion_id is null and not exists (select 1 from public.cotizaciones where id = old.cotizacion_id)) then
    raise exception 'El vínculo del pedido con su cotización no se puede modificar';
  end if;
  return new;
end
$$;

create trigger pedidos_integridad
before update on public.pedidos
for each row execute function public.tg_pedidos_integridad();

-- Conceptos de una cotización convertida: congelados
create or replace function public.tg_partidas_cotizacion_congelada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cot uuid := coalesce(new.cotizacion_id, old.cotizacion_id);
  v_folio text;
begin
  if v_cot is null then
    return coalesce(new, old);
  end if;
  -- Al borrar la cotización completa (cascada) se permite
  if tg_op = 'DELETE' and not exists (select 1 from public.cotizaciones where id = v_cot) then
    return old;
  end if;
  select p.folio into v_folio
  from public.cotizaciones c join public.pedidos p on p.id = c.pedido_id
  where c.id = v_cot;
  if v_folio is not null then
    raise exception 'Esta cotización ya se convirtió en el pedido %; los cambios se hacen en el pedido', v_folio;
  end if;
  return coalesce(new, old);
end
$$;

create trigger partidas_cotizacion_congelada
before insert or update or delete on public.partidas
for each row execute function public.tg_partidas_cotizacion_congelada();

revoke execute on function public.tg_cotizaciones_integridad() from public, anon, authenticated;
revoke execute on function public.tg_pedidos_integridad() from public, anon, authenticated;
revoke execute on function public.tg_partidas_cotizacion_congelada() from public, anon, authenticated;

-- Duplicar exige poder ver precios (además de gestionar cotizaciones)
create or replace function public.duplicar_cotizacion(p_cotizacion uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.cotizaciones;
  v_nueva uuid;
  v_vigencia integer;
begin
  if not (public.tiene_permiso('gestionar_cotizaciones') and public.tiene_permiso('ver_precios')) then
    raise exception 'No tienes permiso para crear cotizaciones' using errcode = '42501';
  end if;

  select * into c from public.cotizaciones where id = p_cotizacion;
  if not found then
    raise exception 'Cotización no encontrada';
  end if;

  select vigencia_dias into v_vigencia from public.configuracion where id = 1;

  insert into public.cotizaciones (
    cliente_id, contacto_id, oportunidad_id, vendedor_id, titulo, vigencia_dias, tiempo_entrega,
    anticipo_pct, aplica_iva, iva_pct, descuento_tipo, descuento_valor, recargo_pct, recargo_concepto,
    condiciones, notas, notas_internas
  ) values (
    c.cliente_id, c.contacto_id, null, auth.uid(),
    case when c.titulo is null then null else c.titulo || ' (copia)' end,
    coalesce(c.vigencia_dias, v_vigencia, 15), c.tiempo_entrega,
    c.anticipo_pct, c.aplica_iva, c.iva_pct, c.descuento_tipo, c.descuento_valor, c.recargo_pct, c.recargo_concepto,
    c.condiciones, c.notas, c.notas_internas
  )
  returning id into v_nueva;

  perform public.copiar_partidas(c.id, null, v_nueva, null);
  update public.cotizaciones set updated_at = now() where id = v_nueva;

  return v_nueva;
end
$$;
