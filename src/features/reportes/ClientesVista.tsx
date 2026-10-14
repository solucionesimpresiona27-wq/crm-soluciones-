import { Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EstadoVacio, GlassPanel } from '@/components/glass'
import { dinero, fecha } from '@/lib/format'
import { useMejoresClientes } from './consultas'
import { descargarCsv, type RangoReporte } from './periodo'
import { CargandoSeccion, EncabezadoSeccion, ErrorSeccion } from './piezas'

export default function ClientesVista({ r }: { r: RangoReporte }) {
  const consulta = useMejoresClientes(r.desde, r.hasta)
  if (consulta.isPending) return <CargandoSeccion />
  if (consulta.isError) return <ErrorSeccion que="los mejores clientes" error={consulta.error} onReintentar={() => void consulta.refetch()} />
  const filas = consulta.data
  const total = filas.reduce((s, f) => s + f.vendido, 0)
  const exportar = () =>
    descargarCsv(`mejores_clientes_${r.desde}_${r.hasta}.csv`, [
      ['Cliente', 'WhatsApp', 'Pedidos', 'Vendido', 'Cobrado', 'Saldo', 'Ticket promedio', 'Última compra'],
      ...filas.map((f) => [f.nombre, f.whatsapp, f.pedidos, f.vendido, f.cobrado, f.saldo, f.ticket_promedio, f.ultima_compra?.slice(0, 10)]),
    ])
  return (
    <section aria-labelledby="t-clientes" className="flex flex-col gap-3">
      <EncabezadoSeccion id="t-clientes" titulo="Mejores clientes" descripcion="Por lo vendido en el periodo" onExportar={filas.length ? exportar : undefined} />
      {filas.length === 0 ? (
        <GlassPanel>
          <EstadoVacio icono={<Users />} titulo="Sin compras en este periodo" descripcion="Prueba con Trimestre o Año para ver a tus clientes más importantes." />
        </GlassPanel>
      ) : (
        <GlassPanel className="p-2">
          <table className="tabla">
            <caption className="sr-only">Mejores clientes del {r.texto}</caption>
            <thead>
              <tr>
                <th scope="col" className="pl-5">Cliente</th>
                <th scope="col" className="text-right max-md:hidden">Pedidos</th>
                <th scope="col" className="text-right">Vendido</th>
                <th scope="col" className="text-right max-md:hidden">Cobrado</th>
                <th scope="col" className="text-right max-lg:hidden">Saldo</th>
                <th scope="col" className="pr-5 text-right max-lg:hidden">Última compra</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={f.cliente_id}>
                  <th scope="row" className="pl-5 text-left font-normal">
                    <span className="flex items-center gap-3">
                      <span className="num w-5 text-right text-sm font-semibold text-fg-subtle">{i + 1}</span>
                      <span className="min-w-0">
                        <Link to={`/clientes/${f.cliente_id}`} className="block truncate font-semibold text-fg outline-none hover:underline focus-visible:underline">
                          {f.nombre}
                        </Link>
                        <span className="num block text-xs text-fg-subtle">{total > 0 ? Math.round((f.vendido / total) * 100) : 0}% del total · ticket {dinero(f.ticket_promedio)}</span>
                      </span>
                    </span>
                  </th>
                  <td className="num text-right text-fg-muted max-md:hidden">{f.pedidos}</td>
                  <td className="num text-right text-base font-semibold text-fg">{dinero(f.vendido)}</td>
                  <td className="num text-right text-fg max-md:hidden">{dinero(f.cobrado)}</td>
                  <td className="num text-right max-lg:hidden">{f.saldo > 0 ? <span className="font-semibold text-amber-700 dark:text-luz">{dinero(f.saldo)}</span> : <span className="text-fg-subtle">—</span>}</td>
                  <td className="pr-5 text-right text-fg-muted max-lg:hidden">{fecha(f.ultima_compra)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassPanel>
      )}
    </section>
  )
}
