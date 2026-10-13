-- =====================================================================
-- 18 · Plantillas de WhatsApp para compartir el portal del cliente
-- {enlace} es el enlace privado del portal. Si ya existen (o se editaron), no se tocan.
-- =====================================================================

insert into public.plantillas_mensaje (clave, nombre, contexto, orden, texto) values
  ('portal_cotizacion', 'Cotización para aprobar en línea', 'cotizacion', 25,
   E'Hola {cliente} 👋, aquí puedes revisar y aprobar tu cotización *{folio}* por *{total}*:\n\n{enlace}\n\nVigencia: {vigencia}. Cualquier duda, con gusto te ayudamos.'),
  ('portal_pedido', 'Seguimiento del pedido en línea', 'pedido', 65,
   E'Hola {cliente}, en este enlace puedes ver el avance de tu pedido *{folio}* y aprobar los diseños cuando estén listos:\n\n{enlace}'),
  ('portal_diseno', 'Diseño para aprobar en línea', 'pedido', 66,
   E'Hola {cliente}, ya está lista la propuesta de diseño de tu pedido *{folio}*. Revísala y apruébala o pide cambios aquí:\n\n{enlace}\n\nCualquier cambio posterior a la aprobación puede generar costos adicionales.')
on conflict (clave) do nothing;
