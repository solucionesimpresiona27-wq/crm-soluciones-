import {
  Boxes,
  Calculator,
  CalendarDays,
  ChartColumn,
  FileText,
  Filter,
  Hammer,
  LayoutDashboard,
  Package,
  Palette,
  Settings,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { Permiso } from '@/data/tipos'
import { DEMO } from '@/lib/supabase'

export interface Modulo {
  ruta: string
  titulo: string
  icono: LucideIcon
  grupo: 'Principal' | 'Operación' | 'Análisis' | 'Sistema'
  /** Basta con uno de estos permisos para ver el módulo */
  permisos?: Permiso[]
  soloAdmin?: boolean
  /** Módulos que se construyen después de aprobar el diseño */
  pendiente?: boolean
  descripcion: string
  incluye?: string[]
}

export const MODULOS: Modulo[] = [
  { ruta: '/', titulo: 'Inicio', icono: LayoutDashboard, grupo: 'Principal', descripcion: 'Panel de control' },
  {
    ruta: '/clientes', titulo: 'Clientes', icono: Users, grupo: 'Principal', pendiente: true,
    descripcion: 'Clientes, contactos e historial completo',
    incluye: ['Ficha con datos de contacto y fiscales', 'Historial de cotizaciones, pedidos y pagos', 'Notas y seguimientos', 'Exportar a Excel'],
  },
  {
    ruta: '/embudo', titulo: 'Embudo', icono: Filter, grupo: 'Principal', permisos: ['gestionar_clientes'], pendiente: true,
    descripcion: 'Seguimiento comercial de prospectos',
    incluye: ['Tablero: prospecto → contactado → interesado → cotización → seguimiento → ganado/perdido', 'Recordatorios de próxima acción', 'Motivos de pérdida'],
  },
  { ruta: '/cotizaciones', titulo: 'Cotizaciones', icono: FileText, grupo: 'Principal', permisos: ['ver_precios'], descripcion: 'Presupuestos, PDF y envío por WhatsApp' },
  {
    ruta: '/calculadora', titulo: 'Calculadora', icono: Calculator, grupo: 'Principal', permisos: ['gestionar_cotizaciones'], pendiente: true,
    descripcion: 'Precios por m², metro lineal, millar, pieza, hora y proyecto',
    incluye: ['Costos de material, mano de obra y desperdicio', 'Margen y precio sugerido', 'Instalación y transporte por separado', 'Enviar el resultado a una cotización'],
  },
  {
    ruta: '/pedidos', titulo: 'Pedidos', icono: Package, grupo: 'Operación', pendiente: true,
    descripcion: 'Órdenes de trabajo y su avance',
    incluye: ['Etapas que se omiten según el tipo de trabajo', 'Pausar o cancelar con motivo', 'Archivos de diseño con versiones y aprobación', 'Facturación externa'],
  },
  {
    ruta: '/produccion', titulo: 'Producción', icono: Hammer, grupo: 'Operación', permisos: ['actualizar_produccion'], pendiente: true,
    descripcion: 'Tablero de producción e instalación',
    incluye: ['Tablero por etapas con arrastrar y soltar', 'Hoja de orden de trabajo sin precios', 'Notas y evidencias de instalación'],
  },
  {
    ruta: '/pagos', titulo: 'Pagos', icono: Wallet, grupo: 'Operación', permisos: ['ver_precios'], pendiente: true,
    descripcion: 'Cobros, saldos y cuentas por cobrar',
    incluye: ['Anticipos, abonos y liquidaciones', 'Comprobantes', 'Pagos vencidos y devoluciones', 'Corte de caja'],
  },
  {
    ruta: '/inventario', titulo: 'Inventario', icono: Boxes, grupo: 'Operación', pendiente: true,
    descripcion: 'Materiales, proveedores y compras',
    incluye: ['Existencias de vinil, lonas, papel y tintas', 'Alertas de stock mínimo', 'Proveedores y compras'],
  },
  {
    ruta: '/agenda', titulo: 'Agenda', icono: CalendarDays, grupo: 'Operación', pendiente: true,
    descripcion: 'Entregas, instalaciones y recordatorios',
    incluye: ['Calendario de entregas e instalaciones', 'Recordatorios y tareas por responsable'],
  },
  {
    ruta: '/reportes', titulo: 'Reportes', icono: ChartColumn, grupo: 'Análisis', permisos: ['ver_reportes'], pendiente: true,
    descripcion: 'Ventas y rentabilidad',
    incluye: ['Ventas por periodo, producto y vendedor', 'Utilidad real por pedido', 'Clientes que dejaron de comprar'],
  },
  {
    ruta: '/usuarios', titulo: 'Usuarios', icono: UserCog, grupo: 'Sistema', soloAdmin: true, pendiente: true,
    descripcion: 'Equipo, roles y permisos',
    incluye: ['Alta de usuarios con contraseña', 'Roles y permisos personalizados', 'Activar o desactivar cuentas', 'Bitácora de cambios'],
  },
  {
    ruta: '/configuracion', titulo: 'Configuración', icono: Settings, grupo: 'Sistema', soloAdmin: true, pendiente: true,
    descripcion: 'Datos de la empresa, logo y condiciones',
    incluye: ['Datos de contacto y fiscales', 'Logo y colores', 'Condiciones de cotización', 'Plantillas de WhatsApp', 'Métodos de pago'],
  },
  // Vitrina del sistema de diseño: en la vista previa la ven todos para validarlo; en la app real, solo administración
  { ruta: '/sistema-diseno', titulo: 'Diseño', icono: Palette, grupo: 'Sistema', soloAdmin: !DEMO, descripcion: 'Vitrina del sistema de diseño Impresiona Glass' },
]

export const GRUPOS = ['Principal', 'Operación', 'Análisis', 'Sistema'] as const
