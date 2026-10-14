import { ETAPAS_EMBUDO, type EtapaComercial, type Oportunidad } from '@/data/modulos/embudo/contrato'

export const ABIERTAS = ETAPAS_EMBUDO.filter((e) => !e.cerrada)
export const CERRADAS = ETAPAS_EMBUDO.filter((e) => e.cerrada)
export const etiquetaEtapa = (e: EtapaComercial) => ETAPAS_EMBUDO.find((x) => x.etapa === e)?.etiqueta ?? e

export const ORIGENES = ['WhatsApp', 'Facebook', 'Instagram', 'TikTok', 'Recomendación', 'Visita', 'Otro'] as const
export const MOTIVOS_PERDIDA = ['Precio', 'Tiempo de entrega', 'Eligió a otro proveedor', 'Sin respuesta', 'Otro'] as const

const DIA = 86_400_000
const aDia = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))

/** 'atrasada' | 'hoy' | 'proxima' | null según la fecha de próxima acción (AAAA-MM-DD) y hoy. */
export function estadoAccion(fecha: string | null, hoy: string): 'atrasada' | 'hoy' | 'proxima' | null {
  if (!fecha) return null
  if (fecha < hoy) return 'atrasada'
  if (fecha === hoy) return 'hoy'
  return 'proxima'
}

/** Días desde el último cambio de la oportunidad (aproxima los días en la etapa). */
export function diasDesde(iso: string, hoy: string) {
  return Math.max(0, Math.round((aDia(hoy) - aDia(iso.slice(0, 10))) / DIA))
}

export interface Metricas {
  valorEnJuego: number
  abiertas: number
  sinAccion: number
  ganadas90: number
  perdidas90: number
  /** null si no hay cierres en 90 días */
  tasaCierre: number | null
}

export function metricas(ops: Oportunidad[], hoy: string): Metricas {
  const abiertas = ops.filter((o) => o.etapa !== 'ganado' && o.etapa !== 'perdido')
  const limite = new Date(aDia(hoy) - 90 * DIA).toISOString()
  const cerradas90 = ops.filter((o) => (o.etapa === 'ganado' || o.etapa === 'perdido') && o.cerrada_at && o.cerrada_at >= limite)
  const ganadas90 = cerradas90.filter((o) => o.etapa === 'ganado').length
  const perdidas90 = cerradas90.length - ganadas90
  return {
    valorEnJuego: abiertas.reduce((s, o) => s + (o.valor_estimado ?? 0), 0),
    abiertas: abiertas.length,
    sinAccion: abiertas.filter((o) => !o.proxima_accion_fecha).length,
    ganadas90,
    perdidas90,
    tasaCierre: cerradas90.length ? ganadas90 / cerradas90.length : null,
  }
}

/** Agrupa por etapa; las cerradas solo si se cerraron este mes (como el panel). */
export function porEtapa(ops: Oportunidad[], inicioMesISO: string) {
  const r = Object.fromEntries(ETAPAS_EMBUDO.map((e) => [e.etapa, [] as Oportunidad[]])) as Record<EtapaComercial, Oportunidad[]>
  for (const o of ops) {
    if ((o.etapa === 'ganado' || o.etapa === 'perdido') && !(o.cerrada_at && o.cerrada_at >= inicioMesISO)) continue
    r[o.etapa].push(o)
  }
  return r
}

/** Iniciales para el avatar del responsable. */
export const iniciales = (n: string | null) =>
  (n ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
