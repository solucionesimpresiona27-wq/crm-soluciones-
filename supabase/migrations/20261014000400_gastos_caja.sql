-- =====================================================================
-- 14 · Gastos (compras, maquila y gastos generales) y corte de caja diario
--
--   gastos        salidas de dinero; ligadas a un pedido sirven para la utilidad real.
--                 No se borran: se cancelan con motivo (borrar requiere "eliminar_registros").
--   cortes_caja   cierre del día: efectivo esperado contra contado.
--
-- Permisos:
--   Gastos: ver con "registrar_gastos" o "ver_costos"; registrar, editar y cancelar
--   con "registrar_gastos". Comprobantes en el bucket "comprobantes", ruta gastos/<id>/...
--   Corte de caja: consultar con "registrar_pagos" o "ver_reportes"; cerrar con
--   "registrar_pagos"; reabrir (borrar el corte) solo administración.
--   Con la caja de un día cerrada, los pagos y gastos EN EFECTIVO de ese día ya no se
--   registran ni se modifican (salvo administración).
-- =====================================================================

create type public.categoria_gasto as enum (
  'material', 'maquila', 'servicios', 'renta', 'nomina', 'transporte', 'publicidad', 'impuestos', 'otros'
);

create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  concepto text not null check (length(trim(concepto)) between 1 and 300),
  categoria public.categoria_gasto not null default 'otros',
  proveedor_id uuid references public.proveedores (id) on delete set null,
  -- Ligar el gasto a un pedido (maquila, material comprado para ese trabajo) para la utilidad real.
  pedido_id uuid references public.pedidos (id) on delete set null,
  monto numeric(12, 2) not null check (monto > 0),
  metodo_pago public.metodo_pago not null default 'efectivo',
  referencia text check (referencia is null or length(referencia) <= 200),
  comprobante_path text,
  notas text check (notas is null or length(notas) <= 2000),
  cancelado boolean not null default false,
  motivo_cancelacion text,
  cancelado_por uuid references public.perfiles (id) on delete set null,
  cancelado_at timestamptz,
  usuario_id uuid default auth.uid() references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.gastos is 'Gastos, compras de material y maquila. Se cancelan con motivo en lugar de borrarse.';
comment on column public.gastos.monto is 'Importe pagado (con IVA si lo hubo).';

create index gastos_fecha_idx on public.gastos (fecha desc);
create index gastos_pedido_idx on public.gastos (pedido_id) where pedido_id is not null;
create index gastos_proveedor_idx on public.gastos (proveedor_id) where proveedor_id is not null;
create index gastos_categoria_idx on public.gastos (categoria, fecha desc);

create or replace function public.tg_gastos_validar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.usuario_id := coalesce(auth.uid(), new.usuario_id);
    new.cancelado := false;
    new.motivo_cancelacion := null;
    new.cancelado_por := null;
    new.cancelado_at := null;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  if old.cancelado and not new.cancelado then
    raise exception 'Un gasto cancelado no se puede reactivar; regístralo de nuevo';
  end if;

  if old.cancelado and (new.fecha, new.concepto, new.categoria, new.monto, new.metodo_pago, new.referencia,
                        new.comprobante_path, new.notas, new.motivo_cancelacion)
                       is distinct from
                       (old.fecha, old.concepto, old.categoria, old.monto, old.metodo_pago, old.referencia,
                        old.comprobante_path, old.notas, old.motivo_cancelacion) then
    raise exception 'Un gasto cancelado no se puede modificar';
  end if;

  if new.cancelado and not old.cancelado then
    if coalesce(trim(new.motivo_cancelacion), '') = '' then
      raise exception 'Indica el motivo de la cancelación del gasto';
    end if;
    new.cancelado_por := auth.uid();
    new.cancelado_at := now();
  elsif not new.cancelado then
    new.motivo_cancelacion := null;
    new.cancelado_por := null;
    new.cancelado_at := null;
  else
    new.cancelado_por := old.cancelado_por;
    new.cancelado_at := old.cancelado_at;
  end if;

  new.usuario_id := old.usuario_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end
$$;

