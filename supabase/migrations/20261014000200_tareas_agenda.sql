-- =====================================================================
-- 12 · Tareas, recordatorios y agenda
--
--   tareas   pendientes internos con responsable, fecha y hora opcionales,
--            ligados (opcionalmente) a un cliente, pedido, oportunidad o cotización.
--   agenda() calendario combinado: tareas, entregas e instalaciones de pedidos,
--            seguimientos del embudo y cotizaciones por vencer, según permisos.
--
-- Equipo pequeño: todo usuario activo ve todas las tareas (no llevan montos).
-- Crear: cualquier usuario activo. Editar o completar: responsable, creador o
-- administración. Eliminar: creador o administración.
-- =====================================================================

create type public.tipo_tarea as enum ('tarea', 'llamada', 'seguimiento', 'entrega', 'instalacion', 'recordatorio');

create table public.tareas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) between 1 and 200),
  descripcion text check (descripcion is null or length(descripcion) <= 4000),
  tipo public.tipo_tarea not null default 'tarea',
  fecha date not null default current_date,
  hora time,
  responsable_id uuid default auth.uid() references public.perfiles (id) on delete set null,
  cliente_id uuid references public.clientes (id) on delete set null,
  pedido_id uuid references public.pedidos (id) on delete set null,
  oportunidad_id uuid references public.oportunidades (id) on delete set null,
  cotizacion_id uuid references public.cotizaciones (id) on delete set null,
  prioridad public.prioridad not null default 'normal',
  completada boolean not null default false,
  completada_at timestamptz,
  completada_por uuid references public.perfiles (id) on delete set null,
  created_by uuid default auth.uid() references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tareas is 'Tareas y recordatorios del equipo ("Mis pendientes de hoy").';

create index tareas_pendientes_idx on public.tareas (responsable_id, fecha) where not completada;
create index tareas_fecha_idx on public.tareas (fecha);
create index tareas_cliente_idx on public.tareas (cliente_id);
create index tareas_pedido_idx on public.tareas (pedido_id);
create index tareas_oportunidad_idx on public.tareas (oportunidad_id);
create index tareas_cotizacion_idx on public.tareas (cotizacion_id);

-- Autor, fecha de cierre y cliente ligado se asignan solos.
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

  new.updated_at := now();
  return new;
end
$$;

create trigger tareas_antes
before insert or update on public.tareas
for each row execute function public.tg_tareas_antes();

create trigger tareas_bitacora
after insert or update or delete on public.tareas
for each row execute function public.tg_bitacora();

alter table public.tareas enable row level security;

revoke all on public.tareas from public, anon, authenticated;
grant select, insert, update, delete on public.tareas to authenticated;
grant all on public.tareas to service_role;

create policy "tareas: ver" on public.tareas
  for select to authenticated
  using ((select public.usuario_activo()));

create policy "tareas: crear" on public.tareas
  for insert to authenticated
  with check ((select public.usuario_activo()));

-- El responsable puede pasar la tarea a otra persona (por eso la verificación final solo
-- exige usuario activo); el autor no se puede cambiar.
create policy "tareas: editar" on public.tareas
  for update to authenticated
  using (
    (select public.usuario_activo())
    and (
      responsable_id = (select auth.uid())
      or created_by = (select auth.uid())
      or (select public.es_admin())
    )
  )
  with check ((select public.usuario_activo()));

create policy "tareas: eliminar" on public.tareas
  for delete to authenticated
  using (
    (select public.usuario_activo())
    and (created_by = (select auth.uid()) or (select public.es_admin()))
  );

-- ---------------------------------------------------------------------
-- Agenda combinada
--   origen: tarea | entrega | instalacion | seguimiento | cotizacion
--   Las entregas e instalaciones las ve todo el equipo (como las órdenes de trabajo).
--   Los seguimientos requieren "gestionar_clientes"; las cotizaciones por vencer,
--   "ver_precios" (sin montos).
-- ---------------------------------------------------------------------
create or replace function public.agenda(p_desde date, p_hasta date)
returns table (
  origen text,
  id uuid,
  fecha date,
  hora time,
  titulo text,
  detalle text,
  tipo text,
  prioridad public.prioridad,
  completada boolean,
  responsable_id uuid,
  cliente_id uuid,
  cliente text,
  pedido_id uuid,
  cotizacion_id uuid,
  oportunidad_id uuid,
  folio text,
  estado text
)
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'America/Mexico_City'
as $$
#variable_conflict use_column
declare
  v_precios boolean := public.tiene_permiso('ver_precios');
  v_comercial boolean := public.tiene_permiso('gestionar_clientes');
begin
  if not public.usuario_activo() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception 'Rango de fechas inválido';
  end if;
  if p_hasta - p_desde > 366 then
    raise exception 'Consulta como máximo un año a la vez';
  end if;

  return query
  select * from (
    select
      'tarea'::text, t.id, t.fecha, t.hora, t.titulo, t.descripcion, t.tipo::text, t.prioridad, t.completada,
      t.responsable_id, t.cliente_id, c.nombre, t.pedido_id, t.cotizacion_id, t.oportunidad_id,
      null::text, null::text
    from public.tareas t
    left join public.clientes c on c.id = t.cliente_id
    where t.fecha between p_desde and p_hasta

    union all

    select
      case when p.requiere_instalacion then 'instalacion' else 'entrega' end,
      p.id, p.fecha_entrega, null::time, p.titulo, null::text, null::text, p.prioridad,
      p.estado in ('entregado', 'finalizado'),
      p.responsable_id, p.cliente_id, c.nombre, p.id, p.cotizacion_id, null::uuid,
      p.folio, p.estado::text
    from public.pedidos p
    join public.clientes c on c.id = p.cliente_id
    where p.fecha_entrega between p_desde and p_hasta
      and p.estado <> 'cancelado'

    union all

    select
      'seguimiento', o.id, o.proxima_accion_fecha, null::time, o.titulo, o.proxima_accion, null::text,
      null::public.prioridad, false,
      o.responsable_id, o.cliente_id, c.nombre, null::uuid, null::uuid, o.id,
      null::text, o.etapa::text
    from public.oportunidades o
    join public.clientes c on c.id = o.cliente_id
    where v_comercial
      and o.proxima_accion_fecha between p_desde and p_hasta
      and o.etapa not in ('ganado', 'perdido')

    union all

    select
      'cotizacion', q.id, q.fecha_vencimiento, null::time,
      coalesce(nullif(trim(q.titulo), ''), 'Cotización ' || q.folio), 'Vence la cotización', null::text,
      null::public.prioridad, false,
      q.vendedor_id, q.cliente_id, c.nombre, null::uuid, q.id, q.oportunidad_id,
      q.folio, q.estado::text
    from public.cotizaciones q
    join public.clientes c on c.id = q.cliente_id
    where v_precios
      and q.estado = 'enviada'
      and q.fecha_vencimiento between p_desde and p_hasta
  ) x
  order by 3, 4 nulls last, 5;
end
$$;

revoke execute on function public.tg_tareas_antes() from public, anon, authenticated;
revoke execute on function public.agenda(date, date) from public, anon;
grant execute on function public.agenda(date, date) to authenticated, service_role;
