import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTema } from '@/app/tema'
import { GlassPanel } from '@/components/glass'
import { cn } from '@/lib/utils'
import { Subtitulo } from './piezas'

/** "rgb(34, 66, 107)" o "rgb(34 66 107 / 1)" → "#22426B" */
function aHex(color: string) {
  const n = color.match(/[\d.]+/g)?.slice(0, 3).map(Number)
  if (!n || n.length < 3) return ''
  return `#${n.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

/** Lee el color real que pinta el navegador, así la vitrina muestra el valor de cada tema. */
function useHexCalculado() {
  const ref = useRef<HTMLSpanElement>(null)
  const { efectivo } = useTema()
  const [hex, setHex] = useState('')
  useEffect(() => {
    // Un cuadro después: el tema se aplica a <html> en un efecto del proveedor
    const id = requestAnimationFrame(() => {
      if (ref.current) setHex(aHex(getComputedStyle(ref.current).backgroundColor))
    })
    return () => cancelAnimationFrame(id)
  }, [efectivo])
  return [ref, hex] as const
}

/* Las clases van completas para que Tailwind las genere */
const NAVY = [
  ['50', 'bg-navy-50'],
  ['100', 'bg-navy-100'],
  ['200', 'bg-navy-200'],
  ['300', 'bg-navy-300'],
  ['400', 'bg-navy-400'],
  ['500', 'bg-navy-500'],
  ['600', 'bg-navy-600'],
  ['700', 'bg-navy-700'],
  ['800', 'bg-navy-800'],
  ['900', 'bg-navy-900'],
  ['950', 'bg-navy-950'],
] as const

const AMBAR = [
  ['100', 'bg-amber-100'],
  ['200', 'bg-amber-200'],
  ['300', 'bg-amber-300'],
  ['400', 'bg-amber-400'],
  ['500', 'bg-amber-500'],
  ['600', 'bg-amber-600'],
  ['700', 'bg-amber-700'],
] as const

function Tono({ grado, clase, ancla, className }: { grado: string; clase: string; ancla?: string; className?: string }) {
  const [ref, hex] = useHexCalculado()
  return (
    <li className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span
        ref={ref}
        className={cn(
          'block h-12 rounded-chip shadow-[inset_0_0_0_1px_rgb(var(--line)/0.08)] sm:h-14',
          clase,
          ancla && 'ring-2 ring-fg/70 ring-offset-2 ring-offset-[var(--glass-bg-solid)]',
        )}
        aria-hidden
      />
      <span className="flex flex-col leading-tight">
        <span className="text-2xs font-semibold text-fg">{ancla ?? grado}</span>
        <span className="num text-2xs text-fg-muted">{hex}</span>
      </span>
    </li>
  )
}

const SEMANTICOS = [
  { nombre: 'Acción principal', uso: 'Botones y enlaces que avanzan', fuerte: 'bg-accent', suave: 'bg-accent-soft' },
  { nombre: 'Luz', uso: 'Encendido, destacado, pendiente', fuerte: 'bg-luz', suave: 'bg-luz-soft' },
  { nombre: 'Éxito', uso: 'Aceptado, pagado, entregado', fuerte: 'bg-success', suave: 'bg-success-soft' },
  { nombre: 'Aviso', uso: 'Por vencer o pausado', fuerte: 'bg-warning', suave: 'bg-warning-soft' },
  { nombre: 'Peligro', uso: 'Rechazado, vencido, eliminar', fuerte: 'bg-danger', suave: 'bg-danger-soft' },
] as const

const TEXTOS = [
  { nombre: 'Texto', clase: 'bg-fg' },
  { nombre: 'Secundario', clase: 'bg-fg-muted' },
  { nombre: 'Tenue', clase: 'bg-fg-subtle' },
] as const

function Swatch({ clase, className }: { clase: string; className?: string }) {
  const [ref, hex] = useHexCalculado()
  return (
    <span className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span ref={ref} className={cn('block h-11 rounded-chip shadow-[inset_0_0_0_1px_rgb(var(--line)/0.08)]', clase)} aria-hidden />
      <span className="num text-2xs text-fg-muted">{hex}</span>
    </span>
  )
}

const RADIOS = [
  { nombre: 'Panel', px: '32 px', clase: 'rounded-sheet' },
  { nombre: 'Módulo', px: '28 px', clase: 'rounded-module' },
  { nombre: 'Mosaico', px: '22 px', clase: 'rounded-tile' },
  { nombre: 'Campo', px: '16 px', clase: 'rounded-control' },
] as const

function Radios() {
  // Cada nivel dentro del anterior, del panel al botón cápsula
  const nivel = (i: number): ReactNode => {
    if (i === RADIOS.length) {
      return (
        <div className="flex h-10 items-center justify-between rounded-full bg-accent px-4 text-xs font-semibold text-accent-fg">
          <span>Botón</span>
          <span>cápsula</span>
        </div>
      )
    }
    const r = RADIOS[i]
    return (
      <div className={cn('flex flex-col gap-2 p-2.5 shadow-[inset_0_0_0_1px_rgb(var(--line)/0.12)] sm:p-3', r.clase, i % 2 ? 'bg-fg/[0.04]' : 'bg-[var(--control-bg)]')}>
        <div className="flex items-baseline justify-between px-1 text-xs">
          <span className="font-semibold text-fg">{r.nombre}</span>
          <span className="num text-fg-muted">{r.px}</span>
        </div>
        {nivel(i + 1)}
      </div>
    )
  }
  return nivel(0)
}

const SOMBRAS = [
  { nombre: 'Reposo', uso: 'Módulos y paneles', clase: 'shadow-glass' },
  { nombre: 'Al pasar el cursor', uso: 'Lo que se puede tocar', clase: 'shadow-lift' },
  { nombre: 'Elevada', uso: 'Ventanas y menús', clase: 'shadow-glass-lg' },
] as const

const ESCALA = [
  { nombre: 'Hero', px: 80, clase: 'text-hero', muestra: '$8,420', num: true },
  { nombre: 'Display', px: 56, clase: 'text-display', muestra: 'Cotizaciones', num: false },
  { nombre: '3xl', px: 40, clase: 'text-3xl', muestra: 'Buenas tardes, Ana', num: false },
  { nombre: '2xl', px: 30, clase: 'text-2xl', muestra: 'Ventas de octubre', num: false },
  { nombre: 'xl', px: 24, clase: 'text-xl', muestra: 'Taller Mecánico Rueda', num: false },
  { nombre: 'lg', px: 20, clase: 'text-lg', muestra: 'Rotulación de camioneta', num: false },
  { nombre: 'md', px: 17, clase: 'text-md', muestra: 'Lona front 13 oz, 3.00 × 1.50 m', num: false },
  { nombre: 'base', px: 15, clase: 'text-base', muestra: 'Entrega el viernes 16 de octubre en Zapopan.', num: false },
  { nombre: 'sm', px: 13, clase: 'text-sm', muestra: 'Precio por metro cuadrado, antes de IVA.', num: false },
  { nombre: 'xs', px: 12, clase: 'text-xs', muestra: 'Actualizado hace 5 minutos', num: false },
  { nombre: '2xs', px: 11, clase: 'text-2xs', muestra: 'PED-0033', num: true },
] as const

const PESOS = [
  { nombre: 'Regular', clase: 'font-normal' },
  { nombre: 'Media', clase: 'font-medium' },
  { nombre: 'Seminegrita', clase: 'font-semibold' },
  { nombre: 'Negrita', clase: 'font-bold' },
] as const

/** Tokens: color, radios, sombras y tipografía. */
export function MuestrarioTokens() {
  return (
    <GlassPanel className="flex flex-col gap-7 p-4 sm:p-6">
      {/* Color de marca */}
      <div className="flex flex-col gap-4">
        <Subtitulo detalle="Del logo: el azul del texto y la luz del foco">Color de marca</Subtitulo>
        <ul className="grid grid-cols-6 gap-2 sm:grid-cols-11">
          {NAVY.map(([g, c]) => (
            <Tono key={g} grado={g} clase={c} ancla={g === '600' ? 'Azul 600' : undefined} />
          ))}
        </ul>
        <ul className="grid grid-cols-6 gap-2 sm:grid-cols-11">
          {AMBAR.map(([g, c]) => (
            // El 100 del ámbar queda bajo el 100 del azul
            <Tono key={g} grado={g} clase={c} ancla={g === '400' ? 'Luz 400' : undefined} className={g === '100' ? 'sm:col-start-2' : undefined} />
          ))}
        </ul>
      </div>

      <div className="hairline" />

      {/* Semánticos */}
      <div className="flex flex-col gap-4">
        <Subtitulo detalle="Cambian con el modo claro u oscuro; el valor es el de ahora">Colores con significado</Subtitulo>
        <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <div className="flex flex-col gap-2">
            <div>
              <p className="text-sm font-semibold text-fg">Texto</p>
              <p className="text-xs text-fg-muted">Principal, secundario y tenue</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {TEXTOS.map((t) => (
                <Swatch key={t.nombre} clase={t.clase} />
              ))}
            </div>
          </div>
          {SEMANTICOS.map((s) => (
            <div key={s.nombre} className="flex flex-col gap-2">
              <div>
                <p className="text-sm font-semibold text-fg">{s.nombre}</p>
                <p className="text-xs text-fg-muted">{s.uso}</p>
              </div>
              <div className="grid grid-cols-[2fr_1fr] gap-2">
                <Swatch clase={s.fuerte} />
                <Swatch clase={s.suave} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="hairline" />

      {/* Radios y sombras */}
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Subtitulo detalle="Lo de adentro siempre es más redondo que su contenedor">Radios concéntricos</Subtitulo>
          <Radios />
        </div>
        <div className="flex flex-col gap-4">
          <Subtitulo detalle="Más sombra, más cerca de ti">Sombras</Subtitulo>
          <div className="grid flex-1 grid-cols-3 gap-3 sm:gap-5">
            {SOMBRAS.map((s) => (
              <div key={s.nombre} className="flex flex-col gap-3">
                <div className={cn('aspect-square rounded-tile bg-[var(--glass-bg-solid)] sm:aspect-[4/3]', s.clase)} aria-hidden />
                <div>
                  <p className="text-sm font-semibold leading-tight text-fg">{s.nombre}</p>
                  <p className="text-xs text-fg-muted">{s.uso}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="hairline" />

      {/* Tipografía */}
      <div className="flex flex-col gap-4">
        <Subtitulo detalle="Figtree, con cifras tabulares en montos y tablas">Tipografía</Subtitulo>
        <p className="flex flex-wrap gap-x-5 gap-y-1 text-md text-fg">
          {PESOS.map((p) => (
            <span key={p.nombre} className={p.clase}>
              {p.nombre}
            </span>
          ))}
        </p>
        <ol className="flex flex-col">
          {ESCALA.map((e) => (
            <li
              key={e.nombre}
              className="grid items-baseline gap-x-6 gap-y-1 border-t border-[var(--divider)] py-3 first:border-t-0 sm:grid-cols-[7.5rem_minmax(0,1fr)]"
            >
              <span className="text-xs text-fg-muted">
                <span className="font-semibold text-fg">{e.nombre}</span> <span className="num">{e.px} px</span>
              </span>
              <span className={cn('min-w-0 truncate font-semibold tracking-tight text-fg', e.clase, e.num && 'num', e.px < 20 && 'font-normal tracking-normal')}>
                {e.muestra}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </GlassPanel>
  )
}
