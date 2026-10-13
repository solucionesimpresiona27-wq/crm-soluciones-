-- =====================================================================
-- 16 · Portal del cliente (enlace privado, sin cuenta)
--
-- El cliente abre un enlace con un token secreto de 256 bits y puede:
--   * ver su cotización o pedido (sin costos, sin notas internas, sin datos de otros clientes),
--   * aprobar la cotización (una sola vez, si está vigente),
--   * aprobar o pedir cambios a los diseños pendientes de su pedido.
--
-- Seguridad:
--   * El rol "anon" no puede leer ninguna tabla. Solo puede ejecutar portal_obtener,
--     portal_aprobar_cotizacion y portal_responder_diseno, que validan el token.
--   * Token inválido, vencido o revocado dan exactamente el mismo error.
--   * Los textos que escribe el cliente tienen límite de longitud.
--   * Las imágenes y PDF de diseño (bucket privado) se entregan con URL firmadas de corta
--     duración por la función de Edge "portal-cliente", que llama a portal_archivos_firmables
--     con la llave de servicio (esa función no está disponible para el navegador).
--
-- Usuarios del CRM: crear_enlace_portal y revocar_enlace_portal; las cotizaciones requieren
-- "gestionar_cotizaciones" y los pedidos "gestionar_pedidos".
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- Token aleatorio de 32 bytes (256 bits) en base64url, sin relleno: 43 caracteres.
create or replace function public.generar_token_portal()
returns text
language sql
volatile
set search_path = ''
as $$
  select translate(encode(extensions.gen_random_bytes(32), 'base64'), E'+/=\n', '-_')
$$;

create table public.portal_enlaces (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default public.generar_token_portal(),
  tipo text not null check (tipo in ('cotizacion', 'pedido')),
  cotizacion_id uuid references public.cotizaciones (id) on delete cascade,
  pedido_id uuid references public.pedidos (id) on delete cascade,
  expira_at timestamptz not null default (now() + interval '30 days'),
  revocado boolean not null default false,
  revocado_at timestamptz,
  revocado_por uuid references public.perfiles (id) on delete set null,
  vistas integer not null default 0,
  ultimo_acceso_at timestamptz,
  created_by uuid default auth.uid() references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint portal_enlaces_documento check (
    (tipo = 'cotizacion' and cotizacion_id is not null and pedido_id is null)
    or (tipo = 'pedido' and pedido_id is not null and cotizacion_id is null)
  ),
  constraint portal_enlaces_token_largo check (length(token) between 32 and 128)
);

comment on table public.portal_enlaces is
  'Enlaces privados del portal del cliente. Se crean y revocan con crear_enlace_portal y revocar_enlace_portal.';

create index portal_enlaces_cotizacion_idx on public.portal_enlaces (cotizacion_id) where cotizacion_id is not null;
create index portal_enlaces_pedido_idx on public.portal_enlaces (pedido_id) where pedido_id is not null;

create trigger portal_enlaces_bitacora
after insert or update or delete on public.portal_enlaces
for each row execute function public.tg_bitacora();

