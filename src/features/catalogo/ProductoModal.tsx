import { Brush, Factory, Plus, Power, Trash2, Wrench } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useSesion } from '@/app/sesion'
import { Campo, GlassButton, GlassIconButton, GlassModal, GlassSelect, GlassTextarea, GlassToggle } from '@/components/glass'
import type { Escala, PrecioLista, ProductoFicha } from '@/data/modulos/catalogo/contrato'
import type { MetodoCalculo } from '@/data/tipos'
import { CampoNumero } from '@/features/cotizaciones/editor/piezas'
import { METODOS, calcularPartida } from '@/lib/calculadora'
import { dinero, porcentaje } from '@/lib/format'
import { CORTO_METODO, SelectorMetodo } from '../calculadora/SelectorMetodo'
import { useCategorias, useGuardarProducto } from './consultas'

type Num = number | null
type ListaEspecial = PrecioLista['lista']
interface EstadoLista {
  precio: Num
  minimo: Num
}

interface Formulario {
  nombre: string
  categoria_id: string
  metodo: MetodoCalculo
  unidad: string
  descripcion: string
  precio: Num
  minimo: Num
  escalas: Array<{ desde: Num; precio: Num }>
  listas: Record<ListaEspecial, EstadoLista>
  costos: { material: Num; manoObra: Num; fijo: Num; desperdicio: Num; ganancia: Num }
  diseno: boolean
  produccion: boolean
  instalacion: boolean
  activo: boolean
}

function inicial(p: ProductoFicha | null): Formulario {
  const lista = (l: ListaEspecial): EstadoLista => {
    const x = p?.precios.find((y) => y.lista === l)
    return { precio: x?.precio ?? null, minimo: x?.precio_minimo ?? null }
  }
  return {
    nombre: p?.nombre ?? '',
    categoria_id: p?.categoria_id ?? '',
    metodo: p?.metodo_calculo ?? 'pieza',
    unidad: p?.unidad ?? 'pza',
    descripcion: p?.descripcion ?? '',
    precio: p?.precio_venta ?? null,
    minimo: p?.precio_minimo ?? null,
    escalas: (p?.escalas ?? []).map((e) => ({ desde: e.desde, precio: e.precio })),
    listas: { mayoreo: lista('mayoreo'), agencia: lista('agencia') },
    costos: {
      material: p?.costos?.costo_material ?? null,
      manoObra: p?.costos?.costo_mano_obra ?? null,
      fijo: p?.costos?.costo_fijo ?? null,
      desperdicio: p?.costos?.desperdicio_pct ?? null,
      ganancia: p?.costos?.ganancia_pct ?? null,
    },
    diseno: p?.requiere_diseno ?? true,
    produccion: p?.requiere_produccion ?? true,
    instalacion: p?.requiere_instalacion ?? false,
    activo: p?.activo ?? true,
  }
}

const UNIDAD_SUGERIDA: Record<MetodoCalculo, string> = {
  pieza: 'pza',
  m2: 'm²',
  metro_lineal: 'm',
  millar: 'millar',
  hora: 'hr',
  servicio: 'servicio',
  proyecto: 'proyecto',
  mensualidad: 'mes',
}

function Seccion({ titulo, children, ayuda }: { titulo: string; ayuda?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-[var(--divider)] pt-5 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-sm font-semibold text-fg">{titulo}</h3>
        {ayuda ? <p className="text-sm text-fg-muted">{ayuda}</p> : null}
      </div>
      {children}
    </section>
  )
}

