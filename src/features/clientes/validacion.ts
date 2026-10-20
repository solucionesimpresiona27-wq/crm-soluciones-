/**
 * Validaciones del formulario de clientes. Devuelven el mensaje de error (o null si está bien)
 * con lo que pasó y cómo resolverlo.
 */

/** RFC mexicano: 3 letras (moral) o 4 (física), fecha AAMMDD y homoclave de 3 caracteres. */
export const RFC_PATRON = /^([A-ZÑ&]{3,4})(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([A-Z\d]{2}[A\d])$/

export function validarRfc(rfc: string | null | undefined): string | null {
  const v = (rfc ?? '').trim().toUpperCase()
  if (!v) return null
  if (!RFC_PATRON.test(v)) return 'RFC no válido: 12 caracteres para empresa (ABC201231XX1) o 13 para persona'
  return null
}

/** Solo dígitos, sin lada internacional 52 / 521. */
export function digitosTelefono(tel: string | null | undefined) {
  const d = (tel ?? '').replace(/\D/g, '')
  if (d.length === 13 && d.startsWith('521')) return d.slice(3)
  if (d.length === 12 && d.startsWith('52')) return d.slice(2)
  return d
}

export function validarTelefono(tel: string | null | undefined, nombre = 'El WhatsApp'): string | null {
  if (!(tel ?? '').trim()) return null
  const d = digitosTelefono(tel)
  if (d.length !== 10) return `${nombre} debe tener 10 dígitos (por ejemplo 33 1234 5678); tiene ${d.length}`
  return null
}

export function validarCorreo(correo: string | null | undefined, nombre = 'El correo'): string | null {
  const v = (correo ?? '').trim()
  if (!v) return null
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : `${nombre} no parece válido: revisa que tenga @ y dominio (ventas@empresa.com)`
}

export function validarCodigoPostal(cp: string | null | undefined): string | null {
  const v = (cp ?? '').trim()
  if (!v) return null
  return /^\d{5}$/.test(v) ? null : 'El código postal fiscal lleva 5 dígitos'
}

/** Tras validar, lleva el foco (y el scroll) al primer campo marcado con error del formulario. */
export function enfocarPrimerError(formId: string) {
  requestAnimationFrame(() => {
    const campo = document.querySelector<HTMLElement>(`#${formId} [aria-invalid="true"]`)
    campo?.focus()
    campo?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
}
