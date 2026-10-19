/** MÓDULO PAGOS · implementación de la vista previa (almacén en memoria, datos ficticios). */
import { almacen as a, copia, nuevoId } from '@/data/demo/almacen'
import {
  ahoraISO,
  calcularCaja,
  eventoPedido,
  fechaLocal,
  nombreCliente,
  nombrePerfil,
  recalcularPedido,
  redondear2,
  registrarBitacora,
  validarCajaAbierta,
  vistaPreviaArchivo,
} from '@/data/demo/reglas'
import { dinero } from '@/lib/format'
import { esAdmin, espera, exigir, exigirAdmin, exigirAlguno, puede, usuario } from '@/data/demo/sesion'
import type { ApiPagos, Comision, ComisionDetalle, CorteCaja, CuentaPorCobrar, Pago } from './contrato'

type PagoFila = (typeof a.pagos)[number]
const comprobantes = new Map<string, string>()
const signo = (p: PagoFila) => (p.tipo === 'devolucion' ? -p.importe : p.importe)

function aPago(p: PagoFila): Pago {
  const pedido = a.pedidos.find((x) => x.id === p.pedido_id)
  const { updated_at: _u, ...resto } = p
  return copia({
    ...resto,
    folio: pedido?.folio ?? '',
    pedido_titulo: pedido?.titulo ?? '',
    cliente: nombreCliente(a, p.cliente_id),
    registrado_por_nombre: nombrePerfil(a, p.registrado_por),
  })
}

function buscar(id: string) {
  const p = a.pagos.find((x) => x.id === id)
  if (!p) throw new Error('Pago no encontrado')
  return p
}

function etiqueta(p: PagoFila) {
  return `Pago de ${dinero(p.importe)} · ${a.pedidos.find((x) => x.id === p.pedido_id)?.folio ?? 'pedido'}`
}

function corteConNombre(c: (typeof a.cortes_caja)[number]): CorteCaja {
  return copia({ ...c, cerrado_por_nombre: nombrePerfil(a, c.cerrado_por) })
}

/** Igual que comisiones_detalle(): cobrado del periodo por pedido; sin "ver_reportes", solo lo propio. */
function detalleComisiones(desde: string, hasta: string, vendedorId?: string): ComisionDetalle[] {
  const s = usuario()
  // Lo cobrado es un monto de venta: igual que la base, sin "ver_precios" no hay comisiones
  if (!s.permisos.ver_precios) throw new Error('Para ver comisiones necesitas el permiso para ver precios y pagos')
  if (!desde || !hasta) throw new Error('Indica las fechas del reporte')
  if (hasta < desde) throw new Error('La fecha final debe ser posterior a la inicial')
  const vendedor = s.permisos.ver_reportes ? vendedorId : s.id
  const grupos = new Map<string, ComisionDetalle>()
  for (const pg of a.pagos.filter((x) => !x.cancelado && x.fecha >= desde && x.fecha <= hasta)) {
    const p = a.pedidos.find((x) => x.id === pg.pedido_id)
    if (!p?.vendedor_id || (vendedor && p.vendedor_id !== vendedor)) continue
    const perfil = a.perfiles.find((x) => x.id === p.vendedor_id)
    if (!perfil) continue
    const g = grupos.get(p.id) ?? {
      vendedor_id: perfil.id,
      vendedor: perfil.nombre,
      comision_pct: perfil.comision_pct,
      pedido_id: p.id,
      folio: p.folio,
      cliente: nombreCliente(a, p.cliente_id),
      pagos: 0,
      cobrado: 0,
      base_comision: 0,
      comision: 0,
    }
    g.pagos++
    g.cobrado = redondear2(g.cobrado + signo(pg))
    grupos.set(p.id, g)
  }
  return [...grupos.values()]
    .map((g) => {
      const p = a.pedidos.find((x) => x.id === g.pedido_id)!
      const base = redondear2(g.cobrado * (p.total > 0 ? (p.total - p.iva) / p.total : 1))
      return { ...g, base_comision: base, comision: redondear2((base * g.comision_pct) / 100) }
    })
    .sort((x, y) => x.vendedor.localeCompare(y.vendedor, 'es') || x.folio.localeCompare(y.folio))
}

