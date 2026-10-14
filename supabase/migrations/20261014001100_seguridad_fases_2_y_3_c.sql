-- =====================================================================
-- 21 · Revisión de seguridad de las fases 2 y 3 (tercera parte)
--
-- Corrección (con su prueba en tests/db/seguridad_fases2y3.test.ts):
--  12. Respuestas del portal: con solo "aprobar_disenos" (Diseño) se leían TODAS las
--      respuestas del portal, incluidas las aprobaciones de cotizaciones (nombre y comentario
--      del cliente, IP y navegador). Ahora ese permiso solo alcanza las respuestas sobre
--      diseños; las de cotizaciones requieren "gestionar_cotizaciones" y las de pedidos
--      "gestionar_pedidos" (como los enlaces del portal).
--
-- No cambia la forma de ninguna tabla ni columna: solo reglas.
-- =====================================================================

alter policy "portal_respuestas: ver" on public.portal_respuestas
  using (
    (accion = 'aprobar_cotizacion' and (select public.tiene_permiso('gestionar_cotizaciones')))
    or (
      accion <> 'aprobar_cotizacion'
      and (
        (select public.tiene_permiso('gestionar_pedidos'))
        or (select public.tiene_permiso('aprobar_disenos'))
      )
    )
  );

notify pgrst, 'reload schema';
