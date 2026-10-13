/**
 * Semilla de la vista previa · comercial: clientes (completos), contactos, oportunidades
 * (embudo) y actividades. DATOS FICTICIOS: ningún nombre, teléfono ni RFC es real.
 *
 * El embudo y los seguimientos del panel salen de estas oportunidades y dan los mismos
 * números que la vista previa anterior (4 prospectos por $18,400, etc.).
 */
import type { Almacen, ClienteFila } from './almacen'
import { clientesDemo } from './datosDemo'
import { busquedaDe, type Ctx } from './semillaContexto'

type Extra = Partial<ClienteFila> & { creado: number }

/** Datos adicionales de los clientes de la vista previa anterior (mismos ids y nombres). */
const EXTRA: Record<string, Extra> = {
  c1: { tipo: 'empresa', etiquetas: ['recurrente'], origen: 'Instagram', vendedor_id: 'demo-ventas', regimen_fiscal: '601 General de Ley Personas Morales', codigo_postal_fiscal: '44160', uso_cfdi: 'G03', email_facturacion: 'facturas@barrioalto.demo', creado: 260 },
  c2: { tipo: 'empresa', etiquetas: ['recurrente'], origen: 'Recomendación', vendedor_id: 'demo-ventas', creado: 240 },
  c3: { tipo: 'empresa', etiquetas: ['salud'], origen: 'Google', vendedor_id: 'demo-admin', regimen_fiscal: '601 General de Ley Personas Morales', codigo_postal_fiscal: '44600', uso_cfdi: 'G03', creado: 220 },
  c4: { tipo: 'persona', etiquetas: ['restaurante'], origen: 'WhatsApp', vendedor_id: 'demo-ventas', creado: 210 },
  c5: { tipo: 'empresa', etiquetas: ['mayoreo', 'recurrente'], origen: 'Visita', vendedor_id: 'demo-admin', lista_precio: 'mayoreo', dias_credito: 15, regimen_fiscal: '601 General de Ley Personas Morales', codigo_postal_fiscal: '45110', uso_cfdi: 'G03', email_facturacion: 'cxp@horizonte.demo', creado: 200 },
  c6: { tipo: 'empresa', etiquetas: ['educación'], origen: 'Facebook', vendedor_id: 'demo-ventas', creado: 190 },
  c7: { tipo: 'persona', etiquetas: ['comercio'], origen: 'Instagram', vendedor_id: 'demo-ventas', creado: 180 },
  c8: { tipo: 'persona', etiquetas: ['automotriz'], origen: 'Recomendación', vendedor_id: 'demo-admin', creado: 175 },
}

