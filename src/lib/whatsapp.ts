/**
 * WhatsApp por enlaces wa.me: gratis y sin API. Abre la conversación con el mensaje ya escrito.
 */

/** Convierte un teléfono mexicano a formato internacional (52 + 10 dígitos). */
export function telefonoWhatsApp(tel: string | null | undefined): string | null {
  if (!tel) return null
  let d = tel.replace(/\D/g, '')
  if (d.startsWith('521') && d.length === 13) d = `52${d.slice(3)}`
  if (d.length === 10) d = `52${d}`
  return d.length >= 11 && d.length <= 15 ? d : null
}

export function enlaceWhatsApp(tel: string | null | undefined, texto: string) {
  const numero = telefonoWhatsApp(tel)
  const t = encodeURIComponent(texto)
  return numero ? `https://wa.me/${numero}?text=${t}` : `https://wa.me/?text=${t}`
}

/** Reemplaza {variables} de una plantilla; las que no tienen valor se eliminan con su línea vacía. */
export function llenarPlantilla(plantilla: string, vars: Record<string, string | null | undefined>) {
  return plantilla
    .replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}
