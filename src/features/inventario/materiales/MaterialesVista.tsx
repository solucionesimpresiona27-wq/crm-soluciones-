import * as Menu from '@radix-ui/react-dropdown-menu'
import { ArrowDownToLine, ArrowUpFromLine, Boxes, FileSearch, History, MapPin, MoreHorizontal, Pencil, Plus, Power, RotateCcw, Ruler, Search, TriangleAlert, Truck } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useSesion } from '@/app/sesion'
import { AnimatedNumber, EstadoVacio, GlassButton, GlassInput, GlassPanel, GlassSurface, GlassToggle } from '@/components/glass'
import { AccionFila, Capsula, CapsulasCargando, FilaCapsulas, TablaCargando } from '@/features/pagos/piezas'
import { UNIDADES_MATERIAL, type Material, type TipoMovimiento } from '@/data/modulos/inventario/contrato'
import { useEsEscritorio } from '@/hooks/useMediaQuery'
import { dinero } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useActivarMaterial, useMateriales } from '../consultas'
import { conUnidad, MedidorExistencia } from '../piezas'
import { MaterialModal, MovimientoModal } from './Dialogos'

interface Acciones {
  mover?: (m: Material, t: TipoMovimiento) => void
  entrada: boolean
  consumo: boolean
  editar?: (m: Material) => void
  activar?: (m: Material) => void
  kardex: (m: Material) => void
}

