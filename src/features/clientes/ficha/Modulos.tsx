import { AtSign, Building2, Clock, CreditCard, FileText, Mail, MapPin, MessageCircle, NotebookPen, PencilLine, Phone, Plus, Star, Trash2, UserRound } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { AnimatedNumber, GlassButton, GlassIconButton, GlassPanel, GlassTextarea, Pildora, SegmentedControl, Skeleton } from '@/components/glass'
import { LISTAS_PRECIO, type Cliente, type Contacto, type ListaPrecio, type ResumenCliente } from '@/data/modulos/clientes/contrato'
import { dinero, fecha, telefono } from '@/lib/format'
import { cn } from '@/lib/utils'
import { enlaceWhatsApp } from '@/lib/whatsapp'
import { useActualizarCliente, useAsignarLista, useEliminarContacto } from '../consultas'
import { UltimaCompra } from '../piezas'
import { USOS_CFDI } from './EditarClienteModal'

export function TituloModulo({ children, extra, id }: { children: ReactNode; extra?: ReactNode; id?: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <h3 id={id} className="text-base font-semibold tracking-tight text-fg">
        {children}
      </h3>
      {extra}
    </div>
  )
}

function Dato({ icono, etiqueta, children }: { icono: ReactNode; etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 text-fg-subtle [&_svg]:size-4" aria-hidden>
        {icono}
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-fg-subtle">{etiqueta}</dt>
        <dd className="break-words text-sm font-medium text-fg">{children}</dd>
      </div>
    </div>
  )
}

const dineroRedondo = (v: number) => (n: number) => dinero(Math.abs(v - n) <= Math.abs(v) * 0.002 ? v : n)

