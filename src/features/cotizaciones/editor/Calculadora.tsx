import {
  AlertTriangle,
  Box,
  Briefcase,
  CalendarSync,
  Check,
  Clock,
  ConciergeBell,
  Info,
  Grid2x2,
  Layers,
  Lock,
  Ruler,
  Wand2,
} from 'lucide-react'
import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Campo, GlassButton, GlassIconButton, GlassSurface, Pildora, SegmentedControl } from '@/components/glass'
import type { MetodoCalculo, ProductoCatalogo } from '@/data/tipos'
import { METODOS, type ModoPrecio } from '@/lib/calculadora'
import { cantidad, dinero, porcentaje } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  aplicarProducto,
  cambiarMetodo,
  mismoPrecio,
  modosDisponibles,
  n,
  productoSinPrecio,
  quitarProducto,
  resultadoAplicable,
  resultadoPartida,
  type CalculoEditor,
  type Num,
  type PartidaEditor,
} from './modelo'
import { CampoNumero, Subtitulo, clasesBandeja } from './piezas'
import { SelectorProducto } from './SelectorProducto'
import type { CambiarPartida } from './useEditorCotizacion'

const METODOS_ORDEN = Object.keys(METODOS) as MetodoCalculo[]

const ICONO_METODO: Record<MetodoCalculo, ReactNode> = {
  pieza: <Box />,
  m2: <Grid2x2 />,
  metro_lineal: <Ruler />,
  millar: <Layers />,
  hora: <Clock />,
  servicio: <ConciergeBell />,
  proyecto: <Briefcase />,
  mensualidad: <CalendarSync />,
}

const CORTO_METODO: Record<MetodoCalculo, string> = {
  pieza: 'Pieza',
  m2: 'm²',
  metro_lineal: 'Metro lineal',
  millar: 'Millar',
  hora: 'Hora',
  servicio: 'Servicio',
  proyecto: 'Proyecto',
  mensualidad: 'Mensual',
}

const NOMBRE_MODO: Record<ModoPrecio, string> = {
  catalogo: 'Catálogo',
  costo: 'Costo + ganancia',
  manual: 'Manual',
}

/** Método de cobro como fila de botones circulares (Centro de Control); se comporta como grupo de opciones. */
function SelectorMetodo({ valor, onCambio }: { valor: MetodoCalculo; onCambio: (m: MetodoCalculo) => void }) {
  const botones = useRef<Array<HTMLButtonElement | null>>([])
  const alTeclear = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let j = i
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % METODOS_ORDEN.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + METODOS_ORDEN.length) % METODOS_ORDEN.length
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = METODOS_ORDEN.length - 1
    else return
    e.preventDefault()
    onCambio(METODOS_ORDEN[j])
    botones.current[j]?.focus()
  }

  return (
    <div role="radiogroup" aria-label="Cómo se cobra" className="grid grid-cols-4 justify-items-center gap-x-1 gap-y-3 sm:grid-cols-8">
      {METODOS_ORDEN.map((m, i) => {
        const activo = m === valor
        return (
          <GlassIconButton
            key={m}
            ref={(el) => {
              botones.current[i] = el
            }}
            etiqueta={CORTO_METODO[m]}
            aria-label={METODOS[m].etiqueta}
            mostrarEtiqueta
            tamano="sm"
            icono={ICONO_METODO[m]}
            destacado={activo}
            role="radio"
            aria-checked={activo}
            tabIndex={activo ? 0 : -1}
            onClick={() => onCambio(m)}
            onKeyDown={(e) => alTeclear(e, i)}
          />
        )
      })}
    </div>
  )
}

