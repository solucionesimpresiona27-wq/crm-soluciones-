import { FileSearch, Mail, MessageCircle, Pencil, Phone, Plus, Power, ReceiptText, RotateCcw, Save, Search, Truck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useSesion } from '@/app/sesion'
import { Campo, EstadoVacio, GlassButton, GlassIconButton, GlassInput, GlassModal, GlassPanel, GlassSurface, GlassTextarea, Pildora, Skeleton } from '@/components/glass'
import { TablaCargando } from '@/features/pagos/piezas'
import { CATEGORIAS_GASTO, type Material, type Proveedor } from '@/data/modulos/inventario/contrato'
import { dinero, fecha, telefono } from '@/lib/format'
import { cn } from '@/lib/utils'
import { enlaceWhatsApp, telefonoWhatsApp } from '@/lib/whatsapp'
import { useActivarProveedor, useGastos, useGuardarProveedor, useMateriales, useProveedores } from '../consultas'
import { conUnidad, MedidorExistencia, SinAcceso } from '../piezas'

export default function ProveedoresVista() {
  const { puede } = useSesion()
  const ver = puede('gestionar_inventario') || puede('registrar_gastos') || puede('ver_costos')
  if (!ver) return <SinAcceso titulo="Los proveedores son para compras y administración" descripcion="Tu rol no incluye proveedores. Puedes consultar materiales y existencias." />
  return <Proveedores />
}

function iniciales(n: string) {
  return n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

function Proveedores() {
  const { puede } = useSesion()
  const editar = puede('gestionar_inventario') || puede('registrar_gastos')
  const [inactivos, setInactivos] = useState(false)
  const consulta = useProveedores(true, inactivos)
  const materiales = useMateriales()
  const [texto, setTexto] = useState('')
  const [ficha, setFicha] = useState<Proveedor | null>(null)
  const [form, setForm] = useState<{ p: Proveedor | null } | null>(null)

  const q = texto.trim().toLocaleLowerCase('es')
  const lista = useMemo(
    () => (consulta.data ?? []).filter((p) => !q || [p.nombre, p.contacto, p.categoria, p.telefono, p.whatsapp].some((x) => x?.toLocaleLowerCase('es').includes(q))),
    [consulta.data, q],
  )
  const surte = (id: string) => (materiales.data ?? []).filter((m) => m.proveedor_id === id)
  // La ficha se mantiene al día tras editar
  const fichaActual = ficha ? (consulta.data?.find((p) => p.id === ficha.id) ?? ficha) : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <div className="w-full sm:w-80">
          <GlassInput icono={<Search />} aria-label="Buscar proveedor" placeholder="Buscar proveedor, contacto o categoría" value={texto} onChange={(e) => setTexto(e.target.value)} className="rounded-full" />
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-fg-muted">
          <input type="checkbox" className="size-4 accent-navy-600" checked={inactivos} onChange={(e) => setInactivos(e.target.checked)} />
          Ver inactivos
        </label>
        {editar ? (
          <GlassButton variante="primario" icono={<Plus />} onClick={() => setForm({ p: null })} className="max-sm:w-full sm:ml-auto">
            Nuevo proveedor
          </GlassButton>
        ) : null}
      </div>

      {consulta.isPending ? (
        <TablaCargando filas={4} />
      ) : consulta.isError ? (
        <GlassPanel>
          <EstadoVacio
            icono={<FileSearch />}
            titulo="No se pudieron cargar los proveedores"
            descripcion={`${consulta.error.message}. Revisa tu conexión e inténtalo de nuevo.`}
            accion={
              <GlassButton icono={<RotateCcw />} onClick={() => void consulta.refetch()}>
                Reintentar
              </GlassButton>
            }
          />
        </GlassPanel>
      ) : lista.length === 0 ? (
        <GlassPanel>
          <EstadoVacio
            icono={<Truck />}
            titulo={q ? `Sin proveedores que coincidan con “${texto.trim()}”` : 'Todavía no hay proveedores'}
            descripcion="Registra a quién le compras vinil, lona, tintas o maquila para ligarlo a materiales y gastos."
            accion={
              editar && !q ? (
                <GlassButton variante="primario" icono={<Plus />} onClick={() => setForm({ p: null })}>
                  Nuevo proveedor
                </GlassButton>
              ) : null
            }
          />
        </GlassPanel>
      ) : (
        <ul aria-label="Proveedores" className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((p) => {
            const mats = surte(p.id)
            const wa = telefonoWhatsApp(p.whatsapp ?? p.telefono)
            return (
              <li key={p.id}>
                <GlassSurface variante="fuerte" className={cn('flex h-full flex-col rounded-module p-4', !p.activo && 'opacity-60')}>
                  <button type="button" onClick={() => setFicha(p)} className="-m-2 flex items-center gap-3 rounded-tile p-2 text-left outline-none hover:bg-[var(--control-bg)] focus-visible:bg-[var(--control-bg)]">
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--control-bg)] text-sm font-semibold text-fg" aria-hidden>
                      {iniciales(p.nombre)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-md font-semibold text-fg">{p.nombre}</span>
                      <span className="block truncate text-xs text-fg-muted">{[p.categoria, p.contacto].filter(Boolean).join(' · ') || 'Sin categoría'}</span>
                    </span>
                  </button>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {mats.slice(0, 3).map((m) => (
                      <Pildora key={m.id} tono={m.bajo_minimo ? 'luz' : 'neutro'} punto={m.bajo_minimo}>
                        {m.nombre}
                      </Pildora>
                    ))}
                    {mats.length > 3 ? <Pildora punto={false}>+{mats.length - 3}</Pildora> : null}
                    {!p.activo ? <Pildora tono="aviso">Inactivo</Pildora> : null}
                  </div>
                  <div className="mt-auto flex items-center gap-2 pt-3">
                    {wa ? (
                      <GlassButton variante="cristal" tamano="sm" icono={<MessageCircle />} className="h-11" onClick={() => window.open(enlaceWhatsApp(wa, `Hola ${p.contacto ?? p.nombre}, `), '_blank', 'noopener,noreferrer')}>
                        WhatsApp
                      </GlassButton>
                    ) : null}
                    <GlassButton variante="fantasma" tamano="sm" className="ml-auto h-11" onClick={() => setFicha(p)}>
                      Ver ficha
                    </GlassButton>
                  </div>
                </GlassSurface>
              </li>
            )
          })}
        </ul>
      )}

      <FichaProveedor proveedor={fichaActual} materiales={fichaActual ? surte(fichaActual.id) : []} onCerrar={() => setFicha(null)} onEditar={editar ? (p) => setForm({ p }) : undefined} />
      <ProveedorModal abierto={Boolean(form)} proveedor={form?.p ?? null} onCerrar={() => setForm(null)} />
    </div>
  )
}

