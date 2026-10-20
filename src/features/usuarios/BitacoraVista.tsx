import { ArrowRight, SlidersHorizontal, CheckCircle2, FilePlus2, History, PencilLine, RefreshCw, RotateCcw, Search, Trash2, XCircle, type LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Campo, EstadoVacio, GlassButton, GlassInput, GlassPanel, GlassSelect, Skeleton } from '@/components/glass'
import type { EntradaBitacora } from '@/data/modulos/administracion/contrato'
import { useDebounce } from '@/hooks/useDebounce'
import { useEsEscritorio } from '@/hooks/useMediaQuery'
import { fechaRelativa } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useBitacora, useUsuarios } from './consultas'
import { ACCIONES_BITACORA, NOMBRE_TABLA, cambiosLegibles, resumenDatos, type AccionBitacora } from './util'

const ICONO: Record<AccionBitacora, LucideIcon> = {
  crear: FilePlus2,
  modificar: PencilLine,
  eliminar: Trash2,
  cambio_estado: RefreshCw,
  aprobar: CheckCircle2,
  cancelar: XCircle,
}

const horaLocal = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })
const diaLocal = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Bitácora: quién cambió qué, agrupada por día, con filtros en la URL y paginación por id. */
export default function BitacoraVista() {
  const [params, setParams] = useSearchParams()
  const [texto, setTexto] = useState(params.get('q') ?? '')
  const q = useDebounce(texto, 350)
  const filtros = {
    tabla: params.get('tabla') || undefined,
    usuarioId: params.get('quien') || undefined,
    accion: (params.get('accion') || undefined) as AccionBitacora | undefined,
    desde: params.get('desde') || undefined,
    hasta: params.get('hasta') || undefined,
    texto: q.trim() || undefined,
  }
  const poner = (k: string, v: string) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        if (v) n.set(k, v)
        else n.delete(k)
        return n
      },
      { replace: true },
    )
  const hayFiltros = Boolean(filtros.tabla || filtros.usuarioId || filtros.accion || filtros.desde || filtros.hasta || filtros.texto)

  const escritorio = useEsEscritorio()
  const [verFiltros, setVerFiltros] = useState(false)
  const activos = [filtros.tabla, filtros.usuarioId, filtros.accion, filtros.desde, filtros.hasta].filter(Boolean).length
  const consulta = useBitacora(filtros)
  const usuarios = useUsuarios()
  const entradas = useMemo(() => consulta.data?.pages.flat() ?? [], [consulta.data])
  const dias = useMemo(() => {
    const m = new Map<string, EntradaBitacora[]>()
    for (const e of entradas) {
      const d = diaLocal(e.created_at)
      m.set(d, [...(m.get(d) ?? []), e])
    }
    return [...m.entries()]
  }, [entradas])

  return (
    <div className="flex flex-col gap-4">
      <GlassPanel className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto_auto]">
        <div className="flex items-end gap-2">
          <Campo etiqueta="Buscar" className="flex-1">
            {(id) => <GlassInput id={id} icono={<Search />} placeholder="Folio, cliente, producto…" value={texto} onChange={(e) => { setTexto(e.target.value); poner('q', e.target.value.trim()) }} />}
          </Campo>
          {!escritorio ? (
            <GlassButton variante={activos ? 'primario' : 'cristal'} icono={<SlidersHorizontal />} aria-expanded={verFiltros} onClick={() => setVerFiltros(!verFiltros)}>
              {activos ? `Filtros (${activos})` : 'Filtros'}
            </GlassButton>
          ) : null}
        </div>
        {escritorio || verFiltros ? (
        <>
        <Campo etiqueta="Sección">
          {(id) => (
            <GlassSelect id={id} value={filtros.tabla ?? ''} onChange={(e) => poner('tabla', e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(NOMBRE_TABLA)
                .sort((a, b) => a[1].localeCompare(b[1], 'es'))
                .map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
            </GlassSelect>
          )}
        </Campo>
        <Campo etiqueta="Quién">
          {(id) => (
            <GlassSelect id={id} value={filtros.usuarioId ?? ''} onChange={(e) => poner('quien', e.target.value)}>
              <option value="">Todo el equipo</option>
              {(usuarios.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.nombre || u.email}</option>
              ))}
            </GlassSelect>
          )}
        </Campo>
        <Campo etiqueta="Acción">
          {(id) => (
            <GlassSelect id={id} value={filtros.accion ?? ''} onChange={(e) => poner('accion', e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(ACCIONES_BITACORA).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </GlassSelect>
          )}
        </Campo>
        <Campo etiqueta="Desde">
          {(id) => <GlassInput id={id} type="date" className="num" value={filtros.desde ?? ''} max={filtros.hasta} onChange={(e) => poner('desde', e.target.value)} />}
        </Campo>
        <Campo etiqueta="Hasta">
          {(id) => <GlassInput id={id} type="date" className="num" value={filtros.hasta ?? ''} min={filtros.desde} onChange={(e) => poner('hasta', e.target.value)} />}
        </Campo>
        </>
        ) : null}
      </GlassPanel>

      {consulta.isPending ? (
        <GlassPanel className="flex flex-col gap-3 p-4" role="status" aria-label="Cargando bitácora">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-control" />
          ))}
        </GlassPanel>
      ) : consulta.isError ? (
        <GlassPanel>
          <EstadoVacio icono={<History />} titulo="No se pudo cargar la bitácora" descripcion={`${consulta.error.message}. Inténtalo de nuevo.`} accion={<GlassButton icono={<RotateCcw />} onClick={() => void consulta.refetch()}>Reintentar</GlassButton>} />
        </GlassPanel>
      ) : entradas.length === 0 ? (
        <GlassPanel>
          <EstadoVacio
            icono={<History />}
            titulo={hayFiltros ? 'Nada coincide con los filtros' : 'Aún no hay cambios registrados'}
            descripcion={hayFiltros ? 'Prueba con otras fechas o quita algún filtro.' : 'Aquí aparecerá quién crea, cambia, aprueba o cancela algo.'}
            accion={hayFiltros ? <GlassButton onClick={() => { setTexto(''); setParams({}, { replace: true }) }}>Quitar filtros</GlassButton> : undefined}
          />
        </GlassPanel>
      ) : (
        <div className="flex flex-col gap-4">
          {dias.map(([dia, lista]) => (
            <section key={dia} aria-label={fechaRelativa(dia)}>
              <h3 className="mb-2 px-2 text-sm font-semibold capitalize text-fg-muted">{fechaRelativa(dia)}</h3>
              <GlassPanel className="p-2">
                <ol>
                  {lista.map((e) => (
                    <Entrada key={e.id} e={e} />
                  ))}
                </ol>
              </GlassPanel>
            </section>
          ))}
          {consulta.hasNextPage ? (
            <GlassButton variante="cristal" className="self-center" cargando={consulta.isFetchingNextPage} onClick={() => void consulta.fetchNextPage()}>
              Cargar más antiguos
            </GlassButton>
          ) : (
            <p className="text-center text-xs text-fg-subtle">No hay más registros.</p>
          )}
        </div>
      )}
    </div>
  )
}

