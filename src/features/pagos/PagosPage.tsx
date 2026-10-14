import * as Tooltip from '@radix-ui/react-tooltip'
import { HandCoins } from 'lucide-react'
import { Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useSesion } from '@/app/sesion'
import { GlassButton, SegmentedControl } from '@/components/glass'
import { useSeccionesVisibles } from '@/components/shell/usarModulos'
import CobrosVista from './cobros/CobrosVista'
import CorteCajaVista from './caja/CorteCajaVista'
import ComisionesVista from './comisiones/ComisionesVista'
import PorCobrarVista from './porCobrar/PorCobrarVista'
import { SinAccesoPagos } from './piezas'
import { RegistrarPagoModal } from './RegistrarPagoModal'

/**
 * Pagos (/pagos/*): cobros, por cobrar, corte de caja y comisiones.
 * Abre el diálogo de cobro con ?pedido=<id> (desde un pedido) o ?registrar=1 (acción rápida).
 */
export default function PagosPage() {
  const { puede } = useSesion()
  if (!puede('ver_precios'))
    return <SinAccesoPagos titulo="Los pagos son para ventas y administración" descripcion="Tu rol no incluye montos ni cobros. Si necesitas saber si un pedido está pagado, pregunta a ventas." />
  return <Pagos />
}

function Pagos() {
  const { puede } = useSesion()
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const secciones = useSeccionesVisibles('/pagos')
  const [params, setParams] = useSearchParams()
  const pedido = params.get('pedido') ?? undefined
  const abierto = Boolean(pedido) || params.get('registrar') === '1'
  const registrar = puede('registrar_pagos')

  const actual = [...secciones].sort((a, b) => b.ruta.length - a.ruta.length).find((s) => pathname === s.ruta || pathname.startsWith(`${s.ruta}/`))?.ruta ?? '/pagos'

  const abrir = (v: boolean) =>
    setParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.delete('pedido')
        if (v) n.set('registrar', '1')
        else n.delete('registrar')
        return n
      },
      { replace: true },
    )

  return (
    <Tooltip.Provider delayDuration={350}>
      <div className="flex flex-col gap-4 pt-1">
        <div className="no-print flex flex-wrap items-center gap-3">
          <SegmentedControl
            etiqueta="Secciones de pagos"
            segmentos={secciones.map((s) => ({ valor: s.ruta, etiqueta: s.titulo }))}
            valor={actual}
            onCambio={(r) => navegar(r)}
            className="w-full sm:w-auto"
          />
          {registrar ? (
            <GlassButton variante="primario" icono={<HandCoins />} onClick={() => abrir(true)} className="ml-auto max-sm:w-full">
              Registrar pago
            </GlassButton>
          ) : null}
        </div>

        <Routes>
          <Route index element={<CobrosVista />} />
          <Route path="por-cobrar" element={<PorCobrarVista />} />
          <Route path="caja" element={<CorteCajaVista />} />
          <Route path="comisiones" element={<ComisionesVista />} />
          <Route path="*" element={<CobrosVista />} />
        </Routes>
      </div>

      {registrar ? <RegistrarPagoModal pedidoId={pedido} abierto={abierto} onCambio={abrir} /> : null}
    </Tooltip.Provider>
  )
}
