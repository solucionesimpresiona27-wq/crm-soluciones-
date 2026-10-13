// Une las migraciones en archivos para pegarlos en el Editor SQL de Supabase.
//   supabase/instalar.sql                  instalación completa en un proyecto NUEVO
//   supabase/actualizar-fases-2-y-3.sql    solo lo nuevo, para una base que ya tenía instalar.sql
// Uso: npm run db:instalador
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'supabase/migrations'
const archivos = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
const parte = (f) => `-- >>> ${f}\n${readFileSync(join(dir, f), 'utf8').trim()}\n`

const encabezado = `-- =====================================================================
-- CRM Soluciones Impresiona · Instalador de la base de datos
--
-- Pégalo completo en Supabase → SQL Editor → New query → Run, UNA sola vez,
-- en un proyecto nuevo. Generado a partir de supabase/migrations (${archivos.length} archivos).
-- No lo edites a mano: ejecuta "npm run db:instalador".
-- =====================================================================

`
writeFileSync('supabase/instalar.sql', encabezado + archivos.map(parte).join('\n'))
console.log(`supabase/instalar.sql generado con ${archivos.length} migraciones`)

// Actualizaciones para bases ya instaladas: cada una agrupa las migraciones desde una fecha.
const ACTUALIZACIONES = [
  {
    archivo: 'supabase/actualizar-fases-2-y-3.sql',
    desde: '20261014',
    titulo: 'Actualización a las fases 2 y 3',
    contenido: 'tareas y agenda, listas de precios, proveedores, inventario, gastos, corte de caja,\n-- reportes, comisiones y portal del cliente',
    // Tabla que crea esta actualización: si ya existe, la actualización ya se aplicó.
    marca: 'public.tareas',
  },
]

for (const act of ACTUALIZACIONES) {
  const incluidas = archivos.filter((f) => f >= act.desde)
  const guardia = `do $$
begin
  if to_regclass('public.pedidos') is null then
    raise exception 'Esta base no tiene el CRM instalado: ejecuta supabase/instalar.sql (no esta actualización).';
  end if;
  if to_regclass('${act.marca}') is not null then
    raise exception 'Esta actualización ya se aplicó antes; no hace falta ejecutarla otra vez.';
  end if;
end
$$;
`
  const texto = `-- =====================================================================
-- CRM Soluciones Impresiona · ${act.titulo}
-- Incluye: ${act.contenido}.
--
-- SOLO para un proyecto de Supabase que YA tenía instalado supabase/instalar.sql
-- anterior a estas funciones. En un proyecto nuevo usa únicamente instalar.sql
-- (ya trae todo).
--
-- Pégalo completo en Supabase → SQL Editor → New query → Run, una sola vez.
-- Se aplica completo o nada (si algo falla, la base queda como estaba).
-- Generado a partir de supabase/migrations (${incluidas.length} archivos desde ${act.desde}).
-- No lo edites a mano: ejecuta "npm run db:instalador".
-- =====================================================================

begin;

${guardia}
${incluidas.map(parte).join('\n')}
commit;
`
  writeFileSync(act.archivo, texto)
  console.log(`${act.archivo} generado con ${incluidas.length} migraciones`)
}
