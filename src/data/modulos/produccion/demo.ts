/** MÓDULO PRODUCCIÓN · implementación de la vista previa (sin montos, almacén en memoria). */
import { almacen as a, copia, type PedidoFila } from '@/data/demo/almacen'
import { aplicarEstadoPedido, eventoPedido, fechaLocal, nombrePerfil, registrarBitacora } from '@/data/demo/reglas'
import { espera, exigirAlguno, usuario } from '@/data/demo/sesion'
import { normalizar } from '@/lib/utils'
import type { ApiProduccion, HojaOrden, OrdenTrabajo } from './contrato'

function aOrden(p: PedidoFila): OrdenTrabajo {
  const hoy = fechaLocal()
  return {
    id: p.id,
    folio: p.folio,
    titulo: p.titulo,
    descripcion: p.descripcion,
    cliente_id: p.cliente_id,
    cliente: a.clientes.find((c) => c.id === p.cliente_id)?.nombre ?? '',
    estado: p.estado,
    estado_anterior: p.estado_anterior,
    motivo_estado: p.motivo_estado,
    etapas_omitidas: [...p.etapas_omitidas],
    prioridad: p.prioridad,
    fecha_entrega: p.fecha_entrega,
    atrasado: Boolean(p.fecha_entrega && p.fecha_entrega < hoy && !['entregado', 'finalizado', 'cancelado'].includes(p.estado)),
    requiere_instalacion: p.requiere_instalacion,
    direccion_instalacion: p.direccion_instalacion,
    responsable_id: p.responsable_id,
    responsable: nombrePerfil(a, p.responsable_id),
    disenador_id: p.disenador_id,
    disenador: nombrePerfil(a, p.disenador_id),
    anticipo_recibido: p.pagado > 0,
    num_partidas: a.partidas.filter((x) => x.pedido_id === p.id).length,
    num_disenos: a.archivos.filter((x) => x.pedido_id === p.id && x.categoria === 'diseno').length,
    num_pendientes: a.archivos.filter((x) => x.pedido_id === p.id && x.categoria === 'diseno' && x.estado_aprobacion === 'pendiente').length,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }
}

function buscar(id: string) {
  const p = a.pedidos.find((x) => x.id === id)
  if (!p) throw new Error('Orden de trabajo no encontrada')
  return p
}

export const produccionDemo: ApiProduccion = {
  produccion: {
    async tablero(filtros = {}) {
      usuario()
      await espera(250)
      const fuera = filtros.incluirEntregados ? ['finalizado', 'cancelado'] : ['entregado', 'finalizado', 'cancelado']
      const t = normalizar(filtros.texto ?? '')
      return a.pedidos
        .filter((p) => !fuera.includes(p.estado))
        .filter((p) => !filtros.responsableId || p.responsable_id === filtros.responsableId)
        .map(aOrden)
        .filter((o) => !t || normalizar(`${o.folio} ${o.titulo} ${o.cliente}`).includes(t))
        .sort((x, y) => (x.fecha_entrega ?? '9999').localeCompare(y.fecha_entrega ?? '9999') || x.folio.localeCompare(y.folio))
    },

    async orden(id) {
      usuario()
      await espera(200)
      const p = buscar(id)
      const hoja: HojaOrden = {
        orden: aOrden(p),
        partidas: a.partidas
          .filter((x) => x.pedido_id === id)
          .sort((x, y) => x.orden - y.orden)
          .map((x) => ({
            id: x.id,
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
            notas_produccion: x.notas_produccion,
          })),
        disenos: a.archivos
          .filter((x) => x.pedido_id === id && x.categoria === 'diseno')
          .sort((x, y) => (y.version ?? 0) - (x.version ?? 0))
          .map((x) => ({
            id: x.id,
            nombre: x.nombre,
            version: x.version,
            estado_aprobacion: x.estado_aprobacion,
            mime: x.mime,
            tiene_archivo: Boolean(x.path),
            enlace_externo: x.enlace_externo,
            created_at: x.created_at,
          })),
        evidencias: a.archivos
          .filter((x) => x.pedido_id === id && x.categoria === 'evidencia')
          .sort((x, y) => y.created_at.localeCompare(x.created_at))
          .map((x) => ({
            id: x.id,
            nombre: x.nombre,
            mime: x.mime,
            tiene_archivo: Boolean(x.path),
            enlace_externo: x.enlace_externo,
            subido_por: nombrePerfil(a, x.subido_por),
            created_at: x.created_at,
          })),
        notas: a.pedido_eventos
          .filter((e) => e.pedido_id === id && e.tipo === 'nota')
          .sort((x, y) => y.created_at.localeCompare(x.created_at))
          .map((e) => ({ id: e.id, mensaje: e.mensaje ?? '', usuario: nombrePerfil(a, e.usuario_id), created_at: e.created_at })),
      }
      return copia(hoja)
    },

    async moverEtapa(id, estado, motivo) {
      const s = exigirAlguno('actualizar_produccion', 'gestionar_pedidos')
      await espera(150)
      const p = buscar(id)
      if ((estado === 'cancelado' || ['cancelado', 'finalizado'].includes(p.estado)) && !s.permisos.gestionar_pedidos) {
        throw new Error('Solo ventas o administración pueden cancelar o reabrir pedidos')
      }
      const antes = p.estado
      aplicarEstadoPedido(a, p, estado, motivo?.trim() || null, s.id)
      if (antes !== estado) {
        registrarBitacora(a, { tabla: 'pedidos', registro_id: id, accion: estado === 'cancelado' ? 'cancelar' : 'cambio_estado', etiqueta: `${p.folio} · ${p.titulo}`, cambios: { estado: [antes, estado] }, usuario_id: s.id })
      }
    },

    async guardarNotaPartida(partidaId, notas) {
      exigirAlguno('actualizar_produccion', 'gestionar_pedidos')
      const x = a.partidas.find((p) => p.id === partidaId && p.pedido_id)
      if (!x) throw new Error('Concepto no encontrado')
      x.notas_produccion = notas.trim() || null
      x.updated_at = new Date().toISOString()
    },

    async agregarNota(id, mensaje) {
      const s = usuario()
      if (!mensaje?.trim()) throw new Error('Escribe la nota')
      buscar(id)
      eventoPedido(a, id, { tipo: 'nota', mensaje: mensaje.trim(), usuario_id: s.id })
    },
  },
}
