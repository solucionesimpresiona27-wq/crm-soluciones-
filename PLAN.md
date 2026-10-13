# CRM Soluciones Impresiona — Plan del proyecto

CRM web para imprenta / publicidad en México. Se usa desde PC y celular, para un equipo de 2 a 5 personas con roles distintos.

## 1. Resumen de lo acordado

| Tema | Decisión |
|---|---|
| Giro | Imprenta / publicidad: gran formato, impresión por millar, promocionales/textil, rotulación e instalación |
| Usuarios | 2 a 5 personas, cada una con su propio usuario |
| Roles | Dueño/administrador, Ventas/mostrador, Diseño, Producción/instalación |
| Plataforma | Web (PC y celular); se puede instalar como app en el teléfono (PWA) |
| País | México: pesos MXN, IVA 16 %, datos fiscales con RFC |
| Facturación | Se factura por fuera; el CRM solo marca "facturado" y guarda el folio CFDI |
| Datos actuales | WhatsApp / libreta, así que se empieza de cero |
| Hosting | En tu Hostinger si se puede (casi seguro que sí, ver sección 5); si no, gratis en Vercel |
| Imagen | Con tu logo y colores, tanto en el CRM como en el PDF de las cotizaciones |
| Entrega | Por fases |

## 2. Módulos por fase

### Fase 1: Núcleo (lo que usas todos los días)

1. **Usuarios y roles.** Inicio de sesión con correo y contraseña. Permisos por rol (ver sección 3).
2. **Configuración del negocio.** Logo, colores, datos de contacto, condiciones de venta (vigencia, % de anticipo, notas al pie) e IVA.
3. **Clientes y contactos.**
   - Persona física o empresa, con varios contactos por empresa.
   - WhatsApp, correo, dirección y notas.
   - Datos fiscales: RFC, razón social, régimen, C.P. y uso de CFDI.
   - Etiquetas (agencia, gobierno, recurrente…).
   - Historial de cotizaciones, pedidos y pagos de cada cliente.
4. **Catálogo de productos con calculadora de precios.**
   - **Por m²** (lonas, vinil, microperforado): ancho × alto × precio del material, con mínimo cobrable y acabados (ojillos, bastilla, laminado, bastidor).
   - **Por millar / tiraje** (tarjetas, volantes, etiquetas): tabla de precios por cantidad, tamaño, papel, frente o frente y vuelta, y acabados (barniz, suaje, doblez).
   - **Por pieza** (playeras, tazas, gorras): precio base, descuentos por volumen (1–11, 12–49, 50+), costo de personalización y cargo de preparación.
   - **Servicios** (diseño, instalación, rotulado): por hora, por m² o por proyecto, más viáticos por zona.
   - Cada producto guarda su **costo**, para calcular la utilidad en la Fase 3.
5. **Cotizaciones.**
   - Folio automático (COT-0001).
   - Partidas armadas con la calculadora, más descuento e IVA.
   - **PDF con tu logo y colores.**
   - Estados: borrador → enviada → aceptada / rechazada / vencida.
   - **Se convierte en pedido con un clic.**
6. **Pedidos / órdenes de trabajo.**
   - Folio PED-0001, fecha de entrega, prioridad y **responsable**.
   - Estados configurables. Propuesta: Nuevo → En diseño → Esperando aprobación → En producción → Acabados → Listo para entrega → Entregado / Instalado (o Cancelado).
   - **Tablero tipo Kanban** para mover los pedidos entre estados.
   - Hoja de orden de trabajo para producción, sin precios.
7. **Pagos y cobranza.**
   - Anticipo y abonos en efectivo, transferencia o tarjeta.
   - Saldo pendiente automático y lista de "quién me debe".
   - Casilla de "facturado" con el folio CFDI.
8. **WhatsApp.** Botones que abren WhatsApp con el mensaje ya escrito: cotización, anticipo recibido, pedido listo, recordatorio de pago. Usa enlaces `wa.me`, que son gratis y no requieren API.
9. **Bitácora de cambios.** Registra quién creó, modificó o borró cada cosa. Va desde el día 1 para que el historial quede completo.

### Fase 2: Seguimiento y control

10. **Embudo de seguimiento.** Tablero de prospecto → cotizado → negociando → ganado / perdido, con el motivo de pérdida.
11. **Agenda y recordatorios.** Entregas, instalaciones, llamadas de seguimiento y cotizaciones a punto de vencer.
12. **Responsables y tareas.** Tareas internas y una pantalla de "Mis pendientes de hoy" para cada persona.
13. **Archivos y pruebas de diseño.** Se suben los artes a cada pedido, con versiones (v1, v2…), y se registra la aprobación del cliente antes de imprimir.
14. **Portal del cliente.** Un link privado donde el cliente ve el estado de su pedido y aprueba la cotización o la prueba de diseño sin tener que llamarte.
15. **Listas de precios por cliente.** Público, mayoreo y agencia/revendedor. A cada cliente se le asigna su lista.
16. **Plantillas de mensajes editables.** Tú cambias los textos de WhatsApp desde la configuración.
17. **Corte de caja diario.** Entradas y salidas del día por método de pago y por persona, con cierre de caja.

