import { KeyRound, Lock } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Campo, GlassButton, GlassInput, GlassPanel, LightField } from '@/components/glass'
import { Marca } from '@/components/shell/Marca'
import { api } from '@/data/api'

/** Pantalla a la que llega el enlace de recuperación de contraseña. */
export default function NuevaContrasenaPage() {
  const navegar = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      setError('Usa al menos 8 caracteres, con letras y números')
      return
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }
    setEnviando(true)
    try {
      await api.sesion.nuevaContrasena(password)
      toast.success('Contraseña actualizada')
      navegar('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la contraseña')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <LightField vivo escena="acceso" />
      <GlassPanel className="w-full max-w-md p-8 shadow-glass-lg">
        <Marca className="h-11 w-auto" />
        <form onSubmit={guardar} className="mt-7 flex flex-col gap-4" noValidate>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-fg">Crea tu contraseña nueva</h1>
            <p className="mt-1 text-sm text-fg-muted">Al menos 8 caracteres, con letras y números.</p>
          </div>
          <Campo etiqueta="Contraseña nueva">
            {(id, a) => <GlassInput id={id} {...a} type="password" autoComplete="new-password" icono={<Lock />} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />}
          </Campo>
          <Campo etiqueta="Confirma la contraseña" error={error}>
            {(id, a) => <GlassInput id={id} {...a} type="password" autoComplete="new-password" icono={<Lock />} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />}
          </Campo>
          <GlassButton type="submit" variante="primario" tamano="lg" icono={<KeyRound />} cargando={enviando} className="w-full">
            Guardar contraseña
          </GlassButton>
        </form>
      </GlassPanel>
    </div>
  )
}