export default function MaterialesVista() {
  const { puede } = useSesion()
  const escritorio = useEsEscritorio()
  const navegar = useNavigate()
  const [params, setParams] = useSearchParams()
  const soloBajo = params.get('bajo') === '1'
  const [texto, setTexto] = useState('')
  const [inactivos, setInactivos] = useState(false)
  const todos = useMateriales({ incluirInactivos: inactivos })
  const activar = useActivarMaterial()
  const [editando, setEditando] = useState<Material | null>(null)
  const [nuevo, setNuevo] = useState(false)
  const [mov, setMov] = useState<{ m: Material; t: TipoMovimiento } | null>(null)

  const gestionar = puede('gestionar_inventario')
  const consumir = gestionar || puede('registrar_consumos')
  const costos = puede('ver_costos')
  // Los proveedores son de compras y administración (la base no los muestra a producción ni a diseño)
  const verProveedor = gestionar || costos || puede('registrar_gastos')

  // Acción rápida global: ?nuevo=1 abre el alta
  useEffect(() => {
    if (params.get('nuevo') === '1' && gestionar) {
      setNuevo(true)
      setParams((p) => {
        const n = new URLSearchParams(p)
        n.delete('nuevo')
        return n
      }, { replace: true })
    }
  }, [params, setParams, gestionar])

  const lista = todos.data ?? []
  const bajos = lista.filter((m) => m.bajo_minimo)
  const q = texto.trim().toLocaleLowerCase('es')
  const visibles = useMemo(
    () =>
      (soloBajo ? bajos : lista).filter(
        (m) => !q || [m.nombre, m.categoria, m.ubicacion, verProveedor ? m.proveedor : null].some((x) => x?.toLocaleLowerCase('es').includes(q)),
      ),
    [lista, bajos, soloBajo, q, verProveedor],
  )
  const valor = costos ? lista.reduce((s, m) => s + (m.activo && m.costo_unitario ? Math.max(0, m.existencia) * m.costo_unitario : 0), 0) : null

  const cambiarBajo = (v: boolean) =>
    setParams((p) => {
      const n = new URLSearchParams(p)
      if (v) n.set('bajo', '1')
      else n.delete('bajo')
      return n
    }, { replace: true })

  const acciones: Acciones = {
    mover: consumir ? (m, t) => setMov({ m, t }) : undefined,
    entrada: gestionar,
    consumo: consumir,
    editar: gestionar ? setEditando : undefined,
    activar: gestionar
      ? (m) =>
          activar.mutate(
            { id: m.id, activo: !m.activo },
            {
              onSuccess: () => toast.success(m.activo ? `${m.nombre} desactivado: ya no aparece en la lista` : `${m.nombre} activado`),
              onError: (e) => toast.error(`No se cambió: ${e.message}`),
            },
          )
      : undefined,
    kardex: (m) => navegar(`/inventario/movimientos?material=${m.id}`),
  }
  const descripcion = soloBajo ? 'Materiales con stock bajo' : 'Materiales'

  return (
    <div className="flex flex-col gap-4">
      {todos.isPending ? (
        <CapsulasCargando n={2} />
      ) : (
        <FilaCapsulas etiqueta="Resumen de inventario">
          <GlassToggle
            icono={<TriangleAlert />}
            titulo={bajos.length === 0 ? 'Sin stock bajo' : `${bajos.length} con stock bajo`}
            subtitulo={soloBajo ? 'Mostrando solo estos' : bajos.length ? 'Toca para filtrar' : 'Todo arriba del mínimo'}
            activo={soloBajo}
            onCambio={cambiarBajo}
            tono="luz"
          />
          <Capsula pozo={<Boxes />} titulo={<><AnimatedNumber valor={lista.filter((m) => m.activo).length} className="num" /> materiales</>} subtitulo={inactivos ? 'Incluye inactivos' : 'Activos en bodega'} />
          {valor !== null ? <Capsula pozo={<Ruler />} titulo={<span className="num">{dinero(valor)}</span>} subtitulo="Valor a costo" /> : null}
        </FilaCapsulas>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <div className="w-full sm:w-80">
          <GlassInput icono={<Search />} aria-label="Buscar material" placeholder={verProveedor ? 'Buscar material, ubicación o proveedor' : 'Buscar material o ubicación'} value={texto} onChange={(e) => setTexto(e.target.value)} className="rounded-full" />
        </div>
        {gestionar ? (
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-fg-muted">
            <input type="checkbox" className="size-4 accent-navy-600" checked={inactivos} onChange={(e) => setInactivos(e.target.checked)} />
            Ver inactivos
          </label>
        ) : null}
        {gestionar ? (
          <GlassButton variante="primario" icono={<Plus />} onClick={() => setNuevo(true)} className="max-sm:w-full sm:ml-auto">
            Nuevo material
          </GlassButton>
        ) : null}
      </div>

      <p role="status" className="sr-only">
        {todos.data ? `${visibles.length} ${visibles.length === 1 ? 'material' : 'materiales'}` : ''}
      </p>

      {todos.isPending ? (
        <TablaCargando />
      ) : todos.isError ? (
        <GlassPanel>
          <EstadoVacio
            icono={<FileSearch />}
            titulo="No se pudieron cargar los materiales"
            descripcion={`${todos.error.message}. Revisa tu conexión e inténtalo de nuevo.`}
            accion={
              <GlassButton icono={<RotateCcw />} onClick={() => void todos.refetch()}>
                Reintentar
              </GlassButton>
            }
          />
        </GlassPanel>
      ) : visibles.length === 0 ? (
        <GlassPanel>
          <EstadoVacio
            icono={<Boxes />}
            titulo={soloBajo && !q ? 'Ningún material está en stock bajo' : q ? `Sin materiales que coincidan con “${texto.trim()}”` : 'Todavía no hay materiales'}
            descripcion={soloBajo ? 'Cuando un material llegue a su mínimo aparecerá aquí con la luz encendida.' : 'Da de alta vinil, lona, papel y tintas con su stock mínimo para recibir alertas.'}
            accion={
              soloBajo || q ? (
                <GlassButton variante="cristal" icono={<RotateCcw />} onClick={() => (setTexto(''), cambiarBajo(false))}>
                  Ver todos
                </GlassButton>
              ) : gestionar ? (
                <GlassButton variante="primario" icono={<Plus />} onClick={() => setNuevo(true)}>
                  Nuevo material
                </GlassButton>
              ) : null
            }
          />
        </GlassPanel>
      ) : escritorio ? (
        <GlassPanel className="p-2">
          <TablaMateriales materiales={visibles} acciones={acciones} costos={costos} verProveedor={verProveedor} descripcion={descripcion} />
        </GlassPanel>
      ) : (
        <ul aria-label={descripcion} className="grid grid-cols-[minmax(0,1fr)] gap-2.5 md:grid-cols-2">
          {visibles.map((m) => (
            <li key={m.id}>
              <GlassSurface variante="fuerte" className={cn('rounded-tile p-4', !m.activo && 'opacity-60')}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-md font-semibold text-fg">{m.nombre}</p>
                    <p className="truncate text-xs text-fg-muted">{[m.categoria, m.ubicacion, verProveedor ? m.proveedor : null].filter(Boolean).join(' · ') || 'Sin categoría ni ubicación'}</p>
                  </div>
                  <MasAcciones m={m} acciones={acciones} />
                </div>
                <Existencia m={m} className="mt-3" />
                {costos && m.costo_unitario !== null ? (
                  <p className="mt-2 text-xs text-fg-muted">
                    Costo <span className="num font-semibold text-fg">{dinero(m.costo_unitario)}</span> / {UNIDADES_MATERIAL[m.unidad]}
                  </p>
                ) : null}
                <BotonesRapidos m={m} acciones={acciones} className="mt-3 border-t border-[var(--divider)] pt-3" />
              </GlassSurface>
            </li>
          ))}
        </ul>
      )}

      <MaterialModal abierto={nuevo || Boolean(editando)} material={editando} onCerrar={() => (setNuevo(false), setEditando(null))} />
      <MovimientoModal material={mov?.m ?? null} tipo={mov?.t ?? 'consumo'} onCerrar={() => setMov(null)} />
    </div>
  )
}

function Existencia({ m, className }: { m: Material; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className={cn('num font-semibold', m.bajo_minimo ? 'text-amber-700 dark:text-amber-300' : 'text-fg')}>
          {conUnidad(m.existencia, m.unidad)}
        </span>
        <span className="num whitespace-nowrap text-xs text-fg-subtle">{m.stock_minimo > 0 ? `mín. ${conUnidad(m.stock_minimo, m.unidad)}` : 'sin mínimo'}</span>
      </div>
      <MedidorExistencia m={m} />
    </div>
  )
}

function BotonesRapidos({ m, acciones, className }: { m: Material; acciones: Acciones; className?: string }) {
  if (!acciones.mover || !m.activo) return null
  return (
    <div className={cn('flex gap-2', className)}>
      {acciones.entrada ? (
        <GlassButton variante="cristal" tamano="sm" icono={<ArrowDownToLine />} onClick={() => acciones.mover?.(m, 'entrada')} className="h-11 flex-1">
          Entrada
        </GlassButton>
      ) : null}
      {acciones.consumo ? (
        <GlassButton variante="cristal" tamano="sm" icono={<ArrowUpFromLine />} onClick={() => acciones.mover?.(m, 'consumo')} className="h-11 flex-1">
          Consumo
        </GlassButton>
      ) : null}
    </div>
  )
}

function Opcion({ icono, children, onSelect, peligro }: { icono: ReactNode; children: ReactNode; onSelect: () => void; peligro?: boolean }) {
  return (
    <Menu.Item
      onSelect={onSelect}
      className={cn(
        'flex h-11 cursor-pointer items-center gap-3 rounded-full px-3 text-sm font-medium outline-none transition-colors [&_svg]:size-4 [&_svg]:shrink-0',
        peligro ? 'text-danger data-[highlighted]:bg-danger-soft' : 'text-fg data-[highlighted]:bg-[var(--control-bg-hover)]',
      )}
    >
      {icono}
      {children}
    </Menu.Item>
  )
}

function MasAcciones({ m, acciones }: { m: Material; acciones: Acciones }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <Menu.Root open={abierto} onOpenChange={setAbierto} modal={false}>
      <Menu.Trigger asChild>
        <GlassButton variante="fantasma" tamano="icono" aria-label={`Más acciones de ${m.nombre}`} icono={<MoreHorizontal />} />
      </Menu.Trigger>
      <AnimatePresence>
        {abierto ? (
          <Menu.Portal forceMount>
            <Menu.Content asChild align="end" sideOffset={6} collisionPadding={12} forceMount>
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -4 }}
                transition={resorte.modal}
                style={{ transformOrigin: 'var(--radix-dropdown-menu-content-transform-origin)' }}
                className="glass glass-strong z-50 w-60 rounded-module p-2 shadow-glass-lg outline-none"
              >
                {m.activo && acciones.mover && acciones.entrada ? (
                  <Opcion icono={<Ruler />} onSelect={() => acciones.mover?.(m, 'ajuste')}>
                    Ajustar existencia
                  </Opcion>
                ) : null}
                {m.activo && acciones.mover && acciones.consumo ? (
                  <Opcion icono={<TriangleAlert />} onSelect={() => acciones.mover?.(m, 'merma')}>
                    Registrar merma
                  </Opcion>
                ) : null}
                <Opcion icono={<History />} onSelect={() => acciones.kardex(m)}>
                  Ver movimientos
                </Opcion>
                {acciones.editar ? (
                  <Opcion icono={<Pencil />} onSelect={() => acciones.editar?.(m)}>
                    Editar material
                  </Opcion>
                ) : null}
                {acciones.activar ? (
                  <>
                    <Menu.Separator className="hairline mx-2 my-1.5" />
                    <Opcion icono={<Power />} peligro={m.activo} onSelect={() => acciones.activar?.(m)}>
                      {m.activo ? 'Desactivar material' : 'Activar material'}
                    </Opcion>
                  </>
                ) : null}
              </motion.div>
            </Menu.Content>
          </Menu.Portal>
        ) : null}
      </AnimatePresence>
    </Menu.Root>
  )
}

