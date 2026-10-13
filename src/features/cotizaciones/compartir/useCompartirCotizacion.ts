import type { CotizacionCompleta } from '@/data/tipos'

/**
 * CONTRATO (lo implementa el flujo de PDF/WhatsApp):
 * - enviarWhatsApp: genera el PDF, lo comparte (celular) o lo descarga y abre WhatsApp con el
 *   mensaje de la plantilla "cotizacion_envio"; si era borrador la marca como enviada.
 * - descargarPdf: genera y descarga `<folio>.pdf`.
 */
export function useCompartirCotizacion(): {
  enviarWhatsApp: (c: CotizacionCompleta) => Promise<void>
  descargarPdf: (c: CotizacionCompleta) => Promise<void>
  trabajando: boolean
} {
  return {
    enviarWhatsApp: async () => undefined,
    descargarPdf: async () => undefined,
    trabajando: false,
  }
}
