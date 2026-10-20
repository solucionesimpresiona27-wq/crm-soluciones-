import { motion, useReducedMotion } from 'motion/react'
import { Calculator, Lock, PackagePlus, Pencil, Search, Tag } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useSesion } from '@/app/sesion'
import { EstadoVacio, GlassButton, GlassIconButton, GlassInput, GlassPanel, Pildora, SegmentedControl, Skeleton } from '@/components/glass'
import type { ProductoFicha } from '@/data/modulos/catalogo/contrato'
import { METODOS } from '@/lib/calculadora'
import { dinero } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { CategoriasVista } from './CategoriasVista'
import { useCategorias, useFichas } from './consultas'
import { ProductoModal } from './ProductoModal'

/** Catálogo (/catalogo/*): productos por grupo y categoría, y /catalogo/categorias para administrarlas. */
export default function CatalogoPage() {
  const { puede } = useSesion()
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const editar = puede('editar_catalogo')
  const actual = pathname.startsWith('/catalogo/categorias') ? '/catalogo/categorias' : '/catalogo'
  return (
    <div className="flex flex-col gap-4 pt-1">
      {editar ? (
        <SegmentedControl
          etiqueta="Secciones del catálogo"
          segmentos={[
            { valor: '/catalogo', etiqueta: 'Productos' },
            { valor: '/catalogo/categorias', etiqueta: 'Categorías' },
          ]}
          valor={actual}
          onCambio={(r) => navegar(r)}
          className="w-full sm:w-auto sm:self-start"
        />
      ) : null}
      <Routes>
        <Route path="categorias" element={editar ? <CategoriasVista /> : <ProductosVista />} />
        <Route path="*" element={<ProductosVista />} />
      </Routes>
    </div>
  )
}

const unidadCobro = (p: ProductoFicha) => METODOS[p.metodo_calculo].unidadCobro
const tienePrecio = (p: ProductoFicha) => p.precio_venta !== null || p.escalas.length > 0

function agrupar(lista: ProductoFicha[], orden: Map<string, number>) {
  const o = (id: string | undefined) => (id ? (orden.get(id) ?? 9999) : 10000)
  lista = [...lista].sort((a, b) => o(a.categoria?.id) - o(b.categoria?.id) || a.nombre.localeCompare(b.nombre, 'es'))
  const grupos = new Map<string, Map<string, ProductoFicha[]>>()
  for (const p of lista) {
    const g = p.categoria?.grupo ?? 'Sin grupo'
    const c = p.categoria?.nombre ?? 'Sin categoría'
    if (!grupos.has(g)) grupos.set(g, new Map())
    const m = grupos.get(g)!
    m.set(c, [...(m.get(c) ?? []), p])
  }
  return [...grupos.entries()].map(([g, m]) => [g, [...m.entries()]] as const)
}

type Filtro = 'todos' | 'sinPrecio' | 'inactivos'

