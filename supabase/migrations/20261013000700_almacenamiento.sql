-- =====================================================================
-- 07 · Almacenamiento de archivos (Supabase Storage)
--
--   marca         público  · logo de la empresa para el CRM y los PDF
--   archivos      privado  · diseños, referencias y evidencias de pedidos
--                           ruta: pedidos/{pedido_id}/... o clientes/{cliente_id}/...
--   comprobantes  privado  · comprobantes de pago   ruta: pagos/{pedido_id}/...
--   documentos    privado  · PDF de cotizaciones compartidos por enlace temporal
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('marca', 'marca', true, 2097152,
    array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('archivos', 'archivos', false, 26214400, null),
  ('comprobantes', 'comprobantes', false, 10485760,
    array['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']),
  ('documentos', 'documentos', false, 10485760,
    array['application/pdf'])
on conflict (id) do nothing;

-- Marca: lectura pública por URL; solo administradores la modifican
create policy "marca: ver" on storage.objects
  for select to authenticated
  using (bucket_id = 'marca');

create policy "marca: subir admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'marca' and (select public.es_admin()));

create policy "marca: editar admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'marca' and (select public.es_admin()))
  with check (bucket_id = 'marca' and (select public.es_admin()));

create policy "marca: eliminar admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'marca' and (select public.es_admin()));

-- Archivos de pedidos y clientes
create policy "archivos: ver" on storage.objects
  for select to authenticated
  using (bucket_id = 'archivos' and (select public.usuario_activo()));

create policy "archivos: subir" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'archivos'
    and (storage.foldername(name))[1] in ('pedidos', 'clientes')
    and (
      (select public.tiene_permiso('actualizar_produccion'))
      or (select public.tiene_permiso('gestionar_pedidos'))
      or (select public.tiene_permiso('gestionar_clientes'))
    )
  );

create policy "archivos: eliminar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'archivos'
    and (owner_id = (select auth.uid())::text or (select public.es_admin()))
  );

-- Comprobantes de pago
create policy "comprobantes: ver" on storage.objects
  for select to authenticated
  using (bucket_id = 'comprobantes' and (select public.tiene_permiso('ver_precios')));

create policy "comprobantes: subir" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = 'pagos'
    and (select public.tiene_permiso('registrar_pagos'))
  );

create policy "comprobantes: eliminar admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'comprobantes' and (select public.es_admin()));

-- PDF de cotizaciones para compartir
create policy "documentos: ver" on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos' and (select public.tiene_permiso('ver_precios')));

create policy "documentos: subir" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] in ('cotizaciones', 'pedidos')
    and (select public.tiene_permiso('gestionar_cotizaciones'))
  );

create policy "documentos: reemplazar" on storage.objects
  for update to authenticated
  using (bucket_id = 'documentos' and (select public.tiene_permiso('gestionar_cotizaciones')))
  with check (bucket_id = 'documentos' and (select public.tiene_permiso('gestionar_cotizaciones')));

create policy "documentos: eliminar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documentos' and (select public.tiene_permiso('gestionar_cotizaciones')));