/** Clientes nuevos de la vista previa: compradores antiguos, una agencia, prospectos y uno inactivo. */
const NUEVOS: Array<Partial<ClienteFila> & { id: string; nombre: string; creado: number }> = [
  { id: 'c9', nombre: 'Farmacia San Rafael', tipo: 'empresa', whatsapp: '3399990011', email: 'compras@sanrafael.demo', ciudad: 'Guadalajara', etiquetas: ['salud'], origen: 'Google', vendedor_id: 'demo-ventas', notas: 'Compró señalética hace meses. Buen candidato para promociones de temporada.', creado: 170 },
  { id: 'c10', nombre: 'Agencia Creativa Nube', tipo: 'empresa', whatsapp: '3310102020', email: 'produccion@nube.demo', ciudad: 'Zapopan', etiquetas: ['agencia', 'revendedor'], origen: 'Recomendación', vendedor_id: 'demo-admin', lista_precio: 'agencia', requiere_factura: true, rfc: 'ACN180905JK4', razon_social: 'Agencia Creativa Nube S.A.S.', regimen_fiscal: '601 General de Ley Personas Morales', codigo_postal_fiscal: '45050', uso_cfdi: 'G03', dias_credito: 30, notas: 'Revende nuestros trabajos con su marca: no incluir el logo de Impresiona en las entregas.', creado: 160 },
  { id: 'c11', nombre: 'Hotel Vista Chapala', tipo: 'empresa', whatsapp: '3761234567', email: 'gerencia@vistachapala.demo', ciudad: 'Chapala', etiquetas: ['turismo'], origen: 'Visita', vendedor_id: 'demo-ventas', requiere_factura: true, creado: 158 },
  { id: 'c12', nombre: 'Despacho Contable Ortega', tipo: 'empresa', whatsapp: '3312345678', email: 'contacto@ortega.demo', ciudad: 'Guadalajara', etiquetas: ['prospecto'], origen: 'Google', vendedor_id: 'demo-ventas', creado: 9 },
  { id: 'c13', nombre: 'Florería Bugambilia', tipo: 'persona', whatsapp: '3323456789', ciudad: 'Tlaquepaque', etiquetas: ['prospecto'], origen: 'Instagram', vendedor_id: 'demo-ventas', creado: 7 },
  { id: 'c14', nombre: 'Ferretería El Tornillo', tipo: 'empresa', whatsapp: '3334567890', ciudad: 'Tonalá', etiquetas: ['prospecto'], origen: 'Volante', vendedor_id: 'demo-admin', creado: 6 },
  { id: 'c15', nombre: 'Colegio Bilingüe Alameda', tipo: 'empresa', whatsapp: '3345678901', email: 'direccion@alameda.demo', ciudad: 'Zapopan', etiquetas: ['educación', 'prospecto'], origen: 'Recomendación', vendedor_id: 'demo-admin', requiere_factura: true, creado: 14 },
  { id: 'c16', nombre: 'Estética Glamour', tipo: 'persona', whatsapp: '3356789012', ciudad: 'Guadalajara', etiquetas: ['prospecto'], origen: 'Facebook', vendedor_id: 'demo-ventas', creado: 4 },
  { id: 'c17', nombre: 'Constructora Altos de Jalisco', tipo: 'empresa', whatsapp: '3367890123', email: 'obras@altos.demo', ciudad: 'Zapopan', etiquetas: ['construcción', 'mayoreo'], origen: 'Visita', vendedor_id: 'demo-admin', lista_precio: 'mayoreo', requiere_factura: true, dias_credito: 30, creado: 20 },
  { id: 'c18', nombre: 'Papelería El Lápiz', tipo: 'persona', whatsapp: '3378901234', ciudad: 'Guadalajara', etiquetas: [], origen: 'WhatsApp', vendedor_id: 'demo-ventas', activo: false, notas: 'Cerró el negocio. Se conserva por su historial.', creado: 300 },
]

export function semillaClientes(c: Ctx): ClienteFila[] {
  const base = (x: Partial<ClienteFila> & { id: string; nombre: string; creado: number }): ClienteFila => {
    const fila: ClienteFila = {
      id: x.id,
      nombre: x.nombre,
      tipo: x.tipo ?? 'empresa',
      telefono: x.telefono ?? null,
      whatsapp: x.whatsapp ?? null,
      email: x.email ?? null,
      direccion: x.direccion ?? null,
      ciudad: x.ciudad ?? null,
      notas: x.notas ?? null,
      etiquetas: x.etiquetas ?? [],
      origen: x.origen ?? null,
      requiere_factura: x.requiere_factura ?? false,
      rfc: x.rfc ?? null,
      razon_social: x.razon_social ?? null,
      regimen_fiscal: x.regimen_fiscal ?? null,
      codigo_postal_fiscal: x.codigo_postal_fiscal ?? null,
      uso_cfdi: x.uso_cfdi ?? null,
      email_facturacion: x.email_facturacion ?? null,
      dias_credito: x.dias_credito ?? 0,
      vendedor_id: x.vendedor_id ?? null,
      lista_precio: x.lista_precio ?? 'publico',
      ultima_compra_at: null,
      activo: x.activo ?? true,
      busqueda: null,
      created_by: x.vendedor_id ?? 'demo-admin',
      created_at: c.ts(c.dia(-x.creado), 11),
      updated_at: c.ts(c.dia(-x.creado), 11),
    }
    fila.busqueda = busquedaDe(fila.nombre, fila.telefono, fila.whatsapp, fila.email, fila.rfc, fila.razon_social)
    return fila
  }
  return [
    ...clientesDemo.map((d) => base({ ...d, ...EXTRA[d.id] })),
    ...NUEVOS.map(base),
  ]
}

