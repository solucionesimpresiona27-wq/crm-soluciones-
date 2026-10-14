import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { useConfiguracion, usePlantillas } from '@/app/consultas'
import type { PedidoDetalle } from '@/data/modulos/pedidos/contrato'
import { dinero, fechaLarga } from '@/lib/format'
import { enlaceWhatsApp, llenarPlantilla, telefonoWhatsApp } from '@/lib/whatsapp'

export type ClaveMensaje = 'pedido_listo' | 'anticipo_recibido' | 'recordatorio_pago' | 'diseno_revision'

/** Respaldo si la plantilla se desactivó o no existe. */
const RESPALDO: Record<ClaveMensaje, { nombre: string; texto: string; montos: boolean }> = {
  pedido_listo: { nombre: 'Pedido listo', montos: false, texto: 'Hola {cliente}, ¡tu pedido *{folio}* está listo! 🎉\nSaldo pendiente: {saldo}.\n¿Cuándo te gustaría recogerlo o coordinar la entrega/instalación?' },
  anticipo_recibido: { nombre: 'Anticipo recibido', montos: true, texto: 'Hola {cliente}, confirmamos la recepción de tu anticipo de *{monto}* para el pedido *{folio}*. ✅\nSaldo pendiente: {saldo}.\n¡Comenzamos con tu proyecto!' },
  recordatorio_pago: { nombre: 'Recordatorio de pago', montos: true, texto: 'Hola {cliente}, te recordamos amablemente que el pedido *{folio}* tiene un saldo pendiente de *{saldo}*. Si ya realizaste el pago, por favor envíanos tu comprobante. ¡Gracias!' },
  diseno_revision: { nombre: 'Diseño para aprobación', montos: false, texto: 'Hola {cliente}, te compartimos la propuesta de diseño de tu pedido *{folio}*. Por favor revísala y confírmanos tu aprobación para pasar a producción.' },
}

/** Quita los renglones cuyas variables no tienen valor (p. ej. el saldo para quien no ve precios). */
function sinVacios(plantilla: string, vars: Record<string, string | null | undefined>) {
  return plantilla
    .split('\n')
    .filter((l) => !Array.from(l.matchAll(/\{(\w+)\}/g)).some((m) => !vars[m[1]]))
    .join('\n')
}

/** Mensajes de WhatsApp del pedido con las plantillas del negocio. */
export function useWhatsAppPedido(p: PedidoDetalle | undefined) {
  const plantillas = usePlantillas()
  const config = useConfiguracion()

  const opciones = useMemo(() => {
    if (!p) return []
    const montos = Boolean(p.montos)
    const claves: ClaveMensaje[] = []
    if (p.estado === 'esperando_aprobacion' || p.estado === 'en_diseno') claves.push('diseno_revision')
    claves.push('pedido_listo')
    if (montos && p.montos!.pagado > 0) claves.push('anticipo_recibido')
    if (montos && p.montos!.saldo > 0.009) claves.push('recordatorio_pago')
    return claves.map((clave) => {
      const pl = plantillas.data?.find((x) => x.clave === clave && x.activo)
      return { clave, nombre: pl?.nombre ?? RESPALDO[clave].nombre }
    })
  }, [p, plantillas.data])

  const enviar = useCallback(
    (clave: ClaveMensaje) => {
      if (!p) return
      const pl = plantillas.data?.find((x) => x.clave === clave && x.activo)
      const vars = {
        cliente: p.cliente_datos.nombre,
        folio: p.folio,
        saldo: p.montos ? dinero(p.montos.saldo) : null,
        monto: p.montos ? dinero(p.montos.pagado) : null,
        total: p.montos ? dinero(p.montos.total) : null,
        fecha_entrega: p.fecha_entrega ? fechaLarga(p.fecha_entrega) : null,
        empresa: config.data?.nombre_comercial ?? 'Soluciones Impresiona',
      }
      const texto = llenarPlantilla(sinVacios(pl?.texto ?? RESPALDO[clave].texto, vars), vars)
      const telefono = p.cliente_datos.whatsapp ?? p.cliente_datos.telefono
      window.open(enlaceWhatsApp(telefono, texto), '_blank', 'noopener,noreferrer')
      if (!telefonoWhatsApp(telefono)) {
        toast(`${p.cliente_datos.nombre} no tiene WhatsApp registrado`, { description: 'El mensaje ya está escrito: elige el contacto en WhatsApp para enviarlo.' })
      }
    },
    [p, plantillas.data, config.data],
  )

  return { opciones, enviar }
}
