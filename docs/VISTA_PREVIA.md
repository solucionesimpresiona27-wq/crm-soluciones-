# Vista previa del CRM Impresiona

Es una versión navegable del CRM completo con datos ficticios, con el diseño Impresiona Glass. Incluye todos los módulos: panel, clientes, embudo, cotizaciones y calculadora, pedidos, producción, pagos y cobranza, inventario y gastos, agenda y tareas, reportes, catálogo, usuarios y bitácora, configuración y el portal del cliente. También trae la vitrina del sistema de diseño.

## Datos ficticios, aislados de producción

- La información (clientes, montos, pedidos) es **inventada** y vive solo en la memoria del navegador.
- **Nada se guarda ni se envía.** La vista previa no se conecta a Supabase ni a WhatsApp Business, y no hace cobros.
- El aviso amarillo **"Vista previa con datos ficticios · nada se guarda"** permanece visible en todo momento.
- Los PDF que se generan llevan la marca de agua **VISTA PREVIA · DATOS FICTICIOS**.
- Al recargar la página, todo vuelve al estado inicial.

## Cómo abrirla

1. Abre el enlace de la vista previa: https://claude.ai/artifact/5CKChSyJDKX5BPUMRkVUPc (privado; solo lo ve la cuenta dueña y las personas con las que se comparta).
2. Elige un rol en la pantalla de entrada (no pide contraseña) y toca **Entrar a la vista previa**:
   - **Administración:** ve todo, incluidos los costos y la utilidad.
   - **Ventas:** cotiza y cobra, sin ver costos.
   - **Diseño / Producción:** ven pedidos y agenda, sin ningún monto.
3. Para cambiar de rol: menú del avatar (arriba a la derecha) → **Cerrar sesión**, y elige otro.

También funciona en el celular: ábrelo en el navegador del teléfono para ver la barra inferior y las hojas que suben desde abajo.

## Qué revisar

| Qué | Dónde |
|---|---|
| Panel y accesos directos | Inicio. Cambia de rol para ver qué ve cada quien. |
| Clientes y seguimiento | **Clientes** → abre una ficha: contactos, actividades, cotizaciones y pedidos. |
| Embudo | **Embudo**: arrastra tarjetas entre etapas o usa "Mover a…". Al marcar Perdido pide motivo. |
| Cotizar | **Calculadora** → "Usar en cotización", o **Nueva cotización**. Guárdala, duplícala y conviértela en pedido. |
| Pedidos y producción | **Pedidos** (etapas, diseños, facturación) y **Producción** (tablero sin precios). |
| Cobrar | **Pagos**: registrar pago, cobranza por antigüedad, corte de caja y comisiones. |
| Inventario y gastos | **Inventario**: materiales con stock bajo, movimientos, proveedores y gastos. |
| Agenda | **Agenda**: Hoy, Semana y Mes; captura rápida de tareas. |
| Reportes | **Reportes** (solo administración): ventas, productos, vendedores, clientes y utilidad. |
| Portal del cliente | En el detalle de una cotización o pedido → **Enlace para el cliente**. |
| Usuarios y configuración | Solo administración: equipo, permisos, bitácora, datos de la empresa y plantillas. |
| Modo claro y oscuro | Botón del sol o la luna (arriba a la derecha). |

## Limitaciones del visor

Dentro del visor de claude.ai el navegador bloquea **descargas** y **ventanas nuevas**. Por eso, ahí "Descargar PDF" y "Enviar por WhatsApp" pueden no abrir nada. En la app real sí funcionan. Para que veas el resultado te mando por separado un **PDF de ejemplo** y capturas.

## Ver la vista previa en tu computadora (opcional)

```bash
npm install
VITE_DEMO=true npm run dev
```

Para publicarla en otro lugar: `npm run build:demo` genera la carpeta `dist-demo`.

## Siguiente paso

Cuando la revises, dime qué ajustar (textos, colores, pasos de un proceso). Después se conecta a tu proyecto de Supabase con `supabase/instalar.sql` (base nueva) o `supabase/actualizar-fases-2-y-3.sql` (base que ya tenía la primera versión).
