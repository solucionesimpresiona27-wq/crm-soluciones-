/**
 * Fechas de la semilla de la vista previa. Todo es relativo a "hoy" para que la demo se vea
 * igual cualquier día: lo que debe caer en el mes actual se recorre al día 1 si haría falta
 * (`enMesActual`) y lo histórico usa días fijos de meses anteriores (`mes(k).dia(d)`).
 */
import { busquedaDe } from './reglas'

export { busquedaDe }

export interface Ctx {
  /** AAAA-MM-DD (hora local del navegador) */
  hoy: string
  /** Primer día del mes actual */
  inicioMes: string
  /** hoy ± n días */
  dia(n: number): string
  /** La fecha, o el día 1 del mes actual si es anterior (para lo que debe contar "este mes"). */
  enMesActual(fecha: string): string
  /** Mes k meses atrás (k = 1 es el mes pasado); `.dia(d)` da el día d (1–28). */
  mes(k: number): { dia(d: number): string; inicio: string; clave: string }
  /** Marca de tiempo ISO de una fecha local a cierta hora; nunca en el futuro. */
  ts(fecha: string, hora?: number, minuto?: number): string
}

const dosDigitos = (n: number) => String(n).padStart(2, '0')
const aTexto = (d: Date) => `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`

/** Contexto de fechas. `hoy` (AAAA-MM-DD) permite fijar la fecha; por defecto, la del navegador. */
export function crearCtx(hoy?: string): Ctx {
  const base = hoy ? new Date(`${hoy}T12:00:00`) : new Date()
  const textoHoy = aTexto(base)
  const inicio = new Date(base.getFullYear(), base.getMonth(), 1)
  const inicioMes = aTexto(inicio)
  // Si la fecha está fijada, "ahora" es el final de ese día; si no, el momento actual.
  const ahora = hoy ? new Date(`${hoy}T23:59:00`).getTime() : Date.now()

  return {
    hoy: textoHoy,
    inicioMes,
    dia(n) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + n)
      return aTexto(d)
    },
    enMesActual(fecha) {
      return fecha < inicioMes ? inicioMes : fecha
    },
    mes(k) {
      const m = new Date(base.getFullYear(), base.getMonth() - k, 1)
      return {
        inicio: aTexto(m),
        clave: `${m.getFullYear()}-${dosDigitos(m.getMonth() + 1)}`,
        dia: (d: number) => aTexto(new Date(m.getFullYear(), m.getMonth(), Math.min(Math.max(d, 1), 28))),
      }
    },
    ts(fecha, hora = 10, minuto = 0) {
      const t = new Date(`${fecha}T${dosDigitos(hora)}:${dosDigitos(minuto)}:00`).getTime()
      // Lo de hoy nunca queda "en el futuro" (se vería "hace en 2 horas").
      return new Date(Math.min(t, ahora - 5 * 60_000)).toISOString()
    },
  }
}
