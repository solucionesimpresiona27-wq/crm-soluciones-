import { Link2, Lock, Search, X } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { EstadoVacio, GlassButton, GlassInput, GlassPanel, Pildora, type TonoPildora } from '@/components/glass'
import { api } from '@/data/api'
import { TIPOS_MOVIMIENTO, UNIDADES_MATERIAL, type Material, type TipoMovimiento, type UnidadMaterial } from '@/data/modulos/inventario/contrato'
import { cantidad } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { usePedidosParaLigar } from './consultas'
import { marcaMinimo, nivelExistencia } from './util'

export const TONO_MOVIMIENTO: Record<TipoMovimiento, TonoPildora> = {
  entrada: 'exito',
  consumo: 'acento',
  ajuste: 'neutro',
  merma: 'peligro',
}

export function MovimientoPildora({ tipo }: { tipo: TipoMovimiento }) {
  return <Pildora tono={TONO_MOVIMIENTO[tipo]}>{TIPOS_MOVIMIENTO[tipo]}</Pildora>
}

/** "12.5 m²" */
export const conUnidad = (n: number, u: UnidadMaterial) => `${cantidad(n)} ${UNIDADES_MATERIAL[u]}`

/**
 * Medidor horizontal de existencia en cápsula (como el deslizador de brillo del Centro de Control).
 * El relleno es azul; en stock bajo se enciende la luz ámbar. La muesca marca el mínimo.
 */
export function MedidorExistencia({ m, className }: { m: Pick<Material, 'existencia' | 'stock_minimo' | 'unidad' | 'bajo_minimo' | 'nombre'>; className?: string }) {
  const reducir = useReducedMotion()
  const v = nivelExistencia(m)
  const marca = marcaMinimo(m)
  const bajo = m.bajo_minimo
  return (
    <div
      role="meter"
      aria-label={`Existencia de ${m.nombre}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-valuetext={`${conUnidad(m.existencia, m.unidad)}${m.stock_minimo > 0 ? `, mínimo ${conUnidad(m.stock_minimo, m.unidad)}` : ''}${bajo ? ', stock bajo' : ''}`}
      className={cn('relative h-3 w-full overflow-hidden rounded-full bg-[var(--control-bg)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]', className)}
    >
      <motion.div
        className={cn(
          'absolute inset-y-0 left-0 w-full origin-left rounded-full',
          bajo ? 'bg-gradient-to-r from-amber-400 to-amber-300 shadow-[0_0_12px_rgba(249,194,6,0.55)]' : 'bg-gradient-to-r from-navy-600 to-navy-400 dark:from-navy-400 dark:to-navy-200',
        )}
        initial={reducir ? false : { scaleX: 0 }}
        animate={{ scaleX: v }}
        transition={resorte.expansion}
      />
      {marca !== null ? <span className="absolute inset-y-0 w-0.5 bg-fg/35" style={{ left: `${marca * 100}%` }} aria-hidden /> : null}
    </div>
  )
}

export function SinAcceso({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  const navegar = useNavigate()
  return (
    <GlassPanel>
      <EstadoVacio
        icono={<Lock />}
        titulo={titulo}
        descripcion={descripcion}
        accion={
          <GlassButton variante="cristal" onClick={() => navegar('/inventario')}>
            Ver materiales
          </GlassButton>
        }
      />
    </GlassPanel>
  )
}

export interface PedidoLigado {
  id: string
  folio: string
  titulo: string
}

/** Buscador de pedido para ligar un consumo o un gasto. */
export function SelectorPedido({ valor, onCambio, id, ayuda }: { valor: PedidoLigado | null; onCambio: (p: PedidoLigado | null) => void; id?: string; ayuda?: string }) {
  const [texto, setTexto] = useState('')
  const [diferido, setDiferido] = useState('')
  const [abierto, setAbierto] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setDiferido(texto), 250)
    return () => clearTimeout(t)
  }, [texto])
  const consulta = usePedidosParaLigar(diferido, abierto && !valor)

  if (valor)
    return (
      <div className="flex min-h-11 items-center gap-2 rounded-control bg-[var(--control-bg)] py-1 pl-3.5 pr-1">
        <Link2 className="size-4 shrink-0 text-fg-subtle" aria-hidden />
        <span className="num shrink-0 font-semibold text-fg">{valor.folio}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-fg-muted">{valor.titulo}</span>
        <GlassButton variante="fantasma" tamano="icono" aria-label={`Quitar el pedido ${valor.folio}`} icono={<X />} onClick={() => onCambio(null)} />
      </div>
    )

  const lista = consulta.data ?? []
  return (
    <div className="relative">
      <GlassInput
        id={id}
        icono={<Search />}
        value={texto}
        placeholder="Folio, trabajo o cliente"
        autoComplete="off"
        role="combobox"
        aria-expanded={abierto}
        aria-autocomplete="list"
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        onChange={(e) => {
          setTexto(e.target.value)
          setAbierto(true)
        }}
      />
      {abierto ? (
        <ul role="listbox" aria-label="Pedidos" className="glass glass-strong absolute inset-x-0 top-full z-20 mt-1.5 max-h-60 overflow-y-auto rounded-tile p-1.5 shadow-glass">
          {consulta.isPending ? (
            <li className="px-3 py-2.5 text-sm text-fg-muted">Buscando pedidos…</li>
          ) : consulta.isError ? (
            <li className="px-3 py-2.5 text-sm text-danger">No se pudieron cargar los pedidos: {consulta.error.message}</li>
          ) : lista.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-fg-muted">Sin pedidos abiertos que coincidan</li>
          ) : (
            lista.map((p) => (
              <li key={p.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center gap-2 rounded-control px-3 text-left outline-none hover:bg-[var(--control-bg)] focus-visible:bg-[var(--control-bg)]"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onCambio({ id: p.id, folio: p.folio, titulo: p.titulo })
                    setTexto('')
                    setAbierto(false)
                  }}
                >
                  <span className="num shrink-0 font-semibold text-fg">{p.folio}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-fg-muted">
                    {p.titulo} · {p.cliente}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
      {ayuda ? <p className="mt-1.5 text-xs text-fg-subtle">{ayuda}</p> : null}
    </div>
  )
}

/** Abre el comprobante de un gasto con un enlace temporal (la pestaña se abre antes para que no la bloqueen). */
export async function abrirComprobanteGasto(id: string) {
  const ventana = window.open('', '_blank')
  try {
    const url = await api.gastos.urlComprobante(id)
    if (!url) {
      ventana?.close()
      toast('Este gasto no tiene comprobante')
      return
    }
    if (ventana) {
      ventana.opener = null
      ventana.location.href = url
    } else window.open(url, '_blank', 'noopener,noreferrer')
  } catch (e) {
    ventana?.close()
    toast.error(`No se pudo abrir el comprobante: ${(e as Error).message}`)
  }
}
