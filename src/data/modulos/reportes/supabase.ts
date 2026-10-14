/** MÓDULO REPORTES · implementación real (funciones de reporte de la base de datos). */
import { n, nn, revisar, supabase } from '@/data/comun/real'
import type { ApiReportes, DesempenoVendedor, MejorCliente, ProductoVendido, UtilidadPedido, VentasPeriodo } from './contrato'

/** Convierte a número las columnas numeric (y deja nulas las que pueden serlo). */
function numeros<T>(fila: Record<string, unknown>, enteros: string[], nulos: string[] = []): T {
  const r: Record<string, unknown> = { ...fila }
  for (const k of enteros) r[k] = nulos.includes(k) ? nn(fila[k]) : n(fila[k])
  for (const k of nulos) if (!enteros.includes(k)) r[k] = fila[k] ?? null
  return r as T
}

export const reportesSupabase: ApiReportes = {
  reportes: {
    async ventas(desde, hasta, agrupar = 'dia') {
      const filas = revisar(await supabase().rpc('reporte_ventas', { p_desde: desde, p_hasta: hasta, p_agrupar: agrupar }))
      return filas.map((f) => numeros<VentasPeriodo>(f, ['vendido', 'pedidos', 'cobrado', 'cotizado', 'cotizaciones']))
    },
    async productos(desde, hasta, limite) {
      const filas = revisar(await supabase().rpc('reporte_productos', { p_desde: desde, p_hasta: hasta, ...(limite ? { p_limite: limite } : {}) }))
      return filas.map((f) => numeros<ProductoVendido>(f, ['cantidad', 'unidades', 'importe', 'pedidos'], ['producto_id', 'categoria', 'tipo', 'unidad']))
    },
    async vendedores(desde, hasta) {
      const filas = revisar(await supabase().rpc('reporte_vendedores', { p_desde: desde, p_hasta: hasta }))
      return filas.map((f) =>
        numeros<DesempenoVendedor>(f, ['cotizaciones', 'cotizado', 'aceptadas', 'rechazadas', 'tasa_cierre', 'pedidos', 'vendido', 'cobrado', 'ticket_promedio'], ['vendedor_id', 'tasa_cierre', 'ticket_promedio']),
      )
    },
    async clientes(desde, hasta, limite) {
      const filas = revisar(await supabase().rpc('reporte_clientes', { p_desde: desde, p_hasta: hasta, ...(limite ? { p_limite: limite } : {}) }))
      return filas.map((f) => numeros<MejorCliente>(f, ['pedidos', 'vendido', 'cobrado', 'saldo', 'ticket_promedio'], ['whatsapp', 'ultima_compra']))
    },
    async utilidad(desde, hasta) {
      const filas = revisar(await supabase().rpc('utilidad_pedidos', { p_desde: desde, p_hasta: hasta }))
      return filas.map((f) =>
        numeros<UtilidadPedido>(
          f,
          ['venta', 'costo_estimado', 'gastos', 'consumo_material', 'costo_real', 'utilidad_estimada', 'utilidad_real', 'margen_estimado_pct', 'margen_real_pct', 'consumos_sin_costo'],
          ['vendedor_id', 'margen_estimado_pct', 'margen_real_pct'],
        ),
      )
    },
  },
}
