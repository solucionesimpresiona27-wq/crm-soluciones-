import { CalendarCheck, HandCoins, Handshake, PackageCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { CapsuleMeter } from '@/components/glass'
import type { DashboardResumen } from '@/data/tipos'
import { cn } from '@/lib/utils'
import { diasHasta, ESTADOS_LISTOS, nombreMes } from './util'

interface Medidor {
  id: string
  valor: number
  etiqueta: string
  textoValor: string
  icono: ReactNode
  tono: 'luz' | 'acento'
}

/** Elige los dos medidores más útiles según los datos que el rol puede ver. */
export function medidoresDe(r: DashboardResumen): Medidor[] {
  const lista: Medidor[] = []
  if (r.ventas_mes !== undefined && r.cobrado_mes !== undefined && r.ventas_mes > 0) {
    const v = r.cobrado_mes / r.ventas_mes
    const mes = r.serie_mensual?.at(-1)?.mes
    lista.push({
      id: 'cobrado',
      valor: v,
      etiqueta: 'Cobrado del mes',
      textoValor: `${Math.round(v * 100)}% de lo vendido${mes ? ` en ${nombreMes(mes, true)}` : ''}`,
      icono: <HandCoins />,
      tono: 'luz',
    })
  }
  if (r.tasa_cierre_90d !== undefined && r.tasa_cierre_90d !== null) {
    lista.push({
      id: 'cierre',
      valor: r.tasa_cierre_90d / 100,
      etiqueta: 'Cierre de cotizaciones',
      textoValor: `${Math.round(r.tasa_cierre_90d)}% de cotizaciones aceptadas en 90 días`,
      icono: <Handshake />,
      tono: 'acento',
    })
  }
  if (r.pedidos_activos > 0) {
    const v = (r.pedidos_activos - r.pedidos_atrasados) / r.pedidos_activos
    lista.push({
      id: 'a-tiempo',
      valor: v,
      etiqueta: 'Pedidos a tiempo',
      textoValor: `${Math.round(v * 100)}% de los pedidos activos va a tiempo`,
      icono: <CalendarCheck />,
      tono: 'acento',
    })
  }
  const semana = r.entregas_proximas.filter((e) => diasHasta(e.fecha_entrega, r.hoy) >= 0)
  if (semana.length) {
    const listas = semana.filter((e) => ESTADOS_LISTOS.includes(e.estado)).length
    const v = listas / semana.length
    lista.push({
      id: 'listas',
      valor: v,
      etiqueta: 'Entregas listas',
      textoValor: `${listas} de ${semana.length} entregas de esta semana están listas`,
      icono: <PackageCheck />,
      tono: 'luz',
    })
  }
  return lista.slice(0, 2)
}

/** Medidores verticales en cápsula, como brillo y volumen en el Centro de Control. */
export function MedidoresModulo({ r }: { r: DashboardResumen }) {
  const medidores = medidoresDe(r)
  if (!medidores.length) return null
  return (
    <section aria-label="Medidores" className={cn('grid h-full gap-3', medidores.length > 1 ? 'grid-cols-2' : 'grid-cols-1 justify-items-center')}>
      {medidores.map((m) => (
        <div key={m.id} className={cn('flex min-h-0 flex-col items-stretch gap-2.5', medidores.length === 1 && 'w-full max-w-[8.5rem]')}>
          <CapsuleMeter valor={m.valor} icono={m.icono} etiqueta={m.etiqueta} textoValor={m.textoValor} tono={m.tono} className="min-h-0 flex-1" />
          <div className="px-1 text-center" aria-hidden>
            <p className="text-xl font-semibold leading-tight tracking-tight text-fg">{Math.round(m.valor * 100)}%</p>
            <p className="text-xs leading-tight text-fg-muted">{m.etiqueta}</p>
          </div>
        </div>
      ))}
    </section>
  )
}
