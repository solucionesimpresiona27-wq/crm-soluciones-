/** MÓDULO INVENTARIO · implementación de la vista previa (almacén en memoria, datos ficticios). */
import { almacen as a, copia, nuevoId } from '@/data/demo/almacen'
import {
  ahoraISO,
  aplicarMovimiento,
  bajoMinimo,
  busquedaDe,
  diferencias,
  existenciaCalculada,
  fechaLocal,
  nombrePerfil,
  redondear2,
  registrarBitacora,
  validarCajaAbierta,
  vistaPreviaArchivo,
} from '@/data/demo/reglas'
import { esAdmin, espera, exigir, exigirAlguno, puede, usuario } from '@/data/demo/sesion'
import { dinero } from '@/lib/format'
import { normalizar } from '@/lib/utils'
import type { ApiInventario, DatosGasto, DatosMaterial, DatosProveedor, Gasto, Material, Movimiento } from './contrato'

type MaterialFila = (typeof a.materiales)[number]
type GastoFila = (typeof a.gastos)[number]
type ProveedorFila = (typeof a.proveedores)[number]
const limpio = (v: string | null | undefined) => (v?.trim() ? v.trim() : null)
const comprobantes = new Map<string, string>()

function aMaterial(m: MaterialFila): Material {
  const { busqueda: _b, ...resto } = m
  return copia({
    ...resto,
    bajo_minimo: Boolean(m.bajo_minimo),
    proveedor: a.proveedores.find((p) => p.id === m.proveedor_id)?.nombre ?? null,
    costo_unitario: puede('ver_costos') ? (a.material_costos.find((c) => c.material_id === m.id)?.costo_unitario ?? null) : null,
  })
}

function aMovimiento(x: (typeof a.movimientos_inventario)[number]): Movimiento {
  const m = a.materiales.find((y) => y.id === x.material_id)
  return copia({
    ...x,
    material: m?.nombre ?? '',
    unidad: m?.unidad ?? 'pieza',
    usuario: nombrePerfil(a, x.usuario_id),
    folio_pedido: a.pedidos.find((p) => p.id === x.pedido_id)?.folio ?? null,
    proveedor: a.proveedores.find((p) => p.id === x.proveedor_id)?.nombre ?? null,
  })
}

function aGasto(g: GastoFila): Gasto {
  return copia({
    ...g,
    proveedor: a.proveedores.find((p) => p.id === g.proveedor_id)?.nombre ?? null,
    folio_pedido: a.pedidos.find((p) => p.id === g.pedido_id)?.folio ?? null,
    usuario: nombrePerfil(a, g.usuario_id),
  })
}

function material(id: string) {
  const m = a.materiales.find((x) => x.id === id)
  if (!m) throw new Error('Material no encontrado')
  return m
}

function gasto(id: string) {
  const g = a.gastos.find((x) => x.id === id)
  if (!g) throw new Error('Gasto no encontrado')
  return g
}

function proveedor(id: string) {
  const p = a.proveedores.find((x) => x.id === id)
  if (!p) throw new Error('Proveedor no encontrado')
  return p
}

function aplicarMaterial(m: MaterialFila, d: Partial<DatosMaterial>) {
  if (d.nombre !== undefined) {
    const nombre = d.nombre.trim()
    if (!nombre) throw new Error('Escribe el nombre del material')
    if (a.materiales.some((x) => x.id !== m.id && normalizar(x.nombre) === normalizar(nombre))) throw new Error('Ya existe un material con ese nombre')
    m.nombre = nombre
  }
  for (const k of ['categoria', 'ubicacion', 'notas'] as const) if (d[k] !== undefined) m[k] = limpio(d[k])
  if (d.unidad !== undefined) m.unidad = d.unidad
  if (d.stock_minimo !== undefined) {
    if (d.stock_minimo < 0) throw new Error('El mínimo no puede ser negativo')
    m.stock_minimo = d.stock_minimo
  }
  if (d.proveedor_id !== undefined) m.proveedor_id = d.proveedor_id
  m.busqueda = busquedaDe(m.nombre, m.categoria, m.ubicacion)
  m.bajo_minimo = bajoMinimo(m)
  m.updated_at = ahoraISO()
}

