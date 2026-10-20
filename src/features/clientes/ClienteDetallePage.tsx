import * as Menu from '@radix-ui/react-dropdown-menu'
import { ArrowLeft, Ellipsis, FilePlus2, Mail, MessageCircle, PencilLine, Phone, Power, RotateCcw, Trash2, UserSearch } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useSesion } from '@/app/sesion'
import { EstadoVacio, GlassButton, GlassIconButton, GlassModal, GlassPanel, Pildora, Skeleton } from '@/components/glass'
import type { Contacto } from '@/data/modulos/clientes/contrato'
import { escalonado, resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useActivarCliente, useCliente, useContactos, useEliminarCliente, useHistorialCliente, useResumenCliente } from './consultas'
import { ModuloActividad } from './ficha/Actividad'
import { ContactoModal } from './ficha/ContactoModal'
import { EditarClienteModal, type SeccionEdicion } from './ficha/EditarClienteModal'
import { ModuloHistorial } from './ficha/Historial'
import { ModuloContactos, ModuloDatosContacto, ModuloFiscal, ModuloListaPrecio, ModuloNotas, ModuloResumen } from './ficha/Modulos'
import { AvatarCliente, useWhatsAppCliente } from './piezas'

export default function ClienteDetallePage() {
  const { id = '' } = useParams()
  return <Ficha key={id} id={id} />
}

interface Accion {
  id: string
  etiqueta: string
  nombre?: string
  icono: ReactNode
  onClick?: () => void
  href?: string
  destacado?: boolean
  tono?: 'luz' | 'acento'
  desactivado?: boolean
  menu?: boolean
}

