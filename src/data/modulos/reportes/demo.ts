/** MÓDULO REPORTES · implementación de la vista previa (calcula sobre el almacén en memoria). */
import { almacen as a, copia } from '@/data/demo/almacen'
import { fechaLocal, nombrePerfil, redondear2 } from '@/data/demo/reglas'
import { espera, exigir } from '@/data/demo/sesion'
import { TIPOS_PARTIDA, unidadesCobro } from '@/lib/calculadora'
import type { Agrupacion, ApiReportes, DesempenoVendedor, MejorCliente, ProductoVendido, UtilidadPedido, VentasPeriodo } from './contrato'

const dia = (s: string) => new Date(`${s}T12:00:00`)
const texto = (d: Date) => fechaLocal(d)

function validar(desde: string, hasta: string, maxDias = 3660) {
  if (!desde || !hasta) throw new Error('Indica las fechas del reporte')
  if (hasta < desde) throw new Error('La fecha final debe ser posterior a la inicial')
  if ((dia(hasta).getTime() - dia(desde).getTime()) / 86_400_000 > maxDias) throw new Error(`El periodo es demasiado largo: consulta como máximo ${maxDias} días`)
}

/** Inicio del periodo (semana = lunes, como date_trunc de PostgreSQL). */
function inicioPeriodo(fecha: string, agrupar: Agrupacion) {
  const d = dia(fecha)
  if (agrupar === 'mes') return texto(new Date(d.getFullYear(), d.getMonth(), 1, 12))
  if (agrupar === 'semana') return texto(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7), 12))
  return fecha
}

function siguiente(fecha: string, agrupar: Agrupacion) {
  const d = dia(fecha)
  if (agrupar === 'mes') return texto(new Date(d.getFullYear(), d.getMonth() + 1, 1, 12))
  return texto(new Date(d.getFullYear(), d.getMonth(), d.getDate() + (agrupar === 'semana' ? 7 : 1), 12))
}

const vendidos = (desde: string, hasta: string) =>
  a.pedidos.filter((p) => p.estado !== 'cancelado' && fechaLocal(p.created_at) >= desde && fechaLocal(p.created_at) <= hasta)
const pagosEn = (desde: string, hasta: string) => a.pagos.filter((p) => !p.cancelado && p.fecha >= desde && p.fecha <= hasta)
const neto = (p: (typeof a.pagos)[number]) => (p.tipo === 'devolucion' ? -p.importe : p.importe)
const suma = (xs: number[]) => redondear2(xs.reduce((t, x) => t + x, 0))

