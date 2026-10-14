import ModuloPendiente from '@/features/modulos/ModuloPendiente'

/**
 * Inventario (/inventario/*): materiales, movimientos, proveedores y gastos (pestañas en MODULOS.secciones).
 * PENDIENTE: el agente del módulo reemplaza este archivo (la ruta /inventario/* ya existe en
 * src/app/rutas.tsx y la guarda de permisos ya se aplica; no hace falta tocarlos).
 * Datos: api.materiales, api.inventario, api.proveedores, api.gastos → src/data/modulos/inventario/contrato.ts
 */
export default function InventarioPage() {
  return <ModuloPendiente />
}
