/** MÓDULO PAGOS · implementación real (Supabase). */
import { hoyLocal, limpio, mensajeError, n, nn, nombreArchivoSeguro, revisar, sinError, supabase } from '@/data/comun/real'
import type { ApiPagos, CorteCaja, Pago, ResumenCaja } from './contrato'

const CAMPOS = '*, pedido:pedidos(folio, titulo), cliente:clientes(nombre), registrador:perfiles!registrado_por(nombre)'
const DURACION_ENLACE = 600

function aPago(f: Record<string, unknown>): Pago {
  const { pedido, cliente, registrador, updated_at: _u, ...p } = f as Record<string, unknown> & {
    pedido: { folio: string; titulo: string } | null
    cliente: { nombre: string } | null
    registrador: { nombre: string } | null
  }
  return {
    ...(p as unknown as Pago),
    importe: n(p.importe),
    folio: pedido?.folio ?? '',
    pedido_titulo: pedido?.titulo ?? '',
    cliente: cliente?.nombre ?? null,
    registrado_por_nombre: registrador?.nombre ?? null,
  }
}

function aCorte(f: Record<string, unknown>): CorteCaja {
  const { cerrador, ...c } = f as Record<string, unknown> & { cerrador: { nombre: string } | null }
  return {
    ...(c as unknown as CorteCaja),
    efectivo_inicial: n(c.efectivo_inicial),
    efectivo_contado: n(c.efectivo_contado),
    esperado: n(c.esperado),
    diferencia: n(c.diferencia),
    cerrado_por_nombre: cerrador?.nombre ?? (c.cerrado_por_nombre as string) ?? null,
  }
}

async function obtenerPago(id: string) {
  return aPago(revisar(await supabase().from('pagos').select(CAMPOS).eq('id', id).single()) as unknown as Record<string, unknown>)
}

