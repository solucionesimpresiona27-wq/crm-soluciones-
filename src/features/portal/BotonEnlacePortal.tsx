import { Ban, Copy, Eye, Link2, MessageCircle, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { useSesion } from '@/app/sesion'
import { EstadoVacio, GlassButton, GlassIconButton, GlassModal, Pildora, Skeleton } from '@/components/glass'
import type { EnlacePortal, TipoEnlace } from '@/data/modulos/portal/contrato'
import { fecha, haceCuanto } from '@/lib/format'
import { cn } from '@/lib/utils'
import { enlaceWhatsApp } from '@/lib/whatsapp'
import { useCrearEnlace, useEnlacesPortal, useRevocarEnlace } from './consultas'

export interface BotonEnlacePortalProps {
  tipo: TipoEnlace
  id: string
  folio: string
  /** Teléfono del cliente para abrir WhatsApp con el mensaje listo */
  clienteWhatsapp?: string | null
  className?: string
}

const mensaje = (tipo: TipoEnlace, folio: string, url: string) =>
  tipo === 'cotizacion'
    ? `Hola, te compartimos tu cotización ${folio} de Soluciones Impresiona. Puedes revisarla y aprobarla aquí:\n${url}`
    : `Hola, aquí puedes ver el avance de tu pedido ${folio} y aprobar los diseños:\n${url}`

/**
 * Enlace privado del portal del cliente para una cotización o pedido: crear, copiar,
 * enviar por WhatsApp y revocar. Exportado para las pantallas de cotizaciones y pedidos.
 * Requiere ver_precios y gestionar_cotizaciones / gestionar_pedidos (la base lo exige).
 */
export function BotonEnlacePortal({ tipo, id, folio, clienteWhatsapp, className }: BotonEnlacePortalProps) {
  const { puede } = useSesion()
  const [abierto, setAbierto] = useState(false)
  const permitido = puede('ver_precios') && puede(tipo === 'cotizacion' ? 'gestionar_cotizaciones' : 'gestionar_pedidos')
  if (!permitido) return null
  return (
    <>
      <GlassButton variante="cristal" icono={<Link2 />} onClick={() => setAbierto(true)} className={className}>
        Enlace para el cliente
      </GlassButton>
      <GlassModal
        abierto={abierto}
        onCambio={setAbierto}
        titulo="Enlace para el cliente"
        descripcion={tipo === 'cotizacion' ? `Tu cliente ve ${folio} y la aprueba sin crear cuenta.` : `Tu cliente ve el avance de ${folio} y aprueba sus diseños.`}
        ancho="md"
      >
        {abierto ? <PanelEnlaces tipo={tipo} id={id} clienteWhatsapp={clienteWhatsapp} /> : null}
      </GlassModal>
    </>
  )
}

function PanelEnlaces({ tipo, id, clienteWhatsapp }: Omit<BotonEnlacePortalProps, "className" | "folio">) {
  const enlaces = useEnlacesPortal(tipo, id)
  const crear = useCrearEnlace(tipo, id)
  const revocar = useRevocarEnlace(tipo, id)
  const enCurso = useRef(false)
  const [confirmar, setConfirmar] = useState<string | null>(null)
  const lista = enlaces.data ?? []
  const vigentes = lista.filter((e) => e.vigente)
  const anteriores = lista.filter((e) => !e.vigente).slice(0, 5)

  async function nuevo() {
    if (enCurso.current) return
    enCurso.current = true
    try {
      const e = await crear.mutateAsync({ nuevo: vigentes.length > 0 })
      await copiar(e.url, false)
      toast.success('Enlace creado y copiado', { description: `Vence el ${fecha(e.expira_at)}.` })
    } catch (err) {
      toast.error('No se pudo crear el enlace', { description: err instanceof Error ? err.message : 'Intenta de nuevo.' })
    } finally {
      enCurso.current = false
    }
  }

  async function copiar(url: string, avisar = true) {
    try {
      await navigator.clipboard.writeText(url)
      if (avisar) toast.success('Enlace copiado')
    } catch {
      if (avisar) toast.error('No se pudo copiar', { description: 'Selecciona el enlace y cópialo manualmente.' })
    }
  }

  async function revocarEnlace(e: EnlacePortal) {
    if (confirmar !== e.id) return setConfirmar(e.id)
    try {
      await revocar.mutateAsync(e.id)
      setConfirmar(null)
      toast.success('Enlace revocado', { description: 'Quien lo abra verá que ya no está disponible.' })
    } catch (err) {
      toast.error('No se pudo revocar', { description: err instanceof Error ? err.message : 'Intenta de nuevo.' })
    }
  }

  if (enlaces.isLoading) return <Skeleton className="h-28 rounded-tile" />
  if (enlaces.isError)
    return <EstadoVacio icono={<Link2 />} titulo="No se pudieron cargar los enlaces" descripcion={enlaces.error instanceof Error ? enlaces.error.message : 'Intenta de nuevo.'} />

  return (
    <div className="grid gap-4">
      {vigentes.length === 0 ? (
        <EstadoVacio icono={<Link2 />} titulo="Sin enlace activo" descripcion="Crea un enlace privado. Vence en 30 días y puedes revocarlo cuando quieras." />
      ) : (
        <ul className="grid gap-3">
          {vigentes.map((e) => (
            <li key={e.id} className="glass glass-clear rounded-tile p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="num text-sm font-semibold text-fg">{e.folio}</span>
                <Pildora tono="luz">Activo</Pildora>
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-fg-muted">
                  <Eye className="size-3.5" aria-hidden />
                  <span className="num">{e.vistas}</span> {e.vistas === 1 ? 'vista' : 'vistas'}
                </span>
              </div>
              <input
                readOnly
                value={e.url}
                aria-label={`Enlace de ${e.folio}`}
                onFocus={(ev) => ev.currentTarget.select()}
                className="mt-2 w-full truncate rounded-control bg-transparent px-0 py-1 text-xs text-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              <p className="text-xs text-fg-subtle">
                Vence el {fecha(e.expira_at)}
                {e.ultimo_acceso_at ? ` · abierto ${haceCuanto(e.ultimo_acceso_at)}` : ' · aún no lo abren'}
              </p>
              <div className="mt-3 flex flex-wrap items-start gap-3">
                <GlassIconButton icono={<Copy />} etiqueta="Copiar" mostrarEtiqueta tamano="sm" onClick={() => copiar(e.url)} />
                <GlassIconButton
                  icono={<MessageCircle />}
                  etiqueta="WhatsApp"
                  mostrarEtiqueta
                  destacado
                  tono="acento"
                  tamano="sm"
                  onClick={() => window.open(enlaceWhatsApp(clienteWhatsapp, mensaje(e.tipo, e.folio, e.url)), '_blank', 'noopener,noreferrer')}
                />
                <GlassIconButton
                  icono={<Ban />}
                  etiqueta={confirmar === e.id ? '¿Revocar?' : 'Revocar'}
                  mostrarEtiqueta
                  tamano="sm"
                  activo={confirmar === e.id}
                  tono="luz"
                  disabled={revocar.isPending}
                  onClick={() => revocarEnlace(e)}
                  className={cn(confirmar === e.id && 'text-danger')}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <GlassButton variante={vigentes.length ? 'cristal' : 'primario'} icono={<Plus />} cargando={crear.isPending} onClick={nuevo}>
        {vigentes.length ? 'Crear otro enlace' : 'Crear enlace'}
      </GlassButton>

      {anteriores.length ? (
        <div>
          <p className="text-xs font-semibold text-fg-muted">Enlaces anteriores</p>
          <ul className="mt-1 divide-y divide-[var(--divider)] text-xs text-fg-subtle">
            {anteriores.map((e) => (
              <li key={e.id} className="flex justify-between gap-3 py-2">
                <span className="num">{e.folio}</span>
                <span>
                  {e.revocado ? 'Revocado' : 'Vencido'} · <span className="num">{e.vistas}</span> vistas
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
