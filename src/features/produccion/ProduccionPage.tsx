import { ClipboardList, RotateCcw, Search, SearchX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSesion } from '@/app/sesion'
import { EstadoVacio, GlassButton, GlassInput, GlassPanel, GlassSelect, Pildora, SegmentedControl, Skeleton } from '@/components/glass'
import type { OrdenTrabajo } from '@/data/modulos/produccion/contrato'
import type { EstadoPedido } from '@/data/tipos'
import { hoyISO } from '@/lib/format'
import { useMoverEtapa, useTablero } from './consultas'
import { DialogoPausa } from './tablero/DialogoPausa'
import { ETAPAS_TABLERO, agrupar, filtrar, responsables, type Alcance } from './tablero/etapas'
import { Tablero } from './tablero/Tablero'

/** Tablero de producción por etapas (sin precios): arrastrar, teclado o menú "Mover a…". */
export default function ProduccionPage() {
  const { sesion, puede } = useSesion()
  const consulta = useTablero()
  const mover = useMoverEtapa()
  const hoy = useMemo(() => hoyISO(), [])
  const puedeMover = puede('actualizar_produccion') || puede('gestionar_pedidos')
  const [pausar, setPausar] = useState<OrdenTrabajo | null>(null)

  // Filtros en la URL: se conservan al volver de una orden de trabajo
  const [params, setParams] = useSearchParams()
  const alcance: Alcance = params.get('ver') === 'mias' ? 'mias' : 'todas'
  const responsableId = params.get('responsable') ?? ''
  const texto = params.get('q') ?? ''
  const cambiar = (k: string, v: string | null) =>
    setParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        if (v) n.set(k, v)
        else n.delete(k)
        return n
      },
      { replace: true },
    )

  const ordenes = consulta.data ?? []
  const yo = sesion?.id
  const filtradas = useMemo(() => filtrar(ordenes, { alcance, responsableId, texto }, yo), [ordenes, alcance, responsableId, texto, yo])
  const mias = useMemo(() => filtrar(ordenes, { alcance: 'mias', responsableId, texto }, yo).length, [ordenes, responsableId, texto, yo])
  const grupos = useMemo(() => agrupar(filtradas), [filtradas])
  // "Nuevo" (esperando anticipo) solo ocupa lugar si tiene órdenes
  const columnas = useMemo(() => ETAPAS_TABLERO.filter((e) => e !== 'nuevo' || (grupos.get('nuevo')?.length ?? 0) > 0), [grupos])
  const quienes = useMemo(() => responsables(ordenes), [ordenes])

  const atrasadas = filtradas.filter((o) => o.atrasado).length
  const urgentes = filtradas.filter((o) => o.prioridad === 'urgente').length
  const porAprobar = filtradas.reduce((s, o) => s + o.num_pendientes, 0)

  const onMover = (o: OrdenTrabajo, estado: EstadoPedido) => mover.mutate({ orden: o, estado })

  const hayFiltros = alcance !== 'todas' || responsableId || texto

  return (
    <div className="flex flex-col gap-4 pt-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <SegmentedControl
          etiqueta="Qué órdenes ver"
          segmentos={[
            {
              valor: 'todas',
              etiqueta: 'Todas',
              conteo: consulta.data ? filtrar(ordenes, { alcance: 'todas', responsableId, texto }, yo).length : undefined,
            },
            {
              valor: 'mias',
              etiqueta: 'Mis órdenes',
              conteo: consulta.data ? mias : undefined,
            },
          ]}
          valor={alcance}
          onCambio={(v) => cambiar('ver', v === 'mias' ? 'mias' : null)}
          className="shrink-0"
        />
        <div className="min-w-[8.5rem] flex-1 sm:max-w-[14rem] sm:flex-none">
          <GlassSelect
            aria-label="Filtrar por responsable"
            value={responsableId}
            onChange={(e) => cambiar('responsable', e.target.value || null)}
            className="h-11 rounded-full"
          >
            <option value="">Todos los responsables</option>
            {quienes.lista.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
            {quienes.sinAsignar ? <option value="sin">Sin responsable</option> : null}
          </GlassSelect>
        </div>
        <div className="min-w-[12rem] flex-1 basis-full sm:basis-auto lg:max-w-xs xl:ml-auto">
          <GlassInput
            type="search"
            value={texto}
            onChange={(e) => cambiar('q', e.target.value || null)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && texto) {
                e.preventDefault()
                cambiar('q', null)
              }
            }}
            placeholder="Buscar folio, cliente o trabajo"
            aria-label="Buscar órdenes por folio, cliente o trabajo"
            icono={<Search />}
            className="rounded-full"
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
      </div>

      {consulta.data && filtradas.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5" role="status">
          <span className="mr-1 text-sm text-fg-muted">
            <span className="num font-semibold text-fg">{filtradas.length}</span> {filtradas.length === 1 ? 'orden en curso' : 'órdenes en curso'}
          </span>
          {urgentes ? <Pildora tono="luz">{urgentes === 1 ? '1 urgente' : `${urgentes} urgentes`}</Pildora> : null}
          {atrasadas ? <Pildora tono="peligro">{atrasadas === 1 ? '1 atrasada' : `${atrasadas} atrasadas`}</Pildora> : null}
          {porAprobar ? <Pildora tono="neutro">{porAprobar === 1 ? '1 diseño por aprobar' : `${porAprobar} diseños por aprobar`}</Pildora> : null}
          {!puedeMover ? <Pildora tono="neutro">Solo consulta</Pildora> : null}
        </div>
      ) : null}

      {consulta.isPending ? (
        <EsqueletoTablero />
      ) : consulta.isError ? (
        <GlassPanel>
          <EstadoVacio
            icono={<ClipboardList />}
            titulo="No se pudo cargar el tablero"
            descripcion={`${consulta.error.message}. Revisa tu conexión e inténtalo de nuevo.`}
            accion={
              <GlassButton icono={<RotateCcw />} onClick={() => void consulta.refetch()}>
                Reintentar
              </GlassButton>
            }
          />
        </GlassPanel>
      ) : ordenes.length === 0 ? (
        <GlassPanel>
          <EstadoVacio
            icono={<ClipboardList />}
            titulo="No hay trabajo en el taller"
            descripcion="Cuando ventas convierta una cotización en pedido, aparecerá aquí en su etapa."
          />
        </GlassPanel>
      ) : filtradas.length === 0 ? (
        <GlassPanel>
          <EstadoVacio
            icono={<SearchX />}
            titulo={texto ? `Nada coincide con “${texto.trim()}”` : alcance === 'mias' ? 'No tienes órdenes asignadas' : 'Ninguna orden con este filtro'}
            descripcion={texto ? 'Prueba con el folio (PED-0012), el cliente o una palabra del trabajo.' : 'Cambia el filtro para ver el resto del tablero.'}
            accion={
              hayFiltros ? (
                <GlassButton variante="cristal" icono={<RotateCcw />} onClick={() => setParams({}, { replace: true })}>
                  Ver todas
                </GlassButton>
              ) : undefined
            }
          />
        </GlassPanel>
      ) : (
        <Tablero grupos={grupos} columnas={columnas} hoy={hoy} puedeMover={puedeMover} onMover={onMover} onPausar={setPausar} />
      )}

      <DialogoPausa
        orden={pausar}
        onCerrar={() => setPausar(null)}
        onPausar={(motivo) => {
          if (pausar) mover.mutate({ orden: pausar, estado: 'pausado', motivo })
          setPausar(null)
        }}
      />
    </div>
  )
}

function EsqueletoTablero() {
  return (
    <div className="flex gap-3 overflow-hidden" aria-busy aria-label="Cargando tablero">
      {[3, 2, 4, 2, 1].map((n, i) => (
        <div key={i} className="glass glass-clear flex w-full shrink-0 flex-col gap-2.5 rounded-module p-2.5 md:w-[16rem]">
          <Skeleton className="mx-1.5 my-1.5 h-4 w-28" />
          {Array.from({ length: n }, (_, j) => (
            <Skeleton key={j} className="h-[7.5rem] rounded-tile" />
          ))}
        </div>
      ))}
    </div>
  )
}
