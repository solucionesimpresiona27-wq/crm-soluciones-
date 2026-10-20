/**
 * `cotizaciones.listar()` real: trae todas las cotizaciones por lotes con `.range()`, sin el tope
 * fijo de 500 de antes. Se simula el cliente de Supabase (sin red) con un servidor que devuelve
 * a lo más `maxRows` filas por petición, como el max_rows de PostgREST.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Fila = { id: string; total: string; created_at: string }
const servidor = { filas: [] as Fila[], maxRows: 1000, peticiones: [] as Array<[number, number]> }

vi.mock('@/lib/supabase', () => ({
  DEMO: false,
  supabase: () => ({
    from: () => {
      let conteo = false
      const q = {
        select: (_cols: string, opciones?: { count?: string }) => ((conteo = opciones?.count === 'exact'), q),
        order: () => q,
        range: async (desde: number, hasta: number) => {
          servidor.peticiones.push([desde, hasta])
          const fin = Math.min(hasta + 1, desde + servidor.maxRows)
          return { data: servidor.filas.slice(desde, fin), error: null, count: conteo ? servidor.filas.length : null }
        },
      }
      return q
    },
  }),
}))

const { apiSupabase } = await import('./supabaseApi')

function sembrar(n: number) {
  servidor.filas = Array.from({ length: n }, (_, i) => ({ id: `c${i}`, total: String(i), created_at: '2026-10-20T10:00:00Z' }))
  servidor.peticiones = []
}

describe('cotizaciones.listar (real)', () => {
  beforeEach(() => {
    servidor.maxRows = 1000
  })

  it('trae más de 500 cotizaciones, en lotes sin traslapes', async () => {
    sembrar(2345)
    const lista = await apiSupabase.cotizaciones.listar()
    expect(lista).toHaveLength(2345)
    expect(new Set(lista.map((c) => c.id)).size).toBe(2345)
    expect(lista[2344]).toMatchObject({ id: 'c2344', total: 2344 })
    expect(servidor.peticiones).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })

  it('con pocas cotizaciones basta una petición', async () => {
    sembrar(12)
    expect(await apiSupabase.cotizaciones.listar()).toHaveLength(12)
    expect(servidor.peticiones).toHaveLength(1)
  })

  it('completa la lista aunque el servidor limite a menos filas por petición', async () => {
    servidor.maxRows = 300
    sembrar(1234)
    const lista = await apiSupabase.cotizaciones.listar()
    expect(lista.map((c) => c.id)).toEqual(servidor.filas.map((f) => f.id))
  })
})
