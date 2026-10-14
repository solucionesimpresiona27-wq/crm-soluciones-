import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { claves } from '@/app/consultas'
import { api } from '@/data/api'
import type { CambiosConfiguracion, Configuracion } from '@/data/modulos/administracion/contrato'

export type Campo = keyof Omit<Configuracion, 'id' | 'updated_at'>
/** Valor en edición: los números se editan como texto y se convierten al guardar. */
type Valor = Configuracion[Campo] | string

export interface ReglaNumero {
  min: number
  max: number
  entero?: boolean
  nombre: string
}

const igual = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** Convierte el borrador a cambios (solo lo distinto) y valida los números. */
export function prepararCambios(base: Partial<Configuracion>, borrador: Record<string, Valor>, numeros: Partial<Record<Campo, ReglaNumero>> = {}) {
  const cambios: Record<string, unknown> = {}
  const errores: Partial<Record<Campo, string>> = {}
  for (const [k, v] of Object.entries(borrador)) {
    const regla = numeros[k as Campo]
    let valor: unknown = v
    if (regla) {
      const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
      if (String(v).trim() === '' || Number.isNaN(n) || n < regla.min || n > regla.max || (regla.entero && !Number.isInteger(n))) {
        errores[k as Campo] = `${regla.nombre}: escribe ${regla.entero ? 'un número entero' : 'un número'} entre ${regla.min} y ${regla.max}`
        continue
      }
      valor = n
    } else if (typeof v === 'string') {
      valor = v.trim() === '' ? null : v
    }
    if (!igual(valor, base[k as Campo])) cambios[k] = valor
  }
  return { cambios: cambios as CambiosConfiguracion, errores }
}

/** Borrador de una sección de la configuración: guarda solo sus campos. */
export function useBorrador(config: Configuracion, campos: Campo[], numeros: Partial<Record<Campo, ReglaNumero>> = {}) {
  const qc = useQueryClient()
  const inicial = useMemo(() => Object.fromEntries(campos.map((c) => [c, numeros[c] ? String(config[c] ?? '') : (config[c] ?? (Array.isArray(config[c]) ? [] : ''))])) as Record<string, Valor>, [config, campos, numeros]) // eslint-disable-line react-hooks/exhaustive-deps
  const [borrador, setBorrador] = useState(inicial)
  const { cambios, errores } = prepararCambios(config, borrador, numeros)
  const sucio = Object.keys(cambios).length > 0 || Object.keys(errores).length > 0
  const [verErrores, setVerErrores] = useState(false)

  // Si la configuración cambia fuera (otra pestaña, recarga) y no hay cambios locales, se toma la nueva
  useEffect(() => {
    if (!sucio) setBorrador(inicial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.updated_at])

  const mutacion = useMutation({
    mutationFn: (c: CambiosConfiguracion) => api.configuracion.guardar(c),
    onSuccess: (nueva) => {
      qc.setQueryData(claves.configuracion, nueva)
      void qc.invalidateQueries({ queryKey: ['bitacora'] })
      setBorrador(Object.fromEntries(campos.map((c) => [c, numeros[c] ? String(nueva[c] ?? '') : (nueva[c] ?? '')])) as Record<string, Valor>)
      setVerErrores(false)
    },
  })

  return {
    valor: <T = string>(c: Campo) => borrador[c] as T,
    poner: (c: Campo, v: Valor) => setBorrador((b) => ({ ...b, [c]: v })),
    sucio,
    errores: verErrores ? errores : {},
    hayErrores: Object.keys(errores).length > 0,
    guardando: mutacion.isPending,
    descartar: () => {
      setBorrador(inicial)
      setVerErrores(false)
    },
    /** Devuelve una promesa que se rechaza con el primer error de validación o del servidor. */
    guardar: async () => {
      if (Object.keys(errores).length) {
        setVerErrores(true)
        throw new Error(Object.values(errores)[0])
      }
      if (!Object.keys(cambios).length) return config
      return mutacion.mutateAsync(cambios)
    },
  }
}

export type Borrador = ReturnType<typeof useBorrador>