export const reportesDemo: ApiReportes = {
  reportes: {
    async ventas(desde, hasta, agrupar = 'dia') {
      exigir('ver_reportes')
      validar(desde, hasta, agrupar === 'dia' ? 400 : agrupar === 'semana' ? 1830 : 3660)
      await espera(300)
      const filas = new Map<string, VentasPeriodo>()
      for (let p = inicioPeriodo(desde, agrupar); p <= inicioPeriodo(hasta, agrupar); p = siguiente(p, agrupar)) {
        filas.set(p, { periodo: p, vendido: 0, pedidos: 0, cobrado: 0, cotizado: 0, cotizaciones: 0 })
      }
      for (const p of vendidos(desde, hasta)) {
        const f = filas.get(inicioPeriodo(fechaLocal(p.created_at), agrupar))!
        f.vendido = redondear2(f.vendido + p.total)
        f.pedidos++
      }
      for (const p of pagosEn(desde, hasta)) {
        const f = filas.get(inicioPeriodo(p.fecha, agrupar))!
        f.cobrado = redondear2(f.cobrado + neto(p))
      }
      for (const q of a.cotizaciones.filter((x) => ['enviada', 'aceptada', 'rechazada'].includes(x.estado) && x.fecha >= desde && x.fecha <= hasta)) {
        const f = filas.get(inicioPeriodo(q.fecha, agrupar))!
        f.cotizado = redondear2(f.cotizado + q.total)
        f.cotizaciones++
      }
      return [...filas.values()]
    },

    async productos(desde, hasta, limite = 20) {
      exigir('ver_reportes')
      validar(desde, hasta)
      await espera(300)
      const ids = new Set(vendidos(desde, hasta).map((p) => p.id))
      const grupos = new Map<string, ProductoVendido & { _pedidos: Set<string> }>()
      for (const pa of a.partidas.filter((x) => x.pedido_id && ids.has(x.pedido_id))) {
        const clave = pa.producto_id ?? `tipo:${pa.tipo}`
        const prod = pa.producto_id ? a.productos.find((x) => x.id === pa.producto_id) : undefined
        const g = grupos.get(clave) ?? {
          producto_id: pa.producto_id,
          producto: prod?.nombre ?? (pa.tipo === 'concepto' ? 'Conceptos sin producto' : pa.tipo === 'extra' ? 'Extras' : TIPOS_PARTIDA[pa.tipo]),
          categoria: prod ? (a.categorias.find((c) => c.id === prod.categoria_id)?.nombre ?? null) : null,
          tipo: pa.producto_id ? null : pa.tipo,
          unidad: prod?.unidad ?? null,
          cantidad: 0,
          unidades: 0,
          importe: 0,
          pedidos: 0,
          _pedidos: new Set<string>(),
        }
        g.cantidad = redondear2(g.cantidad + pa.cantidad)
        g.unidades = Math.round((g.unidades + unidadesCobro(pa.metodo_calculo, pa.cantidad, pa.ancho, pa.alto, pa.largo)) * 1000) / 1000
        g.importe = redondear2(g.importe + (pa.importe ?? 0))
        g._pedidos.add(pa.pedido_id!)
        g.pedidos = g._pedidos.size
        grupos.set(clave, g)
      }
      return [...grupos.values()]
        .sort((x, y) => y.importe - x.importe || y.cantidad - x.cantidad)
        .slice(0, Math.min(Math.max(limite, 1), 200))
        .map(({ _pedidos: _p, ...g }) => g)
    },

    async vendedores(desde, hasta) {
      exigir('ver_reportes')
      validar(desde, hasta)
      await espera(300)
      const filas = new Map<string, DesempenoVendedor>()
      const fila = (id: string | null) => {
        const k = id ?? ''
        if (!filas.has(k)) {
          filas.set(k, { vendedor_id: id, nombre: nombrePerfil(a, id) ?? 'Sin vendedor', cotizaciones: 0, cotizado: 0, aceptadas: 0, rechazadas: 0, tasa_cierre: null, pedidos: 0, vendido: 0, cobrado: 0, ticket_promedio: null })
        }
        return filas.get(k)!
      }
      for (const q of a.cotizaciones.filter((x) => ['enviada', 'aceptada', 'rechazada'].includes(x.estado) && x.fecha >= desde && x.fecha <= hasta)) {
        const f = fila(q.vendedor?.id ?? null)
        f.cotizaciones++
        f.cotizado = redondear2(f.cotizado + q.total)
        if (q.estado === 'aceptada') f.aceptadas++
        if (q.estado === 'rechazada') f.rechazadas++
      }
      for (const p of vendidos(desde, hasta)) {
        const f = fila(p.vendedor_id)
        f.pedidos++
        f.vendido = redondear2(f.vendido + p.total)
      }
      for (const pg of pagosEn(desde, hasta)) {
        const p = a.pedidos.find((x) => x.id === pg.pedido_id)
        const f = fila(p?.vendedor_id ?? null)
        f.cobrado = redondear2(f.cobrado + neto(pg))
      }
      return [...filas.values()]
        .map((f) => ({
          ...f,
          tasa_cierre: f.aceptadas + f.rechazadas ? Math.round((1000 * f.aceptadas) / (f.aceptadas + f.rechazadas)) / 10 : null,
          ticket_promedio: f.pedidos ? redondear2(f.vendido / f.pedidos) : null,
        }))
        .sort((x, y) => y.vendido - x.vendido || x.nombre.localeCompare(y.nombre, 'es'))
    },

    async clientes(desde, hasta, limite = 20) {
      exigir('ver_reportes')
      validar(desde, hasta)
      await espera(300)
      const grupos = new Map<string, MejorCliente>()
      for (const p of vendidos(desde, hasta)) {
        const c = a.clientes.find((x) => x.id === p.cliente_id)
        const g = grupos.get(p.cliente_id) ?? { cliente_id: p.cliente_id, nombre: c?.nombre ?? '', whatsapp: c?.whatsapp ?? c?.telefono ?? null, pedidos: 0, vendido: 0, cobrado: 0, saldo: 0, ticket_promedio: 0, ultima_compra: null }
        g.pedidos++
        g.vendido = redondear2(g.vendido + p.total)
        g.saldo = redondear2(g.saldo + Math.max(p.saldo ?? 0, 0))
        grupos.set(p.cliente_id, g)
      }
      for (const g of grupos.values()) {
        g.cobrado = suma(pagosEn(desde, hasta).filter((p) => p.cliente_id === g.cliente_id).map(neto))
        g.ticket_promedio = redondear2(g.vendido / g.pedidos)
        g.ultima_compra = a.pedidos.filter((p) => p.cliente_id === g.cliente_id && p.estado !== 'cancelado').map((p) => p.created_at).sort().at(-1) ?? null
      }
      return copia([...grupos.values()].sort((x, y) => y.vendido - x.vendido || x.nombre.localeCompare(y.nombre, 'es')).slice(0, Math.min(Math.max(limite, 1), 200)))
    },

    async utilidad(desde, hasta) {
      exigir('ver_reportes', 'ver_costos')
      validar(desde, hasta)
      await espera(300)
      return vendidos(desde, hasta)
        .map((p): UtilidadPedido => {
          const venta = redondear2(p.total - p.iva)
          const partidas = new Set(a.partidas.filter((x) => x.pedido_id === p.id).map((x) => x.id))
          const costoEstimado = suma(a.partida_costos.filter((x) => partidas.has(x.partida_id)).map((x) => x.costo_total))
          const gastos = suma(a.gastos.filter((g) => g.pedido_id === p.id && !g.cancelado).map((g) => g.monto))
          const consumos = a.movimientos_inventario.filter((m) => m.pedido_id === p.id && ['consumo', 'merma'].includes(m.tipo))
          const costo = (materialId: string) => a.material_costos.find((c) => c.material_id === materialId)?.costo_unitario ?? 0
          const consumo = suma(consumos.map((m) => m.cantidad * costo(m.material_id)))
          const costoReal = redondear2(gastos + consumo)
          return {
            pedido_id: p.id,
            folio: p.folio,
            titulo: p.titulo,
            cliente_id: p.cliente_id,
            cliente: a.clientes.find((c) => c.id === p.cliente_id)?.nombre ?? '',
            vendedor_id: p.vendedor_id,
            estado: p.estado,
            estado_pago: p.estado_pago,
            fecha: fechaLocal(p.created_at),
            venta,
            costo_estimado: costoEstimado,
            gastos,
            consumo_material: consumo,
            costo_real: costoReal,
            utilidad_estimada: redondear2(venta - costoEstimado),
            utilidad_real: redondear2(venta - costoReal),
            margen_estimado_pct: venta > 0 ? Math.round((1000 * (venta - costoEstimado)) / venta) / 10 : null,
            margen_real_pct: venta > 0 ? Math.round((1000 * (venta - costoReal)) / venta) / 10 : null,
            consumos_sin_costo: consumos.filter((m) => !costo(m.material_id)).length,
          }
        })
        .sort((x, y) => y.fecha.localeCompare(x.fecha) || y.folio.localeCompare(x.folio))
    },
  },
}
