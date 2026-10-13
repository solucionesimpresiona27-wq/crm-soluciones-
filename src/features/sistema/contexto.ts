import { createContext, useContext, type RefObject } from 'react'

export type Fondo = 'luz' | 'foto' | 'rayas' | 'liso'

export interface ContextoEscenario {
  /** Elemento del escenario: sus variables CSS ajustan el cristal solo dentro de la vitrina */
  ref: RefObject<HTMLDivElement | null>
  /** Foco encendido: una luz amarilla ilumina el fondo */
  foco: boolean
  setFoco: (encendido: boolean) => void
}

export const CtxEscenario = createContext<ContextoEscenario | null>(null)

export function useEscenario() {
  const c = useContext(CtxEscenario)
  if (!c) throw new Error('useEscenario fuera de <Escenario>')
  return c
}
