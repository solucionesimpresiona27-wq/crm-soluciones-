import { describe, expect, it } from 'vitest'
import { cambiosLegibles, contarAnulaciones, contrasenaValida, estadoPermisos, generarContrasena, valorLegible } from './util'

describe('usuarios · utilidades', () => {
  it('genera contraseñas válidas para la función admin-usuarios', () => {
    for (let i = 0; i < 20; i++) expect(contrasenaValida(generarContrasena())).toBe(true)
  })

  it('distingue lo del rol de la anulación por usuario', () => {
    const u = { rol: 'ventas' as const, permisos_personalizados: { ver_costos: true, ver_precios: true } }
    const e = estadoPermisos(u)
    expect(e.ver_costos).toMatchObject({ delRol: false, efectivo: true, anulado: true })
    // Igual que el rol: no cuenta como anulación
    expect(e.ver_precios.anulado).toBe(false)
    expect(contarAnulaciones(u)).toBe(1)
    expect(contarAnulaciones({ rol: 'admin', permisos_personalizados: { ver_costos: false } })).toBe(0)
  })

  it('muestra los cambios de la bitácora de forma legible', () => {
    const c = cambiosLegibles({ accion: 'modificar', datos: null, cambios: { vigencia_dias: [15, 20], mostrar_datos_fiscales: [false, true], updated_at: ['a', 'b'] } })
    expect(c).toEqual([
      { campo: 'Vigencia (días)', antes: '15', despues: '20' },
      { campo: 'Mostrar datos fiscales', antes: 'No', despues: 'Sí' },
    ])
    expect(valorLegible({ ver_costos: true })).toBe('ver costos: Sí'.replace(/^./, 'V'))
    expect(valorLegible(null)).toBe('vacío')
  })
})
