import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'

export type Tema = 'claro' | 'oscuro' | 'sistema'
type Efectivo = 'claro' | 'oscuro'

interface ContextoTema {
  tema: Tema
  efectivo: Efectivo
  cambiar: (tema: Tema, origen?: { x: number; y: number }) => void
  alternar: (origen?: { x: number; y: number }) => void
}

const Ctx = createContext<ContextoTema | null>(null)
const CLAVE = 'impresiona:tema'

function leer(): Tema {
  try {
    const t = localStorage.getItem(CLAVE)
    return t === 'claro' || t === 'oscuro' || t === 'sistema' ? t : 'sistema'
  } catch {
    return 'sistema'
  }
}

const oscuroSistema = () => window.matchMedia('(prefers-color-scheme: dark)').matches

function aplicar(efectivo: Efectivo) {
  const html = document.documentElement
  html.dataset.theme = efectivo === 'oscuro' ? 'dark' : 'light'
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute('content', efectivo === 'oscuro' ? '#08111F' : '#E9EEF5'))
}

export function ProveedorTema({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(leer)
  const [sistemaOscuro, setSistemaOscuro] = useState(oscuroSistema)
  const efectivo: Efectivo = tema === 'sistema' ? (sistemaOscuro ? 'oscuro' : 'claro') : tema

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const cb = () => setSistemaOscuro(mql.matches)
    mql.addEventListener('change', cb)
    return () => mql.removeEventListener('change', cb)
  }, [])

  useEffect(() => aplicar(efectivo), [efectivo])

  const cambiar = useCallback((nuevo: Tema, origen?: { x: number; y: number }) => {
    try {
      localStorage.setItem(CLAVE, nuevo)
    } catch {
      /* preferencia solo para esta visita */
    }
    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } }
    if (!doc.startViewTransition || reducir) {
      setTema(nuevo)
      return
    }
    // Transición de tema: la luz se expande desde el botón que se presionó.
    const x = origen?.x ?? window.innerWidth - 40
    const y = origen?.y ?? 40
    const radio = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    const t = doc.startViewTransition(() => {
      flushSync(() => setTema(nuevo))
    })
    t.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radio}px at ${x}px ${y}px)`] },
          { duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
        )
      })
      .catch(() => undefined)
  }, [])

  const valor = useMemo<ContextoTema>(
    () => ({
      tema,
      efectivo,
      cambiar,
      alternar: (origen) => cambiar(efectivo === 'oscuro' ? 'claro' : 'oscuro', origen),
    }),
    [tema, efectivo, cambiar],
  )

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useTema() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useTema fuera de ProveedorTema')
  return c
}
