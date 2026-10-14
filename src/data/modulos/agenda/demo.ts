/** MÓDULO AGENDA · implementación de la vista previa (almacén en memoria, datos ficticios). */
import { almacen as a, copia, nuevoId } from '@/data/demo/almacen'
import { ahoraISO, fechaLocal, nombreCliente, nombrePerfil, registrarBitacora } from '@/data/demo/reglas'
import { esAdmin, espera, puede, usuario } from '@/data/demo/sesion'
import type { ApiAgenda, DatosTarea, EventoAgenda, Tarea } from './contrato'

type TareaFila = (typeof a.tareas)[number]
const limpio = (v: string | null | undefined) => (v?.trim() ? v.trim() : null)

function aTarea(t: TareaFila): Tarea {
  return copia({
    ...t,
    responsable: nombrePerfil(a, t.responsable_id),
    cliente: nombreCliente(a, t.cliente_id),
    folio_pedido: puede('ver_precios') ? (a.pedidos.find((p) => p.id === t.pedido_id)?.folio ?? null) : null,
    vencida: !t.completada && t.fecha < fechaLocal(),
  })
}

function buscar(id: string) {
  const t = a.tareas.find((x) => x.id === id)
  if (!t) throw new Error('Tarea no encontrada')
  return t
}

/** Igual que tg_tareas_antes(): el cliente se toma del documento ligado si no se indicó. */
function completarCliente(t: TareaFila) {
  if (t.cliente_id) return
  if (t.pedido_id) t.cliente_id = a.pedidos.find((p) => p.id === t.pedido_id)?.cliente_id ?? null
  else if (t.cotizacion_id) t.cliente_id = a.cotizaciones.find((q) => q.id === t.cotizacion_id)?.cliente.id ?? null
  else if (t.oportunidad_id) t.cliente_id = a.oportunidades.find((o) => o.id === t.oportunidad_id)?.cliente_id ?? null
}

function aplicar(t: TareaFila, d: Partial<DatosTarea>) {
  if (d.titulo !== undefined) {
    const titulo = d.titulo.trim()
    if (!titulo || titulo.length > 200) throw new Error('Escribe la tarea (hasta 200 caracteres)')
    t.titulo = titulo
  }
  if (d.descripcion !== undefined) t.descripcion = limpio(d.descripcion)
  if (d.hora !== undefined) t.hora = d.hora || null
  if (d.tipo !== undefined) t.tipo = d.tipo
  if (d.fecha !== undefined) t.fecha = d.fecha
  if (d.responsable_id !== undefined) t.responsable_id = d.responsable_id
  if (d.prioridad !== undefined) t.prioridad = d.prioridad
  for (const k of ['cliente_id', 'pedido_id', 'oportunidad_id', 'cotizacion_id'] as const) if (d[k] !== undefined) t[k] = d[k] ?? null
  completarCliente(t)
  t.updated_at = ahoraISO()
}

/** Editar o completar: responsable, autor o administración. */
function exigirPropia(t: TareaFila) {
  const s = usuario()
  if (t.responsable_id !== s.id && t.created_by !== s.id && !esAdmin()) throw new Error('Solo el responsable, quien creó la tarea o administración pueden cambiarla')
  return s
}

const orden = (x: TareaFila, y: TareaFila) => x.fecha.localeCompare(y.fecha) || (x.hora ?? '99').localeCompare(y.hora ?? '99') || x.titulo.localeCompare(y.titulo, 'es')

