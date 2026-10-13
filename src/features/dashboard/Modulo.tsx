import * as Dialog from '@radix-ui/react-dialog'
import { Maximize2, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { GlassIconButton, GlassSurface } from '@/components/glass'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'

/** Radios en px para que Motion los corrija durante la transición de elemento compartido. */
const RADIO_MODULO = 28
const RADIO_PANEL = 32
const RELLENO = 'p-4 lg:p-5'

export type IdExpandible = 'ventas' | 'produccion'

/* ---------------------------------------------------------------------
   Piezas comunes
   --------------------------------------------------------------------- */

export function TituloModulo({ icono, children, extra, className }: { icono: ReactNode; children: ReactNode; extra?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <span
        className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--control-bg)] text-fg-muted shadow-[inset_0_1px_0_var(--inner-hi)] [&_svg]:size-4"
        aria-hidden
      >
        {icono}
      </span>
      <h3 className="min-w-0 truncate text-sm font-semibold text-fg-muted">{children}</h3>
      {extra ? <div className="ml-auto flex shrink-0 items-center gap-2">{extra}</div> : null}
    </div>
  )
}

/** Indicio visual de que el módulo se amplía (el botón real cubre todo el módulo). */
export function GlifoAmpliar() {
  return (
    <span className="grid size-7 place-items-center rounded-full bg-[var(--control-bg)] text-fg-subtle shadow-[inset_0_1px_0_var(--inner-hi)]" aria-hidden>
      <Maximize2 className="size-3.5" />
    </span>
  )
}

export function Muestra({ color, className }: { color: string; className?: string }) {
  return <span className={cn('inline-block size-2.5 shrink-0 rounded-[3px]', className)} style={{ background: color }} aria-hidden />
}

/** Módulo estático de cristal. */
export function Modulo({ className, children, etiqueta }: { className?: string; children: ReactNode; etiqueta?: string }) {
  return (
    <GlassSurface role={etiqueta ? 'region' : undefined} aria-label={etiqueta} className={cn('h-full rounded-module', RELLENO, className)}>
      {children}
    </GlassSurface>
  )
}

/** Módulo que lleva a otra pantalla: todo el cristal es el enlace. */
export function ModuloEnlace({ a, className, children }: { a: string; className?: string; children: ReactNode }) {
  const reducir = useReducedMotion()
  return (
    <Link to={a} className="block h-full rounded-module outline-none">
      <GlassSurface
        interactivo
        whileTap={reducir ? undefined : { scale: 0.98 }}
        transition={resorte.presion}
        className={cn('h-full rounded-module', RELLENO, className)}
      >
        {children}
      </GlassSurface>
    </Link>
  )
}

/* ---------------------------------------------------------------------
   Módulo expandible (como mantener presionado un módulo del Centro de Control)
   --------------------------------------------------------------------- */

interface ModuloExpandibleProps {
  id: IdExpandible
  /** Nombre accesible del botón que abre el detalle */
  etiqueta: string
  abierto: boolean
  onAbrir: () => void
  /** Devuelve el foco al módulo al cerrar el detalle */
  enfocar: boolean
  onEnfocado: () => void
  /** El módulo vuelve de su versión ampliada: su contenido aparece con un fundido */
  remontado: boolean
  decoracion?: ReactNode
  className?: string
  children: ReactNode
}

