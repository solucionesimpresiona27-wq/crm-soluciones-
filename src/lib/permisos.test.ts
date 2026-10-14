import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PERMISOS, type Rol } from '@/data/tipos'
import { DESCRIPCION_PERMISO, permisosDeRol } from './permisos'

/** Última definición de una función SQL en las migraciones. */
function ultimaFuncion(nombre: string) {
  const dir = join(process.cwd(), 'supabase/migrations')
  let cuerpo = ''
  for (const f of readdirSync(dir).sort()) {
    const sql = readFileSync(join(dir, f), 'utf8')
    const i = sql.lastIndexOf(`function public.${nombre}(`)
    if (i >= 0) cuerpo = sql.slice(i, sql.indexOf('$$;', sql.indexOf('$$', i) + 2))
  }
  return cuerpo
}

describe('permisos de la app = permisos de la base de datos', () => {
  it('la lista de permisos es la misma que lista_permisos()', () => {
    const sql = ultimaFuncion('lista_permisos')
    const enSql = [...sql.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
    expect([...PERMISOS]).toEqual(enSql)
    for (const p of PERMISOS) expect(DESCRIPCION_PERMISO[p], p).toBeTruthy()
  })

  it.each(['ventas', 'diseno', 'produccion'] as Rol[])('permisos por defecto de %s = permiso_por_defecto()', (rol) => {
    const sql = ultimaFuncion('permiso_por_defecto')
    const bloque = sql.slice(sql.indexOf(`when '${rol}'`))
    const lista = bloque.slice(bloque.indexOf('array['), bloque.indexOf(']') + 1)
    const esperados = [...lista.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()
    const app = Object.entries(permisosDeRol(rol)).filter(([, v]) => v).map(([k]) => k).sort()
    expect(app).toEqual(esperados)
  })

  it('administración tiene todos y los personalizados se respetan', () => {
    expect(Object.values(permisosDeRol('admin')).every(Boolean)).toBe(true)
    expect(permisosDeRol('ventas', { registrar_gastos: true }).registrar_gastos).toBe(true)
    expect(permisosDeRol('ventas', { registrar_pagos: false }).registrar_pagos).toBe(false)
  })
})
