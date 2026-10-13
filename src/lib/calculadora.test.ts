import { describe, expect, it } from 'vitest'
import { calcularPartida, calcularTotales, costoPartida, importePartida, precioConEscalas, unidadesCobro } from './calculadora'

describe('unidadesCobro', () => {
  it('m² multiplica ancho × alto × piezas', () => expect(unidadesCobro('m2', 2, 3, 2)).toBe(12))
  it('metro lineal multiplica largo × piezas', () => expect(unidadesCobro('metro_lineal', 3, null, null, 1.5)).toBe(4.5))
  it('pieza usa la cantidad', () => expect(unidadesCobro('pieza', 25)).toBe(25))
})

describe('precioConEscalas', () => {
  const escalas = [{ desde: 12, precio: 95 }, { desde: 50, precio: 85 }]
  it('sin alcanzar escala usa el precio base', () => expect(precioConEscalas(110, escalas, 5)).toBe(110))
  it('aplica la escala mayor alcanzada', () => expect(precioConEscalas(110, escalas, 60)).toBe(85))
  it('sin precio devuelve null', () => expect(precioConEscalas(null, [], 3)).toBeNull())
})

describe('calcularPartida', () => {
  it('lona por m² con precio de catálogo: precio por pieza', () => {
    const r = calcularPartida({ metodo: 'm2', cantidad: 2, ancho: 3, alto: 2, modoPrecio: 'catalogo', precioCatalogo: 180 })
    expect(r.unidadesCobro).toBe(12)
    expect(r.precioUnitario).toBe(1080)
    expect(r.importe).toBe(2160)
  })

  it('por costo + ganancia con desperdicio', () => {
    const r = calcularPartida({
      metodo: 'm2', cantidad: 2, ancho: 3, alto: 2, modoPrecio: 'costo',
      costoMaterial: 60, costoManoObra: 10, desperdicioPct: 10, gananciaPct: 100,
    })
    expect(r.costoTotal).toBe(912)
    expect(r.importe).toBe(1824)
    expect(r.utilidad).toBe(912)
    expect(r.margenPct).toBe(50)
  })

  it('aplica el importe mínimo', () => {
    const r = calcularPartida({ metodo: 'm2', cantidad: 1, ancho: 0.5, alto: 0.5, modoPrecio: 'catalogo', precioCatalogo: 180, precioMinimo: 150 })
    expect(r.importe).toBe(150)
    expect(r.aplicoMinimo).toBe(true)
  })

  it('marca cuando el producto no tiene precio', () => {
    const r = calcularPartida({ metodo: 'pieza', cantidad: 3, modoPrecio: 'catalogo', precioCatalogo: null })
    expect(r.sinPrecio).toBe(true)
    expect(r.importe).toBe(0)
  })

  it('millares con precio manual', () => {
    const r = calcularPartida({ metodo: 'millar', cantidad: 2.5, modoPrecio: 'manual', precioManual: 450 })
    expect(r.precioUnitario).toBe(450)
    expect(r.importe).toBe(1125)
  })
})

describe('totales (igual que la base de datos)', () => {
  it('descuento %, recargo e IVA', () => {
    const t = calcularTotales({ importes: [2160, 500], descuentoTipo: 'pct', descuentoValor: 10, recargoPct: 5, aplicaIva: true, ivaPct: 16 })
    expect(t).toEqual({ subtotal: 2660, descuento: 266, recargo: 119.7, base: 2513.7, iva: 402.19, total: 2915.89 })
  })
  it('el descuento no supera el subtotal', () => {
    const t = calcularTotales({ importes: [100], descuentoTipo: 'monto', descuentoValor: 500, recargoPct: 0, aplicaIva: false, ivaPct: 16 })
    expect(t.total).toBe(0)
  })
  it('importe con descuento por partida', () => expect(importePartida(3, 99.99, 10)).toBe(269.97))
  it('costo de partida', () => expect(costoPartida('m2', 2, { ancho: 3, alto: 2 }, { costoMaterial: 60, costoManoObra: 10, desperdicioPct: 10 })).toBe(912))
})
