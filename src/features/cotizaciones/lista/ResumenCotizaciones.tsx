import { AlarmClock, CalendarCheck, Handshake, Wallet } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { AnimatedNumber, GlassSurface, GlassToggle, Skeleton } from '@/components/glass'
import { dinero, porcentaje } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { DIAS_AVISO, DIAS_TASA, type Resumen } from './datos'

/** Cápsula informativa con pozo circular, misma anatomía que GlassToggle (Centro de Control). */
function Capsula({ pozo, titulo, subtitulo, className }: { pozo: ReactNode; titulo: ReactNode; subtitulo: ReactNode; className?: string }) {
  return (
    <GlassSurface grueso lente="capsula" className={cn('flex h-16 min-w-0 items-center gap-3 rounded-full pl-2 pr-5', className)}>
      {pozo}
      <span className="min-w-0">
        <span className="block truncate text-base font-semibold text-fg">{titulo}</span>
        <span className="block truncate text-xs text-fg-muted">{subtitulo}</span>
      </span>
    </GlassSurface>
  )
}

function Pozo({ children }: { children: ReactNode }) {
  return (
    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--control-bg)] text-fg [&_svg]:size-[1.35rem]" aria-hidden>
      {children}
    </span>
  )
}

/** Medidor circular: el anillo se llena en azul de marca sobre un riel del mismo azul, más claro. */
function AnilloTasa({ valor }: { valor: number }) {
  const reducir = useReducedMotion()
  return (
    <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-[var(--control-bg)] text-accent dark:text-navy-300" aria-hidden>
      <svg viewBox="0 0 48 48" className="absolute inset-0 size-12 -rotate-90">
        <circle cx="24" cy="24" r="19" fill="none" stroke="currentColor" strokeOpacity={0.16} strokeWidth={4} />
        <motion.circle
          cx="24"
          cy="24"
          r="19"
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          strokeLinecap="round"
          initial={reducir ? false : { pathLength: 0 }}
          animate={{ pathLength: Math.max(0.001, valor) }}
          transition={{ ...resorte.expansion, delay: reducir ? 0 : 0.2 }}
        />
      </svg>
      <Handshake className="size-[1.05rem] text-fg" />
    </span>
  )
}

export function ResumenCotizaciones({
  resumen,
  porVencerActivo,
  onPorVencer,
}: {
  resumen: Resumen
  porVencerActivo: boolean
  onPorVencer: (activo: boolean) => void
}) {
  const { abierto, abiertas, porVencer, aceptadas, cerradas, tasa } = resumen

  return (
    <section
      aria-label="Resumen de cotizaciones"
      className="-mx-3 -my-2 flex snap-x snap-mandatory scroll-px-3 gap-2.5 overflow-x-auto px-3 py-2 [scrollbar-width:none] sm:mx-0 sm:my-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:py-0 [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 [&>*]:snap-start"
    >
      <Capsula
        className="pr-7"
        pozo={
          <Pozo>
            <Wallet />
          </Pozo>
        }
        titulo={<AnimatedNumber valor={abierto} formato={dinero} className="num text-md" />}
        subtitulo={abiertas === 1 ? 'Cotizado en 1 abierta' : `Cotizado en ${abiertas} abiertas`}
      />

      {porVencer > 0 ? (
        <GlassToggle
          icono={<AlarmClock className={porVencerActivo ? undefined : 'text-warning'} />}
          titulo={`${porVencer} por vencer`}
          subtitulo={`En ${DIAS_AVISO} días o menos`}
          activo={porVencerActivo}
          onCambio={onPorVencer}
          tono="luz"
        />
      ) : (
        <Capsula
          pozo={
            <Pozo>
              <CalendarCheck />
            </Pozo>
          }
          titulo="Nada por vencer"
          subtitulo={`En los próximos ${DIAS_AVISO} días`}
        />
      )}

      <Capsula
        pozo={<AnilloTasa valor={tasa ?? 0} />}
        titulo={tasa === null ? 'Sin cierres aún' : `${porcentaje(tasa * 100)} aceptadas`}
        subtitulo={tasa === null ? `Últimos ${DIAS_TASA} días` : `${aceptadas} de ${cerradas} en ${DIAS_TASA} días`}
      />
    </section>
  )
}

export function ResumenCargando() {
  return (
    <div className="flex gap-2.5 overflow-hidden" aria-hidden>
      <Skeleton className="h-16 w-64 shrink-0 rounded-full" />
      <Skeleton className="h-16 w-52 shrink-0 rounded-full" />
      <Skeleton className="h-16 w-52 shrink-0 rounded-full" />
    </div>
  )
}
