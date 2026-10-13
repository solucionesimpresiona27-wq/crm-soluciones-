import { describe, expect, it } from 'vitest'
import { enlaceWhatsApp, llenarPlantilla, telefonoWhatsApp } from './whatsapp'

describe('whatsapp', () => {
  it('normaliza teléfonos de México', () => {
    expect(telefonoWhatsApp('33 3492 2524')).toBe('523334922524')
    expect(telefonoWhatsApp('+52 1 33 3492 2524')).toBe('523334922524')
    expect(telefonoWhatsApp('123')).toBeNull()
  })
  it('arma el enlace con el mensaje', () => {
    expect(enlaceWhatsApp('3334922524', 'Hola 👋')).toBe('https://wa.me/523334922524?text=Hola%20%F0%9F%91%8B')
  })
  it('llena plantillas y limpia variables vacías', () => {
    expect(llenarPlantilla('Hola {cliente}\n\n{enlace}\n\nAdiós', { cliente: 'Ana', enlace: '' })).toBe('Hola Ana\n\nAdiós')
  })
})
