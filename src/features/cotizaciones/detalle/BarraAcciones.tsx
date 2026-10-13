import * as Menu from '@radix-ui/react-dropdown-menu'
import { CheckCircle2, CopyPlus, Ellipsis, FileDown, Loader2, MessageCircle, PackageCheck, PackagePlus, PencilLine, Send, Trash2, XCircle } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { GlassIconButton } from '@/components/glass'
import type { CotizacionCompleta, EstadoCotizacion } from '@/data/tipos'
import { escalonado, resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'

export interface PermisosDetalle {
  gestionar: boolean
  convertir: boolean
}

export interface ManejadoresDetalle {
  whatsapp: () => void
  pdf: () => void
  editar: () => void
  duplicar: () => void
  convertir: () => void
  verPedido: () => void
  marcar: (estado: Extract<EstadoCotizacion, 'enviada' | 'aceptada'>) => void
  rechazar: () => void
  eliminar: () => void
}

interface Accion {
  id: string
  etiqueta: string
  /** Nombre accesible cuando la etiqueta visible no basta */
  nombre?: string
  icono: ReactNode
  onClick?: () => void
  activo?: boolean
  tono?: 'luz' | 'acento'
  desactivado?: boolean
  menu?: boolean
}

/** Botones circulares con etiqueta, como el Centro de Control. Entran una sola vez con un escalonado corto. */
export function BarraAcciones({
  c,
  permisos,
  en,
  ocupado,
  className,
}: {
  c: CotizacionCompleta
  permisos: PermisosDetalle
  en: ManejadoresDetalle
  ocupado: { whatsapp: boolean; pdf: boolean; duplicar: boolean; bloqueado: boolean }
  className?: string
}) {
  const reducir = useReducedMotion()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const esPedido = Boolean(c.pedido_id)
  const cerrada = c.estado === 'rechazada' || c.estado === 'cancelada'
  const carga = <Loader2 className="animate-spin" />

  const acciones: Accion[] = []
  if (permisos.gestionar) {
    acciones.push({
      id: 'whatsapp',
      etiqueta: 'Enviar por WhatsApp',
      icono: ocupado.whatsapp ? carga : <MessageCircle />,
      onClick: en.whatsapp,
      // La luz marca lo pendiente: solo mientras la cotización sigue abierta.
      activo: c.estado === 'borrador' || c.estado === 'enviada',
      tono: 'luz',
      desactivado: ocupado.bloqueado,
    })
  }
  acciones.push({ id: 'pdf', etiqueta: 'Descargar PDF', icono: ocupado.pdf ? carga : <FileDown />, onClick: en.pdf, desactivado: ocupado.bloqueado })
  if (permisos.gestionar) {
    acciones.push({ id: 'editar', etiqueta: 'Editar', icono: <PencilLine />, onClick: en.editar, desactivado: esPedido })
    acciones.push({ id: 'duplicar', etiqueta: 'Duplicar', icono: ocupado.duplicar ? carga : <CopyPlus />, onClick: en.duplicar, desactivado: ocupado.duplicar })
  }
  if (permisos.convertir) {
    acciones.push(
      esPedido
        ? {
            id: 'pedido',
            // Guion no separable: el folio no se parte en dos renglones
            etiqueta: `Pedido ${(c.pedido_folio ?? '').replace('-', '\u2011')}`.trim(),
            nombre: `Copiar el folio del pedido ${c.pedido_folio ?? ''}`.trim(),
            icono: <PackageCheck />,
            onClick: en.verPedido,
            activo: true,
            tono: 'acento',
          }
        : { id: 'convertir', etiqueta: 'Convertir en pedido', icono: <PackagePlus />, onClick: en.convertir, desactivado: cerrada },
    )
  }
  if (permisos.gestionar) acciones.push({ id: 'mas', etiqueta: 'Más', nombre: 'Más acciones de la cotización', icono: <Ellipsis />, menu: true })

  const puedeEnviar = c.estado === 'borrador'
  const puedeAceptar = (c.estado === 'borrador' || c.estado === 'enviada') && !esPedido
  const puedeRechazar = (c.estado === 'borrador' || c.estado === 'enviada' || c.estado === 'aceptada') && !esPedido
  const puedeEliminar = c.estado === 'borrador' && !esPedido

  return (
    <div
      role="group"
      aria-label="Acciones de la cotización"
      className={cn('grid grid-cols-3 justify-items-center gap-y-4 sm:flex sm:flex-wrap sm:justify-start sm:gap-x-1 xl:justify-end', className)}
    >
      {acciones.map((a, i) => {
        const boton = (
          <GlassIconButton
            etiqueta={a.etiqueta}
            aria-label={a.nombre ?? a.etiqueta}
            aria-pressed={undefined}
            mostrarEtiqueta
            icono={a.icono}
            activo={a.activo}
            tono={a.tono}
            tamano="md"
            disabled={a.desactivado}
            onClick={a.onClick}
            className={cn(a.desactivado && 'pointer-events-none opacity-45')}
          />
        )
        return (
          <motion.div
            key={a.id}
            initial={reducir ? false : { opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...resorte.agil, delay: reducir ? 0 : 0.08 + escalonado(i, 0.04) }}
          >
            {a.menu ? (
              <Menu.Root open={menuAbierto} onOpenChange={setMenuAbierto} modal={false}>
                <Menu.Trigger asChild>{boton}</Menu.Trigger>
                <AnimatePresence>
                  {menuAbierto ? (
                    <Menu.Portal forceMount>
                      <Menu.Content asChild align="end" sideOffset={40} collisionPadding={12} forceMount>
                        <motion.div
                          initial={{ opacity: 0, scale: 0.92, y: -6 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96, y: -4 }}
                          transition={resorte.modal}
                          style={{ transformOrigin: 'var(--radix-dropdown-menu-content-transform-origin)' }}
                          className="glass glass-strong z-50 w-64 rounded-module p-2 shadow-glass-lg outline-none"
                        >
                          <p className="px-3 pb-1 pt-2 text-xs font-medium text-fg-subtle">Cambiar estado</p>
                          {puedeEnviar ? (
                            <Opcion icono={<Send />} onSelect={() => en.marcar('enviada')}>
                              Marcar como enviada
                            </Opcion>
                          ) : null}
                          {puedeAceptar ? (
                            <Opcion icono={<CheckCircle2 />} onSelect={() => en.marcar('aceptada')}>
                              Marcar como aceptada
                            </Opcion>
                          ) : null}
                          {puedeRechazar ? (
                            <Opcion icono={<XCircle />} onSelect={en.rechazar}>
                              Marcar como rechazada…
                            </Opcion>
                          ) : null}
                          {!puedeEnviar && !puedeAceptar && !puedeRechazar ? (
                            <p className="px-3 pb-2 pt-1 text-sm text-fg-muted">
                              {esPedido ? `Ya es el pedido ${c.pedido_folio ?? ''}: los cambios se hacen en el pedido.` : 'No hay cambios de estado disponibles.'}
                            </p>
                          ) : null}
                          {puedeEliminar ? (
                            <>
                              <Menu.Separator className="hairline mx-2 my-1.5" />
                              <Opcion icono={<Trash2 />} onSelect={en.eliminar} peligro>
                                Eliminar borrador…
                              </Opcion>
                            </>
                          ) : null}
                        </motion.div>
                      </Menu.Content>
                    </Menu.Portal>
                  ) : null}
                </AnimatePresence>
              </Menu.Root>
            ) : (
              boton
            )}
          </motion.div>
        )
      })}
    </div>
  )
}

function Opcion({ icono, children, onSelect, peligro }: { icono: ReactNode; children: ReactNode; onSelect: () => void; peligro?: boolean }) {
  return (
    <Menu.Item
      onSelect={onSelect}
      className={cn(
        'flex h-11 cursor-pointer items-center gap-3 rounded-full px-3 text-sm font-medium outline-none transition-colors [&_svg]:size-4 [&_svg]:shrink-0',
        peligro ? 'text-danger data-[highlighted]:bg-danger-soft' : 'text-fg data-[highlighted]:bg-[var(--control-bg-hover)]',
      )}
    >
      {icono}
      {children}
    </Menu.Item>
  )
}
