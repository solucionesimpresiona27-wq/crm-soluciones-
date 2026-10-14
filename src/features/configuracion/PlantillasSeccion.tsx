import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, MessageCircle, RotateCcw, Save } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { claves } from '@/app/consultas'
import { EncabezadoPanel, EstadoVacio, GlassButton, GlassInput, GlassPanel, GlassSurface, GlassTextarea, Pildora, Skeleton } from '@/components/glass'
import { api } from '@/data/api'
import type { Configuracion, Plantilla } from '@/data/modulos/administracion/contrato'
import { useEsEscritorio } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import { llenarPlantilla } from '@/lib/whatsapp'
import { Interruptor } from '@/features/usuarios/piezas'
import { CONTEXTO_PLANTILLA, TEXTO_ORIGINAL, VARIABLES, insertarVariable, variablesDesconocidas } from './plantillas'

const clave = ['plantillas', 'todas'] as const

/** Lista y editor de plantillas de WhatsApp con variables insertables y vista previa. */
export function PlantillasSeccion({ config, onSucio }: { config: Configuracion; onSucio: (s: boolean) => void }) {
  const consulta = useQuery({ queryKey: clave, queryFn: () => api.plantillas.todas() })
  const escritorio = useEsEscritorio()
  const [elegida, setElegida] = useState<string | null>(null)
  const actual = consulta.data?.find((p) => p.id === elegida) ?? (escritorio ? consulta.data?.[0] : undefined)

  if (consulta.isPending)
    return (
      <GlassPanel className="flex flex-col gap-3 p-5" role="status" aria-label="Cargando plantillas">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-control" />
        ))}
      </GlassPanel>
    )
  if (consulta.isError)
    return (
      <GlassPanel>
        <EstadoVacio icono={<MessageCircle />} titulo="No se pudieron cargar las plantillas" descripcion={`${consulta.error.message}. Inténtalo de nuevo.`} accion={<GlassButton onClick={() => void consulta.refetch()}>Reintentar</GlassButton>} />
      </GlassPanel>
    )

  const lista = (
    <GlassPanel className="flex flex-col">
      <EncabezadoPanel titulo="Plantillas de WhatsApp" descripcion="Mensajes listos para los botones de WhatsApp." className="px-5 pb-3 pt-5" />
      <ul className="flex flex-col gap-0.5 px-2 pb-2">
        {consulta.data.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setElegida(p.id)}
              aria-current={actual?.id === p.id ? 'true' : undefined}
              className={cn(
                'flex min-h-11 w-full items-center gap-3 rounded-tile px-3 py-2.5 text-left outline-none transition-colors hover:bg-[var(--control-bg)] focus-visible:ring-2 focus-visible:ring-accent',
                actual?.id === p.id && 'bg-accent/[0.1] dark:bg-navy-400/15',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate font-medium', p.activo ? 'text-fg' : 'text-fg-subtle')}>{p.nombre}</span>
                <span className="block truncate text-xs text-fg-subtle">{p.texto.split('\n')[0]}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                {TEXTO_ORIGINAL[p.clave] && TEXTO_ORIGINAL[p.clave] !== p.texto ? <Pildora tono="luz" punto={false}>Editada</Pildora> : null}
                {!p.activo ? <Pildora punto={false}>Apagada</Pildora> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </GlassPanel>
  )

  if (!escritorio) {
    return actual ? (
      <div className="flex flex-col gap-3">
        <GlassButton variante="fantasma" icono={<ChevronLeft />} className="self-start" onClick={() => setElegida(null)}>
          Todas las plantillas
        </GlassButton>
        <Editor key={actual.id} p={actual} config={config} onSucio={onSucio} />
      </div>
    ) : (
      lista
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[17rem_1fr]">
      {lista}
      {actual ? <Editor key={actual.id} p={actual} config={config} onSucio={onSucio} /> : null}
    </div>
  )
}

function Editor({ p, config, onSucio }: { p: Plantilla; config: Configuracion; onSucio: (s: boolean) => void }) {
  const qc = useQueryClient()
  const [nombre, setNombre] = useState(p.nombre)
  const [texto, setTexto] = useState(p.texto)
  const area = useRef<HTMLTextAreaElement>(null)
  // Última selección del cursor (si nunca se tocó el mensaje, se agrega al final)
  const seleccion = useRef<[number, number] | null>(null)
  const sucio = nombre !== p.nombre || texto !== p.texto
  useLayoutEffect(() => onSucio(sucio), [sucio, onSucio])
  useLayoutEffect(() => () => onSucio(false), [onSucio])

  const original = TEXTO_ORIGINAL[p.clave]
  const desconocidas = variablesDesconocidas(texto)
  const ejemplo = useMemo(() => Object.fromEntries(VARIABLES.map((v) => [v.clave, v.clave === 'empresa' ? config.nombre_comercial : v.ejemplo])), [config.nombre_comercial])
  const vista = llenarPlantilla(texto, ejemplo)

  const guardar = useMutation({
    mutationFn: (c: Partial<Pick<Plantilla, 'nombre' | 'texto' | 'activo'>>) => api.plantillas.guardar(p.id, c),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: claves.plantillas })
      void qc.invalidateQueries({ queryKey: ['bitacora'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const insertar = (k: string) => {
    const el = area.current
    const [ini, fin] = seleccion.current ?? [texto.length, texto.length]
    const r = insertarVariable(texto, ini, fin, k)
    setTexto(r.texto)
    seleccion.current = [r.cursor, r.cursor]
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(r.cursor, r.cursor)
    })
  }

  return (
    <GlassPanel className="flex flex-col">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!nombre.trim()) return void toast.error('Escribe un nombre para la plantilla')
          if (!texto.trim()) return void toast.error('El mensaje no puede quedar vacío')
          guardar.mutate({ nombre, texto }, { onSuccess: () => toast.success('Plantilla guardada') })
        }}
      >
        <EncabezadoPanel
          className="px-5 pb-4 pt-5"
          titulo={p.nombre}
          descripcion={`Se usa en ${CONTEXTO_PLANTILLA[p.contexto]?.toLowerCase() ?? p.contexto}.`}
          acciones={
            <label className="flex items-center gap-1 text-sm text-fg-muted">
              {p.activo ? 'Activa' : 'Apagada'}
              <Interruptor activo={p.activo} etiqueta={`Plantilla ${p.nombre} activa`} disabled={guardar.isPending} onCambio={(v) => guardar.mutate({ activo: v }, { onSuccess: () => toast.success(v ? 'Plantilla activada' : 'Plantilla apagada: ya no aparece en los botones') })} />
            </label>
          }
        />
        <div className="grid gap-4 px-5 pb-5 2xl:grid-cols-[1fr_minmax(15rem,20rem)]">
          <div className="flex min-w-0 flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-fg-muted">
              Nombre
              <GlassInput value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-fg-muted">
              Mensaje
              <GlassTextarea ref={area} rows={8} value={texto} onChange={(e) => setTexto(e.target.value)} onSelect={(e) => (seleccion.current = [e.currentTarget.selectionStart, e.currentTarget.selectionEnd])} className="font-normal" />
            </label>
            <div>
              <p className="mb-1.5 text-xs text-fg-subtle">Toca una variable para insertarla donde está el cursor:</p>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES.map((v) => (
                  <button
                    key={v.clave}
                    type="button"
                    title={v.descripcion}
                    onClick={() => insertar(v.clave)}
                    className="min-h-9 rounded-full bg-accent/[0.1] px-3 font-mono text-xs font-medium text-accent outline-none transition-colors hover:bg-accent/[0.18] focus-visible:ring-2 focus-visible:ring-accent pointer-coarse:min-h-11 dark:bg-navy-400/20 dark:text-navy-100"
                  >
                    {`{${v.clave}}`}
                  </button>
                ))}
              </div>
              {desconocidas.length ? (
                <p className="mt-2 text-sm text-warning">
                  No reconozco {desconocidas.map((d) => `{${d}}`).join(', ')}: quedará vacío al enviar. Revisa que esté bien escrito.
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fg-muted">Vista previa con datos de ejemplo</span>
            <GlassSurface variante="claro" className="rounded-tile bg-[#e7ddd3]/60 p-3 dark:bg-[#0b141a]/60">
              <p className="ml-auto max-w-[95%] whitespace-pre-wrap rounded-[1rem] rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-sm leading-snug text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]">
                {vista || 'Escribe el mensaje…'}
              </p>
            </GlassSurface>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--divider)] px-5 py-3">
          {sucio ? (
            <span className="flex items-center gap-2 text-sm font-medium text-fg">
              <span className="size-2 rounded-full bg-luz shadow-[0_0_10px_rgba(249,194,6,0.9)]" aria-hidden /> Cambios sin guardar
            </span>
          ) : null}
          <span className="ml-auto flex flex-wrap gap-2">
            {original && original !== texto ? (
              <GlassButton variante="fantasma" icono={<RotateCcw />} onClick={() => setTexto(original)}>
                Restaurar texto original
              </GlassButton>
            ) : null}
            {sucio ? (
              <GlassButton variante="cristal" onClick={() => { setNombre(p.nombre); setTexto(p.texto) }}>
                Descartar
              </GlassButton>
            ) : null}
            <GlassButton type="submit" variante="primario" icono={<Save />} disabled={!sucio} cargando={guardar.isPending}>
              Guardar plantilla
            </GlassButton>
          </span>
        </div>
      </form>
    </GlassPanel>
  )
}
