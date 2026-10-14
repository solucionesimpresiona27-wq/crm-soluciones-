import { lazy } from 'react'
import { createBrowserRouter, createHashRouter, createMemoryRouter, type RouteObject } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import LoginPage from '@/features/auth/LoginPage'
import { DEMO } from '@/lib/supabase'

const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const CotizacionesPage = lazy(() => import('@/features/cotizaciones/CotizacionesPage'))
const CotizacionEditorPage = lazy(() => import('@/features/cotizaciones/CotizacionEditorPage'))
const CotizacionDetallePage = lazy(() => import('@/features/cotizaciones/CotizacionDetallePage'))
const SistemaDisenoPage = lazy(() => import('@/features/sistema/SistemaDisenoPage'))
const GuardaModulo = lazy(() => import('@/features/modulos/GuardaModulo'))
const NoEncontrado = lazy(() => import('@/features/modulos/NoEncontrado'))
const NuevaContrasenaPage = lazy(() => import('@/features/auth/NuevaContrasenaPage'))

// Módulos: cada agente reemplaza SOLO sus páginas en src/features/<modulo>/ (no estas rutas).
const ClientesPage = lazy(() => import('@/features/clientes/ClientesPage'))
const ClienteDetallePage = lazy(() => import('@/features/clientes/ClienteDetallePage'))
const EmbudoPage = lazy(() => import('@/features/embudo/EmbudoPage'))
const PedidosPage = lazy(() => import('@/features/pedidos/PedidosPage'))
const PedidoNuevoPage = lazy(() => import('@/features/pedidos/PedidoNuevoPage'))
const PedidoDetallePage = lazy(() => import('@/features/pedidos/PedidoDetallePage'))
const ProduccionPage = lazy(() => import('@/features/produccion/ProduccionPage'))
const OrdenTrabajoPage = lazy(() => import('@/features/produccion/OrdenTrabajoPage'))
const PagosPage = lazy(() => import('@/features/pagos/PagosPage'))
const InventarioPage = lazy(() => import('@/features/inventario/InventarioPage'))
const AgendaPage = lazy(() => import('@/features/agenda/AgendaPage'))
const ReportesPage = lazy(() => import('@/features/reportes/ReportesPage'))
const UsuariosPage = lazy(() => import('@/features/usuarios/UsuariosPage'))
const ConfiguracionPage = lazy(() => import('@/features/configuracion/ConfiguracionPage'))
const CalculadoraPage = lazy(() => import('@/features/calculadora/CalculadoraPage'))
const CatalogoPage = lazy(() => import('@/features/catalogo/CatalogoPage'))
const PortalPage = lazy(() => import('@/features/portal/PortalPage'))

/**
 * Rutas de los módulos. La guarda aplica los permisos del módulo y de su sección
 * (MODULOS en ./navegacion.ts). Los módulos con pestañas usan "/*": cada página arma sus
 * subrutas (p. ej. /pagos/caja) con <Routes> internas o leyendo la ruta, sin tocar este archivo.
 */
const modulos: RouteObject[] = [
  { path: 'clientes', element: <ClientesPage /> },
  { path: 'clientes/:id', element: <ClienteDetallePage /> },
  { path: 'embudo', element: <EmbudoPage /> },
  { path: 'pedidos', element: <PedidosPage /> },
  { path: 'pedidos/nuevo', element: <PedidoNuevoPage /> },
  { path: 'pedidos/:id', element: <PedidoDetallePage /> },
  { path: 'produccion', element: <ProduccionPage /> },
  { path: 'produccion/:id', element: <OrdenTrabajoPage /> },
  { path: 'pagos/*', element: <PagosPage /> },
  { path: 'inventario/*', element: <InventarioPage /> },
  { path: 'agenda', element: <AgendaPage /> },
  { path: 'reportes/*', element: <ReportesPage /> },
  { path: 'usuarios/*', element: <UsuariosPage /> },
  { path: 'configuracion/*', element: <ConfiguracionPage /> },
  { path: 'calculadora', element: <CalculadoraPage /> },
  { path: 'catalogo/*', element: <CatalogoPage /> },
]

const rutas: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/nueva-contrasena', element: <NuevaContrasenaPage /> },
  // Portal del cliente: público, sin sesión y fuera de la estructura de la app
  { path: '/portal/:token', element: <PortalPage /> },
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
      { element: <GuardaModulo />, children: modulos },
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
