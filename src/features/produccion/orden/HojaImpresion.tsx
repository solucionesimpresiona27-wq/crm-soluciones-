import { createPortal } from 'react-dom'
import type { HojaOrden } from '@/data/modulos/produccion/contrato'
import { describirMedidas } from '@/lib/calculadora'
import { cantidad, fechaLarga } from '@/lib/format'
import { ESTADO_PEDIDO } from '@/lib/estados'
import { PASOS_TALLER, PRIORIDAD } from './comun'

/**
 * Hoja para imprimir (window.print): blanco y negro, sin cristal y SIN precios.
 * Se monta en <body> fuera de la app; en pantalla no se ve y al imprimir oculta todo lo demás.
 * Las reglas viven aquí (no en index.css) y desaparecen al salir de la orden.
 */
const ESTILOS = `
.orden-impresion { display: none; }
@media print {
  @page { size: letter; margin: 12mm 12mm 14mm; }
  html, body { background: #fff !important; }
  body > *:not(.orden-impresion) { display: none !important; }
  .orden-impresion { display: block !important; color: #111; font-size: 10.5pt; line-height: 1.4; }
  .orden-impresion * { color: inherit; }
  .oi-cab { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #111; padding-bottom: 10px; }
  .oi-cab img { height: 40px; width: auto; }
  .oi-folio { text-align: right; }
  .oi-folio p { margin: 0; }
  .oi-folio .oi-num { font-size: 22pt; font-weight: 700; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
  .oi-urgente { display: inline-block; border: 2px solid #111; padding: 1px 8px; border-radius: 99px; font-weight: 700; font-size: 9pt; margin-top: 4px; }
  .oi-titulo { font-size: 15pt; font-weight: 700; margin: 12px 0 2px; }
  .oi-datos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 16px; margin: 10px 0 14px; }
  .oi-datos dt { font-size: 8pt; color: #555; margin: 0; }
  .oi-datos dd { margin: 0; font-weight: 600; }
  .oi-ancho { grid-column: 1 / -1; }
  .oi-h { font-size: 11pt; font-weight: 700; margin: 16px 0 6px; }
  table.oi-tabla { width: 100%; border-collapse: collapse; }
  .oi-tabla th { text-align: left; font-size: 8pt; color: #555; font-weight: 600; border-bottom: 1px solid #111; padding: 4px 6px; }
  .oi-tabla td { border-bottom: 1px solid #bbb; padding: 7px 6px; vertical-align: top; }
  .oi-tabla tr { break-inside: avoid; }
  .oi-num-col, .oi-tabla .oi-num-col { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .oi-sub { font-size: 9pt; color: #444; }
  .oi-caja { display: inline-block; width: 13px; height: 13px; border: 1.5px solid #111; border-radius: 3px; vertical-align: -2px; }
  .oi-lista { list-style: none; padding: 0; margin: 0; columns: 2; column-gap: 24px; }
  .oi-lista li { break-inside: avoid; padding: 4px 0; display: flex; gap: 8px; align-items: baseline; }
  .oi-firmas { display: grid; grid-template-columns: 1fr 1fr 0.6fr; gap: 24px; margin-top: 36px; break-inside: avoid; }
  .oi-firmas div { border-top: 1px solid #111; padding-top: 4px; font-size: 9pt; color: #444; }
  .oi-pie { margin-top: 18px; font-size: 8pt; color: #666; }
}
`

export function HojaImpresion({ hoja }: { hoja: HojaOrden }) {
  const { orden: o, partidas, disenos } = hoja
  const aprobados = disenos.filter((d) => d.estado_aprobacion === 'aprobado')
  const pasos = PASOS_TALLER.filter((p) => !p.soloInstalacion || o.requiere_instalacion)

  return createPortal(
    <div className="orden-impresion" aria-hidden>
      <style>{ESTILOS}</style>
      <header className="oi-cab">
        <img src={`${import.meta.env.BASE_URL}brand/logo.png`} alt="Soluciones Impresiona" />
        <div className="oi-folio">
          <p>Orden de trabajo</p>
          <p className="oi-num">{o.folio}</p>
          {o.prioridad === 'urgente' ? <span className="oi-urgente">Urgente</span> : null}
        </div>
      </header>

      <p className="oi-titulo">{o.titulo}</p>
      {o.descripcion ? <p className="oi-sub">{o.descripcion}</p> : null}

      <dl className="oi-datos">
        <div>
          <dt>Cliente</dt>
          <dd>{o.cliente}</dd>
        </div>
        <div>
          <dt>Fecha de entrega</dt>
          <dd>{o.fecha_entrega ? fechaLarga(o.fecha_entrega) : 'Sin fecha'}</dd>
        </div>
        <div>
          <dt>Prioridad</dt>
          <dd>{PRIORIDAD[o.prioridad]}</dd>
        </div>
        <div>
          <dt>Responsable</dt>
          <dd>{o.responsable ?? 'Sin asignar'}</dd>
        </div>
        <div>
          <dt>Diseñador</dt>
          <dd>{o.disenador ?? 'Sin asignar'}</dd>
        </div>
        <div>
          <dt>Etapa al imprimir</dt>
          <dd>{ESTADO_PEDIDO[o.estado].etiqueta}</dd>
        </div>
        <div className="oi-ancho">
          <dt>Instalación</dt>
          <dd>{o.requiere_instalacion ? `Sí, en ${o.direccion_instalacion || 'dirección por confirmar'}` : 'No lleva instalación'}</dd>
        </div>
      </dl>

      <p className="oi-h">Conceptos</p>
      <table className="oi-tabla">
        <thead>
          <tr>
            <th style={{ width: '4%' }}>#</th>
            <th>Concepto y medidas</th>
            <th className="oi-num-col" style={{ width: '12%' }}>
              Cantidad
            </th>
            <th style={{ width: '34%' }}>Notas de producción</th>
            <th style={{ width: '7%' }}>Hecho</th>
          </tr>
        </thead>
        <tbody>
          {partidas.map((p, i) => {
            const medidas = describirMedidas(p.metodo_calculo, p.ancho, p.alto, p.largo)
            return (
              <tr key={p.id}>
                <td>{i + 1}</td>
                <td>
                  <strong>{p.concepto}</strong>
                  {p.descripcion ? <div className="oi-sub">{p.descripcion}</div> : null}
                  {medidas ? <div className="oi-sub">Medidas: {medidas}</div> : null}
                </td>
                <td className="oi-num-col">
                  {cantidad(p.cantidad)} {p.unidad}
                </td>
                <td className="oi-sub">{p.notas_produccion ?? ''}</td>
                <td>
                  <span className="oi-caja" />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className="oi-h">Archivos aprobados</p>
      {aprobados.length ? (
        <ul className="oi-lista">
          {aprobados.map((d) => (
            <li key={d.id}>
              <span className="oi-caja" />
              <span>
                {d.nombre}
                {d.version ? ` (versión ${d.version})` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="oi-sub">Sin diseño aprobado al imprimir. No producir sin la aprobación del cliente.</p>
      )}

      <p className="oi-h">Revisión del taller</p>
      <ul className="oi-lista">
        {pasos.map((p) => (
          <li key={p.id}>
            <span className="oi-caja" />
            <span>{p.texto}</span>
          </li>
        ))}
      </ul>

      <div className="oi-firmas">
        <div>Entregó (nombre y firma)</div>
        <div>Recibió de conformidad (nombre y firma)</div>
        <div>Fecha</div>
      </div>
      <p className="oi-pie">
        {o.folio} · impresa el {fechaLarga(new Date())}
      </p>
    </div>,
    document.body,
  )
}
