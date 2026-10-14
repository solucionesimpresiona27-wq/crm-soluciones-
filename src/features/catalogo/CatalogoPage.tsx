import { CATALOGO } from '@/app/navegacion'
import ModuloPendiente from '@/features/modulos/ModuloPendiente'

/**
 * Catálogo (/catalogo/*): productos, categorías, precios por lista, escalas y costos.
 * No tiene entrada en el menú (se abre desde Configuración y la Calculadora).
 * PENDIENTE: el agente del módulo reemplaza este archivo (la ruta y la guarda ya existen).
 * Datos: api.catalogo → src/data/modulos/catalogo/contrato.ts
 */
export default function CatalogoPage() {
  return <ModuloPendiente modulo={CATALOGO} />
}
