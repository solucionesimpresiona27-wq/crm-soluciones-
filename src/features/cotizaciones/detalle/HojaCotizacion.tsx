import { Ruler } from 'lucide-react'
import { GlassPanel } from '@/components/glass'
import { Marca } from '@/components/shell/Marca'
import type { Configuracion, CotizacionCompleta, PartidaDoc } from '@/data/tipos'
import { describirMedidas } from '@/lib/calculadora'
import { cantidad, dinero, fechaLarga, telefono } from '@/lib/format'
import { cn } from '@/lib/utils'
import { anticipoDe } from './calculos'

function Medidas({ p }: { p: PartidaDoc }) {
  const texto = describirMedidas(p.metodo_calculo, p.ancho, p.alto, p.largo)
  if (!texto) return null
  return (
    <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-fg-subtle">
      <Ruler className="size-3.5 shrink-0" aria-hidden />
      <span className="num">{texto}</span>
    </span>
  )
}

function Etiqueta({ children }: { children: string }) {
  return <p className="mb-1.5 text-xs font-medium text-fg-subtle">{children}</p>
}

function FilaTotal({ etiqueta, valor, className }: { etiqueta: string; valor: string; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-6 py-1.5', className)}>
      <dt className="text-fg-muted">{etiqueta}</dt>
      <dd className="num whitespace-nowrap font-medium text-fg">{valor}</dd>
    </div>
  )
}

/**
 * La cotización tal como la recibe el cliente: misma estructura que el PDF
 * (membrete, datos del cliente, conceptos, totales y condiciones) sobre cristal fuerte.
 */
