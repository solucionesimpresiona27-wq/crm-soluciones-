import * as Tooltip from '@radix-ui/react-tooltip'
import { Banknote, CreditCard, Landmark, Lock, Send, type LucideIcon } from 'lucide-react'
import { useCallback, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useConfiguracion, usePlantillas } from '@/app/consultas'
import { EstadoVacio, GlassButton, GlassPanel, GlassSurface, Pildora, Skeleton, type TonoPildora } from '@/components/glass'
import { METODOS_PAGO, TIPOS_PAGO, type EstadoPago, type TipoPago } from '@/data/modulos/pagos/contrato'
import type { MetodoPago } from '@/data/tipos'
import { dinero } from '@/lib/format'
import { cn } from '@/lib/utils'
import { enlaceWhatsApp, llenarPlantilla, telefonoWhatsApp } from '@/lib/whatsapp'

export const ICONO_METODO: Record<MetodoPago, LucideIcon> = {
  efectivo: Banknote,
  transferencia: Send,
  deposito: Landmark,
  tarjeta: CreditCard,
}

export const TONO_TIPO: Record<TipoPago, TonoPildora> = {
  anticipo: 'luz',
  abono: 'acento',
  liquidacion: 'exito',
  devolucion: 'peligro',
}

export const ESTADO_PAGO: Record<EstadoPago, { etiqueta: string; tono: TonoPildora }> = {
  pendiente: { etiqueta: 'Sin pagos', tono: 'aviso' },
  anticipo: { etiqueta: 'Con anticipo', tono: 'luz' },
  parcial: { etiqueta: 'Pago parcial', tono: 'acento' },
  liquidado: { etiqueta: 'Liquidado', tono: 'exito' },
  reembolsado: { etiqueta: 'Reembolsado', tono: 'neutro' },
}

export function TipoPildora({ tipo }: { tipo: TipoPago }) {
  return <Pildora tono={TONO_TIPO[tipo]}>{TIPOS_PAGO[tipo]}</Pildora>
}

export function Metodo({ metodo, referencia, className }: { metodo: MetodoPago; referencia?: string | null; className?: string }) {
  const Icono = ICONO_METODO[metodo]
  return (
    <span className={cn('flex min-w-0 flex-col', className)}>
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-fg">
        <Icono className="size-4 shrink-0 text-fg-subtle" aria-hidden />
        {METODOS_PAGO[metodo]}
      </span>
      {referencia ? (
        <span className="truncate text-xs text-fg-subtle" title={referencia}>
          {referencia}
        </span>
      ) : null}
    </span>
  )
}

/** Importe tabular; las devoluciones en rojo con signo menos. */
export function Importe({ importe, tipo, className }: { importe: number; tipo: TipoPago; className?: string }) {
  const dev = tipo === 'devolucion'
  return (
    <span className={cn('num whitespace-nowrap font-semibold', dev ? 'text-danger' : 'text-fg', className)}>
      {dev ? '−' : ''}
      {dinero(importe)}
      {dev ? <span className="sr-only"> devueltos</span> : null}
    </span>
  )
}

/** Cápsula informativa con pozo circular (misma anatomía que GlassToggle). */
export function Capsula({ pozo, titulo, subtitulo, className, tono }: { pozo: ReactNode; titulo: ReactNode; subtitulo: ReactNode; className?: string; tono?: 'luz' }) {
  return (
    <GlassSurface grueso lente="capsula" className={cn('flex h-16 min-w-0 items-center gap-3 rounded-full pl-2 pr-6', className)}>
      <span
        className={cn(
          'grid size-12 shrink-0 place-items-center rounded-full [&_svg]:size-[1.35rem]',
          tono === 'luz' ? 'bg-luz text-luz-fg shadow-[0_0_18px_rgba(249,194,6,0.45)]' : 'bg-[var(--control-bg)] text-fg',
        )}
        aria-hidden
      >
        {pozo}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-semibold text-fg">{titulo}</span>
        <span className="block truncate text-xs text-fg-muted">{subtitulo}</span>
      </span>
    </GlassSurface>
  )
}

/** Fila de cápsulas con desplazamiento horizontal en celular. */
export function FilaCapsulas({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <section
      aria-label={etiqueta}
      className="-mx-3 -my-2 flex snap-x snap-mandatory scroll-px-3 gap-2.5 overflow-x-auto px-3 py-2 [scrollbar-width:none] sm:mx-0 sm:my-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:py-0 [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 [&>*]:snap-start"
    >
      {children}
    </section>
  )
}

