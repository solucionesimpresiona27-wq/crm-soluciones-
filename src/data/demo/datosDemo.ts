/**
 * DATOS FICTICIOS para la vista previa del diseño.
 * Ningún nombre, teléfono ni importe corresponde a clientes reales.
 * Viven solo en memoria del navegador y se pierden al recargar.
 */
import { calcularTotales, importePartida } from '@/lib/calculadora'
import { sumarDias } from '@/lib/format'
import type { Configuracion, CotizacionCompleta, Perfil, Plantilla, ProductoCatalogo, Rol } from '../tipos'

export { AVISO_DEMO } from '@/lib/supabase'

const hoy = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export function perfilesDemo(): Record<Rol, Perfil> {
  const base = {
    telefono: null,
    puesto: null,
    activo: true,
    permisos: {},
    comision_pct: 0,
    ultimo_acceso: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
  return {
    admin: { ...base, id: 'demo-admin', nombre: 'Ana Ramírez', email: 'admin@demo.local', rol: 'admin', puesto: 'Dirección' },
    ventas: { ...base, id: 'demo-ventas', nombre: 'Luis Herrera', email: 'ventas@demo.local', rol: 'ventas', puesto: 'Ventas', comision_pct: 5 },
    diseno: { ...base, id: 'demo-diseno', nombre: 'Sofía Méndez', email: 'diseno@demo.local', rol: 'diseno', puesto: 'Diseño' },
    produccion: { ...base, id: 'demo-produccion', nombre: 'Jorge Castillo', email: 'produccion@demo.local', rol: 'produccion', puesto: 'Producción' },
  }
}

export const configuracionDemo: Configuracion = {
  id: 1,
  nombre_comercial: 'Soluciones Impresiona',
  eslogan: null,
  ciudad: 'Guadalajara, Jalisco, México',
  direccion: null,
  telefono: null,
  whatsapp: '+52 33 3492 2524',
  email: 'solucionesimpresiona27@gmail.com',
  sitio_web: null,
  instagram: '@solucionesimpresiona',
  facebook: 'Soluciones Impresiona',
  tiktok: '@solucionesimpresiona',
  rfc: null,
  razon_social: null,
  regimen_fiscal: null,
  mostrar_datos_fiscales: false,
  datos_bancarios: null,
  logo_url: null,
  color_primario: '#22426B',
  color_secundario: '#F9C206',
  iva_pct: 16,
  anticipo_pct: 50,
  vigencia_dias: 15,
  tiempo_entrega_default: 'Variable según el producto, la cantidad y la complejidad del trabajo.',
  condiciones_cotizacion:
    'Pago restante: 50% antes de entregar o instalar, según el proyecto.\n' +
    'La producción inicia una vez confirmado el anticipo y aprobados los diseños, cuando aplique.\n' +
    'Los tiempos de entrega varían según el producto, la cantidad y la complejidad del trabajo.\n' +
    'Cualquier modificación posterior a la aprobación del diseño podrá generar costos adicionales.\n' +
    'La instalación y el transporte se cotizan por separado.\n' +
    'Los trabajos urgentes pueden tener un recargo adicional.\n' +
    'Precios en pesos mexicanos (MXN). El IVA se desglosa por separado cuando corresponde.',
  notas_pie_cotizacion: 'Gracias por su preferencia.',
  metodos_pago_activos: ['transferencia', 'efectivo', 'deposito'],
  prefijo_cotizacion: 'COT',
  prefijo_pedido: 'PED',
  dias_reactivacion: 90,
  updated_at: '2026-01-01T00:00:00Z',
}

type PlantillaBase = Pick<Plantilla, 'clave' | 'nombre' | 'contexto' | 'orden' | 'texto'>

/** Mismas plantillas que instala la base de datos (migraciones 06 y 18). */
const PLANTILLAS: PlantillaBase[] = [
  { clave: 'saludo', nombre: 'Saludo', contexto: 'cliente', orden: 10, texto: 'Hola {cliente} 👋, te saluda {vendedor} de {empresa}. ¿En qué te podemos ayudar?' },
  {
    clave: 'cotizacion_envio',
    nombre: 'Envío de cotización',
    contexto: 'cotizacion',
    orden: 20,
    texto:
      'Hola {cliente} 👋, te compartimos la cotización *{folio}* por *{total}*.\n\n{enlace}\n\nVigencia: {vigencia}. Anticipo para iniciar: {anticipo}.\nQuedamos atentos a tus comentarios. ¡Gracias por considerar a {empresa}!',
  },
  { clave: 'portal_cotizacion', nombre: 'Cotización para aprobar en línea', contexto: 'cotizacion', orden: 25, texto: 'Hola {cliente} 👋, aquí puedes revisar y aprobar tu cotización *{folio}* por *{total}*:\n\n{enlace}\n\nVigencia: {vigencia}. Cualquier duda, con gusto te ayudamos.' },
  {
    clave: 'cotizacion_seguimiento',
    nombre: 'Seguimiento de cotización',
    contexto: 'cotizacion',
    orden: 30,
    texto:
      'Hola {cliente}, ¿pudiste revisar la cotización *{folio}*? Con gusto resolvemos tus dudas o hacemos ajustes. La cotización es válida hasta el {vigencia}.',
  },
  { clave: 'anticipo_recibido', nombre: 'Anticipo recibido', contexto: 'pago', orden: 40, texto: 'Hola {cliente}, confirmamos la recepción de tu anticipo de *{monto}* para el pedido *{folio}*. ✅\nSaldo pendiente: {saldo}.\n¡Comenzamos con tu proyecto!' },
  { clave: 'pago_recibido', nombre: 'Pago recibido', contexto: 'pago', orden: 50, texto: 'Hola {cliente}, recibimos tu pago de *{monto}* para el pedido *{folio}*. ✅\nSaldo pendiente: {saldo}.\n¡Gracias!' },
  { clave: 'diseno_revision', nombre: 'Diseño para aprobación', contexto: 'pedido', orden: 60, texto: 'Hola {cliente}, te compartimos la propuesta de diseño de tu pedido *{folio}*. Por favor revísala y confírmanos tu aprobación para pasar a producción. Cualquier cambio posterior a la aprobación puede generar costos adicionales.' },
  { clave: 'portal_pedido', nombre: 'Seguimiento del pedido en línea', contexto: 'pedido', orden: 65, texto: 'Hola {cliente}, en este enlace puedes ver el avance de tu pedido *{folio}* y aprobar los diseños cuando estén listos:\n\n{enlace}' },
  { clave: 'portal_diseno', nombre: 'Diseño para aprobar en línea', contexto: 'pedido', orden: 66, texto: 'Hola {cliente}, ya está lista la propuesta de diseño de tu pedido *{folio}*. Revísala y apruébala o pide cambios aquí:\n\n{enlace}\n\nCualquier cambio posterior a la aprobación puede generar costos adicionales.' },
  { clave: 'pedido_listo', nombre: 'Pedido listo', contexto: 'pedido', orden: 70, texto: 'Hola {cliente}, ¡tu pedido *{folio}* está listo! 🎉\nSaldo pendiente: {saldo}.\n¿Cuándo te gustaría recogerlo o coordinar la entrega/instalación?' },
  { clave: 'instalacion_programada', nombre: 'Instalación programada', contexto: 'pedido', orden: 80, texto: 'Hola {cliente}, te confirmamos la instalación de tu pedido *{folio}* para el {fecha_entrega}. Te avisaremos cuando vayamos en camino.' },
  { clave: 'recordatorio_pago', nombre: 'Recordatorio de pago', contexto: 'pago', orden: 90, texto: 'Hola {cliente}, te recordamos amablemente que el pedido *{folio}* tiene un saldo pendiente de *{saldo}*. Si ya realizaste el pago, por favor envíanos tu comprobante. ¡Gracias!' },
  { clave: 'agradecimiento', nombre: 'Agradecimiento', contexto: 'pedido', orden: 100, texto: 'Hola {cliente}, ¡gracias por confiar en {empresa}! Esperamos que tu pedido *{folio}* haya quedado como lo imaginaste. Nos encantaría ver tu opinión o una foto en nuestras redes 💛' },
  { clave: 'reactivacion', nombre: 'Volver a contactar', contexto: 'cliente', orden: 110, texto: 'Hola {cliente}, ¡hace tiempo que no sabemos de ti! En {empresa} tenemos nuevas opciones en impresión, publicidad y servicios digitales. ¿Tienes algún proyecto en mente?' },
]

/** Plantillas de WhatsApp de la vista previa (ids estables: p1 = envío, p2 = seguimiento, como antes). */
export const plantillasDemo: Plantilla[] = PLANTILLAS.map((p) => ({
  ...p,
  id: p.clave === 'cotizacion_envio' ? 'p1' : p.clave === 'cotizacion_seguimiento' ? 'p2' : `p-${p.clave}`,
  activo: true,
  created_at: '',
  updated_at: '',
}))

export interface ClienteDemo {
  id: string
  nombre: string
  whatsapp: string | null
  telefono: string | null
  email: string | null
  requiere_factura: boolean
  rfc: string | null
  razon_social: string | null
  direccion: string | null
  ciudad: string | null
}

export const clientesDemo: ClienteDemo[] = [
  { id: 'c1', nombre: 'Cafetería Barrio Alto', whatsapp: '3311112233', telefono: null, email: 'contacto@barrioalto.demo', requiere_factura: true, rfc: 'CBA210512AB1', razon_social: 'Café Barrio Alto S.A. de C.V.', direccion: 'Av. Chapultepec 000', ciudad: 'Guadalajara' },
  { id: 'c2', nombre: 'Gimnasio Titán', whatsapp: '3322223344', telefono: null, email: null, requiere_factura: false, rfc: null, razon_social: null, direccion: null, ciudad: 'Zapopan' },
  { id: 'c3', nombre: 'Clínica Dental Sonríe', whatsapp: '3333334455', telefono: null, email: 'admin@sonrie.demo', requiere_factura: true, rfc: 'CDS190301XY2', razon_social: 'Clínica Dental Sonríe S.C.', direccion: null, ciudad: 'Guadalajara' },
  { id: 'c4', nombre: 'Taquería Los Compadres', whatsapp: '3344445566', telefono: null, email: null, requiere_factura: false, rfc: null, razon_social: null, direccion: null, ciudad: 'Tlaquepaque' },
  { id: 'c5', nombre: 'Inmobiliaria Horizonte', whatsapp: '3355556677', telefono: null, email: 'ventas@horizonte.demo', requiere_factura: true, rfc: 'IHO150820QW3', razon_social: 'Inmobiliaria Horizonte del Bajío S.A.', direccion: null, ciudad: 'Zapopan' },
  { id: 'c6', nombre: 'Escuela Montessori Arcoíris', whatsapp: '3366667788', telefono: null, email: null, requiere_factura: true, rfc: null, razon_social: null, direccion: null, ciudad: 'Guadalajara' },
  { id: 'c7', nombre: 'Boutique Lirio', whatsapp: '3377778899', telefono: null, email: null, requiere_factura: false, rfc: null, razon_social: null, direccion: null, ciudad: 'Guadalajara' },
  { id: 'c8', nombre: 'Taller Mecánico Rueda', whatsapp: '3388889900', telefono: null, email: null, requiere_factura: false, rfc: null, razon_social: null, direccion: null, ciudad: 'Tonalá' },
]

export type ProductoBase = Omit<ProductoCatalogo, 'categoria' | 'costos' | 'descripcion' | 'precio_minimo' | 'escalas'> & {
  cat: string
  grupo: string
  costos?: ProductoCatalogo['costos']
  escalas?: ProductoCatalogo['escalas']
  precio_minimo?: number | null
}

export const productosBase: ProductoBase[] = [
  { id: 'pr1', nombre: 'Lona impresa', cat: 'Lonas y gran formato', grupo: 'Impresión y publicidad', metodo_calculo: 'm2', unidad: 'm²', precio_venta: 180, precio_minimo: 150, costos: { costo_material: 62, costo_mano_obra: 12, costo_fijo: 0, desperdicio_pct: 8, ganancia_pct: 120 } },
  { id: 'pr2', nombre: 'Impresión de vinil', cat: 'Vinil', grupo: 'Impresión y publicidad', metodo_calculo: 'm2', unidad: 'm²', precio_venta: 260, precio_minimo: 180, costos: { costo_material: 95, costo_mano_obra: 18, costo_fijo: 0, desperdicio_pct: 10, ganancia_pct: 110 } },
  { id: 'pr3', nombre: 'Vinil microperforado', cat: 'Vinil', grupo: 'Impresión y publicidad', metodo_calculo: 'm2', unidad: 'm²', precio_venta: 340, costos: { costo_material: 130, costo_mano_obra: 22, costo_fijo: 0, desperdicio_pct: 10, ganancia_pct: 110 } },
  { id: 'pr4', nombre: 'Rotulación de cristales', cat: 'Rotulación', grupo: 'Impresión y publicidad', metodo_calculo: 'm2', unidad: 'm²', precio_venta: 420 },
  { id: 'pr5', nombre: 'Letrero de acrílico', cat: 'Letreros', grupo: 'Impresión y publicidad', metodo_calculo: 'pieza', unidad: 'pza', precio_venta: null },
  { id: 'pr6', nombre: 'Letrero de neón flex', cat: 'Letreros', grupo: 'Impresión y publicidad', metodo_calculo: 'pieza', unidad: 'pza', precio_venta: null },
  { id: 'pr7', nombre: 'DTF textil', cat: 'DTF', grupo: 'Promocionales y personalización', metodo_calculo: 'metro_lineal', unidad: 'm', precio_venta: 290, costos: { costo_material: 110, costo_mano_obra: 20, costo_fijo: 0, desperdicio_pct: 5, ganancia_pct: 100 } },
  { id: 'pr8', nombre: 'Taza personalizada', cat: 'Artículos personalizados', grupo: 'Promocionales y personalización', metodo_calculo: 'pieza', unidad: 'pza', precio_venta: 95, escalas: [{ desde: 12, precio: 85 }, { desde: 50, precio: 72 }], costos: { costo_material: 38, costo_mano_obra: 8, costo_fijo: 0, desperdicio_pct: 3, ganancia_pct: 100 } },
  { id: 'pr9', nombre: 'Playera / prenda personalizada', cat: 'Artículos personalizados', grupo: 'Promocionales y personalización', metodo_calculo: 'pieza', unidad: 'pza', precio_venta: 210, escalas: [{ desde: 24, precio: 185 }, { desde: 100, precio: 160 }] },
  { id: 'pr10', nombre: 'Termo personalizado', cat: 'Artículos personalizados', grupo: 'Promocionales y personalización', metodo_calculo: 'pieza', unidad: 'pza', precio_venta: null },
  { id: 'pr11', nombre: 'Instalación de publicidad', cat: 'Instalación de publicidad', grupo: 'Impresión y publicidad', metodo_calculo: 'servicio', unidad: 'servicio', precio_venta: null },
  { id: 'pr12', nombre: 'Desarrollo de página web', cat: 'Desarrollo web', grupo: 'Servicios digitales', metodo_calculo: 'proyecto', unidad: 'proyecto', precio_venta: null },
  { id: 'pr13', nombre: 'Contenido para redes sociales', cat: 'Edición y contenido', grupo: 'Servicios digitales', metodo_calculo: 'mensualidad', unidad: 'mes', precio_venta: null },
  { id: 'pr14', nombre: 'Campaña de Meta Ads', cat: 'Publicidad digital', grupo: 'Servicios digitales', metodo_calculo: 'mensualidad', unidad: 'mes', precio_venta: null },
  { id: 'pr15', nombre: 'Tarjetas de presentación', cat: 'Impresión', grupo: 'Impresión y publicidad', metodo_calculo: 'millar', unidad: 'millar', precio_venta: 450 },
]

export function productosDemo(conCostos: boolean): ProductoCatalogo[] {
  return productosBase.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    descripcion: null,
    metodo_calculo: p.metodo_calculo,
    unidad: p.unidad,
    precio_venta: p.precio_venta,
    precio_minimo: p.precio_minimo ?? null,
    escalas: p.escalas ?? [],
    categoria: { id: p.cat, nombre: p.cat, grupo: p.grupo },
    costos: conCostos ? (p.costos ?? null) : null,
  }))
}

