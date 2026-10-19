/** MÓDULO PEDIDOS · implementación de la vista previa (almacén en memoria, datos ficticios). */
import { almacen as a, copia, nuevoId, type PedidoFila } from '@/data/demo/almacen'
import {
  ahoraISO,
  aplicarEstadoPedido,
  diferencias,
  etapasOmitidas,
  eventoPedido,
  fechaLocal,
  nombrePerfil,
  pedidoEnProceso,
  clienteOperacion,
  recalcularPedido,
  registrarArchivo,
  registrarBitacora,
  responderArchivo,
  siguienteFolio,
  vistaPreviaArchivo,
} from '@/data/demo/reglas'
import { esAdmin, espera, exigir, exigirAlguno, puede, puedeVerClientes, usuario } from '@/data/demo/sesion'
import { importePartida } from '@/lib/calculadora'
import { normalizar } from '@/lib/utils'
import type { ApiPedidos, Archivo, CambiosPartida, CambiosPedido, PartidaPedido, PedidoDetalle, PedidoLista } from './contrato'

const limpio = (v: string | null | undefined) => (v?.trim() ? v.trim() : null)
const CERRADOS = ['entregado', 'finalizado', 'cancelado']

/** Archivos subidos en esta sesión (solo en memoria del navegador). */
const blobs = new Map<string, string>()

/**
 * Igual que la vista ordenes_trabajo: montos nulos sin `ver_precios`; el contacto del cliente,
 * sin permiso de clientes, solo mientras el pedido sigue en proceso.
 */
function aLista(p: PedidoFila): PedidoLista {
  const precios = puede('ver_precios')
  const c = a.clientes.find((x) => x.id === p.cliente_id)
  const hoy = fechaLocal()
  return {
    id: p.id,
    folio: p.folio,
    titulo: p.titulo,
    cotizacion_id: p.cotizacion_id,
    cliente_id: p.cliente_id,
    cliente: c?.nombre ?? '',
    cliente_whatsapp: puedeVerClientes() || pedidoEnProceso(p.estado) ? (c?.whatsapp ?? c?.telefono ?? null) : null,
    estado: p.estado,
    estado_anterior: p.estado_anterior,
    motivo_estado: p.motivo_estado,
    etapas_omitidas: [...p.etapas_omitidas],
    prioridad: p.prioridad,
    fecha_entrega: p.fecha_entrega,
    atrasado: Boolean(p.fecha_entrega && p.fecha_entrega < hoy && !CERRADOS.includes(p.estado)),
    requiere_instalacion: p.requiere_instalacion,
    requiere_factura: p.requiere_factura,
    facturado: p.facturado,
    estado_pago: p.estado_pago,
    anticipo_recibido: p.pagado > 0,
    total: precios ? p.total : null,
    pagado: precios ? p.pagado : null,
    saldo: precios ? p.saldo : null,
    vendedor_id: p.vendedor_id,
    responsable_id: p.responsable_id,
    disenador_id: p.disenador_id,
    num_partidas: a.partidas.filter((x) => x.pedido_id === p.id).length,
    num_disenos: a.archivos.filter((x) => x.pedido_id === p.id && x.categoria === 'diseno').length,
    created_at: p.created_at,
    updated_at: p.updated_at,
    entregado_at: p.entregado_at,
    finalizado_at: p.finalizado_at,
  }
}

function buscar(id: string) {
  const p = a.pedidos.find((x) => x.id === id)
  if (!p) throw new Error('Pedido no encontrado')
  return p
}

function conNombre(x: (typeof a.archivos)[number]): Archivo {
  return copia({ ...x, subido_por_nombre: nombrePerfil(a, x.subido_por) })
}

