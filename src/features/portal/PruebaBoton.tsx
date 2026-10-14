import { useSearchParams } from 'react-router-dom'
import { GlassPanel, LightField } from '@/components/glass'
import { AvisoDemo } from '@/components/shell/AvisoDemo'
import { BotonEnlacePortal } from './BotonEnlacePortal'

/** Solo en desarrollo: /portal/prueba-boton-enlace?tipo=cotizacion&id=…&folio=… para probar el botón aislado. */
export default function PruebaBoton() {
  const [p] = useSearchParams()
  const tipo = p.get('tipo') === 'pedido' ? 'pedido' : 'cotizacion'
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <LightField />
      <AvisoDemo />
      <GlassPanel className="rounded-module p-6">
        <BotonEnlacePortal tipo={tipo} id={p.get('id') ?? 'demo-cot-1'} folio={p.get('folio') ?? 'COT-0001'} clienteWhatsapp="3312345678" />
      </GlassPanel>
    </div>
  )
}
