/**
 * MÓDULO CLIENTES · teléfonos (lo usan supabase.ts y demo.ts).
 * Se guardan como 10 dígitos para que buscar "3398765432" encuentre al cliente capturado como
 * "33 9876 5432" (la búsqueda compara texto) y viceversa.
 */

/** 10 dígitos sin espacios ni lada 52/521; si no es un número mexicano de 10 dígitos se deja como se capturó. */
export function telefonoGuardado(tel: string | null | undefined): string | null {
  const v = (tel ?? '').trim()
  if (!v) return null
  let d = v.replace(/\D/g, '')
  if (d.length === 13 && d.startsWith('521')) d = d.slice(3)
  else if (d.length === 12 && d.startsWith('52')) d = d.slice(2)
  return d.length === 10 ? d : v
}

/** Texto de búsqueda: si parece un teléfono ("33 9876 5432", "+52 33…"), se buscan solo sus dígitos. */
export function busquedaTelefono(texto: string): string {
  const t = texto.trim()
  if (!/^\+?[\d\s().-]{7,}$/.test(t)) return texto
  return telefonoGuardado(t)?.replace(/\D/g, '') ?? texto
}
