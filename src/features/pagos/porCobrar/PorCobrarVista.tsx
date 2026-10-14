import { AlarmClock, FileSearch, HandCoins, MessageCircle, PartyPopper, RotateCcw, Search, Users } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSesion } from '@/app/sesion'
import { AnimatedNumber, EstadoVacio, GlassButton, GlassInput, GlassPanel, GlassSurface, Pildora, SegmentedControl, Skeleton } from '@/components/glass'
import type { CuentaPorCobrar } from '@/data/modulos/pagos/contrato'
import { useDebounce } from '@/hooks/useDebounce'
import { ESTADO_PEDIDO } from '@/lib/estados'
import { dinero, hoyISO } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { cn, iniciales, normalizar, redondear } from '@/lib/utils'
import { useCuentasPorCobrar } from '../consultas'
import { AccionFila, useAbrirCobro, useMensajePago } from '../piezas'
import { dineroAsentado, fechaCorta } from '../util'

type Filtro = 'todos' | 'vencidos'

interface GrupoCliente {
  id: string
  nombre: string
  whatsapp: string | null
  saldo: number
  vencido: number
  maxDiasVencido: number
  cuentas: CuentaPorCobrar[]
}

function agrupar(cuentas: CuentaPorCobrar[]): GrupoCliente[] {
  const m = new Map<string, GrupoCliente>()
  for (const c of cuentas) {
    const g = m.get(c.cliente_id) ?? { id: c.cliente_id, nombre: c.cliente, whatsapp: c.whatsapp, saldo: 0, vencido: 0, maxDiasVencido: 0, cuentas: [] }
    g.saldo = redondear(g.saldo + c.saldo)
    if (c.vencido) g.vencido = redondear(g.vencido + c.saldo)
    g.maxDiasVencido = Math.max(g.maxDiasVencido, c.dias_vencido)
    g.whatsapp ??= c.whatsapp
    g.cuentas.push(c)
    m.set(c.cliente_id, g)
  }
  return [...m.values()].sort((a, b) => Number(b.vencido > 0) - Number(a.vencido > 0) || b.maxDiasVencido - a.maxDiasVencido || b.saldo - a.saldo)
}

