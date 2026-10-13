import * as Tooltip from '@radix-ui/react-tooltip'
import { FilePlus2, FileSearch, Lock, Plus, RotateCcw, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useSesion } from '@/app/sesion'
import { EstadoVacio, GlassButton, GlassInput, GlassPanel, SegmentedControl } from '@/components/glass'
import { useDebounce } from '@/hooks/useDebounce'
import { useEsEscritorio } from '@/hooks/useMediaQuery'
import { hoyISO } from '@/lib/format'
import { normalizar } from '@/lib/utils'
import { useCotizaciones, useDuplicarCotizacion } from './consultas'
import { FILTROS, coincideFiltro, esFiltro, prepararFilas, resumir, type FilaCotizacion, type Filtro } from './lista/datos'
import { EsqueletoLista } from './lista/EsqueletoLista'
import { ResumenCargando, ResumenCotizaciones } from './lista/ResumenCotizaciones'
import { TablaCotizaciones, type AccionesLista } from './lista/TablaCotizaciones'
import { TarjetasCotizaciones } from './lista/TarjetasCotizaciones'
import { useSeguimientoWhatsApp } from './lista/useSeguimientoWhatsApp'

const POR_PAGINA = 50

export default function CotizacionesPage() {
  const { puede } = useSesion()
  if (!puede('ver_precios')) return <SinAcceso />
  return <ListaCotizaciones />
}

function SinAcceso() {
  const navegar = useNavigate()
  return (
    <GlassPanel className="mt-2">
      <EstadoVacio
        icono={<Lock />}
        titulo="Las cotizaciones son para ventas y administración"
        descripcion="Tu rol no incluye precios. Si necesitas consultar una cotización, pide acceso al administrador."
        accion={
          <GlassButton variante="cristal" onClick={() => navegar('/')}>
            Ir al inicio
          </GlassButton>
        }
      />
    </GlassPanel>
  )
}

