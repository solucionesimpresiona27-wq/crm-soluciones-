import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api } from '@/data/api'
import type { Permiso, SesionUsuario } from '@/data/tipos'

interface ContextoSesion {
  cargando: boolean
  sesion: SesionUsuario | null
  error: string | null
  puede: (permiso: Permiso) => boolean
  recargar: () => Promise<void>
  cerrar: () => Promise<void>
}

const Ctx = createContext<ContextoSesion | null>(null)

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true)
  const [sesion, setSesion] = useState<SesionUsuario | null>(null)
  const [error, setError] = useState<string | null>(null)
  const qc = useQueryClient()
  const usuarioId = useRef<string | null>(null)

  const recargar = useCallback(async () => {
    try {
      setError(null)
      const nueva = await api.sesion.actual()
      // Limpia el caché solo si cambió la persona (no al refrescar el token ni al volver a la pestaña)
      const id = nueva?.id ?? null
      if (usuarioId.current !== null && usuarioId.current !== id) qc.clear()
      usuarioId.current = id
      setSesion(nueva)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la sesión')
      setSesion(null)
    } finally {
      setCargando(false)
    }
  }, [qc])

  useEffect(() => {
    void recargar()
    return api.sesion.alCambiar(() => {
      void recargar()
    })
  }, [recargar])

  const valor = useMemo<ContextoSesion>(
    () => ({
      cargando,
      sesion,
      error,
      puede: (p) => Boolean(sesion?.perfil.activo && sesion.permisos[p]),
      recargar,
      cerrar: async () => {
        await api.sesion.cerrar()
        qc.clear()
        setSesion(null)
      },
    }),
    [cargando, sesion, error, recargar, qc],
  )

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useSesion() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useSesion fuera de ProveedorSesion')
  return c
}