function aplicarCambios(p: PedidoFila, c: CambiosPedido) {
  if (c.titulo !== undefined) {
    if (!c.titulo.trim()) throw new Error('Escribe el título del pedido')
    p.titulo = c.titulo.trim()
  }
  for (const k of ['descripcion', 'direccion_instalacion', 'notas_internas'] as const) if (c[k] !== undefined) p[k] = limpio(c[k])
  for (const k of ['fecha_entrega', 'fecha_limite_pago'] as const) if (c[k] !== undefined) p[k] = c[k] || null
  if (c.prioridad !== undefined) p.prioridad = c.prioridad
  if (c.requiere_instalacion !== undefined) p.requiere_instalacion = c.requiere_instalacion
  if (c.contacto_id !== undefined) p.contacto_id = c.contacto_id
  if (c.etapas_omitidas !== undefined) p.etapas_omitidas = [...c.etapas_omitidas]
  if (c.anticipo_pct !== undefined) p.anticipo_pct = c.anticipo_pct
  if (c.aplica_iva !== undefined) p.aplica_iva = c.aplica_iva
  if (c.iva_pct !== undefined) p.iva_pct = c.iva_pct
  if (c.requiere_factura !== undefined) p.requiere_factura = c.requiere_factura
  // Asignaciones: quedan en la línea de tiempo, como en la base de datos
  if (c.responsable_id !== undefined && c.responsable_id !== p.responsable_id) {
    p.responsable_id = c.responsable_id
    if (c.responsable_id) eventoPedido(a, p.id, { tipo: 'asignacion', mensaje: `Responsable: ${nombrePerfil(a, c.responsable_id) ?? 'sin nombre'}`, usuario_id: usuario().id })
  }
  if (c.disenador_id !== undefined && c.disenador_id !== p.disenador_id) {
    p.disenador_id = c.disenador_id
    if (c.disenador_id) eventoPedido(a, p.id, { tipo: 'asignacion', mensaje: `Diseño asignado a: ${nombrePerfil(a, c.disenador_id) ?? 'sin nombre'}`, usuario_id: usuario().id })
  }
  p.updated_at = ahoraISO()
  recalcularPedido(a, p)
}

