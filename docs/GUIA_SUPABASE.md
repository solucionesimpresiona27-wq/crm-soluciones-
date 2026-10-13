# Guía: configurar Supabase (gratis)

Supabase guarda la base de datos, los usuarios y los archivos del CRM. El plan gratuito alcanza para 2 a 5 personas.
Tiempo estimado: 20 minutos. Los nombres de los menús de Supabase pueden cambiar un poco; si no encuentras uno, búscalo con la lupa del panel.

> Nunca compartas por chat la **contraseña de la base de datos** ni la llave **secret / service_role**. La única llave que va en el CRM es la **publishable** (o *anon*), que es pública por diseño: la seguridad la dan las reglas de acceso de la base de datos.

## 1. Crear la cuenta y el proyecto

1. Entra a <https://supabase.com> → **Start your project** y crea tu cuenta (puedes usar tu cuenta de GitHub o tu correo).
2. **New project**:
   - **Name**: `crm-soluciones-impresiona`
   - **Database password**: genera una segura y **guárdala en un lugar seguro** (gestor de contraseñas).
   - **Region**: la más cercana a Guadalajara, por ejemplo *West US (North California)* o *East US (North Virginia)*.
   - Plan: **Free**.
3. Espera 1 a 2 minutos a que el proyecto termine de crearse.

## 2. Instalar la base de datos

1. Menú izquierdo → **SQL Editor** → **New query**.
2. Abre el archivo [`supabase/instalar.sql`](../supabase/instalar.sql) de este repositorio, copia **todo** su contenido y pégalo.
3. Presiona **Run**. Debe terminar con *Success. No rows returned*.
   - Hazlo **una sola vez** en un proyecto nuevo.
   - Crea las tablas y las reglas de seguridad por rol. También carga las plantillas de WhatsApp, los datos de la empresa y el catálogo inicial (sin precios). Además crea los espacios de archivos.
   - Ya incluye todo lo de las fases 2 y 3 (tareas y agenda, listas de precios, proveedores, inventario, gastos, corte de caja, reportes, comisiones y portal del cliente). En un proyecto nuevo **no** hace falta el archivo de actualización.

### ¿Ya tenías el CRM instalado? Actualízalo a las fases 2 y 3

Usa este camino **solo** si ya habías ejecutado una versión anterior de `instalar.sql` en tu proyecto (tu base ya tiene clientes, cotizaciones o pedidos). Tus datos se conservan.

1. (Recomendado) Haz un respaldo antes: descarga el último respaldo semanal de GitHub (sección 7) o, en el plan Pro, revisa **Database → Backups**.
2. **SQL Editor → New query**.
3. Abre [`supabase/actualizar-fases-2-y-3.sql`](../supabase/actualizar-fases-2-y-3.sql), copia **todo** su contenido, pégalo y presiona **Run**.
   - Debe terminar con *Success. No rows returned*.
   - Se aplica completo o nada: si algo falla, la base queda exactamente como estaba.
   - Si aparece *"Esta actualización ya se aplicó antes"*, no tienes que hacer nada más.
   - Si aparece *"Esta base no tiene el CRM instalado"*, estás en un proyecto nuevo: usa `instalar.sql` (paso anterior).
4. Despliega la función del portal del cliente (sección 5b).

| Tu situación | Qué ejecutar |
|---|---|
| Proyecto nuevo, sin el CRM | Solo `supabase/instalar.sql` |
| Ya tenías el CRM (instalado antes del 14 de octubre de 2026) | Solo `supabase/actualizar-fases-2-y-3.sql` |
| Instalaste con la CLI de Supabase (`supabase db push`), no con el editor SQL | `supabase db push` otra vez: aplica solo las migraciones nuevas de `supabase/migrations` |

## 3. Seguridad de acceso (usuarios)

1. **Authentication → Sign In / Providers**:
   - **Email**: debe quedar **activado** (es el inicio de sesión con correo y contraseña).
   - **Allow new users to sign up** (registro público): **desactivado**. Así solo el administrador da de alta usuarios.
   - **Confirm email**: puede quedar desactivado; los usuarios que creas desde el CRM ya quedan confirmados.
2. **Authentication → URL Configuration**:
   - **Site URL**: `https://crm.solucionesimpresiona.com`
   - **Redirect URLs**: agrega `https://crm.solucionesimpresiona.com/nueva-contrasena`
3. **Authentication → Policies / Password**: longitud mínima **8** y, si aparece la opción, exige letras y números.

## 4. Crear tu usuario (administrador)

1. **Authentication → Users → Add user → Create new user**.
2. Escribe tu correo y una contraseña, y marca **Auto Confirm User**.
3. El **primer usuario** que se crea se vuelve **administrador** automáticamente. Las demás personas las darás de alta desde el CRM (módulo Usuarios).

