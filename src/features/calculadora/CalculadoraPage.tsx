import { motion, useReducedMotion } from 'motion/react'
import {
  AlertTriangle,
  BookOpen,
  FilePlus2,
  Lock,
  RotateCcw,
  Truck,
  Wrench,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useConfiguracion } from '@/app/consultas'
import { useSesion } from '@/app/sesion'
import { AnimatedNumber, Campo, EstadoVacio, GlassButton, GlassPanel, GlassToggle, Pildora, SegmentedControl } from '@/components/glass'
import type { ListaPrecio } from '@/data/modulos/catalogo/contrato'
import type { MetodoCalculo, ProductoCatalogo } from '@/data/tipos'
import { CampoNumero } from '@/features/cotizaciones/editor/piezas'
import { SelectorProducto } from '@/features/cotizaciones/editor/SelectorProducto'
import { METODOS, calcularPartida, calcularTotales, describirMedidas, type ModoPrecio } from '@/lib/calculadora'
import { cantidad, dinero, porcentaje } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { SelectorMetodo } from './SelectorMetodo'
import { usePreciosPara, useProductosCalculadora } from '../catalogo/consultas'
import { guardarBorrador, type BorradorCalculadora, type PartidaCalculadora } from './borrador'

type Num = number | null

/** "1 pieza", "1 millar"… (METODOS trae la etiqueta en plural) */
const SINGULAR: Record<MetodoCalculo, string> = {
  pieza: 'pieza',
  m2: 'pieza',
  metro_lineal: 'pieza',
  millar: 'millar',
  hora: 'hora',
  servicio: 'servicio',
  proyecto: 'proyecto',
  mensualidad: 'mes',
}
const v = (x: Num) => x ?? 0

const LISTAS: Array<{ valor: ListaPrecio; etiqueta: string }> = [
  { valor: 'publico', etiqueta: 'Público' },
  { valor: 'mayoreo', etiqueta: 'Mayoreo' },
  { valor: 'agencia', etiqueta: 'Agencia' },
]