function guardarCosto(id: string, costo: number | null | undefined) {
  if (costo === undefined || costo === null) return
  exigir('ver_costos', 'gestionar_inventario')
  if (costo < 0) throw new Error('El costo no puede ser negativo')
  const c = a.material_costos.find((x) => x.material_id === id)
  if (c) Object.assign(c, { costo_unitario: costo, updated_at: ahoraISO() })
  else a.material_costos.push({ material_id: id, costo_unitario: costo, updated_at: ahoraISO() })
}

function aplicarProveedor(p: ProveedorFila, d: Partial<DatosProveedor>) {
  if (d.nombre !== undefined) {
    if (!d.nombre.trim()) throw new Error('Escribe el nombre del proveedor')
    p.nombre = d.nombre.trim()
  }
  for (const k of ['contacto', 'telefono', 'whatsapp', 'categoria', 'notas'] as const) if (d[k] !== undefined) p[k] = limpio(d[k])
  if (d.email !== undefined) p.email = limpio(d.email)?.toLowerCase() ?? null
  if (d.rfc !== undefined) p.rfc = limpio(d.rfc)?.toUpperCase() ?? null
  p.busqueda = busquedaDe(p.nombre, p.contacto, p.telefono, p.whatsapp, p.email, p.rfc, p.categoria)
  p.updated_at = ahoraISO()
}

function aplicarGasto(g: GastoFila, d: Partial<DatosGasto>) {
  if (d.concepto !== undefined) {
    if (!d.concepto.trim()) throw new Error('Escribe el concepto del gasto')
    g.concepto = d.concepto.trim()
  }
  if (d.monto !== undefined) {
    if (!(d.monto > 0)) throw new Error('El monto debe ser mayor a cero')
    g.monto = redondear2(d.monto)
  }
  if (d.fecha !== undefined) g.fecha = d.fecha
  if (d.categoria !== undefined) g.categoria = d.categoria
  if (d.metodo_pago !== undefined) g.metodo_pago = d.metodo_pago
  if (d.proveedor_id !== undefined) g.proveedor_id = d.proveedor_id
  if (d.pedido_id !== undefined) g.pedido_id = d.pedido_id
  for (const k of ['referencia', 'notas'] as const) if (d[k] !== undefined) g[k] = limpio(d[k])
  g.updated_at = ahoraISO()
}

const etiquetaGasto = (g: GastoFila) => `Gasto de ${dinero(g.monto)} · ${g.concepto}`
const verProveedores = () => exigirAlguno('gestionar_inventario', 'registrar_gastos', 'ver_costos')

