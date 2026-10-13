-- =====================================================================
-- 04 · Ventas y operación: cotizaciones, pedidos, partidas, costos,
--      pagos, eventos de pedido y archivos
-- =====================================================================

-- ---------------------------------------------------------------------
-- Cotizaciones
-- ---------------------------------------------------------------------
create table public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  contacto_id uuid references public.contactos (id) on delete set null,
  oportunidad_id uuid references public.oportunidades (id) on delete set null,
  vendedor_id uuid default auth.uid() references public.perfiles (id) on delete set null,
  titulo text,
  fecha date not null default current_date,
  vigencia_dias integer not null default 15 check (vigencia_dias between 1 and 365),
  fecha_vencimiento date generated always as (fecha + vigencia_dias) stored,
  estado public.estado_cotizacion not null default 'borrador',
  motivo_rechazo text,
  tiempo_entrega text,
  anticipo_pct numeric(5, 2) not null default 50 check (anticipo_pct between 0 and 100),
  aplica_iva boolean not null default true,
  iva_pct numeric(5, 2) not null default 16 check (iva_pct between 0 and 100),
  descuento_tipo text not null default 'monto' check (descuento_tipo in ('monto', 'pct')),
  descuento_valor numeric(12, 2) not null default 0 check (descuento_valor >= 0),
  recargo_pct numeric(5, 2) not null default 0 check (recargo_pct between 0 and 100),
  recargo_concepto text not null default 'Recargo por urgencia',
  -- Totales calculados por la base de datos
  subtotal numeric(12, 2) not null default 0,
  descuento numeric(12, 2) not null default 0,
  recargo numeric(12, 2) not null default 0,
  iva numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  condiciones text,
  notas text,
  notas_internas text,
  pedido_id uuid,
  enviada_at timestamptz,
  aceptada_at timestamptz,
  pdf_path text,
  created_by uuid default auth.uid() references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.cotizaciones.recargo_pct is 'Recargo (p. ej. por urgencia) sobre el subtotal menos descuento.';

create index cotizaciones_cliente_idx on public.cotizaciones (cliente_id);
create index cotizaciones_estado_idx on public.cotizaciones (estado, fecha_vencimiento);
create index cotizaciones_fecha_idx on public.cotizaciones (fecha desc);
create index cotizaciones_oportunidad_idx on public.cotizaciones (oportunidad_id);

create trigger cotizaciones_folio
before insert on public.cotizaciones
for each row execute function public.tg_asignar_folio('cotizacion');

-- ---------------------------------------------------------------------
-- Pedidos / órdenes de trabajo
-- ---------------------------------------------------------------------
create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  cotizacion_id uuid references public.cotizaciones (id) on delete set null,
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  contacto_id uuid references public.contactos (id) on delete set null,
  vendedor_id uuid default auth.uid() references public.perfiles (id) on delete set null,
  responsable_id uuid references public.perfiles (id) on delete set null,
  disenador_id uuid references public.perfiles (id) on delete set null,
  titulo text not null check (length(trim(titulo)) > 0),
  descripcion text,
  estado public.estado_pedido not null default 'nuevo',
  estado_anterior public.estado_pedido,
  motivo_estado text,
  etapas_omitidas public.estado_pedido[] not null default '{}',
  prioridad public.prioridad not null default 'normal',
  fecha_entrega date,
  requiere_instalacion boolean not null default false,
  direccion_instalacion text,
  -- Montos
  anticipo_pct numeric(5, 2) not null default 50 check (anticipo_pct between 0 and 100),
  aplica_iva boolean not null default true,
  iva_pct numeric(5, 2) not null default 16 check (iva_pct between 0 and 100),
  descuento_tipo text not null default 'monto' check (descuento_tipo in ('monto', 'pct')),
  descuento_valor numeric(12, 2) not null default 0 check (descuento_valor >= 0),
  recargo_pct numeric(5, 2) not null default 0 check (recargo_pct between 0 and 100),
  recargo_concepto text not null default 'Recargo por urgencia',
  subtotal numeric(12, 2) not null default 0,
  descuento numeric(12, 2) not null default 0,
  recargo numeric(12, 2) not null default 0,
  iva numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  condiciones text,
  -- Cobranza (calculado a partir de los pagos)
  pagado numeric(12, 2) not null default 0,
  saldo numeric(12, 2) generated always as (total - pagado) stored,
  estado_pago public.estado_pago not null default 'pendiente',
  fecha_limite_pago date,
  -- Facturación externa
  requiere_factura boolean not null default false,
  facturado boolean not null default false,
  folio_factura text,
  fecha_factura date,
  notas_internas text,
  entregado_at timestamptz,
  finalizado_at timestamptz,
  cancelado_at timestamptz,
  created_by uuid default auth.uid() references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pedidos_cliente_idx on public.pedidos (cliente_id);