/** Resumen 360: el saldo pendiente es la cifra protagonista (o lo comprado si ya está al corriente). */
export function ModuloResumen({ r, cargando, conPrecios }: { r: ResumenCliente | undefined; cargando: boolean; conPrecios: boolean }) {
  if (cargando || !r) {
    return (
      <GlassPanel className="rounded-module p-5 sm:p-6" aria-label="Cargando resumen">
        <Skeleton className="h-4 w-32 rounded-full" />
        <Skeleton className="mt-3 h-10 w-56 rounded-full" />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-tile" />
          ))}
        </div>
      </GlassPanel>
    )
  }
  const saldo = r.saldo ?? 0
  const debe = conPrecios && saldo > 0.009
  const ticket = conPrecios && r.pedidos > 0 ? (r.total_comprado ?? 0) / r.pedidos : null
  const cifras: Array<{ etiqueta: string; valor: ReactNode; sub?: string }> = conPrecios
    ? [
        { etiqueta: 'Comprado', valor: dinero(r.total_comprado) },
        { etiqueta: 'Pagado', valor: dinero(r.total_pagado) },
        { etiqueta: 'Pedidos', valor: r.pedidos, sub: r.pedidos_activos ? `${r.pedidos_activos} en curso` : undefined },
        { etiqueta: 'Ticket promedio', valor: ticket !== null ? dinero(ticket) : '—' },
      ]
    : [
        { etiqueta: 'Pedidos', valor: r.pedidos },
        { etiqueta: 'En curso', valor: r.pedidos_activos },
        { etiqueta: 'Cotizaciones', valor: r.cotizaciones },
      ]

  return (
    <GlassPanel className="relative overflow-hidden rounded-module p-5 sm:p-6" aria-labelledby="titulo-resumen">
      <h3 id="titulo-resumen" className="sr-only">
        Resumen del cliente
      </h3>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {conPrecios ? (
            <>
              <p className="flex items-center gap-2 text-sm font-medium text-fg-muted">
                {debe ? <span className="size-2 rounded-full bg-luz shadow-[0_0_10px_rgba(249,194,6,0.9)]" aria-hidden /> : null}
                {debe ? 'Saldo pendiente' : 'Total comprado'}
              </p>
              <AnimatedNumber
                valor={debe ? saldo : (r.total_comprado ?? 0)}
                formato={dineroRedondo(debe ? saldo : (r.total_comprado ?? 0))}
                className="glass-text num mt-1 block text-[2.5rem] font-semibold leading-[1.1] tracking-tight sm:text-[2.75rem] sm:leading-[1.1]"
              />
              <p className="mt-1 text-xs text-fg-subtle">{debe ? 'Suma de pedidos con saldo por cobrar' : saldo <= 0 && r.pedidos ? 'Al corriente: sin saldo por cobrar' : 'Aún sin pedidos'}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-fg-muted">Última compra</p>
              <p className="mt-1 text-3xl font-semibold leading-tight tracking-tight text-fg">
                <UltimaCompra iso={r.ultima_compra} />
              </p>
            </>
          )}
        </div>
        {conPrecios ? (
          <div className="text-right text-sm">
            <p className="text-fg-subtle">Última compra</p>
            <p className="font-semibold text-fg">
              <UltimaCompra iso={r.ultima_compra} />
            </p>
            {r.ultima_compra ? <p className="text-xs text-fg-subtle">{fecha(r.ultima_compra)}</p> : null}
          </div>
        ) : null}
      </div>
      <dl className={cn('mt-5 grid gap-px overflow-hidden rounded-tile bg-[var(--divider)]', cifras.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3')}>
        {cifras.map((c) => (
          <div key={c.etiqueta} className="bg-[var(--field-bg)] px-3.5 py-3">
            <dt className="text-xs text-fg-subtle">{c.etiqueta}</dt>
            <dd className="num mt-0.5 truncate text-md font-semibold tracking-tight text-fg">{c.valor}</dd>
            {c.sub ? <dd className="text-xs text-fg-muted">{c.sub}</dd> : null}
          </div>
        ))}
      </dl>
      {conPrecios && (r.cotizado_abierto ?? 0) > 0 ? (
        <p className="mt-3 text-sm text-fg-muted">
          Cotizaciones abiertas por <span className="num font-semibold text-fg">{dinero(r.cotizado_abierto)}</span>
        </p>
      ) : null}
    </GlassPanel>
  )
}

export function ModuloDatosContacto({ c, puedeEditar, onEditar }: { c: Cliente; puedeEditar: boolean; onEditar: () => void }) {
  const vacio = !c.whatsapp && !c.telefono && !c.email && !c.direccion && !c.ciudad
  return (
    <GlassPanel className="rounded-module p-5">
      <TituloModulo
        extra={puedeEditar ? <GlassIconButton etiqueta="Editar datos de contacto" icono={<PencilLine />} tamano="sm" onClick={onEditar} /> : null}
      >
        Datos de contacto
      </TituloModulo>
      {vacio ? (
        <p className="mt-2 text-sm text-fg-muted">Sin datos de contacto. {puedeEditar ? 'Agrega el WhatsApp para enviarle cotizaciones.' : ''}</p>
      ) : (
        <dl className="mt-1 divide-y divide-[var(--divider)]">
          {c.whatsapp ? (
            <Dato icono={<MessageCircle />} etiqueta="WhatsApp">
              <a href={enlaceWhatsApp(c.whatsapp, '')} target="_blank" rel="noopener noreferrer" className="num rounded-full outline-none hover:underline">
                {telefono(c.whatsapp)}
              </a>
            </Dato>
          ) : null}
          {c.telefono ? (
            <Dato icono={<Phone />} etiqueta="Teléfono">
              <a href={`tel:${c.telefono.replace(/[^\d+]/g, '')}`} className="num rounded-full outline-none hover:underline">
                {telefono(c.telefono)}
              </a>
            </Dato>
          ) : null}
          {c.email ? (
            <Dato icono={<Mail />} etiqueta="Correo">
              <a href={`mailto:${c.email}`} className="rounded-full outline-none hover:underline">
                {c.email}
              </a>
            </Dato>
          ) : null}
          {c.direccion || c.ciudad ? (
            <Dato icono={<MapPin />} etiqueta="Dirección">
              {[c.direccion, c.ciudad].filter(Boolean).join(', ')}
            </Dato>
          ) : null}
        </dl>
      )}
      <dl className="mt-1 divide-y divide-[var(--divider)] border-t border-[var(--divider)]">
        <Dato icono={<UserRound />} etiqueta="Vendedor">
          {c.vendedor?.nombre ?? 'Sin asignar'}
        </Dato>
        <Dato icono={<CreditCard />} etiqueta="Crédito">
          {c.dias_credito > 0 ? `${c.dias_credito} días` : 'De contado'}
        </Dato>
        {c.origen ? (
          <Dato icono={<Star />} etiqueta="Cómo nos conoció">
            {c.origen}
          </Dato>
        ) : null}
        <Dato icono={<Clock />} etiqueta="Cliente desde">
          {fecha(c.created_at)}
        </Dato>
      </dl>
    </GlassPanel>
  )
}

export function ModuloFiscal({ c, puedeEditar, onEditar }: { c: Cliente; puedeEditar: boolean; onEditar: () => void }) {
  const hayDatos = Boolean(c.rfc || c.razon_social || c.regimen_fiscal || c.codigo_postal_fiscal)
  return (
    <GlassPanel className="rounded-module p-5" aria-labelledby="titulo-fiscal">
      <TituloModulo
        id="titulo-fiscal"
        extra={puedeEditar ? <GlassIconButton etiqueta="Editar datos fiscales" icono={<PencilLine />} tamano="sm" onClick={onEditar} /> : null}
      >
        Datos fiscales
      </TituloModulo>
      <div className="mt-1">
        <Pildora tono={c.requiere_factura ? 'acento' : 'neutro'}>{c.requiere_factura ? 'Requiere factura' : 'Sin factura'}</Pildora>
      </div>
      {hayDatos ? (
        <dl className="mt-2 divide-y divide-[var(--divider)]">
          <Dato icono={<FileText />} etiqueta="RFC">
            <span className="num tracking-wide">{c.rfc ?? '—'}</span>
          </Dato>
          {c.razon_social ? (
            <Dato icono={<Building2 />} etiqueta="Razón social">
              {c.razon_social}
            </Dato>
          ) : null}
          {c.regimen_fiscal ? (
            <Dato icono={<FileText />} etiqueta="Régimen">
              {c.regimen_fiscal}
            </Dato>
          ) : null}
          {c.codigo_postal_fiscal || c.uso_cfdi ? (
            <Dato icono={<MapPin />} etiqueta="CP fiscal · Uso de CFDI">
              <span className="num">{c.codigo_postal_fiscal ?? '—'}</span> · {c.uso_cfdi ? `${c.uso_cfdi} ${USOS_CFDI[c.uso_cfdi] ? `(${USOS_CFDI[c.uso_cfdi]})` : ''}` : '—'}
            </Dato>
          ) : null}
          {c.email_facturacion ? (
            <Dato icono={<AtSign />} etiqueta="Correo para facturas">
              {c.email_facturacion}
            </Dato>
          ) : null}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-fg-muted">
          {c.requiere_factura ? 'Faltan el RFC y la razón social para poder facturar.' : 'Sin datos fiscales registrados.'}
          {puedeEditar ? (
            <>
              {' '}
              <button type="button" onClick={onEditar} className="rounded-full font-medium text-accent outline-none hover:underline dark:text-navy-200">
                Capturarlos
              </button>
            </>
          ) : null}
        </p>
      )}
    </GlassPanel>
  )
}

export function ModuloListaPrecio({ c, puedeEditar }: { c: Cliente; puedeEditar: boolean }) {
  const asignar = useAsignarLista(c.id)
  const [valor, setValor] = useState<ListaPrecio>(c.lista_precio)
  useEffect(() => setValor(c.lista_precio), [c.lista_precio])
  return (
    <GlassPanel className="rounded-module p-5">
      <TituloModulo>Lista de precios</TituloModulo>
      {puedeEditar ? (
        <>
          <SegmentedControl
            etiqueta="Lista de precios del cliente"
            tamano="sm"
            valor={valor}
            className="mt-1 w-full [&>*]:flex-1"
            onCambio={(v) => {
              setValor(v)
              asignar.mutate(v, {
                onSuccess: () => toast.success(`Lista ${LISTAS_PRECIO[v].toLowerCase()} asignada`, { description: 'Las nuevas cotizaciones usarán estos precios.' }),
                onError: () => setValor(c.lista_precio),
              })
            }}
            segmentos={[
              { valor: 'publico', etiqueta: 'Público' },
              { valor: 'mayoreo', etiqueta: 'Mayoreo' },
              { valor: 'agencia', etiqueta: 'Agencia' },
            ]}
          />
          <p className="mt-2 text-xs text-fg-subtle">Las cotizaciones nuevas toman los precios de esta lista.</p>
        </>
      ) : (
        <p className="mt-1 text-sm font-medium text-fg">{LISTAS_PRECIO[c.lista_precio]}</p>
      )}
    </GlassPanel>
  )
}

export function ModuloContactos({
  contactos,
  cargando,
  puedeEditar,
  clienteId,
  onNuevo,
  onEditar,
}: {
  contactos: Contacto[] | undefined
  cargando: boolean
  puedeEditar: boolean
  clienteId: string
  onNuevo: () => void
  onEditar: (c: Contacto) => void
}) {
  const eliminar = useEliminarContacto(clienteId)
  const [confirmar, setConfirmar] = useState<string | null>(null)
  return (
    <GlassPanel className="rounded-module p-5" aria-labelledby="titulo-contactos">
      <TituloModulo
        id="titulo-contactos"
        extra={puedeEditar ? <GlassIconButton etiqueta="Agregar contacto" icono={<Plus />} tamano="sm" onClick={onNuevo} /> : null}
      >
        Contactos{contactos?.length ? <span className="num ml-1.5 text-fg-subtle">{contactos.length}</span> : null}
      </TituloModulo>
      {cargando ? (
        <div className="mt-2 flex flex-col gap-2">
          <Skeleton className="h-14 rounded-tile" />
          <Skeleton className="h-14 rounded-tile" />
        </div>
      ) : !contactos?.length ? (
        <p className="mt-1 text-sm text-fg-muted">Sin contactos. {puedeEditar ? 'Agrega a la persona con quien tratas (compras, gerencia).' : ''}</p>
      ) : (
        <ul className="mt-1 divide-y divide-[var(--divider)]">
          {contactos.map((ct) => (
            <li key={ct.id} className="flex items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-fg">
                  <span className="truncate">{ct.nombre}</span>
                  {ct.principal ? (
                    <Pildora tono="luz" punto={false}>
                      Principal
                    </Pildora>
                  ) : null}
                </p>
                {ct.puesto ? <p className="text-sm text-fg-muted">{ct.puesto}</p> : null}
                <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-fg-muted">
                  {ct.whatsapp ? <span className="num">{telefono(ct.whatsapp)}</span> : null}
                  {ct.email ? <span className="truncate">{ct.email}</span> : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {ct.whatsapp ? (
                  <GlassButton
                    variante="fantasma"
                    tamano="icono"
                    icono={<MessageCircle />}
                    aria-label={`WhatsApp a ${ct.nombre}`}
                    onClick={() => window.open(enlaceWhatsApp(ct.whatsapp, `Hola ${ct.nombre.split(' ')[0]}, `), '_blank', 'noopener,noreferrer')}
                  />
                ) : null}
                {puedeEditar ? (
                  confirmar === ct.id ? (
                    <GlassButton
                      variante="peligro"
                      tamano="sm"
                      className="h-11"
                      cargando={eliminar.isPending}
                      onClick={() => eliminar.mutate(ct.id, { onSuccess: () => toast.success(`Contacto ${ct.nombre} eliminado`), onSettled: () => setConfirmar(null) })}
                      onBlur={() => setTimeout(() => setConfirmar((x) => (x === ct.id ? null : x)), 200)}
                    >
                      Eliminar
                    </GlassButton>
                  ) : (
                    <>
                      <GlassButton variante="fantasma" tamano="icono" icono={<PencilLine />} aria-label={`Editar a ${ct.nombre}`} onClick={() => onEditar(ct)} />
                      <GlassButton variante="fantasma" tamano="icono" icono={<Trash2 />} aria-label={`Eliminar a ${ct.nombre}`} onClick={() => setConfirmar(ct.id)} />
                    </>
                  )
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  )
}

export function ModuloNotas({ c, puedeEditar }: { c: Cliente; puedeEditar: boolean }) {
  const actualizar = useActualizarCliente(c.id)
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(c.notas ?? '')
  useEffect(() => {
    if (!editando) setTexto(c.notas ?? '')
  }, [c.notas, editando])

  const guardar = async () => {
    try {
      await actualizar.mutateAsync({ notas: texto })
      toast.success('Notas guardadas')
      setEditando(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron guardar las notas')
    }
  }

  return (
    <GlassPanel className="rounded-module p-5" aria-labelledby="titulo-notas">
      <TituloModulo
        id="titulo-notas"
        extra={puedeEditar && !editando ? <GlassIconButton etiqueta="Editar notas" icono={<NotebookPen />} tamano="sm" onClick={() => setEditando(true)} /> : null}
      >
        Notas
      </TituloModulo>
      {editando ? (
        <div className="mt-1 flex flex-col gap-2">
          <GlassTextarea
            aria-label="Notas del cliente"
            rows={4}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Preferencias, horarios para entregar, quién autoriza los pagos…"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <GlassButton variante="fantasma" onClick={() => setEditando(false)}>
              Cancelar
            </GlassButton>
            <GlassButton variante="primario" cargando={actualizar.isPending} onClick={() => void guardar()}>
              Guardar notas
            </GlassButton>
          </div>
        </div>
      ) : c.notas ? (
        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-fg">{c.notas}</p>
      ) : (
        <p className="mt-1 text-sm text-fg-muted">Sin notas. {puedeEditar ? 'Anota preferencias, horarios o quién autoriza pagos.' : ''}</p>
      )}
    </GlassPanel>
  )
}