export default function PorCobrarVista() {
  const { puede } = useSesion()
  const consulta = useCuentasPorCobrar()
  const abrirCobro = useAbrirCobro()
  const mensaje = useMensajePago()
  const reducir = useReducedMotion()
  const hoy = useMemo(() => hoyISO(), [])
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [texto, setTexto] = useState('')
  const q = normalizar(useDebounce(texto, 200).trim())
  const [limite, setLimite] = useState(30)

  const cuentas = consulta.data ?? []
  const total = redondear(cuentas.reduce((s, c) => s + c.saldo, 0))
  const vencidas = cuentas.filter((c) => c.vencido)
  const totalVencido = redondear(vencidas.reduce((s, c) => s + c.saldo, 0))
  const grupos = useMemo(() => {
    let base = filtro === 'vencidos' ? cuentas.filter((c) => c.vencido) : cuentas
    if (q) base = base.filter((c) => normalizar(`${c.folio} ${c.cliente} ${c.titulo}`).includes(q))
    return agrupar(base)
  }, [cuentas, filtro, q])
  const clientes = new Set(cuentas.map((c) => c.cliente_id)).size
  const fraccionVencida = total > 0 ? totalVencido / total : 0

  const recordar = (g: GrupoCliente, cuentas: CuentaPorCobrar[]) =>
    mensaje('recordatorio_pago', {
      cliente: g.nombre,
      whatsapp: g.whatsapp,
      folio: cuentas.map((c) => c.folio).join(', '),
      saldo: redondear(cuentas.reduce((s, c) => s + c.saldo, 0)),
      total: redondear(cuentas.reduce((s, c) => s + c.total, 0)),
    })

  if (consulta.isPending)
    return (
      <div className="flex flex-col gap-4" aria-hidden>
        <Skeleton className="h-40 rounded-module" />
        <Skeleton className="h-10 w-72 rounded-full" />
        <Skeleton className="h-48 rounded-module" />
        <Skeleton className="h-36 rounded-module" />
      </div>
    )

  if (consulta.isError)
    return (
      <GlassPanel>
        <EstadoVacio
          icono={<FileSearch />}
          titulo="No se pudieron cargar las cuentas por cobrar"
          descripcion={`${consulta.error.message}. Revisa tu conexión e inténtalo de nuevo.`}
          accion={
            <GlassButton icono={<RotateCcw />} onClick={() => void consulta.refetch()}>
              Reintentar
            </GlassButton>
          }
        />
      </GlassPanel>
    )

  if (cuentas.length === 0)
    return (
      <GlassPanel>
        <EstadoVacio icono={<PartyPopper />} titulo="Nadie te debe" descripcion="Todos los pedidos activos están liquidados. Los saldos nuevos aparecerán aquí." />
      </GlassPanel>
    )

  return (
    <div className="flex flex-col gap-4">
      {/* Total por cobrar: la cifra grande; lo vencido, la luz amarilla */}
      <GlassPanel className="rounded-module p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <p className="text-sm font-medium text-fg-muted">Total por cobrar</p>
            <AnimatedNumber valor={total} formato={dineroAsentado(total)} className="glass-text num mt-1 block text-[2.75rem] font-semibold leading-[1.05] tracking-tight" />
            <p className="mt-1 flex items-center gap-1.5 text-sm text-fg-muted">
              <Users className="size-4 text-fg-subtle" aria-hidden />
              {clientes} {clientes === 1 ? 'cliente' : 'clientes'} · {cuentas.length} {cuentas.length === 1 ? 'pedido' : 'pedidos'} con saldo
            </p>
          </div>
          <div className="min-w-[14rem] flex-1 sm:max-w-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg">
                <span className={cn('size-2.5 rounded-full', totalVencido > 0 ? 'bg-luz shadow-[0_0_10px_rgba(249,194,6,0.7)]' : 'bg-fg/20')} aria-hidden />
                Vencido
              </span>
              <span className="num text-lg font-semibold text-fg">{dinero(totalVencido)}</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-fg/[0.08]" aria-hidden>
              <motion.div
                className="h-full origin-left rounded-full bg-gradient-to-r from-amber-400 to-luz"
                initial={reducir ? false : { scaleX: 0 }}
                animate={{ scaleX: fraccionVencida }}
                transition={{ ...resorte.expansion, delay: reducir ? 0 : 0.15 }}
              />
            </div>
            <p className="mt-1.5 text-xs text-fg-subtle">
              {vencidas.length === 0 ? 'Nada vencido: todos dentro de su plazo.' : `${vencidas.length} ${vencidas.length === 1 ? 'pedido pasó' : 'pedidos pasaron'} su fecha límite de pago`}
            </p>
          </div>
        </div>
      </GlassPanel>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <SegmentedControl
          etiqueta="Filtrar cuentas"
          segmentos={[
            { valor: 'todos', etiqueta: 'Todos', conteo: cuentas.length },
            { valor: 'vencidos', etiqueta: 'Vencidos', conteo: vencidas.length },
          ]}
          valor={filtro}
          onCambio={setFiltro}
        />
        <div className="min-w-[15rem] flex-1 lg:ml-auto lg:max-w-sm">
          <GlassInput type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar folio o cliente" aria-label="Buscar cuentas por folio o cliente" icono={<Search />} className="rounded-full" autoComplete="off" />
        </div>
      </div>

      {grupos.length === 0 ? (
        <GlassPanel>
          <EstadoVacio
            icono={<FileSearch />}
            titulo={q ? `Nada coincide con “${texto.trim()}”` : 'Ningún pedido vencido'}
            descripcion={q ? 'Prueba con el folio (PED-0012) o el nombre del cliente.' : 'Todos los saldos están dentro de su plazo.'}
            accion={
              <GlassButton
                variante="cristal"
                icono={<RotateCcw />}
                onClick={() => {
                  setTexto('')
                  setFiltro('todos')
                }}
              >
                Ver todos
              </GlassButton>
            }
          />
        </GlassPanel>
      ) : (
        <ul className="gap-3 xl:columns-2" aria-label="Cuentas por cobrar por cliente">
          {grupos.slice(0, limite).map((g) => (
            <li key={g.id} className="mb-3 break-inside-avoid">
              <GlassSurface variante="fuerte" className={cn('rounded-module p-2', g.vencido > 0 && 'shadow-[inset_3px_0_0_rgb(var(--luz))]')}>
                <div className="flex items-center gap-3 px-3 pb-2 pt-2.5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-navy-500 to-navy-700 text-xs font-bold text-white" aria-hidden>
                    {iniciales(g.nombre)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link to={`/clientes/${g.id}`} className="block truncate text-md font-semibold text-fg outline-none hover:underline">
                      {g.nombre}
                    </Link>
                    <p className="truncate text-xs text-fg-muted">
                      {g.cuentas.length} {g.cuentas.length === 1 ? 'pedido' : 'pedidos'}
                      {g.vencido > 0 ? ` · ${dinero(g.vencido)} vencido` : ''}
                    </p>
                  </div>
                  <span className="num whitespace-nowrap text-right text-lg font-semibold tracking-tight text-fg">{dinero(g.saldo)}</span>
                  <AccionFila etiqueta={`Recordar a ${g.nombre} por WhatsApp`} icono={<MessageCircle />} onClick={() => recordar(g, g.cuentas)} />
                </div>
                <ul className="flex flex-col" aria-label={`Pedidos de ${g.nombre}`}>
                  {g.cuentas.map((c) => (
                    <li key={c.pedido_id} className="flex items-center gap-3 rounded-tile border-t border-[var(--divider)] py-2 pl-3 pr-1 transition-colors hover:bg-[var(--row-hover)] sm:pl-[3.75rem]">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Link to={`/pedidos/${c.pedido_id}`} className="num text-sm font-semibold text-fg outline-none hover:underline">
                            {c.folio}
                          </Link>
                          <Pildora tono={ESTADO_PEDIDO[c.estado].tono} className="max-sm:hidden">
                            {ESTADO_PEDIDO[c.estado].corto}
                          </Pildora>
                          {c.vencido ? (
                            <Pildora tono="aviso" punto={false}>
                              <AlarmClock className="size-3" aria-hidden />
                              Vencido {c.dias_vencido === 0 ? 'hoy' : `hace ${c.dias_vencido} ${c.dias_vencido === 1 ? 'día' : 'días'}`}
                            </Pildora>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-fg-subtle">
                          {c.titulo} · {c.dias_transcurridos} {c.dias_transcurridos === 1 ? 'día' : 'días'}
                          {c.fecha_limite && !c.vencido ? ` · límite ${fechaCorta(c.fecha_limite, hoy)}` : ''}
                        </p>
                      </div>
                      <span className="text-right">
                        <span className="num block whitespace-nowrap font-semibold text-fg">{dinero(c.saldo)}</span>
                        <span className="num block whitespace-nowrap text-xs text-fg-subtle">de {dinero(c.total)}</span>
                      </span>
                      {puede('registrar_pagos') ? (
                        <AccionFila etiqueta={`Registrar pago de ${c.folio}`} icono={<HandCoins />} onClick={() => abrirCobro(c.pedido_id)} />
                      ) : null}
                    </li>
                  ))}
                </ul>
              </GlassSurface>
            </li>
          ))}
        </ul>
      )}
      {grupos.length > limite ? (
        <div className="flex justify-center">
          <GlassButton variante="cristal" onClick={() => setLimite((l) => l + 30)}>
            Mostrar {Math.min(30, grupos.length - limite)} clientes más
          </GlassButton>
        </div>
      ) : null}
    </div>
  )
}
