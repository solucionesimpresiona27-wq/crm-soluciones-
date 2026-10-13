import { readFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { USUARIOS, type Rol } from './ayuda'

/**
 * Datos de prueba creados por API (como lo haría la app) en Supabase LOCAL.
 * Cada prueba crea lo suyo con un sufijo único para no depender de otras.
 */
function variables() {
  const env: Record<string, string> = { ...process.env } as Record<string, string>
  try {
    for (const linea of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !env[m[1]]) env[m[1]] = m[2]
    }
  } catch {
    /* sin .env.local: se usan las variables del entorno */
  }
  const url = env.VITE_SUPABASE_URL
  const anon = env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (.env.local)')
  if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error('Las pruebas e2e solo corren contra Supabase local')
  return { url, anon }
}

export async function clienteComo(rol: Rol): Promise<SupabaseClient> {
  const { url, anon } = variables()
  const c = createClient(url, anon, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email: USUARIOS[rol].email, password: USUARIOS[rol].password })
  if (error) throw error
  return c
}

const ok = <T>(r: { data: T; error: unknown }) => {
  if (r.error) throw r.error
  return r.data
}

export const sufijo = () => Math.random().toString(36).slice(2, 7).toUpperCase()

export interface CotizacionPrueba {
  id: string
  folio: string
  cliente: string
  titulo: string
}

/** Crea un cliente y una cotización en borrador con dos conceptos (lona por m² e instalación). */
export async function crearCotizacion(rol: Rol, opciones: { conCostos?: boolean; estado?: 'borrador' | 'enviada' } = {}): Promise<CotizacionPrueba> {
  const db = await clienteComo(rol)
  const marca = sufijo()
  const cliente = `Cliente E2E ${marca}`
  const titulo = `Lona de prueba ${marca}`
  const { id: clienteId } = ok(await db.from('clientes').insert({ nombre: cliente, whatsapp: '3312345678' }).select('id').single()) as { id: string }
  const costos = opciones.conCostos ? { costo_material: 20, costo_mano_obra: 10, costo_fijo: 0, desperdicio_pct: 10, ganancia_pct: 0 } : undefined
  const guardada = ok(
    await db.rpc('guardar_cotizacion', {
      p_datos: {
        cliente_id: clienteId,
        titulo,
        partidas: [
          { concepto: 'Lona impresa 13 oz', metodo_calculo: 'm2', unidad: 'pza', ancho: 3, alto: 1, cantidad: 2, precio_unitario: 180, costos },
          { tipo: 'instalacion', concepto: 'Instalación en sitio', metodo_calculo: 'servicio', unidad: 'servicio', cantidad: 1, precio_unitario: 600 },
        ],
      },
    }),
  ) as { id: string; folio: string }
  if (opciones.estado === 'enviada') ok(await db.from('cotizaciones').update({ estado: 'enviada' }).eq('id', guardada.id))
  return { id: guardada.id, folio: guardada.folio, cliente, titulo }
}
