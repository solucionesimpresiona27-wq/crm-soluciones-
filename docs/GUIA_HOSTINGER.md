# Guía: publicar el CRM en Hostinger

El CRM es una aplicación de archivos estáticos (HTML, JS, CSS), así que funciona en **cualquier plan de Hostinger**, sin Node.js ni base de datos de Hostinger. Los datos viven en Supabase (ver [GUIA_SUPABASE.md](GUIA_SUPABASE.md)).

## 1. Crear el subdominio

1. hPanel → **Dominios** → selecciona `solucionesimpresiona.com` → **Subdominios**.
   - Confirma que el dominio está en tu cuenta de Hostinger.
2. Crea el subdominio `crm`. Hostinger le asigna una carpeta, normalmente `public_html/crm`. Anota la ruta exacta.
3. hPanel → **Seguridad → SSL**: verifica que `crm.solucionesimpresiona.com` tenga certificado activo. Hostinger lo instala gratis; puede tardar unos minutos.

## 2. Opción A (recomendada): publicación automática desde GitHub

Cada vez que se actualiza la rama `main`, GitHub compila el CRM y lo sube solo.

1. hPanel → **Archivos → Cuentas FTP** → crea una cuenta:
   - Usuario: por ejemplo `crm`.
   - Contraseña: una segura.
   - Directorio: **la carpeta del subdominio** (`public_html/crm`).
   - Anota el **servidor FTP** (algo como `ftp.solucionesimpresiona.com` o una IP).
2. GitHub → repositorio → **Settings → Secrets and variables → Actions → New repository secret**. Crea estos secretos:

   | Secreto | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL de Supabase |
   | `VITE_SUPABASE_ANON_KEY` | Publishable key (o anon key) |
   | `FTP_SERVIDOR` | servidor FTP de Hostinger |
   | `FTP_USUARIO` | usuario FTP completo (por ejemplo `crm@solucionesimpresiona.com`) |
   | `FTP_CONTRASENA` | contraseña FTP |

3. GitHub → **Actions → Publicar en Hostinger → Run workflow** (o simplemente actualiza `main`).
4. Abre `https://crm.solucionesimpresiona.com`.

## 3. Opción B: subir a mano

1. GitHub → **Actions → Publicar en Hostinger** → la última ejecución → descarga **crm-publicar**. Para generarlo bastan los dos secretos de Supabase.
2. hPanel → **Archivos → Administrador de archivos** → entra a la carpeta del subdominio.
3. Sube el ZIP y **extráelo ahí**. `index.html` debe quedar directamente en la carpeta, no dentro de otra subcarpeta.
4. Activa **mostrar archivos ocultos** y confirma que existe `.htaccess`. Hace que las rutas del CRM funcionen al recargar y fuerza HTTPS.

## Comprobaciones

- Al abrir `https://crm.solucionesimpresiona.com/cotizaciones` y recargar, no debe salir error 404 (lo resuelve `.htaccess`).
- En el celular, en el menú del navegador, usa **Agregar a pantalla de inicio**: el CRM se instala como app.
- Si ves "Faltan VITE_SUPABASE_URL…", revisa los secretos de GitHub y vuelve a publicar.

## Alternativa sin Hostinger (también gratis)

Si algún día lo necesitas, el mismo resultado se publica gratis en Vercel, Netlify o Cloudflare Pages:
- Comando de compilación: `npm run build`.
- Carpeta de salida: `dist`.
- Las mismas dos variables de Supabase.
