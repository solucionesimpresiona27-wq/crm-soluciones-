-- =====================================================================
-- 19 · Revisión de seguridad de las fases 2 y 3
--
-- Correcciones (cada una tiene su prueba en tests/db/seguridad_fases2y3.test.ts):
--   1. Comisiones: solo administración cambia el vendedor de una cotización o pedido ya
--      asignado (antes Ventas podía ponerse como vendedor de la venta de otra persona y
--      cobrar su comisión).
--   2. Portal: crear o ver enlaces exige también "ver_precios" (el portal muestra precios;
--      con solo gestionar pedidos/cotizaciones se podían ver totales a través del enlace).
--   3. Corte de caja: un pago o gasto en efectivo que se guarda al mismo tiempo que se cierra
--      la caja ya no queda fuera del corte (candado por día entre el cierre y el efectivo).
--   4. Portal: el nombre y el comentario del cliente se rechazan por tamaño ANTES de
--      procesarlos (un texto de 10 MB ocupaba la base 3 s por llamada).
--   5. Portal: la función de Edge solo firma archivos guardados en pedidos/<id del pedido>/.
--   6. Diseños: la evidencia de una aprobación (quién aprobó, notas, quién la registró y
--      cuándo) solo la cambia quien puede registrar aprobaciones.
--   7. Proveedores: el autor lo pone la base de datos.
--   8. Privilegios por defecto: las funciones, tablas y secuencias que creen migraciones
--      futuras nacen cerradas para "anon" (antes cualquier función nueva era ejecutable
--      sin sesión, por el privilegio PUBLIC).
--
-- No cambia la forma de ninguna tabla ni columna: solo reglas, permisos y funciones.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Vendedor de cotizaciones y pedidos (base de las comisiones)
--    Administración lo cambia libremente. Los demás solo pueden tomar una venta que no
--    tenía vendedor, y únicamente para sí mismos.
-- ---------------------------------------------------------------------
create or replace function public.tg_vendedor_proteger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.vendedor_id is distinct from old.vendedor_id
     and auth.uid() is not null
     and not public.es_admin()
     and not (old.vendedor_id is null and new.vendedor_id = auth.uid()) then
    raise exception 'Solo administración puede cambiar el vendedor de una venta ya asignada (de él dependen las comisiones). Pide el cambio a administración.'
      using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger cotizaciones_vendedor
before update of vendedor_id on public.cotizaciones
for each row execute function public.tg_vendedor_proteger();

create trigger pedidos_vendedor
before update of vendedor_id on public.pedidos
for each row execute function public.tg_vendedor_proteger();

