import { KeyRound, Mail, Power, RotateCcw, Save } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useSesion } from '@/app/sesion'
import { Campo, GlassButton, GlassInput, GlassModal, GlassSelect, GlassSurface, Pildora, SegmentedControl } from '@/components/glass'
import { api } from '@/data/api'
import type { CambiosUsuario, Usuario } from '@/data/modulos/administracion/contrato'
import type { Permiso, Rol } from '@/data/tipos'
import { fecha, haceCuanto } from '@/lib/format'
import { DESCRIPCION_PERMISO, NOMBRE_ROL } from '@/lib/permisos'
import { cn } from '@/lib/utils'
import { useMutacionUsuarios } from './consultas'
import { AvatarUsuario, ContrasenaUnaVez, Interruptor, RolPildora } from './piezas'
import { GRUPOS_PERMISO, ROLES, contarAnulaciones, correoValido, estadoPermisos, generarContrasena } from './util'

type Pestana = 'datos' | 'permisos' | 'cuenta'

export function UsuarioModal({ usuario, onCerrar }: { usuario: Usuario | null; onCerrar: () => void }) {
  const [pestana, setPestana] = useState<Pestana>('datos')
  const [ultimo, setUltimo] = useState(usuario)
  useEffect(() => {
    if (usuario) setUltimo(usuario)
    else setTimeout(() => setPestana('datos'), 250)
  }, [usuario])
  const u = usuario ?? ultimo
  const anulaciones = u ? contarAnulaciones(u) : 0

  return (
    <GlassModal
      abierto={Boolean(usuario)}
      onCambio={(v) => (v ? null : onCerrar())}
      ancho="lg"
      titulo={
        u ? (
          <span className="flex items-center gap-3">
            <AvatarUsuario nombre={u.nombre} activo={u.activo} />
            <span className="min-w-0">
              <span className="block truncate">{u.nombre || u.email}</span>
              <span className="block truncate text-sm font-normal text-fg-muted">{u.email}</span>
            </span>
          </span>
        ) : (
          'Usuario'
        )
      }
    >
      {u ? (
        <div className="flex flex-col gap-4">
          <SegmentedControl
            etiqueta="Secciones del usuario"
            valor={pestana}
            onCambio={setPestana}
            className="w-full"
            segmentos={[
              { valor: 'datos', etiqueta: 'Datos y rol' },
              { valor: 'permisos', etiqueta: 'Permisos', conteo: anulaciones || undefined },
              { valor: 'cuenta', etiqueta: 'Cuenta' },
            ]}
          />
          {pestana === 'datos' ? <DatosUsuario key={u.id + u.updated_at} u={u} /> : pestana === 'permisos' ? <PermisosUsuario u={u} /> : <CuentaUsuario u={u} />}
        </div>
      ) : null}
    </GlassModal>
  )
}

function DatosUsuario({ u }: { u: Usuario }) {
  const { sesion } = useSesion()
  const [d, setD] = useState({ nombre: u.nombre, telefono: u.telefono ?? '', puesto: u.puesto ?? '', rol: u.rol, comision: String(Number(u.comision_pct)) })
  const guardar = useMutacionUsuarios((c: CambiosUsuario) => api.usuarios.actualizar(u.id, c))
  const comision = Number(d.comision)
  const errComision = d.comision.trim() === '' || Number.isNaN(comision) || comision < 0 || comision > 100 ? 'Escribe un porcentaje entre 0 y 100' : null
  const sucio = d.nombre !== u.nombre || d.telefono !== (u.telefono ?? '') || d.puesto !== (u.puesto ?? '') || d.rol !== u.rol || comision !== Number(u.comision_pct)
  const propio = sesion?.perfil.id === u.id

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!d.nombre.trim() || errComision) return
        guardar.mutate(
          { nombre: d.nombre, telefono: d.telefono, puesto: d.puesto, rol: d.rol, comision_pct: comision },
          { onSuccess: () => toast.success('Cambios guardados'), onError: (e) => toast.error(e.message) },
        )
      }}
    >
      <Campo etiqueta="Nombre" error={!d.nombre.trim() ? 'Escribe el nombre' : null} className="sm:col-span-2">
        {(id, p) => <GlassInput id={id} {...p} value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} />}
      </Campo>
      <Campo etiqueta="Rol" ayuda={propio && d.rol !== 'admin' ? 'Si dejas de ser administrador perderás el acceso a esta pantalla.' : 'Define los permisos de base.'}>
        {(id, p) => (
          <GlassSelect id={id} {...p} value={d.rol} onChange={(e) => setD({ ...d, rol: e.target.value as Rol })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {NOMBRE_ROL[r]}
              </option>
            ))}
          </GlassSelect>
        )}
      </Campo>
      <Campo etiqueta="Comisión" error={errComision} ayuda="Sobre lo cobrado sin IVA">
        {(id, p) => <GlassInput id={id} {...p} type="number" min={0} max={100} step={0.5} inputMode="decimal" className="num" sufijo="%" value={d.comision} onChange={(e) => setD({ ...d, comision: e.target.value })} />}
      </Campo>
      <Campo etiqueta="Teléfono / WhatsApp" opcional>
        {(id, p) => <GlassInput id={id} {...p} type="tel" inputMode="tel" value={d.telefono} onChange={(e) => setD({ ...d, telefono: e.target.value })} />}
      </Campo>
      <Campo etiqueta="Puesto" opcional>
        {(id, p) => <GlassInput id={id} {...p} value={d.puesto} onChange={(e) => setD({ ...d, puesto: e.target.value })} />}
      </Campo>
      <div className="flex items-center justify-end gap-2 sm:col-span-2">
        {sucio ? <span className="mr-auto text-sm text-fg-muted">Cambios sin guardar</span> : null}
        <GlassButton type="submit" variante="primario" icono={<Save />} disabled={!sucio} cargando={guardar.isPending}>
          Guardar cambios
        </GlassButton>
      </div>
    </form>
  )
}

