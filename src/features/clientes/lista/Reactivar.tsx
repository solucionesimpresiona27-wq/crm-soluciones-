import { CalendarClock, Info, MessageCircle, PartyPopper, RotateCcw } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { EstadoVacio, GlassButton, GlassInput, GlassPanel, GlassSurface, Skeleton } from '@/components/glass'
import { api } from '@/data/api'
import type { ClienteInactivo } from '@/data/modulos/clientes/contrato'
import { cantidad, dinero, fecha } from '@/lib/format'
import { useClientesInactivos } from '../consultas'
import { AvatarCliente, useWhatsAppCliente } from '../piezas'
import { Etiquetas } from './TablaClientes'

const ATAJOS = [60, 90, 180, 365]

/**
 * Clientes que compraron antes y no han vuelto en N días (función clientes_inactivos).
 * El botón principal abre WhatsApp con la plantilla de reactivación.
 */
export function Reactivar({ dias, onDias, diasConfig, conPrecios, escritorio }: { dias: number; onDias: (d: number) => void; diasConfig: number; conPrecios: boolean; escritorio: boolean }) {
  const navegar = useNavigate()
  const consulta = useClientesInactivos(dias, true)
  const wa = useWhatsAppCliente()

  const escribir = (c: ClienteInactivo) => {
    wa.abrir({ nombre: c.nombre, whatsapp: c.whatsapp, telefono: c.telefono }, 'reactivacion')
    toast(`Mensaje para ${c.nombre} listo en WhatsApp`, {
      description: '¿Lo enviaste? Regístralo en su actividad.',
      action: {
        label: 'Registrar',
        onClick: () =>
          void api.actividades
            .registrar({ cliente_id: c.cliente_id, tipo: 'whatsapp', descripcion: 'Mensaje de reactivación por WhatsApp' })
            .then(() => toast.success('Actividad registrada'))
            .catch((e: Error) => toast.error(e.message)),
      },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <GlassSurface className="flex flex-col gap-3 rounded-module p-3 pl-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-luz text-luz-fg shadow-[0_6px_20px_-6px_rgba(249,194,6,0.75)] [&_svg]:size-5" aria-hidden>
            <CalendarClock />
          </span>
          <p className="text-sm text-fg-muted">
            <span className="font-semibold text-fg">Clientes que ya compraron y no han vuelto</span> en los últimos{' '}
            <span className="num font-semibold text-fg">{dias}</span> días. Un mensaje a tiempo trae de vuelta pedidos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 pl-14 sm:pl-0">
          <div className="w-28">
            <GlassInput
              type="number"
              min={1}
              max={3650}
              inputMode="numeric"
              aria-label="Días sin comprar"
              value={dias}
              sufijo="días"
              onChange={(e) => {
                const v = Math.round(Number(e.target.value))
                if (v >= 1 && v <= 3650) onDias(v)
              }}
              className="num rounded-full pr-14"
            />
          </div>
          {ATAJOS.filter((a) => a !== dias).slice(0, 3).map((a) => (
            <GlassButton key={a} variante="fantasma" tamano="sm" className="h-11 px-3 pointer-coarse:h-11" onClick={() => onDias(a)}>
              {a === 365 ? '1 año' : `${a} días`}
            </GlassButton>
          ))}
          {dias !== diasConfig ? (
            <GlassButton variante="fantasma" tamano="sm" icono={<RotateCcw />} className="h-11 px-3" onClick={() => onDias(diasConfig)}>
              Usar {diasConfig}
            </GlassButton>
          ) : null}
        </div>
      </GlassSurface>

      {wa.plantillasCargadas && !wa.tienePlantillaReactivacion ? (
        <p className="flex items-start gap-2 px-2 text-sm text-fg-muted">
          <Info className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
          No hay una plantilla "Volver a contactar" activa; se usará un mensaje general. Puedes crearla o activarla en Configuración → Plantillas.
        </p>
      ) : null}

      {consulta.isPending ? (
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Cargando clientes para reactivar">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[9.5rem] rounded-tile" />
          ))}
        </div>
      ) : consulta.isError ? (
        <GlassPanel>
          <EstadoVacio
            icono={<CalendarClock />}
            titulo="No se pudo cargar la lista para reactivar"
            descripcion={`${consulta.error.message}. Revisa tu conexión e inténtalo de nuevo.`}
            accion={
              <GlassButton icono={<RotateCcw />} onClick={() => void consulta.refetch()}>
                Reintentar
              </GlassButton>
            }
          />
        </GlassPanel>
      ) : consulta.data.length === 0 ? (
        <GlassPanel>
          <EstadoVacio
            icono={<PartyPopper />}
            titulo={`Todos tus clientes han comprado en los últimos ${dias} días`}
            descripcion="Nadie se ha enfriado todavía. Prueba con menos días para adelantarte."
          />
        </GlassPanel>
      ) : (
        <ul aria-label={`${consulta.data.length} clientes sin comprar en ${dias} días`} className={escritorio ? 'grid gap-3 md:grid-cols-2 xl:grid-cols-3' : 'grid gap-2.5 md:grid-cols-2'}>
          {consulta.data.map((c) => (
            <li key={c.cliente_id}>
              <GlassSurface variante="fuerte" className="flex h-full flex-col rounded-tile p-4">
                <div className="flex items-start gap-3">
                  <AvatarCliente nombre={c.nombre} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/clientes/${c.cliente_id}`} className="-mx-1 block truncate rounded-full px-1 font-semibold text-fg outline-none">
                      {c.nombre}
                    </Link>
                    <p className="text-sm text-fg-muted">
                      Última compra el {fecha(c.ultima_compra)}
                      {c.vendedor ? ` · ${c.vendedor}` : ''}
                    </p>
                  </div>
                </div>
                {c.etiquetas.length ? <Etiquetas etiquetas={c.etiquetas} max={3} className="mt-2" /> : null}
                <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                  <div className="flex gap-5 text-sm">
                    <span className="flex flex-col">
                      <span className="num text-xl font-semibold leading-tight tracking-tight text-fg">{cantidad(c.dias_sin_compra)}</span>
                      <span className="text-xs text-fg-subtle">días sin comprar</span>
                    </span>
                    <span className="flex flex-col">
                      <span className="num text-xl font-semibold leading-tight tracking-tight text-fg">{c.pedidos}</span>
                      <span className="text-xs text-fg-subtle">{c.pedidos === 1 ? 'pedido' : 'pedidos'}</span>
                    </span>
                    {conPrecios && c.total_comprado !== null ? (
                      <span className="hidden flex-col min-[400px]:flex">
                        <span className="num text-xl font-semibold leading-tight tracking-tight text-fg">{dinero(c.total_comprado).replace(/\.00$/, '')}</span>
                        <span className="text-xs text-fg-subtle">comprado</span>
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex gap-2 border-t border-[var(--divider)] pt-3">
                  <GlassButton variante="primario" icono={<MessageCircle />} className="flex-1" onClick={() => escribir(c)}>
                    Escribir por WhatsApp
                  </GlassButton>
                  <GlassButton variante="cristal" onClick={() => navegar(`/clientes/${c.cliente_id}`)}>
                    Ver ficha
                  </GlassButton>
                </div>
              </GlassSurface>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