function Ficha({ id }: { id: string }) {
  const { puede } = useSesion()
  const navegar = useNavigate()
  const reducir = useReducedMotion()
  const gestionar = puede('gestionar_clientes')
  const conPrecios = puede('ver_precios')
  const consulta = useCliente(id)
  const resumen = useResumenCliente(id)
  const historial = useHistorialCliente(id)
  const contactos = useContactos(id)
  const activar = useActivarCliente(id)
  const eliminar = useEliminarCliente()
  const wa = useWhatsAppCliente()
  const [edicion, setEdicion] = useState<SeccionEdicion | null>(null)
  const [contacto, setContacto] = useState<{ abierto: boolean; actual: Contacto | null }>({ abierto: false, actual: null })
  const [borrar, setBorrar] = useState(false)
  const [errorBorrar, setErrorBorrar] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)

  if (consulta.isPending) return <EsqueletoFicha />
  if (consulta.isError) {
    const noExiste = /no encontrad|0 rows|multiple \(or no\) rows|JSON object/i.test(consulta.error.message)
    return (
      <GlassPanel className="mt-2">
        <EstadoVacio
          icono={<UserSearch />}
          titulo={noExiste ? 'No encontramos este cliente' : 'No se pudo abrir el cliente'}
          descripcion={noExiste ? 'Puede que se haya eliminado o que el enlace esté incompleto.' : `${consulta.error.message}. Revisa tu conexión e inténtalo de nuevo.`}
          accion={
            <div className="flex flex-wrap justify-center gap-2">
              <GlassButton variante="cristal" icono={<ArrowLeft />} onClick={() => navegar('/clientes')}>
                Volver a clientes
              </GlassButton>
              {!noExiste ? (
                <GlassButton icono={<RotateCcw />} onClick={() => void consulta.refetch()}>
                  Reintentar
                </GlassButton>
              ) : null}
            </div>
          }
        />
      </GlassPanel>
    )
  }

  const c = consulta.data
  const principal = contactos.data?.find((x) => x.principal) ?? contactos.data?.[0]
  const telLlamar = c.telefono ?? c.whatsapp ?? principal?.telefono ?? principal?.whatsapp ?? null
  const correo = c.email ?? principal?.email ?? null
  const masOpciones = gestionar || puede('eliminar_registros')

  const acciones: Accion[] = [
    {
      id: 'whatsapp',
      etiqueta: 'WhatsApp',
      nombre: `Escribir por WhatsApp a ${c.nombre}`,
      icono: <MessageCircle />,
      onClick: () => wa.abrir({ nombre: c.nombre, whatsapp: c.whatsapp ?? principal?.whatsapp ?? null, telefono: c.telefono }),
      desactivado: !(c.whatsapp || c.telefono || principal?.whatsapp),
    },
    { id: 'llamar', etiqueta: 'Llamar', nombre: `Llamar a ${c.nombre}`, icono: <Phone />, href: telLlamar ? `tel:${telLlamar.replace(/[^\d+]/g, '')}` : undefined, desactivado: !telLlamar },
    { id: 'correo', etiqueta: 'Correo', nombre: `Enviar correo a ${c.nombre}`, icono: <Mail />, href: correo ? `mailto:${correo}` : undefined, desactivado: !correo },
  ]
  if (puede('gestionar_cotizaciones')) {
    acciones.push({
      id: 'cotizar',
      etiqueta: 'Nueva cotización',
      nombre: `Nueva cotización para ${c.nombre}`,
      icono: <FilePlus2 />,
      onClick: () => navegar(`/cotizaciones/nueva?cliente=${c.id}`),
      destacado: c.activo,
      tono: 'acento',
      desactivado: !c.activo,
    })
  }
  if (gestionar) acciones.push({ id: 'editar', etiqueta: 'Editar', nombre: 'Editar datos del cliente', icono: <PencilLine />, onClick: () => setEdicion('general') })
  if (masOpciones) acciones.push({ id: 'mas', etiqueta: 'Más', nombre: 'Más acciones del cliente', icono: <Ellipsis />, menu: true })

  const confirmarBorrado = async () => {
    setErrorBorrar(null)
    try {
      await eliminar.mutateAsync(c.id)
      toast.success(`Cliente ${c.nombre} eliminado`)
      setBorrar(false)
      navegar('/clientes', { replace: true })
    } catch (e) {
      setErrorBorrar(e instanceof Error ? e.message : 'No se pudo eliminar el cliente')
    }
  }

  const tieneDocumentos = Boolean(historial.data && (historial.data.cotizaciones.length || historial.data.pedidos.length || historial.data.pagos.length)) || Boolean(resumen.data && (resumen.data.pedidos || resumen.data.cotizaciones))

  return (
    <div className="flex flex-col gap-5 pt-1">
      {/* Encabezado: identidad + botones circulares tipo Centro de Control */}
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <GlassIconButton etiqueta="Volver a clientes" icono={<ArrowLeft />} tamano="sm" className="mt-0.5 shrink-0 sm:mt-0" onClick={() => (window.history.length > 1 ? navegar(-1) : navegar('/clientes'))} />
          <AvatarCliente nombre={c.nombre} tipo={c.tipo} tamano="xl" className="hidden sm:grid" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Pildora tono="neutro" punto={false}>
                {c.tipo === 'persona' ? 'Persona' : 'Empresa'}
              </Pildora>
              {!c.activo ? <Pildora tono="aviso">Inactivo</Pildora> : null}
              {c.etiquetas.map((e) => (
                <Pildora key={e} tono="acento" punto={false}>
                  {e}
                </Pildora>
              ))}
            </div>
            <h2 className="mt-1.5 text-2xl font-semibold leading-tight tracking-tight text-fg sm:text-[1.75rem] sm:leading-tight">{c.nombre}</h2>
            {c.razon_social && c.razon_social !== c.nombre ? <p className="mt-0.5 truncate text-sm text-fg-muted">{c.razon_social}</p> : principal ? <p className="mt-0.5 truncate text-sm text-fg-muted">{principal.nombre}{principal.puesto ? ` · ${principal.puesto}` : ''}</p> : null}
          </div>
        </div>

        <div role="group" aria-label="Acciones del cliente" className="grid grid-cols-3 justify-items-center gap-y-4 sm:flex sm:flex-wrap sm:justify-start sm:gap-x-1 xl:justify-end">
          {acciones.map((a, i) => {
            const boton = (
              <GlassIconButton
                etiqueta={a.etiqueta}
                {...(a.nombre ? { 'aria-label': a.nombre } : {})}
                mostrarEtiqueta
                icono={a.icono}
                destacado={a.destacado}
                tono={a.tono}
                tamano="md"
                disabled={a.desactivado}
                onClick={a.href ? () => (window.location.href = a.href!) : a.onClick}
              />
            )
            return (
              <motion.div
                key={a.id}
                initial={reducir ? false : { opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ...resorte.agil, delay: reducir ? 0 : 0.08 + escalonado(i, 0.04) }}
              >
                {a.menu ? (
                  <Menu.Root open={menu} onOpenChange={setMenu} modal={false}>
                    <Menu.Trigger asChild>{boton}</Menu.Trigger>
                    <AnimatePresence>
                      {menu ? (
                        <Menu.Portal forceMount>
                          <Menu.Content asChild align="end" sideOffset={40} collisionPadding={12} forceMount>
                            <motion.div
                              initial={{ opacity: 0, scale: 0.92, y: -6 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.96, y: -4 }}
                              transition={resorte.modal}
                              style={{ transformOrigin: 'var(--radix-dropdown-menu-content-transform-origin)' }}
                              className="glass glass-strong z-50 w-64 rounded-module p-2 shadow-glass-lg outline-none"
                            >
                              {gestionar ? (
                                <Opcion icono={<Power />} onSelect={() => activar.mutate(!c.activo, { onSuccess: () => toast.success(c.activo ? `${c.nombre} desactivado: ya no aparece en búsquedas` : `${c.nombre} activado`) })}>
                                  {c.activo ? 'Desactivar cliente' : 'Activar cliente'}
                                </Opcion>
                              ) : null}
                              {puede('eliminar_registros') ? (
                                <>
                                  {gestionar ? <Menu.Separator className="hairline mx-2 my-1.5" /> : null}
                                  <Opcion
                                    icono={<Trash2 />}
                                    peligro
                                    onSelect={() => {
                                      setErrorBorrar(null)
                                      setBorrar(true)
                                    }}
                                  >
                                    Eliminar cliente…
                                  </Opcion>
                                </>
                              ) : null}
                            </motion.div>
                          </Menu.Content>
                        </Menu.Portal>
                      ) : null}
                    </AnimatePresence>
                  </Menu.Root>
                ) : (
                  boton
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      {!c.activo ? (
        <p role="status" className="rounded-module bg-warning-soft/70 px-4 py-3 text-sm text-fg">
          <span className="font-semibold">Cliente inactivo.</span> No aparece en búsquedas ni en la lista para reactivar. {gestionar ? 'Actívalo desde Más para volver a cotizarle.' : ''}
        </p>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <ModuloResumen r={resumen.data} cargando={resumen.isPending} conPrecios={conPrecios} />
          <ModuloHistorial h={historial.data} cargando={historial.isPending} conPrecios={conPrecios} />
          {gestionar ? <ModuloActividad clienteId={c.id} /> : null}
        </div>
        <aside className="grid gap-4 md:grid-cols-2 xl:grid-cols-1" aria-label="Datos del cliente">
          <ModuloDatosContacto c={c} puedeEditar={gestionar} onEditar={() => setEdicion('general')} />
          <ModuloContactos
            contactos={contactos.data}
            cargando={contactos.isPending}
            puedeEditar={gestionar}
            clienteId={c.id}
            onNuevo={() => setContacto({ abierto: true, actual: null })}
            onEditar={(x) => setContacto({ abierto: true, actual: x })}
          />
          <ModuloFiscal c={c} puedeEditar={gestionar} onEditar={() => setEdicion('fiscal')} />
          <ModuloListaPrecio c={c} puedeEditar={gestionar} />
          <ModuloNotas c={c} puedeEditar={gestionar} />
        </aside>
      </div>

      {gestionar ? (
        <>
          <EditarClienteModal abierto={edicion !== null} onCambio={(v) => !v && setEdicion(null)} cliente={c} seccion={edicion ?? 'general'} />
          <ContactoModal
            abierto={contacto.abierto}
            onCambio={(v) => setContacto((x) => ({ ...x, abierto: v }))}
            clienteId={c.id}
            contacto={contacto.actual}
            esPrimero={!contactos.data?.length}
          />
        </>
      ) : null}

      <GlassModal
        abierto={borrar}
        onCambio={setBorrar}
        ancho="sm"
        titulo={tieneDocumentos ? `${c.nombre} tiene historial` : `¿Eliminar a ${c.nombre}?`}
        descripcion={
          tieneDocumentos
            ? 'Este cliente tiene cotizaciones o pedidos, así que no se puede eliminar. Desactívalo para ocultarlo de búsquedas sin perder su historial.'
            : 'Se borran también sus contactos y actividades. No se puede deshacer.'
        }
        pie={
          <>
            <GlassButton variante="fantasma" onClick={() => setBorrar(false)}>
              Cancelar
            </GlassButton>
            {tieneDocumentos && gestionar && c.activo ? (
              <GlassButton
                variante="primario"
                icono={<Power />}
                cargando={activar.isPending}
                onClick={() =>
                  activar.mutate(false, {
                    onSuccess: () => {
                      toast.success(`${c.nombre} desactivado`)
                      setBorrar(false)
                    },
                  })
                }
              >
                Desactivar cliente
              </GlassButton>
            ) : !tieneDocumentos ? (
              <GlassButton variante="peligro" icono={<Trash2 />} cargando={eliminar.isPending} onClick={() => void confirmarBorrado()}>
                Eliminar definitivamente
              </GlassButton>
            ) : null}
          </>
        }
      >
        {errorBorrar ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {errorBorrar}
          </p>
        ) : (
          <p className="text-sm text-fg-muted">{tieneDocumentos ? 'Sus cotizaciones, pedidos y pagos se conservan aunque lo desactives.' : 'Si solo quieres ocultarlo, usa Desactivar cliente.'}</p>
        )}
      </GlassModal>
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

function EsqueletoFicha() {
  return (
    <div className="flex flex-col gap-5 pt-1" role="status" aria-label="Cargando cliente">
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-full" />
        <Skeleton className="hidden size-20 rounded-[1.6rem] sm:block" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-40 rounded-full" />
          <Skeleton className="h-7 w-64 rounded-full" />
        </div>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="flex flex-col gap-5">
          <Skeleton className="h-52 rounded-module" />
          <Skeleton className="h-72 rounded-module" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 rounded-module" />
          <Skeleton className="h-40 rounded-module" />
        </div>
      </div>
    </div>
  )
}