export const agendaDemo: ApiAgenda = {
  tareas: {
    async listar(filtros = {}) {
      usuario()
      await espera(200)
      return a.tareas
        .filter((t) => filtros.incluirCompletadas || !t.completada)
        .filter((t) => (!filtros.desde || t.fecha >= filtros.desde) && (!filtros.hasta || t.fecha <= filtros.hasta))
        .filter((t) => !filtros.responsableId || t.responsable_id === filtros.responsableId)
        .filter((t) => !filtros.clienteId || t.cliente_id === filtros.clienteId)
        .filter((t) => !filtros.pedidoId || t.pedido_id === filtros.pedidoId)
        .filter((t) => !filtros.oportunidadId || t.oportunidad_id === filtros.oportunidadId)
        .filter((t) => !filtros.cotizacionId || t.cotizacion_id === filtros.cotizacionId)
        .sort(orden)
        .slice(0, filtros.limite ?? 500)
        .map(aTarea)
    },

    async misPendientes() {
      const s = usuario()
      await espera(150)
      const hoy = fechaLocal()
      return a.tareas.filter((t) => t.responsable_id === s.id && !t.completada && t.fecha <= hoy).sort(orden).map(aTarea)
    },

    async crear(datos) {
      const s = usuario()
      await espera()
      const ahora = ahoraISO()
      const t: TareaFila = {
        id: nuevoId('tarea'),
        titulo: '',
        descripcion: null,
        tipo: 'tarea',
        fecha: fechaLocal(),
        hora: null,
        responsable_id: s.id,
        cliente_id: null,
        pedido_id: null,
        oportunidad_id: null,
        cotizacion_id: null,
        prioridad: 'normal',
        completada: false,
        completada_at: null,
        completada_por: null,
        created_by: s.id,
        created_at: ahora,
        updated_at: ahora,
      }
      aplicar(t, { ...datos, titulo: datos.titulo ?? '' })
      a.tareas.push(t)
      registrarBitacora(a, { tabla: 'tareas', registro_id: t.id, accion: 'crear', etiqueta: t.titulo, usuario_id: s.id })
      return aTarea(t)
    },

    async actualizar(id, cambios) {
      const t = buscar(id)
      const s = exigirPropia(t)
      const prueba = { ...t }
      aplicar(prueba, cambios)
      Object.assign(t, prueba)
      registrarBitacora(a, { tabla: 'tareas', registro_id: id, accion: 'modificar', etiqueta: t.titulo, usuario_id: s.id })
      return aTarea(t)
    },

    async completar(id, completada = true) {
      const t = buscar(id)
      const s = exigirPropia(t)
      if (t.completada !== completada) {
        t.completada = completada
        t.completada_at = completada ? ahoraISO() : null
        t.completada_por = completada ? s.id : null
        t.updated_at = ahoraISO()
        registrarBitacora(a, { tabla: 'tareas', registro_id: id, accion: 'cambio_estado', etiqueta: t.titulo, cambios: { completada: [!completada, completada] }, usuario_id: s.id })
      }
      return aTarea(t)
    },

    async eliminar(id) {
      const s = usuario()
      const t = buscar(id)
      if (t.created_by !== s.id && !esAdmin()) throw new Error('Solo quien creó la tarea o administración pueden eliminarla')
      a.tareas.splice(a.tareas.indexOf(t), 1)
      registrarBitacora(a, { tabla: 'tareas', registro_id: id, accion: 'eliminar', etiqueta: t.titulo, usuario_id: s.id })
    },
  },

  agenda: {
    async calendario(desde, hasta) {
      usuario()
      await espera(250)
      if (!desde || !hasta || hasta < desde) throw new Error('Rango de fechas inválido')
      const dias = (new Date(`${hasta}T12:00:00`).getTime() - new Date(`${desde}T12:00:00`).getTime()) / 86_400_000
      if (dias > 366) throw new Error('Consulta como máximo un año a la vez')
      const dentro = (f: string | null) => Boolean(f && f >= desde && f <= hasta)
      const cliente = (id: string | null) => nombreCliente(a, id)
      const eventos: EventoAgenda[] = [
        ...a.tareas.filter((t) => dentro(t.fecha)).map(
          (t): EventoAgenda => ({
            origen: 'tarea',
            id: t.id,
            fecha: t.fecha,
            hora: t.hora,
            titulo: t.titulo,
            detalle: t.descripcion,
            tipo: t.tipo,
            prioridad: t.prioridad,
            completada: t.completada,
            responsable_id: t.responsable_id,
            cliente_id: t.cliente_id,
            cliente: cliente(t.cliente_id),
            pedido_id: t.pedido_id,
            cotizacion_id: t.cotizacion_id,
            oportunidad_id: t.oportunidad_id,
            folio: null,
            estado: null,
          }),
        ),
        ...a.pedidos
          .filter((p) => p.estado !== 'cancelado' && dentro(p.fecha_entrega))
          .map(
            (p): EventoAgenda => ({
              origen: p.requiere_instalacion ? 'instalacion' : 'entrega',
              id: p.id,
              fecha: p.fecha_entrega!,
              hora: null,
              titulo: p.titulo,
              detalle: null,
              tipo: null,
              prioridad: p.prioridad,
              completada: ['entregado', 'finalizado'].includes(p.estado),
              responsable_id: p.responsable_id,
              cliente_id: p.cliente_id,
              cliente: cliente(p.cliente_id),
              pedido_id: p.id,
              cotizacion_id: p.cotizacion_id,
              oportunidad_id: null,
              folio: p.folio,
              estado: p.estado,
            }),
          ),
        ...(puede('gestionar_clientes')
          ? a.oportunidades
              .filter((o) => !['ganado', 'perdido'].includes(o.etapa) && dentro(o.proxima_accion_fecha))
              .map(
                (o): EventoAgenda => ({
                  origen: 'seguimiento',
                  id: o.id,
                  fecha: o.proxima_accion_fecha!,
                  hora: null,
                  titulo: o.titulo,
                  detalle: o.proxima_accion,
                  tipo: null,
                  prioridad: null,
                  completada: false,
                  responsable_id: o.responsable_id,
                  cliente_id: o.cliente_id,
                  cliente: cliente(o.cliente_id),
                  pedido_id: null,
                  cotizacion_id: null,
                  oportunidad_id: o.id,
                  folio: null,
                  estado: o.etapa,
                }),
              )
          : []),
        ...(puede('ver_precios')
          ? a.cotizaciones
              .filter((q) => q.estado === 'enviada' && dentro(q.fecha_vencimiento))
              .map(
                (q): EventoAgenda => ({
                  origen: 'cotizacion',
                  id: q.id,
                  fecha: q.fecha_vencimiento,
                  hora: null,
                  titulo: q.titulo?.trim() || `Cotización ${q.folio}`,
                  detalle: 'Vence la cotización',
                  tipo: null,
                  prioridad: null,
                  completada: false,
                  responsable_id: q.vendedor?.id ?? null,
                  cliente_id: q.cliente.id,
                  cliente: q.cliente.nombre,
                  pedido_id: null,
                  cotizacion_id: q.id,
                  oportunidad_id: a.cotizacion_oportunidad[q.id] ?? null,
                  folio: q.folio,
                  estado: q.estado,
                }),
              )
          : []),
      ]
      return copia(eventos.sort((x, y) => x.fecha.localeCompare(y.fecha) || (x.hora ?? '99').localeCompare(y.hora ?? '99') || x.titulo.localeCompare(y.titulo, 'es')))
    },
  },
}
