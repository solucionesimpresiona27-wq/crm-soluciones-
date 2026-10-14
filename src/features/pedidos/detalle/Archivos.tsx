import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Eye, FileText, ImageIcon, Link2, Loader2, MessageSquareReply, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { useSesion } from '@/app/sesion'
import { EncabezadoPanel, EstadoVacio, GlassButton, GlassModal, GlassPanel, Pildora, Skeleton, type TonoPildora } from '@/components/glass'
import { api } from '@/data/api'
import type { Archivo, CategoriaArchivo, EstadoArchivo, PedidoDetalle } from '@/data/modulos/pedidos/contrato'
import { haceCuanto } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useArchivosPedido, useEliminarArchivo, useSubirArchivo } from '../consultas'
import { DialogoAprobacion, DialogoEnlace } from './Dialogos'

const MAX_MB = 25
const TIPOS = 'image/jpeg,image/png,image/webp,application/pdf'

export const ESTADO_ARCHIVO: Record<EstadoArchivo, { etiqueta: string; tono: TonoPildora }> = {
  no_aplica: { etiqueta: '', tono: 'neutro' },
  pendiente: { etiqueta: 'Por aprobar', tono: 'luz' },
  aprobado: { etiqueta: 'Aprobado', tono: 'exito' },
  cambios: { etiqueta: 'Pidió cambios', tono: 'aviso' },
  rechazado: { etiqueta: 'Rechazado', tono: 'peligro' },
}

const CATEGORIA: Record<string, string> = { diseno: 'Diseño', referencia: 'Referencia', evidencia: 'Evidencia', otro: 'Archivo' }

const esImagen = (a: Archivo) => Boolean(a.mime?.startsWith('image/'))
const esPdf = (a: Archivo) => a.mime === 'application/pdf' || /\.pdf$/i.test(a.nombre)

function useUrlArchivo(a: Archivo, activo: boolean) {
  return useQuery({
    queryKey: ['pedidos', 'archivo-url', a.id],
    queryFn: () => api.archivos.url(a.id),
    enabled: activo,
    // El enlace firmado dura 10 minutos
    staleTime: 8 * 60_000,
    gcTime: 9 * 60_000,
  })
}