export function semillaContactos(c: Ctx): Almacen['contactos'] {
  const filas: Array<[string, string, string | null, string | null, string | null, boolean]> = [
    ['c1', 'Mariana Pérez', 'Gerente', '3311112233', 'mariana@barrioalto.demo', true],
    ['c1', 'Jorge Ruiz', 'Compras', '3311119988', null, false],
    ['c3', 'Dra. Mariana Gil', 'Directora', '3333334455', 'admin@sonrie.demo', true],
    ['c5', 'Ing. Roberto Salas', 'Gerente de proyectos', '3355556677', 'rsalas@horizonte.demo', true],
    ['c5', 'Lucía Torres', 'Administración', '3355550011', 'cxp@horizonte.demo', false],
    ['c6', 'Mtra. Elena Campos', 'Dirección', '3366667788', null, true],
    ['c10', 'Andrés Medina', 'Director creativo', '3310102020', 'andres@nube.demo', true],
    ['c17', 'Arq. Paola Méndez', 'Residente de obra', '3367890123', 'obras@altos.demo', true],
  ]
  return filas.map(([cliente_id, nombre, puesto, whatsapp, email, principal], i) => ({
    id: `ct${i + 1}`,
    cliente_id,
    nombre,
    puesto,
    telefono: null,
    whatsapp,
    email,
    principal,
    notas: null,
    created_at: c.ts(c.dia(-150 + i), 12),
    updated_at: c.ts(c.dia(-150 + i), 12),
  }))
}

type Op = {
  id: string
  cliente: string
  titulo: string
  etapa: Almacen['oportunidades'][number]['etapa']
  valor: number
  resp: string
  accion?: string
  fecha?: number | null
  creada: number
  /** Días atrás en que se cerró (ganado/perdido); `mesesAtras` para cierres viejos */
  cerrada?: number
  cerradaMeses?: number
  motivo?: string
  origen?: string
  descripcion?: string
}

/**
 * 23 oportunidades. Abiertas + cerradas este mes = embudo del panel:
 * prospecto 4/$18,400 · contactado 3/$12,600 · interesado 2/$21,300 · cotización 4/$31,940 ·
 * seguimiento 2/$7,400 · ganado 5/$62,800 · perdido 1/$5,011. Seguimientos vencidos: solo o1 y o2.
 */
