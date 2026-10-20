import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { invalidarCotizacion } from './consultas'

/** Siembra consultas de varias pantallas y devuelve las claves que quedaron invalidadas. */
function invalidadas(accion: (qc: QueryClient) => void) {
  const qc = new QueryClient()
  for (const k of [
    ['cotizaciones'],
    ['cotizaciones', 'c1'],
    ['cotizaciones', 'c2'],
    ['dashboard'],
    ['oportunidades', 'tablero'],
    ['oportunidades', 'detalle', 'o1'],
    ['pedidos', 'lista'],
    ['clientes', ''],
  ])
    qc.setQueryData(k, 1)
  accion(qc)
  return qc
    .getQueryCache()
    .getAll()
    .filter((q) => q.state.isInvalidated)
    .map((q) => q.queryKey.join('/'))
    .sort()
}

describe('invalidarCotizacion', () => {
  it('al guardar o cambiar el estado refresca la lista, el panel y el embudo (tablero y detalle)', () => {
    expect(invalidadas((qc) => invalidarCotizacion(qc, 'c1'))).toEqual([
      'cotizaciones',
      'cotizaciones/c1',
      'cotizaciones/c2', // prefijo ['cotizaciones']
      'dashboard',
      'oportunidades/detalle/o1',
      'oportunidades/tablero',
    ])
  })

  it('al convertir en pedido refresca también los pedidos', () => {
    expect(invalidadas((qc) => invalidarCotizacion(qc, 'c1', { pedido: true }))).toContain('pedidos/lista')
    expect(invalidadas((qc) => invalidarCotizacion(qc, 'c1'))).not.toContain('pedidos/lista')
  })
})