-- ---------------------------------------------------------------------
-- 2. Enlaces del portal: también requieren "ver_precios"
-- ---------------------------------------------------------------------
create or replace function public.crear_enlace_portal(
  p_tipo text,
  p_id uuid,
  p_dias integer default 30,
  p_nuevo boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.portal_enlaces;
begin
  -- El portal muestra precios y totales: compartirlo exige poder verlos.
  if not public.tiene_permiso('ver_precios') then
    raise exception 'No tienes permiso para compartir enlaces del portal: muestran precios y totales' using errcode = '42501';
  end if;

  if p_tipo = 'cotizacion' then
    if not public.tiene_permiso('gestionar_cotizaciones') then
      raise exception 'No tienes permiso para compartir cotizaciones' using errcode = '42501';
    end if;
    if not exists (select 1 from public.cotizaciones where id = p_id) then
      raise exception 'Cotización no encontrada';
    end if;
  elsif p_tipo = 'pedido' then
    if not public.tiene_permiso('gestionar_pedidos') then
      raise exception 'No tienes permiso para compartir pedidos' using errcode = '42501';
    end if;
    if not exists (select 1 from public.pedidos where id = p_id) then
      raise exception 'Pedido no encontrado';
    end if;
  else
    raise exception 'Tipo de enlace inválido: usa cotizacion o pedido';
  end if;

  if coalesce(p_dias, 30) not between 1 and 180 then
    raise exception 'La vigencia del enlace debe ser de 1 a 180 días';
  end if;

  if not coalesce(p_nuevo, false) then
    select * into e
    from public.portal_enlaces pe
    where pe.tipo = p_tipo
      and not pe.revocado
      and pe.expira_at > now() + interval '1 day'
      and (case p_tipo when 'cotizacion' then pe.cotizacion_id else pe.pedido_id end) = p_id
    order by pe.expira_at desc
    limit 1;
    if found then
      return jsonb_build_object('id', e.id, 'token', e.token, 'tipo', e.tipo, 'expira_at', e.expira_at, 'nuevo', false);
    end if;
  end if;

  insert into public.portal_enlaces (tipo, cotizacion_id, pedido_id, expira_at, created_by)
  values (
    p_tipo,
    case when p_tipo = 'cotizacion' then p_id end,
    case when p_tipo = 'pedido' then p_id end,
    now() + make_interval(days => coalesce(p_dias, 30)),
    auth.uid()
  )
  returning * into e;

  return jsonb_build_object('id', e.id, 'token', e.token, 'tipo', e.tipo, 'expira_at', e.expira_at, 'nuevo', true);
end
$$;

-- Los tokens de los enlaces (con los que se abre el portal) tampoco se leen sin "ver_precios".
alter policy "portal_enlaces: ver" on public.portal_enlaces
  using (
    (select public.tiene_permiso('ver_precios'))
    and (
      (tipo = 'cotizacion' and (select public.tiene_permiso('gestionar_cotizaciones')))
      or (tipo = 'pedido' and (select public.tiene_permiso('gestionar_pedidos')))
    )
  );

-- ---------------------------------------------------------------------
-- 3. Corte de caja sin carreras
--    cerrar_caja ya toma un candado exclusivo por día (pg_advisory_xact_lock). Ahora cada
--    pago o gasto en efectivo toma el mismo candado en modo compartido mientras se guarda:
--    el corte espera a que terminen los que ya pasaron la revisión (y los incluye), y los
--    que llegan después esperan al cierre y ya ven la caja cerrada.
-- ---------------------------------------------------------------------
create or replace function public.tg_caja_cerrada()
returns trigger
language plpgsql
security definer
set search_path = ''
set datestyle = 'ISO, MDY'
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb;
  v_campo_metodo text := case tg_table_name when 'gastos' then 'metodo_pago' else 'metodo' end;
  v_campos text[] := case tg_table_name
    when 'gastos' then array['fecha', 'monto', 'metodo_pago', 'cancelado']
    else array['fecha', 'importe', 'tipo', 'metodo', 'cancelado'] end;
  k text;
  v_cambio boolean := false;
  v_dia_antes date;
  v_dia_nuevo date;
  v_fecha date;
begin
  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    foreach k in array v_campos loop
      if (v_new -> k) is distinct from (v_old -> k) then
        v_cambio := true;
      end if;
    end loop;
    if not v_cambio then
      return new;
    end if;
    if v_old ->> v_campo_metodo = 'efectivo' then
      v_dia_antes := (v_old ->> 'fecha')::date;
    end if;
  end if;
  if v_new ->> v_campo_metodo = 'efectivo' then
    v_dia_nuevo := (v_new ->> 'fecha')::date;
  end if;

  -- Candado compartido del día (o de los dos días, en orden) hasta que termine la transacción.
  if v_dia_antes is not null or v_dia_nuevo is not null then
    perform pg_advisory_xact_lock_shared(hashtext('cortes_caja:' || least(v_dia_antes, v_dia_nuevo)::text));
    if v_dia_antes <> v_dia_nuevo then
      perform pg_advisory_xact_lock_shared(hashtext('cortes_caja:' || greatest(v_dia_antes, v_dia_nuevo)::text));
    end if;
  end if;

  if auth.uid() is null or public.es_admin() then
    return new;
  end if;

  if v_dia_antes is not null and exists (select 1 from public.cortes_caja c where c.fecha = v_dia_antes) then
    v_fecha := v_dia_antes;
  elsif v_dia_nuevo is not null and exists (select 1 from public.cortes_caja c where c.fecha = v_dia_nuevo) then
    v_fecha := v_dia_nuevo;
  end if;

  if v_fecha is not null then
    raise exception 'La caja del % ya está cerrada. Pide a administración que la reabra para registrar o cambiar movimientos en efectivo de ese día.',
      to_char(v_fecha, 'DD/MM/YYYY')
      using errcode = '42501';
  end if;
  return new;
end
$$;

-- La llave del candado usa fecha::text: el mismo formato en el cierre y en el efectivo.
alter function public.cerrar_caja(date, numeric, numeric, text) set datestyle = 'ISO, MDY';

-- ---------------------------------------------------------------------
-- 4. Textos del cliente en el portal: tamaño bruto primero
-- ---------------------------------------------------------------------
create or replace function public.portal_texto_cliente(p_nombre text, p_comentario text)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_nombre text;
  v_comentario text;
begin
  -- Un texto enorme se rechaza sin procesarlo (la normalización con expresiones regulares
  -- de varios MB ocupaba la base segundos por llamada).
  if length(coalesce(p_nombre, '')) > 500 then
    raise exception 'Escribe tu nombre (de 2 a 120 caracteres)';
  end if;
  if length(coalesce(p_comentario, '')) > 4000 then
    raise exception 'El comentario puede tener hasta 1000 caracteres';
  end if;

  v_nombre := trim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  v_comentario := nullif(trim(coalesce(p_comentario, '')), '');
  if length(v_nombre) < 2 or length(v_nombre) > 120 then
    raise exception 'Escribe tu nombre (de 2 a 120 caracteres)';
  end if;
  if length(coalesce(v_comentario, '')) > 1000 then
    raise exception 'El comentario puede tener hasta 1000 caracteres';
  end if;
  return array[v_nombre, v_comentario];
end
$$;

-- ---------------------------------------------------------------------
-- 5. Archivos que firma la función de Edge "portal-cliente": solo los guardados en la
--    carpeta del pedido del enlace (pedidos/<pedido_id>/...), sin saltos de carpeta.
--    Así un registro con una ruta equivocada no entrega al cliente un archivo de otro.
-- ---------------------------------------------------------------------
create or replace function public.portal_archivos_firmables(p_token text, p_archivo_id uuid default null)
returns table (id uuid, nombre text, path text, mime text, version integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  e public.portal_enlaces;
  v_pedido uuid;
begin
  e := public.portal_enlace_vigente(p_token);
  v_pedido := public.portal_pedido_de_enlace(e);
  if v_pedido is null then
    return;
  end if;
  return query
  select a.id, a.nombre, a.path, a.mime, a.version
  from public.archivos a
  where a.pedido_id = v_pedido
    and a.categoria = 'diseno'
    and a.path is not null
    and starts_with(a.path, 'pedidos/' || v_pedido::text || '/')
    and position('..' in a.path) = 0
    and (p_archivo_id is null or a.id = p_archivo_id)
  order by a.version desc nulls last, a.created_at desc
  limit 50;
end
$$;

-- ---------------------------------------------------------------------
-- 6. Evidencia de aprobación de diseños
--    Igual que antes, más: si no cambia el estado, "quién registró" y "cuándo" se conservan,
--    y el nombre de quien aprobó y las notas solo los cambia quien tiene "aprobar_disenos"
--    (el portal del cliente actúa sin usuario).
-- ---------------------------------------------------------------------
create or replace function public.tg_archivos_antes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.subido_por := coalesce(auth.uid(), new.subido_por);
    if new.pedido_id is not null and new.cliente_id is null then
      select cliente_id into new.cliente_id from public.pedidos where id = new.pedido_id;
    end if;
    if new.categoria = 'diseno' then
      if new.pedido_id is not null then
        select coalesce(max(version), 0) + 1 into new.version
        from public.archivos where pedido_id = new.pedido_id and categoria = 'diseno';
      end if;
      new.estado_aprobacion := 'pendiente';
    else
      new.version := null;
      new.estado_aprobacion := 'no_aplica';
    end if;
    new.aprobacion_registrada_por := null;
    new.aprobacion_at := null;
    return new;
  end if;

  if new.estado_aprobacion is distinct from old.estado_aprobacion then
    if old.categoria <> 'diseno' then
      raise exception 'Solo los diseños requieren aprobación';
    end if;
    if auth.uid() is not null and not public.tiene_permiso('aprobar_disenos') then
      raise exception 'No tienes permiso para registrar aprobaciones' using errcode = '42501';
    end if;
    new.aprobacion_registrada_por := auth.uid();
    new.aprobacion_at := now();
  else
    new.aprobacion_registrada_por := old.aprobacion_registrada_por;
    new.aprobacion_at := old.aprobacion_at;
    if (new.aprobado_por_nombre is distinct from old.aprobado_por_nombre
        or new.aprobacion_notas is distinct from old.aprobacion_notas)
       and auth.uid() is not null and not public.tiene_permiso('aprobar_disenos') then
      raise exception 'No tienes permiso para cambiar quién aprobó un diseño ni las notas de la aprobación'
        using errcode = '42501';
    end if;
  end if;

  new.pedido_id := old.pedido_id;
  new.categoria := old.categoria;
  new.version := old.version;
  new.subido_por := old.subido_por;
  new.updated_at := now();
  return new;
end
$$;

-- ---------------------------------------------------------------------
-- 7. Proveedores: autor y fecha de alta los pone la base de datos
-- ---------------------------------------------------------------------
create or replace function public.tg_proveedores_autor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end
$$;

create trigger proveedores_autor
before insert or update on public.proveedores
for each row execute function public.tg_proveedores_autor();

-- ---------------------------------------------------------------------
-- 8. Privilegios
-- ---------------------------------------------------------------------
-- Lo que creen migraciones FUTURAS (de este mismo usuario) nace cerrado para anon:
--   funciones: sin PUBLIC ni anon; sí authenticated (validan permisos por dentro) y service_role
--   tablas y secuencias: nada para anon; sin TRUNCATE/REFERENCES/TRIGGER para authenticated
-- Una función nueva para el portal debe darse a anon explícitamente con GRANT.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres in schema public grant execute on functions to authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

-- Secuencias existentes: nada para anon (bitacora_id_seq y portal_respuestas_id_seq tenían UPDATE).
revoke all on all sequences in schema public from anon;

-- Repaso final (cubre también las funciones de esta migración y cualquiera anterior).
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

revoke execute on all functions in schema public from public, anon;
grant execute on function public.portal_obtener(text) to anon;
grant execute on function public.portal_aprobar_cotizacion(text, text, text) to anon;
grant execute on function public.portal_responder_diseno(text, uuid, boolean, text, text) to anon;

revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

notify pgrst, 'reload schema';
