import { ArrowLeft, Eye, EyeOff, Hammer, KeyRound, Lock, Mail, Palette, ShieldCheck, TrendingUp } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSesion } from '@/app/sesion'
import { Campo, GlassButton, GlassIconButton, GlassInput, GlassPanel, LightField } from '@/components/glass'
import { BotonTema } from '@/components/shell/BotonTema'
import { Marca } from '@/components/shell/Marca'
import { api } from '@/data/api'
import type { Rol } from '@/data/tipos'
import { NOMBRE_ROL } from '@/lib/permisos'
import { resorte } from '@/lib/motion'
import { AVISO_DEMO, DEMO } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { BulboCristal } from './BulboCristal'

const rolesDemo: Array<{ rol: Rol; icono: typeof ShieldCheck; detalle: string }> = [
  { rol: 'admin', icono: ShieldCheck, detalle: 'Ve todo: ventas, costos, utilidades y reportes' },
  { rol: 'ventas', icono: TrendingUp, detalle: 'Cotiza y da seguimiento; sin costos ni utilidades' },
  { rol: 'diseno', icono: Palette, detalle: 'Diseños, versiones y aprobaciones' },
  { rol: 'produccion', icono: Hammer, detalle: 'Órdenes de trabajo sin precios' },
]

export default function LoginPage() {
  const { sesion, cargando, recargar } = useSesion()
  const ubicacion = useLocation()
  const reducir = useReducedMotion()
  const [modo, setModo] = useState<'entrar' | 'recuperar'>('entrar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [ver, setVer] = useState(false)
  const [rol, setRol] = useState<Rol>('admin')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const destino = (ubicacion.state as { desde?: string } | null)?.desde ?? '/'
  if (!cargando && sesion) return <Navigate to={destino} replace />

  const entrar = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      if (DEMO) {
        await api.sesion.iniciarDemo?.(rol)
      } else {
        if (!email.trim() || !password) throw new Error('Escribe tu correo y contraseña')
        await api.sesion.iniciar(email, password)
      }
      // Al cargar la sesión, el <Navigate> de arriba lleva a `destino`. No se navega aquí también:
      // la sesión puede llegar antes por alCambiar y esta segunda navegación pisaría la del usuario.
      await recargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión')
    } finally {
      setEnviando(false)
    }
  }

  const recuperar = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setAviso(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Escribe el correo con el que entras al CRM')
      return
    }
    setEnviando(true)
    try {
      await api.sesion.recuperar(email)
      setAviso('Si el correo está registrado, recibirás un enlace para crear una contraseña nueva.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el correo')
    } finally {
      setEnviando(false)
    }
  }

  const aparecer = (retraso: number) =>
    reducir
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { ...resorte.suave, delay: retraso },
        }

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <LightField vivo escena="acceso" />

      <div className="absolute right-4 top-4 z-10">
        <BotonTema />
      </div>

      <div className="mx-auto grid min-h-dvh w-full max-w-6xl items-center gap-6 px-4 py-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-10">
        {/* Foco de cristal y mensaje */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <BulboCristal className="w-28 sm:w-36 lg:w-60 xl:w-72" />
          <motion.h1
            {...aparecer(0.7)}
            className="mt-6 max-w-md text-2xl font-semibold tracking-tight text-fg sm:text-3xl lg:mt-10 lg:text-[2.75rem] lg:leading-[1.08]"
          >
            Cada idea, de la cotización a la instalación.
          </motion.h1>
          <motion.p {...aparecer(0.8)} className="mt-3 hidden max-w-sm text-md text-fg-muted lg:block">
            Clientes, cotizaciones, producción y cobranza de Soluciones Impresiona en un solo lugar.
          </motion.p>
        </div>

        {/* Tarjeta de acceso */}
        <motion.div
          initial={reducir ? false : { opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', visualDuration: 0.7, bounce: 0.18, delay: reducir ? 0 : 0.95 }}
          className="w-full max-w-md justify-self-center lg:justify-self-end"
        >
          <GlassPanel className="p-6 shadow-glass-lg sm:p-8">
            <Marca className="h-11 w-auto" />

            <AnimatePresence mode="wait" initial={false}>
              {modo === 'entrar' ? (
                <motion.form
                  key="entrar"
                  onSubmit={entrar}
                  initial={reducir ? false : { opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reducir ? undefined : { opacity: 0, x: -16 }}
                  transition={resorte.agil}
                  className="mt-7 flex flex-col gap-4"
                  noValidate
                >
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-fg">Inicia sesión</h2>
                    <p className="mt-1 text-sm text-fg-muted">
                      {DEMO ? `${AVISO_DEMO}: elige con qué rol quieres recorrerla.` : 'Usa el correo y la contraseña que te dio el administrador.'}
                    </p>
                  </div>

                  {DEMO ? (
                    <div role="radiogroup" aria-label="Rol de ejemplo" className="grid gap-2">
                      {rolesDemo.map((r) => {
                        const Icono = r.icono
                        const activo = rol === r.rol
                        return (
                          <motion.button
                            key={r.rol}
                            type="button"
                            role="radio"
                            aria-checked={activo}
                            onClick={() => setRol(r.rol)}
                            whileTap={reducir ? undefined : { scale: 0.98 }}
                            transition={resorte.presion}
                            className={cn(
                              'flex items-center gap-3 rounded-full p-1.5 pr-4 text-left outline-none transition-colors duration-200',
                              activo ? 'bg-[var(--control-bg-hover)] shadow-[inset_0_0_0_1.5px_rgb(var(--accent)/0.45)]' : 'hover:bg-[var(--control-bg)]',
                            )}
                          >
                            <span
                              className={cn(
                                'grid size-10 shrink-0 place-items-center rounded-full transition-colors duration-300',
                                activo ? 'bg-luz text-luz-fg shadow-[0_6px_18px_-6px_rgba(249,194,6,0.8)]' : 'bg-[var(--control-bg)] text-fg-muted',
                              )}
                            >
                              <Icono className="size-[1.15rem]" aria-hidden />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-fg">{NOMBRE_ROL[r.rol]}</span>
                              <span className="block truncate text-xs text-fg-muted">{r.detalle}</span>
                            </span>
                          </motion.button>
                        )
                      })}
                    </div>
                  ) : (
                    <>
                      <Campo etiqueta="Correo">
                        {(id, a) => (
                          <GlassInput
                            id={id}
                            {...a}
                            type="email"
                            autoComplete="username"
                            inputMode="email"
                            icono={<Mail />}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="nombre@correo.com"
                            autoFocus
                          />
                        )}
                      </Campo>
                      <Campo etiqueta="Contraseña">
                        {(id, a) => (
                          <div className="relative">
                            <GlassInput
                              id={id}
                              {...a}
                              type={ver ? 'text' : 'password'}
                              autoComplete="current-password"
                              icono={<Lock />}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="pr-12"
                            />
                            <button
                              type="button"
                              onClick={() => setVer((v) => !v)}
                              aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                              className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-fg-subtle outline-none transition-colors hover:bg-[var(--control-bg)] hover:text-fg"
                            >
                              {ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                          </div>
                        )}
                      </Campo>
                    </>
                  )}

                  <AnimatePresence>
                    {error ? (
                      <motion.p
                        role="alert"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="rounded-control bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger"
                      >
                        {error}
                      </motion.p>
                    ) : null}
                  </AnimatePresence>

                  <GlassButton type="submit" variante="primario" tamano="lg" cargando={enviando} className="mt-1 w-full">
                    {DEMO ? 'Entrar a la vista previa' : 'Entrar'}
                  </GlassButton>

                  {!DEMO ? (
                    <button
                      type="button"
                      onClick={() => {
                        setModo('recuperar')
                        setError(null)
                      }}
                      className="self-center rounded-full px-3 py-1.5 text-sm font-medium text-fg-muted outline-none transition-colors hover:text-fg"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  ) : null}
                </motion.form>
              ) : (
                <motion.form
                  key="recuperar"
                  onSubmit={recuperar}
                  initial={reducir ? false : { opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reducir ? undefined : { opacity: 0, x: 16 }}
                  transition={resorte.agil}
                  className="mt-7 flex flex-col gap-4"
                  noValidate
                >
                  <div className="flex items-start gap-3">
                    <GlassIconButton etiqueta="Volver" icono={<ArrowLeft />} tamano="sm" onClick={() => { setModo('entrar'); setError(null); setAviso(null) }} />
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight text-fg">Recupera tu acceso</h2>
                      <p className="mt-1 text-sm text-fg-muted">Te enviaremos un enlace para crear una contraseña nueva.</p>
                    </div>
                  </div>
                  <Campo etiqueta="Correo" error={error}>
                    {(id, a) => (
                      <GlassInput id={id} {...a} type="email" autoComplete="username" icono={<Mail />} value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
                    )}
                  </Campo>
                  {aviso ? (
                    <p role="status" className="rounded-control bg-success-soft px-3.5 py-2.5 text-sm font-medium text-success">
                      {aviso}
                    </p>
                  ) : null}
                  <GlassButton type="submit" variante="primario" tamano="lg" icono={<KeyRound />} cargando={enviando} className="w-full">
                    Enviar enlace
                  </GlassButton>
                </motion.form>
              )}
            </AnimatePresence>
          </GlassPanel>
          <p className="mt-5 text-center text-xs text-fg-subtle">Soluciones Impresiona · Guadalajara, Jalisco</p>
        </motion.div>
      </div>
    </div>
  )
}
