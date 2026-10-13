/**
 * Implementación de la API para la VISTA PREVIA.
 * Trabaja en memoria con datos ficticios: nada se envía a Supabase ni a ningún servidor.
 */
import { calcularTotales, importePartida } from '@/lib/calculadora'
import { hoyISO, sumarDias } from '@/lib/format'
import { permisosDeRol } from '@/lib/permisos'
import { normalizar } from '@/lib/utils'
import type { Api } from '../api'
import type { CotizacionCompleta, CotizacionLista, DashboardResumen, Rol, SesionUsuario } from '../tipos'
import {
  clientesDemo,
  configuracionDemo,
  cotizacionesDemo,
  pedidosDemo,
  perfilesDemo,
  plantillasDemo,
  productosDemo,
  serieMensualDemo,
} from './datosDemo'

const perfiles = perfilesDemo()
const clientes = [...clientesDemo]
let cotizaciones: CotizacionCompleta[] = cotizacionesDemo(perfiles)
const pedidos = pedidosDemo()
let rolActual: Rol | null = null
const oyentes = new Set<() => void>()
let siguienteFolio = cotizaciones.length + 1

try {
  rolActual = (sessionStorage.getItem('impresiona:demo-rol') as Rol | null) ?? null
} catch {
  rolActual = null
}

const espera = (ms = 260) => new Promise((r) => setTimeout(r, ms))
const avisar = () => oyentes.forEach((cb) => cb())

function sesion(): SesionUsuario | null {
  if (!rolActual) return null
  const perfil = perfiles[rolActual]
  return { id: perfil.id, email: perfil.email, perfil, permisos: permisosDeRol(rolActual) }
}

function exigir(permiso: keyof SesionUsuario['permisos']) {
  const s = sesion()
  if (!s?.permisos[permiso]) throw new Error('No tienes permiso para realizar esta acción')
}

function aLista(c: CotizacionCompleta): CotizacionLista {
  return {
    id: c.id,
    folio: c.folio,
    titulo: c.titulo,
    fecha: c.fecha,
    fecha_vencimiento: c.fecha_vencimiento,
    estado: c.estado,
    total: c.total,
    pedido_id: c.pedido_id,
    enviada_at: c.enviada_at,
    created_at: c.created_at,
    cliente: { id: c.cliente.id, nombre: c.cliente.nombre, whatsapp: c.cliente.whatsapp, telefono: c.cliente.telefono },
    vendedor: c.vendedor ? { nombre: c.vendedor.nombre } : null,
  }
}

function recalcular(c: CotizacionCompleta) {
  c.partidas = c.partidas.map((p, i) => ({ ...p, orden: i + 1, importe: importePartida(p.cantidad, p.precio_unitario, p.descuento_pct) }))
  const t = calcularTotales({
    importes: c.partidas.map((p) => p.importe),
    descuentoTipo: c.descuento_tipo,
    descuentoValor: c.descuento_valor,
    recargoPct: c.recargo_pct,
    aplicaIva: c.aplica_iva,
    ivaPct: c.iva_pct,
  })
  Object.assign(c, { subtotal: t.subtotal, descuento: t.descuento, recargo: t.recargo, iva: t.iva, total: t.total })
  c.fecha_vencimiento = sumarDias(c.fecha, c.vigencia_dias)
}

