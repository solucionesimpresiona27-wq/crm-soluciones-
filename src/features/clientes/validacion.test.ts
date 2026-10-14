import { describe, expect, it } from 'vitest'
import { digitosTelefono, validarCodigoPostal, validarCorreo, validarRfc, validarTelefono } from './validacion'

describe('validación de clientes', () => {
  it('RFC de persona moral y física', () => {
    expect(validarRfc('ABC201231AB1')).toBeNull()
    expect(validarRfc('abcd8501019k3')).toBeNull()
    expect(validarRfc('')).toBeNull()
    expect(validarRfc('ABC2012311')).toMatch(/no válido/)
    expect(validarRfc('ABC201331AB1')).toMatch(/no válido/)
  })
  it('WhatsApp de 10 dígitos, con o sin lada', () => {
    expect(validarTelefono('33 1234 5678')).toBeNull()
    expect(validarTelefono('+52 1 33 1234 5678')).toBeNull()
    expect(validarTelefono('331234')).toMatch(/10 dígitos/)
    expect(digitosTelefono('+52 33 1234 5678')).toBe('3312345678')
  })
  it('correo y código postal', () => {
    expect(validarCorreo('ventas@empresa.com')).toBeNull()
    expect(validarCorreo('ventas@empresa')).toMatch(/no parece/)
    expect(validarCodigoPostal('44100')).toBeNull()
    expect(validarCodigoPostal('4410')).toMatch(/5 dígitos/)
  })
})