/** Editor de un producto del catálogo (cajón lateral en escritorio, hoja en celular). */
export function ProductoModal({ producto, abierto, onCambio }: { producto: ProductoFicha | null; abierto: boolean; onCambio: (a: boolean) => void }) {
  const { puede } = useSesion()
  const verCostos = puede('ver_costos')
  const verPrecios = puede('ver_precios')
  const categorias = useCategorias()
  const guardar = useGuardarProducto()
  const [f, setF] = useState<Formulario>(() => inicial(producto))
  const [muestra, setMuestra] = useState<Num>(1)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (abierto) {
      setF(inicial(producto))
      setError(null)
      setMuestra(1)
    }
  }, [abierto, producto])

  const set = <K extends keyof Formulario>(k: K, v: Formulario[K]) => setF((x) => ({ ...x, [k]: v }))
  const info = METODOS[f.metodo]
  const escalasValidas: Escala[] = f.escalas.filter((e) => e.desde !== null && e.precio !== null).map((e) => ({ desde: e.desde!, precio: e.precio! }))
  const conMedidas = info.medidas !== null

  // Vista previa: el precio de N unidades de cobro (1 m² = 1 × 1 m, 1 m lineal…).
  const previa = calcularPartida({
    metodo: f.metodo,
    cantidad: conMedidas ? 1 : (muestra ?? 0),
    ancho: f.metodo === 'm2' ? (muestra ?? 0) : null,
    alto: f.metodo === 'm2' ? 1 : null,
    largo: f.metodo === 'metro_lineal' ? (muestra ?? 0) : null,
    modoPrecio: 'catalogo',
    precioCatalogo: f.precio,
    escalas: escalasValidas,
    precioMinimo: f.minimo,
    costoMaterial: f.costos.material ?? 0,
    costoManoObra: f.costos.manoObra ?? 0,
    costoFijo: f.costos.fijo ?? 0,
    desperdicioPct: f.costos.desperdicio ?? 0,
  })
  const sugerido = calcularPartida({
    metodo: 'pieza',
    cantidad: 1,
    modoPrecio: 'costo',
    costoMaterial: f.costos.material ?? 0,
    costoManoObra: f.costos.manoObra ?? 0,
    desperdicioPct: f.costos.desperdicio ?? 0,
    gananciaPct: f.costos.ganancia ?? 0,
  }).precioUnitario

  const enviar = async () => {
    if (!f.nombre.trim()) return setError('Escribe el nombre del producto.')
    if (!f.unidad.trim()) return setError('Escribe la unidad de venta (por ejemplo, pza o m²).')
    if (f.minimo !== null && f.precio === null && escalasValidas.length === 0) return setError('Captura el precio público antes del precio mínimo.')
    setError(null)
    const previas = producto?.precios.map((p) => p.lista) ?? []
    try {
      await guardar.mutateAsync({
        id: producto?.id,
        activo: f.activo,
        datos: {
          nombre: f.nombre,
          descripcion: f.descripcion,
          categoria_id: f.categoria_id || null,
          metodo_calculo: f.metodo,
          unidad: f.unidad.trim(),
          precio_venta: f.precio,
          precio_minimo: f.minimo,
          escalas: escalasValidas,
          requiere_diseno: f.diseno,
          requiere_produccion: f.produccion,
          requiere_instalacion: f.instalacion,
        },
        costos: verCostos
          ? {
              costo_material: f.costos.material ?? 0,
              costo_mano_obra: f.costos.manoObra ?? 0,
              costo_fijo: f.costos.fijo ?? 0,
              desperdicio_pct: f.costos.desperdicio ?? 0,
              ganancia_pct: f.costos.ganancia ?? 0,
              notas: producto?.costos?.notas ?? null,
              proveedor: producto?.costos?.proveedor ?? null,
            }
          : null,
        listas: verPrecios
          ? (['mayoreo', 'agencia'] as const)
              .filter((l) => f.listas[l].precio !== null)
              .map((l) => ({ producto_id: producto?.id ?? '', lista: l, precio: f.listas[l].precio!, precio_minimo: f.listas[l].minimo, escalas: producto?.precios.find((x) => x.lista === l)?.escalas ?? [] }))
          : null,
        listasPrevias: previas,
      })
      toast.success(producto ? 'Producto actualizado' : 'Producto agregado al catálogo')
      onCambio(false)
    } catch (e) {
      setError(`${(e as Error).message.replace(/\.?$/, '.')} Revisa los datos e inténtalo de nuevo.`)
    }
  }

  const grupos = new Map<string, NonNullable<typeof categorias.data>>()
  for (const c of categorias.data ?? []) if (c.activo || c.id === f.categoria_id) grupos.set(c.grupo, [...(grupos.get(c.grupo) ?? []), c])

  return (
    <GlassModal
      abierto={abierto}
      onCambio={onCambio}
      lateral
      ancho="lg"
      titulo={producto ? 'Editar producto' : 'Nuevo producto'}
      descripcion={producto ? producto.nombre : 'Agrégalo al catálogo; el precio puede capturarse después.'}
      pie={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          {error ? (
            <p role="alert" className="mr-auto text-sm text-danger">
              {error}
            </p>
          ) : null}
          <GlassButton variante="fantasma" onClick={() => onCambio(false)}>
            Cancelar
          </GlassButton>
          <GlassButton variante="primario" cargando={guardar.isPending} onClick={() => void enviar()}>
            Guardar producto
          </GlassButton>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Seccion titulo="Datos generales">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombre" className="sm:col-span-2">
              {(id, a) => <input id={id} {...a} className="field" value={f.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Ej. Lona impresa" />}
            </Campo>
            <Campo etiqueta="Categoría">
              {(id) => (
                <GlassSelect id={id} value={f.categoria_id} onChange={(e) => set('categoria_id', e.target.value)}>
                  <option value="">Sin categoría</option>
                  {[...grupos.entries()].map(([g, cs]) => (
                    <optgroup key={g} label={g}>
                      {cs.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </GlassSelect>
              )}
            </Campo>
            <Campo etiqueta="Unidad de venta" ayuda="Lo que verá el cliente: pza, m², millar…">
              {(id, a) => <input id={id} {...a} className="field" value={f.unidad} onChange={(e) => set('unidad', e.target.value)} />}
            </Campo>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-fg-muted">Cómo se cobra</p>
            <SelectorMetodo
              valor={f.metodo}
              onCambio={(m) => setF((x) => ({ ...x, metodo: m, unidad: x.unidad === UNIDAD_SUGERIDA[x.metodo] || !x.unidad ? UNIDAD_SUGERIDA[m] : x.unidad }))}
            />
          </div>
          <Campo etiqueta="Descripción" opcional>
            {(id) => <GlassTextarea id={id} rows={2} value={f.descripcion} onChange={(e) => set('descripcion', e.target.value)} placeholder="Material, acabado, tiempos…" />}
          </Campo>
        </Seccion>

        {verPrecios ? (
          <Seccion titulo="Precio público" ayuda={`Por ${info.unidadCobro}. Déjalo vacío si se cotiza en cada caso.`}>
            <div className="grid grid-cols-2 gap-4">
              <Campo etiqueta={`Precio por ${info.unidadCobro}`}>{(id, a) => <CampoNumero id={id} {...a} valor={f.precio} onValor={(v) => set('precio', v)} fijos={2} prefijo="$" placeholder="Sin precio" />}</Campo>
              <Campo etiqueta="Cobro mínimo" opcional>{(id, a) => <CampoNumero id={id} {...a} valor={f.minimo} onValor={(v) => set('minimo', v)} fijos={2} prefijo="$" />}</Campo>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-fg-muted">Precios por volumen</p>
                <GlassButton variante="fantasma" tamano="sm" icono={<Plus />} onClick={() => set('escalas', [...f.escalas, { desde: null, precio: null }])}>
                  Agregar escala
                </GlassButton>
              </div>
              {f.escalas.length === 0 ? <p className="text-sm text-fg-subtle">Sin escalas: se cobra el mismo precio en cualquier cantidad.</p> : null}
              {f.escalas.map((e, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
                  <Campo etiqueta={i === 0 ? `Desde (${info.unidadCobro})` : undefined}>
                    {(id, a) => <CampoNumero id={id} {...a} aria-label={`Escala ${i + 1}: desde`} valor={e.desde} onValor={(v) => set('escalas', f.escalas.map((x, j) => (j === i ? { ...x, desde: v } : x)))} />}
                  </Campo>
                  <Campo etiqueta={i === 0 ? `Precio por ${info.unidadCobro}` : undefined}>
                    {(id, a) => <CampoNumero id={id} {...a} aria-label={`Escala ${i + 1}: precio`} valor={e.precio} fijos={2} prefijo="$" onValor={(v) => set('escalas', f.escalas.map((x, j) => (j === i ? { ...x, precio: v } : x)))} />}
                  </Campo>
                  <GlassIconButton etiqueta={`Quitar escala ${i + 1}`} icono={<Trash2 />} tamano="sm" onClick={() => set('escalas', f.escalas.filter((_, j) => j !== i))} />
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {(['mayoreo', 'agencia'] as const).map((l) => (
                <div key={l} className="flex flex-col gap-3 rounded-tile bg-[var(--control-bg)] p-3">
                  <p className="text-sm font-semibold text-fg">{l === 'mayoreo' ? 'Lista mayoreo' : 'Lista agencia'}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo etiqueta="Precio">
                      {(id, a) => (
                        <CampoNumero id={id} {...a} valor={f.listas[l].precio} fijos={2} prefijo="$" placeholder="Usa público" onValor={(v) => set('listas', { ...f.listas, [l]: { ...f.listas[l], precio: v } })} />
                      )}
                    </Campo>
                    <Campo etiqueta="Mínimo" opcional>
                      {(id, a) => <CampoNumero id={id} {...a} valor={f.listas[l].minimo} fijos={2} prefijo="$" onValor={(v) => set('listas', { ...f.listas, [l]: { ...f.listas[l], minimo: v } })} />}
                    </Campo>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4 rounded-tile border border-[var(--divider)] p-4" aria-live="polite">
              <Campo etiqueta={conMedidas ? `Prueba con (${info.unidadCobro})` : `Prueba con (${CORTO_METODO[f.metodo].toLowerCase()})`} className="w-36">
                {(id, a) => <CampoNumero id={id} {...a} valor={muestra} onValor={setMuestra} />}
              </Campo>
              <div className="min-w-0 flex-1 text-right">
                <p className="text-xs text-fg-subtle">Precio público calculado</p>
                <p className="num text-2xl font-semibold tracking-tight text-fg">{previa.sinPrecio ? 'Sin precio' : dinero(previa.importe)}</p>
                {!previa.sinPrecio ? (
                  <p className="num text-xs text-fg-muted">
                    {dinero(previa.precioUnidadCobro)} / {info.unidadCobro}
                    {previa.aplicoMinimo ? ' · aplica el mínimo' : ''}
                    {verCostos && previa.costoTotal > 0 ? ` · margen ${porcentaje(previa.margenPct, 1)}` : ''}
                  </p>
                ) : null}
              </div>
            </div>
          </Seccion>
        ) : null}

        {verCostos ? (
          <Seccion titulo="Costos" ayuda={`Por ${info.unidadCobro}. Solo los ve quien tiene permiso de costos.`}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Campo etiqueta="Material">{(id, a) => <CampoNumero id={id} {...a} valor={f.costos.material} fijos={2} prefijo="$" onValor={(v) => set('costos', { ...f.costos, material: v })} />}</Campo>
              <Campo etiqueta="Mano de obra">{(id, a) => <CampoNumero id={id} {...a} valor={f.costos.manoObra} fijos={2} prefijo="$" onValor={(v) => set('costos', { ...f.costos, manoObra: v })} />}</Campo>
              <Campo etiqueta="Costo fijo por trabajo">{(id, a) => <CampoNumero id={id} {...a} valor={f.costos.fijo} fijos={2} prefijo="$" onValor={(v) => set('costos', { ...f.costos, fijo: v })} />}</Campo>
              <Campo etiqueta="Desperdicio %">{(id, a) => <CampoNumero id={id} {...a} valor={f.costos.desperdicio} max={100} onValor={(v) => set('costos', { ...f.costos, desperdicio: v })} />}</Campo>
              <Campo etiqueta="Ganancia sugerida %">{(id, a) => <CampoNumero id={id} {...a} valor={f.costos.ganancia} max={1000} onValor={(v) => set('costos', { ...f.costos, ganancia: v })} />}</Campo>
              <div className="flex flex-col justify-end">
                <p className="text-xs text-fg-subtle">Precio sugerido / {info.unidadCobro}</p>
                <p className="num text-md font-semibold text-fg">{sugerido > 0 ? dinero(sugerido) : '—'}</p>
              </div>
            </div>
          </Seccion>
        ) : null}

        <Seccion titulo="Etapas y estado">
          <div className="grid gap-2 sm:grid-cols-2">
            <GlassToggle icono={<Brush />} titulo="Requiere diseño" activo={f.diseno} onCambio={(v) => set('diseno', v)} tono="acento" />
            <GlassToggle icono={<Factory />} titulo="Requiere producción" activo={f.produccion} onCambio={(v) => set('produccion', v)} tono="acento" />
            <GlassToggle icono={<Wrench />} titulo="Requiere instalación" activo={f.instalacion} onCambio={(v) => set('instalacion', v)} tono="acento" />
            <GlassToggle icono={<Power />} titulo="Activo" subtitulo={f.activo ? 'Disponible para cotizar' : 'Oculto en cotizaciones'} activo={f.activo} onCambio={(v) => set('activo', v)} />
          </div>
        </Seccion>
      </div>
    </GlassModal>
  )
}
