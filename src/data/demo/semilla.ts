/**
 * Arma el almacén de la vista previa con datos ficticios coherentes entre sí.
 * Orden: equipo → clientes → catálogo → cotizaciones y pedidos → inventario y gastos → caja → portal → bitácora.
 */
import type { Almacen } from './almacen'
import { configuracionDemo, plantillasDemo } from './datosDemo'
import { COTIZACION_OPORTUNIDAD, semillaActividades, semillaClientes, semillaContactos, semillaOportunidades } from './semillaComercial'
import { semillaCatalogo } from './semillaCatalogo'
import { crearCtx } from './semillaContexto'
import { semillaCortes, semillaGastos, semillaInventario, semillaProveedores, semillaTareas } from './semillaOperacion'
import { semillaBitacora, semillaPerfiles, semillaPortal } from './semillaSistema'
import { semillaVentas } from './semillaVentas'

export function crearSemilla(hoy?: string): Almacen {
  const c = crearCtx(hoy)
  const { porRol, todos } = semillaPerfiles(c)
  const a: Almacen = {
    perfiles: todos,
    configuracion: structuredClone(configuracionDemo),
    plantillas: structuredClone(plantillasDemo),
    clientes: semillaClientes(c),
    contactos: semillaContactos(c),
    oportunidades: semillaOportunidades(c),
    actividades: semillaActividades(c),
    ...semillaCatalogo(c),
    cotizaciones: [],
    cotizacion_oportunidad: { ...COTIZACION_OPORTUNIDAD },
    pedidos: [],
    partidas: [],
    partida_costos: [],
    pagos: [],
    pedido_eventos: [],
    archivos: [],
    tareas: semillaTareas(c),
    proveedores: semillaProveedores(c),
    materiales: [],
    material_costos: [],
    movimientos_inventario: [],
    gastos: semillaGastos(c),
    cortes_caja: [],
    portal_enlaces: [],
    portal_respuestas: [],
    bitacora: [],
    folios: { cotizacion: 1, pedido: 1, evento: 1, bitacora: 1, respuesta: 1 },
  }
  semillaVentas(a, c, porRol)
  semillaInventario(a, c)
  semillaCortes(a, c)
  semillaPortal(a, c)
  semillaBitacora(a, c)
  return a
}