create index pedidos_estado_idx on public.pedidos (estado);
create index pedidos_entrega_idx on public.pedidos (fecha_entrega);
create index pedidos_responsable_idx on public.pedidos (responsable_id);
create index pedidos_disenador_idx on public.pedidos (disenador_id);
create index pedidos_saldo_idx on public.pedidos (estado_pago) where estado <> 'cancelado';

alter table public.cotizaciones
  add constraint cotizaciones_pedido_fk foreign key (pedido_id) references public.pedidos (id) on delete set null;

create trigger pedidos_folio
before insert on public.pedidos
for each row execute function public.tg_asignar_folio('pedido');

-- ---------------------------------------------------------------------
-- Partidas (conceptos) de cotizaciones y pedidos
-- ---------------------------------------------------------------------
create table public.partidas (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid references public.cotizaciones (id) on delete cascade,
  pedido_id uuid references public.pedidos (id) on delete cascade,
  orden integer not null default 0,
  tipo public.tipo_partida not null default 'concepto',
  producto_id uuid references public.productos (id) on delete set null,
  concepto text not null check (length(trim(concepto)) > 0),
  descripcion text,
  metodo_calculo public.metodo_calculo not null default 'pieza',
  unidad text not null default 'pza',
  ancho numeric(10, 3) check (ancho >= 0),
  alto numeric(10, 3) check (alto >= 0),
  largo numeric(10, 3) check (largo >= 0),
  cantidad numeric(12, 3) not null default 1 check (cantidad > 0),
  precio_unitario numeric(12, 2) not null default 0 check (precio_unitario >= 0),
  descuento_pct numeric(5, 2) not null default 0 check (descuento_pct between 0 and 100),
  importe numeric(12, 2) generated always as (
    round(cantidad * precio_unitario * (1 - descuento_pct / 100), 2)
  ) stored,
  notas_produccion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partidas_un_documento check (num_nonnulls(cotizacion_id, pedido_id) = 1)
);

comment on column public.partidas.cantidad is
  'Unidades de venta: piezas (m², metro lineal, pieza), millares, horas, meses, etc.';
comment on column public.partidas.precio_unitario is 'Precio por unidad de venta (por pieza en m² y metro lineal).';

create index partidas_cotizacion_idx on public.partidas (cotizacion_id, orden);
create index partidas_pedido_idx on public.partidas (pedido_id, orden);

create trigger partidas_updated_at
before update on public.partidas
for each row execute function public.tg_updated_at();