export const pagosSupabase: ApiPagos = {
  pagos: {
    async listar(filtros = {}) {
      let q = supabase().from('pagos').select(CAMPOS)
      if (filtros.desde) q = q.gte('fecha', filtros.desde)
      if (filtros.hasta) q = q.lte('fecha', filtros.hasta)
      if (filtros.pedidoId) q = q.eq('pedido_id', filtros.pedidoId)
      if (filtros.clienteId) q = q.eq('cliente_id', filtros.clienteId)
      if (filtros.metodo) q = q.eq('metodo', filtros.metodo)
      if (filtros.tipo) q = q.eq('tipo', filtros.tipo)
      if (!filtros.incluirCancelados) q = q.eq('cancelado', false)
      const filas = revisar(await q.order('fecha', { ascending: false }).order('created_at', { ascending: false }).limit(filtros.limite ?? 500))
      return filas.map((f) => aPago(f as unknown as Record<string, unknown>))
    },

    async porPedido(pedidoId) {
      const filas = revisar(await supabase().from('pagos').select(CAMPOS).eq('pedido_id', pedidoId).order('fecha').order('created_at'))
      return filas.map((f) => aPago(f as unknown as Record<string, unknown>))
    },

    async registrar(datos) {
      if (!(datos.importe > 0)) throw new Error('El importe debe ser mayor a cero')
      const f = revisar(
        await supabase()
          .from('pagos')
          .insert({
            pedido_id: datos.pedido_id,
            importe: datos.importe,
            tipo: datos.tipo ?? 'abono',
            metodo: datos.metodo,
            fecha: datos.fecha ?? hoyLocal(),
            referencia: limpio(datos.referencia),
            notas: limpio(datos.notas),
          })
          .select(CAMPOS)
          .single(),
      )
      return aPago(f as unknown as Record<string, unknown>)
    },

    async cancelar(id, motivo) {
      if (!motivo?.trim()) throw new Error('Indica el motivo de la cancelación del pago')
      revisar(await supabase().from('pagos').update({ cancelado: true, motivo_cancelacion: motivo.trim() }).eq('id', id).select('id').single())
    },

    async subirComprobante(id, archivo) {
      const sb = supabase()
      const pago = revisar(await sb.from('pagos').select('pedido_id').eq('id', id).single())
      const ruta = `pagos/${pago.pedido_id}/${id}-${nombreArchivoSeguro((archivo as File).name || 'comprobante')}`
      const subida = await sb.storage.from('comprobantes').upload(ruta, archivo, { contentType: archivo.type || undefined, upsert: true })
      if (subida.error) throw new Error(mensajeError(subida.error))
      revisar(await sb.from('pagos').update({ comprobante_path: ruta }).eq('id', id).select('id').single())
      return obtenerPago(id)
    },

    async urlComprobante(id) {
      const sb = supabase()
      const p = revisar(await sb.from('pagos').select('comprobante_path').eq('id', id).single())
      if (!p.comprobante_path) return null
      const firmado = await sb.storage.from('comprobantes').createSignedUrl(p.comprobante_path, DURACION_ENLACE)
      if (firmado.error) throw new Error(mensajeError(firmado.error))
      return firmado.data.signedUrl
    },
  },

  cobranza: {
    async cuentasPorCobrar() {
      const filas = revisar(await supabase().rpc('cuentas_por_cobrar'))
      return filas.map((f) => ({
        ...f,
        whatsapp: f.whatsapp ?? null,
        vendedor_id: f.vendedor_id ?? null,
        vendedor: f.vendedor ?? null,
        fecha_entrega: f.fecha_entrega ?? null,
        fecha_limite: f.fecha_limite ?? null,
        total: n(f.total),
        pagado: n(f.pagado),
        saldo: n(f.saldo),
        dias_transcurridos: n(f.dias_transcurridos),
        dias_vencido: n(f.dias_vencido),
      }))
    },
  },

  caja: {
    async resumen(fecha, efectivoInicial) {
      const r = revisar(
        await supabase().rpc('corte_caja_resumen', {
          ...(fecha ? { p_fecha: fecha } : {}),
          ...(efectivoInicial !== undefined ? { p_efectivo_inicial: efectivoInicial } : {}),
        }),
      ) as unknown as ResumenCaja & { corte: Record<string, unknown> | null }
      return { ...r, efectivo_inicial_sugerido: nn(r.efectivo_inicial_sugerido), corte: r.corte ? aCorte(r.corte) : null }
    },

    async cerrar(datos) {
      const r = revisar(
        await supabase().rpc('cerrar_caja', {
          p_fecha: datos.fecha,
          p_efectivo_inicial: datos.efectivo_inicial,
          p_efectivo_contado: datos.efectivo_contado,
          ...(datos.notas?.trim() ? { p_notas: datos.notas.trim() } : {}),
        }),
      ) as unknown as Record<string, unknown>
      return aCorte(r)
    },

    async reabrir(fecha, motivo) {
      if (!motivo?.trim()) throw new Error('Indica el motivo para reabrir la caja')
      sinError(await supabase().rpc('reabrir_caja', { p_fecha: fecha, p_motivo: motivo.trim() }))
    },

    async cortes(filtros = {}) {
      let q = supabase().from('cortes_caja').select('*, cerrador:perfiles!cerrado_por(nombre)')
      if (filtros.desde) q = q.gte('fecha', filtros.desde)
      if (filtros.hasta) q = q.lte('fecha', filtros.hasta)
      const filas = revisar(await q.order('fecha', { ascending: false }).limit(filtros.limite ?? 100))
      return filas.map((f) => aCorte(f as unknown as Record<string, unknown>))
    },
  },

  comisiones: {
    async resumen(desde, hasta) {
      const filas = revisar(await supabase().rpc('comisiones', { p_desde: desde, p_hasta: hasta }))
      return filas.map((f) => ({
        ...f,
        comision_pct: n(f.comision_pct),
        pedidos: n(f.pedidos),
        pagos: n(f.pagos),
        cobrado: n(f.cobrado),
        base_comision: n(f.base_comision),
        comision: n(f.comision),
      }))
    },
    async detalle(desde, hasta, vendedorId) {
      const filas = revisar(await supabase().rpc('comisiones_detalle', { p_desde: desde, p_hasta: hasta, ...(vendedorId ? { p_vendedor: vendedorId } : {}) }))
      return filas.map((f) => ({
        ...f,
        cliente: f.cliente ?? null,
        comision_pct: n(f.comision_pct),
        pagos: n(f.pagos),
        cobrado: n(f.cobrado),
        base_comision: n(f.base_comision),
        comision: n(f.comision),
      }))
    },
  },
}
