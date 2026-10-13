import { lazy } from 'react'
import { createBrowserRouter, createHashRouter, createMemoryRouter, type RouteObject } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import LoginPage from '@/features/auth/LoginPage'
import { DEMO } from '@/lib/supabase'
import { MODULOS } from './navegacion'

const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const CotizacionesPage = lazy(() => import('@/features/cotizaciones/CotizacionesPage'))
const CotizacionEditorPage = lazy(() => import('@/features/cotizaciones/CotizacionEditorPage'))
const CotizacionDetallePage = lazy(() => import('@/features/cotizaciones/CotizacionDetallePage'))
const SistemaDisenoPage = lazy(() => import('@/features/sistema/SistemaDisenoPage'))
const ModuloPendiente = lazy(() => import('@/features/modulos/ModuloPendiente'))
const NoEncontrado = lazy(() => import('@/features/modulos/NoEncontrado'))
const NuevaContrasenaPage = lazy(() => import('@/features/auth/NuevaContrasenaPage'))

const rutas: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/nueva-contrasena', element: <NuevaContrasenaPage /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'cotizaciones', element: <CotizacionesPage /> },
      { path: 'cotizaciones/nueva', element: <CotizacionEditorPage /> },
      { path: 'cotizaciones/:id', element: <CotizacionDetallePage /> },
      { path: 'cotizaciones/:id/editar', element: <CotizacionEditorPage /> },
      { path: 'sistema-diseno', element: <SistemaDisenoPage /> },
      ...MODULOS.filter((m) => m.pendiente).map((m) => ({ path: `${m.ruta.slice(1)}/*`, element: <ModuloPendiente /> })),
      { path: '*', element: <NoEncontrado /> },
    ],
  },
]

/**
 * App real: rutas normales. Vista previa: rutas con # para cualquier alojamiento estático,
 * o en memoria (VITE_RUTAS=memoria) cuando se publica dentro de un visor que no permite cambiar la URL.
 */
export const router = !DEMO
  ? createBrowserRouter(rutas)
  : import.meta.env.VITE_RUTAS === 'memoria'
    ? createMemoryRouter(rutas, { initialEntries: ['/login'] })
    : createHashRouter(rutas)
