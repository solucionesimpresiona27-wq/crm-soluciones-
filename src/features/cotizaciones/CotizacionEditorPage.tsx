import type { UseQueryResult } from '@tanstack/react-query'
import { ArrowLeft, FileSearch, Lock, PackageCheck, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useConfiguracion } from '@/app/consultas'
import { useSesion } from '@/app/sesion'
import { api } from '@/data/api'
import { EstadoVacio, GlassButton, GlassIconButton, GlassModal, GlassPanel, Pildora, Skeleton } from '@/components/glass'
import type { Configuracion, CotizacionCompleta, ProductoCatalogo } from '@/data/tipos'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { ESTADO_COTIZACION, estadoVisibleCotizacion } from '@/lib/estados'
import { hoyISO } from '@/lib/format'
import { DEMO } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useCotizacion, useGuardarCotizacion, useProductos } from './consultas'
import { aBorrador, estadoDesdeCotizacion, estadoNuevo, primerError, type Errores, type EstadoEditor } from './editor/modelo'
import { BarraGuardar, Resumen } from './editor/Resumen'
import { SELECTOR_BUSCAR_CLIENTE, SeccionCliente } from './editor/SeccionCliente'
import { SeccionCondiciones } from './editor/SeccionCondiciones'
import { SeccionConceptos } from './editor/SeccionConceptos'
import { useEditorCotizacion } from './editor/useEditorCotizacion'

export default function CotizacionEditorPage() {
  const { puede } = useSesion()
  const { id } = useParams()
  if (!puede('ver_precios') || !puede('gestionar_cotizaciones')) return <SinAcceso />
  return <Cargador key={id ?? 'nueva'} id={id} />
}

function SinAcceso() {
  const navegar = useNavigate()
  return (
    <GlassPanel className="mt-2">
      <EstadoVacio
        icono={<Lock />}
        titulo="Tu rol no crea ni edita cotizaciones"
        descripcion="Las cotizaciones las preparan ventas y administración. Si necesitas hacerlo, pide el permiso al administrador."
        accion={
          <GlassButton variante="cristal" onClick={() => navegar('/')}>
            Ir al inicio
          </GlassButton>
        }
      />
    </GlassPanel>
  )
}

function EsqueletoEditor() {
  return (
    <div className="flex flex-col gap-5 pt-1" role="status" aria-label="Cargando el editor de cotizaciones">
      <div className="flex items-start gap-3">
        <Skeleton className="size-11 rounded-full" />
        <div className="grid gap-2 pt-0.5">
          <Skeleton className="h-4 w-28 rounded-full" />
          <Skeleton className="h-7 w-60 rounded-full" />
        </div>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-5">
          <Skeleton className="h-60 rounded-sheet" />
          <Skeleton className="h-96 rounded-sheet" />
        </div>
        <Skeleton className="h-[26rem] rounded-sheet" />
      </div>
    </div>
  )
}

