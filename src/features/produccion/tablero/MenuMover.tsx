import * as Menu from '@radix-ui/react-dropdown-menu'
import { ArrowRightLeft, Check, CirclePause, CirclePlay, FileText } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { GlassIconButton } from '@/components/glass'
import type { OrdenTrabajo } from '@/data/modulos/produccion/contrato'
import type { EstadoPedido } from '@/data/tipos'
import { ESTADO_PEDIDO } from '@/lib/estados'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { DESTINOS, enEtapa } from './etapas'

/** Menú "Mover a…" de cada tarjeta: la forma de cambiar de etapa en celular (y alternativa al arrastre). */
export function MenuMover({
  o,
  onMover,
  onPausar,
  grande,
}: {
  o: OrdenTrabajo
  onMover: (estado: EstadoPedido) => void
  onPausar: () => void
  /** Botón grande tipo Centro de Control (en la orden de trabajo, sin "Abrir orden") */
  grande?: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const reducir = useReducedMotion()
  const navegar = useNavigate()
  const pausado = o.estado === 'pausado'

  return (
    <Menu.Root open={abierto} onOpenChange={setAbierto} modal={false}>
      <Menu.Trigger asChild>
        {grande ? (
          <GlassIconButton etiqueta={`Mover ${o.folio} a otra etapa`} icono={<ArrowRightLeft />} />
        ) : (
          <GlassIconButton
            etiqueta={`Mover ${o.folio} a otra etapa`}
            icono={<ArrowRightLeft />}
            tamano="sm"
            className="glass-clear size-9 pointer-coarse:size-11 [&_svg]:size-4"
          />
        )}
      </Menu.Trigger>
      <AnimatePresence>
        {abierto ? (
          <Menu.Portal forceMount>
            <Menu.Content asChild align="end" sideOffset={grande ? 10 : 6} collisionPadding={12} forceMount>
              <motion.div
                initial={reducir ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={reducir ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
                transition={resorte.modal}
                style={{
                  transformOrigin: 'var(--radix-dropdown-menu-content-transform-origin)',
                }}
                className="glass glass-strong z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] w-64 overflow-y-auto rounded-module p-2 shadow-glass-lg outline-none"
              >
                <Menu.Label className="px-3 pb-1 pt-2 text-xs font-medium text-fg-subtle">Mover {o.folio} a…</Menu.Label>
                {pausado && o.estado_anterior ? (
                  <Opcion icono={<CirclePlay />} onSelect={() => onMover(o.estado_anterior!)} luz>
                    Reanudar {enEtapa(o.estado_anterior)}
                  </Opcion>
                ) : null}
                {DESTINOS.map((e) => {
                  const actual = e === o.estado
                  return (
                    <Opcion key={e} disabled={actual} onSelect={() => onMover(e)} icono={actual ? <Check /> : <PuntoEtapa estado={e} />}>
                      {ESTADO_PEDIDO[e].etiqueta}
                      {actual ? <span className="sr-only"> (etapa actual)</span> : null}
                    </Opcion>
                  )
                })}
                <Menu.Separator className="hairline mx-2 my-1.5" />
                {!pausado ? (
                  <Opcion icono={<CirclePause />} onSelect={onPausar}>
                    Pausar…
                  </Opcion>
                ) : null}
                {!grande ? (
                  <Opcion icono={<FileText />} onSelect={() => navegar(`/produccion/${o.id}`)}>
                    Abrir orden de trabajo
                  </Opcion>
                ) : null}
              </motion.div>
            </Menu.Content>
          </Menu.Portal>
        ) : null}
      </AnimatePresence>
    </Menu.Root>
  )
}

function PuntoEtapa({ estado }: { estado: EstadoPedido }) {
  const tono = ESTADO_PEDIDO[estado].tono
  return (
    <span className="grid size-4 place-items-center" aria-hidden>
      <span
        className={cn(
          'size-2 rounded-full',
          tono === 'luz' ? 'bg-luz' : tono === 'exito' ? 'bg-success' : tono === 'aviso' ? 'bg-warning' : 'bg-accent dark:bg-navy-300',
        )}
      />
    </span>
  )
}

function Opcion({
  icono,
  children,
  onSelect,
  disabled,
  luz,
}: {
  icono: ReactNode
  children: ReactNode
  onSelect: () => void
  disabled?: boolean
  luz?: boolean
}) {
  return (
    <Menu.Item
      onSelect={onSelect}
      disabled={disabled}
      className={cn(
        'flex h-11 cursor-pointer items-center gap-3 rounded-full px-3 text-sm font-medium outline-none transition-colors [&_svg]:size-4 [&_svg]:shrink-0',
        'text-fg data-[highlighted]:bg-[var(--control-bg-hover)] data-[disabled]:cursor-default data-[disabled]:text-fg-subtle',
        luz && 'bg-luz/20 data-[highlighted]:bg-luz/30',
      )}
    >
      {icono}
      {children}
    </Menu.Item>
  )
}
