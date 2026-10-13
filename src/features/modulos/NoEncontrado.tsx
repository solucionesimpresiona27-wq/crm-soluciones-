import { Compass } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { EstadoVacio, GlassButton, GlassPanel } from '@/components/glass'

export default function NoEncontrado() {
  const navegar = useNavigate()
  return (
    <GlassPanel className="mx-auto mt-2 max-w-xl">
      <EstadoVacio
        icono={<Compass />}
        titulo="Esta página no existe"
        descripcion="Revisa la dirección o vuelve al inicio."
        accion={<GlassButton variante="primario" onClick={() => navegar('/')}>Ir al inicio</GlassButton>}
      />
    </GlassPanel>
  )
}