function PermisosUsuario({ u }: { u: Usuario }) {
  const estados = useMemo(() => estadoPermisos(u), [u])
  const cambiar = useMutacionUsuarios((p: Partial<Record<Permiso, boolean | null>>) => api.usuarios.cambiarPermisos(u.id, p))
  const anulaciones = contarAnulaciones(u)
  const esAdmin = u.rol === 'admin'

  const poner = (permiso: Permiso, valor: boolean) => {
    // Si coincide con el rol, se borra la anulación
    const nuevo = valor === estados[permiso].delRol ? null : valor
    cambiar.mutate(
      { [permiso]: nuevo },
      {
        onSuccess: () => toast.success(`${DESCRIPCION_PERMISO[permiso]}: ${valor ? 'permitido' : 'quitado'}`, { description: 'Se aplica la próxima vez que recargue la página.' }),
        onError: (e) => toast.error(e.message),
      },
    )
  }

  const volver = () => {
    const todos = Object.fromEntries(Object.keys(u.permisos_personalizados).map((k) => [k, null])) as Partial<Record<Permiso, null>>
    cambiar.mutate(todos, { onSuccess: () => toast.success(`Permisos de ${NOMBRE_ROL[u.rol]} restablecidos`), onError: (e) => toast.error(e.message) })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm text-fg-muted">
          {esAdmin ? (
            'Administración tiene todos los permisos siempre.'
          ) : (
            <>
              Parte de los permisos de <RolPildora rol={u.rol} />. Lo que cambies aquí aplica solo a esta persona.
            </>
          )}
        </p>
        {!esAdmin && Object.keys(u.permisos_personalizados).length ? (
          <GlassButton variante="cristal" tamano="sm" icono={<RotateCcw />} className="pointer-coarse:h-11" onClick={volver} disabled={cambiar.isPending}>
            Volver a los del rol
          </GlassButton>
        ) : null}
      </div>
      {GRUPOS_PERMISO.map((g) => (
        <GlassSurface key={g.titulo} variante="fuerte" className="rounded-tile px-2 py-1.5">
          <h3 className="px-2 pb-0.5 pt-1.5 text-xs font-semibold uppercase tracking-wider text-fg-subtle">{g.titulo}</h3>
          <ul>
            {g.permisos.map((p) => {
              const e = estados[p]
              return (
                <li key={p} className="flex items-center gap-3 border-t border-[var(--divider)] px-2 py-1 first:border-t-0">
                  <div className="min-w-0 flex-1 py-1.5">
                    <p className="text-sm font-medium text-fg">{DESCRIPCION_PERMISO[p]}</p>
                    <p className="text-xs text-fg-subtle">
                      {esAdmin ? 'Incluido en administración' : `Rol: ${e.delRol ? 'sí' : 'no'}`}
                      {e.anulado ? <Pildora tono="luz" className="ml-2 align-middle">{e.efectivo ? 'Concedido a mano' : 'Quitado a mano'}</Pildora> : null}
                    </p>
                  </div>
                  <Interruptor activo={e.efectivo} disabled={esAdmin || cambiar.isPending} etiqueta={DESCRIPCION_PERMISO[p]} onCambio={(v) => poner(p, v)} />
                </li>
              )
            })}
          </ul>
        </GlassSurface>
      ))}
      {anulaciones ? <p className="px-1 text-xs text-fg-subtle">{anulaciones === 1 ? '1 permiso distinto al rol.' : `${anulaciones} permisos distintos al rol.`}</p> : null}
    </div>
  )
}