const OPORTUNIDADES: Op[] = [
  { id: 'o3', cliente: 'c12', titulo: 'Señalética para despacho', etapa: 'prospecto_nuevo', valor: 6500, resp: 'demo-ventas', accion: 'Llamar para presentar el catálogo', fecha: 2, creada: 9, origen: 'Google' },
  { id: 'o4', cliente: 'c13', titulo: 'Imagen para florería', etapa: 'prospecto_nuevo', valor: 4200, resp: 'demo-ventas', accion: 'Enviar ejemplos de lonas y tarjetas', fecha: 3, creada: 7, origen: 'Instagram' },
  { id: 'o5', cliente: 'c16', titulo: 'Lona y tarjetas para estética', etapa: 'prospecto_nuevo', valor: 3900, resp: 'demo-ventas', fecha: null, creada: 4, origen: 'Facebook' },
  { id: 'o6', cliente: 'c14', titulo: 'Rotulación de fachada', etapa: 'prospecto_nuevo', valor: 3800, resp: 'demo-admin', accion: 'Visitar para tomar medidas', fecha: 5, creada: 6, origen: 'Volante' },
  { id: 'o7', cliente: 'c15', titulo: 'Señalética escolar', etapa: 'contactado', valor: 5200, resp: 'demo-admin', accion: 'Confirmar número de salones', fecha: 1, creada: 14 },
  { id: 'o8', cliente: 'c9', titulo: 'Promoción de temporada', etapa: 'contactado', valor: 4100, resp: 'demo-ventas', accion: 'Mandar propuesta de vinil para aparador', fecha: 4, creada: 12, descripcion: 'Cliente para reactivar: no compra desde hace meses.' },
  { id: 'o9', cliente: 'c11', titulo: 'Material para eventos del hotel', etapa: 'contactado', valor: 3300, resp: 'demo-ventas', accion: 'Llamar a gerencia', fecha: 6, creada: 10 },
  { id: 'o10', cliente: 'c17', titulo: 'Lonas para obra', etapa: 'interesado', valor: 14800, resp: 'demo-admin', accion: 'Cotizar 12 lonas de 6 × 3 m', fecha: 2, creada: 18, descripcion: 'Doce lonas para la barda perimetral del desarrollo.' },
  { id: 'o11', cliente: 'c10', titulo: 'Maquila de impresión para agencia', etapa: 'interesado', valor: 6500, resp: 'demo-admin', accion: 'Enviar lista de precios de agencia', fecha: 3, creada: 15 },
  { id: 'o1', cliente: 'c4', titulo: 'Menú luminoso', etapa: 'cotizacion_enviada', valor: 5568, resp: 'demo-ventas', accion: 'Llamar para resolver dudas del neón', fecha: 0, creada: 12 },
  { id: 'o12', cliente: 'c1', titulo: 'Fachada y menú de temporada', etapa: 'cotizacion_enviada', valor: 9800, resp: 'demo-ventas', accion: 'Preguntar si revisaron la cotización', fecha: 1, creada: 5 },
  { id: 'o13', cliente: 'c2', titulo: 'Lonas para preventa de membresías', etapa: 'cotizacion_enviada', valor: 7072, resp: 'demo-ventas', accion: 'Recordar que la cotización vence pronto', fecha: 2, creada: 16 },
  { id: 'o14', cliente: 'c1', titulo: 'Página web y redes', etapa: 'cotizacion_enviada', valor: 9500, resp: 'demo-admin', accion: 'Agendar llamada para revisar el alcance', fecha: 3, creada: 8 },
  { id: 'o2', cliente: 'c7', titulo: 'Tarjetas y etiquetas', etapa: 'en_seguimiento', valor: 900, resp: 'demo-ventas', accion: 'Enviar muestras de papel', fecha: -1, creada: 22 },
  { id: 'o15', cliente: 'c8', titulo: 'Rotulación de grúa', etapa: 'en_seguimiento', valor: 6500, resp: 'demo-admin', accion: 'Mandar fotos de trabajos similares', fecha: 4, creada: 5 },
  { id: 'o16', cliente: 'c5', titulo: 'Lonas para desarrollos', etapa: 'ganado', valor: 18000, resp: 'demo-admin', creada: 16, cerrada: 10 },
  { id: 'o17', cliente: 'c8', titulo: 'Letras volumétricas', etapa: 'ganado', valor: 15000, resp: 'demo-admin', creada: 14, cerrada: 6 },
  { id: 'o18', cliente: 'c3', titulo: 'Señalética de consultorios', etapa: 'ganado', valor: 12500, resp: 'demo-admin', creada: 9, cerrada: 4 },
  { id: 'o19', cliente: 'c8', titulo: 'Rotulación de camioneta', etapa: 'ganado', valor: 9800, resp: 'demo-ventas', creada: 18, cerrada: 12 },
  { id: 'o20', cliente: 'c2', titulo: 'Playeras para torneo', etapa: 'ganado', valor: 7500, resp: 'demo-ventas', creada: 11, cerrada: 6 },
  { id: 'o21', cliente: 'c6', titulo: 'Tazas para graduación', etapa: 'perdido', valor: 5011, resp: 'demo-ventas', creada: 17, cerrada: 3, motivo: 'Eligió otro proveedor por precio' },
  { id: 'o22', cliente: 'c9', titulo: 'Señalética interior', etapa: 'ganado', valor: 9000, resp: 'demo-ventas', creada: 160, cerradaMeses: 5 },
  { id: 'o23', cliente: 'c11', titulo: 'Lonas para boda en el jardín', etapa: 'perdido', valor: 6200, resp: 'demo-ventas', creada: 120, cerradaMeses: 3, motivo: 'Presupuesto insuficiente' },
]

