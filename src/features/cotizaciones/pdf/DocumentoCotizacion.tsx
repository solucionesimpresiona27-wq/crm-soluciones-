/**
 * PDF de la cotización (tamaño carta) con @react-pdf/renderer.
 * Este módulo solo se carga con import() desde generarPdf.ts, así la librería
 * no pesa en la carga inicial de la app.
 *
 * Fuente: Helvetica integrada (WinAnsi). Por eso se evitan caracteres fuera de ese
 * juego, como el signo menos tipográfico (−): se usa el guion normal.
 */
import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactNode } from 'react'
import type { Configuracion, CotizacionCompleta, PartidaDoc } from '@/data/tipos'
import { describirMedidas } from '@/lib/calculadora'
import { cantidad, dinero, fechaLarga, telefono } from '@/lib/format'
import { redondear } from '@/lib/utils'

// Sin división de palabras: las reglas incluidas son del inglés y cortan mal el español ("comple-jidad")
Font.registerHyphenationCallback((palabra) => [palabra])

const AZUL = '#22426B'
const AMARILLO = '#F9C206'
const TINTA = '#0E1C30'
const GRIS = '#55657C'
const TENUE = '#8A98AC'
const LINEA = '#DCE4EE'
const FONDO = '#F3F6FA'
const LUZ_SUAVE = '#FEF5CC'

const MARGEN = 44

