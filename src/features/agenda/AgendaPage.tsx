import ModuloPendiente from '@/features/modulos/ModuloPendiente'

/**
 * Agenda: calendario combinado y "Mis pendientes de hoy".
 * PENDIENTE: el agente del módulo reemplaza este archivo (la ruta /agenda ya existe en
 * src/app/rutas.tsx y la guarda de permisos ya se aplica; no hace falta tocarlos).
 * Datos: api.tareas, api.agenda → src/data/modulos/agenda/contrato.ts
 */
export default function AgendaPage() {
  return <ModuloPendiente />
}
