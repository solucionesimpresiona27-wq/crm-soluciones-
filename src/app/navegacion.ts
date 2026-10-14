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
  Tags,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { Permiso } from '@/data/tipos'
import { DEMO } from '@/lib/supabase'

/**
 * Sección (pestaña) dentro de un módulo, con su propia ruta. La guarda de rutas y el menú
 * del módulo la ocultan si el usuario no tiene ninguno de sus permisos.
 */
export interface Seccion {
  ruta: string
  titulo: string
  /** Basta con uno de estos permisos (además de los del módulo) */
  permisos?: Permiso[]
  soloAdmin?: boolean
}

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
  /** Pestañas del módulo (la primera es la ruta del módulo). Ver useSeccionesVisibles(). */
  secciones?: Seccion[]
}

export const MODULOS: Modulo[] = [
  { ruta: '/', titulo: 'Inicio', icono: LayoutDashboard, grupo: 'Principal', descripcion: 'Panel de control' },
  {
    // Producción solo ve el nombre del cliente dentro de su orden de trabajo (PLAN.md §3)
    ruta: '/clientes', titulo: 'Clientes', icono: Users, grupo: 'Principal', permisos: ['gestionar_clientes', 'aprobar_disenos'],
    descripcion: 'Clientes, contactos e historial completo',
    incluye: ['Ficha con datos de contacto y fiscales', 'Historial de cotizaciones, pedidos y pagos', 'Notas y seguimientos', 'Exportar a Excel'],
  },
  {
    ruta: '/embudo', titulo: 'Embudo', icono: Filter, grupo: 'Principal', permisos: ['gestionar_clientes'],
    descripcion: 'Seguimiento comercial de prospectos',
    incluye: ['Tablero: prospecto → contactado → interesado → cotización → seguimiento → ganado/perdido', 'Recordatorios de próxima acción', 'Motivos de pérdida'],
  },
  { ruta: '/cotizaciones', titulo: 'Cotizaciones', icono: FileText, grupo: 'Principal', permisos: ['ver_precios'], descripcion: 'Presupuestos, PDF y envío por WhatsApp' },
  {
    ruta: '/calculadora', titulo: 'Calculadora', icono: Calculator, grupo: 'Principal', permisos: ['gestionar_cotizaciones'],
    descripcion: 'Precios por m², metro lineal, millar, pieza, hora y proyecto',
    incluye: ['Costos de material, mano de obra y desperdicio', 'Margen y precio sugerido', 'Instalación y transporte por separado', 'Enviar el resultado a una cotización'],
  },
  {
    ruta: '/pedidos', titulo: 'Pedidos', icono: Package, grupo: 'Operación',
    descripcion: 'Órdenes de trabajo y su avance',
    incluye: ['Etapas que se omiten según el tipo de trabajo', 'Pausar o cancelar con motivo', 'Archivos de diseño con versiones y aprobación', 'Facturación externa'],
  },
  {
    ruta: '/produccion', titulo: 'Producción', icono: Hammer, grupo: 'Operación', permisos: ['actualizar_produccion'],
    descripcion: 'Tablero de producción e instalación',
    incluye: ['Tablero por etapas con arrastrar y soltar', 'Hoja de orden de trabajo sin precios', 'Notas y evidencias de instalación'],
  },
  {
    ruta: '/pagos', titulo: 'Pagos', icono: Wallet, grupo: 'Operación', permisos: ['ver_precios'],
    descripcion: 'Cobros, saldos y cuentas por cobrar',
    incluye: ['Anticipos, abonos y liquidaciones', 'Comprobantes', 'Pagos vencidos y devoluciones', 'Corte de caja'],
    secciones: [
      { ruta: '/pagos', titulo: 'Cobros' },
      { ruta: '/pagos/por-cobrar', titulo: 'Por cobrar' },
      { ruta: '/pagos/caja', titulo: 'Corte de caja', permisos: ['registrar_pagos', 'ver_reportes'] },
      // Cada quien ve sus comisiones; con "ver_reportes", las de todos
      { ruta: '/pagos/comisiones', titulo: 'Comisiones' },
    ],
  },
  {
    ruta: '/inventario', titulo: 'Inventario', icono: Boxes, grupo: 'Operación',
    descripcion: 'Materiales, proveedores y compras',
    incluye: ['Existencias de vinil, lonas, papel y tintas', 'Alertas de stock mínimo', 'Proveedores y compras'],
    // Todo el equipo ve materiales y existencias (Producción registra consumos)
    secciones: [
      { ruta: '/inventario', titulo: 'Materiales' },
      { ruta: '/inventario/movimientos', titulo: 'Movimientos' },
      { ruta: '/inventario/proveedores', titulo: 'Proveedores', permisos: ['gestionar_inventario', 'registrar_gastos', 'ver_costos'] },
      { ruta: '/inventario/gastos', titulo: 'Gastos y compras', permisos: ['registrar_gastos', 'ver_costos'] },
    ],
  },
  {
    ruta: '/agenda', titulo: 'Agenda', icono: CalendarDays, grupo: 'Operación',
    descripcion: 'Entregas, instalaciones y recordatorios',
    incluye: ['Calendario de entregas e instalaciones', 'Recordatorios y tareas por responsable'],
  },
  {
    ruta: '/reportes', titulo: 'Reportes', icono: ChartColumn, grupo: 'Análisis', permisos: ['ver_reportes'],
    descripcion: 'Ventas y rentabilidad',
    incluye: ['Ventas por periodo, producto y vendedor', 'Utilidad real por pedido', 'Clientes que dejaron de comprar'],
    secciones: [
      { ruta: '/reportes', titulo: 'Ventas' },
      { ruta: '/reportes/productos', titulo: 'Productos' },
      { ruta: '/reportes/vendedores', titulo: 'Vendedores' },
      { ruta: '/reportes/clientes', titulo: 'Clientes' },
      { ruta: '/reportes/utilidad', titulo: 'Utilidad', permisos: ['ver_costos'] },
    ],
  },
  {
    ruta: '/usuarios', titulo: 'Usuarios', icono: UserCog, grupo: 'Sistema', soloAdmin: true,
    descripcion: 'Equipo, roles y permisos',
    incluye: ['Alta de usuarios con contraseña', 'Roles y permisos personalizados', 'Activar o desactivar cuentas', 'Bitácora de cambios'],
    secciones: [
      { ruta: '/usuarios', titulo: 'Equipo' },
      { ruta: '/usuarios/bitacora', titulo: 'Bitácora' },
    ],
  },
  {
    ruta: '/configuracion', titulo: 'Configuración', icono: Settings, grupo: 'Sistema', soloAdmin: true,
    descripcion: 'Datos de la empresa, logo y condiciones',
    incluye: ['Datos de contacto y fiscales', 'Logo y colores', 'Condiciones de cotización', 'Plantillas de WhatsApp', 'Métodos de pago'],
    secciones: [
      { ruta: '/configuracion', titulo: 'Empresa' },
      { ruta: '/configuracion/plantillas', titulo: 'Plantillas de WhatsApp' },
    ],
  },
  // Vitrina del sistema de diseño: en la vista previa la ven todos para validarlo; en la app real, solo administración
  { ruta: '/sistema-diseno', titulo: 'Diseño', icono: Palette, grupo: 'Sistema', soloAdmin: !DEMO, descripcion: 'Vitrina del sistema de diseño Impresiona Glass' },
]

export const GRUPOS = ['Principal', 'Operación', 'Análisis', 'Sistema'] as const

/**
 * Catálogo de productos y precios: no tiene entrada propia en el menú (para no cambiar el
 * diseño aprobado del menú); se abre desde Configuración y desde la Calculadora en /catalogo.
 */
export const CATALOGO: Modulo = {
  ruta: '/catalogo',
  titulo: 'Catálogo',
  icono: Tags,
  grupo: 'Sistema',
  permisos: ['editar_catalogo', 'ver_precios'],
  descripcion: 'Productos, precios por lista y costos',
  incluye: ['Productos y categorías', 'Precio público, mayoreo y agencia', 'Precios por volumen', 'Costos base para el margen'],
}
