import { CalendarClock, Flag, HandCoins, MapPin, Palette, Pencil, ReceiptText, UserRound, UserRoundCog } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useEquipo } from '@/app/consultas'
import { AnimatedNumber, Campo, GlassButton, GlassInput, GlassModal, GlassPanel, GlassSelect, GlassTextarea, Pildora, SegmentedControl, botonVariantes } from '@/components/glass'
import type { PedidoDetalle, Prioridad } from '@/data/modulos/pedidos/contrato'
import { cantidad, dinero, fechaLarga, hoyISO } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useActualizarPedido, useFacturar } from '../consultas'
import { diasPara, textoEntrega } from '../lista/datos'
import { Avatar, PagoPildora, PrioridadMarca } from '../piezas'

function Dato({ icono, etiqueta, children, sub }: { icono: ReactNode; etiqueta: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="flex shrink-0 items-center gap-2.5 text-sm text-fg-muted [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-subtle">
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

function Persona({ nombre }: { nombre: string | null }) {
  if (!nombre) return <span className="text-fg-subtle">Sin asignar</span>
  return (
    <span className="inline-flex items-center gap-2">
      <Avatar nombre={nombre} className="size-6" />
      {nombre}
    </span>
  )
}

/** Datos del trabajo: entrega, prioridad, equipo e instalación. */
export function ModuloDatos({ p, editar }: { p: PedidoDetalle; editar: boolean }) {
  const [abierto, setAbierto] = useState(false)
  const hoy = hoyISO()
  const dias = diasPara(p.fecha_entrega, hoy)
  const cerrado = p.estado === 'finalizado' || p.estado === 'cancelado'
  return (
    <GlassPanel className="rounded-module p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight text-fg">Datos del trabajo</h3>
        {editar ? (
          <GlassButton variante="fantasma" tamano="sm" icono={<Pencil />} onClick={() => setAbierto(true)} className="-mr-2 h-11 px-3.5">
            Editar
          </GlassButton>
        ) : null}
      </div>
      <dl className="mt-2 divide-y divide-[var(--divider)]">
        <Dato icono={<CalendarClock />} etiqueta="Entrega" sub={p.fecha_entrega ? fechaLarga(p.fecha_entrega) : undefined}>
          {p.fecha_entrega ? (
            <span className={cn(p.atrasado && 'font-semibold text-danger', !p.atrasado && !cerrado && dias !== null && dias <= 1 && 'font-semibold text-warning')}>
              {p.atrasado ? `Atrasado · ${textoEntrega(dias).toLowerCase()}` : cerrado ? fechaLarga(p.fecha_entrega) : textoEntrega(dias)}
            </span>
          ) : (
            <span className="text-fg-subtle">Sin fecha</span>
          )}
        </Dato>
        <Dato icono={<Flag />} etiqueta="Prioridad">
          <PrioridadMarca prioridad={p.prioridad} />
        </Dato>
        <Dato icono={<UserRoundCog />} etiqueta="Responsable">
          <Persona nombre={p.responsable} />
        </Dato>
        {!p.etapas_omitidas.includes('en_diseno') ? (
          <Dato icono={<Palette />} etiqueta="Diseñador">
            <Persona nombre={p.disenador} />
          </Dato>
        ) : null}
        <Dato icono={<UserRound />} etiqueta="Vendedor">
          <Persona nombre={p.vendedor} />
        </Dato>
        {p.requiere_instalacion ? (
          <Dato icono={<MapPin />} etiqueta="Instalación">
            <span className="block max-w-[14rem] whitespace-pre-line text-left font-normal sm:text-right">{p.direccion_instalacion ?? <span className="text-fg-subtle">Falta la dirección</span>}</span>
          </Dato>
        ) : null}
      </dl>
      {p.descripcion ? <p className="mt-2 whitespace-pre-line rounded-control bg-[var(--control-bg)] px-3 py-2 text-sm text-fg-muted">{p.descripcion}</p> : null}
      {editar ? <DialogoDatos abierto={abierto} onCambio={setAbierto} p={p} /> : null}
    </GlassPanel>
  )
}

const PRIORIDADES: Array<{ valor: Prioridad; etiqueta: string }> = [
  { valor: 'baja', etiqueta: 'Baja' },
  { valor: 'normal', etiqueta: 'Normal' },
  { valor: 'alta', etiqueta: 'Alta' },
  { valor: 'urgente', etiqueta: 'Urgente' },
]

function DialogoDatos({ abierto, onCambio, p }: { abierto: boolean; onCambio: (v: boolean) => void; p: PedidoDetalle }) {
  const actualizar = useActualizarPedido()
  const equipo = useEquipo()
  const [titulo, setTitulo] = useState('')
  const [entrega, setEntrega] = useState('')
  const [prioridad, setPrioridad] = useState<Prioridad>('normal')
  const [responsable, setResponsable] = useState('')
  const [disenador, setDisenador] = useState('')
  const [direccion, setDireccion] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!abierto) return
    setTitulo(p.titulo)
    setEntrega(p.fecha_entrega ?? '')
    setPrioridad(p.prioridad)
    setResponsable(p.responsable_id ?? '')
    setDisenador(p.disenador_id ?? '')
    setDireccion(p.direccion_instalacion ?? '')
    setDescripcion(p.descripcion ?? '')
    setError(null)
  }, [abierto, p])

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!titulo.trim()) {
      setError('Escribe el título del pedido')
      return
    }
    try {
      await actualizar.mutateAsync({
        id: p.id,
        cambios: {
          titulo: titulo.trim(),
          fecha_entrega: entrega || null,
          prioridad,
          responsable_id: responsable || null,
          disenador_id: disenador || null,
          descripcion,
          ...(p.requiere_instalacion ? { direccion_instalacion: direccion } : {}),
        },
      })
      toast.success('Datos del pedido guardados')
      onCambio(false)
    } catch {
      /* el hook ya muestra el error */
    }
  }

  const opciones = (
    <>
      <option value="">Sin asignar</option>
      {(equipo.data ?? []).map((m) => (
        <option key={m.id} value={m.id}>
          {m.nombre}
        </option>
      ))}
    </>
  )

  return (
    <GlassModal
      abierto={abierto}
      onCambio={onCambio}
      titulo={`Editar ${p.folio}`}
      ancho="lg"
      pie={
        <>
          <GlassButton variante="fantasma" onClick={() => onCambio(false)}>
            Cancelar
          </GlassButton>
          <GlassButton type="submit" form="form-datos-pedido" variante="primario" cargando={actualizar.isPending}>
            Guardar cambios
          </GlassButton>
        </>
      }
    >
      <form id="form-datos-pedido" onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <Campo etiqueta="Título" error={error}>
          {(id, a) => <GlassInput id={id} {...a} value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} />}
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Fecha de entrega" opcional>
            {(id, a) => <GlassInput id={id} {...a} type="date" value={entrega} onChange={(e) => setEntrega(e.target.value)} />}
          </Campo>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-fg-muted">Prioridad</p>
            <SegmentedControl etiqueta="Prioridad" tamano="sm" segmentos={PRIORIDADES} valor={prioridad} onCambio={setPrioridad} className="w-full" />
          </div>
          <Campo etiqueta="Responsable">
            {(id, a) => (
              <GlassSelect id={id} {...a} value={responsable} onChange={(e) => setResponsable(e.target.value)}>
                {opciones}
              </GlassSelect>
            )}
          </Campo>
          <Campo etiqueta="Diseñador">
            {(id, a) => (
              <GlassSelect id={id} {...a} value={disenador} onChange={(e) => setDisenador(e.target.value)}>
                {opciones}
              </GlassSelect>
            )}
          </Campo>
        </div>
        {p.requiere_instalacion ? (
          <Campo etiqueta="Dirección de la instalación">
            {(id, a) => <GlassTextarea id={id} {...a} rows={2} value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle, número, colonia y referencias" />}
          </Campo>
        ) : null}
        <Campo etiqueta="Descripción del trabajo" opcional>
          {(id, a) => <GlassTextarea id={id} {...a} rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Detalles que el equipo debe conocer" />}
        </Campo>
      </form>
    </GlassModal>
  )
}

