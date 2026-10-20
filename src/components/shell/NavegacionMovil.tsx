import { CalendarDays, FileText, Hammer, LayoutDashboard, LayoutGrid, Package, Plus } from 'lucide-react'
import { LayoutGroup, motion } from 'motion/react'
import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { GlassIconButton, GlassModal } from '@/components/glass'
import { escalonado, resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { CuadriculaAcciones } from './CuadriculaAcciones'
import { moduloDeRuta, useModulosVisibles } from './usarModulos'

type PestanaMovil = { ruta: string; titulo: string; icono: typeof Package }

const INICIO: PestanaMovil = { ruta: '/', titulo: 'Inicio', icono: LayoutDashboard }
const PEDIDOS: PestanaMovil = { ruta: '/pedidos', titulo: 'Pedidos', icono: Package }
/** Segunda pestaña: la primera de estas que el rol pueda abrir (diseño y producción no cotizan). */
const SEGUNDA: PestanaMovil[] = [
  { ruta: '/cotizaciones', titulo: 'Cotizar', icono: FileText },
  { ruta: '/produccion', titulo: 'Producción', icono: Hammer },
  { ruta: '/agenda', titulo: 'Agenda', icono: CalendarDays },
]

/** Barra inferior flotante para celular, con botón central de acciones rápidas. */
export function NavegacionMovil() {
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const [acciones, setAcciones] = useState(false)
  const [mas, setMas] = useState(false)
  const modulos = useModulosVisibles()
  const actual = moduloDeRuta(pathname)
  const visibles = new Set(modulos.map((m) => m.ruta))
  const pestanas = [INICIO, SEGUNDA.find((p) => visibles.has(p.ruta)) ?? SEGUNDA[2], PEDIDOS]
  const enPestana = pestanas.some((p) => p.ruta === actual?.ruta)

  const Pestana = ({ ruta, titulo, icono: Icono }: PestanaMovil) => {
    const activo = actual?.ruta === ruta
    return (
      <NavLink
        to={ruta}
        end={ruta === '/'}
        className={cn(
          'relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-2xs font-semibold outline-none',
          activo ? 'text-fg' : 'text-fg-muted',
        )}
      >
        {activo ? (
          <motion.span layoutId="tab-activa" transition={resorte.agil} className="absolute inset-1 -z-10 rounded-full bg-[var(--control-bg-hover)] shadow-[inset_0_1px_0_var(--inner-hi)]" />
        ) : null}
        <Icono className={cn('size-[1.35rem]', activo && 'text-accent dark:text-navy-200')} aria-hidden />
        {titulo}
      </NavLink>
    )
  }

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className="no-print fixed inset-x-3 bottom-[calc(0.75rem+var(--safe-bottom))] z-30 md:hidden"
      >
        <LayoutGroup id="tabs-movil">
          <div className="glass glass-strong flex h-[4.25rem] items-center gap-1 rounded-full px-1.5 shadow-glass-lg">
            <Pestana {...pestanas[0]} />
            <Pestana {...pestanas[1]} />
            <div className="grid w-16 shrink-0 place-items-center">
              <GlassIconButton etiqueta="Acciones rápidas" icono={<Plus />} activo tono="luz" tamano="md" onClick={() => setAcciones(true)} />
            </div>
            <Pestana {...pestanas[2]} />
            <button
              type="button"
              onClick={() => setMas(true)}
              className={cn(
                'relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-2xs font-semibold outline-none',
                !enPestana ? 'text-fg' : 'text-fg-muted',
              )}
            >
              {!enPestana ? (
                <motion.span layoutId="tab-activa" transition={resorte.agil} className="absolute inset-1 -z-10 rounded-full bg-[var(--control-bg-hover)] shadow-[inset_0_1px_0_var(--inner-hi)]" />
              ) : null}
              <LayoutGrid className="size-[1.35rem]" aria-hidden />
              Más
            </button>
          </div>
        </LayoutGroup>
      </nav>

      <GlassModal abierto={acciones} onCambio={setAcciones} titulo="Acciones rápidas">
        <CuadriculaAcciones onAccion={() => setAcciones(false)} className="pb-2 pt-2" />
      </GlassModal>

      <GlassModal abierto={mas} onCambio={setMas} titulo="Todos los módulos">
        <div className="grid grid-cols-3 gap-3 pb-2 pt-1">
          {modulos.map((m, i) => {
            const Icono = m.icono
            const activo = actual?.ruta === m.ruta
            return (
              <motion.button
                key={m.ruta}
                type="button"
                initial={{ opacity: 0, y: 10, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ ...resorte.agil, delay: escalonado(i, 0.025) }}
                whileTap={{ scale: 0.94 }}
                onClick={() => {
                  setMas(false)
                  navegar(m.ruta)
                }}
                className={cn(
                  'glass glass-thick flex aspect-square flex-col items-center justify-center gap-2 rounded-tile text-xs font-semibold outline-none',
                  activo ? 'glass-on-accent' : 'text-fg',
                )}
              >
                <Icono className="size-7" aria-hidden strokeWidth={1.75} />
                {m.titulo}
              </motion.button>
            )
          })}
        </div>
      </GlassModal>
    </>
  )
}
