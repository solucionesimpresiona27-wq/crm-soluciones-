import { BotonEnlacePortal } from '@/features/portal/BotonEnlacePortal'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { AlertTriangle, ArrowLeft, Ban, ClipboardList, FileText, MessageCircle, PackageSearch, Pause, RotateCcw } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useSesion } from '@/app/sesion'
import { EstadoVacio, GlassButton, GlassIconButton, GlassPanel, GlassSurface, Skeleton } from '@/components/glass'
import type { PedidoDetalle } from '@/data/modulos/pedidos/contrato'
import type { EstadoPedido } from '@/data/tipos'
import { ESTADO_PEDIDO } from '@/lib/estados'
import { escalonado, resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useCambiarEtapa, useEventosPedido, usePedido } from './consultas'
import { PanelArchivos } from './detalle/Archivos'
import { PanelConceptos } from './detalle/Conceptos'
import { DialogoEtapas, DialogoMotivo } from './detalle/Dialogos'
import { PanelHistorial } from './detalle/Historial'
import { LineaEtapas, etapasDe } from './detalle/LineaEtapas'
import { ModuloCobro, ModuloDatos, ModuloFacturacion } from './detalle/Resumen'
import { useWhatsAppPedido } from './detalle/useWhatsAppPedido'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { EtapaPildora, PrioridadMarca } from './piezas'

export default function PedidoDetallePage() {
  const { id } = useParams()
  return <Detalle key={id} id={id ?? ''} />
}

