import { describe, expect, it } from 'vitest'
import type { ClienteLista } from '@/data/modulos/clientes/contrato'
import { aCsv, filtrar, prepararFilas } from './datos'

const base: ClienteLista = {
  id: 'a', nombre: 'Panadería Ñoño', tipo: 'empresa', whatsapp: '33 1234 5678', telefono: null, email: 'pan@ejemplo.mx', ciudad: 'Zapopan',
  etiquetas: ['Frecuente'], lista_precio: 'publico', requiere_factura: false, dias_credito: 0, activo: true, vendedor_id: null, vendedor: 'Luis',
  ultima_compra_at: '2026-09-01T10:00:00Z', created_at: '2026-01-01T00:00:00Z', rfc: 'PAN201231AB1', contacto_principal: { nombre: 'Lucía Pérez', puesto: null, whatsapp: null },
}
const filas = prepararFilas([base, { ...base, id: 'b', nombre: 'Ana Ávila', tipo: 'persona', whatsapp: null, etiquetas: [], ultima_compra_at: null, rfc: null, contacto_principal: null }], { a: 1500 })

describe('lista de clientes', () => {
  it('busca sin acentos por nombre, contacto, RFC y teléfono', () => {
    const f = (texto: string) => filtrar(filas, { texto, tipo: 'todos', etiqueta: '', orden: 'nombre' }).map((x) => x.id)
    expect(f('panaderia nono')).toEqual(['a'])
    expect(f('avila')).toEqual(['b'])
    expect(f('lucia')).toEqual(['a'])
    expect(f('pan201231')).toEqual(['a'])
    expect(f('3312345')).toEqual(['a'])
  })
  it('filtra por tipo y etiqueta y ordena por última compra', () => {
    expect(filtrar(filas, { texto: '', tipo: 'persona', etiqueta: '', orden: 'nombre' }).map((x) => x.id)).toEqual(['b'])
    expect(filtrar(filas, { texto: '', tipo: 'todos', etiqueta: 'Frecuente', orden: 'nombre' }).map((x) => x.id)).toEqual(['a'])
    expect(filtrar(filas, { texto: '', tipo: 'todos', etiqueta: '', orden: 'compra' }).map((x) => x.id)).toEqual(['a', 'b'])
  })
  it('CSV con saldo solo si se pide', () => {
    expect(aCsv(filas, true)).toContain('Saldo pendiente')
    expect(aCsv(filas, false)).not.toContain('Saldo pendiente')
    expect(aCsv(filas, true)).toContain('1500.00')
  })
})