## 5. Función para administrar usuarios

Permite que el administrador cree usuarios, cambie contraseñas y active o desactive cuentas desde el CRM, sin exponer llaves privadas.

1. Menú izquierdo → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nombre: `admin-usuarios` (exactamente así).
3. Borra el código de ejemplo y pega todo el contenido de [`supabase/functions/admin-usuarios/index.ts`](../supabase/functions/admin-usuarios/index.ts). Presiona **Deploy**.
4. En la configuración de la función, **desactiva "Verify JWT"** (la función ya verifica por dentro que quien llama sea administrador).
5. (Recomendado) **Edge Functions → Secrets**: agrega `CRM_ORIGEN_PERMITIDO` = `https://crm.solucionesimpresiona.com`.

Si prefieres no usar la función: crea a cada persona en **Authentication → Users → Add user**. Su perfil queda **inactivo**; después actívalo y asígnale un rol desde el CRM.

## 5b. Función del portal del cliente

El portal es el enlace privado que le mandas al cliente (por WhatsApp) para que vea su cotización o pedido y apruebe la cotización o los diseños sin tener cuenta. Esta función le muestra al cliente las imágenes y PDF de los diseños de **su** pedido con enlaces temporales (10 minutos). La llave secreta se queda en el servidor.

1. **Edge Functions → Deploy a new function → Via Editor**.
2. Nombre: `portal-cliente` (exactamente así).
3. Borra el código de ejemplo y pega todo el contenido de [`supabase/functions/portal-cliente/index.ts`](../supabase/functions/portal-cliente/index.ts). Presiona **Deploy**.
4. En la configuración de la función, **desactiva "Verify JWT"**: el cliente no inicia sesión; la función valida por dentro el token secreto del enlace.
5. El secreto `CRM_ORIGEN_PERMITIDO` de la sección 5 también aplica a esta función (si ya lo agregaste, no hagas nada).

Sin esta función el portal funciona igual (el cliente ve y aprueba), pero no puede ver las imágenes de los diseños guardados en el CRM; solo los que se compartieron como enlace (por ejemplo, de Drive).

Seguridad del portal:
- Cada enlace lleva un token aleatorio imposible de adivinar y vence a los 30 días (configurable de 1 a 180). Desde el CRM puedes **revocarlo** en cualquier momento.
- El cliente solo ve lo de ese documento: conceptos, totales, condiciones y avance. Nunca ve costos, notas internas ni información de otros clientes. El RFC y la razón social de tu empresa solo aparecen si activas "Mostrar datos fiscales" en la configuración.
- Cada aprobación queda registrada con el nombre que escribió el cliente, la fecha y su conexión, y aparece en el historial del cliente y del pedido.

## 6. Datos para conectar el CRM

En **Project Settings → API Keys** (o el botón **Connect** arriba):

| Dato | Dónde | Se usa como |
|---|---|---|
| Project URL | `https://xxxx.supabase.co` | `VITE_SUPABASE_URL` |
| Publishable key | empieza con `sb_publishable_` (o la *anon key*) | `VITE_SUPABASE_ANON_KEY` |

Estos dos valores van en los **secretos de GitHub** para la publicación automática (ver [GUIA_HOSTINGER.md](GUIA_HOSTINGER.md)).

## 7. Respaldos

- **Plan gratuito**: activa el respaldo semanal automático y gratuito con GitHub:
  1. Supabase → **Connect** → **Session pooler**: copia la cadena de conexión. Empieza con `postgresql://postgres.xxxx:` y debes reemplazar `[YOUR-PASSWORD]` por tu contraseña de la base de datos.
  2. GitHub → tu repositorio → **Settings → Secrets and variables → Actions → New repository secret**:
     - Nombre: `SUPABASE_DB_URL`
     - Valor: la cadena de conexión.
  3. Cada domingo el flujo **"Respaldo semanal de la base de datos"** guarda una copia durante 90 días. Para descargarla: GitHub → **Actions** → la ejecución → **Artifacts**.
- **Plan Pro** (≈ 25 USD/mes): respaldos diarios automáticos en Supabase y más espacio. Puedes cambiar de plan en cualquier momento sin migrar nada.

## Límites del plan gratuito que conviene conocer

- 500 MB de base de datos y 1 GB de archivos. Sube **pruebas ligeras** (JPG/PDF) y deja los originales pesados (AI, PSD, CDR) en tu Drive, con el enlace guardado en el pedido.
- Si **nadie usa el CRM durante 7 días**, el proyecto se pausa. Se reactiva desde el panel de Supabase con un clic.
