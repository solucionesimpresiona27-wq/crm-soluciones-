import { afterEach, describe, expect, it } from 'vitest'
import { cambiarA, entrarComo, salir } from '@/data/demo/paraPruebas'
import { administracionDemo as api } from './demo'

afterEach(salir)

describe('administración · vista previa', () => {
  it('configuración y plantillas (lo que ya usa la app sigue igual)', async () => {
    entrarComo('ventas')
    const conf = await api.configuracion.obtener()
    expect(conf.mostrar_datos_fiscales).toBe(false)
    expect(conf.rfc).toBeNull()
    const plantillas = await api.plantillas.listar()
    expect(plantillas.find((p) => p.clave === 'cotizacion_envio')?.id).toBe('p1')
    expect(plantillas.find((p) => p.clave === 'cotizacion_seguimiento')?.id).toBe('p2')
    await expect(api.configuracion.guardar({ vigencia_dias: 20 })).rejects.toThrow('Solo un administrador')
    cambiarA('admin')
    expect((await api.configuracion.guardar({ vigencia_dias: 20 })).vigencia_dias).toBe(20)
    const p = await api.plantillas.guardar('p2', { activo: false })
    expect(p.activo).toBe(false)
    expect((await api.plantillas.listar()).some((x) => x.id === 'p2')).toBe(false)
    expect((await api.plantillas.todas()).some((x) => x.id === 'p2')).toBe(true)
  })

  it('usuarios: alta, permisos personalizados y último administrador', async () => {
    entrarComo('admin')
    const equipo = await api.usuarios.equipo()
    expect(equipo.map((u) => u.nombre)).toContain('Pedro Álvarez')
    expect(equipo.map((u) => u.nombre)).not.toContain('Mariana Soto')
    await expect(api.usuarios.crear({ email: 'nuevo@demo.local', password: 'corta', nombre: 'Nuevo', rol: 'ventas' })).rejects.toThrow('8 caracteres')
    const { id } = await api.usuarios.crear({ email: 'nuevo@demo.local', password: 'Impresiona2026', nombre: 'Nuevo', rol: 'ventas' })
    const u = await api.usuarios.cambiarPermisos(id, { ver_reportes: true, registrar_pagos: false })
    expect(u.permisos_personalizados).toEqual({ ver_reportes: true, registrar_pagos: false })
    expect((await api.usuarios.cambiarPermisos(id, { ver_reportes: null })).permisos_personalizados).toEqual({ registrar_pagos: false })
    await expect(api.usuarios.activar('demo-admin', false)).rejects.toThrow('propia cuenta')
    await expect(api.usuarios.actualizar('demo-admin', { rol: 'ventas' })).rejects.toThrow('al menos un administrador')
  })

  it('bitácora solo para administración', async () => {
    entrarComo('admin')
    const b = await api.bitacora.listar({ limite: 5 })
    expect(b).toHaveLength(5)
    expect(b[0].id).toBeGreaterThan(b[4].id)
    expect((await api.bitacora.listar({ tabla: 'cortes_caja' })).length).toBeGreaterThan(0)
    cambiarA('ventas')
    await expect(api.bitacora.listar()).rejects.toThrow('Solo un administrador')
  })
})