export const inventarioDemo: ApiInventario = {
  materiales: {
    async listar(filtros = {}) {
      usuario()
      await espera(200)
      const t = normalizar(filtros.texto ?? '')
      return a.materiales
        .filter((m) => filtros.incluirInactivos || m.activo)
        .filter((m) => !filtros.categoria || m.categoria === filtros.categoria)
        .filter((m) => !filtros.soloBajoMinimo || m.bajo_minimo)
        .filter((m) => !t || (m.busqueda ?? '').includes(t))
        .sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'))
        .map(aMaterial)
    },

    async obtener(id) {
      usuario()
      return aMaterial(material(id))
    },

    async crear(datos) {
      const s = exigir('gestionar_inventario')
      await espera()
      if ((datos.existencia_inicial ?? 0) < 0) throw new Error('La existencia inicial no puede ser negativa')
      if (!datos.nombre?.trim()) throw new Error('Escribe el nombre del material')
      const ahora = ahoraISO()
      const m: MaterialFila = {
        id: nuevoId('mat'),
        nombre: '',
        categoria: null,
        unidad: datos.unidad,
        existencia: 0,
        stock_minimo: 0,
        bajo_minimo: false,
        proveedor_id: null,
        ubicacion: null,
        notas: null,
        activo: true,
        busqueda: null,
        created_by: s.id,
        created_at: ahora,
        updated_at: ahora,
      }
      aplicarMaterial(m, datos)
      if (datos.costo_unitario !== undefined && datos.costo_unitario !== null && !s.permisos.ver_costos) throw new Error('No tienes permiso para capturar costos')
      a.materiales.push(m)
      guardarCosto(m.id, datos.costo_unitario)
      if (datos.existencia_inicial) {
        aplicarMovimiento(a, { id: nuevoId('mov'), material_id: m.id, tipo: 'ajuste', cantidad: datos.existencia_inicial, pedido_id: null, proveedor_id: null, referencia: 'Existencia inicial', notas: null, usuario_id: s.id, fecha: ahora })
      }
      registrarBitacora(a, { tabla: 'materiales', registro_id: m.id, accion: 'crear', etiqueta: m.nombre, usuario_id: s.id })
      return aMaterial(m)
    },

    async actualizar(id, cambios) {
      const s = exigir('gestionar_inventario')
      await espera()
      const m = material(id)
      const { costo_unitario, ...resto } = cambios
      const antes = { ...m }
      const prueba = { ...m }
      aplicarMaterial(prueba, resto)
      guardarCosto(id, costo_unitario)
      Object.assign(m, prueba)
      registrarBitacora(a, { tabla: 'materiales', registro_id: id, accion: 'modificar', etiqueta: m.nombre, cambios: diferencias(antes, m, ['updated_at', 'busqueda', 'bajo_minimo']), usuario_id: s.id })
      return aMaterial(m)
    },

    async activar(id, activo) {
      const s = exigir('gestionar_inventario')
      const m = material(id)
      m.activo = activo
      m.bajo_minimo = bajoMinimo(m)
      m.updated_at = ahoraISO()
      registrarBitacora(a, { tabla: 'materiales', registro_id: id, accion: 'modificar', etiqueta: m.nombre, cambios: { activo: [!activo, activo] }, usuario_id: s.id })
    },

    async eliminar(id) {
      const s = exigir('gestionar_inventario')
      const m = material(id)
      if (a.movimientos_inventario.some((x) => x.material_id === id)) throw new Error('El material ya tiene movimientos: desactívalo en lugar de eliminarlo')
      a.materiales.splice(a.materiales.indexOf(m), 1)
      a.material_costos = a.material_costos.filter((c) => c.material_id !== id)
      registrarBitacora(a, { tabla: 'materiales', registro_id: id, accion: 'eliminar', etiqueta: m.nombre, usuario_id: s.id })
    },
  },

  inventario: {
    async movimientos(filtros = {}) {
      usuario()
      await espera(200)
      return a.movimientos_inventario
        .filter((x) => !filtros.materialId || x.material_id === filtros.materialId)
        .filter((x) => !filtros.pedidoId || x.pedido_id === filtros.pedidoId)
        .filter((x) => !filtros.tipo || x.tipo === filtros.tipo)
        .filter((x) => (!filtros.desde || fechaLocal(x.fecha) >= filtros.desde) && (!filtros.hasta || fechaLocal(x.fecha) <= filtros.hasta))
        .sort((x, y) => y.fecha.localeCompare(x.fecha) || y.created_at.localeCompare(x.created_at))
        .slice(0, filtros.limite ?? 300)
        .map(aMovimiento)
    },

    async registrar(datos) {
      const s = ['consumo', 'merma'].includes(datos.tipo) ? exigirAlguno('registrar_consumos', 'gestionar_inventario') : exigir('gestionar_inventario')
      await espera(250)
      const ahora = ahoraISO()
      if (datos.fecha && new Date(datos.fecha).getTime() > Date.now() + 86_400_000) throw new Error('La fecha del movimiento no puede ser futura')
      const fila = aplicarMovimiento(a, {
        id: nuevoId('mov'),
        material_id: datos.material_id,
        tipo: datos.tipo,
        cantidad: datos.cantidad,
        pedido_id: datos.pedido_id ?? null,
        proveedor_id: datos.proveedor_id ?? null,
        referencia: limpio(datos.referencia),
        notas: limpio(datos.notas),
        usuario_id: s.id,
        fecha: datos.fecha ?? ahora,
      })
      const m = material(datos.material_id)
      registrarBitacora(a, { tabla: 'movimientos_inventario', registro_id: fila.id, accion: 'crear', etiqueta: `${datos.tipo[0].toUpperCase()}${datos.tipo.slice(1)} de ${datos.cantidad} · ${m.nombre}`, usuario_id: s.id })
      return aMovimiento(fila)
    },

    async ajustar(materialId, existencia, notas) {
      const s = exigir('gestionar_inventario')
      await espera()
      const m = material(materialId)
      if (existencia === null || existencia === undefined || Number.isNaN(existencia)) throw new Error('Indica la existencia contada')
      const actual = existenciaCalculada(a, materialId)
      const diferencia = Math.round((existencia - actual) * 1000) / 1000
      if (diferencia === 0) return { movimiento_id: null, existencia: actual, diferencia: 0 }
      const fila = aplicarMovimiento(a, {
        id: nuevoId('mov'),
        material_id: materialId,
        tipo: 'ajuste',
        cantidad: diferencia,
        pedido_id: null,
        proveedor_id: null,
        referencia: 'Conteo de inventario',
        notas: limpio(notas),
        usuario_id: s.id,
        fecha: ahoraISO(),
      })
      registrarBitacora(a, { tabla: 'movimientos_inventario', registro_id: fila.id, accion: 'crear', etiqueta: `Ajuste de ${diferencia} · ${m.nombre}`, usuario_id: s.id })
      return { movimiento_id: fila.id, existencia: m.existencia, diferencia }
    },

    async stockBajo() {
      usuario()
      return a.materiales.filter((m) => m.bajo_minimo).sort((x, y) => x.nombre.localeCompare(y.nombre, 'es')).map(aMaterial)
    },
  },

  proveedores: {
    async listar(filtros = {}) {
      verProveedores()
      await espera(150)
      const t = normalizar(filtros.texto ?? '')
      return a.proveedores
        .filter((p) => filtros.incluirInactivos || p.activo)
        .filter((p) => !t || (p.busqueda ?? '').includes(t))
        .sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'))
        .map(({ busqueda: _b, ...p }) => copia(p))
    },
    async crear(datos) {
      const s = exigirAlguno('gestionar_inventario', 'registrar_gastos')
      const ahora = ahoraISO()
      const p: ProveedorFila = {
        id: nuevoId('prov'),
        nombre: '',
        contacto: null,
        telefono: null,
        whatsapp: null,
        email: null,
        rfc: null,
        categoria: null,
        notas: null,
        activo: true,
        busqueda: null,
        created_by: s.id,
        created_at: ahora,
        updated_at: ahora,
      }
      aplicarProveedor(p, { ...datos, nombre: datos.nombre ?? '' })
      a.proveedores.push(p)
      registrarBitacora(a, { tabla: 'proveedores', registro_id: p.id, accion: 'crear', etiqueta: p.nombre, usuario_id: s.id })
      const { busqueda: _b, ...r } = p
      return copia(r)
    },
    async actualizar(id, cambios) {
      const s = exigirAlguno('gestionar_inventario', 'registrar_gastos')
      const p = proveedor(id)
      const prueba = { ...p }
      aplicarProveedor(prueba, cambios)
      Object.assign(p, prueba)
      registrarBitacora(a, { tabla: 'proveedores', registro_id: id, accion: 'modificar', etiqueta: p.nombre, usuario_id: s.id })
      const { busqueda: _b, ...r } = p
      return copia(r)
    },
    async activar(id, activo) {
      exigirAlguno('gestionar_inventario', 'registrar_gastos')
      const p = proveedor(id)
      p.activo = activo
      p.updated_at = ahoraISO()
    },
    async eliminar(id) {
      const s = exigir('eliminar_registros')
      const p = proveedor(id)
      a.proveedores.splice(a.proveedores.indexOf(p), 1)
      // on delete set null, como en la base de datos
      for (const tabla of [a.materiales, a.movimientos_inventario, a.gastos]) for (const x of tabla) if (x.proveedor_id === id) x.proveedor_id = null
      registrarBitacora(a, { tabla: 'proveedores', registro_id: id, accion: 'eliminar', etiqueta: p.nombre, usuario_id: s.id })
    },
  },

  gastos: {
    async listar(filtros = {}) {
      exigirAlguno('registrar_gastos', 'ver_costos')
      await espera(200)
      return a.gastos
        .filter((g) => filtros.incluirCancelados || !g.cancelado)
        .filter((g) => (!filtros.desde || g.fecha >= filtros.desde) && (!filtros.hasta || g.fecha <= filtros.hasta))
        .filter((g) => !filtros.categoria || g.categoria === filtros.categoria)
        .filter((g) => !filtros.proveedorId || g.proveedor_id === filtros.proveedorId)
        .filter((g) => !filtros.pedidoId || g.pedido_id === filtros.pedidoId)
        .sort((x, y) => y.fecha.localeCompare(x.fecha) || y.created_at.localeCompare(x.created_at))
        .slice(0, filtros.limite ?? 500)
        .map(aGasto)
    },
    async registrar(datos) {
      const s = exigir('registrar_gastos')
      await espera(300)
      const ahora = ahoraISO()
      const g: GastoFila = {
        id: nuevoId('gasto'),
        fecha: datos.fecha ?? fechaLocal(),
        concepto: '',
        categoria: datos.categoria,
        proveedor_id: null,
        pedido_id: null,
        monto: 0,
        metodo_pago: datos.metodo_pago,
        referencia: null,
        comprobante_path: null,
        notas: null,
        cancelado: false,
        motivo_cancelacion: null,
        cancelado_por: null,
        cancelado_at: null,
        usuario_id: s.id,
        created_at: ahora,
        updated_at: ahora,
      }
      aplicarGasto(g, { ...datos, concepto: datos.concepto ?? '', monto: datos.monto })
      validarCajaAbierta(a, g.fecha, g.metodo_pago, esAdmin())
      a.gastos.push(g)
      registrarBitacora(a, { tabla: 'gastos', registro_id: g.id, accion: 'crear', etiqueta: etiquetaGasto(g), usuario_id: s.id })
      return aGasto(g)
    },
    async actualizar(id, cambios) {
      const s = exigir('registrar_gastos')
      const g = gasto(id)
      if (g.cancelado) throw new Error('Un gasto cancelado no se puede modificar')
      const prueba = { ...g }
      aplicarGasto(prueba, cambios)
      const tocaCaja = ['fecha', 'monto', 'metodo_pago'].some((k) => prueba[k as keyof GastoFila] !== g[k as keyof GastoFila])
      if (tocaCaja) {
        validarCajaAbierta(a, g.fecha, g.metodo_pago, esAdmin())
        validarCajaAbierta(a, prueba.fecha, prueba.metodo_pago, esAdmin())
      }
      const antes = { ...g }
      Object.assign(g, prueba)
      registrarBitacora(a, { tabla: 'gastos', registro_id: id, accion: 'modificar', etiqueta: etiquetaGasto(g), cambios: diferencias(antes, g), usuario_id: s.id })
      return aGasto(g)
    },
    async cancelar(id, motivo) {
      const s = exigir('registrar_gastos')
      const g = gasto(id)
      if (g.cancelado) throw new Error('El gasto ya estaba cancelado')
      if (!motivo?.trim()) throw new Error('Indica el motivo de la cancelación del gasto')
      validarCajaAbierta(a, g.fecha, g.metodo_pago, esAdmin())
      Object.assign(g, { cancelado: true, motivo_cancelacion: motivo.trim(), cancelado_por: s.id, cancelado_at: ahoraISO(), updated_at: ahoraISO() })
      registrarBitacora(a, { tabla: 'gastos', registro_id: id, accion: 'cancelar', etiqueta: etiquetaGasto(g), cambios: { cancelado: [false, true] }, usuario_id: s.id })
    },
    async subirComprobante(id, archivo) {
      exigir('registrar_gastos')
      await espera(400)
      const g = gasto(id)
      g.comprobante_path = `gastos/${id}/${(archivo as File).name || 'comprobante'}`
      g.updated_at = ahoraISO()
      // Se queda en la memoria del navegador: nada se sube a ningún servidor.
      if (typeof URL !== 'undefined' && 'createObjectURL' in URL) comprobantes.set(id, URL.createObjectURL(archivo))
      return aGasto(g)
    },
    async urlComprobante(id) {
      exigirAlguno('registrar_gastos', 'ver_costos')
      const g = gasto(id)
      if (!g.comprobante_path) return null
      return comprobantes.get(id) ?? vistaPreviaArchivo(`Comprobante · ${g.concepto}`)
    },
    async eliminar(id) {
      const s = exigir('eliminar_registros')
      const g = gasto(id)
      a.gastos.splice(a.gastos.indexOf(g), 1)
      registrarBitacora(a, { tabla: 'gastos', registro_id: id, accion: 'eliminar', etiqueta: etiquetaGasto(g), usuario_id: s.id })
    },
  },
}
