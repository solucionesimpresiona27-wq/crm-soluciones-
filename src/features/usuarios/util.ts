import type { EntradaBitacora, Usuario } from '@/data/modulos/administracion/contrato'
import { PERMISOS, type Permiso, type Rol } from '@/data/tipos'
import type { Json } from '@/lib/database.types'
import { ESTADO_COTIZACION, ESTADO_PEDIDO } from '@/lib/estados'
import { dinero } from '@/lib/format'
import { permisosDeRol } from '@/lib/permisos'

export const ROLES: Rol[] = ['admin', 'ventas', 'diseno', 'produccion']

/** Grupos de permisos para la matriz (orden de lectura, no técnico). */
export const GRUPOS_PERMISO: { titulo: string; permisos: Permiso[] }[] = [
  { titulo: 'Dinero', permisos: ['ver_precios', 'ver_costos', 'ver_reportes', 'registrar_pagos', 'cancelar_pagos'] },
  { titulo: 'Ventas', permisos: ['gestionar_clientes', 'gestionar_cotizaciones', 'gestionar_pedidos', 'editar_catalogo'] },
  { titulo: 'Taller', permisos: ['actualizar_produccion', 'aprobar_disenos', 'gestionar_inventario', 'registrar_consumos', 'registrar_gastos'] },
  { titulo: 'Datos', permisos: ['exportar_datos', 'eliminar_registros'] },
]

export interface EstadoPermiso {
  permiso: Permiso
  /** Lo que da el rol */
  delRol: boolean
  /** Lo que tiene realmente */
  efectivo: boolean
  /** Hay una anulación por usuario que difiere del rol */
  anulado: boolean
}

export function estadoPermisos(u: Pick<Usuario, 'rol' | 'permisos_personalizados'>): Record<Permiso, EstadoPermiso> {
  const rol = permisosDeRol(u.rol)
  const final = permisosDeRol(u.rol, u.permisos_personalizados)
  return Object.fromEntries(
    PERMISOS.map((p) => [p, { permiso: p, delRol: rol[p], efectivo: final[p], anulado: u.rol !== 'admin' && final[p] !== rol[p] }]),
  ) as Record<Permiso, EstadoPermiso>
}

/** Cuántas anulaciones reales (distintas del rol) tiene el usuario. */
export function contarAnulaciones(u: Pick<Usuario, 'rol' | 'permisos_personalizados'>) {
  return Object.values(estadoPermisos(u)).filter((e) => e.anulado).length
}

/** Contraseña temporal legible: 4 letras + 4 números + 2 letras, sin caracteres confusos. */
export function generarContrasena(aleatorio: (n: number) => number = aleatorioSeguro) {
  const letras = 'abcdefghjkmnpqrstuvwxyz'
  const mayus = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const nums = '23456789'
  const tomar = (fuente: string, n: number) => Array.from({ length: n }, () => fuente[aleatorio(fuente.length)]).join('')
  return `${tomar(mayus, 1)}${tomar(letras, 3)}-${tomar(nums, 4)}-${tomar(letras, 2)}`
}

function aleatorioSeguro(n: number) {
  const b = new Uint32Array(1)
  crypto.getRandomValues(b)
  return b[0]! % n
}

export function contrasenaValida(p: string) {
  return p.length >= 8 && /[a-zA-Z]/.test(p) && /\d/.test(p)
}

export const correoValido = (c: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.trim())

// ---------------------------------------------------------------- Bitácora

export const NOMBRE_TABLA: Record<string, string> = {
  perfiles: 'Usuarios',
  configuracion: 'Configuración',
  folios: 'Folios',
  clientes: 'Clientes',
  contactos: 'Contactos',
  oportunidades: 'Oportunidades',
  categorias: 'Categorías',
  productos: 'Productos',
  producto_costos: 'Costos de producto',
  producto_precios: 'Precios por lista',
  cotizaciones: 'Cotizaciones',
  pedidos: 'Pedidos',
  partidas: 'Partidas',
  partida_costos: 'Costos de partida',
  pagos: 'Pagos',
  archivos: 'Archivos y diseños',
  plantillas_mensaje: 'Plantillas de WhatsApp',
  tareas: 'Tareas',
  proveedores: 'Proveedores',
  materiales: 'Materiales',
  material_costos: 'Costos de material',
  movimientos_inventario: 'Inventario',
  gastos: 'Gastos',
  cortes_caja: 'Corte de caja',
  portal_enlaces: 'Portal de clientes',
}

