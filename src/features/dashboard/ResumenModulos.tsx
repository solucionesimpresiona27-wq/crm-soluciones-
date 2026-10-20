import { FileText, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import type { DashboardResumen } from '@/data/tipos'
import { cn } from '@/lib/utils'
import { ModuloEnlace, TituloModulo } from './Modulo'
import { diasHasta, entero, pesos, plural } from './util'

/** Punto de estado con texto: nunca solo color. */
function Senal({ tono, children }: { tono: 'luz' | 'peligro' | 'aviso' | 'neutro'; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-xs font-medium text-fg-muted">
      <span
        className={cn(
          'size-2 shrink-0 rounded-full',
          tono === 'luz' && 'bg-luz shadow-[0_0_10px_rgba(249,194,6,0.8)]',
          tono === 'peligro' && 'bg-danger',
          tono === 'aviso' && 'bg-warning',
          tono === 'neutro' && 'bg-fg/25',
        )}
        aria-hidden
      />
      <span className="min-w-0">{children}</span>
    </p>
  )
}

/** En los módulos de una columna (unos 140 px por dentro en celular) las cifras largas bajan de tamaño para no desbordarse. */
function tamanoCifra(texto: string) {
  // Celular de 390 px: el módulo mide unos 140 px por dentro y "$698,458" (8 caracteres) ya no cabe en text-3xl
  if (texto.length <= 7) return 'text-3xl'
  // En escritorio angosto (lg, 4 columnas) el módulo vuelve a medir unos 170 px por dentro
  if (texto.length <= 9) return 'text-2xl sm:text-3xl lg:text-2xl xl:text-3xl'
  return 'text-xl sm:text-3xl lg:text-2xl xl:text-3xl'
}

/* ---------------------------------------------------------------------
   Cotizaciones pendientes
   --------------------------------------------------------------------- */

export function CotizacionesModulo({ r, variante }: { r: DashboardResumen; variante: 'tile' | 'fila' }) {
  const abiertas = r.cotizaciones_abiertas ?? { cantidad: 0, total: 0 }
  const porVencer = r.cotizaciones_por_vencer ?? []
  const proxima = porVencer[0]

  const diasProxima = proxima ? diasHasta(proxima.fecha_vencimiento, r.hoy) : 0
  const cuandoProxima = diasProxima <= 0 ? 'hoy' : diasProxima === 1 ? 'mañana' : `en ${diasProxima} días`

  const senal = porVencer.length ? (
    <Senal tono="luz">
      {porVencer.length === 1 ? '1 vence' : `${entero(porVencer.length)} vencen`} en los próximos 3 días
      {variante === 'fila' && proxima ? (
        <span className="block text-fg-subtle">
          <span className="num">{proxima.folio}</span> de {proxima.cliente} vence {cuandoProxima}
        </span>
      ) : null}
    </Senal>
  ) : (
    <Senal tono="neutro">Ninguna vence en los próximos 3 días</Senal>
  )

  if (variante === 'tile') {
    return (
      <ModuloEnlace a="/cotizaciones">
        <div className="flex h-full flex-col">
          <TituloModulo icono={<FileText />}>Cotizaciones</TituloModulo>
          <p className="mt-auto flex items-baseline gap-1.5 pt-2">
            <span className="num text-3xl font-semibold tracking-tight text-fg">{entero(abiertas.cantidad)}</span>
            <span className="text-sm text-fg-muted">{abiertas.cantidad === 1 ? 'abierta' : 'abiertas'}</span>
          </p>
          <p className="num text-sm font-medium text-fg">{pesos(abiertas.total)}</p>
          <div className="mt-2">{senal}</div>
        </div>
      </ModuloEnlace>
    )
  }

  return (
    <ModuloEnlace a="/cotizaciones">
      <div className="flex h-full flex-col">
        <TituloModulo icono={<FileText />}>Cotizaciones abiertas</TituloModulo>
        <div className="mt-auto flex flex-wrap items-end gap-x-5 gap-y-1 pt-2">
          <p className="num glass-text text-[2.6rem] font-semibold leading-none tracking-[-0.035em] lg:text-[3rem]">{pesos(abiertas.total)}</p>
          <p className="pb-1 text-sm text-fg-muted">en {plural(abiertas.cantidad, 'cotización', 'cotizaciones')}</p>
        </div>
        <div className="mt-2.5">{senal}</div>
      </div>
    </ModuloEnlace>
  )
}

/* ---------------------------------------------------------------------
   Cuentas por cobrar
   --------------------------------------------------------------------- */

export function CobrarModulo({ r }: { r: DashboardResumen }) {
  const cobrar = r.por_cobrar ?? { total: 0, pedidos: 0 }
  const vencidos = r.pagos_vencidos
  return (
    <ModuloEnlace a="/pagos/por-cobrar">
      <div className="flex h-full flex-col">
        <TituloModulo icono={<Wallet />}>Por cobrar</TituloModulo>
        <p className={cn('num mt-auto whitespace-nowrap pt-2 font-semibold tracking-tight text-fg', tamanoCifra(pesos(cobrar.total)))}>{pesos(cobrar.total)}</p>
        <p className="text-sm text-fg-muted">{plural(cobrar.pedidos, 'pedido con saldo', 'pedidos con saldo')}</p>
        <div className="mt-2">
          {vencidos && vencidos.pedidos > 0 ? (
            <Senal tono={vencidos.pedidos > 1 ? 'peligro' : 'aviso'}>
              {plural(vencidos.pedidos, 'pago vencido', 'pagos vencidos')}, {pesos(vencidos.total)}
            </Senal>
          ) : (
            <Senal tono="neutro">Sin pagos vencidos</Senal>
          )}
        </div>
      </div>
    </ModuloEnlace>
  )
}