const s = StyleSheet.create({
  pagina: {
    paddingTop: 38,
    paddingBottom: 72,
    paddingHorizontal: MARGEN,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: TINTA,
  },
  franja: { position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: AZUL },
  franjaLuz: { position: 'absolute', top: 0, left: MARGEN, width: 84, height: 6, backgroundColor: AMARILLO },
  marcaAgua: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  marcaAguaTexto: {
    width: 760,
    textAlign: 'center',
    transform: 'rotate(-35deg)',
    fontFamily: 'Helvetica-Bold',
    fontSize: 34,
    color: AZUL,
    opacity: 0.07,
    letterSpacing: 2,
  },

  encabezado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8 },
  logo: { width: 138, height: 48, objectFit: 'contain', objectPosition: 'left' },
  contacto: { marginTop: 10, fontSize: 8, color: GRIS, lineHeight: 1.5 },
  contactoFuerte: { fontFamily: 'Helvetica-Bold', color: TINTA },
  folioBloque: { alignItems: 'flex-end', paddingTop: 2 },
  documento: { fontSize: 10, color: AZUL, fontFamily: 'Helvetica-Bold' },
  folio: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: TINTA, marginTop: 2, letterSpacing: -0.4 },
  fechas: { marginTop: 8 },
  fechaFila: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2 },
  fechaEtiqueta: { color: TENUE, width: 70, textAlign: 'right', marginRight: 8 },
  fechaValor: { color: TINTA, width: 120, textAlign: 'right' },

  filete: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  fileteLuz: { width: 40, height: 3, borderRadius: 2, backgroundColor: AMARILLO },
  fileteAzul: { flexGrow: 1, height: 0.75, marginLeft: 4, backgroundColor: AZUL, opacity: 0.35 },

  bloques: { flexDirection: 'row', marginTop: 16 },
  bloqueCliente: { flex: 1.45, paddingRight: 20 },
  bloqueAtiende: { flex: 1 },
  etiqueta: { fontSize: 7.5, color: TENUE, marginBottom: 3 },
  clienteNombre: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: TINTA, marginBottom: 2 },
  // Con lineHeight siempre va fontSize explícito: react-pdf no calcula bien el interlineado heredado
  texto: { fontSize: 9, color: GRIS, lineHeight: 1.4 },
  separacion: { marginTop: 8 },

  titulo: { marginTop: 18, fontSize: 12.5, fontFamily: 'Helvetica-Bold', color: TINTA },

  tabla: { marginTop: 10 },
  cabecera: {
    flexDirection: 'row',
    backgroundColor: AZUL,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  th: { color: '#FFFFFF', fontSize: 7.5, fontFamily: 'Helvetica-Bold' },
  fila: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 0.75, borderBottomColor: LINEA },
  colNum: { width: 18, color: TENUE },
  colConcepto: { flex: 1, paddingRight: 10 },
  colCantidad: { width: 66, textAlign: 'right' },
  colPrecio: { width: 74, textAlign: 'right' },
  colDesc: { width: 42, textAlign: 'right' },
  colImporte: { width: 80, textAlign: 'right' },
  concepto: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, color: TINTA },
  descripcion: { marginTop: 2, color: GRIS, fontSize: 8.5, lineHeight: 1.35 },
  medidas: { marginTop: 2, color: TENUE, fontSize: 8 },
  unidad: { color: GRIS },
  importe: { fontFamily: 'Helvetica-Bold', color: TINTA },

  resumen: { flexDirection: 'row', marginTop: 14 },
  resumenIzq: { flex: 1, paddingRight: 24 },
  resumenDer: { width: 236 },
  linea: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
  lineaEtiqueta: { color: GRIS, maxWidth: 150 },
  lineaValor: { color: TINTA },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: AZUL,
    borderRadius: 5,
  },
  totalEtiqueta: { color: '#FFFFFF', fontFamily: 'Helvetica-Bold', fontSize: 10 },
  totalValor: { color: '#FFFFFF', fontFamily: 'Helvetica-Bold', fontSize: 13 },
  anticipo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: LUZ_SUAVE,
    borderLeftWidth: 3,
    borderLeftColor: AMARILLO,
    borderRadius: 3,
  },
  anticipoTexto: { color: TINTA },
  anticipoValor: { color: TINTA, fontFamily: 'Helvetica-Bold' },
  sinIva: { marginTop: 4, textAlign: 'right', fontSize: 7.5, color: TENUE },

  caja: { borderWidth: 0.75, borderColor: LINEA, borderRadius: 5, padding: 10, backgroundColor: FONDO },
  cajaTitulo: { fontFamily: 'Helvetica-Bold', color: AZUL, fontSize: 8.5, marginBottom: 4 },

  seccion: { marginTop: 18 },
  seccionTitulo: { fontFamily: 'Helvetica-Bold', color: AZUL, fontSize: 10, marginBottom: 6 },
  vineta: { flexDirection: 'row', marginBottom: 2.5 },
  vinetaPunto: { width: 4, height: 4, borderRadius: 1, backgroundColor: AMARILLO, marginTop: 3.5, marginRight: 7 },
  vinetaTexto: { flex: 1, color: GRIS, fontSize: 8.5, lineHeight: 1.4 },
  vinetaFuerte: { fontFamily: 'Helvetica-Bold', color: TINTA },

  // Cierre en el margen inferior de la última página: nunca abre una hoja solo para él
  cierre: { position: 'absolute', left: MARGEN, right: MARGEN, bottom: 52, textAlign: 'center', color: AZUL, fontFamily: 'Helvetica-Bold', fontSize: 9.5 },

  pie: {
    position: 'absolute',
    left: MARGEN,
    right: MARGEN,
    bottom: 26,
    paddingTop: 8,
    borderTopWidth: 0.75,
    borderTopColor: LINEA,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  pieTexto: { flex: 1, fontSize: 7.5, color: TENUE, paddingRight: 16, lineHeight: 1.4 },
  // Ancho fijo: el texto con render() no se mide antes de acomodar la fila
  piePagina: { width: 72, fontSize: 7.5, color: TENUE, textAlign: 'right' },
})

/** Helvetica integrada solo trae el juego WinAnsi: se sustituyen los caracteres que no tiene. */
function limpio(t: string | null | undefined) {
  if (!t) return ''
  return t
    .replace(/−/g, '-')
    .replace(/[‐‑]/g, '-')
    .replace(/[  ]/g, ' ')
    .replace(/[^\u0000-ÿ–—‘’“”•…€]/g, '')
}