function Detalle({ id }: { id: string }) {
  const { puede } = useSesion()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const listaQS = (ubicacion.state as { lista?: string } | null)?.lista ?? ''
  const consulta = usePedido(id)
  const eventos = useEventosPedido(id)
  const cambiar = useCambiarEtapa()
  const whatsapp = useWhatsAppPedido(consulta.data)
  const [motivo, setMotivo] = useState<'pausado' | 'cancelado' | null>(null)
  const [etapas, setEtapas] = useState(false)
  // Con pantalla ancha el resumen va a la derecha; en las demás, entre conceptos e historial
  const ancho = useMediaQuery('(min-width: 1280px)')
  const volver = () => navegar(`/pedidos${listaQS}`)

  if (consulta.isPending) return <EsqueletoDetalle />
  if (consulta.isError) {
    const noExiste = /no encontrado/i.test(consulta.error.message)
    return (
      <GlassPanel className="mt-2">
        <EstadoVacio
          icono={<PackageSearch />}
          titulo={noExiste ? 'No encontramos este pedido' : 'No se pudo abrir el pedido'}
          descripcion={noExiste ? 'Puede que se haya eliminado o que el enlace esté incompleto.' : `${consulta.error.message}. Revisa tu conexión e inténtalo de nuevo.`}
          accion={
            <div className="flex flex-wrap justify-center gap-2">
              <GlassButton variante="cristal" icono={<ArrowLeft />} onClick={volver}>
                Volver a pedidos
              </GlassButton>
              {!noExiste ? (
                <GlassButton icono={<RotateCcw />} onClick={() => void consulta.refetch()}>
                  Reintentar
                </GlassButton>
              ) : null}
            </div>
          }
        />
      </GlassPanel>
    )
  }

  const p = consulta.data
  const gestionar = puede('gestionar_pedidos')
  const mover = puede('actualizar_produccion') || gestionar
  const precios = puede('ver_precios') && p.montos !== null

  const irA = async (estado: EstadoPedido, opciones: { deshacer?: boolean } = {}) => {
    const antes = p.estado
    try {
      await cambiar.mutateAsync({ id: p.id, estado })
      const etiqueta = ESTADO_PEDIDO[estado].etiqueta
      toast.success(`${p.folio}: ${etiqueta.toLowerCase()}`, {
        action:
          opciones.deshacer !== false && antes !== 'pausado' && antes !== 'cancelado' && antes !== 'finalizado'
            ? { label: 'Deshacer', onClick: () => void irA(antes, { deshacer: false }) }
            : undefined,
      })
    } catch {
      /* el hook ya muestra el error */
    }
  }

  // Al reabrir se regresa a la etapa en la que estaba antes de cancelarse (o a "entregado" si se finalizó)
  const reabrir = () => {
    if (p.estado === 'finalizado') return void irA(etapasDe(p).includes('entregado') ? 'entregado' : 'nuevo', { deshacer: false })
    const ultimo = [...(eventos.data ?? [])].reverse().find((e) => e.tipo === 'estado' && e.estado_a === 'cancelado')
    const destino = ultimo?.estado_de && ultimo.estado_de !== 'pausado' ? ultimo.estado_de : 'nuevo'
    void irA(destino, { deshacer: false })
  }

  const listo = p.estado === 'listo_entrega'

  return (
    <div className="flex flex-col gap-5 pt-1">
      {/* Encabezado + botones tipo Centro de Control */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <GlassIconButton etiqueta="Volver a pedidos" icono={<ArrowLeft />} tamano="sm" className="mt-0.5 shrink-0" onClick={volver} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="num text-sm font-semibold text-fg-muted">{p.folio}</span>
              <EtapaPildora estado={p.estado} />
              <PrioridadMarca prioridad={p.prioridad} compacta />
              {p.cotizacion_id && precios ? (
                <Link
                  to={`/cotizaciones/${p.cotizacion_id}`}
                  className="relative inline-flex h-6 items-center gap-1 rounded-full bg-fg/[0.07] px-2.5 text-xs font-semibold text-fg-muted outline-none transition-colors after:absolute after:-inset-y-2.5 after:inset-x-0 hover:bg-fg/[0.12] hover:text-fg focus-visible:shadow-[var(--focus-ring)]"
                >
                  <FileText className="size-3" aria-hidden />
                  <span className="sr-only">Cotización de origen </span>
                  <span className="num">{p.cotizacion_folio ?? 'Cotización'}</span>
                </Link>
              ) : null}
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-fg sm:text-2xl">{p.cliente_datos.nombre}</h2>
            <p className="mt-0.5 text-base text-fg-muted">{p.titulo}</p>
          </div>
        </div>
        <Acciones p={p} whatsapp={whatsapp} destacarWhatsApp={listo} ordenTrabajo={puede('actualizar_produccion')} />
      </div>

      <div className="flex justify-end">
        <BotonEnlacePortal tipo="pedido" id={p.id} folio={p.folio} clienteWhatsapp={p.cliente_datos.whatsapp} />
      </div>

      <AvisoEstado p={p} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <LineaEtapas
            p={p}
            a={{
              mover,
              gestionar,
              ocupado: cambiar.isPending ? (cambiar.variables?.estado ?? null) : null,
              irA: (e) => void irA(e),
              pausar: () => setMotivo('pausado'),
              cancelar: () => setMotivo('cancelado'),
              reanudar: () => void irA(p.estado_anterior ?? 'nuevo', { deshacer: false }),
              reabrir,
              elegirEtapas: () => setEtapas(true),
            }}
          />
          <PanelArchivos p={p} />
          <PanelConceptos p={p} precios={precios} editar={gestionar} />
          {!ancho ? <Aside p={p} precios={precios} gestionar={gestionar} registrarPagos={puede('registrar_pagos')} /> : null}
          <PanelHistorial pedidoId={p.id} precios={precios} />
        </div>
        {ancho ? <Aside p={p} precios={precios} gestionar={gestionar} registrarPagos={puede('registrar_pagos')} /> : null}
      </div>

      <DialogoMotivo tipo={motivo} onCerrar={() => setMotivo(null)} p={p} />
      {gestionar ? <DialogoEtapas abierto={etapas} onCambio={setEtapas} p={p} /> : null}
    </div>
  )
}

function Aside({ p, precios, gestionar, registrarPagos }: { p: PedidoDetalle; precios: boolean; gestionar: boolean; registrarPagos: boolean }) {
  return (
    <aside className="grid gap-4 md:grid-cols-2 xl:grid-cols-1" aria-label="Resumen del pedido">
      {precios ? <ModuloCobro p={p} registrarPagos={registrarPagos} /> : null}
      <ModuloDatos p={p} editar={gestionar && p.estado !== 'cancelado'} />
      {precios || gestionar ? <ModuloFacturacion p={p} editar={gestionar && p.estado !== 'cancelado'} /> : null}
    </aside>
  )
}

function Acciones({
  p,
  whatsapp,
  destacarWhatsApp,
  ordenTrabajo,
}: {
  p: PedidoDetalle
  whatsapp: ReturnType<typeof useWhatsAppPedido>
  destacarWhatsApp: boolean
  ordenTrabajo: boolean
}) {
  const reducir = useReducedMotion()
  const navegar = useNavigate()
  const [menu, setMenu] = useState(false)
  const botones: Array<{ id: string; nodo: ReactNode }> = []

  botones.push({
    id: 'whatsapp',
    nodo: (
      <Menu.Root open={menu} onOpenChange={setMenu} modal={false}>
        <Menu.Trigger asChild>
          <GlassIconButton etiqueta="WhatsApp" aria-label="Enviar mensaje por WhatsApp" mostrarEtiqueta icono={<MessageCircle />} destacado={destacarWhatsApp} tono="luz" tamano="md" />
        </Menu.Trigger>
        <AnimatePresence>
          {menu ? (
            <Menu.Portal forceMount>
              <Menu.Content asChild align="end" sideOffset={40} collisionPadding={12} forceMount>
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -4 }}
                  transition={resorte.modal}
                  style={{ transformOrigin: 'var(--radix-dropdown-menu-content-transform-origin)' }}
                  className="glass glass-strong z-50 w-64 rounded-module p-2 shadow-glass-lg outline-none"
                >
                  <p className="px-3 pb-1 pt-2 text-xs font-medium text-fg-subtle">Mensaje para {p.cliente_datos.nombre}</p>
                  {whatsapp.opciones.map((o) => (
                    <Menu.Item
                      key={o.clave}
                      onSelect={() => whatsapp.enviar(o.clave)}
                      className="flex h-11 cursor-pointer items-center gap-3 rounded-full px-3 text-sm font-medium text-fg outline-none transition-colors data-[highlighted]:bg-[var(--control-bg-hover)] [&_svg]:size-4"
                    >
                      <MessageCircle aria-hidden />
                      {o.nombre}
                    </Menu.Item>
                  ))}
                </motion.div>
              </Menu.Content>
            </Menu.Portal>
          ) : null}
        </AnimatePresence>
      </Menu.Root>
    ),
  })
  if (ordenTrabajo) {
    botones.push({
      id: 'orden',
      nodo: <GlassIconButton etiqueta="Orden de trabajo" mostrarEtiqueta icono={<ClipboardList />} tamano="md" onClick={() => navegar(`/produccion/${p.id}`)} />,
    })
  }
  return (
    <div role="group" aria-label="Acciones del pedido" className="flex flex-wrap justify-start gap-x-2 gap-y-4 pl-[3.25rem] lg:justify-end lg:pl-0">
      {botones.map((b, i) => (
        <motion.div
          key={b.id}
          className="w-[5.5rem]"
          initial={reducir ? false : { opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...resorte.agil, delay: reducir ? 0 : 0.08 + escalonado(i, 0.04) }}
        >
          {b.nodo}
        </motion.div>
      ))}
    </div>
  )
}