function CuentaUsuario({ u }: { u: Usuario }) {
  const { sesion } = useSesion()
  const propio = sesion?.perfil.id === u.id
  const [email, setEmail] = useState(u.email)
  const [nueva, setNueva] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const correo = useMutacionUsuarios((e: string) => api.usuarios.cambiarEmail(u.id, e))
  const contrasena = useMutacionUsuarios((p: string) => api.usuarios.restablecerContrasena(u.id, p))
  const activar = useMutacionUsuarios((v: boolean) => api.usuarios.activar(u.id, v))
  const errCorreo = !correoValido(email) ? 'Escribe un correo válido' : null

  return (
    <div className="flex flex-col gap-3">
      <GlassSurface variante="fuerte" className="grid grid-cols-2 gap-3 rounded-tile p-4 text-sm sm:grid-cols-3">
        <Dato titulo="Estado">{u.activo ? <Pildora tono="exito">Activo</Pildora> : <Pildora>Inactivo</Pildora>}</Dato>
        <Dato titulo="Último acceso">{u.ultimo_acceso ? haceCuanto(u.ultimo_acceso) : 'Nunca ha entrado'}</Dato>
        <Dato titulo="Alta">{fecha(u.created_at)}</Dato>
      </GlassSurface>

      <GlassSurface variante="fuerte" className="flex flex-col gap-3 rounded-tile p-4">
        <Campo etiqueta="Correo de acceso" error={email !== u.email ? errCorreo : null}>
          {(id, p) => (
            <div className="flex flex-col gap-2 sm:flex-row">
              <GlassInput id={id} {...p} type="email" icono={<Mail />} value={email} onChange={(e) => setEmail(e.target.value)} />
              <GlassButton
                variante="cristal"
                disabled={email.trim().toLowerCase() === u.email || Boolean(errCorreo)}
                cargando={correo.isPending}
                onClick={() => correo.mutate(email, { onSuccess: () => toast.success('Correo actualizado. Desde ahora entra con el nuevo.'), onError: (e) => toast.error(e.message) })}
              >
                Cambiar correo
              </GlassButton>
            </div>
          )}
        </Campo>
      </GlassSurface>

      <GlassSurface variante="fuerte" className="flex flex-col gap-3 rounded-tile p-4">
        {nueva ? (
          <ContrasenaUnaVez nombre={u.nombre} email={u.email} password={nueva} telefono={u.telefono} />
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="flex-1 text-sm text-fg-muted">
              <span className="font-semibold text-fg">Restablecer contraseña.</span> Se genera una temporal y la anterior deja de funcionar.
            </p>
            <GlassButton
              variante="cristal"
              icono={<KeyRound />}
              cargando={contrasena.isPending}
              onClick={() => {
                const p = generarContrasena()
                contrasena.mutate(p, { onSuccess: () => setNueva(p), onError: (e) => toast.error(e.message) })
              }}
            >
              Generar contraseña nueva
            </GlassButton>
          </div>
        )}
      </GlassSurface>

      <GlassSurface variante="fuerte" className={cn('flex flex-col gap-3 rounded-tile p-4 sm:flex-row sm:items-center')}>
        <p className="flex-1 text-sm text-fg-muted">
          {u.activo ? (
            <>
              <span className="font-semibold text-fg">Desactivar la cuenta.</span> No podrá entrar; su historial se conserva.
            </>
          ) : (
            <>
              <span className="font-semibold text-fg">Cuenta desactivada.</span> Actívala para que vuelva a entrar.
            </>
          )}
          {propio && u.activo ? <span className="mt-1 block text-xs">No puedes desactivar tu propia cuenta.</span> : null}
        </p>
        {confirmar ? (
          <div className="flex gap-2">
            <GlassButton variante="fantasma" onClick={() => setConfirmar(false)}>
              No
            </GlassButton>
            <GlassButton
              variante={u.activo ? 'peligro' : 'primario'}
              cargando={activar.isPending}
              onClick={() =>
                activar.mutate(!u.activo, {
                  onSuccess: () => toast.success(u.activo ? `${u.nombre} ya no puede entrar` : `${u.nombre} puede entrar de nuevo`),
                  onError: (e) => toast.error(e.message, { description: /administrador/i.test(e.message) ? 'Nombra a otra persona como administración antes de hacerlo.' : undefined }),
                  onSettled: () => setConfirmar(false),
                })
              }
            >
              {u.activo ? 'Sí, desactivar' : 'Sí, activar'}
            </GlassButton>
          </div>
        ) : (
          <GlassButton variante={u.activo ? 'peligro' : 'primario'} icono={<Power />} disabled={propio && u.activo} onClick={() => setConfirmar(true)}>
            {u.activo ? 'Desactivar cuenta' : 'Activar cuenta'}
          </GlassButton>
        )}
      </GlassSurface>
    </div>
  )
}

function Dato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-fg-subtle">{titulo}</span>
      <span className="text-fg">{children}</span>
    </div>
  )
}
