/**
 * Utilidades compartidas por las implementaciones REALES (Supabase) de todos los módulos.
 * Solo las usan los archivos `supabase.ts` de `src/data/modulos/*` y `src/data/supabaseApi.ts`.
 * Cambios aquí afectan a todos los módulos: pídelos al orquestador.
 */
import { supabase } from '@/lib/supabase'

export { supabase }

/** Convierte errores de Supabase/Postgres en mensajes claros para el usuario. */
export function mensajeError(error: unknown): string {
  if (!error) return 'Ocurrió un error inesperado'
  const e = error as { message?: string; code?: string; details?: string }
  const msg = e.message ?? String(error)
  if (/Invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos. Revísalos o usa «¿Olvidaste tu contraseña?».'
  if (/Auth session missing|JWT expired|invalid.*token/i.test(msg)) return 'Tu sesión o el enlace venció. Vuelve a entrar o pide un enlace nuevo.'
  if (/Email not confirmed/i.test(msg)) return 'Confirma tu correo antes de entrar'
  if (/User is banned/i.test(msg)) return 'Tu cuenta está desactivada. Habla con el administrador.'
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Sin conexión con el servidor. Revisa tu internet.'
  if (e.code === '42501' || /row-level security/i.test(msg)) return msg.includes('permiso') ? msg : 'No tienes permiso para realizar esta acción'
  if (e.code === '23503') return 'No se puede completar porque hay información relacionada'
  if (e.code === '23505') return 'Ya existe un registro con esos datos'
  return msg
}

/** Devuelve los datos o lanza un Error con mensaje claro. Falla también si no hay datos. */
export function revisar<R extends { data: unknown; error: unknown }>(r: R): NonNullable<R['data']> {
  if (r.error) throw new Error(mensajeError(r.error))
  if (r.data === null || r.data === undefined) throw new Error('No se encontró la información solicitada')
  return r.data as NonNullable<R['data']>
}

/** Como `revisar`, pero acepta que no haya registro (consultas con maybeSingle). */
export function revisarOpcional<R extends { data: unknown; error: unknown }>(r: R): NonNullable<R['data']> | null {
  if (r.error) throw new Error(mensajeError(r.error))
  return (r.data ?? null) as NonNullable<R['data']> | null
}

/** Para escrituras sin respuesta (update/delete sin select): solo revisa el error. */
export function sinError(r: { error: unknown }): void {
  if (r.error) throw new Error(mensajeError(r.error))
}

/** Número (numeric de Postgres puede llegar como texto); nulo → 0. */
export const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v))
/** Número o nulo. */
export const nn = (v: unknown) => (v === null || v === undefined ? null : Number(v))

/** Texto recortado; vacío → null (para columnas opcionales). */
export const limpio = (v: string | null | undefined) => {
  const t = v?.trim()
  return t ? t : null
}

/** Texto para comparar con las columnas `busqueda` (minúsculas, sin acentos ni comodines de PostgREST). */
export function textoBusqueda(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[%,()*]/g, ' ')
}

/** Nombre de archivo seguro para rutas de Storage (sin acentos ni símbolos). */
export function nombreArchivoSeguro(nombre: string) {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return limpio.slice(-120) || 'archivo'
}

const FECHA_NEGOCIO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' })

/**
 * Fecha de hoy (AAAA-MM-DD) en la zona del negocio (Guadalajara = America/Mexico_City), la misma
 * que usa la base de datos para "hoy" (agenda, corte de caja, tareas), aunque el equipo esté en otra zona.
 */
export function hoyLocal() {
  return FECHA_NEGOCIO.format(new Date())
}
