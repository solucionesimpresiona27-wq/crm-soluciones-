import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react'
import { GlassInput, type GlassInputProps } from '@/components/glass/GlassField'
import { cn } from '@/lib/utils'
import type { Num } from './modelo'

/* ---------------------------------------------------------------------
   Campo numérico: guarda el texto mientras se escribe ("1." o "") y
   entrega el número ya interpretado. Acepta "$1,250.50" o "15 %".
   --------------------------------------------------------------------- */

function interpretar(texto: string, min: number, max: number | undefined): Num | undefined {
  const limpio = texto.replace(/[\s,$%]/g, '').replace(/^-/, '')
  if (limpio === '') return null
  const v = Number(limpio)
  if (!Number.isFinite(v)) return undefined
  return Math.min(max ?? Infinity, Math.max(min, v))
}

function mostrar(v: Num, fijos: number | undefined) {
  if (v === null) return ''
  return fijos !== undefined ? v.toFixed(fijos) : String(Math.round(v * 10000) / 10000)
}

export interface CampoNumeroProps extends Omit<GlassInputProps, 'value' | 'onChange' | 'type' | 'min' | 'max'> {
  valor: Num
  onValor: (v: Num) => void
  min?: number
  max?: number
  /** Decimales fijos al salir del campo (p. ej. 2 para dinero) */
  fijos?: number
  prefijo?: ReactNode
}

export const CampoNumero = forwardRef<HTMLInputElement, CampoNumeroProps>(function CampoNumero(
  { valor, onValor, min = 0, max, fijos, prefijo, className, onFocus, onBlur, ...props },
  ref,
) {
  const [texto, setTexto] = useState(() => mostrar(valor, fijos))
  const enfocado = useRef(false)

  // Cambios que llegan de fuera (calculadora, otro campo): se reflejan si no se está escribiendo aquí.
  useEffect(() => {
    if (enfocado.current) return
    setTexto(mostrar(valor, fijos))
  }, [valor, fijos])

  return (
    <GlassInput
      ref={ref}
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      icono={prefijo ? <span className="text-sm font-medium">{prefijo}</span> : undefined}
      value={texto}
      onChange={(e) => {
        setTexto(e.target.value)
        const v = interpretar(e.target.value, min, max)
        if (v !== undefined) onValor(v)
      }}
      onFocus={(e) => {
        enfocado.current = true
        onFocus?.(e)
      }}
      onBlur={(e) => {
        enfocado.current = false
        setTexto(mostrar(valor, fijos))
        onBlur?.(e)
      }}
      className={cn('num text-right', prefijo && 'pl-8', className)}
    />
  )
})

/* ---------------------------------------------------------------------
   Encabezado de sección: ícono en pozo circular, título y ayuda breve
   --------------------------------------------------------------------- */

export function EncabezadoSeccion({
  icono,
  titulo,
  descripcion,
  extra,
  id,
  className,
}: {
  icono: ReactNode
  titulo: string
  descripcion?: ReactNode
  extra?: ReactNode
  id?: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <span
        className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--control-bg)] text-fg-muted shadow-[inset_0_1px_0_var(--inner-hi)] [&_svg]:size-[1.15rem]"
        aria-hidden
      >
        {icono}
      </span>
      <div className="min-w-0 flex-1">
        <h2 id={id} className="text-md font-semibold tracking-tight text-fg">
          {titulo}
        </h2>
        {descripcion ? <p className="text-sm text-fg-muted">{descripcion}</p> : null}
      </div>
      {extra ? <div className="flex shrink-0 items-center gap-2">{extra}</div> : null}
    </div>
  )
}

/** Subtítulo dentro de una sección. */
export function Subtitulo({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('text-sm font-semibold text-fg', className)}>{children}</h3>
}

/** Atajo de teclado legible según el sistema. */
export function Atajo({ tecla, className }: { tecla: string; className?: string }) {
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  return (
    <kbd className={cn('rounded-md bg-fg/[0.06] px-1.5 py-0.5 font-sans text-2xs font-semibold text-fg-subtle', className)}>
      {mac ? '⌘' : 'Ctrl'} {tecla}
    </kbd>
  )
}

/** Bandeja hundida para agrupar controles dentro de un cristal (como el pozo de un control). */
export const clasesBandeja =
  'rounded-tile bg-[rgb(var(--line)/0.035)] shadow-[inset_0_1px_3px_rgb(var(--line)/0.07),inset_0_0_0_1px_rgb(var(--line)/0.05)]'
