import { Plus, Search } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSesion } from '@/app/sesion'
import { GlassButton } from '@/components/glass'
import { BotonTema } from './BotonTema'
import { Marca } from './Marca'
import { MenuUsuario } from './MenuUsuario'
import { moduloDeRuta } from './usarModulos'

/** Barra superior: título del módulo, búsqueda global y accesos personales. */
export function Topbar({ onBuscar }: { onBuscar: () => void }) {
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const { puede } = useSesion()
  const modulo = moduloDeRuta(pathname)
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  return (
    <header className="no-print sticky top-0 z-20 -mx-1 px-1 pb-3 pt-3">
      <div className="glass flex h-16 items-center gap-2 rounded-full pl-3 pr-2 md:pl-5">
        <Marca variante="isotipo" className="h-8 w-auto md:hidden" />
        <h1 className="min-w-0 flex-1 truncate text-md font-semibold tracking-tight text-fg md:text-lg">
          {modulo?.titulo ?? 'Soluciones Impresiona'}
        </h1>

        <button
          type="button"
          onClick={onBuscar}
          className="hidden h-11 w-72 items-center gap-2.5 rounded-full bg-[var(--field-bg)] px-4 text-sm text-fg-subtle shadow-[inset_0_0_0_1px_rgb(var(--line)/0.08)] outline-none transition-colors hover:text-fg-muted lg:flex focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--focus-outline))]"
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1 text-left">Buscar clientes, folios…</span>
          <kbd className="rounded-md bg-fg/[0.06] px-1.5 py-0.5 text-2xs font-semibold text-fg-subtle">{mac ? '⌘' : 'Ctrl'} K</kbd>
        </button>
        <button
          type="button"
          onClick={onBuscar}
          aria-label="Buscar"
          className="grid size-10 shrink-0 place-items-center rounded-full text-fg-muted pointer-coarse:size-11 outline-none transition-colors hover:bg-[var(--control-bg)] hover:text-fg lg:hidden"
        >
          <Search className="size-5" aria-hidden />
        </button>

        {puede('gestionar_cotizaciones') && !pathname.startsWith('/cotizaciones/nueva') ? (
          <GlassButton
            variante="primario"
            tamano="sm"
            icono={<Plus />}
            onClick={() => navegar('/cotizaciones/nueva')}
            className="hidden h-11 px-4 sm:inline-flex"
          >
            Nueva cotización
          </GlassButton>
        ) : null}
        <BotonTema />
        <MenuUsuario />
      </div>
    </header>
  )
}
