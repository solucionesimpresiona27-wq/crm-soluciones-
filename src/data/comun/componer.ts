/**
 * Une el núcleo y los módulos de datos en un solo objeto `api`.
 * Cada módulo es dueño de sus espacios (`api.clientes`, `api.pagos`…): si dos módulos
 * definieran el mismo, la app falla al arrancar con un mensaje claro en lugar de que uno
 * reemplace al otro en silencio.
 */
type Union<T extends object[]> = T extends [infer H, ...infer R extends object[]] ? H & Union<R> : unknown

export function componer<T extends object[]>(...partes: T): Union<T> {
  const api: Record<string, unknown> = {}
  for (const parte of partes) {
    for (const [clave, valor] of Object.entries(parte)) {
      if (clave in api) throw new Error(`Dos módulos de datos definen api.${clave}. Cada espacio pertenece a un solo módulo.`)
      api[clave] = valor
    }
  }
  return api as Union<T>
}
