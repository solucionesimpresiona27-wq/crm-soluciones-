import { Hammer, Package, Wrench } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSesion } from '@/app/sesion'
import { useTema } from '@/app/tema'
import { GlassButton, Pildora } from '@/components/glass'
import type { DashboardResumen, EntregaProxima } from '@/data/tipos'
import { ESTADO_PEDIDO } from '@/lib/estados'
import { cn } from '@/lib/utils'
import { GlifoAmpliar, ModuloExpandible, PanelExpandido, TituloModulo } from './Modulo'
import { conteoEtapas, conteoFases, cuandoEntrega, entero, pedidosConocidos, plural, type IdFase } from './util'

/** Rampa ordinal de un solo tono (validada): las fases se oscurecen conforme avanzan; en oscuro se invierte. */
function useColoresFase(): Record<IdFase, string> {
  const oscuro = useTema().efectivo === 'oscuro'
  return oscuro
    ? { diseno: '#3A6194', taller: '#87A3C9', entrega: '#D9E3F0', pausado: 'rgb(var(--warning))' }
    : { diseno: '#87A3C9', taller: '#3A6194', entrega: '#1B3557', pausado: 'rgb(var(--warning))' }
}

function Indicadores({ r, disenos }: { r: DashboardResumen; disenos?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {r.pedidos_atrasados > 0 ? <Pildora tono="peligro">{plural(r.pedidos_atrasados, 'atrasado', 'atrasados')}</Pildora> : null}
      {r.pedidos_pausados > 0 ? <Pildora tono="aviso">{plural(r.pedidos_pausados, 'pausado', 'pausados')}</Pildora> : null}
      {disenos && r.disenos_pendientes > 0 ? (
        <Pildora tono="luz">{plural(r.disenos_pendientes, 'diseño por aprobar', 'diseños por aprobar')}</Pildora>
      ) : null}
      {r.pedidos_atrasados === 0 && r.pedidos_pausados === 0 ? <Pildora tono="exito">Todo a tiempo</Pildora> : null}
    </div>
  )
}

