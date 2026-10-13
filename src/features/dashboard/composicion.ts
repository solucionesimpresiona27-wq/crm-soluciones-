import type { DashboardResumen } from '@/data/tipos'

/**
 * Composición del panel tipo Centro de Control: módulos de distintos tamaños
 * en una cuadrícula de 4 columnas (escritorio) o 2 columnas (tableta y celular).
 * Cada perfil de datos tiene una composición pensada para llenar la cuadrícula sin huecos.
 */
export type IdModulo = 'ventas' | 'medidores' | 'cotizaciones' | 'cobrar' | 'accesos' | 'produccion' | 'agenda' | 'pendientes'
export type Tamano = '2x2' | '1x2' | '1x1' | '2x1'
export type PerfilPanel = 'finanzas' | 'comercial' | 'operacion'

export interface ModuloPanel {
  id: IdModulo
  tamano: Tamano
}

export const SPAN: Record<Tamano, string> = {
  '2x2': 'col-span-2 row-span-2',
  '1x2': 'col-span-1 row-span-2',
  '1x1': 'col-span-1 row-span-1',
  '2x1': 'col-span-2 row-span-1',
}

export interface Disponible {
  ventas: boolean
  cotizaciones: boolean
  cobrar: boolean
}

export function perfilPanel(d: Disponible): PerfilPanel {
  if (d.ventas) return 'finanzas'
  if (d.cotizaciones) return 'comercial'
  return 'operacion'
}

export function disponibleDe(r: DashboardResumen): Disponible {
  return {
    ventas: r.ventas_mes !== undefined,
    cotizaciones: r.cotizaciones_abiertas !== undefined,
    cobrar: r.por_cobrar !== undefined,
  }
}

export function componer(d: Disponible): ModuloPanel[] {
  const perfil = perfilPanel(d)
  const m: Array<ModuloPanel | false> =
    perfil === 'finanzas'
      ? [
          { id: 'ventas', tamano: '2x2' },
          { id: 'medidores', tamano: '1x2' },
          d.cotizaciones && { id: 'cotizaciones', tamano: '1x1' },
          d.cobrar && { id: 'cobrar', tamano: '1x1' },
          { id: 'accesos', tamano: '2x2' },
          { id: 'produccion', tamano: '2x1' },
          { id: 'agenda', tamano: '2x2' },
          { id: 'pendientes', tamano: '2x1' },
        ]
      : perfil === 'comercial'
        ? [
            { id: 'cotizaciones', tamano: '2x1' },
            { id: 'medidores', tamano: '1x2' },
            { id: 'pendientes', tamano: '1x2' },
            { id: 'produccion', tamano: '2x1' },
            d.cobrar && { id: 'cobrar', tamano: '1x1' },
            { id: 'accesos', tamano: '2x2' },
            { id: 'agenda', tamano: '2x2' },
          ]
        : [
            { id: 'produccion', tamano: '2x2' },
            { id: 'medidores', tamano: '1x2' },
            { id: 'accesos', tamano: '1x2' },
            { id: 'pendientes', tamano: '2x2' },
            { id: 'agenda', tamano: '2x2' },
          ]
  return m.filter((x): x is ModuloPanel => Boolean(x))
}

/** Clases de la celda. En celular y tableta los accesos miden solo lo necesario (la barra inferior ya tiene acciones). */
export function claseCelda(m: ModuloPanel) {
  return m.id === 'accesos' && m.tamano === '2x2' ? 'col-span-2 row-span-1 lg:row-span-2' : SPAN[m.tamano]
}
