import { ChevronDown } from 'lucide-react'
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface CampoProps {
  etiqueta?: ReactNode
  ayuda?: ReactNode
  error?: string | null
  /** Se pasa el id para conectar etiqueta y control */
  children: (id: string, props: { 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode
  className?: string
  opcional?: boolean
}

/** Etiqueta + control + ayuda/error, conectados para lectores de pantalla. */
export function Campo({ etiqueta, ayuda, error, children, className, opcional }: CampoProps) {
  const id = useId()
  const descId = `${id}-desc`
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {etiqueta ? (
        <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-sm font-medium text-fg-muted">
          <span>{etiqueta}</span>
          {opcional ? <span className="text-xs font-normal text-fg-subtle">Opcional</span> : null}
        </label>
      ) : null}
      {children(id, {
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error || ayuda ? descId : undefined,
      })}
      {error ? (
        <p id={descId} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : ayuda ? (
        <p id={descId} className="text-xs text-fg-subtle">
          {ayuda}
        </p>
      ) : null}
    </div>
  )
}

export interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  icono?: ReactNode
  sufijo?: ReactNode
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(function GlassInput(
  { className, icono, sufijo, ...props },
  ref,
) {
  if (!icono && !sufijo) return <input ref={ref} className={cn('field', className)} {...props} />
  return (
    <div className="relative">
      {icono ? (
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle [&_svg]:size-[1.1rem]">
          {icono}
        </span>
      ) : null}
      <input ref={ref} className={cn('field', icono && 'pl-10', sufijo && 'pr-12', className)} {...props} />
      {sufijo ? (
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-fg-subtle">{sufijo}</span>
      ) : null}
    </div>
  )
})

export const GlassTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function GlassTextarea({ className, rows = 3, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cn('field resize-y py-2.5 leading-relaxed', className)} {...props} />
  },
)

export const GlassSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function GlassSelect(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn('field cursor-pointer appearance-none pr-10', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
    </div>
  )
})