/** Total, pagado y saldo (solo con `ver_precios`). El llenado es pagado/total. */
export function ModuloCobro({ p, registrarPagos }: { p: PedidoDetalle; registrarPagos: boolean }) {
  const reducir = useReducedMotion()
  const m = p.montos
  if (!m) return null
  const fraccion = m.total > 0 ? Math.min(1, m.pagado / m.total) : 0
  const anticipo = Math.round(m.total * m.anticipo_pct) / 100
  const conSaldo = m.saldo > 0.009
  return (
    <GlassPanel className="rounded-module p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-fg-muted">Total del pedido</p>
        <PagoPildora estado={p.estado_pago} />
      </div>
      <AnimatedNumber valor={m.total} formato={(n) => dinero(Math.abs(m.total - n) < 0.5 ? m.total : n)} className="glass-text num mt-1 block text-[2.25rem] font-semibold leading-[1.1] tracking-tight" />
      <p className="mt-1 text-xs text-fg-subtle">{m.aplica_iva ? `IVA incluido (${cantidad(m.iva_pct)} %)` : 'Sin IVA'}</p>

      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-fg/10" role="img" aria-label={`Pagado ${Math.round(fraccion * 100)} % del total`}>
        <motion.div
          className="h-full origin-left rounded-full bg-gradient-to-r from-navy-500 to-navy-400 dark:from-navy-400 dark:to-navy-300"
          initial={reducir ? false : { scaleX: 0 }}
          animate={{ scaleX: fraccion }}
          transition={{ ...resorte.expansion, delay: reducir ? 0 : 0.2 }}
        />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-fg-muted">Pagado</dt>
          <dd className="num text-base font-semibold text-fg">{dinero(m.pagado)}</dd>
        </div>
        <div className="text-right">
          <dt className="text-xs text-fg-muted">Saldo</dt>
          <dd className={cn('num text-base font-semibold', conSaldo ? 'text-fg' : 'text-success')}>{conSaldo ? dinero(m.saldo) : 'Liquidado'}</dd>
        </div>
      </dl>
      <dl className="mt-3 divide-y divide-[var(--divider)] border-t border-[var(--divider)]">
        <Dato icono={<HandCoins />} etiqueta={`Anticipo (${cantidad(m.anticipo_pct)} %)`} sub={p.anticipo_recibido ? 'Recibido' : 'Pendiente'}>
          <span className="num">{dinero(anticipo)}</span>
        </Dato>
        {m.fecha_limite_pago ? (
          <Dato icono={<CalendarClock />} etiqueta="Fecha límite de pago">
            {fechaLarga(m.fecha_limite_pago)}
          </Dato>
        ) : null}
      </dl>
      {registrarPagos && conSaldo && p.estado !== 'cancelado' ? (
        <Link to={`/pagos?pedido=${p.id}`} className={cn(botonVariantes({ variante: p.anticipo_recibido ? 'cristal' : 'luz' }), 'mt-3 w-full')}>
          <HandCoins aria-hidden />
          {p.anticipo_recibido ? 'Registrar pago' : 'Registrar anticipo'}
        </Link>
      ) : null}
      {m.notas_internas ? <p className="mt-3 whitespace-pre-line rounded-control bg-[var(--control-bg)] px-3 py-2 text-sm text-fg-muted">{m.notas_internas}</p> : null}
    </GlassPanel>
  )
}

