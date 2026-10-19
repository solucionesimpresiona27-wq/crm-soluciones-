/**
 * MÓDULO PORTAL · implementación de la vista previa.
 * Los enlaces de ejemplo abren /#/portal/<token> dentro de la misma vista previa; todo sale del
 * almacén en memoria y nada se envía a ningún servidor.
 */
import { almacen as a, copia, nuevoId, type EnlacePortalFila } from '@/data/demo/almacen'
import { ahoraISO, fechaLocal, nombrePerfil, redondear2, registrarBitacora, responderArchivo, vistaPreviaArchivo } from '@/data/demo/reglas'
import { espera, exigir, usuario } from '@/data/demo/sesion'
import { FLUJO_PEDIDO } from '@/lib/estados'
import { COTIZACION_ACTUALIZADA, ENLACE_NO_VALIDO, type ApiPortal, type EnlacePortal, type PartidaPortal, type VistaPortal } from './contrato'

const urlPublica = (token: string) =>
  typeof window === 'undefined' ? `/#/portal/${token}` : `${window.location.origin}${window.location.pathname}#/portal/${encodeURIComponent(token)}`

function folioDe(e: EnlacePortalFila) {
  return e.tipo === 'cotizacion' ? (a.cotizaciones.find((q) => q.id === e.cotizacion_id)?.folio ?? '') : (a.pedidos.find((p) => p.id === e.pedido_id)?.folio ?? '')
}

function aEnlace(e: EnlacePortalFila): EnlacePortal {
  return copia({
    id: e.id,
    tipo: e.tipo as EnlacePortal['tipo'],
    cotizacion_id: e.cotizacion_id,
    pedido_id: e.pedido_id,
    folio: folioDe(e),
    token: e.token,
    url: urlPublica(e.token),
    expira_at: e.expira_at,
    revocado: e.revocado,
    revocado_at: e.revocado_at,
    vistas: e.vistas,
    ultimo_acceso_at: e.ultimo_acceso_at,
    created_by: e.created_by,
    creado_por: nombrePerfil(a, e.created_by),
    created_at: e.created_at,
    vigente: !e.revocado && new Date(e.expira_at).getTime() > Date.now(),
  })
}

/** Igual que portal_enlace_vigente(): cualquier problema da el mismo error. */
type CotizacionDemo = (typeof a.cotizaciones)[number]

function partidasPortal(q: CotizacionDemo): PartidaPortal[] {
  return q.partidas.map((p) => ({
    orden: p.orden,
    tipo: p.tipo,
    concepto: p.concepto,
    descripcion: p.descripcion,
    metodo_calculo: p.metodo_calculo,
    unidad: p.unidad,
    ancho: p.ancho,
    alto: p.alto,
    largo: p.largo,
    cantidad: p.cantidad,
    precio_unitario: p.precio_unitario,
    descuento_pct: p.descuento_pct,
    importe: p.importe,
  }))
}

/**
 * Huella de lo que ve el cliente, como portal_version_cotizacion() en la base: cambia si cambian
 * los conceptos, precios, totales, condiciones o notas (no el estado ni el vencimiento).
 */