function Vineta({ children }: { children: ReactNode }) {
  return (
    <View style={s.vineta} wrap={false}>
      <View style={s.vinetaPunto} />
      <Text style={s.vinetaTexto}>{children}</Text>
    </View>
  )
}

function Linea({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={s.linea}>
      <Text style={s.lineaEtiqueta}>{limpio(etiqueta)}</Text>
      <Text style={s.lineaValor}>{valor}</Text>
    </View>
  )
}

function FilaConcepto({ p, i, conDescuento }: { p: PartidaDoc; i: number; conDescuento: boolean }) {
  const medidas = describirMedidas(p.metodo_calculo, p.ancho, p.alto, p.largo)
  return (
    <View style={s.fila} wrap={false}>
      <Text style={s.colNum}>{i + 1}</Text>
      <View style={s.colConcepto}>
        <Text style={s.concepto}>{limpio(p.concepto)}</Text>
        {p.descripcion ? <Text style={s.descripcion}>{limpio(p.descripcion)}</Text> : null}
        {medidas ? <Text style={s.medidas}>Medidas: {limpio(medidas)}</Text> : null}
      </View>
      <Text style={s.colCantidad}>
        {cantidad(p.cantidad)} <Text style={s.unidad}>{limpio(p.unidad)}</Text>
      </Text>
      <Text style={s.colPrecio}>{dinero(p.precio_unitario)}</Text>
      {conDescuento ? <Text style={s.colDesc}>{p.descuento_pct > 0 ? `${cantidad(p.descuento_pct)} %` : '-'}</Text> : null}
      <Text style={[s.colImporte, s.importe]}>{dinero(p.importe)}</Text>
    </View>
  )
}

export interface DatosPdf {
  c: CotizacionCompleta
  config: Configuracion
  logo: string
  marcaAgua: boolean
}

