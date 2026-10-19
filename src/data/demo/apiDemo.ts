/**
 * Implementación de la API para la VISTA PREVIA: el núcleo (sesión, panel, búsqueda y
 * cotizaciones) más los módulos de `src/data/modulos/<modulo>/demo.ts`.
 * Todo trabaja sobre el almacén en memoria (`./almacen.ts`) con datos ficticios: nada se envía
 * a Supabase ni a ningún servidor.
 */
import { calcularTotales, importePartida } from '@/lib/calculadora'
import type { Json } from '@/lib/database.types'
import { hoyISO, sumarDias } from '@/lib/format'
import { normalizar } from '@/lib/utils'
import type { Api, ApiNucleo } from '../api'
import { componer } from '../comun/componer'
import { administracionDemo } from '../modulos/administracion/demo'
import { agendaDemo } from '../modulos/agenda/demo'
import { catalogoDemo } from '../modulos/catalogo/demo'
import { clientesDemo } from '../modulos/clientes/demo'
import { embudoDemo } from '../modulos/embudo/demo'
import { inventarioDemo } from '../modulos/inventario/demo'
import { pagosDemo } from '../modulos/pagos/demo'
import { pedidosDemo } from '../modulos/pedidos/demo'
import { portalDemo } from '../modulos/portal/demo'
import { produccionDemo } from '../modulos/produccion/demo'
import { reportesDemo } from '../modulos/reportes/demo'
import type { CotizacionCompleta, CotizacionLista, DashboardResumen, EntregaProxima, EstadoCotizacion } from '../tipos'
import { almacen as a, copia, type PedidoFila } from './almacen'
import { ahoraISO, clienteOperacion, etapasOmitidas, eventoPedido, fechaLocal, recalcularPedido, redondear2, registrarBitacora, siguienteFolio } from './reglas'
import { alCambiarSesion, cambiarRol, espera, exigir, puedeVerClientes, sesionDemo, usuario } from './sesion'

const CERRADOS = ['entregado', 'finalizado', 'cancelado']

/**
 * Igual que cotizacion_bloqueo() en la base: una cotización convertida en pedido, aprobada por el
 * cliente en el portal o aceptada (alguna vez) ya no se modifica. Nulo = se puede editar.
 */
export function bloqueoCotizacion(c: CotizacionCompleta): string | null {
  if (c.pedido_id) return `Esta cotización ya se convirtió en el pedido ${c.pedido_folio ?? ''}; los cambios se hacen en el pedido. Si necesitas otra versión, duplícala.`
  if (a.portal_respuestas.some((r) => r.cotizacion_id === c.id && r.accion === 'aprobar_cotizacion')) {
    return 'El cliente aprobó esta cotización desde el portal y ya no se puede modificar. Duplícala para hacer una versión nueva.'
  }
  if (c.estado === 'aceptada' || c.aceptada_at) return 'Esta cotización ya fue aceptada y no se puede modificar. Duplícala para hacer una versión nueva.'
  return null
}

/** La cotización con los datos actuales del cliente (pudo editarse en Clientes). */
function conCliente(c: CotizacionCompleta): CotizacionCompleta {
  const cl = a.clientes.find((x) => x.id === c.cliente.id)
  if (!cl) return c
  return {
    ...c,
    cliente: {
      ...c.cliente,
      nombre: cl.nombre,
      whatsapp: cl.whatsapp,
      telefono: cl.telefono,
      email: cl.email,
      requiere_factura: cl.requiere_factura,
      rfc: cl.rfc,
      razon_social: cl.razon_social,
      direccion: cl.direccion,
      ciudad: cl.ciudad,
    },
  }
}

function aLista(c: CotizacionCompleta): CotizacionLista {
  return {
    id: c.id,
    folio: c.folio,
    titulo: c.titulo,
    fecha: c.fecha,
    fecha_vencimiento: c.fecha_vencimiento,
    estado: c.estado,
    total: c.total,
    pedido_id: c.pedido_id,
    enviada_at: c.enviada_at,
    created_at: c.created_at,
    cliente: { id: c.cliente.id, nombre: c.cliente.nombre, whatsapp: c.cliente.whatsapp, telefono: c.cliente.telefono },
    vendedor: c.vendedor ? { nombre: c.vendedor.nombre } : null,
  }
}