function Entrada({ e }: { e: EntradaBitacora }) {
  const [abierta, setAbierta] = useState(false)
  const accion = (e.accion in ACCIONES_BITACORA ? e.accion : 'modificar') as AccionBitacora
  const Icono = ICONO[accion]
  const cambios = cambiosLegibles(e)
  const datos = cambios.length ? [] : resumenDatos(e.datos, 4, e.tabla)
  const detalle = cambios.length > 0 || datos.length > 0
  const visibles = abierta ? cambios : cambios.slice(0, 3)

  return (
    <li className="relative flex gap-3 rounded-tile px-2 py-3 [&+li]:border-t [&+li]:border-[var(--divider)]">
      <span
        aria-hidden
        className={cn(
          'mt-0.5 grid size-9 shrink-0 place-items-center rounded-full [&_svg]:size-4',
          accion === 'eliminar' || accion === 'cancelar' ? 'bg-danger-soft text-danger' : accion === 'crear' || accion === 'aprobar' ? 'bg-success-soft text-success' : 'bg-accent/[0.12] text-accent dark:text-navy-200',
        )}
      >
        <Icono />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-fg">
          <span className="font-semibold">{e.usuario_nombre || 'Sistema'}</span> <span className="text-fg-muted">{ACCIONES_BITACORA[accion].toLowerCase()}</span>{' '}
          <span className="font-medium">{e.etiqueta || 'un registro'}</span>
        </p>
        <p className="text-xs text-fg-subtle">
          {NOMBRE_TABLA[e.tabla] ?? e.tabla} · <span className="num">{horaLocal(e.created_at)}</span>
        </p>
        {detalle ? (
          <dl className="mt-2 grid gap-1 text-sm">
            {visibles.map((c) => (
              <div key={c.campo} className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-2 max-sm:grid-cols-1 max-sm:gap-0">
                <dt className="text-fg-muted">{c.campo}</dt>
                <dd className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="max-w-full truncate rounded-full bg-fg/[0.06] px-2 text-fg-muted line-through decoration-fg-subtle/60" title={c.antes}>{c.antes}</span>
                  <ArrowRight className="size-3.5 shrink-0 text-fg-subtle" aria-label="cambió a" />
                  <span className="max-w-full truncate rounded-full bg-accent/[0.1] px-2 font-medium text-fg" title={c.despues}>{c.despues}</span>
                </dd>
              </div>
            ))}
            {datos.map((d) => (
              <div key={d.campo} className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-2">
                <dt className="text-fg-muted">{d.campo}</dt>
                <dd className="truncate text-fg">{d.valor}</dd>
              </div>
            ))}
            {cambios.length > 3 ? (
              <button type="button" onClick={() => setAbierta(!abierta)} className="justify-self-start rounded-full py-2 text-sm font-medium text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent dark:text-navy-200">
                {abierta ? 'Ver menos' : `Ver ${cambios.length - 3} cambios más`}
              </button>
            ) : null}
          </dl>
        ) : null}
      </div>
    </li>
  )
}
