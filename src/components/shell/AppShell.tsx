import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Suspense, useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSesion } from '@/app/sesion'
import { LightField, Skeleton } from '@/components/glass'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { AvisoDemo } from './AvisoDemo'
import { NavegacionMovil } from './NavegacionMovil'
import { PaletaComandos } from './PaletaComandos'
import { ANCHO_SIDEBAR, Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

const CLAVE = 'impresiona:menu-contraido'

function CargandoPagina() {
  return (
    <div className="grid gap-4 pt-2 md:grid-cols-2 xl:grid-cols-4" aria-label="Cargando" role="status">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-36 rounded-module" />
      ))}
      <Skeleton className="h-80 rounded-sheet md:col-span-2 xl:col-span-4" />
    </div>
  )
}

/** Estructura de la app: campo de luz, menú lateral, barra superior y contenido con transición. */
export function AppShell() {
  const { sesion, cargando } = useSesion()
  const { pathname } = useLocation()
  const reducir = useReducedMotion()
  const tablet = useMediaQuery('(min-width: 768px) and (max-width: 1279px)')
  const [preferencia, setPreferencia] = useState<boolean | null>(() => {
    try {
      const v = localStorage.getItem(CLAVE)
      return v === null ? null : v === '1'
    } catch {
      return null
    }
  })
  const contraido = preferencia ?? tablet
  const [buscar, setBuscar] = useState(false)

  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setBuscar((v) => !v)
      }
    }
    window.addEventListener('keydown', atajo)
    return () => window.removeEventListener('keydown', atajo)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  if (cargando) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <LightField />
        <div className="glass size-16 animate-pulse rounded-full" role="status" aria-label="Cargando" />
      </div>
    )
  }
  if (!sesion) return <Navigate to="/login" replace state={{ desde: pathname }} />

  const alternar = () => {
    const nuevo = !contraido
    setPreferencia(nuevo)
    try {
      localStorage.setItem(CLAVE, nuevo ? '1' : '0')
    } catch {
      /* preferencia solo para esta visita */
    }
  }

  const margen = contraido ? ANCHO_SIDEBAR.cerrado : ANCHO_SIDEBAR.abierto

  return (
    <div className="min-h-dvh">
      <LightField />
      <AvisoDemo />
      <Sidebar contraido={contraido} onAlternar={alternar} />
      <div
        className="min-h-dvh px-3 pb-28 md:pb-8 md:pr-4 md:[padding-left:calc(var(--menu)+1.5rem)]"
        style={{
          ['--menu' as string]: `${margen}px`,
          transition: reducir ? undefined : 'padding-left 0.5s var(--ease-spring-soft)',
        }}
      >
        <div className="mx-auto w-full max-w-[1480px]">
          <Topbar onBuscar={() => setBuscar(true)} />
          <AnimatePresence mode="wait" initial={false}>
            <motion.main
              key={pathname.split('/').slice(0, 3).join('/')}
              id="contenido"
              initial={reducir ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducir ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <Suspense fallback={<CargandoPagina />}>
                <Outlet />
              </Suspense>
            </motion.main>
          </AnimatePresence>
        </div>
      </div>
      <NavegacionMovil />
      <PaletaComandos abierto={buscar} onCambio={setBuscar} />
    </div>
  )
}
