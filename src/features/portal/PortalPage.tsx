import { Link2Off, RefreshCw, WifiOff } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { EstadoVacio, GlassButton, GlassPanel, LightField, Skeleton } from '@/components/glass'
import { AvisoDemo } from '@/components/shell/AvisoDemo'
import { BotonTema } from '@/components/shell/BotonTema'
import { Marca } from '@/components/shell/Marca'
import { ENLACE_NO_VALIDO } from '@/data/modulos/portal/contrato'
import { resorte } from '@/lib/motion'
import { MENSAJE_ENLACE, useVistaPortal } from './consultas'
import { VistaCotizacion } from './VistaCotizacion'
import { VistaPedido } from './VistaPedido'

const PruebaBoton = import.meta.env.DEV ? lazy(() => import('./PruebaBoton')) : null

/**
 * Portal del cliente (/portal/:token): ruta PÚBLICA, fuera del menú y sin sesión.
 * Todo sale de api.portal (cliente anónimo en la app real). Errores sin filtrar información.
 */
export default function PortalPage() {
  const { token: crudo = '' } = useParams()
  if (PruebaBoton && crudo === 'prueba-boton-enlace')
    return (
      <Suspense>
        <PruebaBoton />
      </Suspense>
    )
  return <ConClientePropio crudo={crudo} />
}

/**
 * El portal usa su propio QueryClient: los datos públicos no se mezclan con la caché del equipo
 * y no se pierden cuando la sesión (si alguien del equipo la tiene abierta) limpia la caché compartida.
 */
function ConClientePropio({ crudo }: { crudo: string }) {
  const [cliente] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }))
  return (
    <QueryClientProvider client={cliente}>
      <Portal crudo={crudo} />
    </QueryClientProvider>
  )
}

function Portal({ crudo }: { crudo: string }) {
  const token = crudo.trim().slice(0, 200)
  const reducir = useReducedMotion()
  const q = useVistaPortal(token)
  const empresa = q.data?.empresa.nombre ?? 'Soluciones Impresiona'
  const folio = q.data?.pedido?.folio ?? q.data?.cotizacion?.folio

  useEffect(() => {
    const previo = document.title
    document.title = folio ? `${folio} · ${empresa}` : empresa
    return () => {
      document.title = previo
    }
  }, [folio, empresa])

  const tokenInvalido = !token || crudo.length > 200 || !/^[\w-]+$/.test(token)
  const noDisponible = tokenInvalido || (q.isError && q.error instanceof Error && q.error.message === ENLACE_NO_VALIDO)

  return (
    <div className="relative min-h-dvh px-4 pb-28 pt-5 sm:px-6 sm:pt-8 md:pb-16">
      <LightField />
      <AvisoDemo />
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-5 flex items-center justify-between gap-3 sm:mb-7">
          <Marca className="h-10 w-auto sm:h-12" />
          <BotonTema />
        </header>

        {noDisponible ? (
          <GlassPanel className="mx-auto max-w-lg rounded-sheet p-2">
            <EstadoVacio icono={<Link2Off />} titulo="Enlace no disponible" descripcion={MENSAJE_ENLACE} />
          </GlassPanel>
        ) : q.isError ? (
          <GlassPanel className="mx-auto max-w-lg rounded-sheet p-2">
            <EstadoVacio
              icono={<WifiOff />}
              titulo="No pudimos cargar tu información"
              descripcion="Revisa tu conexión a internet e inténtalo de nuevo."
              accion={
                <GlassButton variante="primario" icono={<RefreshCw />} onClick={() => q.refetch()} cargando={q.isFetching}>
                  Intentar de nuevo
                </GlassButton>
              }
            />
          </GlassPanel>
        ) : !q.data ? (
          <Esqueleto />
        ) : (
          <motion.main initial={reducir ? { opacity: 0 } : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={resorte.suave}>
            {/* Una cotización ya convertida muestra el avance de su pedido: el cliente sigue con el mismo enlace y ahí aprueba los diseños */}
            {q.data.pedido ? (
              <VistaPedido token={token} vista={q.data} />
            ) : q.data.tipo === 'cotizacion' && q.data.cotizacion ? (
              <VistaCotizacion token={token} vista={q.data} />
            ) : (
              <GlassPanel className="mx-auto max-w-lg rounded-sheet p-2">
                <EstadoVacio icono={<Link2Off />} titulo="Enlace no disponible" descripcion={MENSAJE_ENLACE} />
              </GlassPanel>
            )}
            <p className="mt-8 text-center text-xs text-fg-subtle">
              {empresa}
              {q.data.empresa.ciudad ? ` · ${q.data.empresa.ciudad}` : ''} · Este enlace es personal; no lo compartas.
            </p>
          </motion.main>
        )}
      </div>
    </div>
  )
}

function Esqueleto() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]" aria-busy="true" aria-label="Cargando">
      <div className="grid gap-4">
        <Skeleton className="h-72 rounded-sheet" />
        <Skeleton className="h-64 rounded-module" />
      </div>
      <div className="grid content-start gap-4">
        <Skeleton className="h-48 rounded-module" />
        <Skeleton className="h-56 rounded-module" />
      </div>
    </div>
  )
}