export const apiDemo: Api = {
  sesion: {
    async actual() {
      return sesion()
    },
    async iniciar() {
      throw new Error('En la vista previa elige un rol de ejemplo para entrar')
    },
    async iniciarDemo(rol) {
      await espera(500)
      rolActual = rol
      try {
        sessionStorage.setItem('impresiona:demo-rol', rol)
      } catch {
        /* sin almacenamiento: la sesión dura mientras la página esté abierta */
      }
      avisar()
    },
    async cerrar() {
      rolActual = null
      try {
        sessionStorage.removeItem('impresiona:demo-rol')
      } catch {
        /* nada que limpiar */
      }
      avisar()
    },
    async recuperar() {
      await espera()
      throw new Error('La recuperación de contraseña no está disponible en la vista previa')
    },
    async nuevaContrasena() {
      throw new Error('No disponible en la vista previa')
    },
    alCambiar(cb) {
      oyentes.add(cb)
      return () => oyentes.delete(cb)
    },
  },

  configuracion: {
    async obtener() {
      return configuracionDemo
    },
  },

  plantillas: {
    async listar() {
      return plantillasDemo
    },
  },

  usuarios: {
    async equipo() {
      return Object.values(perfiles).map(({ id, nombre, rol, email, telefono }) => ({ id, nombre, rol, email, telefono }))
    },
  },

  dashboard: {
    async resumen() {
      await espera(420)
      const s = sesion()
      if (!s) throw new Error('Sesión requerida')
      const hoy = hoyISO()
      const activos = pedidos.filter((p) => !['entregado', 'finalizado', 'cancelado'].includes(p.estado))
      const porEstado: DashboardResumen['pedidos_por_estado'] = {}
      for (const p of activos) porEstado[p.estado] = (porEstado[p.estado] ?? 0) + 1

      const r: DashboardResumen = {
        hoy,
        pedidos_por_estado: porEstado,
        pedidos_activos: activos.length,
        pedidos_atrasados: activos.filter((p) => p.fecha_entrega < hoy).length,
        pedidos_pausados: activos.filter((p) => p.estado === 'pausado').length,
        entregas_proximas: activos
          .filter((p) => p.fecha_entrega <= sumarDias(hoy, 7))
          .sort((a, b) => a.fecha_entrega.localeCompare(b.fecha_entrega))
          .map(({ total: _t, pagado: _p, responsable: _r, vencido: _v, ...e }) => e),
        mis_pendientes: activos
          .filter((p) => p.responsable === s.perfil.rol)
          .map(({ total: _t, pagado: _p, responsable: _r, vencido: _v, ...e }) => e),
        disenos_pendientes: 2,
      }

      if (s.permisos.ver_precios) {
        const abiertas = cotizaciones.filter((c) => ['borrador', 'enviada'].includes(c.estado) && c.fecha_vencimiento >= hoy)
        r.cotizaciones_abiertas = { cantidad: abiertas.length, total: abiertas.reduce((t, c) => t + c.total, 0) }
        r.cotizaciones_por_vencer = cotizaciones
          .filter((c) => c.estado === 'enviada' && c.fecha_vencimiento >= hoy && c.fecha_vencimiento <= sumarDias(hoy, 3))
          .map((c) => ({ id: c.id, folio: c.folio, titulo: c.titulo, total: c.total, fecha_vencimiento: c.fecha_vencimiento, cliente: c.cliente.nombre }))
        const cerradas = cotizaciones.filter((c) => ['aceptada', 'rechazada'].includes(c.estado))
        r.tasa_cierre_90d = cerradas.length
          ? Math.round((cotizaciones.filter((c) => c.estado === 'aceptada').length / cerradas.length) * 1000) / 10
          : null
      }

      if (s.permisos.ver_reportes) {
        const actual = serieMensualDemo[serieMensualDemo.length - 1]
        r.ventas_mes = actual.ventas
        r.ventas_mes_anterior = serieMensualDemo[serieMensualDemo.length - 2].ventas
        r.cobrado_mes = actual.cobrado
        const saldo = pedidos.filter((p) => p.estado !== 'cancelado').reduce((t, p) => t + (p.total - p.pagado), 0)
        r.por_cobrar = { total: Math.round(saldo * 100) / 100, pedidos: pedidos.filter((p) => p.total > p.pagado).length }
        const vencidos = pedidos.filter((p) => p.vencido)
        r.pagos_vencidos = { total: vencidos.reduce((t, p) => t + (p.total - p.pagado), 0), pedidos: vencidos.length }
        r.serie_mensual = serieMensualDemo
      }
      if (s.permisos.ver_reportes && s.permisos.ver_costos) {
        r.utilidad_estimada_mes = { venta: 104870.69, costo: 58212.4, utilidad: 46658.29 }
      }
      if (s.permisos.gestionar_clientes) {
        r.seguimientos = [
          { id: 'o1', titulo: 'Menú luminoso', etapa: 'cotizacion_enviada', proxima_accion: 'Llamar para resolver dudas del neón', proxima_accion_fecha: hoy, valor_estimado: 5568, cliente: 'Taquería Los Compadres', cliente_id: 'c4', whatsapp: '3344445566' },
          { id: 'o2', titulo: 'Tarjetas y etiquetas', etapa: 'en_seguimiento', proxima_accion: 'Enviar muestras de papel', proxima_accion_fecha: sumarDias(hoy, -1), valor_estimado: 900, cliente: 'Boutique Lirio', cliente_id: 'c7', whatsapp: '3377778899' },
        ]
        r.embudo = {
          prospecto_nuevo: { cantidad: 4, valor: 18400 },
          contactado: { cantidad: 3, valor: 12600 },
          interesado: { cantidad: 2, valor: 21300 },
          cotizacion_enviada: { cantidad: 4, valor: 31940 },
          en_seguimiento: { cantidad: 2, valor: 7400 },
          ganado: { cantidad: 5, valor: 62800 },
          perdido: { cantidad: 1, valor: 5011 },
        }
      }
      return r
    },
  },

  busqueda: {
    async global(texto) {
      const q = normalizar(texto)
      const s = sesion()
      if (q.length < 2) return { clientes: [], cotizaciones: [], pedidos: [] }
      return {
        clientes: clientes
          .filter((c) => normalizar(c.nombre).includes(q))
          .slice(0, 6)
          .map((c) => ({ id: c.id, nombre: c.nombre, telefono: c.whatsapp, email: c.email })),
        cotizaciones: s?.permisos.ver_precios
          ? cotizaciones
              .filter((c) => normalizar(`${c.folio} ${c.titulo ?? ''} ${c.cliente.nombre}`).includes(q))
              .slice(0, 6)
              .map((c) => ({ id: c.id, folio: c.folio, titulo: c.titulo, estado: c.estado, total: c.total, cliente: c.cliente.nombre }))
          : [],
        pedidos: pedidos
          .filter((p) => normalizar(`${p.folio} ${p.titulo} ${p.cliente}`).includes(q))
          .slice(0, 6)
          .map((p) => ({ id: p.id, folio: p.folio, titulo: p.titulo, estado: p.estado, cliente: p.cliente })),
      }
    },
  },

  clientes: {
    async buscar(texto) {
      await espera(120)
      const q = normalizar(texto)
      return clientes.filter((c) => !q || normalizar(`${c.nombre} ${c.whatsapp ?? ''} ${c.email ?? ''}`).includes(q)).slice(0, 20)
    },
    async crear(datos) {
      exigir('gestionar_clientes')
      await espera()
      const nuevo = {
        id: `c-${Date.now()}`,
        nombre: datos.nombre.trim(),
        whatsapp: datos.whatsapp?.trim() || null,
        telefono: null,
        email: datos.email?.trim() || null,
        requiere_factura: datos.requiere_factura ?? false,
        rfc: datos.rfc?.trim().toUpperCase() || null,
        razon_social: datos.razon_social?.trim() || null,
        direccion: null,
        ciudad: null,
      }
      clientes.unshift(nuevo)
      return nuevo
    },
  },

  catalogo: {
    async productos() {
      return productosDemo(Boolean(sesion()?.permisos.ver_costos))
    },
  },

  cotizaciones: {
    async listar() {
      exigir('ver_precios')
      await espera(380)
      return cotizaciones.map(aLista)
    },
    async obtener(id) {
      exigir('ver_precios')
      await espera(220)
      const c = cotizaciones.find((x) => x.id === id)
      if (!c) throw new Error('Cotización no encontrada')
      const verCostos = sesion()?.permisos.ver_costos
      return structuredClone({ ...c, partidas: c.partidas.map((p) => ({ ...p, costos: verCostos ? p.costos : null })) })
    },
    async guardar(b) {
      exigir('gestionar_cotizaciones')
      await espera(450)
      const s = sesion()!
      const cliente = clientes.find((c) => c.id === b.cliente_id)
      if (!cliente) throw new Error('Selecciona un cliente')
      const existente = b.id ? cotizaciones.find((c) => c.id === b.id) : undefined
      if (existente?.pedido_id) throw new Error(`Esta cotización ya se convirtió en el pedido ${existente.pedido_folio}`)
      const ahora = new Date().toISOString()
      const base: CotizacionCompleta = existente ?? {
        id: `demo-cot-n${Date.now()}`,
        folio: `COT-${String(siguienteFolio++).padStart(4, '0')}`,
        estado: 'borrador',
        motivo_rechazo: null,
        pedido_id: null,
        pedido_folio: null,
        enviada_at: null,
        aceptada_at: null,
        created_at: ahora,
        vendedor: { id: s.id, nombre: s.perfil.nombre, email: s.email, telefono: null },
      } as CotizacionCompleta
      Object.assign(base, {
        titulo: b.titulo || null,
        fecha: b.fecha,
        vigencia_dias: b.vigencia_dias,
        tiempo_entrega: b.tiempo_entrega || null,
        anticipo_pct: b.anticipo_pct,
        aplica_iva: b.aplica_iva,
        iva_pct: b.iva_pct,
        descuento_tipo: b.descuento_tipo,
        descuento_valor: b.descuento_valor,
        recargo_pct: b.recargo_pct,
        recargo_concepto: b.recargo_concepto,
        condiciones: b.condiciones,
        notas: b.notas || null,
        notas_internas: b.notas_internas || null,
        updated_at: ahora,
        cliente: { ...cliente },
        partidas: b.partidas.map((p, i) => ({
          ...p,
          id: p.id || `demo-p-${Date.now()}-${i}`,
          orden: i + 1,
          importe: 0,
          costos: s.permisos.ver_costos ? p.costos : (existente?.partidas.find((x) => x.id === p.id)?.costos ?? null),
        })),
      })
      recalcular(base)
      if (!existente) cotizaciones = [base, ...cotizaciones]
      return { id: base.id, folio: base.folio }
    },
    async cambiarEstado(id, estado, motivo) {
      exigir('gestionar_cotizaciones')
      await espera(200)
      const c = cotizaciones.find((x) => x.id === id)
      if (!c) throw new Error('Cotización no encontrada')
      c.estado = estado
      c.motivo_rechazo = estado === 'rechazada' ? motivo ?? null : null
      if (estado === 'enviada') c.enviada_at ??= new Date().toISOString()
      if (estado === 'aceptada') c.aceptada_at ??= new Date().toISOString()
    },
    async duplicar(id) {
      exigir('gestionar_cotizaciones')
      await espera(300)
      const c = cotizaciones.find((x) => x.id === id)
      if (!c) throw new Error('Cotización no encontrada')
      const s = sesion()!
      const copia: CotizacionCompleta = structuredClone(c)
      Object.assign(copia, {
        id: `demo-cot-n${Date.now()}`,
        folio: `COT-${String(siguienteFolio++).padStart(4, '0')}`,
        titulo: c.titulo ? `${c.titulo} (copia)` : null,
        fecha: hoyISO(),
        estado: 'borrador',
        motivo_rechazo: null,
        pedido_id: null,
        pedido_folio: null,
        enviada_at: null,
        aceptada_at: null,
        created_at: new Date().toISOString(),
        vendedor: { id: s.id, nombre: s.perfil.nombre, email: s.email, telefono: null },
      })
      copia.partidas = copia.partidas.map((p, i) => ({ ...p, id: `demo-p-${Date.now()}-${i}` }))
      recalcular(copia)
      cotizaciones = [copia, ...cotizaciones]
      return copia.id
    },
    async convertir(id) {
      exigir('gestionar_pedidos')
      await espera(450)
      const c = cotizaciones.find((x) => x.id === id)
      if (!c) throw new Error('Cotización no encontrada')
      if (c.pedido_id) throw new Error(`Esta cotización ya se convirtió en el pedido ${c.pedido_folio}`)
      if (['rechazada', 'cancelada'].includes(c.estado)) throw new Error('No se puede convertir una cotización rechazada o cancelada')
      c.estado = 'aceptada'
      c.aceptada_at = new Date().toISOString()
      c.pedido_id = `demo-ped-n${Date.now()}`
      c.pedido_folio = `PED-${String(50 + siguienteFolio).padStart(4, '0')}`
      return { pedidoId: c.pedido_id }
    },
    async eliminar(id) {
      exigir('gestionar_cotizaciones')
      const c = cotizaciones.find((x) => x.id === id)
      if (c && c.estado !== 'borrador') throw new Error('Solo se pueden eliminar borradores')
      cotizaciones = cotizaciones.filter((x) => x.id !== id)
    },
    async compartirPdf() {
      // En la vista previa no se sube nada: el PDF se comparte desde el dispositivo.
      return null
    },
  },
}

export default apiDemo
