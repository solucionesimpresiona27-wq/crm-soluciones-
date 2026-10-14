import * as Tooltip from '@radix-ui/react-tooltip'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { useCallback, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useConfiguracion, usePlantillas } from '@/app/consultas'
import { useSesion } from '@/app/sesion'
import { GlassButton } from '@/components/glass'
import { fecha, haceCuanto } from '@/lib/format'
import { cn, iniciales } from '@/lib/utils'
import { enlaceWhatsApp, llenarPlantilla, telefonoWhatsApp } from '@/lib/whatsapp'

/**
 * Iniciales del cliente. La forma dice el tipo: círculo = persona, "squircle" = empresa.
 * Exportado para otros módulos que muestren clientes.
 */
export function AvatarCliente({ nombre, tipo, tamano = 'md', className }: { nombre: string; tipo?: string | null; tamano?: 'sm' | 'md' | 'xl'; className?: string }) {
  const tamanos = { sm: 'size-8 text-2xs', md: 'size-10 text-xs', xl: 'size-[4.5rem] text-xl sm:size-20 sm:text-2xl' }
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center bg-gradient-to-br from-navy-500 to-navy-700 font-bold tracking-tight text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_16px_-8px_rgba(34,66,107,0.7)]',
        tipo === 'persona' ? 'rounded-full' : tamano === 'xl' ? 'rounded-[1.6rem]' : 'rounded-[0.8rem]',
        tamanos[tamano],
        className,
      )}
    >
      {iniciales(nombre) || '·'}
    </span>
  )
}

/** "hace 3 meses" con la fecha exacta como texto de ayuda; "Sin compras" si nunca compró. */
export function UltimaCompra({ iso, className }: { iso: string | null; className?: string }) {
  if (!iso) return <span className={cn('text-fg-subtle', className)}>Sin compras</span>
  const dias = differenceInCalendarDays(new Date(), parseISO(iso))
  return (
    <span className={cn('whitespace-nowrap', className)} title={fecha(iso)}>
      {dias <= 0 ? 'Hoy' : dias === 1 ? 'Ayer' : haceCuanto(iso)}
    </span>
  )
}

export const TEXTO_REACTIVACION =
  'Hola {cliente}, ¡hace tiempo que no sabemos de ti! En {empresa} tenemos nuevas opciones en impresión, publicidad y servicios digitales. ¿Tienes algún proyecto en mente?'
const TEXTO_SALUDO = 'Hola {cliente}, te saluda {vendedor} de {empresa}. ¿En qué te podemos ayudar?'

interface DestinoWhatsApp {
  nombre: string
  whatsapp: string | null
  telefono?: string | null
}

/**
 * Abre WhatsApp con un mensaje de plantilla ya escrito ("saludo" o "reactivacion").
 * Si la plantilla no existe o está apagada, usa un texto por defecto.
 */
export function useWhatsAppCliente() {
  const plantillas = usePlantillas()
  const config = useConfiguracion()
  const { sesion } = useSesion()
  const tienePlantillaReactivacion = Boolean(plantillas.data?.some((p) => p.clave === 'reactivacion' && p.activo))

  const abrir = useCallback(
    (c: DestinoWhatsApp, clave: 'saludo' | 'reactivacion' = 'saludo') => {
      const plantilla = plantillas.data?.find((p) => p.clave === clave && p.activo)
      const texto = llenarPlantilla(plantilla?.texto ?? (clave === 'reactivacion' ? TEXTO_REACTIVACION : TEXTO_SALUDO), {
        cliente: c.nombre,
        vendedor: sesion?.perfil.nombre?.split(' ')[0] ?? '',
        empresa: config.data?.nombre_comercial ?? 'Soluciones Impresiona',
      })
      const tel = c.whatsapp ?? c.telefono ?? null
      window.open(enlaceWhatsApp(tel, texto), '_blank', 'noopener,noreferrer')
      if (!telefonoWhatsApp(tel)) {
        toast(`${c.nombre} no tiene WhatsApp registrado`, { description: 'El mensaje ya está escrito: elige el contacto en WhatsApp para enviarlo.' })
      }
    },
    [plantillas.data, config.data, sesion],
  )

  return { abrir, tienePlantillaReactivacion, plantillasCargadas: plantillas.isSuccess }
}

/** Botón discreto de acción por fila con globo de ayuda (área táctil de 44 px). Requiere Tooltip.Provider arriba. */
export function AccionFila({ etiqueta, icono, onClick, className }: { etiqueta: string; icono: ReactNode; onClick: () => void; className?: string }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <GlassButton
          variante="fantasma"
          tamano="icono"
          aria-label={etiqueta}
          icono={icono}
          className={className}
          onClick={(e) => {
            e.stopPropagation()
            onClick()
          }}
        />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="top" sideOffset={6} className="glass glass-strong z-50 rounded-full px-3 py-1.5 text-xs font-semibold text-fg shadow-glass">
          {etiqueta}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
