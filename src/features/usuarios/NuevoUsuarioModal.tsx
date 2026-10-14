import { RefreshCw, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Campo, GlassButton, GlassIconButton, GlassInput, GlassModal, GlassSelect } from '@/components/glass'
import { api } from '@/data/api'
import type { NuevoUsuario } from '@/data/modulos/administracion/contrato'
import type { Rol } from '@/data/tipos'
import { NOMBRE_ROL } from '@/lib/permisos'
import { useMutacionUsuarios } from './consultas'
import { ContrasenaUnaVez } from './piezas'
import { ROLES, contrasenaValida, correoValido, generarContrasena } from './util'

const vacio = (): NuevoUsuario => ({ email: '', nombre: '', rol: 'ventas', password: generarContrasena(), telefono: '', puesto: '' })

/** Alta de usuario (función admin-usuarios). Al terminar muestra la contraseña una sola vez. */
export function NuevoUsuarioModal({ abierto, onCambio }: { abierto: boolean; onCambio: (v: boolean) => void }) {
  const [datos, setDatos] = useState<NuevoUsuario>(vacio)
  const [creado, setCreado] = useState<NuevoUsuario | null>(null)
  const [intento, setIntento] = useState(false)
  const crear = useMutacionUsuarios((d: NuevoUsuario) => api.usuarios.crear(d))

  const errores = {
    nombre: !datos.nombre.trim() ? 'Escribe el nombre' : null,
    email: !correoValido(datos.email) ? 'Escribe un correo válido, p. ej. nombre@empresa.com' : null,
    password: !contrasenaValida(datos.password) ? 'Usa al menos 8 caracteres, con letras y números' : null,
  }
  const valido = !errores.nombre && !errores.email && !errores.password
  const poner = <K extends keyof NuevoUsuario>(k: K, v: NuevoUsuario[K]) => setDatos((d) => ({ ...d, [k]: v }))

  const cerrar = (v: boolean) => {
    onCambio(v)
    if (!v) {
      setTimeout(() => {
        setDatos(vacio())
        setCreado(null)
        setIntento(false)
        crear.reset()
      }, 250)
    }
  }

  const enviar = () => {
    setIntento(true)
    if (!valido) return
    crear.mutate(datos, {
      onSuccess: () => {
        toast.success(`${datos.nombre.trim()} ya puede entrar al CRM`)
        setCreado(datos)
      },
      onError: (e) => toast.error(e.message),
    })
  }

  return (
    <GlassModal
      abierto={abierto}
      onCambio={cerrar}
      titulo={creado ? 'Usuario creado' : 'Agregar usuario'}
      descripcion={creado ? `Comparte estos datos con ${creado.nombre.trim()}.` : 'Entrará con su correo y una contraseña temporal.'}
      ancho="md"
      pie={
        creado ? (
          <GlassButton variante="primario" onClick={() => cerrar(false)}>
            Listo
          </GlassButton>
        ) : (
          <>
            <GlassButton variante="fantasma" onClick={() => cerrar(false)}>
              Cancelar
            </GlassButton>
            <GlassButton variante="primario" icono={<UserPlus />} cargando={crear.isPending} onClick={enviar}>
              Crear usuario
            </GlassButton>
          </>
        )
      }
    >
      {creado ? (
        <ContrasenaUnaVez nombre={creado.nombre} email={creado.email.trim().toLowerCase()} password={creado.password} telefono={creado.telefono} />
      ) : (
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            enviar()
          }}
        >
          <Campo etiqueta="Nombre" error={intento ? errores.nombre : null} className="sm:col-span-2">
            {(id, p) => <GlassInput id={id} {...p} autoFocus autoComplete="off" value={datos.nombre} onChange={(e) => poner('nombre', e.target.value)} />}
          </Campo>
          <Campo etiqueta="Correo" error={intento ? errores.email : null} className="sm:col-span-2">
            {(id, p) => <GlassInput id={id} {...p} type="email" autoComplete="off" inputMode="email" value={datos.email} onChange={(e) => poner('email', e.target.value)} />}
          </Campo>
          <Campo etiqueta="Rol">
            {(id) => (
              <GlassSelect id={id} value={datos.rol} onChange={(e) => poner('rol', e.target.value as Rol)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {NOMBRE_ROL[r]}
                  </option>
                ))}
              </GlassSelect>
            )}
          </Campo>
          <Campo etiqueta="WhatsApp" opcional ayuda="Para enviarle su acceso">
            {(id, p) => <GlassInput id={id} {...p} type="tel" inputMode="tel" value={datos.telefono ?? ''} onChange={(e) => poner('telefono', e.target.value)} />}
          </Campo>
          <Campo etiqueta="Puesto" opcional>
            {(id, p) => <GlassInput id={id} {...p} value={datos.puesto ?? ''} onChange={(e) => poner('puesto', e.target.value)} />}
          </Campo>
          <Campo etiqueta="Contraseña temporal" error={intento ? errores.password : null}>
            {(id, p) => (
              <div className="flex items-center gap-2">
                <GlassInput id={id} {...p} className="num font-mono" autoComplete="new-password" value={datos.password} onChange={(e) => poner('password', e.target.value)} />
                <GlassIconButton icono={<RefreshCw />} etiqueta="Generar otra contraseña" tamano="sm" onClick={() => poner('password', generarContrasena())} />
              </div>
            )}
          </Campo>
          <button type="submit" hidden />
        </form>
      )}
    </GlassModal>
  )
}
