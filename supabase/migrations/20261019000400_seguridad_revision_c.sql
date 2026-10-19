-- =====================================================================
-- 25 · Revisión de seguridad (ronda 3): ajustes a 20261019000300
--
-- 3d-bis. La excepción "producto a nulo" de tg_partidas_cotizacion_congelada solo aplica a la
--         cascada ON DELETE SET NULL del catálogo (producto borrado, pg_trigger_depth() > 1).
--         Antes un UPDATE directo de producto_id a nulo en una cotización aceptada o convertida
--         pasaba y tg_partida_costo_estimado borraba sus costos (Ventas, sin ver_costos).
-- 2e.     clientes_operacion.busqueda: búsqueda sin acentos (normalizar) para ligar clientes en
--         la Agenda. Con permiso de clientes es clientes.busqueda (nombre, teléfonos, correo, RFC,
--         razón social); sin él, solo nombre y los teléfonos que el rol ve.
-- Pruebas en tests/db/seguridad_revision.test.ts (ronda 3).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 3d-bis. Producto a nulo solo por la cascada del catálogo.
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
  --     Solo vale dentro de la cascada del catálogo (pg_trigger_depth() > 1) y cuando el producto
  --     ya no existe; un UPDATE directo de producto_id a nulo es un cambio y se rechaza (3d-bis).
  if tg_op = 'UPDATE'
     and old.producto_id is not null and new.producto_id is null
     and pg_trigger_depth() > 1
     and not exists (select 1 from public.productos pr where pr.id = old.producto_id)
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

-- ---------------------------------------------------------------------
-- 2e. clientes_operacion con columna de búsqueda (igual que 20261019000300, más la columna al final).
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
  (pm.completo or coalesce(pe.en_proceso, false)) as contacto_visible,
  -- Búsqueda sin acentos, igual que clientes.busqueda, pero solo con lo que el rol ve.
  case when pm.completo then c.busqueda
       else public.normalizar(
              c.nombre || ' ' || coalesce(case when coalesce(pe.en_proceso, false) then c.telefono end, '')
              || ' ' || coalesce(case when coalesce(pe.en_proceso, false) then c.whatsapp end, ''))
  end as busqueda
from public.clientes c
cross join (select public.puede_ver_clientes() as completo offset 0) pm  -- offset 0: una sola evaluación, no una por renglón
left join lateral (
  select bool_or(public.pedido_en_proceso(p.estado)) as en_proceso
  from public.pedidos p
  where p.cliente_id = c.id
) pe on true
where (select public.usuario_activo())
  and (pm.completo or pe.en_proceso is not null);

comment on column public.clientes_operacion.contacto_visible is
  'false: el cliente puede tener WhatsApp o teléfono, pero tu rol no lo ve porque sus pedidos ya se cerraron.';
comment on column public.clientes_operacion.busqueda is
  'Texto sin acentos y en minúsculas para buscar (normalizar); solo incluye los datos que tu rol ve.';

notify pgrst, 'reload schema';
