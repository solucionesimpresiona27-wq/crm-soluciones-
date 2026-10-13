import type { Configuracion, CotizacionCompleta } from '@/data/tipos'
import { DEMO } from '@/lib/supabase'

/**
 * CONTRATO (lo implementa el editor/PDF): genera el PDF de la cotización con la identidad
 * de la empresa. Se carga bajo demanda para no aumentar el peso inicial de la app.
 */
export async function generarPdfCotizacion(c: CotizacionCompleta, config: Configuracion): Promise<Blob> {
  // La librería de PDF (y el diseño del documento) se descargan solo la primera vez que se usan.
  const [{ pdf }, { createElement }, { DocumentoCotizacion }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('react'),
    import('./DocumentoCotizacion'),
  ])
  const logo = new URL(`${import.meta.env.BASE_URL}brand/logo.png`, window.location.href).href
  const documento = createElement(DocumentoCotizacion, { c, config, logo, marcaAgua: DEMO })
  try {
    return await pdf(documento as Parameters<typeof pdf>[0]).toBlob()
  } catch (e) {
    console.error('Error al generar el PDF', e)
    throw new Error('No se pudo generar el PDF. Inténtalo de nuevo; si sigue fallando, avisa al administrador.')
  }
}