function recalcular(c: CotizacionCompleta) {
  c.partidas = c.partidas.map((p, i) => ({ ...p, orden: i + 1, importe: importePartida(p.cantidad, p.precio_unitario, p.descuento_pct) }))
  const t = calcularTotales({
    importes: c.partidas.map((p) => p.importe),
    descuentoTipo: c.descuento_tipo,
    descuentoValor: c.descuento_valor,
    recargoPct: c.recargo_pct,
    aplicaIva: c.aplica_iva,
    ivaPct: c.iva_pct,
  })
  Object.assign(c, { subtotal: t.subtotal, descuento: t.descuento, recargo: t.recargo, iva: t.iva, total: t.total })
  c.fecha_vencimiento = sumarDias(c.fecha, c.vigencia_dias)
}

function buscarCotizacion(id: string) {
  const c = a.cotizaciones.find((x) => x.id === id)
  if (!c) throw new Error('Cotización no encontrada')
  return c
}

/** Igual que tg_cotizaciones_oportunidad(): enviada adelanta la oportunidad; aceptada la gana. */
function avanzarOportunidad(c: CotizacionCompleta) {
  const op = a.oportunidades.find((o) => o.id === a.cotizacion_oportunidad[c.id])
  if (!op) return
  if (c.estado === 'enviada' && ['prospecto_nuevo', 'contactado', 'interesado'].includes(op.etapa)) {
    Object.assign(op, { etapa: 'cotizacion_enviada', updated_at: ahoraISO() })
  } else if (c.estado === 'aceptada' && op.etapa !== 'ganado') {
    Object.assign(op, { etapa: 'ganado', cerrada_at: ahoraISO(), motivo_perdida: null, updated_at: ahoraISO() })
  }
}

/** Entrega o pendiente con la forma del panel (cliente por nombre). */
function aEntrega(p: PedidoFila): EntregaProxima {
  return {
    id: p.id,
    folio: p.folio,
    titulo: p.titulo,
    estado: p.estado,
    prioridad: p.prioridad,
    fecha_entrega: p.fecha_entrega ?? '',
    cliente: a.clientes.find((c) => c.id === p.cliente_id)?.nombre ?? '',
    requiere_instalacion: p.requiere_instalacion,
  }
}

const porEntrega = (x: PedidoFila, y: PedidoFila) => (x.fecha_entrega ?? '9999').localeCompare(y.fecha_entrega ?? '9999') || x.folio.localeCompare(y.folio)

