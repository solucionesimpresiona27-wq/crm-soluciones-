import { Link2 } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { EstadoVacio, GlassPanel, LightField } from '@/components/glass'
import { AvisoDemo } from '@/components/shell/AvisoDemo'
import { Marca } from '@/components/shell/Marca'

/**
 * Portal del cliente (/portal/:token): ruta PÚBLICA, fuera del menú y sin sesión.
 * PENDIENTE: el agente del módulo portal reemplaza este archivo.
 * Datos: api.portal.obtener(token), aprobarCotizacion, responderDiseno y archivos
 * (src/data/modulos/portal/contrato.ts). En la app real esas llamadas van sin la sesión del equipo.
 * En la vista previa, los enlaces de ejemplo son /#/portal/vista-previa-...
 */
export default function PortalPage() {
  const { token } = useParams()
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <LightField />
      <AvisoDemo />
      <GlassPanel className="w-full max-w-xl p-2">
        <div className="flex justify-center pt-6">
          <Marca />
        </div>
        <EstadoVacio
          icono={<Link2 />}
          titulo="Portal del cliente: siguiente fase"
          descripcion={
            token
              ? 'Aquí tu cliente verá su cotización o pedido y aprobará el presupuesto y los diseños sin necesidad de una cuenta.'
              : 'Este enlace no es válido. Pide uno nuevo a tu asesor.'
          }
        />
      </GlassPanel>
    </div>
  )
}
