import { Lightbulb, MessageCircle } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { GlassButton, GlassPanel } from '@/components/glass'
import type { PartidaPortal, VistaPortal } from '@/data/modulos/portal/contrato'
import { cantidad, dinero } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { enlaceWhatsApp } from '@/lib/whatsapp'

export const LIMITE_NOMBRE = 120
export const LIMITE_COMENTARIO = 1000

/** Título de módulo dentro del portal. */
export function TituloSeccion({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold tracking-tight text-fg">{children}</h2>
      {extra}
    </div>
  )
}

/** Fila etiqueta / valor para resúmenes. */
export function Fila({ etiqueta, children, fuerte }: { etiqueta: ReactNode; children: ReactNode; fuerte?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-2.5', fuerte && 'pt-3')}>
      <dt className={cn('text-sm text-fg-muted', fuerte && 'font-semibold text-fg')}>{etiqueta}</dt>
      <dd className={cn('num text-right text-sm text-fg', fuerte && 'text-base font-semibold')}>{children}</dd>
    </div>
  )
}

function medidas(p: PartidaPortal) {
  if (p.ancho && p.alto) return `${cantidad(p.ancho)} × ${cantidad(p.alto)} m`
  if (p.largo) return `${cantidad(p.largo)} m`
  return null
}

/** Conceptos para el cliente: tarjetas en celular, tabla en escritorio. Sin costos. */
export function Conceptos({ partidas }: { partidas: PartidaPortal[] }) {
  const lista = [...partidas].sort((a, b) => a.orden - b.orden)
  return (
    <>
      <ul className="divide-y divide-[var(--divider)] sm:hidden">
        {lista.map((p) => (
          <li key={p.orden} className="py-3.5">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 font-medium text-fg">{p.concepto}</p>
              <p className="num shrink-0 font-semibold text-fg">{dinero(p.importe)}</p>
            </div>
            {p.descripcion ? <p className="mt-0.5 text-sm text-fg-muted">{p.descripcion}</p> : null}
            <p className="num mt-1 text-xs text-fg-subtle">
              {cantidad(p.cantidad)} {p.unidad}
              {medidas(p) ? ` · ${medidas(p)}` : ''} · {dinero(p.precio_unitario)} c/u
              {p.descuento_pct > 0 ? ` · ${cantidad(p.descuento_pct)} % desc.` : ''}
            </p>
          </li>
        ))}
      </ul>
      <table className="tabla hidden w-full sm:table">
        <thead>
          <tr>
            <th className="text-left">Concepto</th>
            <th className="text-right">Cantidad</th>
            <th className="text-right">Precio</th>
            <th className="text-right">Importe</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((p) => (
            <tr key={p.orden}>
              <td>
                <span className="block font-medium text-fg">{p.concepto}</span>
                {p.descripcion || medidas(p) ? (
                  <span className="block text-xs text-fg-subtle">{[medidas(p), p.descripcion].filter(Boolean).join(' · ')}</span>
                ) : null}
              </td>
              <td className="num text-right">
                {cantidad(p.cantidad)} <span className="text-fg-subtle">{p.unidad}</span>
              </td>
              <td className="num text-right">
                {dinero(p.precio_unitario)}
                {p.descuento_pct > 0 ? <span className="block text-xs text-fg-subtle">−{cantidad(p.descuento_pct)} %</span> : null}
              </td>
              <td className="num text-right font-semibold text-fg">{dinero(p.importe)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/**
 * Foco de la marca: apagado mientras espera, se "enciende" (luz amarilla) al aprobar.
 * Es la única audacia visual del portal.
 */
export function Foco({ encendido, className }: { encendido: boolean; className?: string }) {
  const reducir = useReducedMotion()
  return (
    <div className={cn('relative grid size-16 shrink-0 place-items-center', className)} aria-hidden>
      <AnimatePresence>
        {encendido ? (
          <motion.span
            key="halo"
            className="absolute inset-[-14px] rounded-full bg-[radial-gradient(circle,rgba(249,194,6,0.55),rgba(249,194,6,0)_70%)]"
            initial={reducir ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={resorte.expansion}
          />
        ) : null}
      </AnimatePresence>
      <motion.span
        className={cn(
          'relative grid size-16 place-items-center rounded-full transition-colors duration-300',
          encendido ? 'bg-luz text-luz-fg shadow-[0_10px_30px_-8px_rgba(249,194,6,0.8)]' : 'glass glass-thick text-fg-subtle',
        )}
        initial={false}
        animate={encendido && !reducir ? { scale: [1, 1.12, 1] } : { scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Lightbulb className="size-7" strokeWidth={encendido ? 2.4 : 1.8} />
      </motion.span>
    </div>
  )
}

/** Datos de contacto de la empresa y botón de WhatsApp. */
export function ContactoEmpresa({ empresa, folio }: { empresa: VistaPortal['empresa']; folio: string }) {
  const tel = empresa.whatsapp ?? empresa.telefono
  const fiscales = empresa.razon_social || empresa.rfc
  return (
    <GlassPanel className="rounded-module p-5 sm:p-6">
      <TituloSeccion>¿Tienes dudas?</TituloSeccion>
      <p className="mt-1 text-sm text-fg-muted">Escríbenos y con gusto te ayudamos con tu {folio}.</p>
      {tel ? (
        <GlassButton
          variante="cristal"
          tamano="lg"
          className="mt-4 w-full"
          icono={<MessageCircle />}
          onClick={() => window.open(enlaceWhatsApp(tel, `Hola, tengo una pregunta sobre ${folio}.`), '_blank', 'noopener,noreferrer')}
        >
          Escribir por WhatsApp
        </GlassButton>
      ) : null}
      <dl className="mt-4 divide-y divide-[var(--divider)] border-t border-[var(--divider)] text-sm">
        {empresa.telefono ? (
          <Fila etiqueta="Teléfono">
            <a className="rounded-sm font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" href={`tel:${empresa.telefono.replace(/[^\d+]/g, '')}`}>
              {empresa.telefono}
            </a>
          </Fila>
        ) : null}
        {empresa.email ? (
          <Fila etiqueta="Correo">
            <a className="rounded-sm font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" href={`mailto:${empresa.email}`}>
              {empresa.email}
            </a>
          </Fila>
        ) : null}
        {empresa.direccion || empresa.ciudad ? <Fila etiqueta="Dirección">{[empresa.direccion, empresa.ciudad].filter(Boolean).join(', ')}</Fila> : null}
        {fiscales ? (
          <Fila etiqueta="Datos fiscales">
            {[empresa.razon_social, empresa.rfc, empresa.regimen_fiscal].filter(Boolean).join(' · ')}
          </Fila>
        ) : null}
      </dl>
      {empresa.datos_bancarios ? (
        <div className="mt-4 rounded-tile bg-accent-soft/40 p-4">
          <p className="text-xs font-semibold text-fg-muted">Datos para transferencia</p>
          <p className="mt-1 whitespace-pre-line text-sm text-fg">{empresa.datos_bancarios}</p>
        </div>
      ) : null}
    </GlassPanel>
  )
}
