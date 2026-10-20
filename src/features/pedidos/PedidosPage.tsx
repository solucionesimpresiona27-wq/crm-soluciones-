import { AlarmClock, CalendarClock, PackageOpen, PackagePlus, PackageSearch, Plus, ReceiptText, RotateCcw, Search, Wallet } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useEquipo } from '@/app/consultas'
import { useSesion } from '@/app/sesion'
import { EstadoVacio, GlassButton, GlassInput, GlassPanel, GlassToggle, SegmentedControl, Skeleton } from '@/components/glass'
import { useDebounce } from '@/hooks/useDebounce'
import { useEsEscritorio } from '@/hooks/useMediaQuery'
import { dinero, hoyISO } from '@/lib/format'
import { normalizar } from '@/lib/utils'
import { usePedidosActivos, usePedidosCerrados } from './consultas'
import { FASES, PRIORIDAD, RAPIDOS, cumpleRapido, enFase, esFase, esRapido, prepararFilas, type Fase, type FilaPedido, type Rapido } from './lista/datos'
import { DialogoNuevoPedido } from './lista/DialogoNuevoPedido'
import { TablaPedidos } from './lista/TablaPedidos'
import { TarjetasPedidos } from './lista/TarjetasPedidos'

const POR_PAGINA = 50

/** Lista de pedidos. Con `nuevo` abre el diálogo de pedido directo (ruta /pedidos/nuevo). */
export default function PedidosPage({ nuevo = false }: { nuevo?: boolean }) {
  const { puede } = useSesion()
  const navegar = useNavigate()
  const { search } = useLocation()
  const escritorio = useEsEscritorio()
  const precios = puede('ver_precios')
  const gestionar = puede('gestionar_pedidos')
  const hoy = useMemo(() => hoyISO(), [])
  const equipo = useEquipo()
  const nombres = useMemo(() => new Map((equipo.data ?? []).map((m) => [m.id, m.nombre])), [equipo.data])

  const [params, setParams] = useSearchParams()
  const faseParam = params.get('fase')
  const fase: Fase = esFase(faseParam) ? faseParam : 'todos'
  const rapidoParam = params.get('solo')
  const rapido: Rapido | null = esRapido(rapidoParam) && (rapidoParam !== 'saldo' || precios) ? rapidoParam : null
  const [busqueda, setBusqueda] = useState(() => params.get('q') ?? '')
  const busquedaUrl = useDebounce(busqueda, 350)
  const [limite, setLimite] = useState(POR_PAGINA)
  const [dialogo, setDialogo] = useState(nuevo && gestionar)
  const idResultados = useId()

  const activos = usePedidosActivos()
  const cerrados = usePedidosCerrados(fase === 'cerrados')
  const consulta = fase === 'cerrados' ? cerrados : activos

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
  useEffect(() => setLimite(POR_PAGINA), [fase, busqueda, rapido])

  const filasActivas = useMemo(() => prepararFilas(activos.data ?? [], hoy), [activos.data, hoy])
  const filasCerradas = useMemo(
    () => prepararFilas(cerrados.data ?? [], hoy).sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [cerrados.data, hoy],
  )
  const texto = normalizar(busqueda)

  const { visibles, conteos, rapidos } = useMemo(() => {
    const buscar = (l: FilaPedido[]) => (texto ? l.filter((f) => f.busqueda.includes(texto)) : l)
    const base = buscar(filasActivas)
    const conRapido = rapido ? base.filter((f) => cumpleRapido(f, rapido)) : base
    const conteos = Object.fromEntries(FASES.map((x) => [x.valor, conRapido.filter((f) => enFase(f, x.valor)).length])) as Record<Fase, number>
    const cerr = buscar(filasCerradas)
    conteos.cerrados = (rapido ? cerr.filter((f) => cumpleRapido(f, rapido)) : cerr).length
    const fuente = fase === 'cerrados' ? (rapido ? cerr.filter((f) => cumpleRapido(f, rapido)) : cerr) : conRapido.filter((f) => enFase(f, fase))
    // Lo atrasado y urgente arriba; luego por fecha de entrega
    const visibles =
      fase === 'cerrados'
        ? fuente
        : [...fuente].sort(
            (a, b) =>
              Number(b.atrasado) - Number(a.atrasado) ||
              (a.dias ?? 9999) - (b.dias ?? 9999) ||
              PRIORIDAD[a.prioridad].orden - PRIORIDAD[b.prioridad].orden ||
              a.folio.localeCompare(b.folio),
          )
    const rapidos = Object.fromEntries(RAPIDOS.map((r) => [r, filasActivas.filter((f) => cumpleRapido(f, r))])) as Record<Rapido, FilaPedido[]>
    return { visibles, conteos, rapidos }
  }, [filasActivas, filasCerradas, texto, rapido, fase])

  const mostradas = visibles.slice(0, limite)
  const nombreFase = FASES.find((x) => x.valor === fase)?.etiqueta ?? 'Todos'
  const descripcion = `Pedidos: ${nombreFase.toLowerCase()}${rapido ? `, ${ETIQUETA_RAPIDO[rapido]}` : ''}${texto ? `, búsqueda “${busqueda.trim()}”` : ''}`

  const rutaDetalle = (f: FilaPedido) => ({ pathname: `/pedidos/${f.id}`, state: { lista: search } })
  const abrir = (f: FilaPedido) => {
    const r = rutaDetalle(f)
    navegar(r.pathname, { state: r.state })
  }
  const limpiar = () => {
    setBusqueda('')
    actualizar({ q: null, fase: null, solo: null })
  }
  const cambiarRapido = (r: Rapido) => (activo: boolean) => actualizar({ solo: activo ? r : null })

  const cerrarDialogo = (v: boolean) => {
    setDialogo(v)
    if (!v && nuevo) navegar('/pedidos', { replace: true })
  }

  const saldoTotal = rapidos.saldo.reduce((s, f) => s + (f.saldo ?? 0), 0)
  const botonNuevo = gestionar ? (
    <GlassButton variante="primario" icono={<PackagePlus />} onClick={() => setDialogo(true)}>
      Nuevo pedido
    </GlassButton>
  ) : null

  return (
    <div className="flex flex-col gap-4 pt-1">
      {/* Filtros rápidos: interruptores tipo Centro de Control; la luz marca lo que pide atención */}
      {activos.isPending ? (
        <div className="flex gap-2.5 overflow-hidden" aria-hidden>
          {[64, 52, 56, 52].map((w, i) => (
            <Skeleton key={i} className="h-16 shrink-0 rounded-full" style={{ width: `${w * 4}px` }} />
          ))}
        </div>
      ) : activos.data && activos.data.length > 0 ? (
        <section
          aria-label="Filtros rápidos"
          className="-mx-3 -my-2 flex snap-x snap-mandatory scroll-px-3 gap-2.5 overflow-x-auto px-3 py-2 [scrollbar-width:none] sm:mx-0 sm:my-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:py-0 [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 [&>*]:snap-start"
        >
          <GlassToggle
            icono={<AlarmClock className={rapido === 'atrasados' || !rapidos.atrasados.length ? undefined : 'text-danger'} />}
            titulo={rapidos.atrasados.length ? `${rapidos.atrasados.length} atrasados` : 'Nada atrasado'}
            subtitulo="Entrega vencida"
            activo={rapido === 'atrasados'}
            onCambio={cambiarRapido('atrasados')}
          />
          <GlassToggle
            icono={<CalendarClock />}
            titulo={rapidos.hoy.length ? `${rapidos.hoy.length} para hoy` : 'Nada para hoy'}
            subtitulo="Se entregan hoy"
            activo={rapido === 'hoy'}
            onCambio={cambiarRapido('hoy')}
          />
          {precios ? (
            <GlassToggle
              icono={<Wallet />}
              titulo={rapidos.saldo.length ? `${dinero(Math.round(saldoTotal)).replace(/\.00$/, '')} por cobrar` : 'Todo cobrado'}
              subtitulo={rapidos.saldo.length === 1 ? 'En 1 pedido con saldo' : `En ${rapidos.saldo.length} pedidos con saldo`}
              activo={rapido === 'saldo'}
              onCambio={cambiarRapido('saldo')}
              tono="acento"
            />
          ) : null}
          <GlassToggle
            icono={<ReceiptText />}
            titulo={rapidos.factura.length ? `${rapidos.factura.length} por facturar` : 'Nada por facturar'}
            subtitulo="Piden factura"
            activo={rapido === 'factura'}
            onCambio={cambiarRapido('factura')}
            tono="acento"
          />
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <SegmentedControl
          etiqueta="Filtrar por fase"
          segmentos={FASES.map((x) => ({
            valor: x.valor,
            etiqueta: x.etiqueta,
            conteo: x.valor === 'cerrados' ? (cerrados.data ? conteos.cerrados : undefined) : activos.data ? conteos[x.valor] : undefined,
          }))}
          valor={fase}
          onCambio={(v) => actualizar({ fase: v === 'todos' ? null : v })}
          idPanel={idResultados}
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
              placeholder="Buscar pedido"
              aria-label="Buscar pedidos por folio, cliente o título"
              icono={<Search />}
              className="rounded-full"
              autoComplete="off"
              enterKeyHint="search"
            />
          </div>
          {gestionar ? (
            <GlassButton variante="primario" icono={<Plus />} onClick={() => setDialogo(true)} className="shrink-0">
              <span className="sm:hidden">Nuevo</span>
              <span className="hidden sm:inline">Nuevo pedido</span>
            </GlassButton>
          ) : null}
        </div>
      </div>

      <p role="status" className="sr-only">
        {consulta.data ? `${visibles.length} ${visibles.length === 1 ? 'pedido' : 'pedidos'}` : ''}
      </p>

      <div id={idResultados} role="tabpanel" aria-label={descripcion} className="flex flex-col gap-4">
        {consulta.isPending ? (
          <EsqueletoLista escritorio={escritorio} />
        ) : consulta.isError ? (
          <GlassPanel>
            <EstadoVacio
              icono={<PackageSearch />}
              titulo="No se pudieron cargar los pedidos"
              descripcion={`${consulta.error.message}. Revisa tu conexión e inténtalo de nuevo.`}
              accion={
                <GlassButton icono={<RotateCcw />} onClick={() => void consulta.refetch()}>
                  Reintentar
                </GlassButton>
              }
            />
          </GlassPanel>
        ) : fase !== 'cerrados' && filasActivas.length === 0 ? (
          <GlassPanel>
            <EstadoVacio
              icono={<PackageOpen />}
              titulo="No hay pedidos en curso"
              descripcion="Los pedidos aparecen al convertir una cotización aceptada o al crear un pedido directo."
              accion={botonNuevo}
            />
          </GlassPanel>
        ) : visibles.length === 0 ? (
          <GlassPanel>
            <EstadoVacio
              icono={<PackageSearch />}
              titulo={texto ? `Nada coincide con “${busqueda.trim()}”` : rapido ? `Sin pedidos ${ETIQUETA_RAPIDO[rapido]} en ${nombreFase.toLowerCase()}` : `Sin pedidos en ${nombreFase.toLowerCase()}`}
              descripcion={texto ? 'Prueba con el folio (PED-0012), el nombre del cliente o una palabra del título.' : 'Cambia el filtro para ver el resto de los pedidos.'}
              accion={
                <GlassButton variante="cristal" icono={<RotateCcw />} onClick={limpiar}>
                  Ver todos
                </GlassButton>
              }
            />
          </GlassPanel>
        ) : escritorio ? (
          <GlassPanel className="p-2">
            <TablaPedidos filas={mostradas} hoy={hoy} descripcion={descripcion} precios={precios} nombres={nombres} rutaDetalle={rutaDetalle} abrir={abrir} />
          </GlassPanel>
        ) : (
          <TarjetasPedidos filas={mostradas} hoy={hoy} descripcion={descripcion} precios={precios} nombres={nombres} rutaDetalle={rutaDetalle} abrir={abrir} />
        )}

        {visibles.length > limite ? (
          <div className="flex justify-center">
            <GlassButton variante="cristal" onClick={() => setLimite((l) => l + POR_PAGINA)}>
              Mostrar {Math.min(POR_PAGINA, visibles.length - limite)} más
            </GlassButton>
          </div>
        ) : null}
      </div>

      {gestionar ? <DialogoNuevoPedido abierto={dialogo} onCambio={cerrarDialogo} /> : null}
    </div>
  )
}

const ETIQUETA_RAPIDO: Record<Rapido, string> = {
  atrasados: 'atrasados',
  hoy: 'para hoy',
  saldo: 'con saldo',
  factura: 'por facturar',
}

function EsqueletoLista({ escritorio }: { escritorio: boolean }) {
  if (!escritorio) {
    return (
      <div className="grid gap-2.5 md:grid-cols-2" role="status" aria-label="Cargando pedidos">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[10rem] rounded-tile" />
        ))}
      </div>
    )
  }
  return (
    <GlassPanel className="p-2" role="status" aria-label="Cargando pedidos">
      <div className="flex gap-6 px-4 pb-3 pt-3">
        {['w-12', 'w-28', 'w-14', 'w-16', 'w-20', 'w-12'].map((w, i) => (
          <Skeleton key={i} className={`h-3 rounded-full ${w}`} />
        ))}
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-6 border-t border-[var(--divider)] px-4 py-4">
          <Skeleton className="h-4 w-20 rounded-full" />
          <div className="flex w-64 flex-col gap-1.5">
            <Skeleton className="h-4 w-48 rounded-full" />
            <Skeleton className="h-3 w-32 rounded-full" />
          </div>
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-4 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="ml-auto h-4 w-24 rounded-full" />
        </div>
      ))}
    </GlassPanel>
  )
}
