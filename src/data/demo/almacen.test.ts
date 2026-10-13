import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { almacen, reiniciarAlmacen } from './almacen'
import { existenciaCalculada, redondear2 } from './reglas'
import { SERIE_OBJETIVO } from './semillaVentas'

/** La semilla debe cuadrar cualquier día del mes (incluido el día 1, cuando todo se recorre). */
const DIAS = ['2026-10-13', '2026-10-01', '2026-03-31', '2027-01-02']

describe.each(DIAS)('almacén de la vista previa (%s)', (hoy) => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(`${hoy}T20:30:00`))
    reiniciarAlmacen()
  })
  afterEach(() => vi.useRealTimers())

  const mesDe = (k: number) => {
    const d = new Date(`${hoy}T12:00:00`)
    const m = new Date(d.getFullYear(), d.getMonth() - k, 1)
    return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`
  }

  it('reproduce la serie de 6 meses del panel (vendido y cobrado)', () => {
    const a = almacen
    const local = (iso: string) => {
      const d = new Date(iso)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }
    SERIE_OBJETIVO.forEach(([vendido, cobrado], i) => {
      const mes = mesDe(5 - i)
      const v = a.pedidos.filter((p) => p.estado !== 'cancelado' && local(p.created_at) === mes).reduce((s, p) => s + p.total, 0)
      const c = a.pagos.filter((p) => !p.cancelado && p.fecha.slice(0, 7) === mes).reduce((s, p) => s + (p.tipo === 'devolucion' ? -p.importe : p.importe), 0)
      expect(redondear2(v), `vendido ${mes}`).toBe(vendido)
      expect(redondear2(c), `cobrado ${mes}`).toBe(cobrado)
    })
  })

  it('por cobrar: 12 pedidos con $60,629.28; vencidos 2 por $5,974', () => {
    const conSaldo = almacen.pedidos.filter((p) => p.estado !== 'cancelado' && (p.saldo ?? 0) > 0)
    expect(conSaldo).toHaveLength(12)
    expect(redondear2(conSaldo.reduce((s, p) => s + (p.saldo ?? 0), 0))).toBe(60629.28)
    const vencidos = conSaldo.filter((p) => p.fecha_limite_pago && p.fecha_limite_pago < hoy)
    expect(vencidos.map((p) => p.folio).sort()).toEqual(['PED-0033', 'PED-0035'])
    expect(redondear2(vencidos.reduce((s, p) => s + (p.saldo ?? 0), 0))).toBe(5974)
  })

  it('utilidad estimada del mes: venta $104,870.69 y costo $58,212.40', () => {
    const delMes = almacen.pedidos.filter((p) => p.estado !== 'cancelado' && new Date(p.created_at) >= new Date(`${mesDe(0)}-01T00:00:00`))
    const venta = redondear2(delMes.reduce((s, p) => s + p.total - p.iva, 0))
    const ids = new Set(almacen.partidas.filter((x) => delMes.some((p) => p.id === x.pedido_id)).map((x) => x.id))
    const costo = redondear2(almacen.partida_costos.filter((x) => ids.has(x.partida_id)).reduce((s, x) => s + x.costo_total, 0))
    expect(venta).toBe(104870.69)
    expect(costo).toBe(58212.4)
  })

  it('folios de pedido únicos y consecutivos; los pedidos liquidados no deben nada', () => {
    const folios = almacen.pedidos.map((p) => p.folio).sort()
    expect(new Set(folios).size).toBe(folios.length)
    expect(folios[0]).toBe('PED-0001')
    expect(folios.at(-1)).toBe('PED-0048')
    for (const p of almacen.pedidos.filter((x) => ['finalizado', 'entregado'].includes(x.estado))) {
      expect(p.saldo, p.folio).toBe(0)
      expect(p.estado_pago, p.folio).toBe('liquidado')
    }
  })

  it('existencias = suma de movimientos; 4 materiales en stock bajo', () => {
    for (const m of almacen.materiales) expect(m.existencia, m.nombre).toBe(existenciaCalculada(almacen, m.id))
    expect(almacen.materiales.filter((m) => m.bajo_minimo).map((m) => m.id).sort()).toEqual(['mat-couche150', 'mat-esmerilado', 'mat-lona', 'mat-tinta-m'])
  })

  it('embudo: abiertas + cerradas este mes como en el panel anterior', () => {
    const inicio = new Date(`${mesDe(0)}-01T00:00:00`).toISOString()
    const e: Record<string, [number, number]> = {}
    for (const o of almacen.oportunidades.filter((x) => !['ganado', 'perdido'].includes(x.etapa) || (x.cerrada_at && x.cerrada_at >= inicio))) {
      const [n, v] = e[o.etapa] ?? [0, 0]
      e[o.etapa] = [n + 1, v + (o.valor_estimado ?? 0)]
    }
    expect(e).toEqual({
      prospecto_nuevo: [4, 18400],
      contactado: [3, 12600],
      interesado: [2, 21300],
      cotizacion_enviada: [4, 31940],
      en_seguimiento: [2, 7400],
      ganado: [5, 62800],
      perdido: [1, 5011],
    })
  })

  it('las fechas nunca quedan en el futuro', () => {
    const ahora = new Date().toISOString()
    for (const p of almacen.pagos) expect(p.created_at <= ahora, p.id).toBe(true)
    for (const p of almacen.pedidos) expect(p.created_at <= ahora, p.folio).toBe(true)
    for (const m of almacen.movimientos_inventario) expect(m.fecha <= ahora, m.id).toBe(true)
  })
})
