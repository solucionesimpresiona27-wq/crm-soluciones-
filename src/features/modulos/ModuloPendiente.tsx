import { ArrowLeft, Check, Sparkles } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { EstadoVacio, GlassButton, GlassPanel } from '@/components/glass'
import { moduloDeRuta } from '@/components/shell/usarModulos'

/**
 * Módulos que se construyen después de aprobar el diseño.
 * Muestra con honestidad qué incluirá, sin simular funciones.
 */
export default function ModuloPendiente() {
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const m = moduloDeRuta(pathname)
  if (!m) return null
  const Icono = m.icono

  return (
    <GlassPanel className="mx-auto mt-2 max-w-2xl p-2">
      <EstadoVacio
        icono={<Icono />}
        titulo={`${m.titulo}: siguiente fase`}
        descripcion="La base de datos de este módulo ya está lista. Su pantalla se construye con este mismo diseño en cuanto lo apruebes."
        accion={
          <GlassButton variante="cristal" icono={<ArrowLeft />} onClick={() => navegar(-1)}>
            Volver
          </GlassButton>
        }
      />
      {m.incluye?.length ? (
        <div className="mx-4 mb-4 rounded-module bg-[var(--control-bg)] p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
            <Sparkles className="size-4 text-amber-500" aria-hidden />
            Qué incluirá
          </p>
          <ul className="grid gap-2 text-sm text-fg-muted">
            {m.incluye.map((x) => (
              <li key={x} className="flex gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                {x}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </GlassPanel>
  )
}
