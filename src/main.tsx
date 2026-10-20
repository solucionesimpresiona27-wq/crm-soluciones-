import '@fontsource-variable/figtree'
import './styles/index.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { StrictMode, type CSSProperties } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { clienteConsultas } from './app/consultas'
import { router } from './app/rutas'
import { ProveedorSesion } from './app/sesion'
import { ProveedorTema, useTema } from './app/tema'
import { LensFilterDefs, detectarLente } from './components/glass'

if (detectarLente()) document.documentElement.classList.add('lens-ready')

function Avisos() {
  const { efectivo } = useTema()
  return (
    <Toaster
      theme={efectivo === 'oscuro' ? 'dark' : 'light'}
      position="top-center"
      // Debajo de la barra superior (fija, 88 px con su margen) para no tapar la búsqueda ni sus botones
      offset={{ top: 88 }}
      mobileOffset={{ top: 88, left: 16, right: 16 }}
      // Sonner pinta su fondo propio (blanco o negro sólido): se cambia por cristal del tema, casi opaco
      // porque el aviso flota sobre texto cualquiera y debe conservar contraste AA
      style={
        {
          '--normal-bg': 'color-mix(in srgb, var(--glass-bg-solid) 88%, transparent)',
          '--normal-border': 'transparent',
          '--normal-text': 'rgb(var(--fg))',
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'glass glass-strong !rounded-full !border-0 !px-5 !py-3.5 !text-fg !shadow-glass-lg font-sans',
          title: '!text-sm !font-semibold',
          description: '!text-xs !text-fg-muted',
          actionButton: '!rounded-full !bg-accent !text-accent-fg !font-semibold !px-3.5 !h-8 pointer-coarse:!h-11',
          cancelButton: '!rounded-full !bg-[var(--control-bg)] !text-fg',
        },
      }}
    />
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <ProveedorTema>
        <QueryClientProvider client={clienteConsultas}>
          <ProveedorSesion>
            <LensFilterDefs />
            <RouterProvider router={router} />
            <Avisos />
          </ProveedorSesion>
        </QueryClientProvider>
      </ProveedorTema>
    </MotionConfig>
  </StrictMode>,
)
