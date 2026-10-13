import { useState } from 'react'
import { GlassPanel, Pildora, SegmentedControl, type TonoPildora } from '@/components/glass'
import { useEsMovil } from '@/hooks/useMediaQuery'
import { ESTADO_COTIZACION, ESTADO_PEDIDO } from '@/lib/estados'
import { Subtitulo } from './piezas'

const TONOS: Array<{ tono: TonoPildora; nombre: string; significado: string }> = [
  { tono: 'neutro', nombre: 'Neutro', significado: 'Sin nada pendiente' },
  { tono: 'acento', nombre: 'Azul', significado: 'En curso' },
  { tono: 'luz', nombre: 'Luz', significado: 'Espera algo de ti' },
  { tono: 'exito', nombre: 'Éxito', significado: 'Listo o aceptado' },
  { tono: 'aviso', nombre: 'Aviso', significado: 'Por vencer o pausado' },
  { tono: 'peligro', nombre: 'Peligro', significado: 'Rechazado o cancelado' },
]

type Filtro = 'todas' | 'enviadas' | 'aceptadas'
type Periodo = 'dia' | 'semana' | 'mes'

/** Selector segmentado y píldoras de estado. */
export function MuestrarioSelector() {
  const [filtro, setFiltro] = useState<Filtro>('enviadas')
  const [periodo, setPeriodo] = useState<Periodo>('semana')
  const movil = useEsMovil()

  return (
    <GlassPanel className="flex h-full flex-col gap-5 p-4 sm:p-5">
      <div className="flex flex-col gap-3">
        <Subtitulo detalle="Flechas del teclado para moverte">Selector segmentado</Subtitulo>
        <SegmentedControl<Filtro>
          etiqueta="Filtrar cotizaciones de ejemplo"
          tamano={movil ? 'sm' : 'md'}
          valor={filtro}
          onCambio={setFiltro}
          segmentos={[
            { valor: 'todas', etiqueta: 'Todas', conteo: 24 },
            { valor: 'enviadas', etiqueta: 'Enviadas', conteo: 9 },
            { valor: 'aceptadas', etiqueta: 'Aceptadas', conteo: 10 },
          ]}
          className="self-start"
        />
        <SegmentedControl<Periodo>
          etiqueta="Periodo de ejemplo"
          tamano="sm"
          valor={periodo}
          onCambio={setPeriodo}
          segmentos={[
            { valor: 'dia', etiqueta: 'Día' },
            { valor: 'semana', etiqueta: 'Semana' },
            { valor: 'mes', etiqueta: 'Mes' },
          ]}
          className="self-start"
        />
      </div>

      <div className="hairline" />

      <div>
        <Subtitulo detalle="El punto repite el color para no depender solo del texto">Tonos</Subtitulo>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
          {TONOS.map((t) => (
            <div key={t.tono} className="flex min-w-0 flex-col items-start gap-1">
              <dt>
                <Pildora tono={t.tono}>{t.nombre}</Pildora>
              </dt>
              <dd className="pl-1 text-xs text-fg-muted">{t.significado}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="hairline" />

      <div className="flex flex-col gap-3">
        <Subtitulo>Cotizaciones</Subtitulo>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ESTADO_COTIZACION).map(([clave, e]) => (
            <Pildora key={clave} tono={e.tono}>
              {e.etiqueta}
            </Pildora>
          ))}
        </div>
        <Subtitulo className="mt-1">Pedidos</Subtitulo>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ESTADO_PEDIDO).map(([clave, e]) => (
            <Pildora key={clave} tono={e.tono}>
              {e.etiqueta}
            </Pildora>
          ))}
        </div>
      </div>
    </GlassPanel>
  )
}
