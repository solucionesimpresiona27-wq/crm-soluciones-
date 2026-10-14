import { Outlet, useLocation } from 'react-router-dom'
import { useSesion } from '@/app/sesion'
import { puedeAbrir } from '@/components/shell/usarModulos'
import SinAcceso from './SinAcceso'

/**
 * Guarda de las rutas de módulos: aplica las mismas reglas que el menú (permisos del módulo y
 * de la sección, ver `MODULOS` en src/app/navegacion.ts). Cada página puede pedir permisos más
 * finos con `useSesion().puede(...)`; la seguridad real la aplica la base de datos.
 */
export default function GuardaModulo() {
  const { pathname } = useLocation()
  const { sesion } = useSesion()
  return puedeAbrir(pathname, sesion) ? <Outlet /> : <SinAcceso />
}
