import { AppWindow, Bell, HandCoins, PanelRight } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Campo, GlassButton, GlassInput, GlassModal, GlassSelect, GlassSurface, Pildora } from '@/components/glass'
import { dinero } from '@/lib/format'

const PARTIDAS = [
  { concepto: 'Rotulación de camioneta', detalle: 'Vinil impreso con laminado', importe: 3800 },
  { concepto: 'Lona front 13 oz', detalle: '3.00 × 1.50 m', importe: 832.5 },
  { concepto: 'Instalación', detalle: 'Zapopan, en sitio', importe: 650 },
]

/** Ventana centrada, panel lateral y aviso. En celular, la ventana sube como hoja. */
export function MuestrarioVentanas() {
  const [ventana, setVentana] = useState(false)
  const [lateral, setLateral] = useState(false)
  const subtotal = PARTIDAS.reduce((s, p) => s + p.importe, 0)

  return (
    <GlassSurface className="flex flex-col gap-4 rounded-module p-4 sm:p-5">
      <div className="flex flex-wrap gap-2.5">
        <GlassButton variante="primario" icono={<AppWindow />} onClick={() => setVentana(true)}>
          Registrar pago
        </GlassButton>
        <GlassButton icono={<PanelRight />} onClick={() => setLateral(true)}>
          Ver cotización
        </GlassButton>
        <GlassButton
          variante="fantasma"
          icono={<Bell />}
          onClick={() => toast('Aviso de ejemplo', { description: 'Las confirmaciones aparecen arriba, sin tapar el trabajo.' })}
        >
          Mostrar aviso
        </GlassButton>
      </div>

      <GlassModal
        abierto={ventana}
        onCambio={setVentana}
        titulo="Registrar pago"
        descripcion="PED-0033, Taller Mecánico Rueda"
        ancho="sm"
        pie={
          <>
            <GlassButton variante="fantasma" onClick={() => setVentana(false)}>
              Cancelar
            </GlassButton>
            <GlassButton
              variante="primario"
              icono={<HandCoins />}
              onClick={() => {
                setVentana(false)
                toast('Pago de ejemplo', { description: 'En la vitrina no se registra nada.' })
              }}
            >
              Registrar pago
            </GlassButton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between rounded-tile bg-[var(--control-bg)] px-4 py-3">
            <span className="text-sm text-fg-muted">Saldo pendiente</span>
            <span className="num text-lg font-semibold text-fg">{dinero(4872)}</span>
          </div>
          <Campo etiqueta="Monto">
            {(id, a) => <GlassInput id={id} {...a} inputMode="decimal" defaultValue="2,500.00" sufijo="MXN" className="num pr-14" />}
          </Campo>
          <Campo etiqueta="Método">
            {(id, a) => (
              <GlassSelect id={id} {...a} defaultValue="transferencia">
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
              </GlassSelect>
            )}
          </Campo>
          <Campo etiqueta="Referencia" opcional ayuda="Número de operación o folio del recibo.">
            {(id, a) => <GlassInput id={id} {...a} />}
          </Campo>
        </div>
      </GlassModal>

      <GlassModal
        abierto={lateral}
        onCambio={setLateral}
        lateral
        titulo="COT-0142"
        descripcion="Taller Mecánico Rueda"
        pie={
          <GlassButton variante="primario" onClick={() => setLateral(false)}>
            Listo
          </GlassButton>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Pildora tono="acento">Enviada</Pildora>
            <span className="text-sm text-fg-muted">Vence en 3 días</span>
          </div>
          <ul className="flex flex-col">
            {PARTIDAS.map((p) => (
              <li key={p.concepto} className="flex items-baseline justify-between gap-4 border-t border-[var(--divider)] py-3 first:border-t-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">{p.concepto}</p>
                  <p className="text-xs text-fg-muted">{p.detalle}</p>
                </div>
                <span className="num shrink-0 text-sm font-semibold text-fg">{dinero(p.importe)}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-1.5 rounded-tile bg-[var(--control-bg)] px-4 py-3 text-sm">
            <div className="flex justify-between text-fg-muted">
              <span>Subtotal</span>
              <span className="num">{dinero(subtotal)}</span>
            </div>
            <div className="flex justify-between text-fg-muted">
              <span>IVA 16%</span>
              <span className="num">{dinero(subtotal * 0.16)}</span>
            </div>
            <div className="flex justify-between text-md font-semibold text-fg">
              <span>Total</span>
              <span className="num">{dinero(subtotal * 1.16)}</span>
            </div>
          </div>
        </div>
      </GlassModal>
    </GlassSurface>
  )
}