export function DocumentoCotizacion({ c, config, logo, marcaAgua }: DatosPdf) {
  const empresa = config.nombre_comercial || 'Soluciones Impresiona'
  const fiscal = config.mostrar_datos_fiscales ? [config.razon_social, config.rfc ? `RFC ${config.rfc}` : null].filter(Boolean).join(', ') : ''
  const ubicacion = [config.direccion, config.ciudad].filter(Boolean).join(', ')
  const contactoDirecto = [config.whatsapp ? `WhatsApp ${telefono(config.whatsapp)}` : null, config.telefono ? `Tel. ${telefono(config.telefono)}` : null, config.email]
    .filter(Boolean)
    .join('   ')
  const redes = [
    config.instagram ? `Instagram ${config.instagram}` : null,
    config.facebook ? `Facebook ${config.facebook}` : null,
    config.tiktok ? `TikTok ${config.tiktok}` : null,
    config.sitio_web,
  ]
    .filter(Boolean)
    .join('   ')
  const pie = [
    config.whatsapp ? `WhatsApp ${telefono(config.whatsapp)}` : null,
    config.email,
    config.instagram ? `Instagram ${config.instagram}` : null,
  ]
    .filter(Boolean)
    .join('  |  ')

  const conDescuento = c.partidas.some((p) => p.descuento_pct > 0)
  const anticipo = redondear((c.total * c.anticipo_pct) / 100)
  const condiciones = (c.condiciones ?? '')
    .split('\n')
    .map((l) => l.trim().replace(/^[-•*·]\s*/, ''))
    .filter(Boolean)
  const clienteFiscal = [c.cliente.razon_social, c.cliente.rfc ? `RFC ${c.cliente.rfc}` : null].filter(Boolean).join(', ')
  const clienteContacto = [
    c.cliente.whatsapp || c.cliente.telefono ? `Tel. ${telefono(c.cliente.whatsapp ?? c.cliente.telefono)}` : null,
    c.cliente.email,
  ]
    .filter(Boolean)
    .join('   ')
  const clienteUbicacion = [c.cliente.direccion, c.cliente.ciudad].filter(Boolean).join(', ')
  const bancarios = (config.datos_bancarios ?? '').trim()

  return (
    <Document
      title={`Cotización ${c.folio}`}
      author={limpio(empresa)}
      subject={limpio(`Cotización para ${c.cliente.nombre}`)}
      creator="CRM Soluciones Impresiona"
      producer="CRM Soluciones Impresiona"
      language="es-MX"
    >
      <Page size="LETTER" style={s.pagina}>
        {marcaAgua ? (
          <View fixed style={s.marcaAgua}>
            <Text style={s.marcaAguaTexto}>VISTA PREVIA · DATOS FICTICIOS</Text>
          </View>
        ) : null}
        <View fixed style={s.franja} />
        <View fixed style={s.franjaLuz} />

        {/* Encabezado */}
        <View style={s.encabezado}>
          <View>
            <Image src={logo} style={s.logo} />
            <View style={s.contacto}>
              {fiscal ? <Text style={s.contactoFuerte}>{limpio(fiscal)}</Text> : null}
              {ubicacion ? <Text>{limpio(ubicacion)}</Text> : null}
              {contactoDirecto ? <Text>{limpio(contactoDirecto)}</Text> : null}
              {redes ? <Text>{limpio(redes)}</Text> : null}
            </View>
          </View>
          <View style={s.folioBloque}>
            <Text style={s.documento}>Cotización</Text>
            <Text style={s.folio}>{c.folio}</Text>
            <View style={s.fechas}>
              <View style={s.fechaFila}>
                <Text style={s.fechaEtiqueta}>Fecha</Text>
                <Text style={s.fechaValor}>{fechaLarga(c.fecha)}</Text>
              </View>
              <View style={s.fechaFila}>
                <Text style={s.fechaEtiqueta}>Válida hasta</Text>
                <Text style={[s.fechaValor, { fontFamily: 'Helvetica-Bold' }]}>{fechaLarga(c.fecha_vencimiento)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={s.filete}>
          <View style={s.fileteLuz} />
          <View style={s.fileteAzul} />
        </View>

        {/* Cliente y quién atiende */}
        <View style={s.bloques}>
          <View style={s.bloqueCliente}>
            <Text style={s.etiqueta}>Cliente</Text>
            <Text style={s.clienteNombre}>{limpio(c.cliente.nombre)}</Text>
            {clienteFiscal ? <Text style={s.texto}>{limpio(clienteFiscal)}</Text> : null}
            {clienteContacto ? <Text style={s.texto}>{limpio(clienteContacto)}</Text> : null}
            {clienteUbicacion ? <Text style={s.texto}>{limpio(clienteUbicacion)}</Text> : null}
          </View>
          <View style={s.bloqueAtiende}>
            {c.vendedor ? (
              <View>
                <Text style={s.etiqueta}>Atiende</Text>
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>{limpio(c.vendedor.nombre)}</Text>
                <Text style={s.texto}>{limpio([c.vendedor.email, c.vendedor.telefono ? telefono(c.vendedor.telefono) : null].filter(Boolean).join('   '))}</Text>
              </View>
            ) : null}
            {c.tiempo_entrega ? (
              <View style={c.vendedor ? s.separacion : undefined}>
                <Text style={s.etiqueta}>Tiempo de entrega</Text>
                <Text style={s.texto}>{limpio(c.tiempo_entrega)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {c.titulo ? <Text style={s.titulo}>{limpio(c.titulo)}</Text> : null}

        {/* Conceptos */}
        <View style={[s.tabla, c.titulo ? {} : { marginTop: 18 }]}>
          <View style={s.cabecera}>
            <Text style={[s.th, s.colNum, { color: '#FFFFFF' }]}>#</Text>
            <Text style={[s.th, s.colConcepto]}>Concepto</Text>
            <Text style={[s.th, s.colCantidad]}>Cantidad</Text>
            <Text style={[s.th, s.colPrecio]}>P. unitario</Text>
            {conDescuento ? <Text style={[s.th, s.colDesc]}>Desc.</Text> : null}
            <Text style={[s.th, s.colImporte]}>Importe</Text>
          </View>
          {c.partidas.map((p, i) => (
            <FilaConcepto key={p.id} p={p} i={i} conDescuento={conDescuento} />
          ))}
        </View>

        {/* Totales */}
        <View style={s.resumen} wrap={false}>
          <View style={s.resumenIzq}>
            {bancarios ? (
              <View style={s.caja}>
                <Text style={s.cajaTitulo}>Datos para transferencia</Text>
                <Text style={s.texto}>{limpio(bancarios)}</Text>
              </View>
            ) : null}
          </View>
          <View style={s.resumenDer}>
            <Linea etiqueta="Subtotal" valor={dinero(c.subtotal)} />
            {c.descuento > 0 ? (
              <Linea
                etiqueta={c.descuento_tipo === 'pct' ? `Descuento (${cantidad(c.descuento_valor)} %)` : 'Descuento'}
                valor={`-${dinero(c.descuento)}`}
              />
            ) : null}
            {c.recargo > 0 ? <Linea etiqueta={`${c.recargo_concepto || 'Recargo'} (${cantidad(c.recargo_pct)} %)`} valor={dinero(c.recargo)} /> : null}
            {c.aplica_iva ? <Linea etiqueta={`IVA (${cantidad(c.iva_pct)} %)`} valor={dinero(c.iva)} /> : null}
            <View style={s.total}>
              <Text style={s.totalEtiqueta}>Total</Text>
              <Text style={s.totalValor}>{dinero(c.total)}</Text>
            </View>
            {!c.aplica_iva ? <Text style={s.sinIva}>Precios sin IVA</Text> : null}
            {c.anticipo_pct > 0 ? (
              <View style={s.anticipo}>
                <Text style={s.anticipoTexto}>Anticipo requerido ({cantidad(c.anticipo_pct)} %)</Text>
                <Text style={s.anticipoValor}>{dinero(anticipo)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Condiciones comerciales */}
        <View style={s.seccion}>
          <Text style={s.seccionTitulo} minPresenceAhead={40}>
            Condiciones comerciales
          </Text>
          <Vineta>
            <Text style={s.vinetaFuerte}>Vigencia: </Text>
            esta cotización es válida hasta el {fechaLarga(c.fecha_vencimiento)} ({c.vigencia_dias} {c.vigencia_dias === 1 ? 'día' : 'días'}).
          </Vineta>
          {c.anticipo_pct > 0 ? (
            <Vineta>
              <Text style={s.vinetaFuerte}>Anticipo: </Text>
              {cantidad(c.anticipo_pct)} % del total ({dinero(anticipo)}) para iniciar el trabajo.
            </Vineta>
          ) : null}
          {condiciones.map((l, i) => (
            <Vineta key={i}>{limpio(l)}</Vineta>
          ))}
        </View>

        {c.notas ? (
          <View style={s.seccion} wrap={false}>
            <Text style={s.seccionTitulo}>Notas</Text>
            <Text style={s.texto}>{limpio(c.notas)}</Text>
          </View>
        ) : null}

        {config.notas_pie_cotizacion ? (
          <Text
            fixed
            style={s.cierre}
            render={({ pageNumber, totalPages }) => (pageNumber === totalPages ? limpio(config.notas_pie_cotizacion) : '')}
          />
        ) : null}

        {/* Pie en todas las páginas */}
        <View fixed style={s.pie}>
          <Text style={s.pieTexto}>{limpio(`${empresa}${pie ? `  |  ${pie}` : ''}`)}</Text>
          <Text style={s.piePagina} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
