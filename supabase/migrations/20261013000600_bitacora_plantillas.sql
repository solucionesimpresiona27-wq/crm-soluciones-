-- =====================================================================
-- 06 · Bitácora de cambios y plantillas de mensajes de WhatsApp
-- =====================================================================

create table public.bitacora (
  id bigint generated always as identity primary key,
  tabla text not null,
  registro_id text,
  accion text not null check (accion in ('crear', 'modificar', 'eliminar', 'cambio_estado', 'aprobar', 'cancelar')),
  etiqueta text,
  -- Para modificaciones: {"campo": [antes, después]}
  cambios jsonb,
  -- Para altas y bajas: copia del registro
  datos jsonb,
  usuario_id uuid references public.perfiles (id) on delete set null,
  usuario_nombre text,
  created_at timestamptz not null default now()
);

comment on table public.bitacora is 'Registro de quién creó, modificó, aprobó, canceló o eliminó información.';

create index bitacora_fecha_idx on public.bitacora (created_at desc);
create index bitacora_registro_idx on public.bitacora (tabla, registro_id);
create index bitacora_usuario_idx on public.bitacora (usuario_id, created_at desc);

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
    'aprobacion_at', 'aprobacion_registrada_por', 'cancelado_por'
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
  end if;

  v_id := coalesce(v_reg ->> 'id', v_reg ->> 'partida_id', v_reg ->> 'producto_id', v_reg ->> 'tipo');

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
    coalesce(v_nombre, case when auth.uid() is null then 'Sistema' end)
  );

  return null;
end
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'perfiles', 'configuracion', 'folios', 'clientes', 'contactos', 'oportunidades', 'categorias',
    'productos', 'producto_costos', 'cotizaciones', 'pedidos', 'partidas', 'partida_costos', 'pagos', 'archivos'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.tg_bitacora()',
      t || '_bitacora', t
    );
  end loop;
end
$$;

alter table public.bitacora enable row level security;

revoke all on public.bitacora from anon;
grant select on public.bitacora to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy "bitacora: ver admin" on public.bitacora
  for select to authenticated
  using ((select public.es_admin()));

-- ---------------------------------------------------------------------
-- Plantillas de mensajes de WhatsApp
-- Variables disponibles: {cliente} {contacto} {folio} {titulo} {total} {saldo} {monto}
-- {anticipo} {vigencia} {fecha_entrega} {enlace} {empresa} {vendedor}
-- ---------------------------------------------------------------------
create table public.plantillas_mensaje (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  nombre text not null,
  contexto text not null default 'general' check (contexto in ('general', 'cliente', 'cotizacion', 'pedido', 'pago')),
  texto text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger plantillas_mensaje_updated_at
before update on public.plantillas_mensaje
for each row execute function public.tg_updated_at();

create trigger plantillas_mensaje_bitacora
after insert or update or delete on public.plantillas_mensaje
for each row execute function public.tg_bitacora();

alter table public.plantillas_mensaje enable row level security;

revoke all on public.plantillas_mensaje from anon;
grant select, insert, update, delete on public.plantillas_mensaje to authenticated;

create policy "plantillas: ver" on public.plantillas_mensaje
  for select to authenticated
  using ((select public.usuario_activo()));

create policy "plantillas: administrar" on public.plantillas_mensaje
  for all to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

insert into public.plantillas_mensaje (clave, nombre, contexto, orden, texto) values
  ('saludo', 'Saludo', 'cliente', 10,
   E'Hola {cliente} 👋, te saluda {vendedor} de {empresa}. ¿En qué te podemos ayudar?'),
  ('cotizacion_envio', 'Envío de cotización', 'cotizacion', 20,
   E'Hola {cliente} 👋, te compartimos la cotización *{folio}* por *{total}*.\n\n{enlace}\n\nVigencia: {vigencia}. Anticipo para iniciar: {anticipo}.\nQuedamos atentos a tus comentarios. ¡Gracias por considerar a {empresa}!'),
  ('cotizacion_seguimiento', 'Seguimiento de cotización', 'cotizacion', 30,
   E'Hola {cliente}, ¿pudiste revisar la cotización *{folio}*? Con gusto resolvemos tus dudas o hacemos ajustes. La cotización es válida hasta el {vigencia}.'),
  ('anticipo_recibido', 'Anticipo recibido', 'pago', 40,
   E'Hola {cliente}, confirmamos la recepción de tu anticipo de *{monto}* para el pedido *{folio}*. ✅\nSaldo pendiente: {saldo}.\n¡Comenzamos con tu proyecto!'),
  ('pago_recibido', 'Pago recibido', 'pago', 50,
   E'Hola {cliente}, recibimos tu pago de *{monto}* para el pedido *{folio}*. ✅\nSaldo pendiente: {saldo}.\n¡Gracias!'),
  ('diseno_revision', 'Diseño para aprobación', 'pedido', 60,
   E'Hola {cliente}, te compartimos la propuesta de diseño de tu pedido *{folio}*. Por favor revísala y confírmanos tu aprobación para pasar a producción. Cualquier cambio posterior a la aprobación puede generar costos adicionales.'),
  ('pedido_listo', 'Pedido listo', 'pedido', 70,
   E'Hola {cliente}, ¡tu pedido *{folio}* está listo! 🎉\nSaldo pendiente: {saldo}.\n¿Cuándo te gustaría recogerlo o coordinar la entrega/instalación?'),
  ('instalacion_programada', 'Instalación programada', 'pedido', 80,
   E'Hola {cliente}, te confirmamos la instalación de tu pedido *{folio}* para el {fecha_entrega}. Te avisaremos cuando vayamos en camino.'),
  ('recordatorio_pago', 'Recordatorio de pago', 'pago', 90,
   E'Hola {cliente}, te recordamos amablemente que el pedido *{folio}* tiene un saldo pendiente de *{saldo}*. Si ya realizaste el pago, por favor envíanos tu comprobante. ¡Gracias!'),
  ('agradecimiento', 'Agradecimiento', 'pedido', 100,
   E'Hola {cliente}, ¡gracias por confiar en {empresa}! Esperamos que tu pedido *{folio}* haya quedado como lo imaginaste. Nos encantaría ver tu opinión o una foto en nuestras redes 💛'),
  ('reactivacion', 'Volver a contactar', 'cliente', 110,
   E'Hola {cliente}, ¡hace tiempo que no sabemos de ti! En {empresa} tenemos nuevas opciones en impresión, publicidad y servicios digitales. ¿Tienes algún proyecto en mente?');