const nucleo: ApiNucleo = {
  sesion: {
    async actual() {
      return sesionDemo()
    },
    async iniciar() {
      throw new Error('En la vista previa elige un rol de ejemplo para entrar')
    },
    async iniciarDemo(rol) {
      await espera(500)
      cambiarRol(rol)
    },
    async cerrar() {
      cambiarRol(null)
    },
    async recuperar() {
      await espera()
      throw new Error('La recuperación de contraseña no está disponible en la vista previa')
    },
    async nuevaContrasena() {
      throw new Error('No disponible en la vista previa')
    },
    alCambiar(cb) {
      return alCambiarSesion(cb)
    },
  },

  dashboard: {
    /** Igual que dashboard_resumen() en la base de datos, calculado sobre el almacén. */
    async resumen() {
      await espera(420)
      const s = usuario()
      const hoy = hoyISO()
      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      const inicioMesAnterior = new Date(inicioMes.getFullYear(), inicioMes.getMonth() - 1, 1)
      const activos = a.pedidos.filter((p) => !CERRADOS.includes(p.estado))
      const porEstado: DashboardResumen['pedidos_por_estado'] = {}
      for (const p of a.pedidos.filter((x) => !['finalizado', 'cancelado'].includes(x.estado))) porEstado[p.estado] = (porEstado[p.estado] ?? 0) + 1

      const r: DashboardResumen = {
        hoy,
        pedidos_por_estado: porEstado,
        pedidos_activos: activos.length,
        pedidos_atrasados: activos.filter((p) => p.fecha_entrega && p.fecha_entrega < hoy).length,
        pedidos_pausados: a.pedidos.filter((p) => p.estado === 'pausado').length,
        entregas_proximas: activos
          .filter((p) => p.fecha_entrega && p.fecha_entrega <= sumarDias(hoy, 7))
          .sort(porEntrega)
          .slice(0, 10)
          .map(aEntrega),
        mis_pendientes: activos
          .filter((p) => p.responsable_id === s.id || p.disenador_id === s.id)
          .sort(porEntrega)
          .slice(0, 10)
          .map(aEntrega),
        disenos_pendientes: a.archivos.filter(
          (x) => x.categoria === 'diseno' && x.estado_aprobacion === 'pendiente' && !['finalizado', 'cancelado'].includes(a.pedidos.find((p) => p.id === x.pedido_id)?.estado ?? 'cancelado'),
        ).length,
      }

      if (s.permisos.ver_precios) {
        const abiertas = a.cotizaciones.filter((c) => ['borrador', 'enviada'].includes(c.estado) && c.fecha_vencimiento >= hoy)
        r.cotizaciones_abiertas = { cantidad: abiertas.length, total: redondear2(abiertas.reduce((t, c) => t + c.total, 0)) }
        r.cotizaciones_por_vencer = a.cotizaciones
          .filter((c) => c.estado === 'enviada' && c.fecha_vencimiento >= hoy && c.fecha_vencimiento <= sumarDias(hoy, 3))
          .sort((x, y) => x.fecha_vencimiento.localeCompare(y.fecha_vencimiento))
          .slice(0, 10)
          .map((c) => ({ id: c.id, folio: c.folio, titulo: c.titulo, total: c.total, fecha_vencimiento: c.fecha_vencimiento, cliente: conCliente(c).cliente.nombre }))
        const recientes = a.cotizaciones.filter((c) => c.fecha >= sumarDias(hoy, -90))
        const cerradas = recientes.filter((c) => ['aceptada', 'rechazada'].includes(c.estado))
        r.tasa_cierre_90d = cerradas.length ? Math.round((recientes.filter((c) => c.estado === 'aceptada').length / cerradas.length) * 1000) / 10 : null
      }

      if (s.permisos.ver_reportes) {
        const noCancelados = a.pedidos.filter((p) => p.estado !== 'cancelado')
        const vendido = (desde: Date, hasta: Date) => redondear2(noCancelados.filter((p) => new Date(p.created_at) >= desde && new Date(p.created_at) < hasta).reduce((t, p) => t + p.total, 0))
        const cobrado = (desde: string, hasta: string) =>
          redondear2(a.pagos.filter((p) => !p.cancelado && p.fecha >= desde && p.fecha < hasta).reduce((t, p) => t + (p.tipo === 'devolucion' ? -p.importe : p.importe), 0))
        const lejano = new Date(9999, 0, 1)
        r.ventas_mes = vendido(inicioMes, lejano)
        r.ventas_mes_anterior = vendido(inicioMesAnterior, inicioMes)
        r.cobrado_mes = cobrado(fechaLocal(inicioMes), '9999-12-31')
        const conSaldo = noCancelados.filter((p) => (p.saldo ?? 0) > 0)
        r.por_cobrar = { total: redondear2(conSaldo.reduce((t, p) => t + (p.saldo ?? 0), 0)), pedidos: conSaldo.length }
        const vencidos = conSaldo.filter((p) => p.fecha_limite_pago && p.fecha_limite_pago < hoy)
        r.pagos_vencidos = { total: redondear2(vencidos.reduce((t, p) => t + (p.saldo ?? 0), 0)), pedidos: vencidos.length }
        r.serie_mensual = Array.from({ length: 6 }, (_, i) => {
          const desde = new Date(inicioMes.getFullYear(), inicioMes.getMonth() - 5 + i, 1)
          const hasta = new Date(desde.getFullYear(), desde.getMonth() + 1, 1)
          return { mes: fechaLocal(desde).slice(0, 7), ventas: vendido(desde, hasta), cobrado: cobrado(fechaLocal(desde), fechaLocal(hasta)) }
        })
        if (s.permisos.ver_costos) {
          const delMes = noCancelados.filter((p) => new Date(p.created_at) >= inicioMes)
          const ids = new Set(a.partidas.filter((x) => delMes.some((p) => p.id === x.pedido_id)).map((x) => x.id))
          const venta = redondear2(delMes.reduce((t, p) => t + p.total - p.iva, 0))
          const costo = redondear2(a.partida_costos.filter((x) => ids.has(x.partida_id)).reduce((t, x) => t + x.costo_total, 0))
          r.utilidad_estimada_mes = { venta, costo, utilidad: redondear2(venta - costo) }
        }
      }

      if (s.permisos.gestionar_clientes) {
        r.seguimientos = a.oportunidades
          .filter((o) => !['ganado', 'perdido'].includes(o.etapa) && o.proxima_accion_fecha && o.proxima_accion_fecha <= hoy)
          .sort((x, y) => x.proxima_accion_fecha!.localeCompare(y.proxima_accion_fecha!))
          .slice(0, 10)
          .map((o) => {
            const c = a.clientes.find((x) => x.id === o.cliente_id)
            return {
              id: o.id,
              titulo: o.titulo,
              etapa: o.etapa,
              proxima_accion: o.proxima_accion,
              proxima_accion_fecha: o.proxima_accion_fecha!,
              valor_estimado: o.valor_estimado,
              cliente: c?.nombre ?? '',
              cliente_id: o.cliente_id,
              whatsapp: c?.whatsapp ?? c?.telefono ?? null,
            }
          })
        const embudo: NonNullable<DashboardResumen['embudo']> = {}
        const inicio = inicioMes.toISOString()
        for (const o of a.oportunidades.filter((x) => !['ganado', 'perdido'].includes(x.etapa) || (x.cerrada_at && x.cerrada_at >= inicio))) {
          const e = (embudo[o.etapa] ??= { cantidad: 0, valor: 0 })
          e.cantidad++
          e.valor = redondear2(e.valor + (o.valor_estimado ?? 0))
        }
        r.embudo = embudo
      }

      // Fases 2 y 3: tareas del día, alerta de stock y caja
      const misTareas = a.tareas
        .filter((t) => t.responsable_id === s.id && !t.completada && t.fecha <= hoy)
        .sort((x, y) => x.fecha.localeCompare(y.fecha) || (x.hora ?? '99').localeCompare(y.hora ?? '99') || x.titulo.localeCompare(y.titulo, 'es'))
      r.tareas_hoy = misTareas.slice(0, 10).map((t) => ({
        id: t.id,
        titulo: t.titulo,
        tipo: t.tipo,
        fecha: t.fecha,
        hora: t.hora,
        prioridad: t.prioridad,
        // Como agenda(): sin permiso de clientes, solo clientes con pedidos (clientes_operacion)
        cliente_id: clienteOperacion(a, t.cliente_id, puedeVerClientes()) ? t.cliente_id : null,
        cliente: clienteOperacion(a, t.cliente_id, puedeVerClientes())?.nombre ?? null,
        pedido_id: t.pedido_id,
        vencida: t.fecha < hoy,
      }))
      r.tareas_pendientes = misTareas.length
      const bajos = a.materiales.filter((m) => m.bajo_minimo).sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'))
      r.stock_bajo = {
        cantidad: bajos.length,
        materiales: bajos.slice(0, 5).map((m) => ({ id: m.id, nombre: m.nombre, unidad: m.unidad, existencia: m.existencia, stock_minimo: m.stock_minimo })),
      }
      if (s.permisos.registrar_pagos) r.caja_hoy = { cerrada: a.cortes_caja.some((c) => c.fecha === hoy) }
      return copia(r)
    },
  },

  busqueda: {
    /**
     * Igual que busqueda_global(): clientes (con permiso de clientes), cotizaciones (con
     * `ver_precios`) y pedidos. Sin permiso de clientes, los pedidos se buscan por folio, título o
     * nombre del cliente (no por su teléfono, correo o RFC).
     */
    async global(texto) {
      const s = usuario()
      const q = normalizar(texto)
      if (texto.trim().length < 2) return { clientes: [], cotizaciones: [], pedidos: [] }
      const folio = texto.trim().toUpperCase()
      const clientePorId = (id: string) => a.clientes.find((c) => c.id === id)
      const verClientes = puedeVerClientes()
      const textoCliente = (id: string) => (verClientes ? (clientePorId(id)?.busqueda ?? '') : normalizar(clientePorId(id)?.nombre ?? ''))
      return copia({
        clientes: a.clientes
          .filter((c) => verClientes && (c.busqueda ?? '').includes(q))
          .sort((x, y) => Number(y.activo) - Number(x.activo) || x.nombre.localeCompare(y.nombre, 'es'))
          .slice(0, 6)
          .map((c) => ({ id: c.id, nombre: c.nombre, telefono: c.whatsapp ?? c.telefono, email: c.email })),
        cotizaciones: s.permisos.ver_precios
          ? a.cotizaciones
              .map(conCliente)
              .filter((c) => c.folio.toUpperCase().includes(folio) || normalizar(c.titulo ?? '').includes(q) || (clientePorId(c.cliente.id)?.busqueda ?? '').includes(q))
              .sort((x, y) => y.created_at.localeCompare(x.created_at))
              .slice(0, 6)
              .map((c) => ({ id: c.id, folio: c.folio, titulo: c.titulo, estado: c.estado, total: c.total, cliente: c.cliente.nombre }))
          : [],
        pedidos: a.pedidos
          .filter((p) => p.folio.toUpperCase().includes(folio) || normalizar(p.titulo).includes(q) || textoCliente(p.cliente_id).includes(q))
          .sort((x, y) => y.created_at.localeCompare(x.created_at))
          .slice(0, 6)
          .map((p) => ({ id: p.id, folio: p.folio, titulo: p.titulo, estado: p.estado, cliente: clientePorId(p.cliente_id)?.nombre ?? '' })),
      })
    },
  },

  cotizaciones: {
    async listar() {
      exigir('ver_precios')
      await espera(380)
      return a.cotizaciones.map((c) => aLista(conCliente(c)))
    },
    async obtener(id) {
      const s = exigir('ver_precios')
      await espera(220)
      const c = conCliente(buscarCotizacion(id))
      return copia({ ...c, partidas: c.partidas.map((p) => ({ ...p, costos: s.permisos.ver_costos ? p.costos : null })) })
    },
    async guardar(b) {
      const s = exigir('gestionar_cotizaciones')
      await espera(450)
      const cliente = a.clientes.find((c) => c.id === b.cliente_id)
      if (!cliente) throw new Error('Selecciona un cliente')
      const existente = b.id ? a.cotizaciones.find((c) => c.id === b.id) : undefined
      const bloqueo = existente ? bloqueoCotizacion(existente) : null
      if (bloqueo) throw new Error(bloqueo)
      const ahora = ahoraISO()
      const base: CotizacionCompleta =
        existente ??
        ({
          id: `demo-cot-n${Date.now()}`,
          folio: siguienteFolio(a, 'cotizacion'),
          estado: 'borrador',
          motivo_rechazo: null,
          pedido_id: null,
          pedido_folio: null,
          enviada_at: null,
          aceptada_at: null,
          created_at: ahora,
          vendedor: { id: s.id, nombre: s.perfil.nombre, email: s.email, telefono: null },
        } as CotizacionCompleta)
      Object.assign(base, {
        titulo: b.titulo || null,
        fecha: b.fecha,
        vigencia_dias: b.vigencia_dias,
        tiempo_entrega: b.tiempo_entrega || null,
        anticipo_pct: b.anticipo_pct,
        aplica_iva: b.aplica_iva,
        iva_pct: b.iva_pct,
        descuento_tipo: b.descuento_tipo,
        descuento_valor: b.descuento_valor,
        recargo_pct: b.recargo_pct,
        recargo_concepto: b.recargo_concepto,
        condiciones: b.condiciones,
        notas: b.notas || null,
        notas_internas: b.notas_internas || null,
        updated_at: ahora,
        cliente: {
          id: cliente.id,
          nombre: cliente.nombre,
          whatsapp: cliente.whatsapp,
          telefono: cliente.telefono,
          email: cliente.email,
          requiere_factura: cliente.requiere_factura,
          rfc: cliente.rfc,
          razon_social: cliente.razon_social,
          direccion: cliente.direccion,
          ciudad: cliente.ciudad,
        },
        partidas: b.partidas.map((p, i) => ({
          ...p,
          id: p.id || `demo-p-${Date.now()}-${i}`,
          orden: i + 1,
          importe: 0,
          costos: s.permisos.ver_costos ? p.costos : (existente?.partidas.find((x) => x.id === p.id)?.costos ?? null),
        })),
      })
      recalcular(base)
      if (!existente) a.cotizaciones.unshift(base)
      if (!existente && b.oportunidad_id && a.oportunidades.some((o) => o.id === b.oportunidad_id)) a.cotizacion_oportunidad[base.id] = b.oportunidad_id
      registrarBitacora(a, { tabla: 'cotizaciones', registro_id: base.id, accion: existente ? 'modificar' : 'crear', etiqueta: `${base.folio} · ${base.titulo ?? ''}`.trim(), usuario_id: s.id })
      return { id: base.id, folio: base.folio }
    },
    async cambiarEstado(id, estado: EstadoCotizacion, motivo) {
      const s = exigir('gestionar_cotizaciones')
      await espera(200)
      const c = buscarCotizacion(id)
      const antes = c.estado
      // Cerrada (aceptada, aprobada o pedido): no regresa a borrador ni a enviada; sí se puede
      // dejar aceptada o, si no es pedido, rechazarla o cancelarla (tg_cotizaciones_proteger_aceptada)
      const bloqueo = bloqueoCotizacion(c)
      if (bloqueo && estado !== antes && !(estado === 'aceptada' || (['rechazada', 'cancelada'].includes(estado) && !c.pedido_id))) throw new Error(bloqueo)
      c.estado = estado
      c.motivo_rechazo = estado === 'rechazada' ? (motivo ?? null) : null
      if (estado === 'enviada') c.enviada_at ??= ahoraISO()
      if (estado === 'aceptada') c.aceptada_at ??= ahoraISO()
      if (antes !== estado) {
        avanzarOportunidad(c)
        registrarBitacora(a, {
          tabla: 'cotizaciones',
          registro_id: id,
          accion: estado === 'cancelada' ? 'cancelar' : 'cambio_estado',
          etiqueta: `${c.folio} · ${c.titulo ?? ''}`.trim(),
          cambios: { estado: [antes, estado] },
          usuario_id: s.id,
        })
      }
    },
    async duplicar(id) {
      const s = exigir('gestionar_cotizaciones')
      await espera(300)
      const c = buscarCotizacion(id)
      const copiaCot: CotizacionCompleta = structuredClone(conCliente(c))
      Object.assign(copiaCot, {
        id: `demo-cot-n${Date.now()}`,
        folio: siguienteFolio(a, 'cotizacion'),
        titulo: c.titulo ? `${c.titulo} (copia)` : null,
        fecha: hoyISO(),
        estado: 'borrador',
        motivo_rechazo: null,
        pedido_id: null,
        pedido_folio: null,
        enviada_at: null,
        aceptada_at: null,
        created_at: ahoraISO(),
        vendedor: { id: s.id, nombre: s.perfil.nombre, email: s.email, telefono: null },
      })
      copiaCot.partidas = copiaCot.partidas.map((p, i) => ({ ...p, id: `demo-p-${Date.now()}-${i}` }))
      recalcular(copiaCot)
      a.cotizaciones.unshift(copiaCot)
      if (a.cotizacion_oportunidad[id]) a.cotizacion_oportunidad[copiaCot.id] = a.cotizacion_oportunidad[id]
      return copiaCot.id
    },
    /** Igual que convertir_cotizacion_a_pedido(): crea el pedido con las mismas partidas y costos. */
    async convertir(id, opciones) {
      const s = exigir('gestionar_pedidos')
      await espera(450)
      const c = buscarCotizacion(id)
      if (c.pedido_id) throw new Error(`Esta cotización ya se convirtió en el pedido ${c.pedido_folio}`)
      if (['rechazada', 'cancelada'].includes(c.estado)) throw new Error('No se puede convertir una cotización rechazada o cancelada')
      if (!c.partidas.length) throw new Error('La cotización no tiene conceptos')
      const cliente = a.clientes.find((x) => x.id === c.cliente.id)
      const etapas = etapasOmitidas(a, c.partidas)
      const ahora = ahoraISO()
      const pedidoId = `demo-ped-n${Date.now()}`
      const p: PedidoFila = {
        id: pedidoId,
        folio: siguienteFolio(a, 'pedido'),
        cotizacion_id: c.id,
        cliente_id: c.cliente.id,
        contacto_id: null,
        vendedor_id: c.vendedor?.id ?? s.id,
        responsable_id: null,
        disenador_id: null,
        titulo: opciones.titulo?.trim() || c.titulo?.trim() || `Pedido de cotización ${c.folio}`,
        descripcion: c.notas,
        estado: 'nuevo',
        estado_anterior: null,
        motivo_estado: null,
        etapas_omitidas: etapas.omitidas,
        prioridad: 'normal',
        fecha_entrega: opciones.fechaEntrega ?? null,
        requiere_instalacion: etapas.instalacion,
        direccion_instalacion: null,
        anticipo_pct: c.anticipo_pct,
        aplica_iva: c.aplica_iva,
        iva_pct: c.iva_pct,
        descuento_tipo: c.descuento_tipo,
        descuento_valor: c.descuento_valor,
        recargo_pct: c.recargo_pct,
        recargo_concepto: c.recargo_concepto,
        subtotal: 0,
        descuento: 0,
        recargo: 0,
        iva: 0,
        total: 0,
        condiciones: c.condiciones,
        pagado: 0,
        saldo: 0,
        estado_pago: 'pendiente',
        fecha_limite_pago: opciones.fechaEntrega ?? null,
        requiere_factura: cliente?.requiere_factura ?? false,
        facturado: false,
        folio_factura: null,
        fecha_factura: null,
        notas_internas: c.notas_internas,
        entregado_at: null,
        finalizado_at: null,
        cancelado_at: null,
        created_by: s.id,
        created_at: ahora,
        updated_at: ahora,
      }
      a.pedidos.push(p)
      c.partidas.forEach((x, i) => {
        const partidaId = `${pedidoId}-pa${i + 1}`
        a.partidas.push({
          id: partidaId,
          cotizacion_id: null,
          pedido_id: pedidoId,
          orden: x.orden,
          tipo: x.tipo,
          producto_id: x.producto_id,
          concepto: x.concepto,
          descripcion: x.descripcion,
          metodo_calculo: x.metodo_calculo,
          unidad: x.unidad,
          ancho: x.ancho,
          alto: x.alto,
          largo: x.largo,
          cantidad: x.cantidad,
          precio_unitario: x.precio_unitario,
          descuento_pct: x.descuento_pct,
          importe: x.importe,
          notas_produccion: x.notas_produccion,
          created_at: ahora,
          updated_at: ahora,
        })
        if (x.costos) {
          a.partida_costos.push({
            partida_id: partidaId,
            costo_material: x.costos.costo_material,
            costo_mano_obra: x.costos.costo_mano_obra,
            costo_fijo: x.costos.costo_fijo,
            desperdicio_pct: x.costos.desperdicio_pct,
            ganancia_pct: x.costos.ganancia_pct,
            costo_total: x.costos.costo_total ?? 0,
            calculo: (x.costos.calculo ?? {}) as NonNullable<Json>,
            updated_at: ahora,
          })
        }
      })
      recalcularPedido(a, p)
      if (cliente) cliente.ultima_compra_at = ahora
      c.estado = 'aceptada'
      c.aceptada_at ??= ahora
      c.pedido_id = pedidoId
      c.pedido_folio = p.folio
      avanzarOportunidad(c)
      eventoPedido(a, pedidoId, { tipo: 'creado', estado_a: 'nuevo', mensaje: `Pedido creado desde la cotización ${c.folio}`, usuario_id: s.id })
      registrarBitacora(a, { tabla: 'pedidos', registro_id: pedidoId, accion: 'crear', etiqueta: `${p.folio} · ${p.titulo}`, usuario_id: s.id })
      return { pedidoId }
    },
    async eliminar(id) {
      const s = exigir('gestionar_cotizaciones')
      const c = a.cotizaciones.find((x) => x.id === id)
      if (!c) return
      if (c.pedido_id) throw new Error(`Esta cotización ya se convirtió en el pedido ${c.pedido_folio}`)
      if (c.estado !== 'borrador' && !s.permisos.eliminar_registros) throw new Error('Solo se pueden eliminar borradores')
      a.cotizaciones.splice(a.cotizaciones.indexOf(c), 1)
      delete a.cotizacion_oportunidad[id]
      registrarBitacora(a, { tabla: 'cotizaciones', registro_id: id, accion: 'eliminar', etiqueta: `${c.folio} · ${c.titulo ?? ''}`.trim(), usuario_id: s.id })
    },
    async compartirPdf() {
      // En la vista previa no se sube nada: el PDF se comparte desde el dispositivo.
      return null
    },
  },
}

export const apiDemo: Api = componer(
  nucleo,
  clientesDemo,
  embudoDemo,
  pedidosDemo,
  produccionDemo,
  pagosDemo,
  inventarioDemo,
  agendaDemo,
  reportesDemo,
  administracionDemo,
  catalogoDemo,
  portalDemo,
)

export default apiDemo
