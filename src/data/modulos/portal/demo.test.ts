import { afterEach, describe, expect, it } from 'vitest'
import { almacen } from '@/data/demo/almacen'
import { cambiarA, entrarComo, salir } from '@/data/demo/paraPruebas'
import { COTIZACION_ACTUALIZADA, ENLACE_NO_VALIDO } from './contrato'
import { portalDemo as api } from './demo'

afterEach(salir)

describe('portal · vista previa', () => {
  it('el cliente ve su cotización sin sesión y la aprueba una vez', async () => {
    entrarComo(null)
    const v = await api.portal.obtener('vista-previa-COT-0001-enlace-ficticio-7Hq2')
    expect(v.cotizacion?.folio).toBe('COT-0001')
    expect(v.cotizacion?.puede_aprobar).toBe(true)
    expect(v.empresa.rfc).toBeUndefined()
    expect(v.pedido).toBeUndefined()
    await expect(api.portal.aprobarCotizacion('vista-previa-COT-0001-enlace-ficticio-7Hq2', v.cotizacion!.version, 'A')).rejects.toThrow('2 a 120')
    const r = await api.portal.aprobarCotizacion('vista-previa-COT-0001-enlace-ficticio-7Hq2', v.cotizacion!.version, 'Mariana Pérez', 'Adelante')
    expect(r).toEqual({ ok: true, folio: 'COT-0001', estado: 'aceptada' })
    await expect(api.portal.aprobarCotizacion('vista-previa-COT-0001-enlace-ficticio-7Hq2', v.cotizacion!.version, 'Mariana Pérez')).rejects.toThrow('ya fue aprobada')
    expect(almacen.oportunidades.find((o) => o.id === 'o12')?.etapa).toBe('ganado')
  })

  it('el cliente aprueba la versión que vio: si el asesor la cambió, se rechaza y debe revisarla', async () => {
    entrarComo(null)
    const token = 'vista-previa-COT-0001-enlace-ficticio-7Hq2'
    const vista = await api.portal.obtener(token)
    // El asesor cambia un precio mientras el cliente la revisa
    const q = almacen.cotizaciones.find((x) => x.folio === 'COT-0001')!
    q.partidas[0].precio_unitario += 100
    q.total += 116
    await expect(api.portal.aprobarCotizacion(token, vista.cotizacion!.version, 'Mariana Pérez')).rejects.toThrow(COTIZACION_ACTUALIZADA)
    await expect(api.portal.aprobarCotizacion(token, '', 'Mariana Pérez')).rejects.toThrow(COTIZACION_ACTUALIZADA)
    expect(q.estado).not.toBe('aceptada')
    const actual = await api.portal.obtener(token)
    expect(actual.cotizacion!.version).not.toBe(vista.cotizacion!.version)
    expect(actual.cotizacion!.total).toBe(q.total)
    await api.portal.aprobarCotizacion(token, actual.cotizacion!.version, 'Mariana Pérez')
    expect(q.estado).toBe('aceptada')
  })

  it('el cliente aprueba un diseño o pide cambios con comentario', async () => {
    entrarComo(null)
    const token = 'vista-previa-PED-0044-enlace-ficticio-K9w4'
    const v = await api.portal.obtener(token)
    const pendientes = v.pedido!.disenos.filter((d) => d.puede_responder)
    expect(pendientes.map((d) => d.version)).toEqual([3, 2])
    await expect(api.portal.responderDiseno(token, pendientes[0].id, false, 'Roberto Salas')).rejects.toThrow('qué cambios')
    await api.portal.responderDiseno(token, pendientes[1].id, true, 'Roberto Salas')
    const r = await api.portal.responderDiseno(token, pendientes[0].id, true, 'Roberto Salas')
    expect(r.estado_pedido).toBe('aprobado')
    expect((await api.portal.archivos(token)).length).toBe(3)
  })

  it('enlaces revocados o inventados dan el mismo error; el CRM crea y revoca', async () => {
    entrarComo(null)
    await expect(api.portal.obtener('vista-previa-COT-0006-enlace-ficticio-R5t1')).rejects.toThrow(ENLACE_NO_VALIDO)
    await expect(api.portal.obtener('no-existe')).rejects.toThrow(ENLACE_NO_VALIDO)
    await expect(api.portal.obtener('vista-previa-pedido-anterior-vencido-Q8p3')).rejects.toThrow(ENLACE_NO_VALIDO)
    cambiarA('ventas')
    const reutilizado = await api.portal.crearEnlace('cotizacion', 'demo-cot-1')
    expect(reutilizado.nuevo).toBe(false)
    const nuevo = await api.portal.crearEnlace('pedido', 'demo-ped-3', { dias: 7 })
    expect(nuevo.nuevo).toBe(true)
    expect(nuevo.url).toContain('#/portal/')
    const enlaces = await api.portal.enlaces({ pedidoId: 'demo-ped-3' })
    expect(enlaces.map((e) => e.folio).sort()).toEqual(['COT-0003', 'PED-0042'])
    await api.portal.revocarEnlace(nuevo.id)
    await expect(api.portal.obtener(nuevo.token)).rejects.toThrow(ENLACE_NO_VALIDO)
    cambiarA('diseno')
    await expect(api.portal.crearEnlace('pedido', 'demo-ped-3')).rejects.toThrow('No tienes permiso')
  })
})