/** Barra segmentada por fase (diseño, taller, entrega y pausados) con su leyenda. */
function BarraFases({ r, className }: { r: DashboardResumen; className?: string }) {
  const colores = useColoresFase()
  const fases = conteoFases(r.pedidos_por_estado).filter((f) => f.cantidad > 0)
  if (!fases.length) return null
  return (
    <div className={className}>
      <div className="flex h-2.5 w-full gap-[2px]" aria-hidden>
        {fases.map((f) => (
          <span key={f.id} className="h-full min-w-2 rounded-full" style={{ flexGrow: f.cantidad, background: colores[f.id] }} />
        ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
        {fases.map((f) => (
          <li key={f.id} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ background: colores[f.id] }} aria-hidden />
            {f.etiqueta}
            <span className="font-semibold text-fg">{f.cantidad}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Mini barras por etapa (ESTADO_PEDIDO), en el orden del flujo. */
function BarrasEtapas({ r, className }: { r: DashboardResumen; className?: string }) {
  const etapas = conteoEtapas(r.pedidos_por_estado)
  const max = Math.max(1, ...etapas.map((e) => e.cantidad))
  return (
    <ul className={cn('flex flex-col gap-2', className)} aria-label="Pedidos por etapa">
      {etapas.map((e) => (
        <li key={e.estado} className="grid grid-cols-[6rem_minmax(0,1fr)_1.5rem] items-center gap-3">
          <span className="truncate text-xs font-medium text-fg-muted">{ESTADO_PEDIDO[e.estado].corto}</span>
          <span className="h-1.5 rounded-full bg-fg/[0.07]" aria-hidden>
            <span
              className={cn('block h-full rounded-full', e.estado === 'pausado' ? 'bg-warning' : 'bg-accent dark:bg-navy-300')}
              style={{ width: `${Math.max(8, (e.cantidad / max) * 100)}%` }}
            />
          </span>
          <span className="text-right text-xs font-semibold text-fg">{e.cantidad}</span>
        </li>
      ))}
    </ul>
  )
}

interface Props {
  r: DashboardResumen
  /** fila = módulo 2x1 · bloque = módulo 2x2 protagonista (producción y diseño) */
  variante: 'fila' | 'bloque'
  abierto: boolean
  onAbrir: () => void
  onCerrar: () => void
  enfocar: boolean
  onEnfocado: () => void
  remontado: boolean
}

export function ProduccionModulo({ r, variante, abierto, onAbrir, onCerrar, enfocar, onEnfocado, remontado }: Props) {
  const navegar = useNavigate()
  const { puede } = useSesion()
  const ir = (ruta: string) => {
    onCerrar()
    navegar(ruta)
  }

  return (
    <>
      <ModuloExpandible
        id="produccion"
        etiqueta={`Producción: ${plural(r.pedidos_activos, 'pedido activo', 'pedidos activos')}. Abrir detalle por etapa`}
        abierto={abierto}
        onAbrir={onAbrir}
        enfocar={enfocar}
        onEnfocado={onEnfocado}
        remontado={remontado}
      >
        {variante === 'fila' ? (
          <div className="flex h-full flex-col">
            <TituloModulo icono={<Hammer />} extra={<GlifoAmpliar />}>
              Producción
            </TituloModulo>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight text-fg">{entero(r.pedidos_activos)}</span>
                <span className="text-sm text-fg-muted">{r.pedidos_activos === 1 ? 'pedido activo' : 'pedidos activos'}</span>
              </p>
              <Indicadores r={r} />
            </div>
            <BarraFases r={r} className="mt-auto pt-3" />
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <TituloModulo icono={<Hammer />} extra={<GlifoAmpliar />}>
              Producción
            </TituloModulo>
            <div className="mt-3 grid flex-1 gap-5 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <div className="flex flex-col">
                <p className="glass-text text-[3.5rem] font-semibold leading-none tracking-[-0.04em] lg:text-[4.25rem]">
                  {entero(r.pedidos_activos)}
                </p>
                <p className="mb-3 mt-1 text-sm text-fg-muted">{r.pedidos_activos === 1 ? 'pedido activo' : 'pedidos activos'}</p>
                <Indicadores r={r} disenos />
                <BarraFases r={r} className="mt-auto hidden pt-4 sm:block" />
              </div>
              <BarrasEtapas r={r} className="justify-center" />
            </div>
          </div>
        )}
      </ModuloExpandible>

      <PanelExpandido
        id="produccion"
        abierto={abierto}
        onCerrar={onCerrar}
        titulo="Pedidos en producción"
        descripcion={`${plural(r.pedidos_activos, 'pedido activo', 'pedidos activos')}, por etapa del flujo.`}
        pie={
          <>
            <GlassButton variante="cristal" icono={<Package />} onClick={() => ir('/pedidos')}>
              Ver pedidos
            </GlassButton>
            {puede('actualizar_produccion') ? (
              <GlassButton variante="primario" icono={<Hammer />} onClick={() => ir('/produccion')}>
                Abrir tablero de producción
              </GlassButton>
            ) : null}
          </>
        }
      >
        <DetalleProduccion r={r} />
      </PanelExpandido>
    </>
  )
}

function FilaPedido({ p, hoy }: { p: EntregaProxima; hoy: string }) {
  const cuando = cuandoEntrega(p.fecha_entrega, hoy)
  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5">
      <span className="num w-[4.5rem] shrink-0 text-xs font-semibold text-fg-muted">{p.folio}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">{p.titulo}</p>
        <p className="truncate text-xs text-fg-muted">{p.cliente}</p>
      </div>
      {p.requiere_instalacion ? (
        <span className="hidden items-center gap-1 text-xs text-fg-subtle sm:flex" title="Lleva instalación">
          <Wrench className="size-3.5" aria-hidden />
          <span className="sr-only">Lleva instalación</span>
        </span>
      ) : null}
      <span className={cn('shrink-0 text-right text-xs font-medium', cuando.atrasado ? 'text-danger' : 'text-fg-muted')}>{cuando.texto}</span>
    </li>
  )
}

function DetalleProduccion({ r }: { r: DashboardResumen }) {
  const etapas = conteoEtapas(r.pedidos_por_estado)
  const conocidos = pedidosConocidos(r)
  const max = Math.max(1, ...etapas.map((e) => e.cantidad))

  return (
    <div className="grid gap-7 md:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className="flex flex-col gap-4 md:sticky md:top-0 md:self-start">
        <div>
          <p className="glass-text text-hero font-semibold">{entero(r.pedidos_activos)}</p>
          <p className="mt-1 text-sm text-fg-muted">{r.pedidos_activos === 1 ? 'pedido activo' : 'pedidos activos'}</p>
        </div>
        <Indicadores r={r} disenos />
        <BarraFases r={r} className="mt-1" />
        <p className="text-xs leading-relaxed text-fg-subtle">
          Diseño incluye nuevos, en diseño y esperando aprobación. Taller: aprobados, en producción y acabados. Entrega: listos e instalación.
        </p>
      </aside>

      <div className="flex flex-col gap-5">
        {etapas.map((e) => {
          const info = ESTADO_PEDIDO[e.estado]
          const lista = conocidos.filter((p) => p.estado === e.estado)
          const resto = e.cantidad - lista.length
          return (
            <section key={e.estado} aria-label={`${info.etiqueta}: ${e.cantidad}`}>
              <div className="flex items-center gap-3">
                <Pildora tono={info.tono}>{info.etiqueta}</Pildora>
                <span className="h-1.5 flex-1 rounded-full bg-fg/[0.07]" aria-hidden>
                  <span
                    className={cn('block h-full rounded-full', e.estado === 'pausado' ? 'bg-warning' : 'bg-accent dark:bg-navy-300')}
                    style={{ width: `${Math.max(6, (e.cantidad / max) * 100)}%` }}
                  />
                </span>
                <span className="w-6 text-right text-sm font-semibold text-fg">{e.cantidad}</span>
              </div>
              {lista.length ? (
                <ul className="mt-2 divide-y divide-[var(--divider)] rounded-tile bg-[var(--control-bg)] shadow-[inset_0_1px_0_var(--inner-hi)]">
                  {lista.map((p) => (
                    <FilaPedido key={p.id} p={p} hoy={r.hoy} />
                  ))}
                </ul>
              ) : null}
              {/* Solo se listan los pedidos que trae el resumen (entregas próximas y pendientes propios) */}
              {lista.length && resto > 0 ? (
                <p className="mt-1.5 px-1 text-xs text-fg-subtle">
                  {resto === 1 ? 'Y 1 pedido más en esta etapa.' : `Y ${resto} pedidos más en esta etapa.`}
                </p>
              ) : null}
            </section>
          )
        })}
      </div>
    </div>
  )
}