type PartidaSemilla = {
  producto?: string
  tipo?: CotizacionCompleta['partidas'][number]['tipo']
  concepto: string
  descripcion?: string
  metodo: CotizacionCompleta['partidas'][number]['metodo_calculo']
  unidad: string
  ancho?: number
  alto?: number
  largo?: number
  cantidad: number
  pu: number
  costo?: number
}

type Semilla = {
  cliente: string
  titulo: string
  diasAtras: number
  estado: CotizacionCompleta['estado']
  vendedor: Rol
  aplicaIva?: boolean
  descuento?: number
  recargo?: number
  partidas: PartidaSemilla[]
  convertida?: boolean
}

const semillas: Semilla[] = [
  {
    cliente: 'c1', titulo: 'Fachada y menú de temporada', diasAtras: 1, estado: 'enviada', vendedor: 'ventas',
    partidas: [
      { producto: 'pr1', concepto: 'Lona impresa 13 oz alta resolución', descripcion: 'Con ojillos cada 50 cm y bastilla perimetral', metodo: 'm2', unidad: 'pza', ancho: 4, alto: 1.2, cantidad: 1, pu: 864, costo: 384 },
      { producto: 'pr3', concepto: 'Vinil microperforado para aparador', metodo: 'm2', unidad: 'pza', ancho: 1.8, alto: 2.1, cantidad: 2, pu: 1285.2, costo: 1180 },
      { tipo: 'instalacion', concepto: 'Instalación en sitio', metodo: 'servicio', unidad: 'servicio', cantidad: 1, pu: 950, costo: 400 },
    ],
  },
  {
    cliente: 'c2', titulo: 'Uniformes del staff', diasAtras: 3, estado: 'borrador', vendedor: 'ventas',
    partidas: [
      { producto: 'pr9', concepto: 'Playera dry-fit con logo frente y espalda', metodo: 'pieza', unidad: 'pza', cantidad: 30, pu: 185, costo: 2850 },
      { producto: 'pr7', concepto: 'DTF textil para mangas', metodo: 'metro_lineal', unidad: 'pza', largo: 1.5, cantidad: 1, pu: 435, costo: 205 },
    ],
  },
  {
    cliente: 'c3', titulo: 'Señalética de consultorios', diasAtras: 6, estado: 'aceptada', vendedor: 'admin', convertida: true,
    partidas: [
      { producto: 'pr5', concepto: 'Letrero de acrílico 3 mm con vinil de corte', descripcion: '30 × 10 cm, con separadores', metodo: 'pieza', unidad: 'pza', cantidad: 8, pu: 420, costo: 1360 },
      { tipo: 'instalacion', concepto: 'Instalación', metodo: 'servicio', unidad: 'servicio', cantidad: 1, pu: 600, costo: 250 },
    ],
  },
  {
    cliente: 'c4', titulo: 'Menú luminoso', diasAtras: 9, estado: 'enviada', vendedor: 'ventas', recargo: 15,
    partidas: [
      { producto: 'pr6', concepto: 'Letrero de neón flex "Los Compadres"', descripcion: 'Color cálido, base de acrílico transparente', metodo: 'pieza', unidad: 'pza', cantidad: 1, pu: 4800, costo: 2300 },
    ],
  },
  {
    cliente: 'c5', titulo: 'Lonas para desarrollos', diasAtras: 12, estado: 'aceptada', vendedor: 'admin', descuento: 5, convertida: true,
    partidas: [
      { producto: 'pr1', concepto: 'Lona impresa 13 oz', metodo: 'm2', unidad: 'pza', ancho: 6, alto: 3, cantidad: 4, pu: 3240, costo: 5760 },
      { tipo: 'transporte', concepto: 'Transporte a obra', metodo: 'servicio', unidad: 'servicio', cantidad: 1, pu: 700, costo: 350 },
    ],
  },
  {
    cliente: 'c6', titulo: 'Tazas para graduación', diasAtras: 15, estado: 'rechazada', vendedor: 'ventas',
    partidas: [{ producto: 'pr8', concepto: 'Taza blanca 11 oz sublimada', metodo: 'pieza', unidad: 'pza', cantidad: 60, pu: 72, costo: 2850 }],
  },
  {
    cliente: 'c7', titulo: 'Tarjetas y etiquetas', diasAtras: 20, estado: 'enviada', vendedor: 'ventas', aplicaIva: false,
    partidas: [{ producto: 'pr15', concepto: 'Tarjetas de presentación couché 300 g', descripcion: 'Frente y vuelta, laminado mate', metodo: 'millar', unidad: 'millar', cantidad: 2, pu: 450, costo: 380 }],
  },
  {
    cliente: 'c8', titulo: 'Rotulación de grúa', diasAtras: 2, estado: 'borrador', vendedor: 'admin',
    partidas: [{ producto: 'pr2', concepto: 'Impresión de vinil laminado para vehículo', metodo: 'm2', unidad: 'pza', ancho: 2.4, alto: 1.1, cantidad: 2, pu: 686.4, costo: 640 }],
  },
  {
    cliente: 'c1', titulo: 'Página web y redes', diasAtras: 4, estado: 'enviada', vendedor: 'admin',
    partidas: [
      { producto: 'pr12', concepto: 'Desarrollo de página web', descripcion: 'Sitio de 5 secciones con menú digital y botón de WhatsApp', metodo: 'proyecto', unidad: 'proyecto', cantidad: 1, pu: 9500, costo: 3200 },
      { producto: 'pr13', concepto: 'Contenido para redes sociales', descripcion: '12 publicaciones al mes', metodo: 'mensualidad', unidad: 'mes', cantidad: 3, pu: 3200, costo: 3600 },
    ],
  },
  {
    // Vence en 2 días: muestra el aviso de "vence pronto" en la lista y en el panel
    cliente: 'c2', titulo: 'Lonas para preventa de membresías', diasAtras: 13, estado: 'enviada', vendedor: 'ventas',
    partidas: [
      { producto: 'pr1', concepto: 'Lona impresa 13 oz', descripcion: 'Con ojillos y bastilla perimetral', metodo: 'm2', unidad: 'pza', ancho: 3, alto: 1.5, cantidad: 2, pu: 810, costo: 720 },
      { tipo: 'instalacion', concepto: 'Colocación en fachada', metodo: 'servicio', unidad: 'servicio', cantidad: 1, pu: 450, costo: 200 },
    ],
  },
]

