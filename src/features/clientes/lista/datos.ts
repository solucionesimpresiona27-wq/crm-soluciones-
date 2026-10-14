import type { ClienteLista, ListaPrecio } from '@/data/modulos/clientes/contrato'
import { LISTAS_PRECIO } from '@/data/modulos/clientes/contrato'
import { normalizar } from '@/lib/utils'
import { digitosTelefono } from '../validacion'

export type TipoFiltro = 'todos' | 'empresa' | 'persona'
export type Orden = 'nombre' | 'compra'

export interface FilaCliente extends ClienteLista {
  /** Texto normalizado (sin acentos) para la búsqueda instantánea */
  busqueda: string
  /** Solo dígitos de los teléfonos, para buscar "3312" aunque se haya guardado "33 12…" */
  digitos: string
  saldo: number | null
}

export function prepararFilas(clientes: ClienteLista[], saldos: Record<string, number> | undefined): FilaCliente[] {
  return clientes.map((c) => ({
    ...c,
    busqueda: normalizar([c.nombre, c.email, c.rfc, c.ciudad, c.contacto_principal?.nombre, ...c.etiquetas].filter(Boolean).join(' ')),
    digitos: [c.whatsapp, c.telefono, c.contacto_principal?.whatsapp].map(digitosTelefono).join(' '),
    saldo: saldos ? (saldos[c.id] ?? 0) : null,
  }))
}

/** Coincide si TODAS las palabras aparecen (en cualquier orden); los números buscan también en teléfonos. */
export function coincide(f: FilaCliente, texto: string) {
  const q = normalizar(texto)
  if (!q) return true
  return q.split(/\s+/).every((p) => {
    if (f.busqueda.includes(p)) return true
    const d = p.replace(/\D/g, '')
    return d.length >= 3 && d.length === p.replace(/[\s()+-]/g, '').length && f.digitos.includes(d)
  })
}

export function filtrar(filas: FilaCliente[], o: { texto: string; tipo: TipoFiltro; etiqueta: string; orden: Orden }) {
  const r = filas.filter((f) => (o.tipo === 'todos' || f.tipo === o.tipo) && (!o.etiqueta || f.etiquetas.includes(o.etiqueta)) && coincide(f, o.texto))
  if (o.orden === 'compra') {
    // Más reciente primero; los que nunca han comprado al final
    return [...r].sort((a, b) => (b.ultima_compra_at ?? '').localeCompare(a.ultima_compra_at ?? '') || a.nombre.localeCompare(b.nombre, 'es'))
  }
  return [...r].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

const celda = (v: string | number | null | undefined) => {
  const t = v === null || v === undefined ? '' : String(v)
  return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

/** CSV con BOM (Excel abre bien los acentos). Los saldos solo van si se pueden ver precios. */
export function aCsv(filas: FilaCliente[], conSaldo: boolean) {
  const enc = ['Nombre', 'Tipo', 'Contacto principal', 'WhatsApp', 'Teléfono', 'Correo', 'Ciudad', 'Etiquetas', 'Lista de precios', 'RFC', 'Última compra', ...(conSaldo ? ['Saldo pendiente'] : []), 'Vendedor']
  const renglones = filas.map((f) => [
    f.nombre,
    f.tipo === 'persona' ? 'Persona' : 'Empresa',
    f.contacto_principal?.nombre,
    f.whatsapp,
    f.telefono,
    f.email,
    f.ciudad,
    f.etiquetas.join(', '),
    LISTAS_PRECIO[f.lista_precio as ListaPrecio] ?? f.lista_precio,
    f.rfc,
    f.ultima_compra_at?.slice(0, 10),
    ...(conSaldo ? [f.saldo?.toFixed(2)] : []),
    f.vendedor,
  ])
  return '﻿' + [enc, ...renglones].map((r) => r.map(celda).join(',')).join('\r\n')
}

export function descargar(nombre: string, contenido: string, tipo = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
