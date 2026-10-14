/** Texto original de las plantillas incluidas (igual que la semilla de la base) para "Restaurar texto original". */
export const TEXTO_ORIGINAL: Record<string, string> = {
  saludo: 'Hola {cliente} 👋, te saluda {vendedor} de {empresa}. ¿En qué te podemos ayudar?',
  cotizacion_envio:
    'Hola {cliente} 👋, te compartimos la cotización *{folio}* por *{total}*.\n\n{enlace}\n\nVigencia: {vigencia}. Anticipo para iniciar: {anticipo}.\nQuedamos atentos a tus comentarios. ¡Gracias por considerar a {empresa}!',
  cotizacion_seguimiento:
    'Hola {cliente}, ¿pudiste revisar la cotización *{folio}*? Con gusto resolvemos tus dudas o hacemos ajustes. La cotización es válida hasta el {vigencia}.',
  anticipo_recibido:
    'Hola {cliente}, confirmamos la recepción de tu anticipo de *{monto}* para el pedido *{folio}*. ✅\nSaldo pendiente: {saldo}.\n¡Comenzamos con tu proyecto!',
  pago_recibido: 'Hola {cliente}, recibimos tu pago de *{monto}* para el pedido *{folio}*. ✅\nSaldo pendiente: {saldo}.\n¡Gracias!',
  diseno_revision:
    'Hola {cliente}, te compartimos la propuesta de diseño de tu pedido *{folio}*. Por favor revísala y confírmanos tu aprobación para pasar a producción. Cualquier cambio posterior a la aprobación puede generar costos adicionales.',
  pedido_listo: 'Hola {cliente}, ¡tu pedido *{folio}* está listo! 🎉\nSaldo pendiente: {saldo}.\n¿Cuándo te gustaría recogerlo o coordinar la entrega/instalación?',
  instalacion_programada: 'Hola {cliente}, te confirmamos la instalación de tu pedido *{folio}* para el {fecha_entrega}. Te avisaremos cuando vayamos en camino.',
  recordatorio_pago:
    'Hola {cliente}, te recordamos amablemente que el pedido *{folio}* tiene un saldo pendiente de *{saldo}*. Si ya realizaste el pago, por favor envíanos tu comprobante. ¡Gracias!',
  agradecimiento:
    'Hola {cliente}, ¡gracias por confiar en {empresa}! Esperamos que tu pedido *{folio}* haya quedado como lo imaginaste. Nos encantaría ver tu opinión o una foto en nuestras redes 💛',
  reactivacion:
    'Hola {cliente}, ¡hace tiempo que no sabemos de ti! En {empresa} tenemos nuevas opciones en impresión, publicidad y servicios digitales. ¿Tienes algún proyecto en mente?',
}

/** Variables disponibles y su valor de ejemplo para la vista previa (datos ficticios). */
export const VARIABLES: { clave: string; descripcion: string; ejemplo: string }[] = [
  { clave: 'cliente', descripcion: 'Nombre del cliente', ejemplo: 'Laura Méndez' },
  { clave: 'empresa', descripcion: 'Tu nombre comercial', ejemplo: '' },
  { clave: 'vendedor', descripcion: 'Quien atiende', ejemplo: 'Ana Ventas' },
  { clave: 'folio', descripcion: 'Folio de cotización o pedido', ejemplo: 'COT-0123' },
  { clave: 'total', descripcion: 'Total con IVA', ejemplo: '$4,640.00' },
  { clave: 'anticipo', descripcion: 'Anticipo para iniciar', ejemplo: '$2,320.00' },
  { clave: 'monto', descripcion: 'Monto del pago', ejemplo: '$2,320.00' },
  { clave: 'saldo', descripcion: 'Saldo pendiente', ejemplo: '$2,320.00' },
  { clave: 'vigencia', descripcion: 'Vigencia de la cotización', ejemplo: '29 oct 2026' },
  { clave: 'fecha_entrega', descripcion: 'Fecha de entrega', ejemplo: 'viernes 23 de octubre' },
  { clave: 'enlace', descripcion: 'Enlace para ver la cotización', ejemplo: 'https://ejemplo.com/c/abc123' },
]

export const CONTEXTO_PLANTILLA: Record<string, string> = {
  general: 'General',
  cliente: 'Clientes',
  cotizacion: 'Cotizaciones',
  pedido: 'Pedidos',
  pago: 'Pagos',
}

/** Inserta una variable en la posición del cursor y devuelve el nuevo texto y cursor. */
export function insertarVariable(texto: string, inicio: number, fin: number, clave: string) {
  const v = `{${clave}}`
  return { texto: texto.slice(0, inicio) + v + texto.slice(fin), cursor: inicio + v.length }
}

/** Variables usadas en el texto que no existen en la lista (posibles errores de dedo). */
export function variablesDesconocidas(texto: string) {
  const conocidas = new Set(VARIABLES.map((v) => v.clave))
  return [...new Set([...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!))].filter((k) => !conocidas.has(k))
}