function Cargador({ id }: { id?: string }) {
  const navegar = useNavigate()
  const { puede } = useSesion()
  const lista = (useLocation().state as { lista?: string } | null)?.lista ?? ''
  const config = useConfiguracion()
  const consulta = useCotizacion(id)
  const productos = useProductos()

  // Se edita la versión que se abrió: si la consulta se actualiza en segundo plano, no se pisa lo capturado.
  const [cotizacion, setCotizacion] = useState<CotizacionCompleta | null>(null)
  useEffect(() => {
    if (consulta.data && !cotizacion) setCotizacion(consulta.data)
  }, [consulta.data, cotizacion])
  const c = cotizacion ?? consulta.data ?? null

  if (config.isPending || (id && !c && !consulta.isError)) return <EsqueletoEditor />

  if (id && !c) {
    const noExiste = /no encontrada/i.test(consulta.error?.message ?? '')
    return (
      <GlassPanel className="mt-2">
        <EstadoVacio
          icono={<FileSearch />}
          titulo={noExiste ? 'No encontramos esta cotización' : 'No se pudo abrir la cotización'}
          descripcion={noExiste ? 'Puede que se haya eliminado o que el enlace esté incompleto.' : `${consulta.error?.message ?? ''}. Revisa tu conexión e inténtalo de nuevo.`}
          accion={
            <div className="flex flex-wrap justify-center gap-2">
              <GlassButton variante="cristal" icono={<ArrowLeft />} onClick={() => navegar(`/cotizaciones${lista}`)}>
                Volver a cotizaciones
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

  if (c?.pedido_id) {
    return (
      <GlassPanel className="mt-2">
        <EstadoVacio
          icono={<PackageCheck />}
          titulo={`${c.folio} ya es el pedido ${c.pedido_folio ?? ''}`.trim()}
          descripcion="Para respetar lo que se acordó con el cliente, una cotización convertida ya no se edita. Los cambios se hacen en el pedido o en una copia de la cotización."
          accion={
            <GlassButton variante="cristal" icono={<ArrowLeft />} onClick={() => navegar(`/cotizaciones/${c.id}`, { replace: true, state: { lista } })}>
              Volver a la cotización
            </GlassButton>
          }
        />
      </GlassPanel>
    )
  }

  return (
    <Editor
      cotizacion={c}
      config={config.data}
      productos={productos}
      lista={lista}
      puedeCostos={puede('ver_costos')}
      puedeCrearCliente={puede('gestionar_clientes')}
    />
  )
}

/** Lo que falta para guardar, en el orden de la pantalla. */
function listaPendientes(e: EstadoEditor, err: Errores) {
  const lista: string[] = []
  if (err.cliente) lista.push(err.cliente)
  if (err.fecha) lista.push(err.fecha)
  if (err.partidas) lista.push(err.partidas)
  e.partidas.forEach((p, i) => {
    const f = err.filas[p.clave]
    if (!f) return
    for (const m of [f.concepto, f.cantidad, f.descuento]) if (m) lista.push(`Concepto ${i + 1}: ${m.charAt(0).toLowerCase()}${m.slice(1)}`)
  })
  for (const m of [err.vigencia, err.anticipo, err.descuento, err.iva, err.recargo]) if (m) lista.push(m)
  return lista
}

function Editor({
  cotizacion,
  config,
  productos,
  lista,
  puedeCostos,
  puedeCrearCliente,
}: {
  cotizacion: CotizacionCompleta | null
  config: Configuracion | undefined
  productos: UseQueryResult<ProductoCatalogo[]>
  lista: string
  puedeCostos: boolean
  puedeCrearCliente: boolean
}) {
  const navegar = useNavigate()
  const escritorio = useMediaQuery('(min-width: 1280px)')
  const guardarMut = useGuardarCotizacion()
  const ed = useEditorCotizacion(
    () => (cotizacion ? estadoDesdeCotizacion(cotizacion) : estadoNuevo(config)),
    puedeCostos,
    productos.data,
  )
  const { estado, totales, errores } = ed

  // Desde la ficha del cliente: /cotizaciones/nueva?cliente=<id> deja al cliente ya elegido
  const [params] = useSearchParams()
  const clienteInicial = cotizacion ? null : params.get('cliente')
  const { actualizar } = ed
  useEffect(() => {
    if (!clienteInicial) return
    let vigente = true
    api.clientes
      .obtener(clienteInicial)
      .then((c) => {
        if (!vigente) return
        actualizar('cliente', { id: c.id, nombre: c.nombre, whatsapp: c.whatsapp, telefono: c.telefono, email: c.email, requiere_factura: c.requiere_factura, rfc: c.rfc, razon_social: c.razon_social })
      })
      .catch(() => {
        /* si no se encuentra, se elige a mano */
      })
    return () => {
      vigente = false
    }
  }, [clienteInicial, actualizar])
  const [intentos, setIntentos] = useState(0)
  const mostrarErrores = intentos > 0
  const hoy = useMemo(() => hoyISO(), [])

  /* Cambios sin guardar: se avisa al salir dentro de la app y al cerrar la pestaña */
  const saliendo = useRef(false)
  const sucio = useRef(ed.sucio)
  sucio.current = ed.sucio
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }: { currentLocation: { pathname: string }; nextLocation: { pathname: string } }) =>
        sucio.current && !saliendo.current && currentLocation.pathname !== nextLocation.pathname,
      [],
    ),
  )
  useEffect(() => {
    if (!ed.sucio) return
    const alSalir = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', alSalir)
    return () => window.removeEventListener('beforeunload', alSalir)
  }, [ed.sucio])

  /* Guardar */
  const guardar = async () => {
    if (guardarMut.isPending) return
    if (!ed.valido) {
      setIntentos((i) => i + 1)
      toast.error(primerError(errores) ?? 'Revisa los datos marcados', { description: 'Corrige lo marcado en rojo y vuelve a guardar.' })
      return
    }
    try {
      const r = await guardarMut.mutateAsync(aBorrador(estado, puedeCostos))
      saliendo.current = true
      toast.success(cotizacion ? `${r.folio} guardada` : `Cotización ${r.folio} guardada`, {
        description: cotizacion ? 'Los totales se actualizaron.' : 'Quedó como borrador. Desde aquí la puedes enviar por WhatsApp.',
      })
      navegar(`/cotizaciones/${r.id}`, { replace: true, state: { lista } })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar la cotización. Inténtalo de nuevo.')
    }
  }
  const guardarRef = useRef(guardar)
  guardarRef.current = guardar

  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        // Con una ventana abierta (p. ej. "Nuevo cliente") el atajo no guarda la cotización por debajo
        if (document.querySelector('[role="dialog"]')) return
        void guardarRef.current()
      }
    }
    window.addEventListener('keydown', atajo)
    return () => window.removeEventListener('keydown', atajo)
  }, [])

  // Después de un intento fallido, lleva el foco al primer dato que falta.
  useEffect(() => {
    if (!intentos) return
    const raiz = document.getElementById('editor-cotizacion')
    if (errores.cliente) {
      raiz?.querySelector<HTMLInputElement>(SELECTOR_BUSCAR_CLIENTE)?.focus()
      raiz?.querySelector('#titulo-cliente')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }
    if (errores.partidas) {
      raiz?.querySelector('#titulo-conceptos')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      return
    }
    const campo = raiz?.querySelector<HTMLElement>('[aria-invalid="true"]')
    if (campo) {
      campo.focus({ preventScroll: true })
      campo.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    // Solo al intentar guardar, no en cada cambio
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentos])

  const volver = () =>
    cotizacion ? navegar(`/cotizaciones/${cotizacion.id}`, { state: { lista } }) : navegar(`/cotizaciones${lista}`)

  const visible = cotizacion ? estadoVisibleCotizacion(cotizacion, hoy) : null
  const pendientes = mostrarErrores ? listaPendientes(estado, errores) : []

  return (
    <div id="editor-cotizacion" className={cn('flex flex-col gap-5 pt-1', !escritorio && (DEMO ? 'pb-28' : 'pb-20'))}>
      {/* Encabezado */}
      <div className="flex items-start gap-3">
        <GlassIconButton
          etiqueta={cotizacion ? 'Volver a la cotización' : 'Volver a cotizaciones'}
          icono={<ArrowLeft />}
          tamano="sm"
          className="mt-0.5 size-11 shrink-0"
          onClick={volver}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {cotizacion && visible ? (
              <>
                <span className="num text-sm font-semibold text-fg-muted">{cotizacion.folio}</span>
                <Pildora tono={ESTADO_COTIZACION[visible].tono}>{ESTADO_COTIZACION[visible].etiqueta}</Pildora>
              </>
            ) : (
              <span className="text-sm font-medium text-fg-muted">El folio se asigna al guardar</span>
            )}
            {ed.sucio ? <Pildora tono="luz">Cambios sin guardar</Pildora> : null}
          </div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-fg sm:text-2xl">
            {cotizacion ? `Editar cotización de ${cotizacion.cliente.nombre}` : 'Nueva cotización'}
          </h2>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <SeccionCliente estado={estado} errores={errores} mostrarErrores={mostrarErrores} puedeCrear={puedeCrearCliente} actualizar={ed.actualizar} />
          <SeccionConceptos
            partidas={estado.partidas}
            subtotal={totales.subtotal}
            errores={errores}
            mostrarErrores={mostrarErrores}
            ultima={ed.ultima}
            productoDe={ed.productoDe}
            productos={productos.data}
            cargandoProductos={productos.isPending}
            puedeCostos={puedeCostos}
            acciones={ed.acciones}
            onAgregar={ed.agregar}
          />
          <SeccionCondiciones
            estado={estado}
            totales={totales}
            errores={errores}
            mostrarErrores={mostrarErrores}
            condicionesBase={config?.condiciones_cotizacion ?? ''}
            actualizar={ed.actualizar}
          />
        </div>
        <aside className="xl:sticky xl:top-[5.75rem]">
          <Resumen
            estado={estado}
            totales={totales}
            puedeCostos={puedeCostos}
            pendientes={pendientes}
            guardando={guardarMut.isPending}
            onGuardar={() => void guardar()}
            conBoton={escritorio}
          />
        </aside>
      </div>

      {!escritorio ? <BarraGuardar total={totales.total} conIva={estado.aplica_iva} guardando={guardarMut.isPending} onGuardar={() => void guardar()} /> : null}

      <GlassModal
        abierto={blocker.state === 'blocked'}
        onCambio={(abierto) => {
          if (!abierto && blocker.state === 'blocked') blocker.reset()
        }}
        titulo="¿Salir sin guardar?"
        descripcion="Los cambios que hiciste en esta cotización se van a perder."
        ancho="sm"
        pie={
          <>
            <GlassButton variante="cristal" onClick={() => blocker.reset?.()}>
              Seguir editando
            </GlassButton>
            <GlassButton variante="peligro" onClick={() => blocker.proceed?.()}>
              Salir sin guardar
            </GlassButton>
          </>
        }
      >
        <p className="text-sm text-fg-muted">Si quieres conservarlos, vuelve y usa “Guardar cotización”.</p>
      </GlassModal>
    </div>
  )
}
