# Vista previa del diseño Impresiona Glass

Es una versión navegable del CRM para validar el diseño **antes** de aplicarlo al resto del sistema. Incluye tres pantallas terminadas: **inicio de sesión**, **panel de control** y **cotizaciones**. Cotizaciones abarca la lista, el detalle, el editor con calculadora, el PDF y el envío por WhatsApp. También trae la vitrina del sistema de diseño.

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
| Cristal, reflejos y profundidad | Cualquier pantalla. Pasa el cursor sobre módulos y botones: el reflejo sigue al puntero. |
| Botones tipo Centro de Control | Accesos directos del panel y la barra de acciones del detalle de una cotización. |
| Respuesta con resorte al presionar | Cualquier botón circular o cápsula. |
| Módulos que se expanden | Panel → módulo **Ventas** o **Producción** (clic o mantener presionado). Escape o clic fuera para cerrar. |
| Selector con indicador deslizante | Filtros de cotizaciones y la Agenda del panel. |
| Modo claro y oscuro | Botón del sol o la luna (arriba a la derecha). La preferencia se recuerda. |
| Cristal sobre distintos fondos | Menú → **Diseño** (vitrina): cambia el fondo entre campo de luz, fotográfico, rayas y liso. |
| Calculadora de precios | **Nueva cotización** → agrega un concepto → abre la calculadora (m², metro lineal, pieza, millar, hora…). |
| Flujo completo | Crea una cotización, guárdala, duplícala y conviértela en pedido. |

## Limitaciones del visor

Dentro del visor de claude.ai el navegador bloquea **descargas** y **ventanas nuevas**. Por eso, ahí "Descargar PDF" y "Enviar por WhatsApp" pueden no abrir nada. En la app real sí funcionan. Para que veas el resultado te mando por separado un **PDF de ejemplo** y capturas.

## Ver la vista previa en tu computadora (opcional)

```bash
npm install
VITE_DEMO=true npm run dev
```

Para publicarla en otro lugar: `npm run build:demo` genera la carpeta `dist-demo`.

## Después de tu aprobación

Con el diseño aprobado, se construyen con el mismo sistema los demás módulos: clientes, embudo, pedidos, producción, pagos, inventario, agenda, reportes, usuarios y configuración. Si quieres ajustes (colores, intensidad del cristal, tamaños, textos), dímelos antes y los aplico en todo el sistema.