create trigger gastos_validar
before insert or update on public.gastos
for each row execute function public.tg_gastos_validar();

create trigger gastos_bitacora
after insert or update or delete on public.gastos
for each row execute function public.tg_bitacora();

alter table public.gastos enable row level security;

revoke all on public.gastos from public, anon, authenticated;
grant select, insert, update, delete on public.gastos to authenticated;
grant all on public.gastos to service_role;

create policy "gastos: ver" on public.gastos
  for select to authenticated
  using ((select public.tiene_permiso('registrar_gastos')) or (select public.tiene_permiso('ver_costos')));

create policy "gastos: registrar" on public.gastos
  for insert to authenticated
  with check ((select public.tiene_permiso('registrar_gastos')));

create policy "gastos: editar o cancelar" on public.gastos
  for update to authenticated
  using ((select public.tiene_permiso('registrar_gastos')))
  with check ((select public.tiene_permiso('registrar_gastos')));

create policy "gastos: eliminar" on public.gastos
  for delete to authenticated
  using ((select public.tiene_permiso('eliminar_registros')));

-- ---------------------------------------------------------------------
-- Comprobantes de gastos: bucket "comprobantes", ruta gastos/<gasto_id>/archivo
-- Los comprobantes de pago (ruta pagos/...) siguen visibles con "ver_precios";
-- los de gastos ya no, solo con "registrar_gastos" o "ver_costos".
-- ---------------------------------------------------------------------
alter policy "comprobantes: ver" on storage.objects
  using (
    bucket_id = 'comprobantes'
    and coalesce((storage.foldername(name))[1], '') <> 'gastos'
    and (select public.tiene_permiso('ver_precios'))
  );

create policy "comprobantes de gastos: ver" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = 'gastos'
    and ((select public.tiene_permiso('registrar_gastos')) or (select public.tiene_permiso('ver_costos')))
  );

create policy "comprobantes de gastos: subir" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = 'gastos'
    and (select public.tiene_permiso('registrar_gastos'))
  );

create policy "comprobantes de gastos: eliminar propios" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = 'gastos'
    and owner_id = (select auth.uid())::text
    and (select public.tiene_permiso('registrar_gastos'))
  );

