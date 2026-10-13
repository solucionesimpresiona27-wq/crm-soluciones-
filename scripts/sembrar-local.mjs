// Carga usuarios y datos de prueba en Supabase LOCAL (supabase start). Nunca lo uses en producción.
// Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... node scripts/sembrar-local.mjs
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON = process.env.SUPABASE_ANON_KEY
if (!URL || !SERVICE || !ANON) throw new Error('Faltan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y SUPABASE_ANON_KEY')
if (!/127\.0\.0\.1|localhost/.test(URL)) throw new Error('Este script solo se ejecuta contra Supabase local')

export const USUARIOS = {
  admin: { email: 'admin@impresiona.local', password: 'Impresiona2026', nombre: 'Ana Ramírez' },
  ventas: { email: 'ventas@impresiona.local', password: 'Impresiona2026', nombre: 'Luis Herrera' },
  diseno: { email: 'diseno@impresiona.local', password: 'Impresiona2026', nombre: 'Sofía Méndez' },
  produccion: { email: 'produccion@impresiona.local', password: 'Impresiona2026', nombre: 'Jorge Castillo' },
}

const sistema = createClient(URL, SERVICE, { auth: { persistSession: false } })

async function usuario(rol, u) {
  const { data: lista } = await sistema.auth.admin.listUsers({ perPage: 200 })
  const existente = lista?.users.find((x) => x.email === u.email)
  if (existente) return existente.id
  const { data, error } = await sistema.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    app_metadata: { rol, activo: true, nombre: u.nombre },
  })
  if (error) throw error
  return data.user.id
}

async function sesion(u) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email: u.email, password: u.password })
  if (error) throw error
  return c
}

const ok = (r) => {
  if (r.error) throw r.error
  return r.data
}

// El administrador se crea primero para que sea el primer usuario del sistema
await usuario('admin', USUARIOS.admin)
for (const rol of ['ventas', 'diseno', 'produccion']) await usuario(rol, USUARIOS[rol])

const admin = await sesion(USUARIOS.admin)
const ventas = await sesion(USUARIOS.ventas)

const { count } = await sistema.from('clientes').select('*', { count: 'exact', head: true })
if (!count) {
  // Precios y costos de prueba
  const productos = ok(await admin.from('productos').select('id, nombre'))
  const id = (n) => productos.find((p) => p.nombre === n)?.id
  const precios = [
    ['Lona impresa', 180, { costo_material: 62, costo_mano_obra: 12, desperdicio_pct: 8, ganancia_pct: 120 }],
    ['Impresión de vinil', 260, { costo_material: 95, costo_mano_obra: 18, desperdicio_pct: 10, ganancia_pct: 110 }],
    ['Taza personalizada', 95, { costo_material: 38, costo_mano_obra: 8, desperdicio_pct: 3, ganancia_pct: 100 }],
  ]
  for (const [nombre, precio, costos] of precios) {
    ok(await admin.from('productos').update({ precio_venta: precio }).eq('id', id(nombre)))
    ok(await admin.from('producto_costos').upsert({ producto_id: id(nombre), ...costos }))
  }

  const clientes = ok(
    await ventas
      .from('clientes')
      .insert([
        { nombre: 'Cafetería Barrio Alto (prueba)', whatsapp: '3311112233', requiere_factura: true, rfc: 'CBA210512AB1' },
        { nombre: 'Gimnasio Titán (prueba)', whatsapp: '3322223344' },
        { nombre: 'Clínica Dental Sonríe (prueba)', whatsapp: '3333334455' },
      ], { defaultToNull: false })
      .select('id, nombre'),
  )
  const c = (n) => clientes.find((x) => x.nombre.startsWith(n)).id

  const q1 = ok(await ventas.rpc('guardar_cotizacion', {
    p_datos: {
      cliente_id: c('Cafetería'), titulo: 'Fachada y menú',
      partidas: [
        { producto_id: id('Lona impresa'), concepto: 'Lona impresa 13 oz', metodo_calculo: 'm2', unidad: 'pza', ancho: 4, alto: 1.2, cantidad: 1, precio_unitario: 864 },
        { tipo: 'instalacion', concepto: 'Instalación en sitio', metodo_calculo: 'servicio', unidad: 'servicio', cantidad: 1, precio_unitario: 950 },
      ],
    },
  }))
  ok(await ventas.from('cotizaciones').update({ estado: 'enviada' }).eq('id', q1.id))

  ok(await ventas.rpc('guardar_cotizacion', {
    p_datos: {
      cliente_id: c('Gimnasio'), titulo: 'Tazas para clientes',
      partidas: [{ producto_id: id('Taza personalizada'), concepto: 'Taza sublimada 11 oz', metodo_calculo: 'pieza', unidad: 'pza', cantidad: 24, precio_unitario: 95 }],
    },
  }))

  const q3 = ok(await ventas.rpc('guardar_cotizacion', {
    p_datos: {
      cliente_id: c('Clínica'), titulo: 'Vinil para recepción',
      partidas: [{ producto_id: id('Impresión de vinil'), concepto: 'Vinil impreso laminado', metodo_calculo: 'm2', unidad: 'pza', ancho: 2, alto: 1.5, cantidad: 2, precio_unitario: 780 }],
    },
  }))
  const pedido = ok(await ventas.rpc('convertir_cotizacion_a_pedido', { p_cotizacion: q3.id, p_fecha_entrega: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10) }))
  ok(await ventas.from('pagos').insert({ pedido_id: pedido, importe: 1500, tipo: 'anticipo', metodo: 'transferencia', referencia: 'SPEI prueba' }))
  ok(await ventas.from('oportunidades').insert({ cliente_id: c('Gimnasio'), titulo: 'Uniformes', etapa: 'interesado', valor_estimado: 6000, proxima_accion: 'Enviar muestras', proxima_accion_fecha: new Date().toISOString().slice(0, 10) }))
}