function ListaCotizaciones() {
  const { puede } = useSesion()
  const navegar = useNavigate()
  const { search } = useLocation()
  const escritorio = useEsEscritorio()
  const consulta = useCotizaciones()
  const duplicar = useDuplicarCotizacion()
  const seguimiento = useSeguimientoWhatsApp()
  const gestionar = puede('gestionar_cotizaciones')
  const hoy = useMemo(() => hoyISO(), [])

  // Filtro, búsqueda y "por vencer" viven en la URL: al volver del detalle se conservan.
  const [params, setParams] = useSearchParams()
  const estadoParam = params.get('estado')
  const filtro: Filtro = esFiltro(estadoParam) ? estadoParam : 'todas'
  const porVencerActivo = params.get('vencen') === '1'
  const [busqueda, setBusqueda] = useState(() => params.get('q') ?? '')
  const busquedaUrl = useDebounce(busqueda, 350)
  const [limite, setLimite] = useState(POR_PAGINA)

  const actualizar = (cambios: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(cambios)) {
          if (v === null || v === '') n.delete(k)
          else n.set(k, v)
        }
        return n
      },
      { replace: true },
    )

  useEffect(() => {
    if ((params.get('q') ?? '') !== busquedaUrl.trim()) actualizar({ q: busquedaUrl.trim() || null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busquedaUrl])

  useEffect(() => setLimite(POR_PAGINA), [filtro, busqueda, porVencerActivo])

  const filas = useMemo(() => prepararFilas(consulta.data ?? [], hoy), [consulta.data, hoy])
  const resumen = useMemo(() => resumir(filas, hoy), [filas, hoy])
  const texto = normalizar(busqueda)

  const { visibles, conteos } = useMemo(() => {
    let base = texto ? filas.filter((f) => f.busqueda.includes(texto)) : filas
    if (porVencerActivo) base = base.filter((f) => f.porVencer)
    const conteos = Object.fromEntries(FILTROS.map((x) => [x.valor, base.filter((f) => coincideFiltro(f, x.valor)).length])) as Record<Filtro, number>
    let visibles = base.filter((f) => coincideFiltro(f, filtro))
    if (porVencerActivo) visibles = [...visibles].sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))
    return { visibles, conteos }
  }, [filas, texto, porVencerActivo, filtro])

  const mostradas = visibles.slice(0, limite)
  const nombreFiltro = FILTROS.find((x) => x.valor === filtro)?.etiqueta ?? 'Todas'
  const descripcion = `Cotizaciones: ${nombreFiltro.toLowerCase()}${porVencerActivo ? ', por vencer' : ''}${texto ? `, búsqueda “${busqueda.trim()}”` : ''}`

  const rutaDetalle = (f: FilaCotizacion) => ({ pathname: `/cotizaciones/${f.id}`, state: { lista: search } })
  const acciones: AccionesLista = {
    rutaDetalle,
    abrir: (f) => {
      const r = rutaDetalle(f)
      navegar(r.pathname, { state: r.state })
    },
    seguimiento: gestionar ? seguimiento : undefined,
    duplicar: gestionar
      ? async (f) => {
          try {
            const nuevo = await duplicar.mutateAsync(f.id)
            toast.success(`Copia de ${f.folio} creada como borrador`)
            navegar(`/cotizaciones/${nuevo}`, { state: { lista: search } })
          } catch {
            /* el hook ya muestra el error */
          }
        }
      : undefined,
    duplicando: duplicar.isPending ? (duplicar.variables ?? null) : null,
  }

  const limpiar = () => {
    setBusqueda('')
    actualizar({ q: null, estado: null, vencen: null })
  }

  // "Por vencer" solo aplica a enviadas: si el filtro actual las excluye, se vuelve a "Todas".
  const cambiarPorVencer = (activo: boolean) =>
    actualizar(activo && filtro !== 'enviadas' ? { vencen: '1', estado: null } : { vencen: activo ? '1' : null })

  const nuevaCotizacion = gestionar ? (
    <GlassButton variante="primario" icono={<Plus />} onClick={() => navegar('/cotizaciones/nueva')}>
      Nueva cotización
    </GlassButton>
  ) : null

  return (
    <Tooltip.Provider delayDuration={350}>
      <div className="flex flex-col gap-4 pt-1">
        {consulta.isPending ? (
          <ResumenCargando />
        ) : consulta.data && consulta.data.length > 0 ? (
          <ResumenCotizaciones resumen={resumen} porVencerActivo={porVencerActivo} onPorVencer={cambiarPorVencer} />
        ) : null}

        {consulta.data?.length !== 0 || consulta.isPending ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
            <SegmentedControl
              etiqueta="Filtrar por estado"
              segmentos={FILTROS.map((x) => ({ valor: x.valor, etiqueta: x.etiqueta, conteo: consulta.data ? conteos[x.valor] : undefined }))}
              valor={filtro}
              onCambio={(v) => actualizar({ estado: v === 'todas' ? null : v })}
              className="w-full shrink-0 sm:w-auto"
            />
            <div className="flex min-w-[15rem] flex-1 items-center gap-2 lg:max-w-sm xl:ml-auto">
              <div className="min-w-0 flex-1">
                <GlassInput
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && busqueda) {
                      e.preventDefault()
                      setBusqueda('')
                    }
                  }}
                  placeholder="Buscar folio, cliente o título"
                  aria-label="Buscar cotizaciones por folio, cliente o título"
                  icono={<Search />}
                  className="rounded-full"
                  autoComplete="off"
                  enterKeyHint="search"
                />
              </div>
              {gestionar ? (
                <GlassButton
                  variante="primario"
                  icono={<Plus />}
                  aria-label="Nueva cotización"
                  onClick={() => navegar('/cotizaciones/nueva')}
                  className="sm:hidden"
                >
                  Nueva
                </GlassButton>
              ) : null}
            </div>
          </div>
        ) : null}

        <p role="status" className="sr-only">
          {consulta.data ? `${visibles.length} ${visibles.length === 1 ? 'cotización' : 'cotizaciones'}` : ''}
        </p>

        {consulta.isPending ? (
          <EsqueletoLista escritorio={escritorio} />
        ) : consulta.isError ? (
          <GlassPanel>
            <EstadoVacio
              icono={<FileSearch />}
              titulo="No se pudieron cargar las cotizaciones"
              descripcion={`${consulta.error.message}. Revisa tu conexión e inténtalo de nuevo.`}
              accion={
                <GlassButton icono={<RotateCcw />} onClick={() => void consulta.refetch()}>
                  Reintentar
                </GlassButton>
              }
            />
          </GlassPanel>
        ) : filas.length === 0 ? (
          <GlassPanel>
            <EstadoVacio
              icono={<FilePlus2 />}
              titulo="Todavía no hay cotizaciones"
              descripcion="Arma la primera con la calculadora de precios y envíala al cliente por WhatsApp en PDF."
              accion={nuevaCotizacion}
            />
          </GlassPanel>
        ) : visibles.length === 0 ? (
          <GlassPanel>
            <EstadoVacio
              icono={<FileSearch />}
              titulo={texto ? `Nada coincide con “${busqueda.trim()}”` : porVencerActivo ? 'Ninguna vence pronto en este filtro' : `Sin cotizaciones ${nombreFiltro.toLowerCase()}`}
              descripcion={
                texto
                  ? 'Prueba con el folio (COT-0012), el nombre del cliente o una palabra del título.'
                  : 'Cambia el filtro para ver el resto de las cotizaciones.'
              }
              accion={
                <div className="flex flex-wrap justify-center gap-2">
                  <GlassButton variante="cristal" icono={<RotateCcw />} onClick={limpiar}>
                    Ver todas
                  </GlassButton>
                  {texto ? nuevaCotizacion : null}
                </div>
              }
            />
          </GlassPanel>
        ) : escritorio ? (
          <GlassPanel className="p-2">
            <TablaCotizaciones filas={mostradas} hoy={hoy} acciones={acciones} descripcion={descripcion} />
          </GlassPanel>
        ) : (
          <TarjetasCotizaciones filas={mostradas} hoy={hoy} acciones={acciones} descripcion={descripcion} />
        )}

        {visibles.length > limite ? (
          <div className="flex justify-center">
            <GlassButton variante="cristal" onClick={() => setLimite((l) => l + POR_PAGINA)}>
              Mostrar {Math.min(POR_PAGINA, visibles.length - limite)} más
            </GlassButton>
          </div>
        ) : null}
      </div>
    </Tooltip.Provider>
  )
}
