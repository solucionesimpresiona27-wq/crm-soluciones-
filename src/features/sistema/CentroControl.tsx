import {
  Bell,
  BellOff,
  BellRing,
  Cloud,
  CloudOff,
  Contrast,
  Droplets,
  Inbox,
  Lightbulb,
  LightbulbOff,
  Lock,
  MessageCircle,
  MessageCircleOff,
  Moon,
  Plus,
  RotateCcw,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTema } from '@/app/tema'
import { GlassButton, GlassIconButton, GlassSurface, GlassToggle } from '@/components/glass'
import { useEsMovil } from '@/hooks/useMediaQuery'
import { useEscenario } from './contexto'
import { MedidorArrastrable } from './MedidorArrastrable'
import { Muestra, Subtitulo } from './piezas'

/** Rango del desenfoque que controla el medidor (el valor del sistema, 22 px, queda al centro). */
const DESENFOQUE_MAX = 44

/**
 * Mini Centro de Control: módulo de 4 botones, dos medidores que se arrastran,
 * la cápsula de Concentración y dos botones sueltos. Los medidores ajustan
 * el cristal de toda la vitrina para poder compararlo en vivo.
 */
export function Botonera() {
  const { ref: escenario, foco, setFoco } = useEscenario()
  const { efectivo, alternar } = useTema()
  const movil = useEsMovil()
  const oscuro = efectivo === 'oscuro'
  const [avisos, setAvisos] = useState(true)
  const [whatsapp, setWhatsapp] = useState(true)
  const [sonido, setSonido] = useState(false)
  const [nube, setNube] = useState(true)
  const [concentracion, setConcentracion] = useState(false)
  const [desenfoque, setDesenfoque] = useState(0.5)
  const [opacidad, setOpacidad] = useState(0.5)

  const px = Math.round(desenfoque * DESENFOQUE_MAX)
  // Al centro, la opacidad del sistema (40% en claro, 36% en oscuro)
  const alfa = Math.min(0.92, (oscuro ? 0.36 : 0.4) * opacidad * 2)
  const predeterminado = desenfoque === 0.5 && opacidad === 0.5

  // Las variables se escriben en el escenario: solo cambia el cristal de la vitrina
  useEffect(() => {
    const el = escenario.current
    if (!el) return
    if (predeterminado) {
      el.style.removeProperty('--glass-blur')
      el.style.removeProperty('--glass-bg')
    } else {
      el.style.setProperty('--glass-blur', `${px}px`)
      el.style.setProperty('--glass-bg', oscuro ? `rgba(30, 46, 72, ${alfa})` : `rgba(255, 255, 255, ${alfa})`)
    }
    return () => {
      el.style.removeProperty('--glass-blur')
      el.style.removeProperty('--glass-bg')
    }
  }, [escenario, predeterminado, px, alfa, oscuro])

  const restablecer = () => {
    setDesenfoque(0.5)
    setOpacidad(0.5)
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3 lg:mx-0 lg:max-w-none">
      <div className="grid grid-cols-4 gap-3 sm:gap-3.5">
        {/* Módulo de conexiones: 4 botones en una tarjeta, como en el Centro de Control */}
        <GlassSurface
          role="group"
          aria-label="Conexiones"
          className="col-span-2 row-span-2 grid aspect-square grid-cols-2 place-content-center place-items-center gap-x-1 gap-y-2 rounded-module p-2"
        >
          <GlassIconButton
            etiqueta="Avisos"
            icono={<BellOff />}
            iconoActivo={<BellRing />}
            activo={avisos}
            tono="luz"
            mostrarEtiqueta={!movil}
            onClick={() => setAvisos(!avisos)}
          />
          <GlassIconButton
            etiqueta="WhatsApp"
            icono={<MessageCircleOff />}
            iconoActivo={<MessageCircle />}
            activo={whatsapp}
            mostrarEtiqueta={!movil}
            onClick={() => setWhatsapp(!whatsapp)}
          />
          <GlassIconButton
            etiqueta="Sonido"
            icono={<VolumeX />}
            iconoActivo={<Volume2 />}
            activo={sonido}
            mostrarEtiqueta={!movil}
            onClick={() => setSonido(!sonido)}
          />
          <GlassIconButton
            etiqueta="Sincronizar"
            icono={<CloudOff />}
            iconoActivo={<Cloud />}
            activo={nube}
            mostrarEtiqueta={!movil}
            onClick={() => setNube(!nube)}
          />
        </GlassSurface>

        <div className="row-span-2">
          <MedidorArrastrable
            valor={desenfoque}
            onCambio={setDesenfoque}
            etiqueta="Desenfoque del cristal"
            textoValor={`${px} px`}
            icono={<Droplets />}
            tono="claro"
          />
        </div>
        <div className="row-span-2">
          <MedidorArrastrable
            valor={opacidad}
            onCambio={setOpacidad}
            etiqueta="Opacidad del cristal"
            textoValor={`${Math.round(alfa * 100)}%`}
            icono={<Contrast />}
            tono="luz"
          />
        </div>

        <GlassToggle
          icono={<Moon />}
          titulo="Concentración"
          subtitulo={concentracion ? 'Sin avisos hasta las 18:00' : 'Desactivada'}
          activo={concentracion}
          onCambio={setConcentracion}
          className="col-span-3 h-full w-full sm:col-span-2"
        />
        {/* En celular la cápsula necesita más ancho; el modo claro ya está en la barra superior */}
        <div className="relative hidden aspect-square sm:block">
          <GlassIconButton
            etiqueta="Modo claro"
            icono={<Moon />}
            iconoActivo={<Sun />}
            activo={!oscuro}
            tono="luz"
            tamano="xl"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              alternar({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
            }}
            className="absolute inset-0 size-full"
          />
        </div>
        <div className="relative aspect-square">
          <GlassIconButton
            etiqueta="Foco"
            icono={<LightbulbOff />}
            iconoActivo={<Lightbulb />}
            activo={foco}
            tono="luz"
            tamano="xl"
            onClick={() => setFoco(!foco)}
            className="absolute inset-0 size-full"
          />
        </div>
      </div>

      {/* Lectura de los medidores */}
      <GlassSurface variante="fuerte" className="flex items-center gap-3 rounded-module py-2.5 pl-4 pr-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg">
            Desenfoque <span className="num">{px} px</span>, opacidad <span className="num">{Math.round(alfa * 100)}%</span>
          </p>
          <p className="text-xs text-fg-muted">Arrastra los medidores para probar el cristal de esta vitrina.</p>
        </div>
        <GlassButton tamano="sm" icono={<RotateCcw />} disabled={predeterminado} onClick={restablecer} className="shrink-0">
          Restablecer
        </GlassButton>
      </GlassSurface>
    </div>
  )
}

