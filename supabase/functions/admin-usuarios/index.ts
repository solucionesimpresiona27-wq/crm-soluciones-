// Función de Supabase (Edge Function): administración de usuarios del CRM.
//
// Solo un administrador activo puede usarla. La llave secreta de Supabase vive en
// el servidor (variable SUPABASE_SERVICE_ROLE_KEY) y nunca llega al navegador.
//
// Acciones (POST JSON):
//   { accion: "crear", email, password, nombre, rol, telefono?, puesto? }
//   { accion: "restablecer_password", id, password }
//   { accion: "activar", id }  |  { accion: "desactivar", id }
//   { accion: "cambiar_email", id, email }
import { createClient } from 'npm:@supabase/supabase-js@2'

const ROLES = ['admin', 'ventas', 'diseno', 'produccion'] as const
const ORIGEN = Deno.env.get('CRM_ORIGEN_PERMITIDO') ?? '*'

const cors = {
  'Access-Control-Allow-Origin': ORIGEN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
}

function respuesta(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function error(mensaje: string, status = 400) {
  return respuesta({ error: mensaje }, status)
}

function passwordValida(p: unknown): p is string {
  return typeof p === 'string' && p.length >= 8 && /[a-zA-Z]/.test(p) && /\d/.test(p)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return error('Método no permitido', 405)

  const url = Deno.env.get('SUPABASE_URL')
  const llaveServicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !llaveServicio) return error('La función no está configurada', 500)

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return error('Sesión requerida', 401)

  const sistema = createClient(url, llaveServicio, { auth: { persistSession: false, autoRefreshToken: false } })

  // Verifica quién llama y que sea administrador activo
  const { data: usuario, error: errUsuario } = await sistema.auth.getUser(token)
  if (errUsuario || !usuario?.user) return error('Sesión inválida', 401)

  const { data: perfil } = await sistema
    .from('perfiles')
    .select('rol, activo')
    .eq('id', usuario.user.id)
    .maybeSingle()
  if (!perfil || perfil.rol !== 'admin' || !perfil.activo) {
    return error('Solo un administrador puede administrar usuarios', 403)
  }

  let cuerpo: Record<string, unknown>
  try {
    cuerpo = await req.json()
  } catch {
    return error('Solicitud inválida')
  }

  const accion = cuerpo.accion

  if (accion === 'crear') {
    const email = String(cuerpo.email ?? '').trim().toLowerCase()
    const nombre = String(cuerpo.nombre ?? '').trim()
    const rol = String(cuerpo.rol ?? 'ventas')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error('Correo inválido')
    if (!nombre) return error('Escribe el nombre')
    if (!ROLES.includes(rol as (typeof ROLES)[number])) return error('Rol inválido')
    if (!passwordValida(cuerpo.password)) {
      return error('La contraseña debe tener al menos 8 caracteres, con letras y números')
    }

    const { data, error: err } = await sistema.auth.admin.createUser({
      email,
      password: cuerpo.password,
      email_confirm: true,
      app_metadata: { rol, activo: true, nombre },
      user_metadata: { nombre },
    })
    if (err) {
      const yaExiste = /already|registered|exists/i.test(err.message)
      return error(yaExiste ? 'Ya existe un usuario con ese correo' : err.message)
    }

    // El perfil lo crea la base de datos; se completan datos opcionales.
    await sistema
      .from('perfiles')
      .update({
        nombre,
        rol,
        activo: true,
        telefono: cuerpo.telefono ? String(cuerpo.telefono) : null,
        puesto: cuerpo.puesto ? String(cuerpo.puesto) : null,
      })
      .eq('id', data.user.id)

    return respuesta({ id: data.user.id })
  }

  const id = String(cuerpo.id ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) return error('Usuario inválido')

  if (accion === 'restablecer_password') {
    if (!passwordValida(cuerpo.password)) {
      return error('La contraseña debe tener al menos 8 caracteres, con letras y números')
    }
    const { error: err } = await sistema.auth.admin.updateUserById(id, { password: cuerpo.password })
    if (err) return error(err.message)
    return respuesta({ ok: true })
  }

  if (accion === 'activar' || accion === 'desactivar') {
    const activar = accion === 'activar'
    if (!activar && id === usuario.user.id) return error('No puedes desactivar tu propia cuenta')

    // Primero el perfil: la base de datos impide quedarse sin administradores.
    const { error: errPerfil } = await sistema.from('perfiles').update({ activo: activar }).eq('id', id)
    if (errPerfil) return error(errPerfil.message)

    const { error: err } = await sistema.auth.admin.updateUserById(id, {
      ban_duration: activar ? 'none' : '876000h',
    })
    if (err) return error(err.message)
    return respuesta({ ok: true })
  }

  if (accion === 'cambiar_email') {
    const email = String(cuerpo.email ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error('Correo inválido')
    const { error: err } = await sistema.auth.admin.updateUserById(id, { email, email_confirm: true })
    if (err) return error(err.message)
    return respuesta({ ok: true })
  }

  return error('Acción no reconocida')
})