function Subtitulo({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold text-fg-muted">{children}</h3>
}

function Renglon({ etiqueta, valor, fuerte, tenue }: { etiqueta: ReactNode; valor: ReactNode; fuerte?: boolean; tenue?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 py-1.5', tenue ? 'text-fg-subtle' : 'text-fg-muted')}>
      <dt className="text-sm">{etiqueta}</dt>
      <dd className={cn('num text-right', fuerte ? 'text-md font-semibold text-fg' : 'text-base font-medium text-fg')}>{valor}</dd>
    </div>
  )
}

export default function CalculadoraPage() {
  const { puede } = useSesion()
  const navegar = useNavigate()
  if (!puede('ver_precios'))
    return (
      <GlassPanel className="mx-auto mt-2 max-w-xl">
        <EstadoVacio
          icono={<Lock />}
          titulo="La calculadora es para ventas y administración"
          descripcion="Tu rol no incluye precios. Si necesitas un precio para un cliente, pídelo a ventas."
          accion={
            <GlassButton variante="cristal" onClick={() => navegar('/')}>
              Ir al inicio
            </GlassButton>
          }
        />
      </GlassPanel>
    )
  return <Calculadora />
}

function Calculadora() {
  const { puede } = useSesion()
  const verCostos = puede('ver_costos')
  const navegar = useNavigate()
  const reducir = useReducedMotion()
  const config = useConfiguracion()
  const ivaPct = config.data?.iva_pct ?? 16

  const [lista, setLista] = useState<ListaPrecio>('publico')
  const productos = useProductosCalculadora()
  const precios = usePreciosPara(lista, true)

  const [productoId, setProductoId] = useState<string | null>(null)
  const [concepto, setConcepto] = useState('')
  const [metodo, setMetodo] = useState<MetodoCalculo>('m2')
  const [ancho, setAncho] = useState<Num>(1)
  const [alto, setAlto] = useState<Num>(1)
  const [largo, setLargo] = useState<Num>(1)
  const [cant, setCant] = useState<Num>(1)
  const [modo, setModo] = useState<ModoPrecio>('manual')
  const [precioManual, setPrecioManual] = useState<Num>(null)
  const [costos, setCostos] = useState({ material: null as Num, manoObra: null as Num, fijo: null as Num, desperdicio: null as Num, ganancia: 50 as Num })
  const [instalacion, setInstalacion] = useState<Num>(null)
  const [transporte, setTransporte] = useState<Num>(null)
  const [conIva, setConIva] = useState(true)

  // Productos con el precio de la lista elegida (respaldo: público).
  const conLista = useMemo<ProductoCatalogo[] | undefined>(() => {
    if (!productos.data) return undefined
    if (lista === 'publico' || !precios.data) return productos.data
    const mapa = new Map(precios.data.map((p) => [p.producto_id, p]))
    return productos.data.map((p) => {
      const a = mapa.get(p.id)
      return a ? { ...p, precio_venta: a.precio, precio_minimo: a.precio_minimo, escalas: a.escalas } : p
    })
  }, [productos.data, precios.data, lista])

  const producto = conLista?.find((p) => p.id === productoId)
  const listaAplicada = lista === 'publico' ? 'publico' : (precios.data?.find((p) => p.producto_id === productoId)?.lista_aplicada ?? 'publico')
  const sinPrecio = Boolean(producto && producto.precio_venta === null && producto.escalas.length === 0)

  const elegir = (p: ProductoCatalogo) => {
    setProductoId(p.id)
    setConcepto(p.nombre)
    setMetodo(p.metodo_calculo)
    const tienePrecio = p.precio_venta !== null || p.escalas.length > 0
    setModo(tienePrecio ? 'catalogo' : verCostos && p.costos ? 'costo' : 'manual')
    if (p.costos)
      setCostos({ material: p.costos.costo_material, manoObra: p.costos.costo_mano_obra, fijo: p.costos.costo_fijo, desperdicio: p.costos.desperdicio_pct, ganancia: p.costos.ganancia_pct })
  }
  const quitar = () => {
    setProductoId(null)
    setModo('manual')
  }
  const reiniciar = () => {
    quitar()
    setConcepto('')
    setAncho(1)
    setAlto(1)
    setLargo(1)
    setCant(1)
    setPrecioManual(null)
    setInstalacion(null)
    setTransporte(null)
  }

  const info = METODOS[metodo]
  const r = calcularPartida({
    metodo,
    cantidad: v(cant),
    ancho,
    alto,
    largo,
    modoPrecio: modo,
    precioCatalogo: producto?.precio_venta,
    escalas: producto?.escalas,
    precioMinimo: producto?.precio_minimo,
    precioManual,
    costoMaterial: v(costos.material),
    costoManoObra: v(costos.manoObra),
    costoFijo: v(costos.fijo),
    desperdicioPct: v(costos.desperdicio),
    gananciaPct: v(costos.ganancia),
  })
  const extras = [v(instalacion), v(transporte)]
  const totales = calcularTotales({ importes: [r.importe, ...extras], descuentoTipo: 'monto', descuentoValor: 0, recargoPct: 0, aplicaIva: conIva, ivaPct })
  const listo = r.importe > 0 && !r.sinPrecio
  const medidas = describirMedidas(metodo, ancho, alto, largo)

  const modos: Array<{ valor: ModoPrecio; etiqueta: string }> = [
    ...(producto ? [{ valor: 'catalogo' as const, etiqueta: 'Catálogo' }] : []),
    ...(verCostos ? [{ valor: 'costo' as const, etiqueta: 'Costo + ganancia' }] : []),
    { valor: 'manual', etiqueta: 'Manual' },
  ]

  const crear = () => {
    const partidas: PartidaCalculadora[] = [
      {
        tipo: 'concepto',
        producto_id: productoId,
        concepto: concepto.trim() || producto?.nombre || info.etiqueta,
        descripcion: medidas ?? '',
        metodo_calculo: metodo,
        unidad: info.unidad,
        ancho: metodo === 'm2' ? ancho : null,
        alto: metodo === 'm2' ? alto : null,
        largo: metodo === 'metro_lineal' ? largo : null,
        cantidad: v(cant),
        precio_unitario: r.precioUnitario,
        costos: verCostos
          ? { costo_material: v(costos.material), costo_mano_obra: v(costos.manoObra), costo_fijo: v(costos.fijo), desperdicio_pct: v(costos.desperdicio), ganancia_pct: v(costos.ganancia) }
          : null,
      },
    ]
    const extra = (tipo: 'instalacion' | 'transporte', monto: number) => ({
      tipo,
      producto_id: null,
      concepto: tipo === 'instalacion' ? 'Instalación' : 'Transporte',
      descripcion: '',
      metodo_calculo: 'servicio' as const,
      unidad: 'servicio',
      ancho: null,
      alto: null,
      largo: null,
      cantidad: 1,
      precio_unitario: monto,
      costos: null,
    })
    if (v(instalacion) > 0) partidas.push(extra('instalacion', v(instalacion)))
    if (v(transporte) > 0) partidas.push(extra('transporte', v(transporte)))
    const borrador: BorradorCalculadora = { version: 1, creado: new Date().toISOString(), lista, aplica_iva: conIva, partidas }
    guardarBorrador(borrador)
    navegar('/cotizaciones/nueva', { state: { desdeCalculadora: borrador } })
  }

  return (
    <motion.div
      className="grid gap-5 pt-1 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:items-start"
      initial={reducir ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={resorte.suave}
    >
      <GlassPanel className="flex flex-col gap-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-fg">Calculadora de mostrador</h2>
            <p className="text-sm text-fg-muted">Cotiza rápido con los precios del catálogo o captura uno a mano.</p>
          </div>
          <GlassButton variante="fantasma" tamano="sm" icono={<RotateCcw />} onClick={reiniciar} className="pointer-coarse:h-11">
            Empezar de nuevo
          </GlassButton>
        </div>

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Subtitulo>Lista de precios</Subtitulo>
            {puede('editar_catalogo') ? (
              <Link to="/catalogo" className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm text-accent hover:underline dark:text-navy-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <BookOpen className="size-4" aria-hidden /> Abrir catálogo
              </Link>
            ) : null}
          </div>
          <SegmentedControl etiqueta="Lista de precios" segmentos={LISTAS} valor={lista} onCambio={setLista} className="w-full sm:w-auto" />
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Producto del catálogo" opcional>
            {(id) => (
              <SelectorProducto id={id} productos={conLista} cargando={productos.isPending} elegido={producto} onElegir={elegir} onQuitar={quitar} />
            )}
          </Campo>
          <Campo etiqueta="Concepto">
            {(id, a) => (
              <input id={id} {...a} className="field" value={concepto} placeholder="Ej. Lona para fachada" onChange={(e) => setConcepto(e.target.value)} />
            )}
          </Campo>
        </section>
        {sinPrecio ? (
          <p className="-mt-3 flex items-start gap-2 text-sm text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Este producto aún no tiene precio en el catálogo. {puede('editar_catalogo') ? 'Captúralo en Catálogo o ' : 'Pide a administración que lo capture o '}escribe un precio manual.
            </span>
          </p>
        ) : null}

        <section className="flex flex-col gap-3">
          <Subtitulo>Cómo se cobra</Subtitulo>
          <SelectorMetodo valor={metodo} onCambio={setMetodo} />
        </section>

        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {info.medidas === 'area' ? (
            <>
              <Campo etiqueta="Ancho (m)">{(id, a) => <CampoNumero id={id} {...a} valor={ancho} onValor={setAncho} />}</Campo>
              <Campo etiqueta="Alto (m)">{(id, a) => <CampoNumero id={id} {...a} valor={alto} onValor={setAlto} />}</Campo>
            </>
          ) : null}
          {info.medidas === 'largo' ? <Campo etiqueta="Largo (m)">{(id, a) => <CampoNumero id={id} {...a} valor={largo} onValor={setLargo} />}</Campo> : null}
          <Campo etiqueta={info.cantidad}>{(id, a) => <CampoNumero id={id} {...a} valor={cant} onValor={setCant} />}</Campo>
        </section>

        <section className="flex flex-col gap-3">
          <Subtitulo>Precio</Subtitulo>
          {modos.length > 1 ? <SegmentedControl etiqueta="Origen del precio" segmentos={modos} valor={modo} onCambio={setModo} tamano="sm" className="w-full sm:w-auto" /> : null}
          {modo === 'manual' ? (
            <Campo etiqueta={`Precio por ${info.unidadCobro}`} className="max-w-xs">
              {(id, a) => <CampoNumero id={id} {...a} valor={precioManual} onValor={setPrecioManual} fijos={2} prefijo="$" placeholder="0.00" />}
            </Campo>
          ) : null}
          {modo === 'catalogo' && producto ? (
            <p className="text-sm text-fg-muted">
              {r.sinPrecio ? (
                'Sin precio en el catálogo: elige “Manual” y captura uno.'
              ) : (
                <>
                  <span className="num font-medium text-fg">{dinero(r.precioUnidadCobro)}</span> por {info.unidadCobro} · lista{' '}
                  {listaAplicada === lista ? LISTAS.find((l) => l.valor === lista)?.etiqueta.toLowerCase() : 'pública (sin precio especial)'}
                  {producto.escalas.length ? ' · con precios por volumen' : ''}
                </>
              )}
            </p>
          ) : null}
          {modo === 'costo' && verCostos ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Campo etiqueta={`Material por ${info.unidadCobro}`}>{(id, a) => <CampoNumero id={id} {...a} valor={costos.material} onValor={(x) => setCostos((c) => ({ ...c, material: x }))} fijos={2} prefijo="$" />}</Campo>
              <Campo etiqueta={`Mano de obra por ${info.unidadCobro}`}>{(id, a) => <CampoNumero id={id} {...a} valor={costos.manoObra} onValor={(x) => setCostos((c) => ({ ...c, manoObra: x }))} fijos={2} prefijo="$" />}</Campo>
              <Campo etiqueta="Costo fijo">{(id, a) => <CampoNumero id={id} {...a} valor={costos.fijo} onValor={(x) => setCostos((c) => ({ ...c, fijo: x }))} fijos={2} prefijo="$" />}</Campo>
              <Campo etiqueta="Desperdicio %">{(id, a) => <CampoNumero id={id} {...a} valor={costos.desperdicio} onValor={(x) => setCostos((c) => ({ ...c, desperdicio: x }))} max={100} />}</Campo>
              <Campo etiqueta="Ganancia %">{(id, a) => <CampoNumero id={id} {...a} valor={costos.ganancia} onValor={(x) => setCostos((c) => ({ ...c, ganancia: x }))} max={1000} />}</Campo>
            </div>
          ) : null}
        </section>

        <section className="flex flex-col gap-3">
          <Subtitulo>Renglones extra</Subtitulo>
          <div className="grid grid-cols-2 gap-4 sm:max-w-md">
            <Campo etiqueta={<span className="inline-flex items-center gap-1.5"><Wrench className="size-4" aria-hidden />Instalación</span>} opcional>
              {(id, a) => <CampoNumero id={id} {...a} valor={instalacion} onValor={setInstalacion} fijos={2} prefijo="$" placeholder="0.00" />}
            </Campo>
            <Campo etiqueta={<span className="inline-flex items-center gap-1.5"><Truck className="size-4" aria-hidden />Transporte</span>} opcional>
              {(id, a) => <CampoNumero id={id} {...a} valor={transporte} onValor={setTransporte} fijos={2} prefijo="$" placeholder="0.00" />}
            </Campo>
          </div>
        </section>
      </GlassPanel>

      <div className="lg:sticky lg:top-4">
        <GlassPanel className="flex flex-col gap-4 p-5 sm:p-6" aria-live="polite">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-fg-muted">Resultado</h2>
            {r.aplicoMinimo ? <Pildora tono="luz">Precio mínimo aplicado</Pildora> : null}
          </div>
          <div>
            <p className="text-sm text-fg-muted">Total{conIva ? ' con IVA' : ''}</p>
            <AnimatedNumber valor={totales.total} formato={dinero} className="num block text-3xl font-semibold tracking-tight text-fg leading-none sm:text-display sm:leading-none" />
            <p className="mt-2 text-sm text-fg-muted">
              <span className="num font-medium text-fg">{dinero(r.precioUnitario)}</span> por {info.unidad} · {cantidad(cant)} {v(cant) === 1 ? SINGULAR[metodo] : info.cantidad.toLowerCase()}
              {info.medidas ? ` · ${cantidad(r.unidadesCobro)} ${info.unidadCobro}` : ''}
            </p>
          </div>
          <dl className="divide-y divide-[var(--divider)] border-t border-[var(--divider)]">
            <Renglon etiqueta={`Precio por ${info.unidadCobro}`} valor={r.precioUnidadCobro === null ? '—' : dinero(r.precioUnidadCobro)} />
            <Renglon etiqueta="Importe del concepto" valor={dinero(r.importe)} />
            {v(instalacion) > 0 ? <Renglon etiqueta="Instalación" valor={dinero(instalacion)} /> : null}
            {v(transporte) > 0 ? <Renglon etiqueta="Transporte" valor={dinero(transporte)} /> : null}
            <Renglon etiqueta="Subtotal" valor={dinero(totales.subtotal)} />
            <Renglon etiqueta={`IVA ${ivaPct}%`} valor={conIva ? dinero(totales.iva) : 'No aplica'} tenue={!conIva} />
            <Renglon etiqueta="Total" valor={dinero(totales.total)} fuerte />
          </dl>
          {verCostos ? (
            <dl className="grid grid-cols-3 gap-3 rounded-tile bg-[var(--control-bg)] p-3">
              <div>
                <dt className="text-xs text-fg-subtle">Costo</dt>
                <dd className="num font-medium text-fg">{dinero(r.costoTotal)}</dd>
              </div>
              <div>
                <dt className="text-xs text-fg-subtle">Utilidad</dt>
                <dd className={cn('num font-medium', r.utilidad < 0 ? 'text-danger' : 'text-fg')}>{r.costoTotal > 0 ? dinero(r.utilidad) : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-fg-subtle">Margen</dt>
                <dd className="num font-medium text-fg">{r.costoTotal > 0 ? porcentaje(r.margenPct, 1) : '—'}</dd>
              </div>
            </dl>
          ) : null}
          <GlassToggle icono={<span className="text-xs font-bold">IVA</span>} titulo="Agregar IVA" subtitulo={`${ivaPct}% sobre el subtotal`} activo={conIva} onCambio={setConIva} tono="acento" />
          {puede('gestionar_cotizaciones') ? (
            <GlassButton variante="primario" tamano="lg" icono={<FilePlus2 />} disabled={!listo} onClick={crear} className="w-full">
              Crear cotización con esto
            </GlassButton>
          ) : null}
          {!listo ? <p className="text-center text-sm text-fg-subtle">Escribe medidas, cantidad y un precio para continuar.</p> : null}
        </GlassPanel>
      </div>
    </motion.div>
  )
}