function versionCotizacion(q: CotizacionDemo): string {
  const texto = JSON.stringify([
    q.titulo, q.cliente.id, q.tiempo_entrega, q.anticipo_pct, q.aplica_iva, q.iva_pct, q.subtotal, q.descuento,
    q.recargo_pct, q.recargo_concepto, q.recargo, q.iva, q.total, q.condiciones, q.notas, partidasPortal(q),
  ])
  // FNV-1a de 32 bits: basta para detectar cambios en memoria
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function vigente(token: string) {
  const e = a.portal_enlaces.find((x) => x.token === token)
  if (!e || e.revocado || new Date(e.expira_at).getTime() <= Date.now()) throw new Error(ENLACE_NO_VALIDO)
  return e
}

const pedidoDe = (e: EnlacePortalFila) => (e.tipo === 'pedido' ? e.pedido_id : (a.cotizaciones.find((q) => q.id === e.cotizacion_id)?.pedido_id ?? null))

/** Igual que portal_texto_cliente(). */
function textoCliente(nombre: string, comentario?: string) {
  const n = (nombre ?? '').replace(/\s+/g, ' ').trim()
  const c = comentario?.trim() || null
  if (n.length < 2 || n.length > 120) throw new Error('Escribe tu nombre (de 2 a 120 caracteres)')
  if ((c?.length ?? 0) > 1000) throw new Error('El comentario puede tener hasta 1000 caracteres')
  return { nombre: n, comentario: c }
}

/** Permiso para compartir según el tipo (y siempre `ver_precios`: el portal muestra precios). */
function exigirTipo(tipo: string) {
  if (tipo === 'cotizacion') return exigir('ver_precios', 'gestionar_cotizaciones')
  if (tipo === 'pedido') return exigir('ver_precios', 'gestionar_pedidos')
  throw new Error('Tipo de enlace inválido: usa cotizacion o pedido')
}

function etiqueta(e: EnlacePortalFila) {
  return `Enlace del portal · ${folioDe(e)}`
}

export const portalDemo: ApiPortal = {
  portal: {
    async enlaces({ cotizacionId, pedidoId }) {
      usuario()
      await espera(150)
      const cotDelPedido = pedidoId ? a.pedidos.find((p) => p.id === pedidoId)?.cotizacion_id : null
      return a.portal_enlaces
        .filter((e) => (cotizacionId && e.cotizacion_id === cotizacionId) || (pedidoId && e.pedido_id === pedidoId) || (cotDelPedido && e.cotizacion_id === cotDelPedido))
        .filter((e) => {
          try {
            exigirTipo(e.tipo)
            return true
          } catch {
            return false
          }
        })
        .sort((x, y) => y.created_at.localeCompare(x.created_at))
        .map(aEnlace)
    },

    async crearEnlace(tipo, id, opciones = {}) {
      const s = exigirTipo(tipo)
      await espera(300)
      if (tipo === 'cotizacion' && !a.cotizaciones.some((q) => q.id === id)) throw new Error('Cotización no encontrada')
      if (tipo === 'pedido' && !a.pedidos.some((p) => p.id === id)) throw new Error('Pedido no encontrado')
      const dias = opciones.dias ?? 30
      if (dias < 1 || dias > 180) throw new Error('La vigencia del enlace debe ser de 1 a 180 días')
      if (!opciones.nuevo) {
        const existente = a.portal_enlaces
          .filter((e) => e.tipo === tipo && !e.revocado && new Date(e.expira_at).getTime() > Date.now() + 86_400_000)
          .filter((e) => (tipo === 'cotizacion' ? e.cotizacion_id : e.pedido_id) === id)
          .sort((x, y) => y.expira_at.localeCompare(x.expira_at))[0]
        if (existente) return { ...aEnlace(existente), nuevo: false }
      }
      const ahora = ahoraISO()
      const aleatorio = Array.from({ length: 24 }, () => 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 56)]).join('')
      const e: EnlacePortalFila = {
        id: nuevoId('demo-enl'),
        token: `vista-previa-${aleatorio}`,
        tipo,
        cotizacion_id: tipo === 'cotizacion' ? id : null,
        pedido_id: tipo === 'pedido' ? id : null,
        expira_at: new Date(Date.now() + dias * 86_400_000).toISOString(),
        revocado: false,
        revocado_at: null,
        revocado_por: null,
        vistas: 0,
        ultimo_acceso_at: null,
        created_by: s.id,
        created_at: ahora,
      }
      a.portal_enlaces.push(e)
      registrarBitacora(a, { tabla: 'portal_enlaces', registro_id: e.id, accion: 'crear', etiqueta: etiqueta(e), usuario_id: s.id })
      return { ...aEnlace(e), nuevo: true }
    },

    async revocarEnlace(id) {
      const e = a.portal_enlaces.find((x) => x.id === id)
      if (!e) throw new Error('Enlace no encontrado')
      const s = exigirTipo(e.tipo)
      if (e.revocado) return
      Object.assign(e, { revocado: true, revocado_at: ahoraISO(), revocado_por: s.id })
      registrarBitacora(a, { tabla: 'portal_enlaces', registro_id: id, accion: 'cancelar', etiqueta: etiqueta(e), usuario_id: s.id })
    },

    async respuestas({ cotizacionId, pedidoId }) {
      const s = usuario()
      if (!['gestionar_cotizaciones', 'gestionar_pedidos', 'aprobar_disenos'].some((p) => s.permisos[p as keyof typeof s.permisos])) {
        throw new Error('No tienes permiso para realizar esta acción')
      }
      return copia(
        a.portal_respuestas
          .filter((r) => (!cotizacionId || r.cotizacion_id === cotizacionId) && (!pedidoId || r.pedido_id === pedidoId))
          .sort((x, y) => y.created_at.localeCompare(x.created_at)),
      )
    },

    urlPublica,

    async obtener(token) {
      await espera(350)
      const e = vigente(token)
      e.vistas++
      e.ultimo_acceso_at = ahoraISO()
      const conf = a.configuracion
      const hoy = fechaLocal()
      const empresa = Object.fromEntries(
        Object.entries({
          nombre: conf.nombre_comercial,
          eslogan: conf.eslogan,
          ciudad: conf.ciudad,
          direccion: conf.direccion,
          telefono: conf.telefono,
          whatsapp: conf.whatsapp,
          email: conf.email,
          sitio_web: conf.sitio_web,
          instagram: conf.instagram,
          facebook: conf.facebook,
          tiktok: conf.tiktok,
          logo_url: conf.logo_url,
          color_primario: conf.color_primario,
          color_secundario: conf.color_secundario,
          datos_bancarios: conf.datos_bancarios,
          // RFC y razón social solo si el negocio lo configuró
          rfc: conf.mostrar_datos_fiscales ? conf.rfc : null,
          razon_social: conf.mostrar_datos_fiscales ? conf.razon_social : null,
          regimen_fiscal: conf.mostrar_datos_fiscales ? conf.regimen_fiscal : null,
        }).filter(([, v]) => v !== null && v !== undefined),
      ) as VistaPortal['empresa']
      const r: VistaPortal = { tipo: e.tipo as VistaPortal['tipo'], expira_at: e.expira_at, empresa }

      if (e.tipo === 'cotizacion') {
        const q = a.cotizaciones.find((x) => x.id === e.cotizacion_id)!
        const aprobacion = a.portal_respuestas
          .filter((x) => x.cotizacion_id === q.id && x.accion === 'aprobar_cotizacion')
          .sort((x, y) => y.created_at.localeCompare(x.created_at))[0]
        r.cotizacion = {
          folio: q.folio,
          titulo: q.titulo,
          fecha: q.fecha,
          fecha_vencimiento: q.fecha_vencimiento,
          vigente: q.fecha_vencimiento >= hoy,
          estado: q.estado,
          cliente: a.clientes.find((c) => c.id === q.cliente.id)?.nombre ?? q.cliente.nombre,
          contacto: null,
          vendedor: q.vendedor?.nombre ?? null,
          tiempo_entrega: q.tiempo_entrega,
          anticipo_pct: q.anticipo_pct,
          anticipo: redondear2((q.total * q.anticipo_pct) / 100),
          aplica_iva: q.aplica_iva,
          iva_pct: q.iva_pct,
          subtotal: q.subtotal,
          descuento: q.descuento,
          recargo_pct: q.recargo_pct,
          recargo_concepto: q.recargo_concepto,
          recargo: q.recargo,
          iva: q.iva,
          total: q.total,
          condiciones: q.condiciones,
          notas: q.notas,
          enviada_at: q.enviada_at,
          aceptada_at: q.aceptada_at,
          puede_aprobar: ['borrador', 'enviada'].includes(q.estado) && !q.pedido_id && q.fecha_vencimiento >= hoy,
          aprobacion: aprobacion ? { nombre: aprobacion.nombre, fecha: aprobacion.created_at } : null,
          partidas: partidasPortal(q),
          version: versionCotizacion(q),
        }
      }

      const pedidoId = pedidoDe(e)
      const p = pedidoId ? a.pedidos.find((x) => x.id === pedidoId) : undefined
      if (p) {
        const etapas = FLUJO_PEDIDO.filter((x) => x !== 'finalizado' && !p.etapas_omitidas.includes(x))
        r.pedido = {
          folio: p.folio,
          titulo: p.titulo,
          estado: p.estado,
          estado_pago: p.estado_pago,
          cliente: a.clientes.find((c) => c.id === p.cliente_id)?.nombre ?? '',
          fecha_entrega: p.fecha_entrega,
          requiere_instalacion: p.requiere_instalacion,
          created_at: p.created_at,
          entregado_at: p.entregado_at,
          anticipo_pct: p.anticipo_pct,
          subtotal: p.subtotal,
          descuento: p.descuento,
          recargo: p.recargo,
          iva: p.iva,
          total: p.total,
          pagado: p.pagado,
          saldo: p.saldo ?? 0,
          condiciones: p.condiciones,
          etapas,
          linea_tiempo: a.pedido_eventos
            .filter((ev) => ev.pedido_id === p.id && ['creado', 'estado'].includes(ev.tipo) && ev.estado_a)
            .sort((x, y) => x.created_at.localeCompare(y.created_at) || x.id - y.id)
            .map((ev) => ({ estado: ev.estado_a!, fecha: ev.created_at })),
          partidas: a.partidas
            .filter((x) => x.pedido_id === p.id)
            .sort((x, y) => x.orden - y.orden)
            .map((x) => ({
              orden: x.orden,
              tipo: x.tipo,
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
              importe: x.importe ?? 0,
            })),
          disenos: a.archivos
            .filter((x) => x.pedido_id === p.id && x.categoria === 'diseno')
            .sort((x, y) => (y.version ?? 0) - (x.version ?? 0) || y.created_at.localeCompare(x.created_at))
            .map((x) => ({
              id: x.id,
              nombre: x.nombre,
              version: x.version,
              estado_aprobacion: x.estado_aprobacion,
              mime: x.mime,
              tiene_archivo: Boolean(x.path),
              enlace_externo: x.enlace_externo && /^https?:\/\//i.test(x.enlace_externo) ? x.enlace_externo : null,
              created_at: x.created_at,
              aprobado_por_nombre: x.aprobado_por_nombre,
              aprobacion_at: x.aprobacion_at,
              puede_responder: x.estado_aprobacion === 'pendiente' && !['cancelado', 'finalizado'].includes(p.estado),
            })),
        }
      }
      return copia(r)
    },

    async aprobarCotizacion(token, version, nombre, comentario) {
      await espera(400)
      const e = vigente(token)
      if (e.tipo !== 'cotizacion') throw new Error('Este enlace no es de una cotización')
      const txt = textoCliente(nombre, comentario)
      const q = a.cotizaciones.find((x) => x.id === e.cotizacion_id)!
      if (q.estado === 'aceptada' || q.pedido_id) throw new Error('Esta cotización ya fue aprobada. ¡Gracias!')
      if (!['borrador', 'enviada'].includes(q.estado)) throw new Error('Esta cotización ya no se puede aprobar. Comunícate con tu asesor.')
      if (q.fecha_vencimiento < fechaLocal()) {
        const [y, m, d] = q.fecha_vencimiento.split('-')
        throw new Error(`Esta cotización venció el ${d}/${m}/${y}. Pide a tu asesor una cotización actualizada.`)
      }
      if (!version || version !== versionCotizacion(q)) throw new Error(COTIZACION_ACTUALIZADA)
      const ahora = ahoraISO()
      q.estado = 'aceptada'
      q.aceptada_at ??= ahora
      q.motivo_rechazo = null
      // La oportunidad ligada se gana (como tg_cotizaciones_oportunidad)
      const op = a.oportunidades.find((o) => o.id === a.cotizacion_oportunidad[q.id])
      if (op && op.etapa !== 'ganado') Object.assign(op, { etapa: 'ganado', cerrada_at: ahoraISO(), motivo_perdida: null, updated_at: ahora })
      a.portal_respuestas.push({ id: a.folios.respuesta++, enlace_id: e.id, accion: 'aprobar_cotizacion', cotizacion_id: q.id, pedido_id: null, archivo_id: null, nombre: txt.nombre, comentario: txt.comentario, ip: null, user_agent: 'Vista previa', created_at: ahora })
      a.actividades.push({
        id: nuevoId('ac'),
        cliente_id: q.cliente.id,
        oportunidad_id: a.cotizacion_oportunidad[q.id] ?? null,
        tipo: 'nota',
        descripcion: `Cotización ${q.folio} aprobada desde el portal por ${txt.nombre}${txt.comentario ? `. Comentario: ${txt.comentario}` : ''}`,
        fecha: ahora,
        usuario_id: null,
        created_at: ahora,
      })
      registrarBitacora(a, { tabla: 'cotizaciones', registro_id: q.id, accion: 'cambio_estado', etiqueta: `${q.folio} · ${q.titulo ?? ''}`.trim(), cambios: { estado: ['enviada', 'aceptada'] }, usuario_id: null })
      a.bitacora[a.bitacora.length - 1].usuario_nombre = 'Cliente (portal)'
      return { ok: true, folio: q.folio, estado: 'aceptada' }
    },

    async responderDiseno(token, archivoId, aprobado, nombre, comentario) {
      await espera(400)
      const e = vigente(token)
      const txt = textoCliente(nombre, comentario)
      if (aprobado === null || aprobado === undefined) throw new Error('Indica si apruebas el diseño o necesitas cambios')
      if (!aprobado && !txt.comentario) throw new Error('Cuéntanos qué cambios necesitas')
      const pedidoId = pedidoDe(e)
      if (!pedidoId) throw new Error('Este enlace no tiene diseños para revisar')
      const archivo = a.archivos.find((x) => x.id === archivoId && x.pedido_id === pedidoId && x.categoria === 'diseno')
      if (!archivo) throw new Error('Diseño no encontrado')
      if (archivo.estado_aprobacion !== 'pendiente') throw new Error('Este diseño ya tiene una respuesta registrada')
      const pedido = a.pedidos.find((p) => p.id === pedidoId)!
      if (['cancelado', 'finalizado'].includes(pedido.estado)) throw new Error('Este pedido ya no admite cambios. Comunícate con tu asesor.')
      const estado = aprobado ? 'aprobado' : 'cambios'
      responderArchivo(a, archivo, estado, { nombre: txt.nombre, notas: `Respuesta desde el portal del cliente${txt.comentario ? `: ${txt.comentario}` : ''}`, usuarioId: null })
      a.portal_respuestas.push({
        id: a.folios.respuesta++,
        enlace_id: e.id,
        accion: aprobado ? 'aprobar_diseno' : 'cambios_diseno',
        cotizacion_id: null,
        pedido_id: pedidoId,
        archivo_id: archivo.id,
        nombre: txt.nombre,
        comentario: txt.comentario,
        ip: null,
        user_agent: 'Vista previa',
        created_at: ahoraISO(),
      })
      registrarBitacora(a, { tabla: 'archivos', registro_id: archivo.id, accion: aprobado ? 'aprobar' : 'cambio_estado', etiqueta: archivo.nombre, usuario_id: null })
      a.bitacora[a.bitacora.length - 1].usuario_nombre = 'Cliente (portal)'
      return { ok: true, archivo_id: archivo.id, version: archivo.version, estado_aprobacion: estado, estado_pedido: pedido.estado }
    },

    async archivos(token, archivoId) {
      await espera(200)
      const e = vigente(token)
      const pedidoId = pedidoDe(e)
      if (!pedidoId) return []
      return a.archivos
        .filter((x) => x.pedido_id === pedidoId && x.categoria === 'diseno' && x.path && (!archivoId || x.id === archivoId))
        .sort((x, y) => (y.version ?? 0) - (x.version ?? 0))
        .map((x) => ({ id: x.id, nombre: x.nombre, version: x.version, mime: 'image/svg+xml', url: vistaPreviaArchivo(x.nombre), expira_en: 600 }))
    },
  },
}
