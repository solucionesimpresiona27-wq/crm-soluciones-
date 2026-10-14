import { Building2, ChevronLeft, ChevronRight, FileText, MessageCircle, Receipt, RotateCcw, Settings, Users, Wallet, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { useBlocker, useLocation, useNavigate } from 'react-router-dom'
import { useConfiguracion } from '@/app/consultas'
import { useSesion } from '@/app/sesion'
import { EstadoVacio, GlassButton, GlassModal, GlassPanel, Skeleton } from '@/components/glass'
import { useEsEscritorio } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import { SinAccesoAdmin } from '@/features/usuarios/piezas'
import { PlantillasSeccion } from './PlantillasSeccion'
import { ClientesSeccion, CotizacionesSeccion, EmpresaSeccion, FiscalesSeccion, PagosSeccion, type PropsSeccion } from './Secciones'

interface DefSeccion {
  ruta: string
  titulo: string
  descripcion: string
  icono: LucideIcon
  Componente: ComponentType<PropsSeccion>
}

const SECCIONES: DefSeccion[] = [
  { ruta: 'empresa', titulo: 'Empresa', descripcion: 'Nombre, contacto, redes y logo', icono: Building2, Componente: EmpresaSeccion },
  { ruta: 'fiscales', titulo: 'Datos fiscales', descripcion: 'RFC, razón social y si se muestran', icono: Receipt, Componente: FiscalesSeccion },
  { ruta: 'cotizaciones', titulo: 'Cotizaciones', descripcion: 'IVA, anticipo, vigencia y condiciones', icono: FileText, Componente: CotizacionesSeccion },
  { ruta: 'pagos', titulo: 'Pagos', descripcion: 'Métodos de pago activos', icono: Wallet, Componente: PagosSeccion },
  { ruta: 'plantillas', titulo: 'Plantillas de WhatsApp', descripcion: 'Mensajes con variables', icono: MessageCircle, Componente: PlantillasSeccion },
  { ruta: 'clientes', titulo: 'Clientes', descripcion: 'Días para reactivación', icono: Users, Componente: ClientesSeccion },
]

/** Configuración (/configuracion/:seccion): menú lateral en escritorio, lista en celular. Solo administración. */
export default function ConfiguracionPage() {
  const { sesion } = useSesion()
  if (sesion?.perfil.rol !== 'admin') return <SinAccesoAdmin />
  return <Configuracion />
}

function Configuracion() {
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const escritorio = useEsEscritorio()
  const config = useConfiguracion()
  // Si la caché se vacía (p. ej. al refrescar la sesión) se conserva la última configuración
  // para no desmontar la sección y perder lo que se estaba escribiendo
  const ultima = useRef(config.data)
  if (config.data) ultima.current = config.data
  const datos = config.data ?? ultima.current
  const tramo = pathname.replace(/^\/configuracion\/?/, '').split('/')[0] ?? ''
  const elegida = SECCIONES.find((s) => s.ruta === tramo)
  // En escritorio /configuracion abre Empresa; en celular muestra la lista
  const actual = elegida ?? (escritorio ? SECCIONES[0] : undefined)

  /* Aviso de cambios sin guardar al cambiar de sección o salir */
  const [sucio, setSucio] = useState(false)
  const sucioRef = useRef(false)
  const onSucio = useCallback((s: boolean) => {
    sucioRef.current = s
    setSucio(s)
  }, [])
  const blocker = useBlocker(useCallback(({ currentLocation, nextLocation }: { currentLocation: { pathname: string }; nextLocation: { pathname: string } }) => sucioRef.current && currentLocation.pathname !== nextLocation.pathname, []))
  // Cambio de sección desde este menú: se confirma aquí mismo (cada sección es otra ruta)
  const [pendiente, setPendiente] = useState<string | null>(null)
  const ir = (ruta: string) => {
    if (sucioRef.current && ruta !== pathname) setPendiente(ruta)
    else navegar(ruta)
  }
  const preguntando = blocker.state === 'blocked' || pendiente !== null
  const seguir = () => {
    setPendiente(null)
    blocker.reset?.()
  }
  const salir = () => {
    sucioRef.current = false
    setSucio(false)
    if (pendiente) {
      const r = pendiente
      setPendiente(null)
      navegar(r)
    } else blocker.proceed?.()
  }
  useEffect(() => {
    if (!sucio) return
    const alSalir = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', alSalir)
    return () => window.removeEventListener('beforeunload', alSalir)
  }, [sucio])

  const menu = (
    <nav aria-label="Secciones de configuración">
      <GlassPanel className="p-2">
        <ul className="flex flex-col gap-0.5">
          {SECCIONES.map((s) => {
            const Icono = s.icono
            const activa = actual?.ruta === s.ruta
            return (
              <li key={s.ruta}>
                <button
                  type="button"
                  aria-current={activa ? 'page' : undefined}
                  onClick={() => ir(`/configuracion/${s.ruta}`)}
                  className={cn(
                    'flex min-h-12 w-full items-center gap-3 rounded-tile px-3 py-2 text-left outline-none transition-colors hover:bg-[var(--control-bg)] focus-visible:ring-2 focus-visible:ring-accent',
                    activa && 'bg-accent/[0.1] dark:bg-navy-400/15',
                  )}
                >
                  <span className={cn('grid size-9 shrink-0 place-items-center rounded-full [&_svg]:size-[1.1rem]', activa ? 'bg-accent text-accent-fg' : 'bg-[var(--control-bg)] text-fg')} aria-hidden>
                    <Icono />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-fg">{s.titulo}</span>
                    <span className="block truncate text-xs text-fg-subtle">{s.descripcion}</span>
                  </span>
                  {!escritorio ? <ChevronRight className="size-4 shrink-0 text-fg-subtle" aria-hidden /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      </GlassPanel>
    </nav>
  )

  let contenido
  if (!datos && config.isPending) {
    contenido = <Skeleton className="h-[28rem] rounded-sheet" />
  } else if (!datos && config.isError) {
    contenido = (
      <GlassPanel>
        <EstadoVacio icono={<Settings />} titulo="No se pudo cargar la configuración" descripcion={`${config.error.message}. Revisa tu conexión e inténtalo de nuevo.`} accion={<GlassButton icono={<RotateCcw />} onClick={() => void config.refetch()}>Reintentar</GlassButton>} />
      </GlassPanel>
    )
  } else if (actual && datos) {
    const C = actual.Componente
    contenido = <C key={actual.ruta} config={datos} onSucio={onSucio} />
  }

  return (
    <div className="pt-1">
      {escritorio ? (
        <div className="grid grid-cols-[17rem_1fr] items-start gap-4">
          <div className="sticky top-4">{menu}</div>
          <div className="min-w-0">{contenido}</div>
        </div>
      ) : actual ? (
        <div className="flex flex-col gap-3">
          <GlassButton variante="fantasma" icono={<ChevronLeft />} className="self-start" onClick={() => ir('/configuracion')}>
            Configuración
          </GlassButton>
          {contenido}
        </div>
      ) : (
        menu
      )}

      <GlassModal
        abierto={preguntando}
        onCambio={(v) => (!v ? seguir() : null)}
        titulo="Tienes cambios sin guardar"
        descripcion="Si sales ahora se perderán. Guárdalos primero o descártalos."
        ancho="sm"
        pie={
          <>
            <GlassButton variante="fantasma" onClick={seguir}>
              Seguir editando
            </GlassButton>
            <GlassButton variante="peligro" onClick={salir}>
              Salir sin guardar
            </GlassButton>
          </>
        }
      >
        {null}
      </GlassModal>
    </div>
  )
}
