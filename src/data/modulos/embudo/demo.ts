/** MÓDULO EMBUDO · implementación de la vista previa (almacén en memoria, datos ficticios). */
import { almacen as a, copia, nuevoId } from '@/data/demo/almacen'
import { ahoraISO, diferencias, nombrePerfil, registrarBitacora } from '@/data/demo/reglas'
import { espera, exigir, puede } from '@/data/demo/sesion'
import { normalizar } from '@/lib/utils'
import type { ApiEmbudo, DatosOportunidad, EtapaComercial, Oportunidad, ResumenEmbudo } from './contrato'

type Fila = (typeof a.oportunidades)[number]
const CERRADAS: EtapaComercial[] = ['ganado', 'perdido']
const limpio = (v: string | null | undefined) => (v?.trim() ? v.trim() : null)

function inicioMes() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

function conNombres(o: Fila): Oportunidad {
  const c = a.clientes.find((x) => x.id === o.cliente_id)
  return copia({
    ...o,
    cliente: { id: o.cliente_id, nombre: c?.nombre ?? '', whatsapp: c?.whatsapp ?? c?.telefono ?? null },
    responsable: nombrePerfil(a, o.responsable_id),
  })
}

function buscar(id: string) {
  const o = a.oportunidades.find((x) => x.id === id)
  if (!o) throw new Error('Oportunidad no encontrada')
  return o
}

/** Igual que tg_oportunidades_etapa(): fecha de cierre y motivo de pérdida. */
function aplicarEtapa(o: Fila, etapa: EtapaComercial) {
  const antes = o.etapa
  o.etapa = etapa
  if (CERRADAS.includes(etapa)) {
    if (antes !== etapa) o.cerrada_at = o.cerrada_at && CERRADAS.includes(antes) ? o.cerrada_at : ahoraISO()
  } else o.cerrada_at = null
  if (etapa !== 'perdido') o.motivo_perdida = null
}

function aplicar(o: Fila, d: Partial<DatosOportunidad>) {
  if (d.titulo !== undefined) {
    if (!d.titulo.trim()) throw new Error('Escribe el título de la oportunidad')
    o.titulo = d.titulo.trim()
  }
  if (d.descripcion !== undefined) o.descripcion = limpio(d.descripcion)
  if (d.valor_estimado !== undefined) {
    if (d.valor_estimado !== null && d.valor_estimado < 0) throw new Error('El valor estimado no puede ser negativo')
    o.valor_estimado = d.valor_estimado
  }
  if (d.responsable_id !== undefined) o.responsable_id = d.responsable_id
  if (d.origen !== undefined) o.origen = limpio(d.origen)
  if (d.proxima_accion !== undefined) o.proxima_accion = limpio(d.proxima_accion)
  if (d.proxima_accion_fecha !== undefined) o.proxima_accion_fecha = d.proxima_accion_fecha || null
  if (d.etapa !== undefined) aplicarEtapa(o, d.etapa)
  if (d.motivo_perdida !== undefined && o.etapa === 'perdido') o.motivo_perdida = limpio(d.motivo_perdida)
  if (o.etapa === 'perdido' && !o.motivo_perdida) throw new Error('Indica el motivo por el que se perdió la oportunidad')
  o.updated_at = ahoraISO()
}

