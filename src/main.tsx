import '@fontsource-variable/figtree'
import './styles/index.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
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
      offset={20}
      toastOptions={{
        classNames: {
          toast: 'glass glass-strong !rounded-full !border-0 !px-5 !py-3.5 !text-fg !shadow-glass-lg font-sans',
          title: '!text-sm !font-semibold',
          description: '!text-xs !text-fg-muted',
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
