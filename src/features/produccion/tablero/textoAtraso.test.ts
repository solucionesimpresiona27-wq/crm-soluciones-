import { describe, expect, it } from 'vitest'
import { textoAtraso } from './TarjetaOrden'

describe('atraso en la tarjeta del tablero', () => {
  it('dice días, meses o años sin cortar la tarjeta', () => {
    expect(textoAtraso(1)).toBe('Atrasado 1 día')
    expect(textoAtraso(45)).toBe('Atrasado 45 días')
    expect(textoAtraso(90)).toBe('Atrasado 3 meses')
    expect(textoAtraso(400)).toBe('Atrasado 1 año')
    expect(textoAtraso(8800)).toBe('Atrasado 24 años')
  })
})
