import { Lock, Percent, RotateCcw, ScrollText, Zap } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { Campo, GlassButton, GlassInput, GlassPanel, GlassTextarea, GlassToggle, SegmentedControl } from '@/components/glass'
import type { Totales } from '@/lib/calculadora'
import { cantidad, dinero, fechaLarga } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { RECARGO_CONCEPTO, anticipoDe, n, vencimientoDe, type Errores, type EstadoEditor } from './modelo'
import { CampoNumero, EncabezadoSeccion, Subtitulo } from './piezas'

/** Contenido que aparece debajo de un interruptor cuando se enciende. */
function Despliegue({ visible, children }: { visible: boolean; children: ReactNode }) {
  const reducir = useReducedMotion()
  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.div
          initial={reducir ? { opacity: 0 } : { height: 0, opacity: 0 }}
          animate={reducir ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
          exit={reducir ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={resorte.expansion}
          className="overflow-hidden"
        >
          <div className="px-0.5 pb-0.5 pt-3">{children}</div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export function SeccionCondiciones({
  estado,
  totales,
  errores,
  mostrarErrores,
  condicionesBase,
  actualizar,
}: {
  estado: EstadoEditor
  totales: Totales
  errores: Errores
  mostrarErrores: boolean
  /** Condiciones de la configuración, para restaurarlas */
  condicionesBase: string
  actualizar: <K extends keyof EstadoEditor>(campo: K, valor: EstadoEditor[K]) => void
}) {
  const [urgente, setUrgente] = useState(() => n(estado.recargo_pct) > 0)
  const vence = vencimientoDe(estado)
  const anticipo = anticipoDe(estado, totales)
  const err = (k: keyof Omit<Errores, 'filas'>) => (mostrarErrores ? errores[k] : undefined)

  return (
    <GlassPanel className="p-4 sm:p-6" aria-labelledby="titulo-condiciones">
      <EncabezadoSeccion
        id="titulo-condiciones"
        icono={<ScrollText />}
        titulo="Condiciones"
        descripcion="Vigencia, pagos, impuestos y lo que el cliente debe saber."
      />

      <div className="mt-5 grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        <Campo
          etiqueta="Vigencia"
          error={err('vigencia')}
          ayuda={vence ? <>Vence el {fechaLarga(vence)}</> : 'Captura los días de vigencia'}
        >
          {(id, a) => (
            <CampoNumero
              id={id}
              {...a}
              valor={estado.vigencia_dias}
              onValor={(v) => actualizar('vigencia_dias', v === null ? null : Math.round(v))}
              max={365}
              sufijo="días"
              placeholder="15"
            />
          )}
        </Campo>
        <Campo
          etiqueta="Anticipo para iniciar"
          error={err('anticipo')}
          ayuda={<span className="num">{n(estado.anticipo_pct) > 0 ? `${dinero(anticipo)} del total` : 'Sin anticipo'}</span>}
        >
          {(id, a) => <CampoNumero id={id} {...a} valor={estado.anticipo_pct} onValor={(v) => actualizar('anticipo_pct', v)} max={100} sufijo="%" placeholder="50" />}
        </Campo>
        <Campo etiqueta="Tiempo de entrega" opcional className="sm:col-span-2 lg:col-span-1">
          {(id, a) => (
            <GlassInput
              id={id}
              {...a}
              value={estado.tiempo_entrega}
              onChange={(e) => actualizar('tiempo_entrega', e.target.value)}
              placeholder="5 a 7 días hábiles"
              maxLength={200}
              autoComplete="off"
            />
          )}
        </Campo>
      </div>

      {/* Descuento, IVA y urgencia: interruptores tipo Centro de Control */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="grid content-start gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Subtitulo>Descuento general</Subtitulo>
            <SegmentedControl
              etiqueta="Tipo de descuento"
              tamano="sm"
              valor={estado.descuento_tipo}
              onCambio={(v) => actualizar('descuento_tipo', v)}
              segmentos={[
                { valor: 'pct', etiqueta: 'Porcentaje' },
                { valor: 'monto', etiqueta: 'Monto' },
              ]}
            />
          </div>
          <Campo
            error={err('descuento')}
            ayuda={totales.descuento > 0 ? <span className="num">−{dinero(totales.descuento)} sobre el subtotal</span> : 'Sobre la suma de los conceptos'}
          >
            {(id, a) =>
              estado.descuento_tipo === 'pct' ? (
                <CampoNumero
                  key="pct"
                  id={id}
                  {...a}
                  aria-label="Descuento en porcentaje"
                  valor={estado.descuento_valor}
                  onValor={(v) => actualizar('descuento_valor', v)}
                  max={100}
                  sufijo="%"
                  placeholder="0"
                />
              ) : (
                <CampoNumero
                  key="monto"
                  id={id}
                  {...a}
                  aria-label="Descuento en pesos"
                  valor={estado.descuento_valor}
                  onValor={(v) => actualizar('descuento_valor', v)}
                  prefijo="$"
                  fijos={2}
                  placeholder="0.00"
                />
              )
            }
          </Campo>
        </div>

        <div className="grid content-start">
          <GlassToggle
            icono={<Percent />}
            titulo="IVA"
            subtitulo={estado.aplica_iva ? `${cantidad(n(estado.iva_pct))} % desglosado` : 'Precios sin IVA'}
            activo={estado.aplica_iva}
            onCambio={(v) => actualizar('aplica_iva', v)}
            className="w-full"
          />
          <Despliegue visible={estado.aplica_iva}>
            <Campo etiqueta="Tasa de IVA" error={err('iva')}>
              {(id, a) => <CampoNumero id={id} {...a} valor={estado.iva_pct} onValor={(v) => actualizar('iva_pct', v)} max={100} sufijo="%" placeholder="16" />}
            </Campo>
          </Despliegue>
        </div>

        <div className="grid content-start">
          <GlassToggle
            icono={<Zap />}
            titulo="Trabajo urgente"
            subtitulo={urgente ? (n(estado.recargo_pct) > 0 ? `Recargo de ${cantidad(n(estado.recargo_pct))} %` : 'Captura el recargo') : 'Sin recargo'}
            activo={urgente}
            onCambio={(v) => {
              setUrgente(v)
              if (!v) actualizar('recargo_pct', null)
            }}
            className="w-full"
          />
          <Despliegue visible={urgente}>
            <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3">
              <Campo etiqueta="Recargo" error={err('recargo')}>
                {(id, a) => <CampoNumero id={id} {...a} valor={estado.recargo_pct} onValor={(v) => actualizar('recargo_pct', v)} max={100} sufijo="%" placeholder="15" />}
              </Campo>
              <Campo etiqueta="Concepto en la cotización">
                {(id, a) => (
                  <GlassInput
                    id={id}
                    {...a}
                    value={estado.recargo_concepto}
                    onChange={(e) => actualizar('recargo_concepto', e.target.value)}
                    placeholder={RECARGO_CONCEPTO}
                    maxLength={80}
                    autoComplete="off"
                  />
                )}
              </Campo>
            </div>
          </Despliegue>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        <div className="grid gap-1.5">
          <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
            <label htmlFor="editor-condiciones" className="text-sm font-medium text-fg-muted">
              Condiciones comerciales
            </label>
            {condicionesBase && estado.condiciones.trim() !== condicionesBase.trim() ? (
              <GlassButton
                variante="fantasma"
                tamano="sm"
                icono={<RotateCcw />}
                onClick={() => actualizar('condiciones', condicionesBase)}
                className="h-9 px-3 text-xs pointer-coarse:h-11"
              >
                Usar las de la configuración
              </GlassButton>
            ) : null}
          </div>
          <GlassTextarea
            id="editor-condiciones"
            aria-describedby="editor-condiciones-ayuda"
            rows={6}
            className="max-h-[28rem] [field-sizing:content]"
            value={estado.condiciones}
            onChange={(e) => actualizar('condiciones', e.target.value)}
          />
          <p id="editor-condiciones-ayuda" className="text-xs text-fg-subtle">
            Una condición por renglón. En el PDF aparecen como lista, junto con la vigencia y el anticipo.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Campo etiqueta="Notas para el cliente" opcional ayuda="Aparecen en la cotización y en el PDF.">
            {(id, a) => <GlassTextarea id={id} {...a} rows={3} value={estado.notas} onChange={(e) => actualizar('notas', e.target.value)} />}
          </Campo>
          <Campo
            etiqueta={
              <span className="inline-flex items-center gap-1.5">
                <Lock className="size-3.5" aria-hidden />
                Notas internas
              </span>
            }
            opcional
            ayuda="Solo las ve tu equipo; no salen en el PDF."
          >
            {(id, a) => <GlassTextarea id={id} {...a} rows={3} value={estado.notas_internas} onChange={(e) => actualizar('notas_internas', e.target.value)} />}
          </Campo>
        </div>
      </div>
    </GlassPanel>
  )
}
