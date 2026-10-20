import { FileSearch, History, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EstadoVacio, GlassButton, GlassInput, GlassPanel, GlassSelect, GlassSurface, SegmentedControl } from '@/components/glass'
import { TablaCargando } from '@/features/pagos/piezas'
import { TIPOS_MOVIMIENTO, type Movimiento, type TipoMovimiento } from '@/data/modulos/inventario/contrato'
import { useEsEscritorio } from '@/hooks/useMediaQuery'
import { fechaRelativa, hoyISO } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useMateriales, useMovimientos } from '../consultas'
import { conUnidad, MovimientoPildora, SelectorPedido, useSegmentoVisible, type PedidoLigado } from '../piezas'

type FiltroTipo = TipoMovimiento | 'todos'
const TIPOS: { valor: FiltroTipo; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'entrada', etiqueta: 'Entradas' },
  { valor: 'consumo', etiqueta: 'Consumos' },
  { valor: 'merma', etiqueta: 'Mermas' },
  { valor: 'ajuste', etiqueta: 'Ajustes' },
]

/** Cantidad con signo: entradas suman, consumos y mermas restan; el ajuste ya trae su signo. */
const conSigno = (m: Movimiento) => (m.tipo === 'entrada' ? m.cantidad : m.tipo === 'ajuste' ? m.cantidad : -m.cantidad)

