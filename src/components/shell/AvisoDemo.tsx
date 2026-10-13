import { FlaskConical } from 'lucide-react'
import { AVISO_DEMO, DEMO } from '@/lib/supabase'

/** Aviso permanente de vista previa: los datos son ficticios y nada se guarda. */
export function AvisoDemo() {
  if (!DEMO) return null
  return (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-[calc(5.75rem+var(--safe-bottom))] z-[25] flex justify-center md:inset-x-auto md:bottom-4 md:right-4">
      <div className="glass glass-on-luz flex items-center gap-2 rounded-full px-3 py-1 text-2xs font-bold shadow-[0_8px_24px_-8px_rgba(249,194,6,0.7)] md:px-3.5 md:py-1.5 md:text-xs">
        <FlaskConical className="size-3.5" aria-hidden />
        {AVISO_DEMO} · nada se guarda
      </div>
    </div>
  )
}
