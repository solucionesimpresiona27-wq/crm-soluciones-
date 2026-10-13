import { PERMISOS, type Permiso, type Permisos, type Rol } from '@/data/tipos'

/** Igual que permiso_por_defecto() en la base de datos. */
const PORDEFECTO: Record<Rol, readonly Permiso[]> = {
  admin: PERMISOS,
  ventas: ['ver_precios', 'gestionar_clientes', 'gestionar_cotizaciones', 'gestionar_pedidos', 'actualizar_produccion', 'aprobar_disenos', 'registrar_pagos'],
  diseno: ['actualizar_produccion', 'aprobar_disenos'],
  produccion: ['actualizar_produccion', 'registrar_consumos'],
}

export function permisosDeRol(rol: Rol, personalizados: Partial<Record<Permiso, boolean>> = {}): Permisos {
  return Object.fromEntries(
    PERMISOS.map((p) => [p, rol === 'admin' ? true : (personalizados[p] ?? PORDEFECTO[rol].includes(p))]),
  ) as Permisos
}

export const NOMBRE_ROL: Record<Rol, string> = {
  admin: 'Administración',
  ventas: 'Ventas',
  diseno: 'Diseño',
  produccion: 'Producción e instalación',
}

export const DESCRIPCION_PERMISO: Record<Permiso, string> = {
  ver_precios: 'Ver precios, totales y pagos',
  ver_costos: 'Ver costos, márgenes y utilidades',
  ver_reportes: 'Ver métricas financieras',
  gestionar_clientes: 'Clientes, prospectos y seguimientos',
  gestionar_cotizaciones: 'Crear y enviar cotizaciones',
  gestionar_pedidos: 'Crear, editar y cancelar pedidos',
  actualizar_produccion: 'Actualizar etapas de producción',
  aprobar_disenos: 'Registrar aprobaciones de diseño',
  registrar_pagos: 'Registrar cobros',
  cancelar_pagos: 'Cancelar pagos y devoluciones',
  editar_catalogo: 'Editar catálogo y precios',
  exportar_datos: 'Exportar a Excel/CSV',
  eliminar_registros: 'Eliminar registros',
  gestionar_inventario: 'Inventario: materiales, entradas, ajustes y proveedores',
  registrar_consumos: 'Registrar consumos y mermas de material',
  registrar_gastos: 'Registrar gastos, compras y maquila',
}