export const pedidosDemo: ApiPedidos = {
  pedidos: {
    async listar(filtros = {}) {
      usuario()
      await espera(250)
      const t = normalizar(filtros.texto ?? '')
      return a.pedidos
        .filter((p) => (filtros.estados?.length ? filtros.estados.includes(p.estado) : filtros.incluirCerrados || !['finalizado', 'cancelado'].includes(p.estado)))
        .filter((p) => !filtros.clienteId || p.cliente_id === filtros.clienteId)
        .filter((p) => !filtros.responsableId || p.responsable_id === filtros.responsableId)
        .filter((p) => !filtros.vendedorId || p.vendedor_id === filtros.vendedorId)
        .filter((p) => !filtros.desde || fechaLocal(p.created_at) >= filtros.desde)
        .filter((p) => !filtros.hasta || fechaLocal(p.created_at) <= filtros.hasta)
        .map(aLista)
        .filter((p) => !filtros.soloAtrasados || p.atrasado)
        .filter((p) => !t || normalizar(`${p.folio} ${p.titulo} ${p.cliente}`).includes(t))
        .sort((x, y) => (x.fecha_entrega ?? '9999').localeCompare(y.fecha_entrega ?? '9999') || x.folio.localeCompare(y.folio))
        .slice(0, filtros.limite ?? 500)
    },

    async obtener(id) {
      usuario()
      await espera(200)
      const p = buscar(id)
      const precios = puede('ver_precios')
      const costos = puede('ver_costos')
      // Como clientes_operacion: Diseño y Producción no reciben correo ni datos fiscales
      const c = clienteOperacion(a, p.cliente_id, puedeVerClientes())
      const detalle: PedidoDetalle = {
        ...aLista(p),
        descripcion: p.descripcion,
        direccion_instalacion: p.direccion_instalacion,
        contacto_id: p.contacto_id,
        cotizacion_folio: p.cotizacion_id ? (a.cotizaciones.find((q) => q.id === p.cotizacion_id)?.folio ?? null) : null,
        cliente_datos: {
          id: p.cliente_id,
          nombre: c?.nombre ?? '',
          whatsapp: c?.whatsapp ?? null,
          telefono: c?.telefono ?? null,
          email: c?.email ?? null,
          requiere_factura: c?.requiere_factura ?? false,
        },
        vendedor: nombrePerfil(a, p.vendedor_id),
        responsable: nombrePerfil(a, p.responsable_id),
        disenador: nombrePerfil(a, p.disenador_id),
        montos: precios
          ? {
              anticipo_pct: p.anticipo_pct,
              aplica_iva: p.aplica_iva,
              iva_pct: p.iva_pct,
              subtotal: p.subtotal,
              descuento: p.descuento,
              recargo: p.recargo,
              iva: p.iva,
              total: p.total,
              pagado: p.pagado,
              saldo: p.saldo ?? 0,
              fecha_limite_pago: p.fecha_limite_pago,
              condiciones: p.condiciones,
              notas_internas: p.notas_internas,
            }
          : null,
        folio_factura: precios ? p.folio_factura : null,
        fecha_factura: precios ? p.fecha_factura : null,
        partidas: a.partidas
          .filter((x) => x.pedido_id === id)
          .sort((x, y) => x.orden - y.orden)
          .map((x): PartidaPedido => {
            const k = costos ? a.partida_costos.find((pc) => pc.partida_id === x.id) : undefined
            return {
              id: x.id,
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
              notas_produccion: x.notas_produccion,
              precio_unitario: precios ? x.precio_unitario : null,
              descuento_pct: precios ? x.descuento_pct : null,
              importe: precios ? x.importe : null,
              costos: k
                ? {
                    costo_material: k.costo_material,
                    costo_mano_obra: k.costo_mano_obra,
                    costo_fijo: k.costo_fijo,
                    desperdicio_pct: k.desperdicio_pct,
                    ganancia_pct: k.ganancia_pct,
                    costo_total: k.costo_total,
                    calculo: (k.calculo as Record<string, unknown>) ?? {},
                  }
                : null,
            }
          }),
      }
      return copia(detalle)
    },

    async crear(datos) {
      const s = exigir('gestionar_pedidos')
      await espera(400)
      const cliente = a.clientes.find((c) => c.id === datos.cliente_id)
      if (!cliente) throw new Error('Selecciona un cliente')
      if (!datos.titulo?.trim()) throw new Error('Escribe el título del pedido')
      const ahora = ahoraISO()
      const id = nuevoId('demo-ped')
      const etapas = etapasOmitidas(a, datos.partidas.map((x) => ({ tipo: x.tipo ?? 'concepto', producto_id: x.producto_id ?? null })))
      const p: PedidoFila = {
        id,
        folio: siguienteFolio(a, 'pedido'),
        cotizacion_id: null,
        cliente_id: cliente.id,
        contacto_id: datos.contacto_id ?? null,
        vendedor_id: s.id,
        responsable_id: datos.responsable_id ?? null,
        disenador_id: datos.disenador_id ?? null,
        titulo: datos.titulo.trim(),
        descripcion: limpio(datos.descripcion),
        estado: 'nuevo',
        estado_anterior: null,
        motivo_estado: null,
        etapas_omitidas: datos.etapas_omitidas ?? etapas.omitidas,
        prioridad: datos.prioridad ?? 'normal',
        fecha_entrega: datos.fecha_entrega || null,
        requiere_instalacion: datos.requiere_instalacion ?? etapas.instalacion,
        direccion_instalacion: limpio(datos.direccion_instalacion),
        anticipo_pct: datos.anticipo_pct ?? a.configuracion.anticipo_pct,
        aplica_iva: datos.aplica_iva ?? true,
        iva_pct: datos.iva_pct ?? a.configuracion.iva_pct,
        descuento_tipo: 'monto',
        descuento_valor: 0,
        recargo_pct: 0,
        recargo_concepto: 'Recargo por urgencia',
        subtotal: 0,
        descuento: 0,
        recargo: 0,
        iva: 0,
        total: 0,
        condiciones: a.configuracion.condiciones_cotizacion,
        pagado: 0,
        saldo: 0,
        estado_pago: 'pendiente',
        fecha_limite_pago: datos.fecha_limite_pago ?? datos.fecha_entrega ?? null,
        requiere_factura: datos.requiere_factura ?? cliente.requiere_factura,
        facturado: false,
        folio_factura: null,
        fecha_factura: null,
        notas_internas: limpio(datos.notas_internas),
        entregado_at: null,
        finalizado_at: null,
        cancelado_at: null,
        created_by: s.id,
        created_at: ahora,
        updated_at: ahora,
      }
      datos.partidas.forEach((x) => {
        if (!x.concepto?.trim()) throw new Error('Cada concepto necesita una descripción')
        if (!(x.cantidad > 0)) throw new Error('La cantidad de cada concepto debe ser mayor a cero')
      })
      a.pedidos.push(p)
      datos.partidas.forEach((x, i) =>
        a.partidas.push({
          id: `${id}-pa${i + 1}`,
          cotizacion_id: null,
          pedido_id: id,
          orden: i + 1,
          tipo: x.tipo ?? 'concepto',
          producto_id: x.producto_id ?? null,
          concepto: x.concepto.trim(),
          descripcion: limpio(x.descripcion),
          metodo_calculo: x.metodo_calculo,
          unidad: x.unidad ?? 'pza',
          ancho: x.ancho ?? null,
          alto: x.alto ?? null,
          largo: x.largo ?? null,
          cantidad: x.cantidad,
          precio_unitario: x.precio_unitario,
          descuento_pct: x.descuento_pct ?? 0,
          importe: importePartida(x.cantidad, x.precio_unitario, x.descuento_pct ?? 0),
          notas_produccion: limpio(x.notas_produccion),
          created_at: ahora,
          updated_at: ahora,
        }),
      )
      recalcularPedido(a, p)
      cliente.ultima_compra_at = ahora
      eventoPedido(a, id, { tipo: 'creado', estado_a: 'nuevo', mensaje: 'Pedido creado', usuario_id: s.id })
      registrarBitacora(a, { tabla: 'pedidos', registro_id: id, accion: 'crear', etiqueta: `${p.folio} · ${p.titulo}`, usuario_id: s.id })
      return { id, folio: p.folio }
    },

    async actualizar(id, cambios) {
      const s = exigir('gestionar_pedidos')
      await espera()
      const p = buscar(id)
      const antes = { ...p }
      aplicarCambios(p, cambios)
      registrarBitacora(a, { tabla: 'pedidos', registro_id: id, accion: 'modificar', etiqueta: `${p.folio} · ${p.titulo}`, cambios: diferencias(antes, p), usuario_id: s.id })
    },

    async cambiarEstado(id, estado, motivo) {
      const s = exigirAlguno('actualizar_produccion', 'gestionar_pedidos')
      await espera(200)
      const p = buscar(id)
      if ((estado === 'cancelado' || ['cancelado', 'finalizado'].includes(p.estado)) && !s.permisos.gestionar_pedidos) {
        throw new Error('Solo ventas o administración pueden cancelar o reabrir pedidos')
      }
      const antes = p.estado
      aplicarEstadoPedido(a, p, estado, limpio(motivo), s.id)
      if (antes !== estado) {
        registrarBitacora(a, {
          tabla: 'pedidos',
          registro_id: id,
          accion: estado === 'cancelado' ? 'cancelar' : 'cambio_estado',
          etiqueta: `${p.folio} · ${p.titulo}`,
          cambios: { estado: [antes, estado] },
          usuario_id: s.id,
        })
      }
    },

    async agregarNota(id, mensaje) {
      const s = usuario()
      if (!mensaje?.trim()) throw new Error('Escribe la nota')
      buscar(id)
      eventoPedido(a, id, { tipo: 'nota', mensaje: mensaje.trim(), usuario_id: s.id })
    },

    async eventos(id) {
      usuario()
      await espera(120)
      buscar(id)
      return copia(
        a.pedido_eventos
          .filter((e) => e.pedido_id === id)
          .sort((x, y) => x.created_at.localeCompare(y.created_at) || x.id - y.id)
          .map((e) => ({ ...e, usuario: nombrePerfil(a, e.usuario_id) })),
      )
    },

    async facturar(id, datos) {
      const s = exigir('gestionar_pedidos')
      const p = buscar(id)
      const antes = p.facturado
      p.facturado = datos.facturado
      p.folio_factura = datos.facturado ? limpio(datos.folio_factura) : null
      p.fecha_factura = datos.facturado ? datos.fecha_factura || fechaLocal() : null
      p.updated_at = ahoraISO()
      if (datos.facturado && !antes) {
        eventoPedido(a, id, { tipo: 'factura', mensaje: `Marcado como facturado${p.folio_factura ? ` (folio ${p.folio_factura})` : ''}`, usuario_id: s.id })
      }
      registrarBitacora(a, { tabla: 'pedidos', registro_id: id, accion: 'modificar', etiqueta: `${p.folio} · ${p.titulo}`, cambios: { facturado: [antes, datos.facturado] }, usuario_id: s.id })
    },

    async agregarPartida(pedidoId, x) {
      exigir('gestionar_pedidos')
      exigir('ver_precios')
      await espera()
      const p = buscar(pedidoId)
      if (!x.concepto?.trim()) throw new Error('Cada concepto necesita una descripción')
      if (!(x.cantidad > 0)) throw new Error('La cantidad debe ser mayor a cero')
      const ahora = ahoraISO()
      const orden = Math.max(0, ...a.partidas.filter((y) => y.pedido_id === pedidoId).map((y) => y.orden)) + 1
      a.partidas.push({
        id: nuevoId('demo-pa'),
        cotizacion_id: null,
        pedido_id: pedidoId,
        orden,
        tipo: x.tipo ?? 'concepto',
        producto_id: x.producto_id ?? null,
        concepto: x.concepto.trim(),
        descripcion: limpio(x.descripcion),
        metodo_calculo: x.metodo_calculo,
        unidad: x.unidad ?? 'pza',
        ancho: x.ancho ?? null,
        alto: x.alto ?? null,
        largo: x.largo ?? null,
        cantidad: x.cantidad,
        precio_unitario: x.precio_unitario,
        descuento_pct: x.descuento_pct ?? 0,
        importe: importePartida(x.cantidad, x.precio_unitario, x.descuento_pct ?? 0),
        notas_produccion: limpio(x.notas_produccion),
        created_at: ahora,
        updated_at: ahora,
      })
      p.updated_at = ahora
      recalcularPedido(a, p)
    },

    async actualizarPartida(id, c: CambiosPartida) {
      exigir('gestionar_pedidos')
      exigir('ver_precios')
      await espera()
      const x = a.partidas.find((y) => y.id === id && y.pedido_id)
      if (!x) throw new Error('Concepto no encontrado')
      if (c.concepto !== undefined) {
        if (!c.concepto.trim()) throw new Error('Cada concepto necesita una descripción')
        x.concepto = c.concepto.trim()
      }
      if (c.cantidad !== undefined && !(c.cantidad > 0)) throw new Error('La cantidad debe ser mayor a cero')
      if (c.descripcion !== undefined) x.descripcion = limpio(c.descripcion)
      if (c.notas_produccion !== undefined) x.notas_produccion = limpio(c.notas_produccion)
      if (c.metodo_calculo !== undefined) x.metodo_calculo = c.metodo_calculo
      if (c.unidad !== undefined) x.unidad = c.unidad
      if (c.ancho !== undefined) x.ancho = c.ancho
      if (c.alto !== undefined) x.alto = c.alto
      if (c.largo !== undefined) x.largo = c.largo
      if (c.cantidad !== undefined) x.cantidad = c.cantidad
      if (c.precio_unitario !== undefined) x.precio_unitario = c.precio_unitario
      if (c.descuento_pct !== undefined) x.descuento_pct = c.descuento_pct
      x.importe = importePartida(x.cantidad, x.precio_unitario, x.descuento_pct)
      x.updated_at = ahoraISO()
      recalcularPedido(a, buscar(x.pedido_id!))
    },

    async eliminarPartida(id) {
      exigir('gestionar_pedidos')
      await espera()
      const x = a.partidas.find((y) => y.id === id && y.pedido_id)
      if (!x) throw new Error('Concepto no encontrado')
      a.partidas.splice(a.partidas.indexOf(x), 1)
      const costo = a.partida_costos.findIndex((k) => k.partida_id === id)
      if (costo >= 0) a.partida_costos.splice(costo, 1)
      recalcularPedido(a, buscar(x.pedido_id!))
    },
  },

  archivos: {
    async listar(pedidoId) {
      usuario()
      await espera(150)
      return a.archivos
        .filter((x) => x.pedido_id === pedidoId)
        .sort((x, y) => y.created_at.localeCompare(x.created_at))
        .map(conNombre)
    },

    async subir(pedidoId, archivo, opciones = {}) {
      const s = exigirAlguno('actualizar_produccion', 'gestionar_pedidos', 'gestionar_clientes')
      await espera(500)
      buscar(pedidoId)
      if (archivo.size > 25 * 1024 * 1024) throw new Error('El archivo pesa más de 25 MB. Sube una prueba ligera (JPG o PDF) y deja el original en tu Drive con un enlace.')
      const nombre = opciones.nombre?.trim() || (archivo as File).name || 'archivo'
      const ahora = ahoraISO()
      const fila = registrarArchivo(
        a,
        {
          id: nuevoId('demo-arch'),
          pedido_id: pedidoId,
          cliente_id: null,
          categoria: opciones.categoria ?? 'diseno',
          nombre,
          path: `pedidos/${pedidoId}/${Date.now()}-${nombre}`,
          enlace_externo: null,
          mime: archivo.type || null,
          tamano: archivo.size,
          version: null,
          estado_aprobacion: 'no_aplica',
          aprobado_por_nombre: null,
          aprobacion_notas: null,
          aprobacion_registrada_por: null,
          aprobacion_at: null,
          subido_por: s.id,
          created_at: ahora,
          updated_at: ahora,
        },
        s.id,
      )
      // El archivo se queda en la memoria del navegador: nada se sube a ningún servidor.
      if (typeof URL !== 'undefined' && 'createObjectURL' in URL) blobs.set(fila.id, URL.createObjectURL(archivo))
      return conNombre(fila)
    },

    async agregarEnlace(pedidoId, datos) {
      const s = exigirAlguno('actualizar_produccion', 'gestionar_pedidos', 'gestionar_clientes')
      buscar(pedidoId)
      if (!datos.nombre?.trim()) throw new Error('Escribe el nombre del archivo')
      if (!/^https?:\/\//i.test(datos.enlace.trim())) throw new Error('El enlace debe empezar con https://')
      const ahora = ahoraISO()
      const fila = registrarArchivo(
        a,
        {
          id: nuevoId('demo-arch'),
          pedido_id: pedidoId,
          cliente_id: null,
          categoria: datos.categoria ?? 'diseno',
          nombre: datos.nombre.trim(),
          path: null,
          enlace_externo: datos.enlace.trim(),
          mime: null,
          tamano: null,
          version: null,
          estado_aprobacion: 'no_aplica',
          aprobado_por_nombre: null,
          aprobacion_notas: null,
          aprobacion_registrada_por: null,
          aprobacion_at: null,
          subido_por: s.id,
          created_at: ahora,
          updated_at: ahora,
        },
        s.id,
      )
      return conNombre(fila)
    },

    async registrarAprobacion(id, datos) {
      const s = exigir('aprobar_disenos')
      const x = a.archivos.find((f) => f.id === id)
      if (!x) throw new Error('Archivo no encontrado')
      if (!datos.aprobado_por_nombre?.trim()) throw new Error('Escribe quién respondió por parte del cliente')
      responderArchivo(a, x, datos.estado, { nombre: datos.aprobado_por_nombre.trim(), notas: limpio(datos.notas), usuarioId: s.id })
      registrarBitacora(a, { tabla: 'archivos', registro_id: id, accion: datos.estado === 'aprobado' ? 'aprobar' : 'cambio_estado', etiqueta: x.nombre, usuario_id: s.id })
      return conNombre(x)
    },

    async url(id) {
      usuario()
      const x = a.archivos.find((f) => f.id === id)
      if (!x) throw new Error('Archivo no encontrado')
      if (x.enlace_externo) return x.enlace_externo
      return blobs.get(id) ?? vistaPreviaArchivo(x.nombre)
    },

    async eliminar(id) {
      const s = usuario()
      const x = a.archivos.find((f) => f.id === id)
      if (!x) throw new Error('Archivo no encontrado')
      if (!esAdmin() && !(x.subido_por === s.id && x.estado_aprobacion !== 'aprobado')) {
        throw new Error('Solo quien subió el archivo (si no está aprobado) o administración pueden eliminarlo')
      }
      a.archivos.splice(a.archivos.indexOf(x), 1)
      const blob = blobs.get(id)
      if (blob) URL.revokeObjectURL(blob)
      blobs.delete(id)
      registrarBitacora(a, { tabla: 'archivos', registro_id: id, accion: 'eliminar', etiqueta: x.nombre, usuario_id: s.id })
    },
  },
}
