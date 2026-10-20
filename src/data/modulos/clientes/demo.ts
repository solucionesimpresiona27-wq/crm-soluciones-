/** MÓDULO CLIENTES · implementación de la vista previa (almacén en memoria, datos ficticios). */
import { almacen as a, copia, nuevoId, type ClienteFila } from '@/data/demo/almacen'
import { ahoraISO, busquedaDe, diferencias, fechaLocal, nombrePerfil, registrarBitacora } from '@/data/demo/reglas'
import { espera, esAdmin, exigir, puede, puedeVerClientes, usuario } from '@/data/demo/sesion'
import type { ClienteBreve } from '@/data/tipos'
import { normalizar } from '@/lib/utils'
import { busquedaTelefono, telefonoGuardado } from './telefono'
import type { Actividad, ApiClientes, Cliente, ClienteLista, DatosCliente, DatosContacto, HistorialCliente, ResumenCliente } from './contrato'

const limpio = (v: string | null | undefined) => (v?.trim() ? v.trim() : null)

function aplicar(c: ClienteFila, d: Partial<DatosCliente>) {
  if (d.nombre !== undefined) {
    if (!d.nombre.trim()) throw new Error('Escribe el nombre del cliente')
    c.nombre = d.nombre.trim()
  }
  for (const k of ['telefono', 'whatsapp', 'direccion', 'ciudad', 'notas', 'origen', 'razon_social', 'regimen_fiscal', 'codigo_postal_fiscal', 'uso_cfdi', 'email_facturacion'] as const) {
    if (d[k] !== undefined) c[k] = limpio(d[k])
  }
  for (const k of ['telefono', 'whatsapp'] as const) if (d[k] !== undefined) c[k] = telefonoGuardado(d[k])
  if (d.email !== undefined) c.email = limpio(d.email)?.toLowerCase() ?? null
  if (d.rfc !== undefined) c.rfc = limpio(d.rfc)?.toUpperCase() ?? null
  if (d.tipo !== undefined) c.tipo = d.tipo
  if (d.requiere_factura !== undefined) c.requiere_factura = d.requiere_factura
  if (d.dias_credito !== undefined) {
    if (d.dias_credito < 0) throw new Error('Los días de crédito no pueden ser negativos')
    c.dias_credito = d.dias_credito
  }
  if (d.vendedor_id !== undefined) c.vendedor_id = d.vendedor_id
  if (d.lista_precio !== undefined) c.lista_precio = d.lista_precio
  if (d.etiquetas !== undefined) c.etiquetas = [...new Set(d.etiquetas.map((e) => e.trim()).filter(Boolean))]
  c.busqueda = busquedaDe(c.nombre, c.telefono, c.whatsapp, c.email, c.rfc, c.razon_social)
  c.updated_at = ahoraISO()
}

function buscarCliente(id: string) {
  const c = a.clientes.find((x) => x.id === id)
  if (!c) throw new Error('Cliente no encontrado')
  return c
}

const breve = (c: ClienteFila): ClienteBreve & Pick<ClienteFila, 'rfc' | 'razon_social' | 'direccion' | 'ciudad'> => ({
  id: c.id,
  nombre: c.nombre,
  whatsapp: c.whatsapp,
  telefono: c.telefono,
  email: c.email,
  requiere_factura: c.requiere_factura,
  rfc: c.rfc,
  razon_social: c.razon_social,
  direccion: c.direccion,
  ciudad: c.ciudad,
})

function ficha(c: ClienteFila): Cliente {
  const { busqueda: _b, ...resto } = c
  const nombre = nombrePerfil(a, c.vendedor_id)
  return copia({ ...resto, vendedor: c.vendedor_id && nombre ? { id: c.vendedor_id, nombre } : null })
}

const porNombre = (x: { nombre: string }, y: { nombre: string }) => x.nombre.localeCompare(y.nombre, 'es')