export function ModuloExpandible({
  id,
  etiqueta,
  abierto,
  onAbrir,
  enfocar,
  onEnfocado,
  remontado,
  decoracion,
  className,
  children,
}: ModuloExpandibleProps) {
  const reducir = useReducedMotion()
  const boton = useRef<HTMLButtonElement>(null)
  const temporizador = useRef<number | undefined>(undefined)
  const porPresion = useRef(false)

  useEffect(() => {
    if (!abierto && enfocar) {
      boton.current?.focus({ preventScroll: true })
      onEnfocado()
    }
  }, [abierto, enfocar, onEnfocado])

  useEffect(() => () => window.clearTimeout(temporizador.current), [])

  if (abierto) return null

  const soltar = () => window.clearTimeout(temporizador.current)

  return (
    <GlassSurface
      layoutId={`modulo-${id}`}
      interactivo
      style={{ borderRadius: RADIO_MODULO }}
      whileTap={reducir ? undefined : { scale: 0.985 }}
      transition={{ ...resorte.presion, layout: reducir ? { duration: 0 } : resorte.expansion }}
      className={cn('h-full select-none [-webkit-touch-callout:none]', className)}
    >
      {decoracion}
      <motion.div
        initial={remontado && !reducir ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.22, delay: 0.2 }}
        className={cn('relative h-full', RELLENO)}
      >
        {children}
      </motion.div>
      <button
        ref={boton}
        type="button"
        aria-haspopup="dialog"
        aria-label={etiqueta}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          porPresion.current = false
          soltar()
          // Mantener presionado abre el detalle sin esperar a soltar, como en el Centro de Control
          temporizador.current = window.setTimeout(() => {
            porPresion.current = true
            onAbrir()
          }, 420)
        }}
        onPointerUp={soltar}
        onPointerLeave={soltar}
        onPointerCancel={soltar}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          soltar()
          if (porPresion.current) {
            porPresion.current = false
            return
          }
          onAbrir()
        }}
        className="absolute inset-0 z-10 cursor-pointer rounded-[inherit] outline-none focus-visible:shadow-[inset_0_0_0_2px_rgb(var(--accent)/0.55),0_0_0_4px_rgb(var(--accent)/0.2)]"
      />
    </GlassSurface>
  )
}

/* ---------------------------------------------------------------------
   Panel ampliado: el mismo cristal crece hasta ocupar el centro de la pantalla
   --------------------------------------------------------------------- */

interface PanelExpandidoProps {
  id: IdExpandible
  abierto: boolean
  onCerrar: () => void
  titulo: ReactNode
  descripcion?: ReactNode
  pie?: ReactNode
  children: ReactNode
  className?: string
}

export function PanelExpandido({ id, abierto, onCerrar, titulo, descripcion, pie, children, className }: PanelExpandidoProps) {
  const reducir = useReducedMotion()
  return (
    <Dialog.Root
      open={abierto}
      onOpenChange={(v) => {
        if (!v) onCerrar()
      }}
    >
      <AnimatePresence>
        {abierto ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-navy-950/25 backdrop-blur-[3px] dark:bg-black/45"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reducir ? 0.12 : 0.28 }}
              />
            </Dialog.Overlay>
            <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-2 pb-[calc(0.5rem+var(--safe-bottom))] sm:items-center sm:p-6">
              <Dialog.Content
                asChild
                forceMount
                onCloseAutoFocus={(e) => e.preventDefault()}
                {...(descripcion ? {} : { 'aria-describedby': undefined })}
              >
                <motion.div
                  layoutId={`modulo-${id}`}
                  transition={reducir ? { duration: 0 } : resorte.expansion}
                  style={{ borderRadius: RADIO_PANEL }}
                  className={cn(
                    'glass glass-strong pointer-events-auto flex max-h-full w-full max-w-4xl flex-col shadow-glass-lg outline-none',
                    className,
                  )}
                >
                  <motion.div
                    className="flex min-h-0 flex-1 flex-col"
                    initial={reducir ? false : { opacity: 0 }}
                    animate={{ opacity: 1, transition: { duration: 0.22, delay: reducir ? 0 : 0.14 } }}
                    exit={{ opacity: 0, transition: { duration: 0.08 } }}
                  >
                    <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-7 sm:pt-6">
                      <div className="min-w-0">
                        <Dialog.Title className="text-xl font-semibold tracking-tight text-fg">{titulo}</Dialog.Title>
                        {descripcion ? <Dialog.Description className="mt-0.5 text-sm text-fg-muted">{descripcion}</Dialog.Description> : null}
                      </div>
                      <Dialog.Close asChild>
                        <GlassIconButton etiqueta="Cerrar detalle" icono={<X />} tamano="md" />
                      </Dialog.Close>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4 sm:px-7">{children}</div>
                    {pie ? (
                      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--divider)] px-5 py-4 sm:px-7">{pie}</div>
                    ) : null}
                  </motion.div>
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  )
}