function TablaMateriales({
  materiales,
  acciones,
  costos,
  verProveedor,
  descripcion,
}: {
  materiales: Material[]
  acciones: Acciones
  costos: boolean
  verProveedor: boolean
  descripcion: string
}) {
  return (
    <table className="tabla">
      <caption className="sr-only">{descripcion}</caption>
      <thead>
        <tr>
          <th scope="col" className="w-[26%] pl-5">Material</th>
          <th scope="col" className="w-[28%]">Existencia</th>
          <th scope="col" className="hidden xl:table-cell">Ubicación</th>
          {verProveedor ? <th scope="col">Proveedor</th> : null}
          {costos ? <th scope="col" className="text-right">Costo</th> : null}
          <th scope="col" className="w-[9.5rem]">
            <span className="sr-only">Acciones</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <AnimatePresence initial={false}>
          {materiales.map((m) => (
            <motion.tr
              key={m.id}
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ layout: resorte.agil, opacity: { duration: 0.18 } }}
              className={cn(!m.activo && 'opacity-55')}
            >
              <td className="max-w-0 pl-5">
                <span className="block truncate font-semibold text-fg" title={m.nombre}>
                  {m.nombre}
                </span>
                <span className="block truncate text-xs text-fg-muted">
                  {m.categoria ?? 'Sin categoría'}
                  {!m.activo ? ' · inactivo' : ''}
                </span>
              </td>
              <td>
                <Existencia m={m} />
              </td>
              <td className="hidden max-w-[11rem] text-fg-muted xl:table-cell">
                {m.ubicacion ? (
                  <span className="inline-flex max-w-full items-center gap-1.5" title={m.ubicacion}>
                    <MapPin className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />
                    <span className="truncate">{m.ubicacion}</span>
                  </span>
                ) : (
                  '—'
                )}
              </td>
              {verProveedor ? (
                <td className="max-w-[12rem] text-fg-muted">
                  {m.proveedor ? (
                    <span className="inline-flex max-w-full items-center gap-1.5" title={m.proveedor}>
                      <Truck className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />
                      <span className="truncate">{m.proveedor}</span>
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              ) : null}
              {costos ? (
                <td className="num whitespace-nowrap text-right">
                  {m.costo_unitario !== null ? (
                    <>
                      <span className="font-semibold text-fg">{dinero(m.costo_unitario)}</span>
                      <span className="text-xs text-fg-subtle"> /{UNIDADES_MATERIAL[m.unidad]}</span>
                    </>
                  ) : (
                    <span className="text-fg-subtle">—</span>
                  )}
                </td>
              ) : null}
              <td className="py-2 pr-3">
                <div className="flex items-center justify-end">
                  {m.activo && acciones.mover && acciones.entrada ? (
                    <AccionFila etiqueta={`Entrada de ${m.nombre}`} icono={<ArrowDownToLine />} onClick={() => acciones.mover?.(m, 'entrada')} />
                  ) : null}
                  {m.activo && acciones.mover && acciones.consumo ? (
                    <AccionFila etiqueta={`Consumo de ${m.nombre}`} icono={<ArrowUpFromLine />} onClick={() => acciones.mover?.(m, 'consumo')} />
                  ) : null}
                  <MasAcciones m={m} acciones={acciones} />
                </div>
              </td>
            </motion.tr>
          ))}
        </AnimatePresence>
      </tbody>
    </table>
  )
}