export const embudoDemo: ApiEmbudo = {
  oportunidades: {
    async listar(filtros = {}) {
      exigir('gestionar_clientes')
      await espera(250)
      const cerradas = filtros.cerradas ?? 'mes'
      const inicio = inicioMes()
      const t = normalizar(filtros.texto ?? '')
      return a.oportunidades
        .filter((o) => !filtros.responsableId || o.responsable_id === filtros.responsableId)
        .filter((o) => !filtros.clienteId || o.cliente_id === filtros.clienteId)
        .filter((o) => {
          if (!CERRADAS.includes(o.etapa)) return true
          if (cerradas === 'todas') return true
          if (cerradas === 'ninguna') return false
          return Boolean(o.cerrada_at && o.cerrada_at >= inicio)
        })
        .filter((o) => !t || normalizar(`${o.titulo} ${a.clientes.find((c) => c.id === o.cliente_id)?.nombre ?? ''}`).includes(t))
        .sort((x, y) => (x.proxima_accion_fecha ?? '9999').localeCompare(y.proxima_accion_fecha ?? '9999') || y.created_at.localeCompare(x.created_at))
        .map(conNombres)
    },

    async obtener(id) {
      exigir('gestionar_clientes')
      await espera(150)
      const o = buscar(id)
      const cotizaciones = puede('ver_precios')
        ? a.cotizaciones
            .filter((q) => a.cotizacion_oportunidad[q.id] === id)
            .sort((x, y) => y.fecha.localeCompare(x.fecha))
            .map((q) => ({ id: q.id, folio: q.folio, titulo: q.titulo, estado: q.estado, total: q.total, fecha: q.fecha }))
        : []
      return { ...conNombres(o), cotizaciones }
    },

    async crear(datos) {
      const s = exigir('gestionar_clientes')
      await espera()
      if (!a.clientes.some((c) => c.id === datos.cliente_id)) throw new Error('Selecciona un cliente')
      const ahora = ahoraISO()
      const o: Fila = {
        id: nuevoId('o'),
        cliente_id: datos.cliente_id,
        titulo: '',
        descripcion: null,
        etapa: 'prospecto_nuevo',
        valor_estimado: null,
        responsable_id: s.id,
        origen: null,
        proxima_accion: null,
        proxima_accion_fecha: null,
        motivo_perdida: null,
        cerrada_at: null,
        created_by: s.id,
        created_at: ahora,
        updated_at: ahora,
      }
      aplicar(o, { ...datos, titulo: datos.titulo ?? '' })
      a.oportunidades.push(o)
      registrarBitacora(a, { tabla: 'oportunidades', registro_id: o.id, accion: 'crear', etiqueta: o.titulo, usuario_id: s.id })
      return conNombres(o)
    },

    async actualizar(id, cambios) {
      const s = exigir('gestionar_clientes')
      await espera()
      const o = buscar(id)
      const antes = { ...o }
      const prueba = { ...o }
      aplicar(prueba, cambios)
      Object.assign(o, prueba)
      registrarBitacora(a, {
        tabla: 'oportunidades',
        registro_id: id,
        accion: antes.etapa !== o.etapa ? 'cambio_estado' : 'modificar',
        etiqueta: o.titulo,
        cambios: diferencias(antes, o, ['updated_at', 'cerrada_at']),
        usuario_id: s.id,
      })
      return conNombres(o)
    },

    async moverEtapa(id, etapa, motivoPerdida) {
      if (etapa === 'perdido' && !motivoPerdida?.trim()) throw new Error('Indica el motivo por el que se perdió la oportunidad')
      return embudoDemo.oportunidades.actualizar(id, { etapa, motivo_perdida: etapa === 'perdido' ? motivoPerdida : null })
    },

    async eliminar(id) {
      const s = exigir('eliminar_registros')
      const o = buscar(id)
      a.oportunidades.splice(a.oportunidades.indexOf(o), 1)
      // on delete set null, como en la base de datos
      a.actividades.forEach((x) => x.oportunidad_id === id && (x.oportunidad_id = null))
      a.tareas.forEach((x) => x.oportunidad_id === id && (x.oportunidad_id = null))
      for (const [cot, op] of Object.entries(a.cotizacion_oportunidad)) if (op === id) delete a.cotizacion_oportunidad[cot]
      registrarBitacora(a, { tabla: 'oportunidades', registro_id: id, accion: 'eliminar', etiqueta: o.titulo, usuario_id: s.id })
    },

    async resumen() {
      exigir('gestionar_clientes')
      const inicio = inicioMes()
      const r: ResumenEmbudo = {}
      for (const o of a.oportunidades.filter((x) => !CERRADAS.includes(x.etapa) || (x.cerrada_at && x.cerrada_at >= inicio))) {
        const x = (r[o.etapa] ??= { cantidad: 0, valor: 0 })
        x.cantidad++
        x.valor += o.valor_estimado ?? 0
      }
      return r
    },
  },
}
