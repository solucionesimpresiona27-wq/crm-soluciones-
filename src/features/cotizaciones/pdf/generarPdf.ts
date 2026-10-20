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
  const quitarBuffer = bufferProvisional()
  try {
    return await pdf(documento as Parameters<typeof pdf>[0]).toBlob()
  } catch (e) {
    console.error('Error al generar el PDF', e)
    throw new Error('No se pudo generar el PDF. Inténtalo de nuevo; si sigue fallando, avisa al administrador.')
  } finally {
    quitarBuffer()
  }
}

/**
 * @react-pdf 4.x llama `Buffer.isBuffer()` después de cargar cada imagen (el logo); en el navegador
 * `Buffer` no existe y la librería lo reporta como aviso en la consola en cada PDF.
 * Se define un `Buffer` mínimo solo mientras se genera el documento y se quita al terminar,
 * porque otras librerías (p. ej. supabase-js) usan `Buffer.from` si encuentran uno global.
 */
function bufferProvisional() {
  const g = globalThis as { Buffer?: unknown }
  if (typeof g.Buffer !== 'undefined') return () => {}
  const provisional = { isBuffer: () => false }
  g.Buffer = provisional
  return () => {
    if (g.Buffer === provisional) delete g.Buffer
  }
}