export const pagosDemo: ApiPagos = {
  pagos: {
    async listar(filtros = {}) {
      exigir('ver_precios')
      await espera(250)
      return a.pagos
        .filter((p) => filtros.incluirCancelados || !p.cancelado)
        .filter((p) => (!filtros.desde || p.fecha >= filtros.desde) && (!filtros.hasta || p.fecha <= filtros.hasta))
        .filter((p) => !filtros.pedidoId || p.pedido_id === filtros.pedidoId)
        .filter((p) => !filtros.clienteId || p.cliente_id === filtros.clienteId)
        .filter((p) => (!filtros.metodo || p.metodo === filtros.metodo) && (!filtros.tipo || p.tipo === filtros.tipo))
        .sort((x, y) => y.fecha.localeCompare(x.fecha) || y.created_at.localeCompare(x.created_at))
        .slice(0, filtros.limite ?? 500)
        .map(aPago)
    },

    async porPedido(pedidoId) {
      exigir('ver_precios')
      await espera(150)
      return a.pagos
        .filter((p) => p.pedido_id === pedidoId)
        .sort((x, y) => x.fecha.localeCompare(y.fecha) || x.created_at.localeCompare(y.created_at))
        .map(aPago)
    },

    async registrar(datos) {
      const s = exigir('registrar_pagos')
      await espera(350)
      const pedido = a.pedidos.find((p) => p.id === datos.pedido_id)
      if (!pedido) throw new Error('Pedido no encontrado')
      const tipo = datos.tipo ?? 'abono'
      if (!(datos.importe > 0)) throw new Error('El importe debe ser mayor a cero')
      if (pedido.estado === 'cancelado' && tipo !== 'devolucion') throw new Error(`El pedido ${pedido.folio} está cancelado; solo se pueden registrar devoluciones`)
      if (tipo === 'devolucion' && !s.permisos.cancelar_pagos) throw new Error('No tienes permiso para registrar devoluciones')
      const fecha = datos.fecha ?? fechaLocal()
      validarCajaAbierta(a, fecha, datos.metodo, esAdmin())
      const ahora = ahoraISO()
      const p: PagoFila = {
        id: nuevoId('pago'),
        pedido_id: pedido.id,
        cliente_id: pedido.cliente_id,
        fecha,
        importe: redondear2(datos.importe),
        tipo,
        metodo: datos.metodo,
        referencia: datos.referencia?.trim() || null,
        comprobante_path: null,
        notas: datos.notas?.trim() || null,
        registrado_por: s.id,
        cancelado: false,
        motivo_cancelacion: null,
        cancelado_por: null,
        cancelado_at: null,
        created_at: ahora,
        updated_at: ahora,
      }
      a.pagos.push(p)
      recalcularPedido(a, pedido)
      pedido.updated_at = ahora
      const txt = { anticipo: 'Anticipo registrado', liquidacion: 'Liquidación registrada', devolucion: 'Devolución registrada', abono: 'Pago registrado' }[tipo]
      eventoPedido(a, pedido.id, { tipo: 'pago', mensaje: `${txt} (${p.metodo})`, usuario_id: s.id })
      registrarBitacora(a, { tabla: 'pagos', registro_id: p.id, accion: 'crear', etiqueta: etiqueta(p), usuario_id: s.id })
      return aPago(p)
    },

    async cancelar(id, motivo) {
      const s = exigir('cancelar_pagos')
      await espera()
      const p = buscar(id)
      if (p.cancelado) throw new Error('El pago ya estaba cancelado')
      if (!motivo?.trim()) throw new Error('Indica el motivo de la cancelación del pago')
      validarCajaAbierta(a, p.fecha, p.metodo, esAdmin())
      p.cancelado = true
      p.motivo_cancelacion = motivo.trim()
      p.cancelado_por = s.id
      p.cancelado_at = ahoraISO()
      p.updated_at = p.cancelado_at
      const pedido = a.pedidos.find((x) => x.id === p.pedido_id)
      if (pedido) recalcularPedido(a, pedido)
      eventoPedido(a, p.pedido_id, { tipo: 'pago', mensaje: `Pago cancelado: ${p.motivo_cancelacion}`, usuario_id: s.id })
      registrarBitacora(a, { tabla: 'pagos', registro_id: id, accion: 'cancelar', etiqueta: etiqueta(p), cambios: { cancelado: [false, true] }, usuario_id: s.id })
    },

    async subirComprobante(id, archivo) {
      exigir('registrar_pagos')
      await espera(400)
      const p = buscar(id)
      const nombre = (archivo as File).name || 'comprobante'
      p.comprobante_path = `pagos/${p.pedido_id}/${id}-${nombre}`
      p.updated_at = ahoraISO()
      // Se queda en la memoria del navegador: nada se sube a ningún servidor.
      if (typeof URL !== 'undefined' && 'createObjectURL' in URL) comprobantes.set(id, URL.createObjectURL(archivo))
      return aPago(p)
    },

    async urlComprobante(id) {
      exigir('ver_precios')
      const p = buscar(id)
      if (!p.comprobante_path) return null
      return comprobantes.get(id) ?? vistaPreviaArchivo(`Comprobante ${etiqueta(p)}`)
    },
  },

  cobranza: {
    async cuentasPorCobrar() {
      exigir('ver_precios')
      await espera(250)
      const hoy = fechaLocal()
      const dias = (desde: string, hasta: string) => Math.round((new Date(`${hasta}T12:00:00`).getTime() - new Date(`${desde}T12:00:00`).getTime()) / 86_400_000)
      const sumar = (fecha: string, n: number) => fechaLocal(new Date(new Date(`${fecha}T12:00:00`).getTime() + n * 86_400_000))
      return a.pedidos
        .filter((p) => p.estado !== 'cancelado' && (p.saldo ?? 0) > 0)
        .map((p): CuentaPorCobrar => {
          const c = a.clientes.find((x) => x.id === p.cliente_id)
          const creado = fechaLocal(p.created_at)
          const limite = p.fecha_limite_pago ?? (c && c.dias_credito > 0 ? sumar(creado, c.dias_credito) : p.entregado_at ? fechaLocal(p.entregado_at) : null)
          const vencido = Boolean(limite && limite < hoy)
          return {
            pedido_id: p.id,
            folio: p.folio,
            titulo: p.titulo,
            cliente_id: p.cliente_id,
            cliente: c?.nombre ?? '',
            whatsapp: c?.whatsapp ?? c?.telefono ?? null,
            vendedor_id: p.vendedor_id,
            vendedor: nombrePerfil(a, p.vendedor_id),
            estado: p.estado,
            estado_pago: p.estado_pago,
            total: p.total,
            pagado: p.pagado,
            saldo: p.saldo ?? 0,
            creado,
            fecha_entrega: p.fecha_entrega,
            fecha_limite: limite,
            dias_transcurridos: dias(creado, hoy),
            dias_vencido: vencido ? dias(limite!, hoy) : 0,
            vencido,
          }
        })
        .sort((x, y) => Number(y.vencido) - Number(x.vencido) || y.dias_vencido - x.dias_vencido || y.saldo - x.saldo)
    },
  },

  caja: {
    async resumen(fecha, efectivoInicial) {
      exigirAlguno('registrar_pagos', 'ver_reportes')
      await espera(250)
      const r = calcularCaja(a, fecha ?? fechaLocal(), efectivoInicial ?? null, puede('registrar_gastos') || puede('ver_costos'))
      return copia(r)
    },

    async cerrar(datos) {
      const s = exigir('registrar_pagos')
      await espera(400)
      const fecha = datos.fecha || fechaLocal()
      if (fecha > fechaLocal()) throw new Error('No se puede cerrar la caja de una fecha futura')
      if (datos.efectivo_contado === null || datos.efectivo_contado === undefined || datos.efectivo_contado < 0) throw new Error('Indica el efectivo contado en caja')
      if ((datos.efectivo_inicial ?? 0) < 0) throw new Error('El efectivo inicial no puede ser negativo')
      if (a.cortes_caja.some((c) => c.fecha === fecha)) {
        const [y, m, d] = fecha.split('-')
        throw new Error(`La caja del ${d}/${m}/${y} ya está cerrada`)
      }
      const calc = calcularCaja(a, fecha, datos.efectivo_inicial ?? 0, false)
      const { corte: _c, cerrado: _x, efectivo_inicial_sugerido: _s, ...resumen } = calc
      const corte = {
        id: nuevoId('corte'),
        fecha,
        efectivo_inicial: datos.efectivo_inicial ?? 0,
        efectivo_contado: datos.efectivo_contado,
        esperado: calc.esperado,
        diferencia: redondear2(datos.efectivo_contado - calc.esperado),
        resumen: copia(resumen) as unknown as (typeof a.cortes_caja)[number]['resumen'],
        notas: datos.notas?.trim() || null,
        cerrado_por: s.id,
        created_at: ahoraISO(),
      }
      a.cortes_caja.push(corte)
      const [y, m, d] = fecha.split('-')
      registrarBitacora(a, { tabla: 'cortes_caja', registro_id: corte.id, accion: 'crear', etiqueta: `Corte de caja del ${d}/${m}/${y}`, usuario_id: s.id })
      return corteConNombre(corte)
    },

    async reabrir(fecha, motivo) {
      const s = exigirAdmin()
      if (!motivo?.trim()) throw new Error('Indica el motivo para reabrir la caja')
      const corte = a.cortes_caja.find((c) => c.fecha === fecha)
      if (!corte) throw new Error('La caja de esa fecha no está cerrada')
      a.cortes_caja.splice(a.cortes_caja.indexOf(corte), 1)
      const [y, m, d] = fecha.split('-')
      registrarBitacora(a, {
        tabla: 'cortes_caja',
        registro_id: corte.id,
        accion: 'cancelar',
        etiqueta: `Caja del ${d}/${m}/${y} reabierta: ${motivo.trim().slice(0, 500)}`,
        datos: { motivo: motivo.trim().slice(0, 500) },
        usuario_id: s.id,
      })
    },

    async cortes(filtros = {}) {
      exigirAlguno('registrar_pagos', 'ver_reportes')
      await espera(150)
      return a.cortes_caja
        .filter((c) => (!filtros.desde || c.fecha >= filtros.desde) && (!filtros.hasta || c.fecha <= filtros.hasta))
        .sort((x, y) => y.fecha.localeCompare(x.fecha))
        .slice(0, filtros.limite ?? 100)
        .map(corteConNombre)
    },
  },

  comisiones: {
    async resumen(desde, hasta) {
      const s = usuario()
      await espera(250)
      const det = detalleComisiones(desde, hasta)
      const personas = s.permisos.ver_reportes
        ? a.perfiles.filter((u) => (u.activo && u.comision_pct > 0) || det.some((d) => d.vendedor_id === u.id))
        : a.perfiles.filter((u) => u.id === s.id)
      return personas
        .map((u): Comision => {
          const mios = det.filter((d) => d.vendedor_id === u.id)
          const suma = (k: 'pagos' | 'cobrado' | 'base_comision' | 'comision') => redondear2(mios.reduce((t, d) => t + d[k], 0))
          return {
            vendedor_id: u.id,
            nombre: u.nombre,
            comision_pct: u.comision_pct,
            pedidos: mios.length,
            pagos: suma('pagos'),
            cobrado: suma('cobrado'),
            base_comision: suma('base_comision'),
            comision: suma('comision'),
          }
        })
        .sort((x, y) => y.comision - x.comision || x.nombre.localeCompare(y.nombre, 'es'))
    },
    async detalle(desde, hasta, vendedorId) {
      usuario()
      await espera(200)
      return detalleComisiones(desde, hasta, vendedorId)
    },
  },
}