function Aviso({ tono, children }: { tono: 'info' | 'aviso' | 'peligro'; children: ReactNode }) {
  const Icono = tono === 'info' ? Info : AlertTriangle
  return (
    <p
      className={cn(
        'flex items-start gap-2 text-sm leading-snug',
        tono === 'info' && 'text-fg-muted',
        tono === 'aviso' && 'text-warning',
        tono === 'peligro' && 'text-danger',
      )}
    >
      <Icono className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

function Dato({ etiqueta, valor, fuerte }: { etiqueta: string; valor: ReactNode; fuerte?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-subtle">{etiqueta}</dt>
      <dd className={cn('num truncate text-fg', fuerte ? 'text-md font-semibold' : 'text-base font-medium')}>{valor}</dd>
    </div>
  )
}

/**
 * Calculadora de un concepto: producto del catálogo, método de cobro, medidas, modo de precio
 * y costos (solo con permiso). El resultado se aplica a la fila con "Usar este precio".
 */
export function Calculadora({
  id,
  p,
  producto,
  productos,
  cargandoProductos,
  puedeCostos,
  cambiar,
}: {
  id: string
  p: PartidaEditor
  producto: ProductoCatalogo | undefined
  productos: ProductoCatalogo[] | undefined
  cargandoProductos: boolean
  puedeCostos: boolean
  cambiar: CambiarPartida
}) {
  const info = METODOS[p.metodo_calculo]
  const modos = modosDisponibles(p, puedeCostos)
  const modo = modos.includes(p.calc.modo) ? p.calc.modo : 'manual'
  const r = resultadoPartida(p, producto, puedeCostos)
  const aplicable = resultadoAplicable(r)
  const aplicado = aplicable && mismoPrecio(p.precio_unitario, r.precioUnitario)
  const sinPrecio = (modo === 'catalogo' && r.sinPrecio) || (modo === 'manual' && productoSinPrecio(producto))
  const unidadVenta = p.unidad.trim() || info.unidad

  const set = (fn: (x: PartidaEditor) => PartidaEditor) => cambiar(p.clave, fn)
  const setCalc = (c: Partial<CalculoEditor>) => set((x) => ({ ...x, calc: { ...x.calc, ...c } }))
  const setMedida = (campo: 'ancho' | 'alto' | 'largo') => (v: Num) => set((x) => ({ ...x, [campo]: v }))

  const faltaMedida =
    (info.medidas === 'area' && (!(n(p.ancho) > 0) || !(n(p.alto) > 0))) || (info.medidas === 'largo' && !(n(p.largo) > 0))
  const escalaActiva = producto?.escalas
    .filter((e) => r.unidadesCobro >= e.desde)
    .reduce<number | null>((max, e) => (max === null || e.desde > max ? e.desde : max), null)

  return (
    <div id={id} className={cn(clasesBandeja, 'grid gap-5 p-3 sm:p-4')}>
      {/* Producto */}
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-producto`} className="text-sm font-medium text-fg-muted">
          Producto del catálogo
        </label>
        <SelectorProducto
          id={`${id}-producto`}
          productos={productos}
          cargando={cargandoProductos}
          elegido={producto}
          nombreGuardado={p.producto_id && !producto && !cargandoProductos ? 'Producto que ya no está en el catálogo' : null}
          onElegir={(prod) => set((x) => aplicarProducto(x, prod, puedeCostos))}
          onQuitar={() => set(quitarProducto)}
        />
      </div>

      {/* Método */}
      <div className="grid gap-2.5">
        <Subtitulo>Cómo se cobra</Subtitulo>
        <SelectorMetodo valor={p.metodo_calculo} onCambio={(m) => set((x) => cambiarMetodo(x, m))} />
      </div>

      {/* Medidas */}
      {info.medidas ? (
        <div className="grid gap-2">
          <Subtitulo>Medidas de cada {unidadVenta === 'pza' ? 'pieza' : unidadVenta}</Subtitulo>
          <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
            {info.medidas === 'area' ? (
              <>
                <Campo etiqueta="Ancho" className="w-[7.5rem]">
                  {(cid, a) => <CampoNumero id={cid} {...a} valor={p.ancho} onValor={setMedida('ancho')} sufijo="m" placeholder="0.00" />}
                </Campo>
                <span className="pb-3 text-fg-subtle" aria-hidden>
                  ×
                </span>
                <Campo etiqueta="Alto" className="w-[7.5rem]">
                  {(cid, a) => <CampoNumero id={cid} {...a} valor={p.alto} onValor={setMedida('alto')} sufijo="m" placeholder="0.00" />}
                </Campo>
                <p className="num pb-3 text-sm text-fg-muted">
                  = {cantidad(n(p.ancho) * n(p.alto))} m² por {unidadVenta === 'pza' ? 'pieza' : unidadVenta}
                </p>
              </>
            ) : (
              <>
                <Campo etiqueta="Largo" className="w-[7.5rem]">
                  {(cid, a) => <CampoNumero id={cid} {...a} valor={p.largo} onValor={setMedida('largo')} sufijo="m" placeholder="0.00" />}
                </Campo>
                <p className="pb-3 text-sm text-fg-muted">metros lineales por {unidadVenta === 'pza' ? 'pieza' : unidadVenta}</p>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Precio */}
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Subtitulo>Precio</Subtitulo>
          {modos.length > 1 ? (
            <SegmentedControl
              etiqueta="Cómo se calcula el precio"
              tamano="sm"
              valor={modo}
              onCambio={(m) => setCalc({ modo: m })}
              segmentos={modos.map((m) => ({ valor: m, etiqueta: NOMBRE_MODO[m] }))}
            />
          ) : null}
        </div>

        {modo === 'catalogo' && producto ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
            {producto.precio_venta !== null ? (
              <span>
                Precio de lista <span className="num font-semibold text-fg">{dinero(producto.precio_venta)}</span> por {info.unidadCobro}
              </span>
            ) : null}
            {producto.escalas.map((e) => (
              <Pildora key={e.desde} tono={escalaActiva === e.desde ? 'luz' : 'neutro'} punto={escalaActiva === e.desde}>
                <span className="num">
                  {cantidad(e.desde)} o más: {dinero(e.precio)}
                </span>
              </Pildora>
            ))}
            {producto.precio_minimo ? (
              <span>
                Mínimo por trabajo <span className="num font-medium text-fg">{dinero(producto.precio_minimo)}</span>
              </span>
            ) : null}
          </div>
        ) : null}

        {modo === 'manual' ? (
          <Campo etiqueta={`Precio por ${info.unidadCobro}`} className="max-w-[13rem]">
            {(cid, a) => (
              <CampoNumero id={cid} {...a} valor={p.calc.precioManual} onValor={(v) => setCalc({ precioManual: v })} prefijo="$" fijos={2} placeholder="0.00" />
            )}
          </Campo>
        ) : null}

        {puedeCostos ? (
          <div className="grid gap-2.5 pt-1">
            <p className="flex items-center gap-1.5 text-xs font-medium text-fg-subtle">
              <Lock className="size-3.5" aria-hidden />
              Costos internos: no aparecen en la cotización
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Campo etiqueta={`Material por ${info.unidadCobro}`}>
                {(cid, a) => (
                  <CampoNumero id={cid} {...a} valor={p.calc.costoMaterial} onValor={(v) => setCalc({ costoMaterial: v })} prefijo="$" fijos={2} placeholder="0.00" />
                )}
              </Campo>
              <Campo etiqueta={`Mano de obra por ${info.unidadCobro}`}>
                {(cid, a) => (
                  <CampoNumero id={cid} {...a} valor={p.calc.costoManoObra} onValor={(v) => setCalc({ costoManoObra: v })} prefijo="$" fijos={2} placeholder="0.00" />
                )}
              </Campo>
              <Campo etiqueta="Desperdicio">
                {(cid, a) => (
                  <CampoNumero id={cid} {...a} valor={p.calc.desperdicioPct} onValor={(v) => setCalc({ desperdicioPct: v })} max={100} sufijo="%" placeholder="0" />
                )}
              </Campo>
              <Campo etiqueta="Costo fijo del trabajo" ayuda="Preparación, arte o montaje">
                {(cid, a) => (
                  <CampoNumero id={cid} {...a} valor={p.calc.costoFijo} onValor={(v) => setCalc({ costoFijo: v })} prefijo="$" fijos={2} placeholder="0.00" />
                )}
              </Campo>
              {modo === 'costo' ? (
                <Campo etiqueta="Ganancia sobre costo">
                  {(cid, a) => (
                    <CampoNumero id={cid} {...a} valor={p.calc.gananciaPct} onValor={(v) => setCalc({ gananciaPct: v })} max={1000} sufijo="%" placeholder="0" />
                  )}
                </Campo>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* Resultado */}
      <GlassSurface variante="fuerte" className="grid gap-3 rounded-tile p-4" aria-live="polite">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Dato etiqueta="Se cobran" valor={`${cantidad(r.unidadesCobro)} ${info.unidadCobro}`} />
          {info.medidas ? <Dato etiqueta={`Precio por ${info.unidadCobro}`} valor={dinero(r.precioUnidadCobro ?? 0)} /> : null}
          <Dato etiqueta={`Precio por ${unidadVenta}`} valor={dinero(r.precioUnitario)} fuerte />
          <Dato etiqueta="Importe" valor={dinero(r.importe)} fuerte />
          {puedeCostos ? (
            <>
              <Dato etiqueta="Costo total" valor={dinero(r.costoTotal)} />
              <Dato
                etiqueta="Margen sobre venta"
                valor={
                  <span className={cn(r.margenPct !== null && r.margenPct < 0 && 'text-danger')}>
                    {porcentaje(r.margenPct, 1)}
                    <span className="ml-1.5 text-sm font-normal text-fg-muted">{dinero(r.utilidad)}</span>
                  </span>
                }
              />
            </>
          ) : null}
        </dl>

        {sinPrecio || r.aplicoMinimo || faltaMedida || n(p.cantidad) <= 0 || (puedeCostos && r.utilidad < 0 && r.importe > 0) ? (
          <div className="grid gap-1.5">
            {sinPrecio ? <Aviso tono="aviso">Este producto aún no tiene precio en el catálogo; captura el precio a mano.</Aviso> : null}
            {faltaMedida ? (
              <Aviso tono="info">{info.medidas === 'area' ? 'Captura el ancho y el alto para calcular.' : 'Captura el largo para calcular.'}</Aviso>
            ) : null}
            {n(p.cantidad) <= 0 ? <Aviso tono="info">Captura la cantidad en la fila para calcular.</Aviso> : null}
            {r.aplicoMinimo && producto?.precio_minimo ? (
              <Aviso tono="info">
                Se aplicó el mínimo por trabajo de <span className="num font-medium">{dinero(producto.precio_minimo)}</span>.
              </Aviso>
            ) : null}
            {puedeCostos && r.utilidad < 0 && r.importe > 0 ? <Aviso tono="peligro">Con este precio no se cubre el costo.</Aviso> : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--divider)] pt-3">
          {aplicado ? (
            <p className="mr-auto flex items-center gap-1.5 text-sm text-fg-muted">
              <Check className="size-4 text-success" aria-hidden />
              {p.vinculado ? 'La fila usa este precio y se actualiza con las medidas y la cantidad.' : 'La fila ya tiene este precio.'}
            </p>
          ) : aplicable ? (
            <p className="mr-auto text-sm text-fg-muted">
              Precio en la fila: <span className="num font-medium text-fg">{dinero(n(p.precio_unitario))}</span>
            </p>
          ) : null}
          <GlassButton
            variante={aplicado ? 'cristal' : 'luz'}
            tamano="sm"
            icono={aplicado ? <Check /> : <Wand2 />}
            disabled={!aplicable || (aplicado && p.vinculado)}
            onClick={() => set((x) => ({ ...x, precio_unitario: r.precioUnitario, vinculado: true }))}
            className="h-10 px-4 pointer-coarse:h-11"
          >
            {aplicado && p.vinculado ? 'Precio aplicado' : 'Usar este precio'}
          </GlassButton>
        </div>
      </GlassSurface>
    </div>
  )
}
