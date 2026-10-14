import ModuloPendiente from '@/features/modulos/ModuloPendiente'

/**
 * Configuración (/configuracion/*): empresa, logo, condiciones y plantillas de WhatsApp.
 * PENDIENTE: el agente del módulo reemplaza este archivo (la ruta /configuracion/* ya existe en
 * src/app/rutas.tsx y la guarda de permisos ya se aplica; no hace falta tocarlos).
 * Datos: api.configuracion, api.plantillas → src/data/modulos/administracion/contrato.ts
 */
export default function ConfiguracionPage() {
  return <ModuloPendiente />
}