function ProductosVista() {
  const { puede } = useSesion()
  const verPrecios = puede('ver_precios')
  const editar = puede('editar_catalogo')
  const reducir = useReducedMotion()
  const navegar = useNavigate()
  const [texto, setTexto] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const fichas = useFichas(editar)
  const [editando, setEditando] = useState<ProductoFicha | 'nuevo' | null>(null)

  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const todos = fichas.data ?? []
  const sinPrecio = todos.filter((p) => p.activo && !tienePrecio(p)).length
  const visibles = useMemo(() => {
    const t = norm(texto.trim())
    return todos.filter((p) => {
      if (filtro === 'sinPrecio' && (tienePrecio(p) || !p.activo)) return false
      if (filtro === 'inactivos' ? p.activo : !p.activo) return false
      if (!t) return true
      return norm(`${p.nombre} ${p.descripcion ?? ''} ${p.categoria?.nombre ?? ''} ${p.sku ?? ''}`).includes(t)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todos, texto, filtro])
  const categorias = useCategorias()
  const grupos = agrupar(visibles, new Map((categorias.data ?? []).map((c) => [c.id, c.orden])))

  const segmentos = [
    { valor: 'todos' as const, etiqueta: 'Activos' },
    ...(verPrecios ? [{ valor: 'sinPrecio' as const, etiqueta: 'Sin precio', conteo: sinPrecio }] : []),
    ...(editar ? [{ valor: 'inactivos' as const, etiqueta: 'Inactivos' }] : []),
  ]

  return (
    <motion.div className="flex flex-col gap-4" initial={reducir ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={resorte.suave}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-80">
          <GlassInput icono={<Search />} type="search" aria-label="Buscar en el catálogo" placeholder="Buscar producto o categoría" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
        <SegmentedControl etiqueta="Filtrar productos" segmentos={segmentos} valor={filtro} onCambio={setFiltro} tamano="sm" className="max-sm:w-full" />
        <div className="flex gap-2 sm:ml-auto max-sm:w-full">
          {puede('gestionar_cotizaciones') ? (
            <GlassButton variante="cristal" icono={<Calculator />} className="max-sm:flex-1" onClick={() => navegar('/calculadora')}>
              Calculadora
            </GlassButton>
          ) : null}
          {editar ? (
            <GlassButton variante="primario" icono={<PackagePlus />} onClick={() => setEditando('nuevo')} className="max-sm:flex-1">
              Nuevo producto
            </GlassButton>
          ) : null}
        </div>
      </div>

      {verPrecios && sinPrecio > 0 && filtro === 'todos' ? (
        <button
          type="button"
          onClick={() => setFiltro('sinPrecio')}
          className="flex min-h-11 items-center gap-3 rounded-tile border border-[rgb(var(--luz)/0.45)] bg-[rgb(var(--luz-soft)/0.5)] px-4 py-2.5 text-left text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="size-2.5 shrink-0 rounded-full bg-luz shadow-[0_0_10px_rgb(var(--luz))]" aria-hidden />
          <span>
            <strong className="num font-semibold">{sinPrecio}</strong> {sinPrecio === 1 ? 'producto no tiene' : 'productos no tienen'} precio todavía.{' '}
            {editar ? 'Captúralos para usarlos en la calculadora.' : 'Pide a administración que los capture.'}
          </span>
        </button>
      ) : null}

      {fichas.isPending ? (
        <GlassPanel className="flex flex-col gap-3 p-5">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded-control" />
          ))}
        </GlassPanel>
      ) : fichas.isError ? (
        <GlassPanel>
          <EstadoVacio titulo="No se pudo cargar el catálogo" descripcion={`${fichas.error.message.replace(/\.?$/, '.')} Revisa tu conexión e inténtalo de nuevo.`} accion={<GlassButton onClick={() => void fichas.refetch()}>Reintentar</GlassButton>} />
        </GlassPanel>
      ) : grupos.length === 0 ? (
        <GlassPanel>
          <EstadoVacio
            icono={<Tag />}
            titulo={filtro === 'sinPrecio' ? 'Todos los productos tienen precio' : 'No hay productos que coincidan'}
            descripcion={texto ? 'Prueba con otra palabra o quita el filtro.' : undefined}
          />
        </GlassPanel>
      ) : (
        grupos.map(([grupo, categorias]) => (
          <GlassPanel key={grupo} className="p-3 sm:p-5">
            <h2 className="px-2 pb-1 text-lg font-semibold tracking-tight text-fg">{grupo}</h2>
            {categorias.map(([cat, productos]) => (
              <section key={cat} className="mt-3">
                <h3 className="px-2 text-xs font-semibold text-fg-subtle">
                  {cat} · <span className="num">{productos.length}</span>
                </h3>
                <ul className="mt-1 divide-y divide-[var(--divider)]">
                  {productos.map((p) => (
                    <FilaProducto key={p.id} p={p} verPrecios={verPrecios} editar={editar} onEditar={() => setEditando(p)} />
                  ))}
                </ul>
              </section>
            ))}
          </GlassPanel>
        ))
      )}

      {editar ? <ProductoModal producto={editando === 'nuevo' ? null : editando} abierto={editando !== null} onCambio={(a) => !a && setEditando(null)} /> : null}
    </motion.div>
  )
}

function FilaProducto({ p, verPrecios, editar, onEditar }: { p: ProductoFicha; verPrecios: boolean; editar: boolean; onEditar: () => void }) {
  const sin = !tienePrecio(p)
  const etapas = [p.requiere_diseno && 'Diseño', p.requiere_produccion && 'Producción', p.requiere_instalacion && 'Instalación'].filter(Boolean) as string[]
  return (
    <li className={cn('flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-control px-2 py-3 sm:flex-nowrap', !p.activo && 'opacity-60')} data-producto={p.nombre}>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-fg max-sm:break-words sm:truncate">{p.nombre}</p>
        <p className="text-sm text-fg-muted max-sm:break-words sm:truncate">
          {METODOS[p.metodo_calculo].etiqueta}
          {etapas.length ? ` · ${etapas.join(', ')}` : ''}
          {!p.activo ? ' · Inactivo' : ''}
        </p>
      </div>
      {verPrecios ? (
        <div className="flex shrink-0 flex-col gap-1 max-sm:order-last max-sm:basis-full max-sm:items-start sm:items-end sm:text-right">
          {sin ? (
            editar ? (
              <button type="button" onClick={onEditar} className="inline-flex items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent pointer-coarse:-my-2.5 pointer-coarse:min-h-11">
                <Pildora tono="luz">Sin precio: captúralo</Pildora>
              </button>
            ) : (
              <Pildora tono="luz">Sin precio</Pildora>
            )
          ) : (
            <>
              <span className="num font-semibold text-fg">
                {p.precio_venta !== null ? dinero(p.precio_venta) : `desde ${dinero(Math.min(...p.escalas.map((e) => e.precio)))}`}
                <span className="font-normal text-fg-subtle"> / {unidadCobro(p)}</span>
              </span>
              {p.precios.length || p.escalas.length ? (
                <span className="num hidden text-xs text-fg-subtle sm:block">
                  {p.precios.map((l) => `${l.lista === 'mayoreo' ? 'Mayoreo' : 'Agencia'} ${dinero(l.precio)}`).join(' · ')}
                  {p.escalas.length ? `${p.precios.length ? ' · ' : ''}${p.escalas.length} escalas` : ''}
                </span>
              ) : null}
            </>
          )}
        </div>
      ) : null}
      {editar ? <GlassIconButton etiqueta={`Editar ${p.nombre}`} icono={<Pencil />} tamano="sm" onClick={onEditar} /> : !verPrecios ? <Lock className="size-4 text-fg-subtle" aria-label="Sin acceso a precios" /> : null}
    </li>
  )
}