// Fases 2 y 3: proveedores, inventario, gastos y tareas de prueba (una sola vez)
const { count: materiales } = await sistema
  .from('materiales')
  .select('*', { count: 'exact', head: true })
  .eq('nombre', 'Vinil blanco brillante (prueba)')
if (!materiales) {
  const produccion = await sesion(USUARIOS.produccion)
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  const perfiles = ok(await admin.from('perfiles').select('id, email'))
  const idDe = (rol) => perfiles.find((p) => p.email === USUARIOS[rol].email)?.id

  const provs = ok(await admin.from('proveedores').insert([
    { nombre: 'Distribuidora de Vinil (prueba)', categoria: 'Vinil y lonas', whatsapp: '3344445566' },
    { nombre: 'Maquila Láser GDL (prueba)', categoria: 'Maquila', whatsapp: '3355556677' },
  ], { defaultToNull: false }).select('id, nombre'))
  const prov = (n) => provs.find((p) => p.nombre.startsWith(n)).id

  const mats = ok(await admin.from('materiales').insert([
    { nombre: 'Vinil blanco brillante (prueba)', categoria: 'Vinil', unidad: 'm2', existencia: 45, stock_minimo: 20, proveedor_id: prov('Distribuidora'), ubicacion: 'Rack 1' },
    { nombre: 'Lona front 13 oz (prueba)', categoria: 'Lonas', unidad: 'm2', existencia: 12, stock_minimo: 30, proveedor_id: prov('Distribuidora'), ubicacion: 'Rack 2' },
    { nombre: 'Tinta ecosolvente cian (prueba)', categoria: 'Tintas', unidad: 'litro', existencia: 1.5, stock_minimo: 2, ubicacion: 'Gabinete' },
    { nombre: 'Papel couché 300 g (prueba)', categoria: 'Papel', unidad: 'hoja', existencia: 800, stock_minimo: 200, ubicacion: 'Anaquel A' },
  ], { defaultToNull: false }).select('id, nombre'))
  const mat = (n) => mats.find((m) => m.nombre.startsWith(n)).id
  ok(await admin.from('material_costos').insert([
    { material_id: mat('Vinil'), costo_unitario: 38 },
    { material_id: mat('Lona'), costo_unitario: 42 },
    { material_id: mat('Tinta'), costo_unitario: 650 },
  ]))

  const { data: pedido } = await admin.from('pedidos').select('id').order('created_at').limit(1).maybeSingle()
  ok(await produccion.from('movimientos_inventario').insert({ material_id: mat('Vinil'), tipo: 'consumo', cantidad: 6, pedido_id: pedido?.id ?? null, notas: 'Vinil para recepción' }))
  ok(await admin.from('gastos').insert([
    { concepto: 'Corte láser de letras (maquila)', categoria: 'maquila', proveedor_id: prov('Maquila'), pedido_id: pedido?.id ?? null, monto: 350, metodo_pago: 'efectivo' },
    { concepto: 'Gasolina para instalación', categoria: 'transporte', monto: 280, metodo_pago: 'tarjeta' },
  ], { defaultToNull: false }))

  ok(await ventas.from('tareas').insert([
    { titulo: 'Llamar a Gimnasio Titán por los uniformes', tipo: 'llamada', fecha: hoy, hora: '11:00', responsable_id: idDe('ventas'), prioridad: 'alta' },
    { titulo: 'Instalar vinil en Clínica Dental Sonríe', tipo: 'instalacion', fecha: hoy, hora: '16:00', responsable_id: idDe('produccion'), pedido_id: pedido?.id ?? null },
    { titulo: 'Preparar arte de las tazas', tipo: 'tarea', fecha: hoy, responsable_id: idDe('diseno') },
  ], { defaultToNull: false }))
}

console.log('Datos de prueba listos. Usuarios:', Object.entries(USUARIOS).map(([r, u]) => `${r}: ${u.email} / ${u.password}`).join(' · '))