/** Avisos que piden atención: pausado, cancelado o atrasado. */
function AvisoEstado({ p }: { p: PedidoDetalle }) {
  const reducir = useReducedMotion()
  let aviso: { clave: string; tono: 'aviso' | 'peligro'; icono: ReactNode; titulo: string; texto: string } | null = null
  if (p.estado === 'pausado') {
    aviso = { clave: 'pausado', tono: 'aviso', icono: <Pause />, titulo: 'Pedido en pausa', texto: p.motivo_estado ? `Motivo: ${p.motivo_estado}` : 'Sin motivo registrado.' }
  } else if (p.estado === 'cancelado') {
    aviso = { clave: 'cancelado', tono: 'peligro', icono: <Ban />, titulo: 'Pedido cancelado', texto: p.motivo_estado ? `Motivo: ${p.motivo_estado}` : 'Sin motivo registrado.' }
  } else if (p.atrasado) {
    aviso = { clave: 'atrasado', tono: 'peligro', icono: <AlertTriangle />, titulo: 'La fecha de entrega ya pasó', texto: 'Avisa al cliente y acuerda una nueva fecha; luego actualízala en los datos del trabajo.' }
  }
  const tonos = {
    aviso: { superficie: 'bg-warning-soft/70', pozo: 'bg-warning/15 text-warning' },
    peligro: { superficie: 'bg-danger-soft/60', pozo: 'bg-danger/15 text-danger' },
  }
  return (
    <AnimatePresence initial={false}>
      {aviso ? (
        <motion.div
          key={aviso.clave}
          initial={reducir ? false : { opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={resorte.suave}
        >
          <GlassSurface role="status" className={cn('flex items-center gap-3 rounded-module p-3 pr-4', tonos[aviso.tono].superficie)}>
            <span className={cn('grid size-12 shrink-0 place-items-center rounded-full [&_svg]:size-[1.35rem]', tonos[aviso.tono].pozo)} aria-hidden>
              {aviso.icono}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-fg">{aviso.titulo}</p>
              <p className="text-sm text-fg-muted">{aviso.texto}</p>
            </div>
          </GlassSurface>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function EsqueletoDetalle() {
  return (
    <div className="flex flex-col gap-5 pt-1" role="status" aria-label="Cargando pedido">
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40 rounded-full" />
          <Skeleton className="h-7 w-64 rounded-full" />
          <Skeleton className="h-4 w-48 rounded-full" />
        </div>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-5">
          <Skeleton className="h-64 rounded-sheet" />
          <Skeleton className="h-48 rounded-sheet" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-60 rounded-module" />
          <Skeleton className="h-72 rounded-module" />
        </div>
      </div>
    </div>
  )
}
