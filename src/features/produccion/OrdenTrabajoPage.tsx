import ModuloPendiente from '@/features/modulos/ModuloPendiente'

/**
 * Hoja de orden de trabajo (/produccion/:id), sin precios.
 * PENDIENTE: el agente del módulo reemplaza este archivo (la ruta /produccion/:id ya existe en
 * src/app/rutas.tsx y la guarda de permisos ya se aplica; no hace falta tocarlos).
 * Datos: api.produccion → src/data/modulos/produccion/contrato.ts
 */
export default function OrdenTrabajoPage() {
  return <ModuloPendiente />
}
