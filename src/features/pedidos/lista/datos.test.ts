import { describe, expect, it } from 'vitest'
import type { PedidoLista } from '@/data/modulos/pedidos/contrato'
import { cumpleRapido, enFase, prepararFilas, textoEntrega } from './datos'

const base = { folio: 'PED-0001', cliente: 'Ñandú Gráfico', titulo: 'Lona', estado: 'en_produccion', atrasado: false, saldo: 100, requiere_factura: true, facturado: false, fecha_entrega: '2026-10-14' } as unknown as PedidoLista

describe('lista de pedidos', () => {
  it('busca sin acentos, agrupa por fase y aplica filtros rápidos', () => {
    const [f] = prepararFilas([base], '2026-10-14')
    expect(f.busqueda).toContain('nandu grafico')
    expect(enFase(f, 'produccion')).toBe(true)
    expect(enFase(f, 'diseno')).toBe(false)
    expect(enFase(f, 'todos')).toBe(true)
    expect(cumpleRapido(f, 'hoy')).toBe(true)
    expect(cumpleRapido(f, 'saldo')).toBe(true)
    expect(cumpleRapido(f, 'factura')).toBe(true)
    expect(cumpleRapido(f, 'atrasados')).toBe(false)
  })
  it('texto de entrega relativo', () => {
    expect(textoEntrega(0)).toBe('Hoy')
    expect(textoEntrega(-3)).toBe('Hace 3 días')
    expect(textoEntrega(90)).toBe('En 3 meses')
    expect(textoEntrega(-800)).toBe('Hace 2 años')
  })
})