/** Facturación externa: el CRM solo registra si se facturó y el folio CFDI. */
export function ModuloFacturacion({ p, editar }: { p: PedidoDetalle; editar: boolean }) {
  const facturar = useFacturar()
  const actualizar = useActualizarPedido()
  const [folio, setFolio] = useState(p.folio_factura ?? '')
  const [fechaF, setFechaF] = useState(p.fecha_factura ?? '')
  const [editando, setEditando] = useState(false)

  useEffect(() => {
    setFolio(p.folio_factura ?? '')
    setFechaF(p.fecha_factura ?? '')
  }, [p.folio_factura, p.fecha_factura])

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    if (!folio.trim()) {
      toast.error('Escribe el folio de la factura (CFDI) para marcarla')
      return
    }
    try {
      await facturar.mutateAsync({ id: p.id, datos: { facturado: true, folio_factura: folio.trim(), fecha_factura: fechaF || null } })
      toast.success(`${p.folio} marcado como facturado`)
      setEditando(false)
    } catch {
      /* el hook ya muestra el error */
    }
  }

  const quitar = async () => {
    try {
      await facturar.mutateAsync({ id: p.id, datos: { facturado: false } })
      toast.success('Se quitó la marca de facturado')
    } catch {
      /* el hook ya muestra el error */
    }
  }

  const alternarRequiere = async () => {
    try {
      await actualizar.mutateAsync({ id: p.id, cambios: { requiere_factura: !p.requiere_factura } })
    } catch {
      /* el hook ya muestra el error */
    }
  }

  return (
    <GlassPanel className="rounded-module p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-fg">
          <ReceiptText className="size-4 text-fg-subtle" aria-hidden />
          Facturación
        </h3>
        {p.facturado ? <Pildora tono="exito">Facturado</Pildora> : p.requiere_factura ? <Pildora tono="luz">Por facturar</Pildora> : <Pildora>No requiere</Pildora>}
      </div>

      {editar ? (
        <button
          type="button"
          role="switch"
          aria-checked={p.requiere_factura}
          disabled={actualizar.isPending || p.facturado}
          onClick={() => void alternarRequiere()}
          className="mt-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-control px-1 text-left text-sm text-fg outline-none disabled:opacity-60"
        >
          El cliente pide factura
          <span className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300', p.requiere_factura ? 'bg-accent' : 'bg-fg/15')} aria-hidden>
            <motion.span layout transition={resorte.agil} className={cn('absolute top-0.5 size-6 rounded-full bg-white shadow', p.requiere_factura ? 'right-0.5' : 'left-0.5')} />
          </span>
        </button>
      ) : null}

      {p.facturado && !editando ? (
        <dl className="mt-2 divide-y divide-[var(--divider)] border-t border-[var(--divider)]">
          <Dato icono={<ReceiptText />} etiqueta="Folio CFDI">
            <span className="num">{p.folio_factura ?? '—'}</span>
          </Dato>
          {p.fecha_factura ? (
            <Dato icono={<CalendarClock />} etiqueta="Fecha">
              {fechaLarga(p.fecha_factura)}
            </Dato>
          ) : null}
          {editar ? (
            <div className="flex gap-2 pt-3">
              <GlassButton variante="cristal" tamano="sm" onClick={() => setEditando(true)} className="h-11 flex-1">
                Cambiar folio
              </GlassButton>
              <GlassButton variante="fantasma" tamano="sm" onClick={() => void quitar()} cargando={facturar.isPending} className="h-11 flex-1">
                Quitar marca
              </GlassButton>
            </div>
          ) : null}
        </dl>
      ) : editar && (p.requiere_factura || editando) ? (
        <form onSubmit={guardar} className="mt-3 flex flex-col gap-3 border-t border-[var(--divider)] pt-3" noValidate>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Campo etiqueta="Folio CFDI">
              {(id, a) => <GlassInput id={id} {...a} value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="Ej. A-1024" className="num" autoComplete="off" />}
            </Campo>
            <Campo etiqueta="Fecha" opcional>
              {(id, a) => <GlassInput id={id} {...a} type="date" value={fechaF} onChange={(e) => setFechaF(e.target.value)} className="w-[9.5rem]" />}
            </Campo>
          </div>
          <GlassButton type="submit" variante="primario" icono={<ReceiptText />} cargando={facturar.isPending}>
            Marcar facturado
          </GlassButton>
        </form>
      ) : !p.requiere_factura ? (
        <p className="mt-2 text-sm text-fg-muted">El cliente no pidió factura.</p>
      ) : (
        <p className="mt-2 text-sm text-fg-muted">Pendiente de facturar. Ventas registra el folio cuando se emita.</p>
      )}
    </GlassPanel>
  )
}
