-- =====================================================================
-- 20 · Revisión de seguridad de las fases 2 y 3 (segunda parte)
--
-- Correcciones (cada una tiene su prueba en tests/db/seguridad_fases2y3.test.ts):
--   9. Diseños aprobados: el archivo que aprobó el cliente ya no se cambia. Antes Producción
--      (sin "aprobar_disenos") podía apuntar un diseño aprobado a otro archivo, y quien lo
--      subió podía borrarlo del almacenamiento y subir otro con la misma ruta: el pedido
--      seguía "aprobado" con un arte que el cliente nunca vio (y el almacenamiento no deja
--      rastro en la bitácora). Además, un archivo nuevo ya no puede llegar con "aprobado por"
--      y notas de aprobación precargados (aparecían luego como evidencia de la aprobación).
--  10. Corte de caja: ver el resumen del día, cerrar la caja o leer los cortes guardados
--      exige también "ver_precios" (el corte lista cada pago con cliente e importe; sin ese
--      permiso los pagos no se pueden leer en su tabla).
--  11. Corte de caja: con el día cerrado, los gastos en efectivo tampoco se BORRAN (antes solo
--      se bloqueaba crearlos o modificarlos), salvo administración.
--
-- No cambia la forma de ninguna tabla ni columna: solo reglas, permisos y funciones.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 9a. Archivos: el archivo de un diseño aprobado no se cambia (salvo administración).
--     Para corregir un arte aprobado se sube una versión nueva, o quien puede registrar
--     aprobaciones retira la aprobación (estado distinto de "aprobado") en el mismo cambio.
--     El resto es igual que en la migración 20261014000900.
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
    -- Un archivo nace sin aprobación: nadie deja precargado quién lo aprobó.
    new.aprobado_por_nombre := null;
    new.aprobacion_notas := null;
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
    if old.estado_aprobacion = 'aprobado'
       and (new.path is distinct from old.path or new.enlace_externo is distinct from old.enlace_externo)
       and auth.uid() is not null and not public.es_admin() then
      raise exception 'Este diseño ya está aprobado y su archivo no se puede cambiar. Sube una versión nueva para que el cliente la apruebe.'
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
-- 9b. Almacenamiento: quien subió un archivo puede borrarlo, salvo que sea el de un diseño
--     aprobado (como ya pasaba con el registro en la tabla "archivos"). Administración, sí.
--     No hay regla de UPDATE en este bucket, así que tampoco se sobrescribe ni se mueve.
-- ---------------------------------------------------------------------
alter policy "archivos: eliminar" on storage.objects
  using (
    bucket_id = 'archivos'
    and (
      (select public.es_admin())
      or (
        owner_id = (select auth.uid())::text
        and not exists (
          select 1 from public.archivos a
          where a.path = objects.name and a.estado_aprobacion = 'aprobado'
        )
      )
    )
  );

-- ---------------------------------------------------------------------
-- 10. Corte de caja: también requiere "ver_precios" (o "ver_reportes" para consultarlo).
--     Ventas y administración tienen ambos permisos por defecto: para ellos nada cambia.
-- ---------------------------------------------------------------------
create or replace function public.puede_ver_caja()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (public.tiene_permiso('registrar_pagos') and public.tiene_permiso('ver_precios'))
         or public.tiene_permiso('ver_reportes')
$$;

alter policy "cortes_caja: ver" on public.cortes_caja
  using ((select public.puede_ver_caja()));

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
  if not public.puede_ver_caja() then
    raise exception 'No tienes permiso para consultar la caja' using errcode = '42501';
  end if;
  return public.corte_caja_calcular(
    coalesce(p_fecha, current_date),
    p_efectivo_inicial,
    public.tiene_permiso('registrar_gastos') or public.tiene_permiso('ver_costos')
  );
end
$$;

-- Igual que antes (incluido el candado por día), más el permiso "ver_precios".
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
set datestyle = 'ISO, MDY'
as $$
declare
  v_fecha date := coalesce(p_fecha, current_date);
  v_res jsonb;
  v_esperado numeric;
  v_corte public.cortes_caja;
begin
  if not (public.tiene_permiso('registrar_pagos') and public.tiene_permiso('ver_precios')) then
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

  -- Un solo cierre a la vez por fecha; espera a los pagos y gastos en efectivo en curso.
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

-- ---------------------------------------------------------------------
-- 11. Gastos en efectivo de un día cerrado: tampoco se borran (salvo administración).
--     Toma el mismo candado por día que los pagos y gastos (ver 20261014000900).
-- ---------------------------------------------------------------------
create or replace function public.tg_gastos_caja_cerrada_borrar()
returns trigger
language plpgsql
security definer
set search_path = ''
set datestyle = 'ISO, MDY'
as $$
begin
  if old.metodo_pago = 'efectivo' then
    perform pg_advisory_xact_lock_shared(hashtext('cortes_caja:' || old.fecha::text));
    if auth.uid() is not null and not public.es_admin()
       and exists (select 1 from public.cortes_caja c where c.fecha = old.fecha) then
      raise exception 'La caja del % ya está cerrada. Pide a administración que la reabra para borrar gastos en efectivo de ese día.',
        to_char(old.fecha, 'DD/MM/YYYY')
        using errcode = '42501';
    end if;
  end if;
  return old;
end
$$;

drop trigger if exists gastos_caja_cerrada_borrar on public.gastos;
create trigger gastos_caja_cerrada_borrar
before delete on public.gastos
for each row execute function public.tg_gastos_caja_cerrada_borrar();

-- ---------------------------------------------------------------------
-- Privilegios de lo nuevo
-- ---------------------------------------------------------------------
revoke execute on function public.tg_gastos_caja_cerrada_borrar() from public, anon, authenticated;
revoke execute on function public.puede_ver_caja() from public, anon;
grant execute on function public.puede_ver_caja() to authenticated, service_role;
revoke execute on function public.corte_caja_resumen(date, numeric) from public, anon;
revoke execute on function public.cerrar_caja(date, numeric, numeric, text) from public, anon;
grant execute on function public.corte_caja_resumen(date, numeric) to authenticated, service_role;
grant execute on function public.cerrar_caja(date, numeric, numeric, text) to authenticated, service_role;
grant execute on function public.tg_gastos_caja_cerrada_borrar() to service_role;

notify pgrst, 'reload schema';