### Fase 3: Negocio y crecimiento

18. **Panel de reportes.** Ventas del día, semana y mes; cuentas por cobrar; mejores clientes; productos más vendidos; tasa de cierre de cotizaciones.
19. **Gastos, proveedores y maquila.** Compras de material, trabajos maquilados a terceros y **utilidad real por pedido**.
20. **Inventario de materiales.** Existencias de papel, vinil, lonas y tintas, entradas y consumos, y **alerta de stock mínimo**.
21. **Comisiones de vendedores.** Se calculan sobre las ventas **cobradas**, con el porcentaje configurable por vendedor.
22. **Reactivar clientes.** Lista de los clientes que no compran desde hace X meses, con botón de WhatsApp para contactarlos.
23. **Respaldo / exportar a Excel.** Descarga de clientes, pedidos y pagos cuando quieras.

## 3. Permisos por rol (propuesta)

| Módulo | Administrador | Ventas | Diseño | Producción |
|---|---|---|---|---|
| Clientes | Todo | Todo | Ver | Solo el nombre en su orden |
| Cotizaciones y precios | Todo | Todo | Ver, sin costos | No |
| Pedidos | Todo | Todo | Ver, cambiar estados de diseño y subir archivos | Ver sus órdenes y cambiar el estado, **sin precios** |
| Pagos y caja | Todo | Registrar cobros | No | No |
| Gastos, utilidad y reportes | Todo | Solo sus comisiones | No | No |
| Inventario | Todo | Ver | Ver | Ver y registrar consumo |
| Configuración y usuarios | Todo | No | No | No |
| Bitácora | Ver | No | No | No |

## 4. Tecnología

- **Pantallas (frontend):** React + TypeScript + Tailwind. Se adapta a celular y se instala como app (PWA).
- **Base de datos, usuarios y archivos:** [Supabase](https://supabase.com), que usa PostgreSQL. Los permisos por rol se aplican **en la base de datos** con Row Level Security, no solo en la pantalla, así que nadie puede ver lo que no le toca aunque sepa usar el navegador.
- **PDF:** se genera en el navegador, con tu logo.
- **WhatsApp:** enlaces `wa.me`, gratis. Más adelante, si lo necesitas, se puede usar la API oficial de WhatsApp Business, que es de pago.

## 5. Hosting: ¿sirve tu Hostinger?

**Sí.** Las pantallas del CRM son archivos estáticos (HTML, JS y CSS), y esos funcionan en **cualquier** plan de Hostinger:

1. Creas un subdominio, por ejemplo `crm.tudominio.com`, en hPanel.
2. Subes los archivos de la carpeta compilada.
3. El SSL (https) gratis de Hostinger lo protege.

Los datos, los usuarios y los archivos viven en Supabase, que es gratis para empezar. Así no hace falta que tu plan tenga Node.js ni que configures la base de datos MySQL de Hostinger.

**Costos:**

| Concepto | Costo |
|---|---|
| Hostinger | El que ya pagas |
| Supabase gratis | $0. Incluye 500 MB de base de datos y 1 GB de archivos, suficiente para empezar |
| Supabase Pro (opcional, si creces) | ~$25 USD/mes (unos $450–500 MXN). Da 8 GB de base de datos, 100 GB de archivos y respaldos diarios automáticos |

**Notas del plan gratis:**

- El proyecto se "duerme" si nadie lo usa durante 7 días. Con el uso diario no pasa, y si pasa se reactiva con un clic.
- Para no llenar 1 GB, en el CRM se suben las **pruebas ligeras** (JPG o PDF comprimido). Los originales pesados (AI, PSD, CDR) se quedan en tu Drive o carpeta y en el pedido se guarda el link.

## 6. Lo que necesito de ti

No detiene el arranque de la Fase 1, porque puedo usar datos de ejemplo mientras me los mandas.

1. **Logo** en PNG con fondo transparente o en SVG, y tus **colores** (los códigos, o los saco del logo).
2. **Datos para el PDF:** nombre comercial exacto, dirección, teléfono/WhatsApp, correo, redes y RFC si quieres que aparezca.
3. **Condiciones de cotización:** vigencia (¿15 días?), % de anticipo (¿50 %?), tiempo de entrega típico y notas o garantía.
4. **Lista de productos y precios.** Aunque sea una foto de la libreta o una lista por WhatsApp; yo la capturo en el catálogo.
5. **Equipo:** nombre, correo y rol de cada persona.
6. **Supabase:** crear una cuenta gratis en supabase.com y un proyecto. Te guío paso a paso. Yo te paso el script de la base de datos para pegarlo en su editor SQL, y **no necesitas compartirme contraseñas**.
7. **Hostinger:** el dominio o subdominio que quieres usar para el CRM.
8. **Confirmar** el flujo de estados de los pedidos (sección 2, punto 6) y los métodos de pago que aceptas.