export function HojaCotizacion({ c, config }: { c: CotizacionCompleta; config: Configuracion | undefined }) {
  const empresa = config?.nombre_comercial ?? 'Soluciones Impresiona'
  const contacto = [
    config?.direccion,
    config?.ciudad,
    config?.whatsapp ? `WhatsApp ${telefono(config.whatsapp)}` : null,
    config?.telefono ? `Tel. ${telefono(config.telefono)}` : null,
    config?.email,
    config?.instagram,
    config?.sitio_web,
  ].filter(Boolean) as string[]
  const fiscal = config?.mostrar_datos_fiscales ? [config.razon_social, config.rfc ? `RFC ${config.rfc}` : null].filter(Boolean) : []
  const condiciones = (c.condiciones ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
  const anticipo = anticipoDe(c)
  const clienteFiscal = [c.cliente.razon_social, c.cliente.rfc ? `RFC ${c.cliente.rfc}` : null].filter(Boolean) as string[]
  const clienteContacto = [c.cliente.whatsapp ? `WhatsApp ${telefono(c.cliente.whatsapp)}` : null, c.cliente.email, [c.cliente.direccion, c.cliente.ciudad].filter(Boolean).join(', ') || null].filter(Boolean) as string[]

  return (
    <GlassPanel className="p-5 sm:p-8 xl:p-10" aria-label={`Documento de la cotización ${c.folio}`}>
      {/* Membrete */}
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Marca className="h-11 w-auto sm:h-12" />
          <address className="mt-4 max-w-xs text-sm not-italic leading-relaxed text-fg-muted">
            {fiscal.length ? <span className="block font-medium text-fg">{fiscal.join(', ')}</span> : null}
            {contacto.map((l) => (
              <span key={l} className="block">
                {l}
              </span>
            ))}
          </address>
        </div>
        <div className="sm:text-right">
          <p className="text-sm font-medium text-fg-muted">Cotización</p>
          <p className="num text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{c.folio}</p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm sm:grid-cols-[1fr_auto]">
            <dt className="text-fg-subtle">Fecha</dt>
            <dd className="text-fg">{fechaLarga(c.fecha)}</dd>
            <dt className="text-fg-subtle">Válida hasta</dt>
            <dd className="text-fg">{fechaLarga(c.fecha_vencimiento)}</dd>
          </dl>
        </div>
      </header>

      {/* Filete de marca: la luz del foco y el azul del logo */}
      <div className="mt-7 flex items-center gap-1.5" aria-hidden>
        <span className="h-[3px] w-14 rounded-full bg-luz shadow-[0_0_12px_rgba(249,194,6,0.55)]" />
        <span className="h-px flex-1 bg-accent/35 dark:bg-navy-300/30" />
      </div>

      {/* Cliente y condiciones de entrega */}
      <div className="mt-6 grid gap-6 sm:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0">
          <Etiqueta>Cliente</Etiqueta>
          <p className="text-md font-semibold text-fg">{c.cliente.nombre}</p>
          {clienteFiscal.length ? <p className="text-sm text-fg-muted">{clienteFiscal.join(', ')}</p> : null}
          {clienteContacto.map((l) => (
            <p key={l} className="text-sm text-fg-muted">
              {l}
            </p>
          ))}
        </div>
        <div className="grid content-start gap-4">
          {c.vendedor ? (
            <div>
              <Etiqueta>Atiende</Etiqueta>
              <p className="text-sm font-medium text-fg">{c.vendedor.nombre}</p>
              <p className="text-sm text-fg-muted">{c.vendedor.email}</p>
            </div>
          ) : null}
          {c.tiempo_entrega ? (
            <div>
              <Etiqueta>Tiempo de entrega</Etiqueta>
              <p className="text-sm text-fg">{c.tiempo_entrega}</p>
            </div>
          ) : null}
        </div>
      </div>

      {c.titulo ? (
        <p className="mt-7 text-lg font-semibold tracking-tight text-fg">{c.titulo}</p>
      ) : null}

      {/* Conceptos: tabla en pantallas medianas, lista en celular */}
      <div className={cn('hidden sm:block', c.titulo ? 'mt-3' : 'mt-7')}>
        <table className="tabla">
          <caption className="sr-only">Conceptos de la cotización</caption>
          <thead>
            <tr>
              <th scope="col" className="w-8 !pl-0 !pr-2">
                #
              </th>
              <th scope="col">Concepto</th>
              <th scope="col" className="whitespace-nowrap !text-right">
                Cantidad
              </th>
              <th scope="col" className="whitespace-nowrap !text-right">
                Precio unitario
              </th>
              <th scope="col" className="!pr-0 !text-right">
                Importe
              </th>
            </tr>
          </thead>
          <tbody>
            {c.partidas.map((p, i) => (
              <tr key={p.id}>
                <td className="num !pl-0 !pr-2 !align-top text-fg-subtle">{i + 1}</td>
                <td className="!align-top">
                  <p className="font-medium text-fg">{p.concepto}</p>
                  {p.descripcion ? <p className="mt-0.5 max-w-prose text-fg-muted">{p.descripcion}</p> : null}
                  <Medidas p={p} />
                </td>
                <td className="num whitespace-nowrap !align-top text-right text-fg">
                  {cantidad(p.cantidad)} <span className="text-fg-muted">{p.unidad}</span>
                </td>
                <td className="num whitespace-nowrap !align-top text-right text-fg">{dinero(p.precio_unitario)}</td>
                <td className="num whitespace-nowrap !pr-0 !align-top text-right">
                  <span className="font-semibold text-fg">{dinero(p.importe)}</span>
                  {p.descuento_pct > 0 ? <span className="block text-xs text-fg-muted">Desc. {cantidad(p.descuento_pct)} %</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className={cn('flex flex-col sm:hidden', c.titulo ? 'mt-3' : 'mt-6')} aria-label="Conceptos de la cotización">
        {c.partidas.map((p) => (
          <li key={p.id} className="border-t border-[var(--divider)] py-3.5 first:border-t-0 first:pt-1">
            <p className="font-medium text-fg">{p.concepto}</p>
            {p.descripcion ? <p className="mt-0.5 text-sm text-fg-muted">{p.descripcion}</p> : null}
            <Medidas p={p} />
            <div className="mt-2 flex items-baseline justify-between gap-3 text-sm">
              <span className="num text-fg-muted">
                {cantidad(p.cantidad)} {p.unidad} × {dinero(p.precio_unitario)}
                {p.descuento_pct > 0 ? `, desc. ${cantidad(p.descuento_pct)} %` : ''}
              </span>
              <span className="num whitespace-nowrap text-base font-semibold text-fg">{dinero(p.importe)}</span>
            </div>
          </li>
        ))}
      </ul>

      {/* Totales */}
      <div className="mt-4 flex justify-end border-t border-[var(--divider)] pt-4">
        <div className="w-full text-sm sm:w-[22rem]">
          <dl>
            <FilaTotal etiqueta="Subtotal" valor={dinero(c.subtotal)} />
            {c.descuento > 0 ? (
              <FilaTotal
                etiqueta={c.descuento_tipo === 'pct' ? `Descuento (${cantidad(c.descuento_valor)} %)` : 'Descuento'}
                valor={`−${dinero(c.descuento)}`}
              />
            ) : null}
            {c.recargo > 0 ? (
              <FilaTotal etiqueta={`${c.recargo_concepto || 'Recargo'} (${cantidad(c.recargo_pct)} %)`} valor={dinero(c.recargo)} />
            ) : null}
            {c.aplica_iva ? <FilaTotal etiqueta={`IVA (${cantidad(c.iva_pct)} %)`} valor={dinero(c.iva)} /> : null}
            <div className="mt-1.5 flex items-baseline justify-between gap-6 border-t border-[var(--divider)] pt-3">
              <dt className="text-base font-semibold text-fg">Total</dt>
              <dd className="num whitespace-nowrap text-xl font-semibold tracking-tight text-fg">{dinero(c.total)}</dd>
            </div>
          </dl>
          {!c.aplica_iva ? <p className="mt-1 text-right text-xs text-fg-subtle">Precios sin IVA</p> : null}
          {c.anticipo_pct > 0 ? (
            <div className="mt-3 flex items-center justify-between gap-4 rounded-full bg-luz/20 py-2 pl-4 pr-4 shadow-[inset_0_0_0_1px_rgba(249,194,6,0.35)] dark:bg-luz/10">
              <span className="font-medium text-fg">Anticipo para iniciar ({cantidad(c.anticipo_pct)} %)</span>
              <span className="num whitespace-nowrap font-semibold text-fg">{dinero(anticipo)}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Condiciones y notas */}
      {condiciones.length || c.notas ? (
        <div className={cn('mt-8 grid gap-6 border-t border-[var(--divider)] pt-6', condiciones.length && c.notas && 'lg:grid-cols-[1.5fr_1fr]')}>
          {condiciones.length ? (
            <div>
              <Etiqueta>Condiciones</Etiqueta>
              <ul className="flex max-w-[68ch] list-disc flex-col gap-1 pl-4 text-sm leading-relaxed text-fg-muted marker:text-fg-subtle">
                {condiciones.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {c.notas ? (
            <div>
              <Etiqueta>Notas</Etiqueta>
              <p className="whitespace-pre-line text-sm leading-relaxed text-fg">{c.notas}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <footer className="mt-8 text-center text-sm text-fg-muted">
        {config?.notas_pie_cotizacion ? <p className="font-medium text-fg">{config.notas_pie_cotizacion}</p> : null}
        <p className="mt-0.5 text-xs text-fg-subtle">{empresa}</p>
      </footer>
    </GlassPanel>
  )
}
