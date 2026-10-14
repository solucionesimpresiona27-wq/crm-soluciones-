import ModuloPendiente from '@/features/modulos/ModuloPendiente'

/**
 * Pedido directo sin cotización (/pedidos/nuevo).
 * PENDIENTE: el agente del módulo reemplaza este archivo (la ruta /pedidos/nuevo ya existe en
 * src/app/rutas.tsx y la guarda de permisos ya se aplica; no hace falta tocarlos).
 * Datos: api.pedidos → src/data/modulos/pedidos/contrato.ts
 */
export default function PedidoNuevoPage() {
  return <ModuloPendiente />
}