-- Respuestas del cliente desde el portal (evidencia de aprobación).
create table public.portal_respuestas (
  id bigint generated always as identity primary key,
  enlace_id uuid not null references public.portal_enlaces (id) on delete cascade,
  accion text not null check (accion in ('aprobar_cotizacion', 'aprobar_diseno', 'cambios_diseno')),
  cotizacion_id uuid references public.cotizaciones (id) on delete cascade,
  pedido_id uuid references public.pedidos (id) on delete cascade,
  archivo_id uuid references public.archivos (id) on delete set null,
  nombre text not null,
  comentario text,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

comment on table public.portal_respuestas is 'Aprobaciones y solicitudes de cambio hechas por clientes desde el portal.';

create index portal_respuestas_enlace_idx on public.portal_respuestas (enlace_id, created_at desc);
create index portal_respuestas_cotizacion_idx on public.portal_respuestas (cotizacion_id) where cotizacion_id is not null;
create index portal_respuestas_pedido_idx on public.portal_respuestas (pedido_id) where pedido_id is not null;

alter table public.portal_enlaces enable row level security;
alter table public.portal_respuestas enable row level security;

revoke all on public.portal_enlaces, public.portal_respuestas from public, anon, authenticated;
-- Solo lectura desde la API: se escriben con funciones.
grant select on public.portal_enlaces, public.portal_respuestas to authenticated;
grant all on public.portal_enlaces, public.portal_respuestas to service_role;

create policy "portal_enlaces: ver" on public.portal_enlaces
  for select to authenticated
  using (
    (tipo = 'cotizacion' and (select public.tiene_permiso('gestionar_cotizaciones')))
    or (tipo = 'pedido' and (select public.tiene_permiso('gestionar_pedidos')))
  );

create policy "portal_respuestas: ver" on public.portal_respuestas
  for select to authenticated
  using (
    (select public.tiene_permiso('gestionar_cotizaciones'))
    or (select public.tiene_permiso('gestionar_pedidos'))
    or (select public.tiene_permiso('aprobar_disenos'))
  );

-- ---------------------------------------------------------------------
-- Funciones para usuarios del CRM
-- ---------------------------------------------------------------------
-- Crea (o reutiliza) el enlace de una cotización o pedido.
-- Si ya hay un enlace vigente con más de un día por delante, lo devuelve,
-- salvo que p_nuevo = true. Respuesta: {id, token, tipo, expira_at, nuevo}
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

create or replace function public.revocar_enlace_portal(p_enlace uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.portal_enlaces;
begin
  select * into e from public.portal_enlaces where id = p_enlace for update;
  if not found then
    raise exception 'Enlace no encontrado';
  end if;
  if not ((e.tipo = 'cotizacion' and public.tiene_permiso('gestionar_cotizaciones'))
          or (e.tipo = 'pedido' and public.tiene_permiso('gestionar_pedidos'))) then
    raise exception 'No tienes permiso para revocar este enlace' using errcode = '42501';
  end if;
  if e.revocado then
    return;
  end if;
  update public.portal_enlaces
  set revocado = true, revocado_at = now(), revocado_por = auth.uid()
  where id = p_enlace;
end
$$;

-- ---------------------------------------------------------------------
-- Utilidades internas del portal (no se exponen al navegador)
-- ---------------------------------------------------------------------
-- Devuelve el enlace si el token es válido, vigente y no revocado. Cualquier otro
-- caso da el mismo error, sin revelar si el token existe.
create or replace function public.portal_enlace_vigente(p_token text)
returns public.portal_enlaces
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.portal_enlaces;
begin
  if p_token is null or length(p_token) not between 32 and 128 or p_token !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Este enlace no es válido o ya venció. Pide uno nuevo a tu asesor.' using errcode = 'PT404';
  end if;
  select * into e
  from public.portal_enlaces pe
  where pe.token = p_token and not pe.revocado and pe.expira_at > now();
  if not found then
    raise exception 'Este enlace no es válido o ya venció. Pide uno nuevo a tu asesor.' using errcode = 'PT404';
  end if;
  return e;
end
$$;

-- Pedido que se puede consultar con el enlace: el del enlace o el que salió de la cotización.
create or replace function public.portal_pedido_de_enlace(e public.portal_enlaces)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case e.tipo
    when 'pedido' then e.pedido_id
    else (select q.pedido_id from public.cotizaciones q where q.id = e.cotizacion_id)
  end
$$;

-- Conceptos visibles para el cliente (sin costos ni notas de producción).
create or replace function public.portal_partidas(p_cotizacion uuid, p_pedido uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'orden', pa.orden,
    'tipo', pa.tipo,
    'concepto', pa.concepto,
    'descripcion', pa.descripcion,
    'metodo_calculo', pa.metodo_calculo,
    'unidad', pa.unidad,
    'ancho', pa.ancho,
    'alto', pa.alto,
    'largo', pa.largo,
    'cantidad', pa.cantidad,
    'precio_unitario', pa.precio_unitario,
    'descuento_pct', pa.descuento_pct,
    'importe', pa.importe
  ) order by pa.orden, pa.created_at), '[]'::jsonb)
  from public.partidas pa
  where (p_cotizacion is not null and pa.cotizacion_id = p_cotizacion)
     or (p_pedido is not null and pa.pedido_id = p_pedido)
