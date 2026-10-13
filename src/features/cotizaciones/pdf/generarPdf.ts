import type { Configuracion, CotizacionCompleta } from '@/data/tipos'

/**
 * CONTRATO (lo implementa el editor/PDF): genera el PDF de la cotización con la identidad
 * de la empresa. Se carga bajo demanda para no aumentar el peso inicial de la app.
 */
export async function generarPdfCotizacion(_c: CotizacionCompleta, _config: Configuracion): Promise<Blob> {
  throw new Error('PDF pendiente de implementar')
}
