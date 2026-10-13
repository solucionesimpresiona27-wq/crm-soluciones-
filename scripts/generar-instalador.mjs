// Une las migraciones en un solo archivo para pegarlo en el Editor SQL de Supabase.
// Uso: npm run db:instalador
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'supabase/migrations'
const archivos = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
const partes = archivos.map((f) => `-- >>> ${f}\n${readFileSync(join(dir, f), 'utf8').trim()}\n`)
const encabezado = `-- =====================================================================
-- CRM Soluciones Impresiona · Instalador de la base de datos
--
-- Pégalo completo en Supabase → SQL Editor → New query → Run, UNA sola vez,
-- en un proyecto nuevo. Generado a partir de supabase/migrations (${archivos.length} archivos).
-- No lo edites a mano: ejecuta "npm run db:instalador".
-- =====================================================================

`
writeFileSync('supabase/instalar.sql', encabezado + partes.join('\n'))
console.log(`supabase/instalar.sql generado con ${archivos.length} migraciones`)