$$;

-- Nombre y comentario del cliente: espacios normalizados y longitud limitada.
create or replace function public.portal_texto_cliente(p_nombre text, p_comentario text)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_nombre text := trim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  v_comentario text := nullif(trim(coalesce(p_comentario, '')), '');
begin
  if length(v_nombre) < 2 or length(v_nombre) > 120 then
    raise exception 'Escribe tu nombre (de 2 a 120 caracteres)';
  end if;
  if length(coalesce(v_comentario, '')) > 1000 then
    raise exception 'El comentario puede tener hasta 1000 caracteres';
  end if;
  return array[v_nombre, v_comentario];
end
$$;

-- IP y navegador de quien responde (evidencia), si la API los proporciona.
create or replace function public.portal_origen_solicitud()
returns text[]
language plpgsql
stable
set search_path = ''
as $$
declare
  h jsonb;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    h := null;
  end;
  return array[
    left(coalesce(h ->> 'cf-connecting-ip', h ->> 'x-real-ip', trim(split_part(h ->> 'x-forwarded-for', ',', 1))), 100),
    left(h ->> 'user-agent', 300)
  ];
end
$$;

-- ---------------------------------------------------------------------
-- Funciones públicas (rol anon) del portal
-- ---------------------------------------------------------------------
-- Datos saneados del documento. Respuesta:
-- { tipo, expira_at,
--   empresa: {nombre, eslogan, ciudad, direccion, telefono, whatsapp, email, sitio_web, instagram,
--             facebook, tiktok, logo_url, color_primario, color_secundario, datos_bancarios,
--             rfc?, razon_social?, regimen_fiscal? (solo si mostrar_datos_fiscales)},
--   cotizacion?: {folio, titulo, fecha, fecha_vencimiento, vigente, estado, cliente, contacto, vendedor,
--                 tiempo_entrega, anticipo_pct, anticipo, aplica_iva, iva_pct, subtotal, descuento,
--                 recargo_pct, recargo_concepto, recargo, iva, total, condiciones, notas, enviada_at,
--                 aceptada_at, puede_aprobar, aprobacion: {nombre, fecha}?, partidas: [...]},
--   pedido?: {folio, titulo, estado, estado_pago, cliente, fecha_entrega, requiere_instalacion,
--             created_at, entregado_at, anticipo_pct, subtotal, descuento, recargo, iva, total, pagado,
--             saldo, condiciones, etapas: [...], linea_tiempo: [{estado, fecha}], partidas: [...],
--             disenos: [{id, nombre, version, estado_aprobacion, mime, tiene_archivo, enlace_externo,
--                        created_at, aprobado_por_nombre, aprobacion_at, puede_responder}]} }
create or replace function public.portal_obtener(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'America/Mexico_City'
as $$
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
      'partidas', public.portal_partidas(q.id, null)
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
$$;

-- El cliente aprueba la cotización (una sola vez, si está vigente y sin convertir).
create or replace function public.portal_aprobar_cotizacion(
  p_token text,
  p_nombre text,
  p_comentario text default null
)
returns jsonb
language plpgsql
volatile
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

-- El cliente aprueba un diseño o pide cambios (usa la lógica de aprobación de archivos:
-- el pedido avanza a "aprobado" o regresa a "en diseño").
create or replace function public.portal_responder_diseno(
  p_token text,
  p_archivo_id uuid,
  p_aprobado boolean,
  p_nombre text,
  p_comentario text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'America/Mexico_City'
as $$
declare
  e public.portal_enlaces;
  a public.archivos;
  v_pedido uuid;
  v_estado_pedido public.estado_pedido;
  v_txt text[];
  v_origen text[];
  v_nuevo public.estado_archivo;
begin
  e := public.portal_enlace_vigente(p_token);
  v_txt := public.portal_texto_cliente(p_nombre, p_comentario);
  if p_aprobado is null then
    raise exception 'Indica si apruebas el diseño o necesitas cambios';
  end if;
  if not p_aprobado and v_txt[2] is null then
    raise exception 'Cuéntanos qué cambios necesitas';
  end if;

  v_pedido := public.portal_pedido_de_enlace(e);
  if v_pedido is null then
    raise exception 'Este enlace no tiene diseños para revisar';
  end if;

  select * into a
  from public.archivos
  where id = p_archivo_id and pedido_id = v_pedido and categoria = 'diseno'
  for update;
  if not found then
    raise exception 'Diseño no encontrado';
  end if;
  if a.estado_aprobacion <> 'pendiente' then
    raise exception 'Este diseño ya tiene una respuesta registrada';
  end if;

  select estado into v_estado_pedido from public.pedidos where id = v_pedido;
  if v_estado_pedido in ('cancelado', 'finalizado') then
    raise exception 'Este pedido ya no admite cambios. Comunícate con tu asesor.';
  end if;

  v_nuevo := case when p_aprobado then 'aprobado' else 'cambios' end;

  update public.archivos
  set estado_aprobacion = v_nuevo,
      aprobado_por_nombre = v_txt[1],
      aprobacion_notas = 'Respuesta desde el portal del cliente' || coalesce(': ' || v_txt[2], '')
  where id = a.id;

  v_origen := public.portal_origen_solicitud();
  insert into public.portal_respuestas (enlace_id, accion, pedido_id, archivo_id, nombre, comentario, ip, user_agent)
  values (e.id, case when p_aprobado then 'aprobar_diseno' else 'cambios_diseno' end, v_pedido, a.id,
          v_txt[1], v_txt[2], v_origen[1], v_origen[2]);

  return jsonb_build_object(
    'ok', true,
    'archivo_id', a.id,
    'version', a.version,
    'estado_aprobacion', v_nuevo,
    'estado_pedido', (select estado from public.pedidos where id = v_pedido)
  );
end
$$;

-- Diseños con archivo que la función de Edge "portal-cliente" puede firmar.
-- Solo para la llave de servicio.
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
    and (p_archivo_id is null or a.id = p_archivo_id)
  order by a.version desc nulls last, a.created_at desc
  limit 50;
end
$$;

-- ---------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------
revoke execute on function public.generar_token_portal() from public, anon, authenticated;
revoke execute on function public.crear_enlace_portal(text, uuid, integer, boolean) from public, anon;
revoke execute on function public.revocar_enlace_portal(uuid) from public, anon;
revoke execute on function public.portal_enlace_vigente(text) from public, anon, authenticated;
revoke execute on function public.portal_pedido_de_enlace(public.portal_enlaces) from public, anon, authenticated;
revoke execute on function public.portal_partidas(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.portal_texto_cliente(text, text) from public, anon, authenticated;
revoke execute on function public.portal_origen_solicitud() from public, anon, authenticated;
revoke execute on function public.portal_archivos_firmables(text, uuid) from public, anon, authenticated;
revoke execute on function public.portal_obtener(text) from public;
revoke execute on function public.portal_aprobar_cotizacion(text, text, text) from public;
revoke execute on function public.portal_responder_diseno(text, uuid, boolean, text, text) from public;

grant execute on function public.generar_token_portal() to service_role;
grant execute on function public.crear_enlace_portal(text, uuid, integer, boolean) to authenticated, service_role;
grant execute on function public.revocar_enlace_portal(uuid) to authenticated, service_role;
grant execute on function public.portal_archivos_firmables(text, uuid) to service_role;
grant execute on function public.portal_obtener(text) to anon, authenticated, service_role;
grant execute on function public.portal_aprobar_cotizacion(text, text, text) to anon, authenticated, service_role;
grant execute on function public.portal_responder_diseno(text, uuid, boolean, text, text) to anon, authenticated, service_role;
