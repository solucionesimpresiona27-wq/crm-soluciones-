import * as Menu from '@radix-ui/react-dropdown-menu'
import { LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSesion } from '@/app/sesion'
import { useTema, type Tema } from '@/app/tema'
import { NOMBRE_ROL } from '@/lib/permisos'
import { resorte } from '@/lib/motion'
import { cn, iniciales } from '@/lib/utils'

const temas: Array<{ valor: Tema; etiqueta: string; icono: typeof Sun }> = [
  { valor: 'claro', etiqueta: 'Claro', icono: Sun },
  { valor: 'oscuro', etiqueta: 'Oscuro', icono: Moon },
  { valor: 'sistema', etiqueta: 'Automático', icono: Monitor },
]

export function MenuUsuario() {
  const { sesion, cerrar } = useSesion()
  const { tema, cambiar } = useTema()
  const [abierto, setAbierto] = useState(false)
  const navegar = useNavigate()
  if (!sesion) return null

  return (
    <Menu.Root open={abierto} onOpenChange={setAbierto}>
      <Menu.Trigger asChild>
        <button
          type="button"
          aria-label="Menú de usuario"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-navy-500 to-navy-700 text-sm font-bold text-white shadow-[0_6px_16px_-6px_rgba(14,28,48,0.6),inset_0_1px_0_rgba(255,255,255,0.35)] outline-none transition-transform duration-300 ease-spring hover:scale-105 active:scale-95 pointer-coarse:size-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--focus-outline))]"
        >
          {iniciales(sesion.perfil.nombre)}
        </button>
      </Menu.Trigger>
      <AnimatePresence>
        {abierto ? (
          <Menu.Portal forceMount>
            <Menu.Content asChild align="end" sideOffset={10} forceMount>
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -4 }}
                transition={resorte.modal}
                style={{ transformOrigin: 'var(--radix-dropdown-menu-content-transform-origin)' }}
                className="glass glass-strong z-50 w-64 rounded-module p-2 shadow-glass-lg outline-none"
              >
                <div className="px-3 pb-3 pt-2">
                  <p className="truncate text-sm font-semibold text-fg">{sesion.perfil.nombre}</p>
                  <p className="truncate text-xs text-fg-muted">{NOMBRE_ROL[sesion.perfil.rol]}</p>
                  <p className="truncate text-xs text-fg-subtle">{sesion.email}</p>
                </div>
                <div className="hairline mx-2" />
                <p className="px-3 pb-1 pt-3 text-xs font-medium text-fg-subtle">Apariencia</p>
                <div className="grid grid-cols-3 gap-1 px-1 pb-2">
                  {temas.map((t) => {
                    const Icono = t.icono
                    return (
                      <Menu.Item
                        key={t.valor}
                        onSelect={(e) => {
                          e.preventDefault()
                          cambiar(t.valor)
                        }}
                        className={cn(
                          'flex cursor-pointer flex-col items-center gap-1 rounded-control px-2 py-2 text-xs font-medium outline-none transition-colors',
                          tema === t.valor ? 'bg-luz/25 text-fg' : 'text-fg-muted data-[highlighted]:bg-[var(--control-bg)]',
                        )}
                      >
                        <Icono className="size-4" aria-hidden />
                        {t.etiqueta}
                      </Menu.Item>
                    )
                  })}
                </div>
                <div className="hairline mx-2" />
                <Menu.Item
                  onSelect={async () => {
                    await cerrar()
                    navegar('/login', { replace: true })
                  }}
                  className="mt-1 flex min-h-11 cursor-pointer items-center gap-3 rounded-full px-3 py-2.5 text-sm font-medium text-danger outline-none data-[highlighted]:bg-danger-soft"
                >
                  <LogOut className="size-4" aria-hidden />
                  Cerrar sesión
                </Menu.Item>
              </motion.div>
            </Menu.Content>
          </Menu.Portal>
        ) : null}
      </AnimatePresence>
    </Menu.Root>
  )
}