const TAMANOS = [
  { t: 'sm', px: 40 },
  { t: 'md', px: 52 },
  { t: 'lg', px: 64 },
  { t: 'xl', px: 76 },
] as const

/** Muestrario de botones circulares: tamaños, estados e insignias. */
export function MuestrarioCirculares() {
  const [encendidos, setEncendidos] = useState<Record<string, boolean>>({ xl: true })
  const [timbre, setTimbre] = useState(false)
  const [volumen, setVolumen] = useState(true)

  return (
    <GlassSurface className="flex h-full flex-col gap-5 rounded-module p-4 sm:p-5">
      <div>
        <Subtitulo detalle="En táctil, sm crece a 44 px">Tamaños</Subtitulo>
        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-4 sm:gap-x-8">
          {TAMANOS.map(({ t, px }) => (
            <Muestra key={t} titulo={t} detalle={`${px} px`}>
              <GlassIconButton
                etiqueta={`Muestra de tamaño ${t}`}
                icono={<LightbulbOff />}
                iconoActivo={<Lightbulb />}
                activo={Boolean(encendidos[t])}
                tono="luz"
                tamano={t}
                onClick={() => setEncendidos((e) => ({ ...e, [t]: !e[t] }))}
              />
            </Muestra>
          ))}
        </div>
      </div>

      <div className="hairline" />

      <div>
        <Subtitulo detalle="Tócalos: el ícono cambia al encender">Estados</Subtitulo>
        <div className="mt-4 grid grid-cols-4 gap-x-3 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-8">
          <Muestra titulo="Luz" detalle={timbre ? 'Encendido' : 'Apagado'}>
            <GlassIconButton
              etiqueta="Recordatorios"
              icono={<BellOff />}
              iconoActivo={<BellRing />}
              activo={timbre}
              tono="luz"
              onClick={() => setTimbre(!timbre)}
            />
          </Muestra>
          <Muestra titulo="Azul" detalle={volumen ? 'Encendido' : 'Apagado'}>
            <GlassIconButton
              etiqueta="Sonido de avisos"
              icono={<VolumeX />}
              iconoActivo={<Volume2 />}
              activo={volumen}
              onClick={() => setVolumen(!volumen)}
            />
          </Muestra>
          <Muestra titulo="Destacado" detalle="Acción">
            <GlassIconButton etiqueta="Nueva cotización" icono={<Plus />} destacado tono="luz" />
          </Muestra>
          <Muestra titulo="Inactivo" detalle="Sin permiso">
            <GlassIconButton etiqueta="Aprobar diseño" icono={<Lock />} disabled />
          </Muestra>
        </div>
      </div>

      <div className="hairline" />

      <div>
        <Subtitulo detalle="De 100 en adelante se lee 99+">Insignias</Subtitulo>
        <div className="mt-4 grid grid-cols-4 gap-x-3 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-8">
          <Muestra titulo="Avisos" detalle="3">
            <GlassIconButton etiqueta="Avisos, 3 sin leer" icono={<Bell />} insignia={3} />
          </Muestra>
          <Muestra titulo="Mensajes" detalle="12">
            <GlassIconButton etiqueta="Mensajes, 12 sin leer" icono={<MessageCircle />} insignia={12} />
          </Muestra>
          <Muestra titulo="Bandeja" detalle="128">
            <GlassIconButton etiqueta="Bandeja, 128 pendientes" icono={<Inbox />} insignia={128} />
          </Muestra>
        </div>
      </div>
    </GlassSurface>
  )
}