export function cotizacionesDemo(perfiles: Record<Rol, Perfil>, fechaHoy = hoy()): CotizacionCompleta[] {
  return semillas.map((s, i) => {
    const cliente = clientesDemo.find((c) => c.id === s.cliente)!
    const partidas = s.partidas.map((p, j) => ({
      id: `demo-p${i}-${j}`,
      orden: j + 1,
      tipo: p.tipo ?? 'concepto',
      producto_id: p.producto ?? null,
      concepto: p.concepto,
      descripcion: p.descripcion ?? null,
      metodo_calculo: p.metodo,
      unidad: p.unidad,
      ancho: p.ancho ?? null,
      alto: p.alto ?? null,
      largo: p.largo ?? null,
      cantidad: p.cantidad,
      precio_unitario: p.pu,
      descuento_pct: 0,
      importe: importePartida(p.cantidad, p.pu),
      notas_produccion: null,
      costos: p.costo !== undefined
        ? { costo_material: 0, costo_mano_obra: 0, costo_fijo: p.costo, desperdicio_pct: 0, ganancia_pct: 0, costo_total: p.costo, calculo: { origen: 'manual' } }
        : null,
    }))
    const t = calcularTotales({
      importes: partidas.map((p) => p.importe),
      descuentoTipo: 'pct',
      descuentoValor: s.descuento ?? 0,
      recargoPct: s.recargo ?? 0,
      aplicaIva: s.aplicaIva ?? true,
      ivaPct: 16,
    })
    const fecha = sumarDias(fechaHoy, -s.diasAtras)
    const vendedor = perfiles[s.vendedor]
    const num = String(i + 1).padStart(4, '0')
    return {
      id: `demo-cot-${i + 1}`,
      folio: `COT-${num}`,
      titulo: s.titulo,
      fecha,
      vigencia_dias: 15,
      fecha_vencimiento: sumarDias(fecha, 15),
      estado: s.estado,
      motivo_rechazo: s.estado === 'rechazada' ? 'Eligió otro proveedor por precio' : null,
      tiempo_entrega: '5 a 7 días hábiles después de aprobar el diseño',
      anticipo_pct: 50,
      aplica_iva: s.aplicaIva ?? true,
      iva_pct: 16,
      descuento_tipo: 'pct',
      descuento_valor: s.descuento ?? 0,
      recargo_pct: s.recargo ?? 0,
      recargo_concepto: 'Recargo por urgencia',
      subtotal: t.subtotal,
      descuento: t.descuento,
      recargo: t.recargo,
      iva: t.iva,
      total: t.total,
      condiciones: configuracionDemo.condiciones_cotizacion,
      notas: null,
      notas_internas: null,
      pedido_id: s.convertida ? `demo-ped-${i + 1}` : null,
      pedido_folio: s.convertida ? `PED-${String(40 + i).padStart(4, '0')}` : null,
      enviada_at: s.estado !== 'borrador' ? `${fecha}T17:00:00Z` : null,
      aceptada_at: s.estado === 'aceptada' ? `${sumarDias(fecha, 2)}T17:00:00Z` : null,
      created_at: `${fecha}T16:00:00Z`,
      updated_at: `${fecha}T16:00:00Z`,
      cliente: {
        id: cliente.id,
        nombre: cliente.nombre,
        whatsapp: cliente.whatsapp,
        telefono: cliente.telefono,
        email: cliente.email,
        requiere_factura: cliente.requiere_factura,
        rfc: cliente.rfc,
        razon_social: cliente.razon_social,
        direccion: cliente.direccion,
        ciudad: cliente.ciudad,
      },
      vendedor: { id: vendedor.id, nombre: vendedor.nombre, email: vendedor.email, telefono: null },
      partidas,
    }
  })
}
