import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/** Vista previa con datos ficticios: no se conecta a Supabase ni escribe datos reales. */
export const DEMO = import.meta.env.VITE_DEMO === 'true'

let cliente: SupabaseClient<Database> | null = null

export function supabase(): SupabaseClient<Database> {
  if (DEMO) throw new Error('Supabase no se usa en la vista previa')
  if (cliente) return cliente
  const url = import.meta.env.VITE_SUPABASE_URL
  const llave = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !llave) {
    throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. Revisa el archivo .env.local.')
  }
  cliente = createClient<Database>(url, llave, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  return cliente
}
