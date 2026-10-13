import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { useSesion } from '@/app/sesion'
import { GlassIconButton } from '@/components/glass'
import { NuevoClienteModal } from '@/features/clientes/NuevoClienteModal'
import { escalonado, resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { ACCIONES_RAPIDAS } from './accionesRapidas'

/** Accesos directos en botones circulares tipo Centro de Control. */
export function CuadriculaAcciones({ onAccion, className, tamano = 'lg' }: { onAccion?: () => void; className?: string; tamano?: 'md' | 'lg' }) {
  const { puede } = useSesion()
  const navegar = useNavigate()
  const reducir = useReducedMotion()
  const [nuevoCliente, setNuevoCliente] = useState(false)
  const acciones = ACCIONES_RAPIDAS.filter((a) => !a.permiso || puede(a.permiso))

  return (
    <>
      <div className={cn('grid grid-cols-4 justify-items-center gap-x-2 gap-y-4', className)}>
        {acciones.map((a, i) => {
          const Icono = a.icono
          return (
            <motion.div
              key={a.id}
              className="flex w-full justify-center"
              initial={reducir ? false : { opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...resorte.agil, delay: reducir ? 0 : 0.12 + escalonado(i, 0.035) }}
            >
              <GlassIconButton
                etiqueta={a.etiqueta}
                mostrarEtiqueta
                icono={<Icono />}
                tamano={tamano}
                destacado={a.destacada}
                tono={a.tono}
                onClick={() => {
                  if (a.destino === 'nuevo-cliente') {
                    setNuevoCliente(true)
                    return
                  }
                  onAccion?.()
                  navegar(a.destino)
                }}
              />
            </motion.div>
          )
        })}
      </div>
      <NuevoClienteModal
        abierto={nuevoCliente}
        onCambio={(v) => {
          setNuevoCliente(v)
          if (!v) onAccion?.()
        }}
      />
    </>
  )
}
