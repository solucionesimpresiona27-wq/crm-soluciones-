import type { TipoPartida } from '@/lib/calculadora'
import type { MetodoCalculo } from '@/data/tipos'

/**
 * Concepto que la Calculadora deja listo para el editor de cotizaciones.
 * Se guarda en sessionStorage con la clave CLAVE_BORRADOR_CALCULADORA y también se manda
 * en `location.state.desdeCalculadora` al navegar a /cotizaciones/nueva.
 * El editor (CotizacionEditorPage) lo convierte en conceptos y borra la copia de sessionStorage.
 */
export const CLAVE_BORRADOR_CALCULADORA = 'impresiona:calculadora:borrador'

export interface PartidaCalculadora {
  tipo: TipoPartida
  producto_id: string | null
  concepto: string
  descripcion: string
  metodo_calculo: MetodoCalculo
  unidad: string
  ancho: number | null
  alto: number | null
  largo: number | null
  cantidad: number
  precio_unitario: number
  /** Costos por unidad de cobro (solo si quien calculó puede ver costos) */
  costos: { costo_material: number; costo_mano_obra: number; costo_fijo: number; desperdicio_pct: number; ganancia_pct: number } | null
}

export interface BorradorCalculadora {
  version: 1
  creado: string
  lista: 'publico' | 'mayoreo' | 'agencia'
  aplica_iva: boolean
  partidas: PartidaCalculadora[]
}

export function guardarBorrador(b: BorradorCalculadora) {
  try {
    sessionStorage.setItem(CLAVE_BORRADOR_CALCULADORA, JSON.stringify(b))
  } catch {
    /* sin almacenamiento: queda el state de la navegación */
  }
}
