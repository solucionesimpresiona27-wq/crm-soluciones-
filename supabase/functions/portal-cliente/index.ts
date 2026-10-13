// Función de Supabase (Edge Function): archivos de diseño para el portal del cliente.
//
// El cliente no tiene cuenta: se identifica con el token secreto de su enlace.
// La función valida el token en la base de datos (portal_archivos_firmables, que solo
// puede usar la llave de servicio) y devuelve URL firmadas de corta duración, solo de
// los diseños del pedido de ESE enlace. La llave secreta vive en el servidor
// (variable SUPABASE_SERVICE_ROLE_KEY) y nunca llega al navegador.
//
// Se despliega con "Verify JWT" desactivado (el cliente no inicia sesión).
//
// POST JSON: { token: string, archivo_id?: string }
// Respuesta: { archivos: [{ id, nombre, version, mime, url, expira_en }] }
import { createClient } from 'npm:@supabase/supabase-js@2'

const ORIGEN = Deno.env.get('CRM_ORIGEN_PERMITIDO') ?? '*'
const BUCKET = 'archivos'
const DURACION_SEGUNDOS = 600
// Una solicitud válida ocupa menos de 200 bytes ({token, archivo_id}).
const MAX_BYTES = 2048

const cors = {
  'Access-Control-Allow-Origin': ORIGEN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
}

function respuesta(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

// El mismo mensaje para token inventado, vencido o revocado: no revela si existe.
const NO_VALIDO = 'Este enlace no es válido o ya venció. Pide uno nuevo a tu asesor.'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TOKEN = /^[A-Za-z0-9_-]{32,128}$/

// Lee el cuerpo sin pasar de MAX_BYTES: un cuerpo enorme (o que anuncia un tamaño enorme y
// nunca llega) se rechaza sin guardarlo en memoria ni esperarlo. null = demasiado grande.
async function leerCuerpo(req: Request): Promise<string | null> {
  const declarado = Number(req.headers.get('content-length') ?? '0')
  if (declarado > MAX_BYTES) return null
  if (!req.body) return ''
  const lector = req.body.getReader()
  const partes: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await lector.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BYTES) {
      await lector.cancel().catch(() => {})
      return null
    }
    partes.push(value)
  }
  const bytes = new Uint8Array(total)
  let pos = 0
  for (const parte of partes) {
    bytes.set(parte, pos)
    pos += parte.byteLength
  }
  return new TextDecoder().decode(bytes)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return respuesta({ error: 'Método no permitido' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const llaveServicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !llaveServicio) return respuesta({ error: 'La función no está configurada' }, 500)

  let cuerpo: Record<string, unknown>
  try {
    const texto = await leerCuerpo(req)
    if (texto === null) return respuesta({ error: 'Solicitud demasiado grande' }, 413)
    cuerpo = JSON.parse(texto)
    if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) throw new Error('cuerpo')
  } catch {
    return respuesta({ error: 'Solicitud inválida' }, 400)
  }

  const token = typeof cuerpo.token === 'string' ? cuerpo.token : ''
  if (!TOKEN.test(token)) return respuesta({ error: NO_VALIDO }, 404)

  const archivoId = cuerpo.archivo_id
  if (archivoId != null && (typeof archivoId !== 'string' || !UUID.test(archivoId))) {
    return respuesta({ error: 'Solicitud inválida' }, 400)
  }

  const sistema = createClient(url, llaveServicio, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: archivos, error } = await sistema.rpc('portal_archivos_firmables', {
    p_token: token,
    p_archivo_id: archivoId ?? null,
  })
  if (error) {
    // PT404: token inválido, vencido o revocado
    if (error.code === 'PT404') return respuesta({ error: NO_VALIDO }, 404)
    console.error('portal_archivos_firmables', error.code, error.message)
    return respuesta({ error: 'No se pudieron consultar los archivos. Intenta de nuevo en unos minutos.' }, 500)
  }

  const filas = (archivos ?? []) as Array<{ id: string; nombre: string; path: string; mime: string | null; version: number | null }>
  if (filas.length === 0) return respuesta({ archivos: [] })

  const { data: firmadas, error: errFirma } = await sistema.storage
    .from(BUCKET)
    .createSignedUrls(filas.map((f) => f.path), DURACION_SEGUNDOS)
  if (errFirma) {
    console.error('createSignedUrls', errFirma.message)
    return respuesta({ error: 'No se pudieron preparar los archivos. Intenta de nuevo en unos minutos.' }, 500)
  }

  const porRuta = new Map((firmadas ?? []).map((f) => [f.path, f.signedUrl]))
  return respuesta({
    archivos: filas
      .map((f) => ({
        id: f.id,
        nombre: f.nombre,
        version: f.version,
        mime: f.mime,
        url: porRuta.get(f.path) ?? null,
        expira_en: DURACION_SEGUNDOS,
      }))
      .filter((f) => f.url),
  })
})
