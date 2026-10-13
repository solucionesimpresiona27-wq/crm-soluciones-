// Prepara la compilación de la vista previa (dist-demo) para publicarla como página de claude.ai:
// el visor envuelve el contenido en su propio <html>/<head>/<body>, así que se quitan esas etiquetas.
// Uso: VITE_DEMO=true VITE_RUTAS=memoria npx vite build && node scripts/preparar-vista-previa.mjs
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const dir = 'dist-demo'
const html = readFileSync(join(dir, 'index.html'), 'utf8')
const titulo = html.match(/<title>[\s\S]*?<\/title>/)?.[0] ?? '<title>Soluciones Impresiona</title>'
const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? ''
const body = html.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? ''

// Conserva estilos, scripts y precargas; descarta metas de documento que pone el visor.
const piezas = [...head.matchAll(/<(link|script)\b[\s\S]*?(?:<\/script>|>)/g)]
  .map((m) => m[0])
  .filter((t) => !/rel="(icon|apple-touch-icon|manifest)"/.test(t))

const pagina = [titulo, ...piezas, body.trim()].join('\n')
writeFileSync(join(dir, 'vista-previa.html'), pagina)

const archivos = []
const recorrer = (d) => {
  for (const f of readdirSync(d)) {
    const ruta = join(d, f)
    if (statSync(ruta).isDirectory()) recorrer(ruta)
    else archivos.push(relative(dir, ruta))
  }
}
recorrer(dir)
const publicar = archivos.filter((f) => !/^(index\.html|vista-previa\.html|\.htaccess|robots\.txt)$/.test(f))
writeFileSync(join(dir, 'archivos.json'), JSON.stringify(Object.fromEntries(publicar.map((f) => [f, join(dir, f)])), null, 2))
console.log(`vista-previa.html listo; ${publicar.length} archivos de apoyo en archivos.json`)
