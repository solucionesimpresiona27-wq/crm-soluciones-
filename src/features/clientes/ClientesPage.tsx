import * as Tooltip from '@radix-ui/react-tooltip'
import { Download, RotateCcw, Search, UserPlus, UserSearch, Users } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useConfiguracion } from '@/app/consultas'
import { useSesion } from '@/app/sesion'
import { EstadoVacio, GlassButton, GlassInput, GlassPanel, GlassSelect, SegmentedControl, Skeleton } from '@/components/glass'
import { useDebounce } from '@/hooks/useDebounce'
import { useEsEscritorio } from '@/hooks/useMediaQuery'
import { hoyISO } from '@/lib/format'
import { useClientesInactivos, useClientesLista, useSaldosClientes } from './consultas'
import { aCsv, descargar, filtrar, prepararFilas, type Orden, type TipoFiltro } from './lista/datos'
import { Reactivar } from './lista/Reactivar'
import { TablaClientes, TarjetasClientes, type AccionesClientes } from './lista/TablaClientes'
import { NuevoClienteModal } from './NuevoClienteModal'
import { useWhatsAppCliente } from './piezas'

const POR_PAGINA = 60
type Vista = 'todos' | 'reactivar'

export default function ClientesPage() {
  const { puede } = useSesion()
  const navegar = useNavigate()
  const escritorio = useEsEscritorio()
  const gestionar = puede('gestionar_clientes')
  const conPrecios = puede('ver_precios')
  const exportar = puede('exportar_datos')
  const config = useConfiguracion()
  const diasConfig = config.data?.dias_reactivacion ?? 90

  const [params, setParams] = useSearchParams()
  const vista: Vista = gestionar && params.get('vista') === 'reactivar' ? 'reactivar' : 'todos'
  const tipo = (['empresa', 'persona'].includes(params.get('tipo') ?? '') ? params.get('tipo') : 'todos') as TipoFiltro
  const etiqueta = params.get('etiqueta') ?? ''
  const orden: Orden = params.get('orden') === 'compra' ? 'compra' : 'nombre'
  const dias = Math.max(1, Number(params.get('dias')) || diasConfig)
  const [busqueda, setBusqueda] = useState(() => params.get('q') ?? '')
  const busquedaUrl = useDebounce(busqueda, 350)
  const [limite, setLimite] = useState(POR_PAGINA)
  const [nuevo, setNuevo] = useState(false)
  const idPanel = useId()

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
  useEffect(() => setLimite(POR_PAGINA), [busqueda, tipo, etiqueta, orden])

  const lista = useClientesLista()
  const saldos = useSaldosClientes(conPrecios)
  // Conteo para la pestaña (misma consulta que la vista, se comparte en caché)
  const inactivos = useClientesInactivos(dias, gestionar)
  const wa = useWhatsAppCliente()

  const filas = useMemo(() => prepararFilas(lista.data ?? [], conPrecios ? (saldos.data ?? {}) : undefined), [lista.data, saldos.data, conPrecios])
  const etiquetas = useMemo(() => [...new Set(filas.flatMap((f) => f.etiquetas))].sort((a, b) => a.localeCompare(b, 'es')), [filas])
  const visibles = useMemo(() => filtrar(filas, { texto: busqueda, tipo, etiqueta, orden }), [filas, busqueda, tipo, etiqueta, orden])
  const mostradas = visibles.slice(0, limite)
  const hayFiltros = Boolean(busqueda.trim() || tipo !== 'todos' || etiqueta)
  const descripcion = `Clientes${tipo !== 'todos' ? (tipo === 'empresa' ? ': empresas' : ': personas') : ''}${etiqueta ? `, etiqueta ${etiqueta}` : ''}${busqueda.trim() ? `, búsqueda “${busqueda.trim()}”` : ''}`

  const acciones: AccionesClientes = {
    abrir: (f) => navegar(`/clientes/${f.id}`),
    whatsapp: (f) => wa.abrir({ nombre: f.nombre, whatsapp: f.whatsapp, telefono: f.telefono }),
  }

  const limpiar = () => {
    setBusqueda('')
    actualizar({ q: null, tipo: null, etiqueta: null })
  }

  const exportarCsv = () => {
    descargar(`clientes-${hoyISO()}.csv`, aCsv(visibles, conPrecios))
    toast.success(`${visibles.length} ${visibles.length === 1 ? 'cliente exportado' : 'clientes exportados'}`, { description: 'El archivo CSV se abre en Excel o Google Sheets.' })
  }

  const botonNuevo = gestionar ? (
    <GlassButton variante="primario" icono={<UserPlus />} onClick={() => setNuevo(true)}>
      Nuevo cliente
    </GlassButton>
  ) : null
  const botonNuevoCompacto = gestionar ? (
    <GlassButton variante="primario" icono={<UserPlus />} onClick={() => setNuevo(true)} aria-label="Nuevo cliente">
      <span className="hidden sm:inline">Nuevo cliente</span>
      <span className="sm:hidden">Nuevo</span>
    </GlassButton>
  ) : null

  return (
    <Tooltip.Provider delayDuration={350}>
      <div className="flex flex-col gap-4 pt-1">
        <div className="flex items-center gap-x-3">
          {gestionar ? (
            <SegmentedControl
              etiqueta="Vista de clientes"
              className="min-w-0"
              valor={vista}
              onCambio={(v) => actualizar({ vista: v === 'todos' ? null : v })}
              idPanel={idPanel}
              segmentos={[
                { valor: 'todos', etiqueta: 'Todos', conteo: lista.data?.length },
                {
                  valor: 'reactivar',
                  etiqueta: (
                    <>
                      <span className="sm:hidden">Reactivar</span>
                      <span className="hidden sm:inline">Para reactivar</span>
                    </>
                  ),
                  conteo: inactivos.data?.length,
                },
              ]}
            />
          ) : (
            <h2 className="text-lg font-semibold tracking-tight text-fg">
              Clientes{lista.data ? <span className="num ml-2 text-fg-subtle">{lista.data.length}</span> : null}
            </h2>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {exportar && vista === 'todos' ? (
              <GlassButton variante="cristal" icono={<Download />} onClick={exportarCsv} disabled={!visibles.length} aria-label="Exportar clientes a CSV" className="max-sm:hidden">
                <span className="hidden sm:inline">Exportar CSV</span>
              </GlassButton>
            ) : null}
            {botonNuevoCompacto}
          </div>
        </div>

        <div id={idPanel} role={gestionar ? 'tabpanel' : undefined} aria-label={vista === 'reactivar' ? 'Clientes para reactivar' : descripcion} className="flex flex-col gap-4">
          {vista === 'reactivar' ? (
            <Reactivar dias={dias} diasConfig={diasConfig} onDias={(d) => actualizar({ dias: d === diasConfig ? null : String(d) })} conPrecios={conPrecios} escritorio={escritorio} />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
                <div className="min-w-[15rem] flex-1 lg:max-w-md">
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
                    placeholder="Buscar nombre, WhatsApp, correo o RFC"
                    aria-label="Buscar clientes por nombre, WhatsApp, correo o RFC"
                    icono={<Search />}
                    className="rounded-full"
                    autoComplete="off"
                    enterKeyHint="search"
                  />
                </div>
                <SegmentedControl
                  etiqueta="Tipo de cliente"
                  tamano="sm"
                  className="w-full sm:w-auto [&>*]:flex-1"
                  valor={tipo}
                  onCambio={(v) => actualizar({ tipo: v === 'todos' ? null : v })}
                  segmentos={[
                    { valor: 'todos', etiqueta: 'Todos' },
                    { valor: 'empresa', etiqueta: 'Empresas' },
                    { valor: 'persona', etiqueta: 'Personas' },
                  ]}
                />
                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                  <GlassSelect aria-label="Filtrar por etiqueta" value={etiqueta} onChange={(e) => actualizar({ etiqueta: e.target.value || null })} className="rounded-full sm:w-52">
                    <option value="">Etiquetas: todas</option>
                    {etiquetas.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </GlassSelect>
                  <GlassSelect aria-label="Ordenar clientes" value={orden} onChange={(e) => actualizar({ orden: e.target.value === 'compra' ? 'compra' : null })} className="rounded-full sm:w-44">
                    <option value="nombre">Nombre (A-Z)</option>
                    <option value="compra">Última compra</option>
                  </GlassSelect>
                </div>
              </div>

              <p role="status" className="sr-only">
                {lista.data ? `${visibles.length} ${visibles.length === 1 ? 'cliente' : 'clientes'}` : ''}
              </p>

              {lista.isPending ? (
                <EsqueletoClientes escritorio={escritorio} />
              ) : lista.isError ? (
                <GlassPanel>
                  <EstadoVacio
                    icono={<UserSearch />}
                    titulo="No se pudieron cargar los clientes"
                    descripcion={`${lista.error.message}. Revisa tu conexión e inténtalo de nuevo.`}
                    accion={
                      <GlassButton icono={<RotateCcw />} onClick={() => void lista.refetch()}>
                        Reintentar
                      </GlassButton>
                    }
                  />
                </GlassPanel>
              ) : filas.length === 0 ? (
                <GlassPanel>
                  <EstadoVacio
                    icono={<Users />}
                    titulo="Todavía no hay clientes"
                    descripcion="Da de alta al primero con su nombre y WhatsApp; los datos fiscales se completan después."
                    accion={botonNuevo}
                  />
                </GlassPanel>
              ) : visibles.length === 0 ? (
                <GlassPanel>
                  <EstadoVacio
                    icono={<UserSearch />}
                    titulo={busqueda.trim() ? `Nada coincide con “${busqueda.trim()}”` : 'Ningún cliente con estos filtros'}
                    descripcion={busqueda.trim() ? 'Prueba con parte del nombre, los últimos dígitos del WhatsApp o el RFC.' : 'Quita algún filtro para ver el resto.'}
                    accion={
                      <div className="flex flex-wrap justify-center gap-2">
                        <GlassButton variante="cristal" icono={<RotateCcw />} onClick={limpiar}>
                          Ver todos
                        </GlassButton>
                        {busqueda.trim() ? botonNuevo : null}
                      </div>
                    }
                  />
                </GlassPanel>
              ) : escritorio ? (
                <GlassPanel className="p-2">
                  <TablaClientes filas={mostradas} acciones={acciones} conSaldo={conPrecios} descripcion={descripcion} />
                </GlassPanel>
              ) : (
                <TarjetasClientes filas={mostradas} acciones={acciones} conSaldo={conPrecios} descripcion={descripcion} />
              )}

              {visibles.length > limite ? (
                <div className="flex justify-center">
                  <GlassButton variante="cristal" onClick={() => setLimite((l) => l + POR_PAGINA)}>
                    Mostrar {Math.min(POR_PAGINA, visibles.length - limite)} más
                  </GlassButton>
                </div>
              ) : hayFiltros && visibles.length > 0 ? (
                <p className="text-center text-sm text-fg-subtle">
                  {visibles.length} de {filas.length} clientes ·{' '}
                  <button type="button" onClick={limpiar} className="rounded-full font-medium text-accent underline-offset-2 outline-none hover:underline">
                    quitar filtros
                  </button>
                </p>
              ) : null}
            </>
          )}
        </div>

        <NuevoClienteModal abierto={nuevo} onCambio={setNuevo} nombreInicial={busqueda.trim()} onCreado={(c) => navegar(`/clientes/${c.id}`)} />
      </div>
    </Tooltip.Provider>
  )
}

function EsqueletoClientes({ escritorio }: { escritorio: boolean }) {
  if (!escritorio) {
    return (
      <div className="grid gap-2.5 md:grid-cols-2" role="status" aria-label="Cargando clientes">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[8.5rem] rounded-tile" />
        ))}
      </div>
    )
  }
  return (
    <GlassPanel className="p-2" role="status" aria-label="Cargando clientes">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-6 border-t border-[var(--divider)] px-4 py-3.5 first:border-t-0">
          <Skeleton className="size-10 rounded-[0.8rem]" />
          <div className="flex w-64 flex-col gap-1.5">
            <Skeleton className="h-4 w-48 rounded-full" />
            <Skeleton className="h-3 w-28 rounded-full" />
          </div>
          <Skeleton className="h-4 w-28 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-20 rounded-full" />
          <Skeleton className="ml-auto h-4 w-24 rounded-full" />
        </div>
      ))}
    </GlassPanel>
  )
}
