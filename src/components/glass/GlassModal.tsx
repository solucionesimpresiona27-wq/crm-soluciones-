import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { useEsMovil } from '@/hooks/useMediaQuery'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { GlassIconButton } from './GlassIconButton'

export interface GlassModalProps {
  abierto: boolean
  onCambio: (abierto: boolean) => void
  titulo: ReactNode
  descripcion?: ReactNode
  children: ReactNode
  pie?: ReactNode
  /** Ancho en escritorio */
  ancho?: 'sm' | 'md' | 'lg' | 'xl'
  /** Panel lateral en escritorio (cajón) en lugar de ventana centrada */
  lateral?: boolean
}

const anchos = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }

/**
 * Ventana emergente de cristal. En escritorio aparece con escala y profundidad;
 * en celular sube como hoja desde abajo (o cajón lateral si `lateral`).
 */
export function GlassModal({ abierto, onCambio, titulo, descripcion, children, pie, ancho = 'md', lateral }: GlassModalProps) {
  const movil = useEsMovil()
  const reducir = useReducedMotion()
  const hoja = movil
  const cajon = !movil && lateral

  const entrada = reducir
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : hoja
      ? { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }
      : cajon
        ? { initial: { x: '105%' }, animate: { x: 0 }, exit: { x: '105%' } }
        : {
            initial: { opacity: 0, scale: 0.94, y: 12 },
            animate: { opacity: 1, scale: 1, y: 0 },
            exit: { opacity: 0, scale: 0.97, y: 6 },
          }

  return (
    <Dialog.Root open={abierto} onOpenChange={onCambio}>
      <AnimatePresence>
        {abierto ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-navy-950/25 backdrop-blur-[3px] dark:bg-black/45"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>
            <div
              className={cn(
                'pointer-events-none fixed inset-0 z-50 flex',
                hoja && 'items-end',
                cajon && 'justify-end p-3',
                !hoja && !cajon && 'items-center justify-center p-4',
              )}
            >
              <Dialog.Content asChild forceMount {...(descripcion ? {} : { 'aria-describedby': undefined })}>
                <motion.div
                  {...entrada}
                  transition={resorte.modal}
                  className={cn(
                    'glass glass-strong pointer-events-auto flex w-full flex-col shadow-glass-lg outline-none',
                    hoja && 'max-h-[92dvh] rounded-t-sheet pb-[var(--safe-bottom)]',
                    cajon && 'h-full max-w-xl rounded-sheet',
                    !hoja && !cajon && cn('max-h-[88dvh] rounded-sheet', anchos[ancho]),
                  )}
                >
                  {hoja ? <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-fg/15" aria-hidden /> : null}
                  <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
                    <div className="min-w-0">
                      <Dialog.Title className="text-lg font-semibold tracking-tight text-fg">{titulo}</Dialog.Title>
                      {descripcion ? (
                        <Dialog.Description className="mt-1 text-sm text-fg-muted">{descripcion}</Dialog.Description>
                      ) : null}
                    </div>
                    <Dialog.Close asChild>
                      <GlassIconButton etiqueta="Cerrar" icono={<X />} tamano="sm" />
                    </Dialog.Close>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2">{children}</div>
                  {pie ? (
                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--divider)] px-6 py-4">{pie}</div>
                  ) : null}
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  )
}
