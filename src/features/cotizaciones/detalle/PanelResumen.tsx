import { AlarmClock, CalendarClock, HandCoins, Info, Lock, NotebookPen, Rows3, UserRound } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { AnimatedNumber, GlassPanel } from '@/components/glass'
import type { CotizacionCompleta } from '@/data/tipos'
import type { EstadoCotizacionVisible } from '@/lib/estados'
import { cantidad, dinero, fecha, porcentaje } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { cn, iniciales } from '@/lib/utils'
import { DIAS_AVISO, textoVigencia } from '../lista/datos'
import { anticipoDe, costosCotizacion, hitosCotizacion, type TonoHito } from './calculos'

function Dato({ icono, etiqueta, children, sub }: { icono: ReactNode; etiqueta: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="flex items-center gap-2.5 text-sm text-fg-muted [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-subtle">
        {icono}
        {etiqueta}
      </dt>
      <dd className="min-w-0 text-right text-sm">
        <span className="block font-medium text-fg">{children}</span>
        {sub ? <span className="block text-xs text-fg-subtle">{sub}</span> : null}
      </dd>
    </div>
  )
}

function TituloModulo({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-base font-semibold tracking-tight text-fg">{children}</h3>
      {extra}
    </div>
  )
}

export function ModuloTotal({ c, visible, dias }: { c: CotizacionCompleta; visible: EstadoCotizacionVisible; dias: number }) {
  const abierta = visible === 'borrador' || visible === 'enviada'
  const urgente = abierta && dias <= DIAS_AVISO
  return (
    <GlassPanel className="rounded-module p-5 sm:p-6">
      <p className="text-sm font-medium text-fg-muted">Total de la cotización</p>
      <AnimatedNumber valor={c.total} formato={dinero} className="glass-text num mt-1 block text-[2.5rem] font-semibold leading-[1.1] tracking-tight" />
      <p className="mt-1 text-xs text-fg-subtle">{c.aplica_iva ? `IVA incluido (${cantidad(c.iva_pct)} %)` : 'Precios sin IVA'}</p>

      <dl className="mt-4 divide-y divide-[var(--divider)] border-t border-[var(--divider)]">
        <Dato icono={<HandCoins />} etiqueta={`Anticipo (${cantidad(c.anticipo_pct)} %)`}>
          <span className="num">{dinero(anticipoDe(c))}</span>
        </Dato>
        <Dato icono={urgente || visible === 'vencida' ? <AlarmClock /> : <CalendarClock />} etiqueta="Vigencia" sub={`${abierta || visible === 'vencida' ? 'Hasta el ' : ''}${fecha(c.fecha_vencimiento)}`}>
          {abierta || visible === 'vencida' ? (
            <span className={cn(urgente && 'font-semibold text-warning', visible === 'vencida' && 'font-semibold text-warning')}>{textoVigencia(dias)}</span>
          ) : (
            <span className="text-fg-muted">Ya no aplica</span>
          )}
        </Dato>
        {c.vendedor ? (
          <Dato icono={<UserRound />} etiqueta="Vendedor">
            <span className="inline-flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-full bg-gradient-to-br from-navy-500 to-navy-700 text-2xs font-bold text-white" aria-hidden>
                {iniciales(c.vendedor.nombre)}
              </span>
              {c.vendedor.nombre}
            </span>
          </Dato>
        ) : null}
        <Dato icono={<Rows3 />} etiqueta="Partidas">
          <span className="num">{c.partidas.length}</span>
        </Dato>
      </dl>
    </GlassPanel>
  )
}