-- ---------------------------------------------------------------------
-- Corte de caja
-- ---------------------------------------------------------------------
create table public.cortes_caja (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  efectivo_inicial numeric(12, 2) not null default 0 check (efectivo_inicial >= 0),
  efectivo_contado numeric(12, 2) not null check (efectivo_contado >= 0),
  -- efectivo_inicial + cobros en efectivo − devoluciones en efectivo − gastos en efectivo
  esperado numeric(12, 2) not null,
  -- efectivo_contado − esperado (negativo = faltante, positivo = sobrante)
  diferencia numeric(12, 2) not null,
  -- Fotografía del día al cerrar (totales por método y por persona, sin detalle de gastos)
  resumen jsonb not null default '{}'::jsonb,
  notas text check (notas is null or length(notas) <= 2000),
  cerrado_por uuid default auth.uid() references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.cortes_caja is 'Cierres de caja diarios. Solo administración puede reabrir (borrar) un corte.';

create trigger cortes_caja_bitacora
after insert or update or delete on public.cortes_caja
for each row execute function public.tg_bitacora();

alter table public.cortes_caja enable row level security;

revoke all on public.cortes_caja from public, anon, authenticated;
-- Se escriben solo con las funciones cerrar_caja y reabrir_caja.
grant select on public.cortes_caja to authenticated;
grant all on public.cortes_caja to service_role;

create policy "cortes_caja: ver" on public.cortes_caja
  for select to authenticated
  using ((select public.tiene_permiso('registrar_pagos')) or (select public.tiene_permiso('ver_reportes')));

-- Con la caja cerrada, el efectivo de ese día queda bloqueado (salvo administración).
create or replace function public.tg_caja_cerrada()
returns trigger
language plpgsql
security definer
set search_path = ''
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
  v_fecha date;
begin
  if auth.uid() is null or public.es_admin() then
    return new;
  end if;

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
    if v_old ->> v_campo_metodo = 'efectivo'
       and exists (select 1 from public.cortes_caja c where c.fecha = (v_old ->> 'fecha')::date) then
      v_fecha := (v_old ->> 'fecha')::date;
    end if;
  end if;

  if v_fecha is null and v_new ->> v_campo_metodo = 'efectivo'
     and exists (select 1 from public.cortes_caja c where c.fecha = (v_new ->> 'fecha')::date) then
    v_fecha := (v_new ->> 'fecha')::date;
  end if;

  if v_fecha is not null then
    raise exception 'La caja del % ya está cerrada. Pide a administración que la reabra para registrar o cambiar movimientos en efectivo de ese día.',
      to_char(v_fecha, 'DD/MM/YYYY')
      using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger pagos_caja_cerrada
before insert or update on public.pagos
for each row execute function public.tg_caja_cerrada();

create trigger gastos_caja_cerrada
before insert or update on public.gastos
for each row execute function public.tg_caja_cerrada();

-- Cálculo del corte (uso interno). p_detalle_gastos agrega la lista de gastos del día.
create or replace function public.corte_caja_calcular(
  p_fecha date,
  p_efectivo_inicial numeric,
  p_detalle_gastos boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'America/Mexico_City'
as $$
declare
  v_corte public.cortes_caja;
  v_sugerido numeric;
  v_inicial numeric;
  v_ef_entradas numeric;
  v_ef_devoluciones numeric;
  v_ef_gastos numeric;
  v_entradas numeric;
  v_devoluciones numeric;
  r jsonb;
begin
  select * into v_corte from public.cortes_caja where fecha = p_fecha;

  select c.efectivo_contado into v_sugerido
  from public.cortes_caja c where c.fecha < p_fecha
  order by c.fecha desc limit 1;

  v_inicial := coalesce(p_efectivo_inicial, v_corte.efectivo_inicial, v_sugerido, 0);

  select
    coalesce(sum(pg.importe) filter (where pg.tipo <> 'devolucion'), 0),
    coalesce(sum(pg.importe) filter (where pg.tipo = 'devolucion'), 0),
    coalesce(sum(pg.importe) filter (where pg.tipo <> 'devolucion' and pg.metodo = 'efectivo'), 0),
    coalesce(sum(pg.importe) filter (where pg.tipo = 'devolucion' and pg.metodo = 'efectivo'), 0)
  into v_entradas, v_devoluciones, v_ef_entradas, v_ef_devoluciones
  from public.pagos pg
  where pg.fecha = p_fecha and not pg.cancelado;

  select coalesce(sum(g.monto), 0) into v_ef_gastos
  from public.gastos g
  where g.fecha = p_fecha and not g.cancelado and g.metodo_pago = 'efectivo';

  r := jsonb_build_object(
    'fecha', p_fecha,
    'cerrado', v_corte.id is not null,
    'efectivo_inicial', v_inicial,
    'efectivo_inicial_sugerido', v_sugerido,
    'totales', jsonb_build_object(
      'entradas', v_entradas,
      'devoluciones', v_devoluciones,
      'neto', v_entradas - v_devoluciones
    ),
    'efectivo', jsonb_build_object(
      'entradas', v_ef_entradas,
      'devoluciones', v_ef_devoluciones,
      'gastos', v_ef_gastos,
      'neto', v_ef_entradas - v_ef_devoluciones - v_ef_gastos
    ),
    'esperado', v_inicial + v_ef_entradas - v_ef_devoluciones - v_ef_gastos,
    'entradas_por_metodo', (
      select coalesce(jsonb_agg(jsonb_build_object('metodo', x.metodo, 'pagos', x.n, 'total', x.total)
                                order by x.metodo), '[]'::jsonb)
      from (
        select pg.metodo, count(*) as n, sum(pg.importe) as total
        from public.pagos pg
        where pg.fecha = p_fecha and not pg.cancelado and pg.tipo <> 'devolucion'
        group by pg.metodo
      ) x
    ),
    'devoluciones_por_metodo', (
      select coalesce(jsonb_agg(jsonb_build_object('metodo', x.metodo, 'pagos', x.n, 'total', x.total)
                                order by x.metodo), '[]'::jsonb)
      from (
        select pg.metodo, count(*) as n, sum(pg.importe) as total
        from public.pagos pg
        where pg.fecha = p_fecha and not pg.cancelado and pg.tipo = 'devolucion'
        group by pg.metodo
      ) x
    ),
    'por_usuario', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'usuario_id', x.registrado_por, 'nombre', coalesce(u.nombre, 'Sin usuario'),
               'pagos', x.n, 'entradas', x.entradas, 'devoluciones', x.devoluciones,
               'neto', x.entradas - x.devoluciones, 'efectivo_neto', x.efectivo
             ) order by coalesce(u.nombre, '')), '[]'::jsonb)
      from (
        select pg.registrado_por,
               count(*) as n,
               coalesce(sum(pg.importe) filter (where pg.tipo <> 'devolucion'), 0) as entradas,
               coalesce(sum(pg.importe) filter (where pg.tipo = 'devolucion'), 0) as devoluciones,
               coalesce(sum(case when pg.tipo = 'devolucion' then -pg.importe else pg.importe end)
                          filter (where pg.metodo = 'efectivo'), 0) as efectivo
        from public.pagos pg
        where pg.fecha = p_fecha and not pg.cancelado
        group by pg.registrado_por
      ) x
      left join public.perfiles u on u.id = x.registrado_por
    ),
    'pagos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', pg.id, 'pedido_id', pg.pedido_id, 'folio', p.folio, 'cliente', c.nombre,
               'tipo', pg.tipo, 'metodo', pg.metodo, 'importe', pg.importe, 'referencia', pg.referencia,
               'registrado_por', pg.registrado_por, 'usuario', u.nombre, 'created_at', pg.created_at
             ) order by pg.created_at), '[]'::jsonb)
      from public.pagos pg
      join public.pedidos p on p.id = pg.pedido_id
      left join public.clientes c on c.id = pg.cliente_id
      left join public.perfiles u on u.id = pg.registrado_por
      where pg.fecha = p_fecha and not pg.cancelado
    ),
    'cancelados', (
      select jsonb_build_object('pagos', count(*), 'total', coalesce(sum(pg.importe), 0))
      from public.pagos pg
      where pg.fecha = p_fecha and pg.cancelado
    ),
    'corte', case when v_corte.id is null then null else
      to_jsonb(v_corte) - 'resumen'
      || jsonb_build_object('cerrado_por_nombre', (select u.nombre from public.perfiles u where u.id = v_corte.cerrado_por))
    end
  );

  if p_detalle_gastos then
    r := r || jsonb_build_object(
      'gastos_por_metodo', (
        select coalesce(jsonb_agg(jsonb_build_object('metodo', x.metodo_pago, 'gastos', x.n, 'total', x.total)
                                  order by x.metodo_pago), '[]'::jsonb)
        from (
          select g.metodo_pago, count(*) as n, sum(g.monto) as total
          from public.gastos g
          where g.fecha = p_fecha and not g.cancelado
          group by g.metodo_pago
        ) x
      ),
      'gastos', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'id', g.id, 'concepto', g.concepto, 'categoria', g.categoria, 'monto', g.monto,
                 'metodo_pago', g.metodo_pago, 'proveedor', pr.nombre, 'pedido_id', g.pedido_id
               ) order by g.created_at), '[]'::jsonb)
        from public.gastos g
        left join public.proveedores pr on pr.id = g.proveedor_id
        where g.fecha = p_fecha and not g.cancelado
      )
    );
  end if;

  return r;
