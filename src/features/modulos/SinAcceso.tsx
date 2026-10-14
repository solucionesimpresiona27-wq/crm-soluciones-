import { Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { EstadoVacio, GlassButton, GlassPanel } from '@/components/glass'

/** Pantalla para rutas que el rol no puede abrir (la seguridad real está en la base de datos). */
export default function SinAcceso({ titulo = 'Esta sección no está disponible para tu rol' }: { titulo?: string }) {
  const navegar = useNavigate()
  return (
    <GlassPanel className="mx-auto mt-2 max-w-xl">
      <EstadoVacio
        icono={<Lock />}
        titulo={titulo}
        descripcion="Si la necesitas para tu trabajo, pide al administrador que te dé el permiso."
        accion={
          <GlassButton variante="cristal" onClick={() => navegar('/')}>
            Ir al inicio
          </GlassButton>
        }
      />
    </GlassPanel>
  )
}