export function semillaOportunidades(c: Ctx): Almacen['oportunidades'] {
  return OPORTUNIDADES.map((o) => {
    let cerrada: string | null = null
    if (o.cerrada !== undefined) cerrada = c.ts(c.enMesActual(c.dia(-o.cerrada)), 13)
    if (o.cerradaMeses !== undefined) cerrada = c.ts(c.mes(o.cerradaMeses).dia(12), 13)
    const creada = c.ts(o.cerradaMeses !== undefined ? c.mes(o.cerradaMeses + 1).dia(20) : c.dia(-o.creada), 9)
    return {
      id: o.id,
      cliente_id: o.cliente,
      titulo: o.titulo,
      descripcion: o.descripcion ?? null,
      etapa: o.etapa,
      valor_estimado: o.valor,
      responsable_id: o.resp,
      origen: o.origen ?? null,
      proxima_accion: o.accion ?? null,
      proxima_accion_fecha: o.fecha === undefined || o.fecha === null ? null : c.dia(o.fecha),
      motivo_perdida: o.motivo ?? null,
      cerrada_at: cerrada,
      created_by: o.resp,
      created_at: creada,
      updated_at: cerrada ?? creada,
    }
  })
}

/** Cotización → oportunidad (para la agenda y el detalle de la oportunidad). */
export const COTIZACION_OPORTUNIDAD: Record<string, string> = {
  'demo-cot-1': 'o12',
  'demo-cot-3': 'o18',
  'demo-cot-4': 'o1',
  'demo-cot-5': 'o16',
  'demo-cot-6': 'o21',
  'demo-cot-7': 'o2',
  'demo-cot-8': 'o15',
  'demo-cot-9': 'o14',
  'demo-cot-10': 'o13',
}

export function semillaActividades(c: Ctx): Almacen['actividades'] {
  const filas: Array<[string, string | null, string, string, number, string]> = [
    ['c4', 'o1', 'llamada', 'Se presentó la propuesta del menú luminoso; le gustó el color cálido.', -9, 'demo-ventas'],
    ['c4', 'o1', 'whatsapp', 'Preguntó cuánto consume de luz el neón flex.', -2, 'demo-ventas'],
    ['c7', 'o2', 'whatsapp', 'Envió referencias de tarjetas con acabado mate.', -20, 'demo-ventas'],
    ['c7', 'o2', 'nota', 'Pidió muestras de papel antes de decidir.', -6, 'demo-ventas'],
    ['c5', 'o16', 'visita', 'Visita a la obra para medir las bardas.', -14, 'demo-admin'],
    ['c5', 'o16', 'reunion', 'Reunión con el Ing. Salas: aprobó la primera fase de lonas.', -11, 'demo-admin'],
    ['c3', 'o18', 'llamada', 'La Dra. Gil confirmó el anticipo de la señalética.', -4, 'demo-admin'],
    ['c6', 'o21', 'nota', 'El cliente eligió otro proveedor por precio.', -3, 'demo-ventas'],
    ['c12', 'o3', 'nota', 'Llegó por Google; pidió el catálogo de señalética.', -9, 'demo-ventas'],
    ['c17', 'o10', 'visita', 'Recorrido por la obra: 12 lonas de 6 × 3 m para la barda.', -5, 'demo-admin'],
    ['c1', 'o14', 'correo', 'Se envió la cotización de la página web y redes.', -4, 'demo-admin'],
    ['c1', null, 'whatsapp', 'Mariana pidió cambiar el horario en los volantes.', -2, 'demo-ventas'],
    ['c9', 'o8', 'whatsapp', 'Se le escribió para ofrecer la promoción de temporada.', -3, 'demo-ventas'],
    ['c10', 'o11', 'llamada', 'Andrés pidió precios de agencia para lonas y vinil.', -7, 'demo-admin'],
    ['c2', 'o13', 'whatsapp', 'Se recordó que la cotización de lonas vence pronto.', -1, 'demo-ventas'],
  ]
  return filas.map(([cliente_id, oportunidad_id, tipo, descripcion, dias, usuario_id], i) => ({
    id: `ac${i + 1}`,
    cliente_id,
    oportunidad_id,
    tipo,
    descripcion,
    fecha: c.ts(c.dia(dias), 10 + (i % 7), 15),
    usuario_id,
    created_at: c.ts(c.dia(dias), 10 + (i % 7), 15),
  }))
}
