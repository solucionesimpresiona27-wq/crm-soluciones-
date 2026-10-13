import { useQuery } from '@tanstack/react-query'
import { CloudOff, RefreshCw } from 'lucide-react'
import { motion, useReducedMotion, type Variants } from 'motion/react'
import { useCallback, useState } from 'react'
import { claves } from '@/app/consultas'
import { useSesion } from '@/app/sesion'
import { EstadoVacio, GlassButton, GlassIconButton, GlassPanel } from '@/components/glass'
import { api } from '@/data/api'
import type { DashboardResumen } from '@/data/tipos'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { AccesosModulo } from './AccesosModulo'
import { AgendaModulo } from './AgendaModulo'
import { claseCelda, componer, disponibleDe, type ModuloPanel } from './composicion'
import { CUADRICULA, EsqueletoPanel } from './EsqueletoPanel'
import { MedidoresModulo, medidoresDe } from './MedidoresModulo'
import type { IdExpandible } from './Modulo'
import { PendientesModulo } from './PendientesModulo'
import { ProduccionModulo } from './ProduccionModulo'
import { CobrarModulo, CotizacionesModulo } from './ResumenModulos'
import { fechaEncabezado, plural, saludo } from './util'
import { VentasModulo } from './VentasModulo'

/** Una sola entrada orquestada: los módulos llegan en cascada corta la primera vez. */
const cuadricula: Variants = {
  oculto: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0.03 } },
}
const celda: Variants = {
  oculto: { opacity: 0, y: 16, scale: 0.975 },
  visible: { opacity: 1, y: 0, scale: 1, transition: resorte.suave },
}

function resumenDelDia(r: DashboardResumen) {
  const hoy = r.entregas_proximas.filter((e) => e.fecha_entrega === r.hoy).length
  const partes: string[] = []
  if (hoy > 0) partes.push(`${plural(hoy, 'entrega', 'entregas')} hoy`)
  if (r.pedidos_atrasados > 0) partes.push(plural(r.pedidos_atrasados, 'pedido atrasado', 'pedidos atrasados'))
  if (!partes.length) return 'Sin entregas para hoy ni pedidos atrasados.'
  return `Tienes ${partes.join(' y ')}.`
}

function Encabezado({ r, nombre, actualizando, onActualizar }: { r: DashboardResumen; nombre: string; actualizando: boolean; onActualizar: () => void }) {
  return (
    <div className="mb-5 mt-1 flex items-end justify-between gap-4 px-1">
      <div className="min-w-0">
        <h2 className="text-2xl font-semibold tracking-tight text-fg md:text-[2rem] md:leading-[2.4rem]">
          {saludo()}, {nombre}
        </h2>
        <p className="mt-1 text-sm text-fg-muted md:text-base">
          <span className="font-medium text-fg">{fechaEncabezado(r.hoy)}.</span> {resumenDelDia(r)}
        </p>
      </div>
      <GlassIconButton
        etiqueta={actualizando ? 'Actualizando el panel' : 'Actualizar el panel'}
        icono={<RefreshCw className={cn(actualizando && 'animate-spin')} />}
        tamano="md"
        onClick={() => {
          if (!actualizando) onActualizar()
        }}
        aria-busy={actualizando || undefined}
        className="shrink-0"
      />
    </div>
  )
}

export default function DashboardPage() {
  const { sesion, puede } = useSesion()
  const reducir = useReducedMotion()
  const consulta = useQuery({ queryKey: claves.dashboard, queryFn: () => api.dashboard.resumen() })
  const [expandido, setExpandido] = useState<IdExpandible | null>(null)
  const [devolverFoco, setDevolverFoco] = useState<IdExpandible | null>(null)
  const [ampliados, setAmpliados] = useState<ReadonlySet<IdExpandible>>(() => new Set())

  const abrir = useCallback((id: IdExpandible) => {
    setExpandido(id)
    setAmpliados((s) => new Set(s).add(id))
  }, [])
  const cerrar = useCallback(() => {
    setDevolverFoco(expandido)
    setExpandido(null)
  }, [expandido])
  const enfocado = useCallback(() => setDevolverFoco(null), [])

  const r = consulta.data

  if (!r) {
    if (consulta.isError) {
      const mensaje = consulta.error instanceof Error ? consulta.error.message : 'Ocurrió un error inesperado.'
      return (
        <GlassPanel className="mt-2">
          <EstadoVacio
            icono={<CloudOff />}
            titulo="No se pudo cargar el panel"
            descripcion={`${mensaje.replace(/\.?$/, '.')} Revisa tu conexión e inténtalo de nuevo.`}
            accion={
              <GlassButton variante="primario" icono={<RefreshCw />} cargando={consulta.isFetching} onClick={() => void consulta.refetch()}>
                Reintentar
              </GlassButton>
            }
          />
        </GlassPanel>
      )
    }
    return <EsqueletoPanel modulos={componer({ ventas: puede('ver_reportes'), cotizaciones: puede('ver_precios'), cobrar: puede('ver_reportes') })} />
  }

  const modulos = componer(disponibleDe(r)).filter((m) => m.id !== 'medidores' || medidoresDe(r).length > 0)
  const nombre = sesion?.perfil.nombre.split(' ')[0] ?? ''

  const comunes = (id: IdExpandible) => ({
    r,
    abierto: expandido === id,
    onAbrir: () => abrir(id),
    onCerrar: cerrar,
    enfocar: devolverFoco === id,
    onEnfocado: enfocado,
    remontado: ampliados.has(id),
  })

  const contenido = (m: ModuloPanel) => {
    switch (m.id) {
      case 'ventas':
        return <VentasModulo {...comunes('ventas')} contar={!ampliados.has('ventas')} />
      case 'produccion':
        return <ProduccionModulo {...comunes('produccion')} variante={m.tamano === '2x2' ? 'bloque' : 'fila'} />
      case 'medidores':
        return <MedidoresModulo r={r} />
      case 'cotizaciones':
        return <CotizacionesModulo r={r} variante={m.tamano === '1x1' ? 'tile' : 'fila'} />
      case 'cobrar':
        return <CobrarModulo r={r} />
      case 'accesos':
        return <AccesosModulo tamano={m.tamano} />
      case 'agenda':
        return <AgendaModulo r={r} />
      case 'pendientes':
        return <PendientesModulo r={r} tamano={m.tamano} />
    }
  }

  return (
    <div className="pb-4">
      <Encabezado r={r} nombre={nombre} actualizando={consulta.isFetching} onActualizar={() => void consulta.refetch()} />
      <motion.div className={CUADRICULA} variants={cuadricula} initial={reducir ? false : 'oculto'} animate="visible">
        {modulos.map((m) => (
          <motion.div key={m.id} variants={celda} className={cn(claseCelda(m), 'min-w-0')}>
            {contenido(m)}
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
