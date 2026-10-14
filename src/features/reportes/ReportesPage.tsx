import ModuloPendiente from '@/features/modulos/ModuloPendiente'

/**
 * Reportes (/reportes/*): ventas, productos, vendedores, clientes y utilidad.
 * PENDIENTE: el agente del módulo reemplaza este archivo (la ruta /reportes/* ya existe en
 * src/app/rutas.tsx y la guarda de permisos ya se aplica; no hace falta tocarlos).
 * Datos: api.reportes (y api.cobranza, api.comisiones, api.clientes.inactivos) → src/data/modulos/reportes/contrato.ts
 */
export default function ReportesPage() {
  return <ModuloPendiente />
}