/** Archivos y aprobaciones: diseños con versión, referencias, evidencias y enlaces a originales pesados. */
export function PanelArchivos({ p }: { p: PedidoDetalle }) {
  const { puede, sesion } = useSesion()
  const consulta = useArchivosPedido(p.id)
  const subir = useSubirArchivo()
  const eliminar = useEliminarArchivo()
  const entrada = useRef<HTMLInputElement>(null)
  const [categoria, setCategoria] = useState<CategoriaArchivo>('diseno')
  const [enlace, setEnlace] = useState(false)
  const [respuesta, setRespuesta] = useState<Archivo | null>(null)
  const [vista, setVista] = useState<Archivo | null>(null)
  const [borrar, setBorrar] = useState<Archivo | null>(null)
  const puedeSubir = puede('actualizar_produccion') || puede('gestionar_pedidos') || puede('gestionar_clientes')
  const aprobar = puede('aprobar_disenos')
  const admin = sesion?.perfil.rol === 'admin'
  const evidencia = ['listo_entrega', 'en_instalacion', 'entregado', 'finalizado'].includes(p.estado)

  const elegir = (c: CategoriaArchivo) => {
    setCategoria(c)
    entrada.current?.click()
  }

  const alElegir = async (lista: FileList | null) => {
    const archivo = lista?.[0]
    if (entrada.current) entrada.current.value = ''
    if (!archivo) return
    if (archivo.size > MAX_MB * 1024 * 1024) {
      toast.error(`El archivo pesa más de ${MAX_MB} MB`, { description: 'Sube una prueba ligera (JPG o PDF) y agrega el original con un enlace de Drive.' })
      return
    }
    if (!TIPOS.split(',').includes(archivo.type)) {
      toast.error('Solo se pueden subir imágenes JPG, PNG o WebP y PDF', { description: 'Para archivos de Illustrator, Photoshop o similares, agrega un enlace.' })
      return
    }
    try {
      const a = await subir.mutateAsync({ pedidoId: p.id, archivo, categoria })
      toast.success(a.categoria === 'diseno' ? `Diseño v${a.version ?? ''} subido` : 'Archivo subido', {
        description: a.categoria === 'diseno' ? 'Queda por aprobar: registra la respuesta del cliente cuando la tengas.' : undefined,
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo subir el archivo. Inténtalo de nuevo.')
    }
  }

  const archivos = consulta.data ?? []
  const pendientes = archivos.filter((a) => a.estado_aprobacion === 'pendiente').length

  return (
    <GlassPanel className="p-5 sm:p-6">
      <EncabezadoPanel
        titulo={
          <span className="inline-flex items-center gap-2">
            Archivos y aprobaciones
            {pendientes ? <Pildora tono="luz">{pendientes === 1 ? '1 por aprobar' : `${pendientes} por aprobar`}</Pildora> : null}
          </span>
        }
        descripcion="Pruebas ligeras aquí; los originales pesados, con un enlace."
        acciones={
          puedeSubir ? (
            <div className="flex flex-wrap gap-2">
              <GlassButton variante="cristal" tamano="sm" icono={<Link2 />} onClick={() => setEnlace(true)} className="h-11 px-3.5">
                Enlace
              </GlassButton>
              {evidencia ? (
                <GlassButton variante="cristal" tamano="sm" icono={<ImageIcon />} onClick={() => elegir('evidencia')} className="h-11 px-3.5" disabled={subir.isPending}>
                  Evidencia
                </GlassButton>
              ) : null}
              <GlassButton
                variante="primario"
                tamano="sm"
                icono={subir.isPending && categoria === 'diseno' ? <Loader2 className="animate-spin" /> : <Upload />}
                onClick={() => elegir('diseno')}
                className="h-11 px-4"
                disabled={subir.isPending}
              >
                Subir diseño
              </GlassButton>
            </div>
          ) : null
        }
      />
      <input ref={entrada} type="file" accept={TIPOS} className="sr-only" tabIndex={-1} aria-label="Elegir archivo para subir" onChange={(e) => void alElegir(e.target.files)} data-subir-archivo="" />

      <div className="mt-4">
        {consulta.isPending ? (
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Skeleton className="h-24 rounded-tile" />
            <Skeleton className="h-24 rounded-tile" />
          </div>
        ) : archivos.length === 0 ? (
          <EstadoVacio
            icono={<ImageIcon />}
            titulo="Sin archivos todavía"
            descripcion={puedeSubir ? 'Sube la prueba del diseño en JPG o PDF; cada nueva subida queda como una versión nueva.' : 'Aquí aparecerán los diseños y las evidencias del pedido.'}
            className="py-6"
          />
        ) : (
          <ul className="grid gap-2.5 sm:grid-cols-2" aria-label="Archivos del pedido">
            {archivos.map((a) => {
              const puedeBorrar = admin || (a.subido_por === sesion?.id && a.estado_aprobacion !== 'aprobado')
              return (
                <li key={a.id}>
                  <TarjetaArchivo
                    a={a}
                    onVer={() => (a.enlace_externo ? window.open(a.enlace_externo, '_blank', 'noopener,noreferrer') : setVista(a))}
                    onResponder={aprobar && a.categoria === 'diseno' && a.estado_aprobacion !== 'aprobado' ? () => setRespuesta(a) : undefined}
                    onEliminar={puedeBorrar ? () => setBorrar(a) : undefined}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <DialogoEnlace abierto={enlace} onCambio={setEnlace} pedidoId={p.id} />
      <DialogoAprobacion archivo={respuesta} onCerrar={() => setRespuesta(null)} p={p} />
      <VistaPrevia archivo={vista} onCerrar={() => setVista(null)} />
      <GlassModal
        abierto={borrar !== null}
        onCambio={(v) => !v && setBorrar(null)}
        titulo="Eliminar archivo"
        descripcion={borrar ? `“${borrar.nombre}” se borra del pedido. No se puede deshacer.` : undefined}
        ancho="sm"
        pie={
          <>
            <GlassButton variante="fantasma" onClick={() => setBorrar(null)}>
              Conservar
            </GlassButton>
            <GlassButton
              variante="peligro"
              icono={<Trash2 />}
              cargando={eliminar.isPending}
              onClick={() =>
                borrar &&
                eliminar.mutate(borrar.id, {
                  onSuccess: () => {
                    toast.success('Archivo eliminado')
                    setBorrar(null)
                  },
                })
              }
            >
              Eliminar archivo
            </GlassButton>
          </>
        }
      >
        <span className="sr-only">Confirmación</span>
      </GlassModal>
    </GlassPanel>
  )
}

function Miniatura({ a }: { a: Archivo }) {
  const imagen = esImagen(a) && !a.enlace_externo
  const url = useUrlArchivo(a, imagen)
  if (imagen && url.data) {
    return <img src={url.data} alt="" className="size-16 shrink-0 rounded-[14px] bg-fg/5 object-cover" loading="lazy" />
  }
  return (
    <span className="grid size-16 shrink-0 place-items-center rounded-[14px] bg-[var(--control-bg)] text-fg-subtle [&_svg]:size-6" aria-hidden>
      {a.enlace_externo ? <ExternalLink /> : esPdf(a) ? <FileText /> : imagen && url.isPending ? <Loader2 className="animate-spin" /> : <ImageIcon />}
    </span>
  )
}

function TarjetaArchivo({ a, onVer, onResponder, onEliminar }: { a: Archivo; onVer: () => void; onResponder?: () => void; onEliminar?: () => void }) {
  const estado = ESTADO_ARCHIVO[a.estado_aprobacion]
  return (
    <div className={cn('flex h-full flex-col gap-3 rounded-tile border border-[var(--divider)] bg-[var(--control-bg)]/40 p-3', a.estado_aprobacion === 'pendiente' && 'border-luz/60 bg-luz/[0.07]')}>
      <div className="flex min-w-0 gap-3">
        <Miniatura a={a} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-fg-muted">
              {CATEGORIA[a.categoria] ?? 'Archivo'}
              {a.version ? <span className="num"> v{a.version}</span> : null}
            </span>
            {estado.etiqueta ? <Pildora tono={estado.tono}>{estado.etiqueta}</Pildora> : null}
          </div>
          <p className="mt-0.5 truncate text-sm font-semibold text-fg" title={a.nombre}>
            {a.nombre}
          </p>
          <p className="truncate text-xs text-fg-subtle">
            {a.subido_por_nombre ? `${a.subido_por_nombre.split(' ')[0]} · ` : ''}
            {haceCuanto(a.created_at)}
          </p>
          {a.aprobado_por_nombre && a.estado_aprobacion !== 'pendiente' ? (
            <p className="mt-1 text-xs text-fg-muted">
              {a.estado_aprobacion === 'aprobado' ? 'Aprobó' : 'Respondió'}: {a.aprobado_por_nombre}
              {a.aprobacion_notas ? ` · “${a.aprobacion_notas}”` : ''}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-auto flex items-center gap-1.5">
        <GlassButton variante="cristal" tamano="sm" icono={a.enlace_externo ? <ExternalLink /> : <Eye />} onClick={onVer} className="h-11 px-3.5" aria-label={`${a.enlace_externo ? 'Abrir enlace' : 'Ver'} ${a.nombre}`}>
          {a.enlace_externo ? 'Abrir' : 'Ver'}
        </GlassButton>
        {onResponder ? (
          <GlassButton variante={a.estado_aprobacion === 'pendiente' ? 'luz' : 'cristal'} tamano="sm" icono={<MessageSquareReply />} onClick={onResponder} className="h-11 px-3.5">
            Registrar respuesta
          </GlassButton>
        ) : null}
        {onEliminar ? (
          <GlassButton variante="fantasma" tamano="icono" icono={<Trash2 />} aria-label={`Eliminar ${a.nombre}`} onClick={onEliminar} className="ml-auto" />
        ) : null}
      </div>
    </div>
  )
}

function VistaPrevia({ archivo, onCerrar }: { archivo: Archivo | null; onCerrar: () => void }) {
  return (
    <GlassModal abierto={archivo !== null} onCambio={(v) => !v && onCerrar()} titulo={archivo?.nombre ?? 'Archivo'} descripcion={archivo?.version ? `Versión ${archivo.version}` : undefined} ancho="xl">
      {archivo ? <ContenidoVista a={archivo} /> : null}
    </GlassModal>
  )
}

function ContenidoVista({ a }: { a: Archivo }) {
  const url = useUrlArchivo(a, true)
  if (url.isPending) return <Skeleton className="h-[60vh] rounded-tile" />
  if (url.isError || !url.data) {
    return <EstadoVacio icono={<FileText />} titulo="No se pudo abrir el archivo" descripcion={url.error?.message ?? 'El archivo ya no está disponible. Pide a quien lo subió que lo vuelva a subir.'} />
  }
  return (
    <div className="flex flex-col gap-3">
      {esImagen(a) ? (
        <img src={url.data} alt={a.nombre} className="max-h-[65vh] w-full rounded-tile bg-fg/5 object-contain" />
      ) : esPdf(a) ? (
        <iframe src={url.data} title={a.nombre} className="h-[65vh] w-full rounded-tile bg-white" />
      ) : (
        <p className="text-sm text-fg-muted">Este tipo de archivo no tiene vista previa.</p>
      )}
      <div className="flex justify-end">
        <a href={url.data} target="_blank" rel="noopener noreferrer" download={a.nombre} className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-accent outline-none hover:bg-[var(--control-bg)] dark:text-navy-200">
          <ExternalLink className="size-4" aria-hidden />
          Abrir en otra pestaña
        </a>
      </div>
    </div>
  )
}