export const ACCIONES_BITACORA = {
  crear: 'Creó',
  modificar: 'Modificó',
  eliminar: 'Eliminó',
  cambio_estado: 'Cambió el estado',
  aprobar: 'Aprobó',
  cancelar: 'Canceló',
} as const
export type AccionBitacora = keyof typeof ACCIONES_BITACORA

const CAMPOS: Record<string, string> = {
  nombre_comercial: 'Nombre comercial',
  eslogan: 'Eslogan',
  ciudad: 'Ciudad',
  direccion: 'Dirección',
  telefono: 'Teléfono',
  whatsapp: 'WhatsApp',
  email: 'Correo',
  sitio_web: 'Sitio web',
  rfc: 'RFC',
  razon_social: 'Razón social',
  regimen_fiscal: 'Régimen fiscal',
  mostrar_datos_fiscales: 'Mostrar datos fiscales',
  datos_bancarios: 'Datos bancarios',
  logo_url: 'Logo',
  iva_pct: 'IVA %',
  anticipo_pct: 'Anticipo %',
  vigencia_dias: 'Vigencia (días)',
  tiempo_entrega_default: 'Tiempo de entrega',
  condiciones_cotizacion: 'Condiciones',
  notas_pie_cotizacion: 'Notas al pie',
  metodos_pago_activos: 'Métodos de pago',
  prefijo_cotizacion: 'Prefijo de cotización',
  prefijo_pedido: 'Prefijo de pedido',
  dias_reactivacion: 'Días para reactivación',
  rol: 'Rol',
  activo: 'Activo',
  permisos: 'Permisos personalizados',
  comision_pct: 'Comisión %',
  puesto: 'Puesto',
  estado: 'Estado',
  texto: 'Mensaje',
  nombre: 'Nombre',
  total: 'Total',
  monto: 'Monto',
  notas: 'Notas',
  metodo: 'Método',
  metodo_pago: 'Método de pago',
  estado_pago: 'Estado de pago',
  iva: 'IVA',
}

export const nombreCampo = (c: string) =>
  CAMPOS[c] ?? c.replace(/_at$/, '').replace(/_pct$/, ' %').replace(/_/g, ' ').replace(/^./, (l) => l.toUpperCase())

/** Valor de la bitácora en texto legible. */
export function valorLegible(v: Json | undefined): string {
  if (v === null || v === undefined || v === '') return 'vacío'
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (Array.isArray(v)) return v.length ? v.map((x) => valorLegible(x)).join(', ') : 'ninguno'
  if (typeof v === 'object') {
    const pares = Object.entries(v)
    if (!pares.length) return 'ninguno'
    return pares.map(([k, x]) => `${nombreCampo(k)}: ${valorLegible(x as Json)}`).join(' · ')
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    const d = new Date(v)
    if (!Number.isNaN(d.getTime())) return d.toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  }
  return String(v)
}

export interface CambioLegible {
  campo: string
  antes: string
  despues: string
}

const OCULTOS = new Set(['updated_at', 'created_at', 'busqueda', 'id'])

/** Campos de dinero: se muestran como $1,879.20 en vez de 1879.2. */
const DINERO = new Set([
  'total', 'subtotal', 'iva', 'saldo', 'pagado', 'importe', 'monto', 'precio', 'precio_unitario', 'precio_venta', 'precio_minimo',
  'valor_estimado', 'descuento_monto', 'costo_unitario', 'costo_total', 'costo_material', 'costo_mano_obra', 'costo_fijo',
  'efectivo_inicial', 'efectivo_contado', 'esperado', 'diferencia',
])

/** Totales que la base calcula después de crear el registro (al crearlo valen 0 y confunden). */
const CALCULADOS = new Set(['total', 'subtotal', 'iva', 'saldo', 'pagado', 'descuento_monto'])