export const clientesDemo: ApiClientes = {
  clientes: {
    async buscar(texto) {
      usuario()
      await espera(120)
      // Igual que la regla "clientes: ver" de la base: sin permiso de clientes no hay renglones
      if (!puedeVerClientes()) return []
      const q = normalizar(busquedaTelefono(texto))
      return a.clientes
        .filter((c) => c.activo && (!q || (c.busqueda ?? '').includes(q)))
        .sort(porNombre)
        .slice(0, 20)
        .map((c) => copia(breve(c)))
    },

    async crear(datos) {
      const s = exigir('gestionar_clientes')
      await espera()
      const ahora = ahoraISO()
      const c: ClienteFila = {
        id: nuevoId('c'),
        nombre: '',
        tipo: 'empresa',
        telefono: null,
        whatsapp: null,
        email: null,
        direccion: null,
        ciudad: null,
        notas: null,
        etiquetas: [],
        origen: null,
        requiere_factura: false,
        rfc: null,
        razon_social: null,
        regimen_fiscal: null,
        codigo_postal_fiscal: null,
        uso_cfdi: null,
        email_facturacion: null,
        dias_credito: 0,
        vendedor_id: s.id,
        lista_precio: 'publico',
        ultima_compra_at: null,
        activo: true,
        busqueda: null,
        created_by: s.id,
        created_at: ahora,
        updated_at: ahora,
      }
      aplicar(c, { ...datos, nombre: datos.nombre ?? '' })
      a.clientes.unshift(c)
      registrarBitacora(a, { tabla: 'clientes', registro_id: c.id, accion: 'crear', etiqueta: c.nombre, usuario_id: s.id })
      return copia(breve(c))
    },

    async listar(filtros = {}) {
      usuario()
      await espera(200)
      if (!puedeVerClientes()) return []
      const q = normalizar(busquedaTelefono(filtros.texto ?? ''))
      return a.clientes
        .filter((c) => filtros.incluirInactivos || c.activo)
        .filter((c) => !q || (c.busqueda ?? '').includes(q))
        .filter((c) => !filtros.etiqueta || c.etiquetas.includes(filtros.etiqueta))
        .filter((c) => !filtros.vendedorId || c.vendedor_id === filtros.vendedorId)
        .filter((c) => !filtros.lista || c.lista_precio === filtros.lista)
        .sort(porNombre)
        .slice(0, filtros.limite ?? 500)
        .map(
          (c): ClienteLista => ({
            id: c.id,
            nombre: c.nombre,
            tipo: c.tipo,
            whatsapp: c.whatsapp,
            telefono: c.telefono,
            email: c.email,
            ciudad: c.ciudad,
            etiquetas: [...c.etiquetas],
            lista_precio: c.lista_precio,
            requiere_factura: c.requiere_factura,
            dias_credito: c.dias_credito,
            activo: c.activo,
            vendedor_id: c.vendedor_id,
            vendedor: nombrePerfil(a, c.vendedor_id),
            ultima_compra_at: c.ultima_compra_at,
            created_at: c.created_at,
            rfc: c.rfc,
            contacto_principal: principalDe(c.id),
          }),
        )
    },

    async obtener(id) {
      usuario()
      await espera(150)
      if (!puedeVerClientes()) throw new Error('Cliente no encontrado')
      return ficha(buscarCliente(id))
    },

    async actualizar(id, cambios) {
      const s = exigir('gestionar_clientes')
      await espera()
      const c = buscarCliente(id)
      const antes = { ...c }
      aplicar(c, cambios)
      registrarBitacora(a, { tabla: 'clientes', registro_id: c.id, accion: 'modificar', etiqueta: c.nombre, cambios: diferencias(antes, c), usuario_id: s.id })
      return ficha(c)
    },

    async activar(id, activo) {
      const s = exigir('gestionar_clientes')
      const c = buscarCliente(id)
      if (c.activo === activo) return
      c.activo = activo
      c.updated_at = ahoraISO()
      registrarBitacora(a, { tabla: 'clientes', registro_id: c.id, accion: 'modificar', etiqueta: c.nombre, cambios: { activo: [!activo, activo] }, usuario_id: s.id })
    },

    async eliminar(id) {
      const s = exigir('eliminar_registros')
      const c = buscarCliente(id)
      const relacionado =
        a.cotizaciones.some((q) => q.cliente.id === id) || a.pedidos.some((p) => p.cliente_id === id) || a.pagos.some((p) => p.cliente_id === id)
      if (relacionado) throw new Error('No se puede eliminar: el cliente tiene cotizaciones, pedidos o pagos. Desactívalo para ocultarlo.')
      a.clientes.splice(a.clientes.indexOf(c), 1)
      // En cascada, como en la base de datos
      a.contactos = a.contactos.filter((x) => x.cliente_id !== id)
      a.actividades = a.actividades.filter((x) => x.cliente_id !== id)
      a.oportunidades = a.oportunidades.filter((x) => x.cliente_id !== id)
      registrarBitacora(a, { tabla: 'clientes', registro_id: id, accion: 'eliminar', etiqueta: c.nombre, usuario_id: s.id })
    },

    async resumen(id) {
      usuario()
      await espera(150)
      if (!puedeVerClientes()) throw new Error('No tienes permiso para ver la ficha de los clientes')
      const pedidos = a.pedidos.filter((p) => p.cliente_id === id && p.estado !== 'cancelado')
      const r: ResumenCliente = {
        pedidos: pedidos.length,
        pedidos_activos: pedidos.filter((p) => !['entregado', 'finalizado'].includes(p.estado)).length,
        cotizaciones: a.cotizaciones.filter((q) => q.cliente.id === id).length,
        ultima_compra: pedidos.map((p) => p.created_at).sort().at(-1) ?? null,
      }
      if (puede('ver_precios')) {
        const hoy = fechaLocal()
        const suma = (xs: number[]) => Math.round(xs.reduce((t, x) => t + x, 0) * 100) / 100
        r.total_comprado = suma(pedidos.map((p) => p.total))
        r.total_pagado = suma(pedidos.map((p) => p.pagado))
        r.saldo = suma(pedidos.map((p) => Math.max(p.saldo ?? 0, 0)))
        r.cotizado_abierto = suma(
          a.cotizaciones.filter((q) => q.cliente.id === id && ['borrador', 'enviada'].includes(q.estado) && q.fecha_vencimiento >= hoy).map((q) => q.total),
        )
      }
      return r
    },

    async historial(id) {
      usuario()
      await espera(200)
      const precios = puede('ver_precios')
      const folio = (pedidoId: string) => a.pedidos.find((p) => p.id === pedidoId)?.folio ?? ''
      const h: HistorialCliente = {
        cotizaciones: precios
          ? a.cotizaciones
              .filter((q) => q.cliente.id === id)
              .sort((x, y) => y.created_at.localeCompare(x.created_at))
              .map((q) => ({ id: q.id, folio: q.folio, titulo: q.titulo, fecha: q.fecha, estado: q.estado, total: q.total, pedido_id: q.pedido_id }))
          : [],
        pedidos: a.pedidos
          .filter((p) => p.cliente_id === id)
          .sort((x, y) => y.created_at.localeCompare(x.created_at))
          .map((p) => ({
            id: p.id,
            folio: p.folio,
            titulo: p.titulo,
            estado: p.estado,
            estado_pago: p.estado_pago,
            fecha_entrega: p.fecha_entrega,
            created_at: p.created_at,
            total: precios ? p.total : null,
            saldo: precios ? p.saldo : null,
          })),
        pagos: precios
          ? a.pagos
              .filter((p) => p.cliente_id === id)
              .sort((x, y) => y.fecha.localeCompare(x.fecha) || y.created_at.localeCompare(x.created_at))
              .map((p) => ({ id: p.id, pedido_id: p.pedido_id, folio: folio(p.pedido_id), fecha: p.fecha, importe: p.importe, tipo: p.tipo, metodo: p.metodo, cancelado: p.cancelado }))
          : [],
      }
      return copia(h)
    },

    async etiquetas() {
      usuario()
      if (!puedeVerClientes()) return []
      return [...new Set(a.clientes.filter((c) => c.activo).flatMap((c) => c.etiquetas))].sort((x, y) => x.localeCompare(y, 'es'))
    },

    async asignarListaPrecio(id, lista) {
      const s = exigir('gestionar_clientes')
      const c = buscarCliente(id)
      if (c.lista_precio === lista) return
      registrarBitacora(a, { tabla: 'clientes', registro_id: id, accion: 'modificar', etiqueta: c.nombre, cambios: { lista_precio: [c.lista_precio, lista] }, usuario_id: s.id })
      c.lista_precio = lista
      c.updated_at = ahoraISO()
    },

    async inactivos(dias) {
      exigir('gestionar_clientes')
      await espera(250)
      const limiteDias = dias ?? a.configuracion.dias_reactivacion ?? 90
      if (limiteDias < 1 || limiteDias > 3650) throw new Error('Indica un número de días entre 1 y 3650')
      const corte = Date.now() - limiteDias * 86_400_000
      const hoy = new Date(`${fechaLocal()}T00:00:00`).getTime()
      return a.clientes
        .filter((c) => c.activo)
        .map((c) => {
          const pedidos = a.pedidos.filter((p) => p.cliente_id === c.id && p.estado !== 'cancelado').sort((x, y) => x.created_at.localeCompare(y.created_at))
          return { c, pedidos }
        })
        .filter(({ pedidos }) => pedidos.length > 0 && new Date(pedidos.at(-1)!.created_at).getTime() < corte)
        .map(({ c, pedidos }) => {
          const ultima = pedidos.at(-1)!
          const vendedorId = c.vendedor_id ?? ultima.vendedor_id
          const diaUltima = new Date(`${fechaLocal(ultima.created_at)}T00:00:00`).getTime()
          return {
            cliente_id: c.id,
            nombre: c.nombre,
            whatsapp: c.whatsapp,
            telefono: c.telefono,
            email: c.email,
            etiquetas: [...c.etiquetas],
            ultima_compra: ultima.created_at,
            dias_sin_compra: Math.round((hoy - diaUltima) / 86_400_000),
            pedidos: pedidos.length,
            total_comprado: puede('ver_precios') ? Math.round(pedidos.reduce((t, p) => t + p.total, 0) * 100) / 100 : null,
            vendedor_id: vendedorId,
            vendedor: nombrePerfil(a, vendedorId),
          }
        })
        .sort((x, y) => y.ultima_compra.localeCompare(x.ultima_compra))
    },

    async saldos() {
      usuario()
      await espera(120)
      if (!puede('ver_precios')) return {}
      const r: Record<string, number> = {}
      for (const p of a.pedidos) {
        const saldo = p.saldo ?? 0
        if (p.estado === 'cancelado' || saldo <= 0) continue
        r[p.cliente_id] = Math.round(((r[p.cliente_id] ?? 0) + saldo) * 100) / 100
      }
      return r
    },
  },

  contactos: {
    async listar(clienteId) {
      usuario()
      await espera(120)
      if (!puedeVerClientes()) return []
      return copia(a.contactos.filter((x) => x.cliente_id === clienteId).sort((x, y) => Number(y.principal) - Number(x.principal) || porNombre(x, y)))
    },
    async crear(clienteId, datos) {
      const s = exigir('gestionar_clientes')
      buscarCliente(clienteId)
      if (!datos.nombre?.trim()) throw new Error('Escribe el nombre del contacto')
      const ahora = ahoraISO()
      if (datos.principal) a.contactos.filter((x) => x.cliente_id === clienteId).forEach((x) => (x.principal = false))
      const fila = {
        id: nuevoId('ct'),
        cliente_id: clienteId,
        nombre: datos.nombre.trim(),
        puesto: limpio(datos.puesto),
        telefono: telefonoGuardado(datos.telefono),
        whatsapp: telefonoGuardado(datos.whatsapp),
        email: limpio(datos.email)?.toLowerCase() ?? null,
        principal: datos.principal ?? false,
        notas: limpio(datos.notas),
        created_at: ahora,
        updated_at: ahora,
      }
      a.contactos.push(fila)
      registrarBitacora(a, { tabla: 'contactos', registro_id: fila.id, accion: 'crear', etiqueta: fila.nombre, usuario_id: s.id })
      return copia(fila)
    },
    async actualizar(id, cambios: Partial<DatosContacto>) {
      const s = exigir('gestionar_clientes')
      const x = a.contactos.find((c) => c.id === id)
      if (!x) throw new Error('Contacto no encontrado')
      if (cambios.nombre !== undefined && !cambios.nombre.trim()) throw new Error('Escribe el nombre del contacto')
      if (cambios.principal) a.contactos.filter((c) => c.cliente_id === x.cliente_id && c.id !== id).forEach((c) => (c.principal = false))
      if (cambios.nombre !== undefined) x.nombre = cambios.nombre.trim()
      for (const k of ['puesto', 'telefono', 'whatsapp', 'notas'] as const) if (cambios[k] !== undefined) x[k] = limpio(cambios[k])
      for (const k of ['telefono', 'whatsapp'] as const) if (cambios[k] !== undefined) x[k] = telefonoGuardado(cambios[k])
      if (cambios.email !== undefined) x.email = limpio(cambios.email)?.toLowerCase() ?? null
      if (cambios.principal !== undefined) x.principal = cambios.principal
      x.updated_at = ahoraISO()
      registrarBitacora(a, { tabla: 'contactos', registro_id: id, accion: 'modificar', etiqueta: x.nombre, usuario_id: s.id })
      return copia(x)
    },
    async eliminar(id) {
      const s = exigir('gestionar_clientes')
      const x = a.contactos.find((c) => c.id === id)
      if (!x) throw new Error('Contacto no encontrado')
      a.contactos.splice(a.contactos.indexOf(x), 1)
      registrarBitacora(a, { tabla: 'contactos', registro_id: id, accion: 'eliminar', etiqueta: x.nombre, usuario_id: s.id })
    },
  },

  actividades: {
    async listar({ clienteId, oportunidadId, limite }) {
      exigir('gestionar_clientes')
      await espera(150)
      return a.actividades
        .filter((x) => (!clienteId || x.cliente_id === clienteId) && (!oportunidadId || x.oportunidad_id === oportunidadId))
        .sort((x, y) => y.fecha.localeCompare(x.fecha))
        .slice(0, limite ?? 200)
        .map((x) => conNombres(x))
    },
    async registrar(datos) {
      const s = exigir('gestionar_clientes')
      buscarCliente(datos.cliente_id)
      if (!datos.descripcion?.trim()) throw new Error('Describe la actividad')
      const ahora = ahoraISO()
      const fila = {
        id: nuevoId('ac'),
        cliente_id: datos.cliente_id,
        oportunidad_id: datos.oportunidad_id ?? null,
        tipo: datos.tipo,
        descripcion: datos.descripcion.trim(),
        fecha: datos.fecha ?? ahora,
        usuario_id: s.id,
        created_at: ahora,
      }
      a.actividades.push(fila)
      return conNombres(fila)
    },
    async eliminar(id) {
      const s = usuario()
      const x = a.actividades.find((c) => c.id === id)
      if (!x) throw new Error('Actividad no encontrada')
      if (x.usuario_id !== s.id && !esAdmin()) throw new Error('Solo puedes eliminar tus propias actividades')
      a.actividades.splice(a.actividades.indexOf(x), 1)
    },
  },
}

function principalDe(clienteId: string): ClienteLista['contacto_principal'] {
  const lista = a.contactos
    .filter((x) => x.cliente_id === clienteId)
    .sort((x, y) => Number(y.principal) - Number(x.principal) || x.created_at.localeCompare(y.created_at))
  const p = lista[0]
  return p ? { nombre: p.nombre, puesto: p.puesto, whatsapp: p.whatsapp } : null
}

function conNombres(x: (typeof a.actividades)[number]): Actividad {
  return copia({ ...x, usuario: nombrePerfil(a, x.usuario_id), oportunidad: a.oportunidades.find((o) => o.id === x.oportunidad_id)?.titulo ?? null })
}