/** Costo contra utilidad sobre la base sin IVA. Énfasis: la utilidad en azul; el costo en gris de contexto. */
export function ModuloCostos({ c }: { c: CotizacionCompleta }) {
  const reducir = useReducedMotion()
  const { base, costo, utilidad, margen, sinCosto } = costosCotizacion(c)
  const perdida = utilidad < 0
  const fraccionCosto = base > 0 ? Math.min(1, costo / base) : 1

  return (
    <GlassPanel className="rounded-module p-5 sm:p-6" aria-label="Costos y utilidad">
      <TituloModulo
        extra={
          <span className="inline-flex items-center gap-1 text-xs text-fg-subtle">
            <Lock className="size-3" aria-hidden />
            No sale en el PDF
          </span>
        }
      >
        Costos y utilidad
      </TituloModulo>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-fg-muted">{perdida ? 'Pérdida estimada' : 'Utilidad estimada'}</p>
          <p className={cn('num text-2xl font-semibold tracking-tight', perdida ? 'text-danger' : 'text-fg')}>{dinero(utilidad)}</p>
        </div>
        <p className="pb-1 text-right text-sm text-fg-muted">
          Margen <span className="num font-semibold text-fg">{porcentaje(margen, 0)}</span>
        </p>
      </div>

      {/* Barra parte-todo: costo | utilidad, separados por un hueco de 2 px */}
      <div
        className="mt-3 flex h-2.5 w-full gap-[2px]"
        role="img"
        aria-label={`Costo ${dinero(costo)} y utilidad ${dinero(utilidad)} sobre una base de ${dinero(base)}`}
      >
        <motion.span
          className={cn('h-full rounded-l-full', perdida ? 'rounded-r-full bg-danger/60' : 'bg-fg/20')}
          style={{ width: `${fraccionCosto * 100}%`, originX: 0 }}
          initial={reducir ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ ...resorte.expansion, delay: reducir ? 0 : 0.15 }}
        />
        {!perdida && fraccionCosto < 1 ? (
          <motion.span
            className="h-full flex-1 rounded-r-full bg-accent dark:bg-navy-300"
            style={{ originX: 0 }}
            initial={reducir ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ ...resorte.expansion, delay: reducir ? 0 : 0.3 }}
          />
        ) : null}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-fg-muted">
            <span className="size-2 rounded-full bg-fg/25" aria-hidden />
            Costo
          </dt>
          <dd className="num font-medium text-fg">{dinero(costo)}</dd>
        </div>
        <div className="text-right">
          <dt className="flex items-center justify-end gap-1.5 text-xs text-fg-muted">
            <span className="size-2 rounded-full bg-accent dark:bg-navy-300" aria-hidden />
            Utilidad
          </dt>
          <dd className="num font-medium text-fg">{dinero(utilidad)}</dd>
        </div>
      </dl>
      <p className="mt-3 border-t border-[var(--divider)] pt-3 text-xs text-fg-subtle">
        Calculado sobre <span className="num font-medium text-fg-muted">{dinero(base)}</span> antes de IVA.
      </p>
      {sinCosto > 0 ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-warning">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          {sinCosto === 1 ? '1 partida no tiene costo capturado' : `${sinCosto} partidas no tienen costo capturado`}: la utilidad real puede ser menor.
        </p>
      ) : null}
    </GlassPanel>
  )
}

const puntos: Record<TonoHito, string> = {
  hecho: 'bg-accent dark:bg-navy-300',
  pendiente: 'bg-transparent shadow-[inset_0_0_0_2px_rgb(var(--fg)/0.2)]',
  aviso: 'bg-warning',
  peligro: 'bg-danger',
}

export function ModuloHistorial({ c, visible }: { c: CotizacionCompleta; visible: EstadoCotizacionVisible }) {
  const hitos = hitosCotizacion(c, visible)
  let ultimoHecho = -1
  hitos.forEach((h, i) => {
    if (h.tono !== 'pendiente') ultimoHecho = i
  })

  return (
    <GlassPanel className="rounded-module p-5 sm:p-6">
      <TituloModulo>Historial</TituloModulo>
      <ol className="mt-4">
        {hitos.map((h, i) => {
          const actual = i === ultimoHecho && h.tono === 'hecho'
          const siguienteHecho = hitos[i + 1] && hitos[i + 1].tono !== 'pendiente'
          return (
            <li key={h.clave} className="relative flex gap-3.5 pb-5 last:pb-0">
              {i < hitos.length - 1 ? (
                <span
                  className={cn('absolute bottom-0 left-[6px] top-[1.15rem] w-0.5 rounded-full', siguienteHecho ? 'bg-accent/40 dark:bg-navy-300/40' : 'bg-fg/10')}
                  aria-hidden
                />
              ) : null}
              <span
                className={cn(
                  'relative mt-1 size-3.5 shrink-0 rounded-full',
                  actual ? 'bg-luz shadow-[0_0_0_4px_rgba(249,194,6,0.22),0_0_14px_rgba(249,194,6,0.7)]' : puntos[h.tono],
                )}
                aria-hidden
              />
              <div className="min-w-0">
                <p className={cn('text-sm font-medium', h.tono === 'pendiente' ? 'text-fg-subtle' : 'text-fg')}>
                  {h.titulo}
                  <span className="sr-only">{h.tono === 'pendiente' ? ' (pendiente)' : ''}</span>
                </p>
                {h.cuando ? <p className="num text-xs text-fg-muted">{h.cuando}</p> : null}
                {h.detalle ? <p className="text-xs text-fg-subtle">{h.detalle}</p> : null}
              </div>
            </li>
          )
        })}
      </ol>
    </GlassPanel>
  )
}

export function ModuloNotasInternas({ texto }: { texto: string }) {
  return (
    <GlassPanel className="rounded-module p-5 sm:p-6">
      <TituloModulo
        extra={
          <span className="inline-flex items-center gap-1 text-xs text-fg-subtle">
            <Lock className="size-3" aria-hidden />
            Solo el equipo
          </span>
        }
      >
        <span className="inline-flex items-center gap-2">
          <NotebookPen className="size-4 text-fg-subtle" aria-hidden />
          Notas internas
        </span>
      </TituloModulo>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-fg">{texto}</p>
    </GlassPanel>
  )
}