export function CapsulasCargando({ n = 3 }: { n?: number }) {
  return (
    <div className="flex gap-2.5 overflow-hidden" aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className={cn('h-16 shrink-0 rounded-full', i === 0 ? 'w-64' : 'w-48')} />
      ))}
    </div>
  )
}

export function TablaCargando({ filas = 6 }: { filas?: number }) {
  return (
    <GlassPanel className="p-4" aria-hidden>
      <Skeleton className="mb-4 h-4 w-1/3" />
      {Array.from({ length: filas }).map((_, i) => (
        <Skeleton key={i} className="mb-2 h-14 w-full rounded-tile" />
      ))}
    </GlassPanel>
  )
}

/** Botón discreto de acción por fila, con globo de ayuda. Área táctil de 44 px. */
export function AccionFila({ etiqueta, icono, onClick, cargando, className }: { etiqueta: string; icono: ReactNode; onClick: () => void; cargando?: boolean; className?: string }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <GlassButton
          variante="fantasma"
          tamano="icono"
          aria-label={etiqueta}
          icono={icono}
          cargando={cargando}
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

export function SinAccesoPagos({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  const navegar = useNavigate()
  return (
    <GlassPanel className="mt-2">
      <EstadoVacio
        icono={<Lock />}
        titulo={titulo}
        descripcion={descripcion}
        accion={
          <GlassButton variante="cristal" onClick={() => navegar('/')}>
            Ir al inicio
          </GlassButton>
        }
      />
    </GlassPanel>
  )
}

const RESPALDO: Record<'anticipo_recibido' | 'pago_recibido' | 'recordatorio_pago', string> = {
  anticipo_recibido: 'Hola {cliente}, confirmamos la recepción de tu anticipo de *{monto}* para el pedido *{folio}*.\nSaldo pendiente: {saldo}.',
  pago_recibido: 'Hola {cliente}, recibimos tu pago de *{monto}* para el pedido *{folio}*.\nSaldo pendiente: {saldo}.\n¡Gracias!',
  recordatorio_pago:
    'Hola {cliente}, te recordamos amablemente que el pedido *{folio}* tiene un saldo pendiente de *{saldo}*. Si ya realizaste el pago, por favor envíanos tu comprobante. ¡Gracias!',
}

export interface DatosMensajePago {
  cliente: string
  whatsapp: string | null
  folio: string
  monto?: number
  saldo: number
  total?: number
}

/** Abre WhatsApp con una plantilla de pago (recibo de anticipo/pago o recordatorio) ya llena. */
export function useMensajePago() {
  const plantillas = usePlantillas()
  const config = useConfiguracion()
  return useCallback(
    (clave: keyof typeof RESPALDO, d: DatosMensajePago) => {
      const plantilla = plantillas.data?.find((p) => p.clave === clave && p.activo)
      const texto = llenarPlantilla(plantilla?.texto ?? RESPALDO[clave], {
        cliente: d.cliente,
        folio: d.folio,
        monto: d.monto !== undefined ? dinero(d.monto) : undefined,
        saldo: dinero(d.saldo),
        total: d.total !== undefined ? dinero(d.total) : undefined,
        empresa: config.data?.nombre_comercial ?? 'Soluciones Impresiona',
        datos_bancarios: config.data?.datos_bancarios ?? undefined,
      })
      window.open(enlaceWhatsApp(d.whatsapp, texto), '_blank', 'noopener,noreferrer')
      if (!telefonoWhatsApp(d.whatsapp)) {
        toast(`${d.cliente} no tiene WhatsApp registrado`, { description: 'El mensaje ya está escrito: elige el contacto en WhatsApp para enviarlo.' })
      }
    },
    [plantillas.data, config.data],
  )
}

/** Abre el diálogo de cobro de la página (?pedido=<id>). */
export function useAbrirCobro() {
  const [, setParams] = useSearchParams()
  return useCallback(
    (pedidoId: string) =>
      setParams(
        (prev) => {
          const n = new URLSearchParams(prev)
          n.set('pedido', pedidoId)
          n.delete('registrar')
          return n
        },
        { replace: true },
      ),
    [setParams],
  )
}