end
$$;

-- Resumen del día para la pantalla de corte de caja.
create or replace function public.corte_caja_resumen(
  p_fecha date default null,
  p_efectivo_inicial numeric default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'America/Mexico_City'
as $$
begin
  if not (public.tiene_permiso('registrar_pagos') or public.tiene_permiso('ver_reportes')) then
    raise exception 'No tienes permiso para consultar la caja' using errcode = '42501';
  end if;
  return public.corte_caja_calcular(
    coalesce(p_fecha, current_date),
    p_efectivo_inicial,
    public.tiene_permiso('registrar_gastos') or public.tiene_permiso('ver_costos')
  );
end
$$;

-- Cierra la caja de un día. Requiere "registrar_pagos".
create or replace function public.cerrar_caja(
  p_fecha date,
  p_efectivo_inicial numeric,
  p_efectivo_contado numeric,
  p_notas text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set timezone = 'America/Mexico_City'
as $$
declare
  v_fecha date := coalesce(p_fecha, current_date);
  v_res jsonb;
  v_esperado numeric;
  v_corte public.cortes_caja;
begin
  if not public.tiene_permiso('registrar_pagos') then
    raise exception 'No tienes permiso para cerrar la caja' using errcode = '42501';
  end if;
  if v_fecha > current_date then
    raise exception 'No se puede cerrar la caja de una fecha futura';
  end if;
  if p_efectivo_contado is null or p_efectivo_contado < 0 then
    raise exception 'Indica el efectivo contado en caja';
  end if;
  if coalesce(p_efectivo_inicial, 0) < 0 then
    raise exception 'El efectivo inicial no puede ser negativo';
  end if;
  if length(coalesce(p_notas, '')) > 2000 then
    raise exception 'Las notas pueden tener hasta 2000 caracteres';
  end if;

  -- Un solo cierre a la vez por fecha
  perform pg_advisory_xact_lock(hashtext('cortes_caja:' || v_fecha::text));
  if exists (select 1 from public.cortes_caja where fecha = v_fecha) then
    raise exception 'La caja del % ya está cerrada', to_char(v_fecha, 'DD/MM/YYYY');
  end if;

  v_res := public.corte_caja_calcular(v_fecha, coalesce(p_efectivo_inicial, 0), false);
  v_esperado := (v_res ->> 'esperado')::numeric;

  insert into public.cortes_caja (
    fecha, efectivo_inicial, efectivo_contado, esperado, diferencia, resumen, notas, cerrado_por
  ) values (
    v_fecha, coalesce(p_efectivo_inicial, 0), p_efectivo_contado, v_esperado,
    p_efectivo_contado - v_esperado,
    v_res - 'corte' - 'cerrado' - 'efectivo_inicial_sugerido',
    nullif(trim(p_notas), ''), auth.uid()
  )
  returning * into v_corte;

  return to_jsonb(v_corte);
end
$$;

-- Reabre la caja de un día (borra el corte). Solo administración, con motivo.
create or replace function public.reabrir_caja(p_fecha date, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_corte public.cortes_caja;
begin
  if not public.es_admin() then
    raise exception 'Solo administración puede reabrir la caja' using errcode = '42501';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Indica el motivo para reabrir la caja';
  end if;

  delete from public.cortes_caja where fecha = p_fecha returning * into v_corte;
  if not found then
    raise exception 'La caja de esa fecha no está cerrada';
  end if;

  insert into public.bitacora (tabla, registro_id, accion, etiqueta, datos, usuario_id, usuario_nombre)
  values (
    'cortes_caja', v_corte.id::text, 'cancelar',
    'Caja del ' || to_char(p_fecha, 'DD/MM/YYYY') || ' reabierta: ' || left(trim(p_motivo), 500),
    jsonb_build_object('motivo', left(trim(p_motivo), 500)),
    auth.uid(),
    (select nombre from public.perfiles where id = auth.uid())
  );
end
$$;

revoke execute on function public.tg_gastos_validar() from public, anon, authenticated;
revoke execute on function public.tg_caja_cerrada() from public, anon, authenticated;
revoke execute on function public.corte_caja_calcular(date, numeric, boolean) from public, anon, authenticated;
revoke execute on function public.corte_caja_resumen(date, numeric) from public, anon;
revoke execute on function public.cerrar_caja(date, numeric, numeric, text) from public, anon;
revoke execute on function public.reabrir_caja(date, text) from public, anon;
grant execute on function public.corte_caja_resumen(date, numeric) to authenticated, service_role;
grant execute on function public.cerrar_caja(date, numeric, numeric, text) to authenticated, service_role;
grant execute on function public.reabrir_caja(date, text) to authenticated, service_role;
