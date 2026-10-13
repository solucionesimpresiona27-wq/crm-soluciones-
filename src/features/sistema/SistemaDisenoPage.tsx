import { Activity, AppWindow, Layers, Loader, Lock, Palette, RectangleHorizontal, SlidersHorizontal, TextCursorInput, ToggleRight } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EstadoVacio, GlassButton, GlassPanel, Pildora } from '@/components/glass'
import { useModulosVisibles } from '@/components/shell/usarModulos'
import { MuestrarioCampos } from './Campos'
import { MuestrarioCapsulas } from './Capsulas'
import { MuestrarioCarga } from './Carga'
import { Botonera, MuestrarioCirculares } from './CentroControl'
import { Escenario } from './Escenario'
import { MuestrarioMovimiento } from './Movimiento'
import { Seccion } from './piezas'
import { MuestrarioSelector } from './SelectorEstados'
import { MuestrarioSuperficies } from './Superficies'
import { MuestrarioTokens } from './Tokens'
import { MuestrarioVentanas } from './Ventanas'

/**
 * Vitrina del Impresiona Glass Design System: el cliente valida aquí el material,
 * los controles y el movimiento, sobre distintos fondos, antes de aprobar el diseño.
 */
export default function SistemaDisenoPage() {
  const [lente] = useState(() => document.documentElement.classList.contains('lens-ready'))
  const navegar = useNavigate()
  // Misma regla que el menú: en la app real, solo administración
  const permitida = useModulosVisibles().some((m) => m.ruta === '/sistema-diseno')

  if (!permitida) {
    return (
      <GlassPanel className="mx-auto mt-2 max-w-xl">
        <EstadoVacio
          icono={<Lock />}
          titulo="La vitrina del diseño es solo para administración"
          descripcion="Pide a un administrador que la revise contigo, o vuelve al inicio."
          accion={
            <GlassButton variante="primario" onClick={() => navegar('/')}>
              Ir al inicio
            </GlassButton>
          }
        />
      </GlassPanel>
    )
  }

  return (
    <div className="pb-4">
      <header className="mb-5 mt-1 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-1">
        <div className="min-w-0 max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight text-fg md:text-[2rem] md:leading-[2.4rem]">Impresiona Glass</h2>
          <p className="mt-1 text-sm text-fg-muted md:text-base">
            El material, los controles y el movimiento del CRM. Cambia el fondo para ver cómo responde el cristal antes de aprobarlo.
          </p>
        </div>
        <Pildora tono={lente ? 'luz' : 'neutro'} className="mb-1">
          {lente ? 'Refracción activa en este navegador' : 'Este navegador muestra el cristal sin refracción'}
        </Pildora>
      </header>

      <Escenario>
        <div className="flex flex-col gap-10 md:gap-12">
          <Seccion
            id="centro-control"
            icono={<SlidersHorizontal />}
            titulo="Centro de Control"
            descripcion="Botones circulares de cristal grueso: se comprimen al tocarlos y cambian de ícono al encenderse."
          >
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-5">
              <Botonera />
              <MuestrarioCirculares />
            </div>
          </Seccion>

          <div className="grid items-start gap-10 md:gap-12 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:gap-5">
            <Seccion
              id="capsulas"
              icono={<RectangleHorizontal />}
              titulo="Cápsulas"
              descripcion="Azul para la acción principal; amarillo solo para lo que debe destacar."
              className="h-full"
            >
              <MuestrarioCapsulas />
            </Seccion>
            <Seccion
              id="selector"
              icono={<ToggleRight />}
              titulo="Selector y estados"
              descripcion="Opciones que se deslizan y estados de un vistazo."
              className="h-full"
            >
              <MuestrarioSelector />
            </Seccion>
          </div>

          <Seccion
            id="superficies"
            icono={<Layers />}
            titulo="Superficies"
            descripcion="Un mismo material en seis versiones. Elige según lo que va encima."
          >
            <MuestrarioSuperficies />
          </Seccion>

          <div className="grid items-start gap-10 md:gap-12 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:gap-5">
            <Seccion
              id="campos"
              icono={<TextCursorInput />}
              titulo="Campos"
              descripcion="Siempre sobre cristal fuerte. La ayuda orienta; el error dice qué pasó y cómo corregirlo."
            >
              <MuestrarioCampos />
            </Seccion>
            <div className="flex flex-col gap-10 md:gap-12 xl:gap-8">
              <Seccion
                id="ventanas"
                icono={<AppWindow />}
                titulo="Ventanas"
                descripcion="Al centro o de lado; en celular suben como hoja."
              >
                <MuestrarioVentanas />
              </Seccion>
              <Seccion id="carga" icono={<Loader />} titulo="Carga" descripcion="Mientras llegan los datos, su forma ya está en su lugar.">
                <MuestrarioCarga />
              </Seccion>
            </div>
          </div>

          <Seccion
            id="movimiento"
            icono={<Activity />}
            titulo="Movimiento"
            descripcion="Cinco resortes con poco rebote: rápidos en lo frecuente, más amplios en lo importante."
          >
            <MuestrarioMovimiento />
          </Seccion>

          <Seccion id="tokens" icono={<Palette />} titulo="Tokens" descripcion="Colores, radios, sombras y letra que comparten todas las pantallas.">
            <MuestrarioTokens />
          </Seccion>
        </div>
      </Escenario>
    </div>
  )
}