/** Códigos de la base (enums) en español, por campo. `estado` depende de la tabla. */
const CODIGOS: Record<string, Record<string, string>> = {
  metodo: { efectivo: 'Efectivo', transferencia: 'Transferencia', deposito: 'Depósito', tarjeta: 'Tarjeta' },
  tipo_pago: { anticipo: 'Anticipo', abono: 'Abono', liquidacion: 'Liquidación', devolucion: 'Devolución' },
  estado_pago: { pendiente: 'Pendiente', anticipo: 'Con anticipo', parcial: 'Pago parcial', liquidado: 'Liquidado', reembolsado: 'Reembolsado' },
  etapa: {
    prospecto_nuevo: 'Prospecto', contactado: 'Contactado', interesado: 'Interesado', cotizacion_enviada: 'Cotización enviada',
    en_seguimiento: 'En seguimiento', ganado: 'Ganado', perdido: 'Perdido',
  },
  tipo_movimiento: { entrada: 'Entrada', consumo: 'Consumo', ajuste: 'Ajuste', merma: 'Merma' },
  tipo_tarea: { tarea: 'Tarea', llamada: 'Llamada', seguimiento: 'Seguimiento', entrega: 'Entrega', instalacion: 'Instalación', recordatorio: 'Recordatorio' },
  tipo_partida: { concepto: 'Concepto', instalacion: 'Instalación', transporte: 'Transporte', diseno: 'Diseño', extra: 'Extra' },
  prioridad: { baja: 'Baja', normal: 'Normal', alta: 'Alta', urgente: 'Urgente' },
  estado_archivo: { no_aplica: 'No aplica', pendiente: 'Por aprobar', aprobado: 'Aprobado', cambios: 'Pidió cambios', rechazado: 'Rechazado' },
  rol: { admin: 'Administración', ventas: 'Ventas', diseno: 'Diseño', produccion: 'Producción' },
}

function codigos(tabla: string | undefined, campo: string): Record<string, string> | undefined {
  if (campo === 'estado') {
    if (tabla === 'pedidos') return Object.fromEntries(Object.entries(ESTADO_PEDIDO).map(([k, v]) => [k, v.etiqueta]))
    if (tabla === 'cotizaciones') return Object.fromEntries(Object.entries(ESTADO_COTIZACION).map(([k, v]) => [k, v.etiqueta]))
    if (tabla === 'archivos') return CODIGOS.estado_archivo
    return undefined
  }
  if (campo === 'tipo') {
    if (tabla === 'pagos') return CODIGOS.tipo_pago
    if (tabla === 'movimientos_inventario') return CODIGOS.tipo_movimiento
    if (tabla === 'tareas') return CODIGOS.tipo_tarea
    if (tabla === 'partidas') return CODIGOS.tipo_partida
    return undefined
  }
  if (campo === 'metodo' || campo === 'metodo_pago') return CODIGOS.metodo
  if (campo === 'estado_aprobacion') return CODIGOS.estado_archivo
  return CODIGOS[campo]
}

/** Valor legible de un campo concreto: montos con formato de dinero y códigos en español. */
export function valorCampo(tabla: string | undefined, campo: string, v: Json | undefined): string {
  if (DINERO.has(campo) && v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v)) && typeof v !== 'boolean') return dinero(Number(v))
  if (typeof v === 'string') {
    const texto = codigos(tabla, campo)?.[v]
    if (texto) return texto
  }
  return valorLegible(v)
}

/** Diferencias {campo: [antes, después]} de tg_bitacora a una lista legible. */
export function cambiosLegibles(e: Pick<EntradaBitacora, 'cambios' | 'datos' | 'accion'> & { tabla?: string }): CambioLegible[] {
  const c = e.cambios
  if (c && typeof c === 'object' && !Array.isArray(c)) {
    return Object.entries(c)
      .filter(([k]) => !OCULTOS.has(k))
      .map(([k, par]) => {
        const [antes, despues] = Array.isArray(par) ? par : [null, par]
        return { campo: nombreCampo(k), antes: valorCampo(e.tabla, k, antes), despues: valorCampo(e.tabla, k, despues) }
      })
  }
  return []
}

/** Resumen corto de un registro creado o eliminado (los primeros campos con valor). */
export function resumenDatos(datos: Json | null, max = 4, tabla?: string): { campo: string; valor: string }[] {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return []
  return Object.entries(datos)
    .filter(([k, v]) => !OCULTOS.has(k) && !k.endsWith('_id') && v !== null && v !== '' && typeof v !== 'object')
    // Un total en 0 al crear es provisional: la base lo recalcula al agregar los conceptos
    .filter(([k, v]) => !(CALCULADOS.has(k) && Number(v) === 0))
    .slice(0, max)
    .map(([k, v]) => ({ campo: nombreCampo(k), valor: valorCampo(tabla, k, v as Json) }))
}
