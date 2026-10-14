import ModuloPendiente from '@/features/modulos/ModuloPendiente'

/**
 * Pagos (/pagos/*): cobros, por cobrar, corte de caja y comisiones (pestañas en MODULOS.secciones).
 * PENDIENTE: el agente del módulo reemplaza este archivo (la ruta /pagos/* ya existe en
 * src/app/rutas.tsx y la guarda de permisos ya se aplica; no hace falta tocarlos).
 * Datos: api.pagos, api.cobranza, api.caja, api.comisiones → src/data/modulos/pagos/contrato.ts
 */
export default function PagosPage() {
  return <ModuloPendiente />
}
