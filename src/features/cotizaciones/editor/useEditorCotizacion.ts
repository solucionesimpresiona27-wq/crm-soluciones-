import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { ProductoCatalogo, TipoPartida } from '@/data/tipos'
import {
  aBorrador,
  duplicarPartida,
  hayErrores,
  nuevaPartida,
  sincronizar,
  totalesDe,
  validar,
  type EstadoEditor,
  type PartidaEditor,
} from './modelo'

export type CambiarPartida = (clave: string, fn: (p: PartidaEditor) => PartidaEditor) => void

export interface AccionesPartida {
  cambiar: CambiarPartida
  mover: (clave: string, direccion: -1 | 1) => void
  duplicar: (clave: string) => void
  eliminar: (clave: string) => void
}

/**
 * Estado del editor: datos, totales en vivo, validación, cambios sin guardar y
 * operaciones sobre los conceptos. Las funciones son estables para que cada fila
 * solo se vuelva a pintar cuando cambia su propio concepto.
 */
export function useEditorCotizacion(crearInicial: () => EstadoEditor, puedeCostos: boolean, productos: ProductoCatalogo[] | undefined) {
  const [estado, setEstado] = useState(crearInicial)
  // Lo guardado (o lo vacío) contra lo que se comparan los cambios sin guardar
  const [base] = useState(() => JSON.stringify(aBorrador(estado, puedeCostos)))
  const [ultima, setUltima] = useState<string | null>(null)
  const actual = useRef(estado)
  actual.current = estado

  const catalogo = useMemo(() => new Map((productos ?? []).map((p) => [p.id, p])), [productos])
  const productoDe = useCallback((id: string | null) => (id ? catalogo.get(id) : undefined), [catalogo])

  const totales = useMemo(() => totalesDe(estado), [estado])
  const errores = useMemo(() => validar(estado, totales), [estado, totales])
  const sucio = useMemo(() => JSON.stringify(aBorrador(estado, puedeCostos)) !== base, [estado, puedeCostos, base])

  const actualizar = useCallback(<K extends keyof EstadoEditor>(campo: K, valor: EstadoEditor[K]) => {
    setEstado((e) => ({ ...e, [campo]: valor }))
  }, [])

  const cambiar = useCallback<CambiarPartida>(
    (clave, fn) =>
      setEstado((e) => ({
        ...e,
        partidas: e.partidas.map((p) => {
          if (p.clave !== clave) return p
          const nueva = fn(p)
          return sincronizar(nueva, nueva.producto_id ? catalogo.get(nueva.producto_id) : undefined, puedeCostos)
        }),
      })),
    [catalogo, puedeCostos],
  )

  const agregar = useCallback((tipo: TipoPartida) => {
    const p = nuevaPartida(tipo)
    setEstado((e) => ({ ...e, partidas: [...e.partidas, p] }))
    setUltima(p.clave)
  }, [])

  const mover = useCallback((clave: string, direccion: -1 | 1) => {
    setEstado((e) => {
      const i = e.partidas.findIndex((p) => p.clave === clave)
      const j = i + direccion
      if (i < 0 || j < 0 || j >= e.partidas.length) return e
      const partidas = [...e.partidas]
      ;[partidas[i], partidas[j]] = [partidas[j], partidas[i]]
      return { ...e, partidas }
    })
  }, [])

  const duplicar = useCallback((clave: string) => {
    const i = actual.current.partidas.findIndex((p) => p.clave === clave)
    if (i < 0) return
    const copia = duplicarPartida(actual.current.partidas[i])
    setEstado((e) => {
      const k = e.partidas.findIndex((p) => p.clave === clave)
      if (k < 0) return e
      const partidas = [...e.partidas]
      partidas.splice(k + 1, 0, copia)
      return { ...e, partidas }
    })
    setUltima(copia.clave)
  }, [])

  const eliminar = useCallback((clave: string) => {
    const i = actual.current.partidas.findIndex((p) => p.clave === clave)
    if (i < 0) return
    const quitada = actual.current.partidas[i]
    setEstado((e) => ({ ...e, partidas: e.partidas.filter((p) => p.clave !== clave) }))
    toast(quitada.concepto.trim() ? `Quitaste “${quitada.concepto.trim()}”` : 'Quitaste un concepto', {
      action: {
        label: 'Deshacer',
        onClick: () =>
          setEstado((e) => {
            if (e.partidas.some((p) => p.clave === quitada.clave)) return e
            const partidas = [...e.partidas]
            partidas.splice(Math.min(i, partidas.length), 0, quitada)
            return { ...e, partidas }
          }),
      },
    })
  }, [])

  const acciones: AccionesPartida = useMemo(() => ({ cambiar, mover, duplicar, eliminar }), [cambiar, mover, duplicar, eliminar])

  return {
    estado,
    totales,
    errores,
    valido: !hayErrores(errores),
    sucio,
    ultima,
    productoDe,
    actualizar,
    agregar,
    acciones,
  }
}