-- Costos por partida (restringido a "ver_costos")
create table public.partida_costos (
  partida_id uuid primary key references public.partidas (id) on delete cascade,
  costo_material numeric(12, 4) not null default 0 check (costo_material >= 0),
  costo_mano_obra numeric(12, 4) not null default 0 check (costo_mano_obra >= 0),
  costo_fijo numeric(12, 2) not null default 0 check (costo_fijo >= 0),
  desperdicio_pct numeric(5, 2) not null default 0 check (desperdicio_pct between 0 and 100),
  ganancia_pct numeric(7, 2) not null default 0 check (ganancia_pct >= 0),
  costo_total numeric(12, 2) not null default 0 check (costo_total >= 0),
  -- Detalle del cálculo; "origen": "catalogo" (estimado automático) o "manual"
  calculo jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger partida_costos_updated_at
before update on public.partida_costos
for each row execute function public.tg_updated_at();

-- ---------------------------------------------------------------------
-- Pagos
-- ---------------------------------------------------------------------
create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete restrict,
  cliente_id uuid references public.clientes (id) on delete restrict,
  fecha date not null default current_date,
  importe numeric(12, 2) not null check (importe > 0),
  tipo public.tipo_pago not null default 'abono',
  metodo public.metodo_pago not null,
  referencia text,
  comprobante_path text,
  notas text,
  registrado_por uuid default auth.uid() references public.perfiles (id) on delete set null,
  cancelado boolean not null default false,
  motivo_cancelacion text,
  cancelado_por uuid references public.perfiles (id) on delete set null,
  cancelado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pagos_pedido_idx on public.pagos (pedido_id);
create index pagos_cliente_idx on public.pagos (cliente_id);
create index pagos_fecha_idx on public.pagos (fecha desc);

-- ---------------------------------------------------------------------
-- Eventos (línea de tiempo) del pedido
-- ---------------------------------------------------------------------
create table public.pedido_eventos (
  id bigint generated always as identity primary key,
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  tipo text not null check (tipo in ('creado', 'estado', 'nota', 'pago', 'archivo', 'aprobacion', 'asignacion', 'factura')),
  estado_de public.estado_pedido,
  estado_a public.estado_pedido,
  mensaje text,
  usuario_id uuid default auth.uid() references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index pedido_eventos_pedido_idx on public.pedido_eventos (pedido_id, created_at desc);

-- ---------------------------------------------------------------------
-- Archivos: diseños (con versiones y aprobación), referencias y evidencias
-- ---------------------------------------------------------------------
create table public.archivos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references public.pedidos (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete cascade,
  categoria text not null default 'diseno' check (categoria in ('diseno', 'referencia', 'evidencia', 'otro')),
  nombre text not null check (length(trim(nombre)) > 0),
  path text,
  enlace_externo text,
  mime text,
  tamano bigint,
  version integer,
  estado_aprobacion public.estado_archivo not null default 'no_aplica',
  aprobado_por_nombre text,
  aprobacion_notas text,
  aprobacion_registrada_por uuid references public.perfiles (id) on delete set null,
  aprobacion_at timestamptz,
  subido_por uuid default auth.uid() references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint archivos_origen check (path is not null or enlace_externo is not null),
  constraint archivos_relacion check (pedido_id is not null or cliente_id is not null)
);

create index archivos_pedido_idx on public.archivos (pedido_id, created_at desc);
create index archivos_cliente_idx on public.archivos (cliente_id);

-- =====================================================================
-- Reglas automáticas
-- =====================================================================

-- Totales de cotizaciones y pedidos. Para pedidos también calcula pagado y estado de pago.
create or replace function public.tg_calcular_totales()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub numeric(12, 2);
  v_pagado numeric(12, 2);
  v_hubo_pagos boolean;
  v_solo_anticipos boolean;
begin
  if tg_table_name = 'cotizaciones' then
    select coalesce(sum(importe), 0) into v_sub from public.partidas where cotizacion_id = new.id;
  else
    select coalesce(sum(importe), 0) into v_sub from public.partidas where pedido_id = new.id;
  end if;

  new.subtotal := v_sub;
  new.descuento := least(v_sub, round(
    case when new.descuento_tipo = 'pct'
      then v_sub * least(new.descuento_valor, 100) / 100
      else new.descuento_valor
    end, 2));
  new.recargo := round((v_sub - new.descuento) * new.recargo_pct / 100, 2);
  new.iva := case when new.aplica_iva
    then round((v_sub - new.descuento + new.recargo) * new.iva_pct / 100, 2)
    else 0 end;
  new.total := v_sub - new.descuento + new.recargo + new.iva;

  if tg_table_name = 'pedidos' then
    select
      coalesce(sum(case when tipo = 'devolucion' then -importe else importe end), 0),
      coalesce(bool_or(tipo <> 'devolucion'), false),
      coalesce(bool_and(tipo = 'anticipo') filter (where tipo <> 'devolucion'), false)
    into v_pagado, v_hubo_pagos, v_solo_anticipos
    from public.pagos
    where pedido_id = new.id and not cancelado;

    new.pagado := v_pagado;
    new.estado_pago := case
      when v_pagado <= 0 and v_hubo_pagos then 'reembolsado'
      when v_pagado <= 0 then 'pendiente'
      when new.total > 0 and v_pagado >= new.total then 'liquidado'
      when v_solo_anticipos then 'anticipo'
      else 'parcial'
    end::public.estado_pago;
  end if;

  new.updated_at := now();
  return new;
end
$$;

create trigger cotizaciones_totales
before insert or update on public.cotizaciones
for each row execute function public.tg_calcular_totales();

create trigger pedidos_totales
before insert or update on public.pedidos
for each row execute function public.tg_calcular_totales();

-- Al cambiar partidas o pagos se "toca" el documento para recalcular sus totales.
create or replace function public.tg_partidas_tocar_documento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if old.cotizacion_id is not null then
      update public.cotizaciones set updated_at = now() where id = old.cotizacion_id;
    end if;
    if old.pedido_id is not null then
      update public.pedidos set updated_at = now() where id = old.pedido_id;
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    if new.cotizacion_id is not null
       and (tg_op = 'INSERT' or new.cotizacion_id is distinct from old.cotizacion_id) then
      update public.cotizaciones set updated_at = now() where id = new.cotizacion_id;
    end if;
    if new.pedido_id is not null
       and (tg_op = 'INSERT' or new.pedido_id is distinct from old.pedido_id) then
      update public.pedidos set updated_at = now() where id = new.pedido_id;
    end if;
  end if;
  return null;
end
$$;

create trigger partidas_tocar_documento
after insert or update or delete on public.partidas
for each row execute function public.tg_partidas_tocar_documento();

-- Costo estimado de cada partida.
-- Si la partida ya tiene costos (manuales o del catálogo) los usa por unidad;
-- si no, y viene de un producto con costos, toma los del catálogo.
create or replace function public.tg_partida_costo_estimado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pc public.partida_costos;
  v_cat public.producto_costos;
  v_unidades numeric;
begin
  v_unidades := public.unidades_cobro(new.metodo_calculo, new.cantidad, new.ancho, new.alto, new.largo);

  select * into v_pc from public.partida_costos where partida_id = new.id;

  if found then
    -- Si cambió el producto y el costo venía del catálogo, se vuelve a tomar del nuevo producto.
    if tg_op = 'UPDATE' and new.producto_id is distinct from old.producto_id
       and coalesce(v_pc.calculo ->> 'origen', 'manual') = 'catalogo' then
      delete from public.partida_costos where partida_id = new.id;
    else
      update public.partida_costos
      set costo_total = round(
            (costo_material * (1 + desperdicio_pct / 100) + costo_mano_obra) * v_unidades + costo_fijo, 2),
          calculo = calculo || jsonb_build_object('unidades', v_unidades)
      where partida_id = new.id;
      return null;
    end if;
  end if;

  if new.producto_id is null then
    return null;
  end if;

  select * into v_cat from public.producto_costos where producto_id = new.producto_id;
  if not found then
    return null;
  end if;

  insert into public.partida_costos (
    partida_id, costo_material, costo_mano_obra, costo_fijo, desperdicio_pct, ganancia_pct, costo_total, calculo
  ) values (
    new.id, v_cat.costo_material, v_cat.costo_mano_obra, v_cat.costo_fijo, v_cat.desperdicio_pct, v_cat.ganancia_pct,
    round((v_cat.costo_material * (1 + v_cat.desperdicio_pct / 100) + v_cat.costo_mano_obra) * v_unidades
          + v_cat.costo_fijo, 2),
    jsonb_build_object('origen', 'catalogo', 'unidades', v_unidades)
  )
  on conflict (partida_id) do nothing;

  return null;
end
$$;

create trigger partidas_costo_estimado
after insert or update of producto_id, metodo_calculo, cantidad, ancho, alto, largo on public.partidas
for each row execute function public.tg_partida_costo_estimado();

-- Estados de la cotización: fechas y avance de la oportunidad ligada.
create or replace function public.tg_cotizaciones_estado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.estado is distinct from old.estado then
    if new.estado = 'enviada' then
      new.enviada_at := coalesce(new.enviada_at, now());
    elsif new.estado = 'aceptada' then
      new.aceptada_at := coalesce(new.aceptada_at, now());
    end if;
    if new.estado <> 'rechazada' then
      new.motivo_rechazo := null;
    end if;
  end if;
  return new;
end
$$;

create trigger cotizaciones_estado
before insert or update of estado on public.cotizaciones
for each row execute function public.tg_cotizaciones_estado();

create or replace function public.tg_cotizaciones_oportunidad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.oportunidad_id is null then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.estado is not distinct from old.estado
     and new.oportunidad_id is not distinct from old.oportunidad_id then
    return null;
  end if;

  if new.estado = 'enviada' then
    update public.oportunidades set etapa = 'cotizacion_enviada'
    where id = new.oportunidad_id
      and etapa in ('prospecto_nuevo', 'contactado', 'interesado');
  elsif new.estado = 'aceptada' then
    update public.oportunidades set etapa = 'ganado'
    where id = new.oportunidad_id and etapa <> 'ganado';
  end if;
  return null;
end
$$;

create trigger cotizaciones_oportunidad
after insert or update of estado, oportunidad_id on public.cotizaciones
for each row execute function public.tg_cotizaciones_oportunidad();

-- Estados del pedido: validaciones, fechas y línea de tiempo.
create or replace function public.tg_pedidos_estado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.estado is not distinct from old.estado then
    return new;
  end if;

  if new.estado in ('pausado', 'cancelado') and coalesce(trim(new.motivo_estado), '') = '' then
    raise exception 'Indica el motivo para % el pedido',
      case new.estado when 'pausado' then 'pausar' else 'cancelar' end;
  end if;

  if new.estado = 'pausado' then
    if tg_op = 'UPDATE' and old.estado <> 'pausado' then
      new.estado_anterior := old.estado;
    end if;
  elsif new.estado <> 'cancelado' then
    new.motivo_estado := null;
    new.estado_anterior := null;
  end if;

  if new.estado = 'entregado' then
    new.entregado_at := coalesce(new.entregado_at, now());
  elsif new.estado = 'finalizado' then
    new.entregado_at := coalesce(new.entregado_at, now());
    new.finalizado_at := coalesce(new.finalizado_at, now());
  elsif new.estado = 'cancelado' then
    new.cancelado_at := now();
  end if;

  if tg_op = 'UPDATE' and old.estado = 'cancelado' then
    new.cancelado_at := null;
  end if;

  return new;
end
$$;

create trigger pedidos_estado
before insert or update of estado on public.pedidos
for each row execute function public.tg_pedidos_estado();

create or replace function public.tg_pedidos_eventos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text;
begin
  if tg_op = 'INSERT' then
    -- La conversión desde cotización registra su propio evento.
    if new.cotizacion_id is null then
      insert into public.pedido_eventos (pedido_id, tipo, estado_a, mensaje)
      values (new.id, 'creado', new.estado, 'Pedido creado');
    end if;
    -- Última compra del cliente (para reactivación)
    update public.clientes
    set ultima_compra_at = greatest(coalesce(ultima_compra_at, new.created_at), new.created_at)
    where id = new.cliente_id;
    return null;
  end if;

  if new.estado is distinct from old.estado then
    insert into public.pedido_eventos (pedido_id, tipo, estado_de, estado_a, mensaje)
    values (new.id, 'estado', old.estado, new.estado,
      case when new.estado in ('pausado', 'cancelado') then new.motivo_estado end);
  end if;

  if new.responsable_id is distinct from old.responsable_id and new.responsable_id is not null then
    select nombre into v_nombre from public.perfiles where id = new.responsable_id;
    insert into public.pedido_eventos (pedido_id, tipo, mensaje)
    values (new.id, 'asignacion', 'Responsable: ' || coalesce(v_nombre, 'sin nombre'));
  end if;

  if new.disenador_id is distinct from old.disenador_id and new.disenador_id is not null then
    select nombre into v_nombre from public.perfiles where id = new.disenador_id;
    insert into public.pedido_eventos (pedido_id, tipo, mensaje)
    values (new.id, 'asignacion', 'Diseño asignado a: ' || coalesce(v_nombre, 'sin nombre'));
  end if;

  if new.facturado and not old.facturado then
    insert into public.pedido_eventos (pedido_id, tipo, mensaje)
    values (new.id, 'factura', 'Marcado como facturado' ||
      coalesce(' (folio ' || nullif(trim(new.folio_factura), '') || ')', ''));
  end if;

  return null;
end
$$;

create trigger pedidos_eventos
after insert or update on public.pedidos
for each row execute function public.tg_pedidos_eventos();

-- Pagos: validaciones y protección del historial.
create or replace function public.tg_pagos_validar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos;
begin
  if tg_op = 'INSERT' then
    select * into v_pedido from public.pedidos where id = new.pedido_id;
    if not found then
      raise exception 'Pedido no encontrado';
    end if;
    if v_pedido.estado = 'cancelado' and new.tipo <> 'devolucion' then
      raise exception 'El pedido % está cancelado; solo se pueden registrar devoluciones', v_pedido.folio;
    end if;
    if new.tipo = 'devolucion' and not public.tiene_permiso('cancelar_pagos') and auth.uid() is not null then
      raise exception 'No tienes permiso para registrar devoluciones' using errcode = '42501';
    end if;
    new.cliente_id := v_pedido.cliente_id;
    new.registrado_por := coalesce(auth.uid(), new.registrado_por);
    new.cancelado := false;
    new.cancelado_por := null;
    new.cancelado_at := null;
    new.motivo_cancelacion := null;
    return new;
  end if;

  -- UPDATE
  if auth.uid() is not null and not public.es_admin() then
    if new.importe is distinct from old.importe
       or new.tipo is distinct from old.tipo
       or new.pedido_id is distinct from old.pedido_id
       or new.fecha is distinct from old.fecha
       or new.metodo is distinct from old.metodo then
      raise exception 'Solo un administrador puede modificar importe, tipo, fecha o método. Cancela el pago y regístralo de nuevo.'
        using errcode = '42501';
    end if;
  end if;

  if old.cancelado and not new.cancelado then
    raise exception 'Un pago cancelado no se puede reactivar; registra uno nuevo';
  end if;

  if new.cancelado and not old.cancelado then
    if auth.uid() is not null and not public.tiene_permiso('cancelar_pagos') then
      raise exception 'No tienes permiso para cancelar pagos' using errcode = '42501';
    end if;
    if coalesce(trim(new.motivo_cancelacion), '') = '' then
      raise exception 'Indica el motivo de la cancelación del pago';
    end if;
    new.cancelado_por := auth.uid();
    new.cancelado_at := now();
  end if;

  new.cliente_id := old.cliente_id;
  new.registrado_por := old.registrado_por;
  new.updated_at := now();
  return new;
end
$$;

create trigger pagos_validar
before insert or update on public.pagos
for each row execute function public.tg_pagos_validar();

create or replace function public.tg_pagos_actualizar_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_txt text;
begin
  update public.pedidos set updated_at = now() where id = new.pedido_id;

  if tg_op = 'INSERT' then
    v_txt := case new.tipo
      when 'anticipo' then 'Anticipo registrado'
      when 'liquidacion' then 'Liquidación registrada'
      when 'devolucion' then 'Devolución registrada'
      else 'Pago registrado' end
      || ' (' || new.metodo::text || ')';
    insert into public.pedido_eventos (pedido_id, tipo, mensaje) values (new.pedido_id, 'pago', v_txt);
  elsif new.cancelado and not old.cancelado then
    insert into public.pedido_eventos (pedido_id, tipo, mensaje)
    values (new.pedido_id, 'pago', 'Pago cancelado: ' || coalesce(new.motivo_cancelacion, ''));
  end if;
  return null;
end
$$;

create trigger pagos_actualizar_pedido
after insert or update on public.pagos
for each row execute function public.tg_pagos_actualizar_pedido();

-- Archivos: versión automática, aprobaciones y avance del pedido.
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
  end if;

  new.pedido_id := old.pedido_id;
  new.categoria := old.categoria;
  new.version := old.version;
  new.subido_por := old.subido_por;
  new.updated_at := now();
  return new;
end
$$;

create trigger archivos_antes
before insert or update on public.archivos
for each row execute function public.tg_archivos_antes();

create or replace function public.tg_archivos_despues()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado public.estado_pedido;
  v_omitidas public.estado_pedido[];
begin
  if new.pedido_id is null then
    return null;
  end if;

  select estado, etapas_omitidas into v_estado, v_omitidas from public.pedidos where id = new.pedido_id;

  if tg_op = 'INSERT' then
    insert into public.pedido_eventos (pedido_id, tipo, mensaje)
    values (new.pedido_id, 'archivo',
      case when new.categoria = 'diseno'
        then 'Diseño v' || new.version || ' subido: ' || new.nombre
        else 'Archivo agregado: ' || new.nombre end);

    -- Un diseño nuevo deja el pedido esperando aprobación.
    if new.categoria = 'diseno' and v_estado in ('nuevo', 'en_diseno')
       and not ('esperando_aprobacion' = any (v_omitidas)) then
      update public.pedidos set estado = 'esperando_aprobacion' where id = new.pedido_id;
    end if;
    return null;
  end if;

  if new.estado_aprobacion is distinct from old.estado_aprobacion then
    insert into public.pedido_eventos (pedido_id, tipo, mensaje)
    values (new.pedido_id, 'aprobacion',
      'Diseño v' || coalesce(new.version::text, '?') || ': '
      || case new.estado_aprobacion
           when 'aprobado' then 'aprobado'
           when 'cambios' then 'cambios solicitados'
           when 'rechazado' then 'rechazado'
           else 'pendiente de aprobación' end
      || coalesce(' por ' || nullif(trim(new.aprobado_por_nombre), ''), '')
      || coalesce('. ' || nullif(trim(new.aprobacion_notas), ''), ''));

    if new.estado_aprobacion = 'aprobado' and v_estado in ('nuevo', 'en_diseno', 'esperando_aprobacion')
       and not ('aprobado' = any (v_omitidas)) then
      update public.pedidos set estado = 'aprobado' where id = new.pedido_id;
    elsif new.estado_aprobacion in ('cambios', 'rechazado') and v_estado in ('esperando_aprobacion', 'aprobado')
       and not ('en_diseno' = any (v_omitidas)) then
      update public.pedidos set estado = 'en_diseno' where id = new.pedido_id;
    end if;
  end if;
  return null;
end
$$;

create trigger archivos_despues
after insert or update on public.archivos
for each row execute function public.tg_archivos_despues();

-- =====================================================================
-- Funciones de negocio (RPC)
-- =====================================================================

-- Cambia la etapa de un pedido. Diseño y producción la usan sin poder editar el pedido.
create or replace function public.cambiar_estado_pedido(
  p_pedido uuid,
  p_estado public.estado_pedido,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actual public.estado_pedido;
begin
  if not (public.tiene_permiso('actualizar_produccion') or public.tiene_permiso('gestionar_pedidos')) then
    raise exception 'No tienes permiso para cambiar la etapa del pedido' using errcode = '42501';
  end if;

  select estado into v_actual from public.pedidos where id = p_pedido for update;
  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  if (p_estado = 'cancelado' or v_actual in ('cancelado', 'finalizado'))
     and not public.tiene_permiso('gestionar_pedidos') then
    raise exception 'Solo ventas o administración pueden cancelar o reabrir pedidos' using errcode = '42501';
  end if;

  update public.pedidos
  set estado = p_estado,
      motivo_estado = case when p_estado in ('pausado', 'cancelado') then nullif(trim(p_motivo), '') else null end
  where id = p_pedido;
end
$$;

-- Nota en la línea de tiempo del pedido (cualquier usuario activo).
create or replace function public.agregar_nota_pedido(p_pedido uuid, p_mensaje text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if not public.usuario_activo() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if coalesce(trim(p_mensaje), '') = '' then
    raise exception 'Escribe la nota';
  end if;
  if not exists (select 1 from public.pedidos where id = p_pedido) then
    raise exception 'Pedido no encontrado';
  end if;
  insert into public.pedido_eventos (pedido_id, tipo, mensaje)
  values (p_pedido, 'nota', trim(p_mensaje))
  returning id into v_id;
  return v_id;
end
$$;

-- Copia partidas (con sus costos) de un documento a otro.
create or replace function public.copiar_partidas(
  p_origen_cotizacion uuid,
  p_origen_pedido uuid,
  p_destino_cotizacion uuid,
  p_destino_pedido uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.partidas;
  v_nueva uuid;
begin
  for r in
    select * from public.partidas
    where (p_origen_cotizacion is not null and cotizacion_id = p_origen_cotizacion)
       or (p_origen_pedido is not null and pedido_id = p_origen_pedido)
    order by orden, created_at
  loop
    insert into public.partidas (
      cotizacion_id, pedido_id, orden, tipo, producto_id, concepto, descripcion, metodo_calculo, unidad,
      ancho, alto, largo, cantidad, precio_unitario, descuento_pct, notas_produccion
    ) values (
      p_destino_cotizacion, p_destino_pedido, r.orden, r.tipo, r.producto_id, r.concepto, r.descripcion,
      r.metodo_calculo, r.unidad, r.ancho, r.alto, r.largo, r.cantidad, r.precio_unitario, r.descuento_pct,
      r.notas_produccion
    )
    returning id into v_nueva;

    insert into public.partida_costos (
      partida_id, costo_material, costo_mano_obra, costo_fijo, desperdicio_pct, ganancia_pct, costo_total, calculo
    )
    select v_nueva, pc.costo_material, pc.costo_mano_obra, pc.costo_fijo, pc.desperdicio_pct, pc.ganancia_pct,
           pc.costo_total, pc.calculo
    from public.partida_costos pc
    where pc.partida_id = r.id
    on conflict (partida_id) do update set
      costo_material = excluded.costo_material,
      costo_mano_obra = excluded.costo_mano_obra,
      costo_fijo = excluded.costo_fijo,
      desperdicio_pct = excluded.desperdicio_pct,
      ganancia_pct = excluded.ganancia_pct,
      costo_total = excluded.costo_total,
      calculo = excluded.calculo;
  end loop;
end
$$;

revoke execute on function public.copiar_partidas(uuid, uuid, uuid, uuid) from public, anon, authenticated;

-- Convierte una cotización en pedido sin volver a capturar la información.
create or replace function public.convertir_cotizacion_a_pedido(
  p_cotizacion uuid,
  p_fecha_entrega date default null,
  p_responsable uuid default null,
  p_titulo text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.cotizaciones;
  v_pedido uuid;
  v_omitidas public.estado_pedido[] := '{}';
  v_diseno boolean;
  v_produccion boolean;
  v_instalacion boolean;
  v_requiere_factura boolean;
begin
  if not public.tiene_permiso('gestionar_pedidos') then
    raise exception 'No tienes permiso para crear pedidos' using errcode = '42501';
  end if;

  select * into c from public.cotizaciones where id = p_cotizacion for update;
  if not found then
    raise exception 'Cotización no encontrada';
  end if;
  if c.pedido_id is not null then
    raise exception 'Esta cotización ya se convirtió en el pedido %',
      (select folio from public.pedidos where id = c.pedido_id);
  end if;
  if c.estado in ('rechazada', 'cancelada') then
    raise exception 'No se puede convertir una cotización rechazada o cancelada';
  end if;
  if not exists (select 1 from public.partidas where cotizacion_id = c.id) then
    raise exception 'La cotización no tiene conceptos';
  end if;

  select
    coalesce(bool_or(case when pa.tipo = 'diseno' then true
                          when pa.tipo in ('instalacion', 'transporte') then false
                          else coalesce(pr.requiere_diseno, true) end), false),
    coalesce(bool_or(case when pa.tipo in ('instalacion', 'transporte', 'diseno') then false
                          else coalesce(pr.requiere_produccion, true) end), false),
    coalesce(bool_or(pa.tipo = 'instalacion' or coalesce(pr.requiere_instalacion, false)), false)
  into v_diseno, v_produccion, v_instalacion
  from public.partidas pa
  left join public.productos pr on pr.id = pa.producto_id
  where pa.cotizacion_id = c.id;

  if not v_diseno then
    v_omitidas := v_omitidas || array['en_diseno', 'esperando_aprobacion', 'aprobado']::public.estado_pedido[];
  end if;
  if not v_produccion then
    v_omitidas := v_omitidas || array['en_produccion', 'acabados']::public.estado_pedido[];
  end if;
  if not v_instalacion then
    v_omitidas := v_omitidas || array['en_instalacion']::public.estado_pedido[];
  end if;

  select requiere_factura into v_requiere_factura from public.clientes where id = c.cliente_id;

  insert into public.pedidos (
    cotizacion_id, cliente_id, contacto_id, vendedor_id, responsable_id, titulo, descripcion,
    etapas_omitidas, fecha_entrega, requiere_instalacion,
    anticipo_pct, aplica_iva, iva_pct, descuento_tipo, descuento_valor, recargo_pct, recargo_concepto,
    condiciones, fecha_limite_pago, requiere_factura, notas_internas
  ) values (
    c.id, c.cliente_id, c.contacto_id, coalesce(c.vendedor_id, auth.uid()), p_responsable,
    coalesce(nullif(trim(p_titulo), ''), nullif(trim(c.titulo), ''), 'Pedido de cotización ' || c.folio),
    c.notas, v_omitidas, p_fecha_entrega, v_instalacion,
    c.anticipo_pct, c.aplica_iva, c.iva_pct, c.descuento_tipo, c.descuento_valor, c.recargo_pct, c.recargo_concepto,
    c.condiciones, p_fecha_entrega, coalesce(v_requiere_factura, false), c.notas_internas
  )
  returning id into v_pedido;

  perform public.copiar_partidas(c.id, null, null, v_pedido);

  -- Recalcula totales con las partidas copiadas
  update public.pedidos set updated_at = now() where id = v_pedido;

  update public.cotizaciones
  set estado = 'aceptada', pedido_id = v_pedido
  where id = c.id;

  insert into public.pedido_eventos (pedido_id, tipo, estado_a, mensaje)
  values (v_pedido, 'creado', 'nuevo', 'Pedido creado desde la cotización ' || c.folio);

  return v_pedido;
end
$$;

-- Duplica una cotización como borrador nuevo.
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
  if not public.tiene_permiso('gestionar_cotizaciones') then
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
