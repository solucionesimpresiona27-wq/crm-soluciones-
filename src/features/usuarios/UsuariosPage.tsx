import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useSesion } from '@/app/sesion'
import { SegmentedControl } from '@/components/glass'
import { useSeccionesVisibles } from '@/components/shell/usarModulos'
import BitacoraVista from './BitacoraVista'
import EquipoVista from './EquipoVista'
import { SinAccesoAdmin } from './piezas'

/**
 * Usuarios (/usuarios/*): equipo, roles, permisos personalizados y bitácora. Solo administración
 * (la ruta ya está protegida; la seguridad real es la RLS y la función admin-usuarios).
 */
export default function UsuariosPage() {
  const { sesion } = useSesion()
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const secciones = useSeccionesVisibles('/usuarios')
  if (sesion?.perfil.rol !== 'admin') return <SinAccesoAdmin />
  const actual = pathname.startsWith('/usuarios/bitacora') ? '/usuarios/bitacora' : '/usuarios'

  return (
    <div className="flex flex-col gap-4 pt-1">
      <SegmentedControl
        etiqueta="Secciones de usuarios"
        segmentos={secciones.map((s) => ({ valor: s.ruta, etiqueta: s.titulo }))}
        valor={actual}
        onCambio={(r) => navegar(r)}
        className="w-full sm:w-auto sm:self-start"
      />
      <Routes>
        <Route path="bitacora" element={<BitacoraVista />} />
        <Route path="*" element={<EquipoVista />} />
      </Routes>
    </div>
  )
}
