import { FlaskConical } from 'lucide-react'
import { DEMO } from '@/lib/supabase'
import { AVISO_DEMO } from '@/data/demo/datosDemo'

/** Aviso permanente de vista previa: los datos son ficticios y nada se guarda. */
export function AvisoDemo() {
  if (!DEMO) return null
  return (
    <div className="no-print pointer-events-none fixed left-1/2 top-[calc(0.5rem+env(safe-area-inset-top,0px))] z-[60] -translate-x-1/2">
      <div className="glass glass-on-luz flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold shadow-[0_8px_24px_-8px_rgba(249,194,6,0.7)]">
        <FlaskConical className="size-3.5" aria-hidden />
        {AVISO_DEMO} · nada se guarda
      </div>
    </div>
  )
}