function FichaProveedor({
  proveedor: p,
  materiales,
  onCerrar,
  onEditar,
}: {
  proveedor: Proveedor | null
  materiales: Material[]
  onCerrar: () => void
  onEditar?: (p: Proveedor) => void
}) {
  const { puede } = useSesion()
  const verGastos = puede('registrar_gastos') || puede('ver_costos')
  const gastos = useGastos({ proveedorId: p?.id, limite: 20 }, Boolean(p) && verGastos)
  const activar = useActivarProveedor()
  const wa = telefonoWhatsApp(p?.whatsapp ?? p?.telefono)
  const totalGastos = (gastos.data ?? []).reduce((s, g) => s + (g.cancelado ? 0 : g.monto), 0)

  return (
    <GlassModal abierto={Boolean(p)} onCambio={(v) => (v ? null : onCerrar())} titulo={p?.nombre ?? 'Proveedor'} descripcion={p ? [p.categoria, p.activo ? null : 'Inactivo'].filter(Boolean).join(' · ') || undefined : undefined} lateral>
      {p ? (
        <div className="flex flex-col gap-5">
          <div className={cn('grid justify-items-center gap-2 sm:flex sm:flex-wrap sm:justify-start sm:gap-4', onEditar ? 'grid-cols-4' : 'grid-cols-3')}>
            <GlassIconButton etiqueta="WhatsApp" mostrarEtiqueta icono={<MessageCircle />} destacado={Boolean(wa)} tono="luz" disabled={!wa} onClick={() => wa && window.open(enlaceWhatsApp(wa, `Hola ${p.contacto ?? p.nombre}, `), '_blank', 'noopener,noreferrer')} />
            <GlassIconButton etiqueta="Llamar" mostrarEtiqueta icono={<Phone />} disabled={!p.telefono} onClick={() => p.telefono && (window.location.href = `tel:${p.telefono}`)} />
            <GlassIconButton etiqueta="Correo" mostrarEtiqueta icono={<Mail />} disabled={!p.email} onClick={() => p.email && (window.location.href = `mailto:${p.email}`)} />
            {onEditar ? <GlassIconButton etiqueta="Editar" mostrarEtiqueta icono={<Pencil />} onClick={() => onEditar(p)} /> : null}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-tile bg-[var(--control-bg)] p-4 text-sm">
            <Dato t="Contacto" v={p.contacto} />
            <Dato t="Teléfono" v={p.telefono ? telefono(p.telefono) : null} />
            <Dato t="WhatsApp" v={p.whatsapp ? telefono(p.whatsapp) : null} />
            <Dato t="Correo" v={p.email} />
            <Dato t="RFC" v={p.rfc} />
            <Dato t="Categoría" v={p.categoria} />
            {p.notas ? (
              <div className="col-span-2">
                <dt className="text-xs text-fg-subtle">Notas</dt>
                <dd className="whitespace-pre-line text-fg">{p.notas}</dd>
              </div>
            ) : null}
          </dl>

          <section aria-labelledby="prov-mats">
            <h3 id="prov-mats" className="mb-2 text-sm font-semibold text-fg">
              Materiales que surte
            </h3>
            {materiales.length === 0 ? (
              <p className="text-sm text-fg-muted">Ningún material lo tiene como proveedor habitual.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {materiales.map((m) => (
                  <li key={m.id} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium text-fg">{m.nombre}</span>
                      <span className={cn('num whitespace-nowrap', m.bajo_minimo ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-fg-muted')}>{conUnidad(m.existencia, m.unidad)}</span>
                    </div>
                    <MedidorExistencia m={m} className="h-2" />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {verGastos ? (
            <section aria-labelledby="prov-gastos">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 id="prov-gastos" className="text-sm font-semibold text-fg">
                  Gastos recientes
                </h3>
                {gastos.data?.length ? <span className="num text-sm font-semibold text-fg">{dinero(totalGastos)}</span> : null}
              </div>
              {gastos.isPending ? (
                <Skeleton className="h-24 w-full rounded-tile" />
              ) : gastos.isError ? (
                <p className="text-sm text-danger">No se pudieron cargar: {gastos.error.message}</p>
              ) : !gastos.data.length ? (
                <p className="text-sm text-fg-muted">Sin gastos con este proveedor.</p>
              ) : (
                <ul className="divide-y divide-[var(--divider)]">
                  {gastos.data.map((g) => (
                    <li key={g.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <ReceiptText className="size-4 shrink-0 text-fg-subtle" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-fg">{g.concepto}</span>
                        <span className="block text-xs text-fg-muted">
                          {fecha(g.fecha)} · {CATEGORIAS_GASTO[g.categoria]}
                          {g.folio_pedido ? ` · ${g.folio_pedido}` : ''}
                        </span>
                      </span>
                      <span className="num whitespace-nowrap font-semibold text-fg">{dinero(g.monto)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {onEditar ? (
            <GlassButton
              variante={p.activo ? 'fantasma' : 'cristal'}
              icono={<Power />}
              cargando={activar.isPending}
              className={cn('self-start', p.activo && 'text-danger')}
              onClick={() =>
                activar.mutate(
                  { id: p.id, activo: !p.activo },
                  { onSuccess: () => toast.success(p.activo ? `${p.nombre} desactivado` : `${p.nombre} activado`), onError: (e) => toast.error(`No se cambió: ${e.message}`) },
                )
              }
            >
              {p.activo ? 'Desactivar proveedor' : 'Activar proveedor'}
            </GlassButton>
          ) : null}
        </div>
      ) : null}
    </GlassModal>
  )
}

function Dato({ t, v }: { t: string; v: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-subtle">{t}</dt>
      <dd className="truncate text-fg">{v || '—'}</dd>
    </div>
  )
}

const VACIO = { nombre: '', contacto: '', telefono: '', whatsapp: '', email: '', rfc: '', categoria: '', notas: '' }

export function ProveedorModal({ abierto, proveedor, onCerrar }: { abierto: boolean; proveedor: Proveedor | null; onCerrar: () => void }) {
  const guardar = useGuardarProveedor()
  const [f, setF] = useState(VACIO)
  const [intento, setIntento] = useState(false)
  useEffect(() => {
    if (!abierto) return
    setIntento(false)
    setF(proveedor ? Object.fromEntries(Object.keys(VACIO).map((k) => [k, (proveedor[k as keyof typeof VACIO] as string | null) ?? ''])) as typeof VACIO : VACIO)
  }, [abierto, proveedor])
  const set = (k: keyof typeof VACIO) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const errores = {
    nombre: !f.nombre.trim() ? 'Escribe el nombre del proveedor' : null,
    email: f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim()) ? 'El correo no parece válido (ej. ventas@proveedor.com)' : null,
  }
  const enviar = async () => {
    setIntento(true)
    if (errores.nombre || errores.email) return
    const datos = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null])) as Record<keyof typeof VACIO, string | null>
    try {
      const p = await guardar.mutateAsync({ id: proveedor?.id, datos: { ...datos, nombre: f.nombre.trim() } })
      toast.success(proveedor ? `${p.nombre} actualizado` : `${p.nombre} agregado a proveedores`)
      onCerrar()
    } catch (e) {
      toast.error(`No se guardó el proveedor: ${(e as Error).message}`)
    }
  }
  return (
    <GlassModal
      abierto={abierto}
      onCambio={(v) => (v ? null : onCerrar())}
      titulo={proveedor ? `Editar ${proveedor.nombre}` : 'Nuevo proveedor'}
      pie={
        <>
          <GlassButton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </GlassButton>
          <GlassButton variante="primario" icono={<Save />} cargando={guardar.isPending} onClick={() => void enviar()}>
            {proveedor ? 'Guardar cambios' : 'Guardar proveedor'}
          </GlassButton>
        </>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          void enviar()
        }}
      >
        <Campo etiqueta="Nombre" error={intento ? errores.nombre : null} className="sm:col-span-2">
          {(id, a) => <GlassInput id={id} {...a} autoFocus value={f.nombre} onChange={set('nombre')} placeholder="Ej. Viniles de Occidente" maxLength={200} />}
        </Campo>
        <Campo etiqueta="Contacto" opcional>
          {(id) => <GlassInput id={id} value={f.contacto} onChange={set('contacto')} />}
        </Campo>
        <Campo etiqueta="Categoría" opcional>
          {(id) => <GlassInput id={id} value={f.categoria} onChange={set('categoria')} placeholder="Viniles, maquila, tintas…" />}
        </Campo>
        <Campo etiqueta="Teléfono" opcional>
          {(id) => <GlassInput id={id} type="tel" inputMode="tel" value={f.telefono} onChange={set('telefono')} />}
        </Campo>
        <Campo etiqueta="WhatsApp" opcional>
          {(id) => <GlassInput id={id} type="tel" inputMode="tel" value={f.whatsapp} onChange={set('whatsapp')} placeholder="10 dígitos" />}
        </Campo>
        <Campo etiqueta="Correo" opcional error={intento ? errores.email : null}>
          {(id, a) => <GlassInput id={id} {...a} type="email" value={f.email} onChange={set('email')} />}
        </Campo>
        <Campo etiqueta="RFC" opcional>
          {(id) => <GlassInput id={id} value={f.rfc} onChange={set('rfc')} className="uppercase" maxLength={13} />}
        </Campo>
        <Campo etiqueta="Notas" opcional className="sm:col-span-2">
          {(id) => <GlassTextarea id={id} rows={2} value={f.notas} onChange={set('notas')} placeholder="Tiempos de entrega, condiciones de pago…" />}
        </Campo>
        <button type="submit" hidden />
      </form>
    </GlassModal>
  )
}
