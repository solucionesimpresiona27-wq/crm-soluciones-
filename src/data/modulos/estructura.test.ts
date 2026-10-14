/**
 * Reglas de la capa de datos por módulos (para que varios agentes trabajen en paralelo):
 *   * Cada módulo tiene contrato.ts, supabase.ts, demo.ts y demo.test.ts.
 *   * Un módulo no importa archivos de otro módulo (lo compartido se pide al orquestador).
 *   * supabase.ts nunca importa la vista previa; demo.ts nunca importa Supabase.
 *   * Ningún espacio de la API se repite entre módulos (componer() también lo revisa al arrancar).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import apiDemo from '../demo/apiDemo'

const RAIZ = join(process.cwd(), 'src/data/modulos')
const MODULOS = readdirSync(RAIZ, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()

const importaciones = (archivo: string) =>
  [...readFileSync(archivo, 'utf8').matchAll(/^\s*(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1])

describe('estructura de src/data/modulos', () => {
  it('están los 11 módulos con sus 4 archivos', () => {
    expect(MODULOS).toEqual(['administracion', 'agenda', 'catalogo', 'clientes', 'embudo', 'inventario', 'pagos', 'pedidos', 'portal', 'produccion', 'reportes'])
    for (const m of MODULOS) {
      const archivos = readdirSync(join(RAIZ, m))
      for (const f of ['contrato.ts', 'supabase.ts', 'demo.ts', 'demo.test.ts']) expect(archivos, `${m}/${f}`).toContain(f)
    }
  })

  it.each(MODULOS)('%s: solo importa de su carpeta y de lo compartido', (m) => {
    for (const f of readdirSync(join(RAIZ, m)).filter((x) => x.endsWith('.ts'))) {
      for (const origen of importaciones(join(RAIZ, m, f))) {
        const otroModulo = origen.match(/(?:@\/data\/modulos\/|\.\.\/)([a-z]+)\//)?.[1]
        if (otroModulo) expect(otroModulo, `${m}/${f} importa ${origen}`).toBe(m)
        if (f === 'supabase.ts' || f === 'contrato.ts') expect(origen, `${m}/${f} no debe usar la vista previa`).not.toMatch(/data\/demo/)
        if (f === 'demo.ts' || f === 'contrato.ts') {
          expect(origen, `${m}/${f} no debe usar Supabase`).not.toMatch(/comun\/real|supabase-js|^\.\/supabase$/)
          expect(origen, `${m}/${f} no debe usar el cliente real`).not.toBe('@/lib/supabase')
        }
      }
    }
  })

  it('la vista previa expone los mismos espacios que la app real', () => {
    expect(Object.keys(apiDemo).sort()).toEqual(
      [
        'actividades', 'agenda', 'archivos', 'bitacora', 'busqueda', 'caja', 'catalogo', 'clientes', 'cobranza', 'comisiones', 'configuracion', 'contactos',
        'cotizaciones', 'dashboard', 'gastos', 'inventario', 'materiales', 'oportunidades', 'pagos', 'pedidos', 'plantillas', 'portal', 'produccion',
        'proveedores', 'reportes', 'sesion', 'tareas', 'usuarios',
      ].sort(),
    )
  })
})
