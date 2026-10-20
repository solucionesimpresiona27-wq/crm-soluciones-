import { UNIDADES_MATERIAL, type CategoriaGasto, type Gasto, type Material, type UnidadMaterial } from '@/data/modulos/inventario/contrato'
import { redondear } from '@/lib/utils'

/** Proporción del medidor de existencia: el mínimo queda en el 40 % de la cápsula. */
export function nivelExistencia(m: Pick<Material, 'existencia' | 'stock_minimo'>) {
  const ex = Math.max(0, m.existencia)
  if (m.stock_minimo <= 0) return ex > 0 ? 1 : 0
  return Math.min(1, ex / (m.stock_minimo * 2.5))
}

/** Posición de la marca del mínimo dentro del medidor (0 a 1); null si no hay mínimo. */
export const marcaMinimo = (m: Pick<Material, 'stock_minimo'>) => (m.stock_minimo > 0 ? 0.4 : null)

/** Lee un número escrito por la persona (acepta coma decimal); null si está vacío o no es número. */
export function leerNumero(texto: string): number | null {
  const t = texto.trim().replace(/\s/g, '').replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export interface DesgloseGastos {
  total: number
  cuantos: number
  categorias: { categoria: CategoriaGasto; monto: number; cuantos: number }[]
}

/** Total y desglose por categoría (de mayor a menor) de los gastos vigentes. */
export function desgloseGastos(gastos: Pick<Gasto, 'categoria' | 'monto' | 'cancelado'>[]): DesgloseGastos {
  const mapa = new Map<CategoriaGasto, { monto: number; cuantos: number }>()
  let total = 0
  let cuantos = 0
  for (const g of gastos) {
    if (g.cancelado) continue
    total = redondear(total + g.monto)
    cuantos++
    const c = mapa.get(g.categoria) ?? { monto: 0, cuantos: 0 }
    mapa.set(g.categoria, { monto: redondear(c.monto + g.monto), cuantos: c.cuantos + 1 })
  }
  return { total, cuantos, categorias: [...mapa.entries()].map(([categoria, v]) => ({ categoria, ...v })).sort((a, b) => b.monto - a.monto) }
}

const PLURALES: Partial<Record<UnidadMaterial, string>> = {
  metro: 'metros',
  hoja: 'hojas',
  pieza: 'piezas',
  litro: 'litros',
  rollo: 'rollos',
  millar: 'millares',
}

/** Unidad concordada con la cantidad: "1 hoja", "780 hojas", "2.5 millares"; m² y kg no cambian. */
export function nombreUnidad(n: number, u: UnidadMaterial) {
  return Math.abs(n) === 1 ? UNIDADES_MATERIAL[u] : (PLURALES[u] ?? UNIDADES_MATERIAL[u])
}
