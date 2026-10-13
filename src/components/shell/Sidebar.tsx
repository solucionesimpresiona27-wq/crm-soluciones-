import * as Tooltip from '@radix-ui/react-tooltip'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { NavLink, useLocation } from 'react-router-dom'
import { GRUPOS } from '@/app/navegacion'
import { useSesion } from '@/app/sesion'
import { GlassIconButton } from '@/components/glass'
import { NOMBRE_ROL } from '@/lib/permisos'
import { resorte } from '@/lib/motion'
import { cn, iniciales } from '@/lib/utils'
import { Marca } from './Marca'
import { moduloDeRuta, useModulosVisibles } from './usarModulos'

export const ANCHO_SIDEBAR = { abierto: 272, cerrado: 88 }

/** Menú lateral de cristal flotante. Se contrae a una barra de íconos. */
export function Sidebar({ contraido, onAlternar }: { contraido: boolean; onAlternar: () => void }) {
  const modulos = useModulosVisibles()
  const { pathname } = useLocation()
  const actual = moduloDeRuta(pathname)
  const { sesion } = useSesion()
  const reducir = useReducedMotion()

  return (
    <Tooltip.Provider delayDuration={250}>
      <aside
        aria-label="Menú principal"
        className="glass glass-strong fixed bottom-3 left-3 top-3 z-30 hidden flex-col overflow-hidden rounded-sheet md:flex"
        style={{
          width: contraido ? ANCHO_SIDEBAR.cerrado : ANCHO_SIDEBAR.abierto,
          transition: reducir ? undefined : 'width 0.5s var(--ease-spring-soft)',
        }}
      >
        <div className={cn('flex h-[4.5rem] shrink-0 items-center', contraido ? 'justify-center px-0' : 'px-5')}>
          <AnimatePresence mode="wait" initial={false}>
            {contraido ? (
              <motion.div key="iso" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={resorte.agil}>
                <Marca variante="isotipo" className="h-9 w-auto" />
              </motion.div>
            ) : (
              <motion.div key="logo" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={resorte.agil}>
                <Marca className="h-10 w-auto" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3">
          <LayoutGroup id="sidebar">
            {GRUPOS.map((grupo) => {
              const items = modulos.filter((m) => m.grupo === grupo)
              if (!items.length) return null
              return (
                <div key={grupo} className="mt-3 first:mt-0">
                  <p
                    className={cn(
                      'mb-1 h-5 px-3 text-xs font-medium text-fg-subtle transition-opacity duration-200',
                      contraido && 'opacity-0',
                    )}
                    aria-hidden={contraido}
                  >
                    {grupo}
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {items.map((m) => {
                      const Icono = m.icono
                      const activo = actual?.ruta === m.ruta
                      const enlace = (
                        <NavLink
                          to={m.ruta}
                          end={m.ruta === '/'}
                          aria-current={activo ? 'page' : undefined}
                          className={cn(
                            'group relative flex h-11 items-center gap-3 rounded-full px-3 text-sm font-medium outline-none transition-colors',
                            activo ? 'text-fg' : 'text-fg-muted hover:text-fg',
                            contraido && 'justify-center px-0',
                          )}
                        >
                          {activo ? (
                            <motion.span
                              layoutId="nav-activo"
                              transition={resorte.agil}
                              className="glass glass-thick absolute inset-0 -z-10 rounded-full"
                              style={{ background: 'var(--control-bg-hover)' }}
                            />
                          ) : (
                            <span className="absolute inset-0 -z-10 rounded-full bg-[var(--control-bg)] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                          )}
                          <Icono className={cn('size-5 shrink-0', activo && 'text-accent dark:text-navy-200')} aria-hidden />
                          <span className={cn('truncate transition-opacity duration-200', contraido && 'sr-only')}>{m.titulo}</span>
                          {activo && !contraido ? <span className="ml-auto size-1.5 rounded-full bg-luz shadow-[0_0_10px_rgba(249,194,6,0.9)]" aria-hidden /> : null}
                        </NavLink>
                      )
                      return (
                        <li key={m.ruta}>
                          {contraido ? (
                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>{enlace}</Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content side="right" sideOffset={14} className="glass glass-strong z-50 rounded-full px-3 py-1.5 text-xs font-semibold text-fg">
                                  {m.titulo}
                                </Tooltip.Content>
                              </Tooltip.Portal>
                            </Tooltip.Root>
                          ) : (
                            enlace
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </LayoutGroup>
        </nav>

        <div className={cn('flex shrink-0 items-center gap-3 border-t border-[var(--divider)] p-3', contraido && 'flex-col')}>
          {sesion ? (
            <div className={cn('flex min-w-0 flex-1 items-center gap-3', contraido && 'justify-center')}>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-navy-500 to-navy-700 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                {iniciales(sesion.perfil.nombre)}
              </span>
              {!contraido ? (
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-fg">{sesion.perfil.nombre}</span>
                  <span className="block truncate text-xs text-fg-subtle">{NOMBRE_ROL[sesion.perfil.rol]}</span>
                </span>
              ) : null}
            </div>
          ) : null}
          <GlassIconButton
            etiqueta={contraido ? 'Expandir menú' : 'Contraer menú'}
            icono={contraido ? <PanelLeftOpen /> : <PanelLeftClose />}
            tamano="sm"
            onClick={onAlternar}
          />
        </div>
      </aside>
    </Tooltip.Provider>
  )
}
