import { useCallback } from 'react'
import { toast } from 'sonner'
import { useConfiguracion, usePlantillas } from '@/app/consultas'
import { dinero, fechaLarga } from '@/lib/format'
import { enlaceWhatsApp, llenarPlantilla, telefonoWhatsApp } from '@/lib/whatsapp'

const RESPALDO =
  'Hola {cliente}, ¿pudiste revisar la cotización *{folio}*? Con gusto resolvemos tus dudas o hacemos ajustes. La cotización es válida hasta el {vigencia}.'

export interface DatosSeguimiento {
  folio: string
  total: number
  fecha_vencimiento: string
  cliente: { nombre: string; whatsapp: string | null; telefono: string | null }
}

/**
 * Abre WhatsApp con el mensaje de seguimiento (plantilla "cotizacion_seguimiento")
 * ya escrito para el cliente de la cotización.
 */
export function useSeguimientoWhatsApp() {
  const plantillas = usePlantillas()
  const config = useConfiguracion()

  return useCallback(
    (c: DatosSeguimiento) => {
      const plantilla = plantillas.data?.find((p) => p.clave === 'cotizacion_seguimiento' && p.activo)
      const texto = llenarPlantilla(plantilla?.texto ?? RESPALDO, {
        cliente: c.cliente.nombre,
        folio: c.folio,
        total: dinero(c.total),
        vigencia: fechaLarga(c.fecha_vencimiento),
        empresa: config.data?.nombre_comercial ?? 'Soluciones Impresiona',
      })
      const telefono = c.cliente.whatsapp ?? c.cliente.telefono
      window.open(enlaceWhatsApp(telefono, texto), '_blank', 'noopener,noreferrer')
      if (!telefonoWhatsApp(telefono)) {
        toast(`${c.cliente.nombre} no tiene WhatsApp registrado`, {
          description: 'El mensaje ya está escrito: elige el contacto en WhatsApp para enviarlo.',
        })
      }
    },
    [plantillas.data, config.data],
  )
}
