import { Check, Copy, KeyRound, Lock, MessageCircle } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useConfiguracion } from '@/app/consultas'
import { EstadoVacio, GlassButton, GlassPanel, GlassSurface, Pildora, type TonoPildora } from '@/components/glass'
import type { Rol } from '@/data/tipos'
import { resorte } from '@/lib/motion'
import { NOMBRE_ROL } from '@/lib/permisos'
import { cn, iniciales } from '@/lib/utils'
import { enlaceWhatsApp, telefonoWhatsApp } from '@/lib/whatsapp'

const TONO_ROL: Record<Rol, TonoPildora> = { admin: 'acento', ventas: 'neutro', diseno: 'neutro', produccion: 'neutro' }

export function RolPildora({ rol }: { rol: Rol }) {
  return <Pildora tono={TONO_ROL[rol]}>{NOMBRE_ROL[rol]}</Pildora>
}

/** Avatar con iniciales; el inactivo se ve apagado. */
export function AvatarUsuario({ nombre, activo = true, tamano = 'md' }: { nombre: string; activo?: boolean; tamano?: 'md' | 'lg' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-bold tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_16px_-8px_rgba(34,66,107,0.7)]',
        activo ? 'bg-gradient-to-br from-navy-500 to-navy-700 text-white' : 'bg-fg/10 text-fg-subtle',
        tamano === 'lg' ? 'size-16 text-xl' : 'size-12 text-sm',
      )}
    >
      {iniciales(nombre) || '·'}
    </span>
  )
}

/**
 * Interruptor compacto (role="switch") para la matriz de permisos.
 * Área táctil de 44 px aunque la pista mida menos.
 */
export function Interruptor({ activo, onCambio, etiqueta, disabled }: { activo: boolean; onCambio: (v: boolean) => void; etiqueta: string; disabled?: boolean }) {
  const reducir = useReducedMotion()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      disabled={disabled}
      onClick={() => onCambio(!activo)}
      className="group grid h-11 w-14 shrink-0 place-items-center rounded-full outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        className={cn(
          'relative flex h-7 w-12 items-center rounded-full p-0.5 shadow-[inset_0_1px_3px_rgba(14,28,48,0.18)] transition-colors duration-200 group-focus-visible:ring-2 group-focus-visible:ring-accent group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-transparent',
          activo ? 'bg-accent' : 'bg-fg/15',
        )}
      >
        <motion.span
          className="block size-6 rounded-full bg-white shadow-[0_2px_6px_rgba(14,28,48,0.3)]"
          animate={{ x: activo ? 20 : 0 }}
          transition={reducir ? { duration: 0 } : resorte.agil}
        />
      </span>
    </button>
  )
}

/**
 * Contraseña recién creada: se muestra UNA vez, con copiar y enviar por WhatsApp.
 */
export function ContrasenaUnaVez({ nombre, email, password, telefono }: { nombre: string; email: string; password: string; telefono?: string | null }) {
  const config = useConfiguracion()
  const [copiada, setCopiada] = useState(false)
  const empresa = config.data?.nombre_comercial ?? 'el CRM'
  const enlace = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : ''
  const texto = `Hola ${nombre.split(' ')[0]}, ya tienes acceso al CRM de ${empresa}.\n\nEntra en: ${enlace}\nCorreo: ${email}\nContraseña temporal: ${password}\n\nTe recomendamos cambiarla al entrar.`

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(password)
      setCopiada(true)
      toast.success('Contraseña copiada')
      setTimeout(() => setCopiada(false), 2000)
    } catch {
      toast.error('No se pudo copiar. Selecciona la contraseña y cópiala a mano.')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <GlassSurface className="flex flex-col items-center gap-2 rounded-tile px-4 py-5 text-center">
        <span className="grid size-11 place-items-center rounded-full bg-luz text-luz-fg shadow-[0_6px_20px_-6px_rgba(249,194,6,0.75)] [&_svg]:size-5" aria-hidden>
          <KeyRound />
        </span>
        <p className="text-sm text-fg-muted">Contraseña temporal de {email}</p>
        <output aria-live="polite" className="num select-all break-all font-mono text-2xl font-semibold leading-tight tracking-wide text-fg">
          {password}
        </output>
        <p className="text-xs text-fg-subtle">Solo se muestra esta vez. Cópiala o envíala ahora.</p>
      </GlassSurface>
      <div className="flex flex-col gap-2 sm:flex-row">
        <GlassButton variante="primario" icono={copiada ? <Check /> : <Copy />} className="flex-1" onClick={() => void copiar()}>
          {copiada ? 'Copiada' : 'Copiar contraseña'}
        </GlassButton>
        <GlassButton
          variante="cristal"
          icono={<MessageCircle />}
          className="flex-1"
          onClick={() => window.open(enlaceWhatsApp(telefono, texto), '_blank', 'noopener')}
        >
          {telefonoWhatsApp(telefono) ? 'Enviar por WhatsApp' : 'Elegir contacto en WhatsApp'}
        </GlassButton>
      </div>
    </div>
  )
}

export function SinAccesoAdmin() {
  const navegar = useNavigate()
  return (
    <GlassPanel className="mt-2">
      <EstadoVacio
        icono={<Lock />}
        titulo="Esta sección es solo para administración"
        descripcion="Pide a un administrador que haga el cambio por ti."
        accion={
          <GlassButton variante="cristal" onClick={() => navegar('/')}>
            Ir al inicio
          </GlassButton>
        }
      />
    </GlassPanel>
  )
}