export default function MovimientosVista() {
  const escritorio = useEsEscritorio()
  const hoy = useMemo(() => hoyISO(), [])
  const [params, setParams] = useSearchParams()
  const materialId = params.get('material') ?? ''
  const [tipo, setTipo] = useState<FiltroTipo>('todos')
  const [pedido, setPedido] = useState<PedidoLigado | null>(null)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [limite, setLimite] = useState(100)
  const materiales = useMateriales({ incluirInactivos: true })
  const consulta = useMovimientos({
    materialId: materialId || undefined,
    tipo: tipo === 'todos' ? undefined : tipo,
    pedidoId: pedido?.id,
    desde: desde || undefined,
    hasta: hasta || undefined,
    limite,
  })
  const lista = consulta.data ?? []
  const selectorTipo = useSegmentoVisible(tipo)
  const hayFiltros = Boolean(materialId || tipo !== 'todos' || pedido || desde || hasta)
  const material = materiales.data?.find((m) => m.id === materialId)
  const descripcion = `Movimientos${material ? ` de ${material.nombre}` : ''}`

  const cambiarMaterial = (id: string) =>
    setParams((p) => {
      const n = new URLSearchParams(p)
      if (id) n.set('material', id)
      else n.delete('material')
      return n
    }, { replace: true })
  const limpiar = () => {
    cambiarMaterial('')
    setTipo('todos')
    setPedido(null)
    setDesde('')
    setHasta('')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2.5">
        <div ref={selectorTipo} className="contents">
          <SegmentedControl etiqueta="Tipo de movimiento" segmentos={TIPOS} valor={tipo} onCambio={setTipo} className="w-full shrink-0 overflow-x-auto sm:w-auto" />
        </div>
        <div className="w-full sm:w-64">
          <GlassSelect aria-label="Filtrar por material" value={materialId} onChange={(e) => cambiarMaterial(e.target.value)} className="rounded-full">
            <option value="">Todos los materiales</option>
            {(materiales.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </GlassSelect>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <div className="flex items-center gap-2">
          <GlassInput type="date" aria-label="Desde" value={desde} max={hasta || hoy} onChange={(e) => setDesde(e.target.value)} className="h-11 w-[10.5rem] rounded-full" />
          <span className="text-fg-subtle" aria-hidden>
            –
          </span>
          <GlassInput type="date" aria-label="Hasta" value={hasta} min={desde || undefined} max={hoy} onChange={(e) => setHasta(e.target.value)} className="h-11 w-[10.5rem] rounded-full" />
        </div>
        <div className="w-full sm:w-72" aria-label="Filtrar por pedido" role="group">
          <SelectorPedido valor={pedido} onCambio={setPedido} />
        </div>
        {hayFiltros ? (
          <GlassButton variante="fantasma" icono={<RotateCcw />} onClick={limpiar} className="sm:ml-auto">
            Quitar filtros
          </GlassButton>
        ) : null}
      </div>

      <p role="status" className="sr-only">
        {consulta.data ? `${lista.length} movimientos` : ''}
      </p>

      {consulta.isPending ? (
        <TablaCargando />
      ) : consulta.isError ? (
        <GlassPanel>
          <EstadoVacio
            icono={<FileSearch />}
            titulo="No se pudieron cargar los movimientos"
            descripcion={`${consulta.error.message}. Revisa tu conexión e inténtalo de nuevo.`}
            accion={
              <GlassButton icono={<RotateCcw />} onClick={() => void consulta.refetch()}>
                Reintentar
              </GlassButton>
            }
          />
        </GlassPanel>
      ) : lista.length === 0 ? (
        <GlassPanel>
          <EstadoVacio
            icono={<History />}
            titulo={hayFiltros ? 'Sin movimientos con estos filtros' : 'Todavía no hay movimientos'}
            descripcion="Las entradas, consumos, mermas y ajustes aparecen aquí con la existencia que dejaron."
            accion={
              hayFiltros ? (
                <GlassButton variante="cristal" icono={<RotateCcw />} onClick={limpiar}>
                  Quitar filtros
                </GlassButton>
              ) : null
            }
          />
        </GlassPanel>
      ) : escritorio ? (
        <GlassPanel className="p-2">
          <table className="tabla">
            <caption className="sr-only">{descripcion}</caption>
            <thead>
              <tr>
                <th scope="col" className="pl-5">Fecha</th>
                <th scope="col">Material</th>
                <th scope="col">Tipo</th>
                <th scope="col" className="text-right">Cantidad</th>
                <th scope="col" className="text-right">Quedó</th>
                <th scope="col">Detalle</th>
                <th scope="col" className="hidden pr-5 xl:table-cell">Registró</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap pl-5 text-fg-muted">{fechaRelativa(m.fecha)}</td>
                  <td className="max-w-[14rem]">
                    <button type="button" onClick={() => cambiarMaterial(m.material_id)} className="block max-w-full truncate rounded-full text-left font-semibold text-fg outline-none hover:underline" title={`Ver solo ${m.material}`}>
                      {m.material}
                    </button>
                  </td>
                  <td>
                    <MovimientoPildora tipo={m.tipo} />
                  </td>
                  <td className="text-right">
                    <Cantidad m={m} />
                  </td>
                  <td className="num whitespace-nowrap text-right text-fg-muted">{conUnidad(m.existencia_resultante, m.unidad)}</td>
                  <td className="w-full max-w-0">
                    <Detalle m={m} />
                  </td>
                  <td className="hidden whitespace-nowrap pr-5 text-fg-muted xl:table-cell">{m.usuario ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassPanel>
      ) : (
        <ul aria-label={descripcion} className="grid grid-cols-[minmax(0,1fr)] gap-2.5 md:grid-cols-2">
          {lista.map((m) => (
            <li key={m.id}>
              <GlassSurface variante="fuerte" className="rounded-tile p-4">
                <div className="flex min-h-8 items-center gap-2">
                  <MovimientoPildora tipo={m.tipo} />
                  <span className="ml-auto text-sm text-fg-subtle">{fechaRelativa(m.fecha)}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-md font-semibold text-fg">{m.material}</p>
                  <Cantidad m={m} className="text-lg" />
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-3 text-xs text-fg-muted">
                  <Detalle m={m} />
                  <span className="num shrink-0">Quedó {conUnidad(m.existencia_resultante, m.unidad)}</span>
                </div>
              </GlassSurface>
            </li>
          ))}
        </ul>
      )}

      {lista.length >= limite ? (
        <div className="flex justify-center">
          <GlassButton variante="cristal" onClick={() => setLimite((l) => l + 100)}>
            Mostrar más
          </GlassButton>
        </div>
      ) : null}
    </div>
  )
}

function Cantidad({ m, className }: { m: Movimiento; className?: string }) {
  const n = conSigno(m)
  return (
    <span className={cn('num whitespace-nowrap font-semibold', n > 0 ? 'text-success' : 'text-fg', className)}>
      {n > 0 ? '+' : '−'}
      {conUnidad(Math.abs(n), m.unidad)}
      <span className="sr-only"> ({TIPOS_MOVIMIENTO[m.tipo].toLowerCase()})</span>
    </span>
  )
}

function Detalle({ m }: { m: Movimiento }) {
  const partes = [m.proveedor, m.referencia, m.notas].filter(Boolean)
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      {m.folio_pedido && m.pedido_id ? (
        <Link to={`/pedidos/${m.pedido_id}`} className="num shrink-0 rounded-full font-semibold text-fg outline-none hover:underline pointer-coarse:-my-3 pointer-coarse:py-3">
          {m.folio_pedido}
        </Link>
      ) : null}
      <span className="truncate text-fg-muted" title={partes.join(' · ')}>
        {partes.join(' · ') || (m.folio_pedido ? '' : '—')}
      </span>
    </span>
  )
}
