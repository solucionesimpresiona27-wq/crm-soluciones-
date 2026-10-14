import { Ban, Brush, ExternalLink, Hammer, Link2, Pause, Truck } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Campo, GlassButton, GlassInput, GlassModal, GlassSelect, GlassTextarea, SegmentedControl } from '@/components/glass'
import type { Archivo, CategoriaArchivo, PartidaPedido, PedidoDetalle } from '@/data/modulos/pedidos/contrato'
import type { MetodoCalculo } from '@/data/tipos'
import { useActualizarPartida, useActualizarPedido, useAgregarEnlace, useAgregarPartida, useCambiarEtapa, useRegistrarAprobacion } from '../consultas'
import { Interruptor, omitidasPor } from '../lista/DialogoNuevoPedido'

const MOTIVOS = {
  pausado: ['Esperando material', 'El cliente pidió esperar', 'Falta información del cliente', 'Esperando anticipo'],
  cancelado: ['El cliente canceló', 'No pagó el anticipo', 'Se duplicó el pedido', 'No se puede realizar'],
}

/** Pausar o cancelar con motivo obligatorio (queda en el historial). */
export function DialogoMotivo({ tipo, onCerrar, p }: { tipo: 'pausado' | 'cancelado' | null; onCerrar: () => void; p: PedidoDetalle }) {
  const cambiar = useCambiarEtapa()
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const pausar = tipo === 'pausado'

  useEffect(() => {
    if (tipo) {
      setMotivo('')
      setError(null)
    }
  }, [tipo])

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!tipo) return
    if (motivo.trim().length < 3) {
      setError(pausar ? 'Escribe por qué se pausa; así el equipo sabe qué falta para seguir' : 'Escribe por qué se cancela el pedido')
      return
    }
    try {
      await cambiar.mutateAsync({ id: p.id, estado: tipo, motivo: motivo.trim() })
      toast.success(pausar ? `${p.folio} en pausa` : `${p.folio} cancelado`)
      onCerrar()
    } catch {
      /* el hook ya muestra el error */
    }
  }

  return (
    <GlassModal
      abierto={tipo !== null}
      onCambio={(v) => !v && onCerrar()}
      titulo={pausar ? `Pausar ${p.folio}` : `Cancelar ${p.folio}`}
      descripcion={pausar ? 'El pedido se detiene donde va. Al reanudarlo regresa a la misma etapa.' : 'El pedido deja de aparecer en producción. Solo ventas o administración pueden reabrirlo.'}
      ancho="sm"
      pie={
        <>
          <GlassButton variante="fantasma" onClick={onCerrar}>
            Volver
          </GlassButton>
          <GlassButton type="submit" form="form-motivo" variante={pausar ? 'luz' : 'peligro'} icono={pausar ? <Pause /> : <Ban />} cargando={cambiar.isPending}>
            {pausar ? 'Pausar pedido' : 'Cancelar pedido'}
          </GlassButton>
        </>
      }
    >
      <form id="form-motivo" onSubmit={enviar} className="flex flex-col gap-3" noValidate>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Motivos frecuentes">
          {(tipo ? MOTIVOS[tipo] : []).map((m) => {
            const activo = motivo === m
            return (
              <GlassButton key={m} variante={activo ? 'luz' : 'cristal'} tamano="sm" aria-pressed={activo} onClick={() => setMotivo(activo ? '' : m)} className="h-11 px-4">
                {m}
              </GlassButton>
            )
          })}
        </div>
        <Campo etiqueta="Motivo" error={error}>
          {(id, a) => <GlassTextarea id={id} {...a} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Falta que el cliente envíe su logotipo en vectores" />}
        </Campo>
      </form>
    </GlassModal>
  )
}

/** Qué lleva el trabajo: diseño, taller e instalación. Las etapas que no aplican se saltan. */
export function DialogoEtapas({ abierto, onCambio, p }: { abierto: boolean; onCambio: (v: boolean) => void; p: PedidoDetalle }) {
  const actualizar = useActualizarPedido()
  const [lleva, setLleva] = useState({ diseno: true, produccion: true, instalacion: false })
  const [direccion, setDireccion] = useState('')

  useEffect(() => {
    if (!abierto) return
    setLleva({
      diseno: !p.etapas_omitidas.includes('en_diseno'),
      produccion: !p.etapas_omitidas.includes('en_produccion'),
      instalacion: !p.etapas_omitidas.includes('en_instalacion'),
    })
    setDireccion(p.direccion_instalacion ?? '')
  }, [abierto, p])

  // No se puede quitar la etapa en la que está el pedido
  const omitidas = omitidasPor(lleva)
  const quitaActual = omitidas.includes(p.estado)

  const guardar = async () => {
    try {
      await actualizar.mutateAsync({
        id: p.id,
        cambios: { etapas_omitidas: omitidas, requiere_instalacion: lleva.instalacion, ...(lleva.instalacion ? { direccion_instalacion: direccion } : {}) },
      })
      toast.success('Etapas actualizadas')
      onCambio(false)
    } catch {
      /* el hook ya muestra el error */
    }
  }

  return (
    <GlassModal
      abierto={abierto}
      onCambio={onCambio}
      titulo="Etapas que aplican"
      descripcion="Apaga lo que este trabajo no lleva; esas etapas se saltan al avanzar."
      ancho="sm"
      pie={
        <>
          <GlassButton variante="fantasma" onClick={() => onCambio(false)}>
            Cancelar
          </GlassButton>
          <GlassButton variante="primario" onClick={() => void guardar()} cargando={actualizar.isPending} disabled={quitaActual}>
            Guardar etapas
          </GlassButton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <Interruptor icono={<Brush />} titulo="Diseño" activo={lleva.diseno} onCambio={(v) => setLleva((x) => ({ ...x, diseno: v }))} />
          <Interruptor icono={<Hammer />} titulo="Taller" activo={lleva.produccion} onCambio={(v) => setLleva((x) => ({ ...x, produccion: v }))} />
          <Interruptor icono={<Truck />} titulo="Instalación" activo={lleva.instalacion} onCambio={(v) => setLleva((x) => ({ ...x, instalacion: v }))} />
        </div>
        {quitaActual ? <p className="text-sm font-medium text-warning">El pedido está en esa etapa: muévelo antes de quitarla.</p> : null}
        {lleva.instalacion ? (
          <Campo etiqueta="Dirección de la instalación" opcional>
            {(id, a) => <GlassTextarea id={id} {...a} rows={2} value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle, número, colonia y referencias" />}
          </Campo>
        ) : null}
      </div>
    </GlassModal>
  )
}

type Respuesta = 'aprobado' | 'cambios' | 'rechazado'

/** Respuesta del cliente a un diseño. La base mueve la etapa sola (aprobado o de regreso a diseño). */
export function DialogoAprobacion({ archivo, onCerrar, p }: { archivo: Archivo | null; onCerrar: () => void; p: PedidoDetalle }) {
  const registrar = useRegistrarAprobacion()
  const [estado, setEstado] = useState<Respuesta>('aprobado')
  const [nombre, setNombre] = useState('')
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!archivo) return
    setEstado('aprobado')
    setNombre(p.cliente_datos.nombre)
    setNotas('')
    setError(null)
  }, [archivo, p.cliente_datos.nombre])

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!archivo) return
    if (!nombre.trim()) {
      setError('Escribe quién respondió por parte del cliente')
      return
    }
    if (estado !== 'aprobado' && !notas.trim()) {
      setError(null)
      toast.error('Anota qué cambios pidió el cliente para que diseño los haga')
      return
    }
    try {
      await registrar.mutateAsync({ id: archivo.id, estado, nombre: nombre.trim(), notas: notas.trim() || null })
      toast.success(estado === 'aprobado' ? `Diseño v${archivo.version ?? ''} aprobado` : 'Respuesta registrada', {
        description: estado === 'aprobado' ? 'El pedido queda listo para producción.' : 'El pedido regresa a diseño.',
      })
      onCerrar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo registrar la respuesta. Inténtalo de nuevo.')
    }
  }

  return (
    <GlassModal
      abierto={archivo !== null}
      onCambio={(v) => !v && onCerrar()}
      titulo={archivo ? `Respuesta al diseño${archivo.version ? ` v${archivo.version}` : ''}` : 'Respuesta al diseño'}
      descripcion={archivo?.nombre}
      ancho="sm"
      pie={
        <>
          <GlassButton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </GlassButton>
          <GlassButton type="submit" form="form-aprobacion" variante={estado === 'aprobado' ? 'primario' : 'cristal'} cargando={registrar.isPending}>
            {estado === 'aprobado' ? 'Registrar aprobación' : estado === 'cambios' ? 'Registrar cambios' : 'Registrar rechazo'}
          </GlassButton>
        </>
      }
    >
      <form id="form-aprobacion" onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <SegmentedControl
          etiqueta="Respuesta del cliente"
          segmentos={[
            { valor: 'aprobado', etiqueta: 'Aprobado' },
            { valor: 'cambios', etiqueta: 'Pidió cambios' },
            { valor: 'rechazado', etiqueta: 'Rechazado' },
          ]}
          valor={estado}
          onCambio={setEstado}
          className="w-full"
        />
        <Campo etiqueta="¿Quién respondió?" error={error} ayuda="Nombre de la persona del cliente que dio la respuesta.">
          {(id, a) => <GlassInput id={id} {...a} value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" />}
        </Campo>
        <Campo etiqueta={estado === 'aprobado' ? 'Notas' : 'Cambios que pidió'} opcional={estado === 'aprobado'}>
          {(id, a) => (
            <GlassTextarea
              id={id}
              {...a}
              rows={3}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder={estado === 'aprobado' ? 'Ej. Aprobó por WhatsApp a las 12:30' : 'Ej. Logotipo más grande y cambiar el teléfono'}
            />
          )}
        </Campo>
      </form>
    </GlassModal>
  )
}

/** Liga a un original pesado (Drive, Dropbox, WeTransfer). */
export function DialogoEnlace({ abierto, onCambio, pedidoId }: { abierto: boolean; onCambio: (v: boolean) => void; pedidoId: string }) {
  const agregar = useAgregarEnlace()
  const [nombre, setNombre] = useState('')
  const [enlace, setEnlace] = useState('')
  const [categoria, setCategoria] = useState<CategoriaArchivo>('diseno')
  const [errores, setErrores] = useState<{ nombre?: string; enlace?: string }>({})

  useEffect(() => {
    if (!abierto) return
    setNombre('')
    setEnlace('')
    setCategoria('diseno')
    setErrores({})
  }, [abierto])

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const err: typeof errores = {}
    if (!nombre.trim()) err.nombre = 'Escribe un nombre para reconocer el archivo'
    if (!/^https?:\/\/\S+\.\S+/i.test(enlace.trim())) err.enlace = 'Pega el enlace completo, empezando con https://'
    setErrores(err)
    if (Object.keys(err).length) return
    try {
      await agregar.mutateAsync({ pedidoId, nombre: nombre.trim(), enlace: enlace.trim(), categoria })
      toast.success('Enlace agregado')
      onCambio(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo agregar el enlace')
    }
  }

  return (
    <GlassModal
      abierto={abierto}
      onCambio={onCambio}
      titulo="Agregar enlace"
      descripcion="Para originales pesados: deja el archivo en tu Drive y pega aquí el enlace compartido."
      ancho="sm"
      pie={
        <>
          <GlassButton variante="fantasma" onClick={() => onCambio(false)}>
            Cancelar
          </GlassButton>
          <GlassButton type="submit" form="form-enlace" variante="primario" icono={<Link2 />} cargando={agregar.isPending}>
            Agregar enlace
          </GlassButton>
        </>
      }
    >
      <form id="form-enlace" onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <Campo etiqueta="Nombre" error={errores.nombre}>
          {(id, a) => <GlassInput id={id} {...a} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Original de la lona (Illustrator)" />}
        </Campo>
        <Campo etiqueta="Enlace" error={errores.enlace}>
          {(id, a) => <GlassInput id={id} {...a} type="url" inputMode="url" value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder="https://drive.google.com/…" icono={<ExternalLink />} />}
        </Campo>
        <Campo etiqueta="Tipo">
          {(id, a) => (
            <GlassSelect id={id} {...a} value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaArchivo)}>
              <option value="diseno">Diseño (requiere aprobación)</option>
              <option value="referencia">Referencia del cliente</option>
              <option value="evidencia">Evidencia de entrega o instalación</option>
              <option value="otro">Otro</option>
            </GlassSelect>
          )}
        </Campo>
      </form>
    </GlassModal>
  )
}

const METODOS: Array<{ valor: MetodoCalculo; etiqueta: string; unidad: string }> = [
  { valor: 'pieza', etiqueta: 'Por pieza', unidad: 'pza' },
  { valor: 'm2', etiqueta: 'Por m²', unidad: 'pza' },
  { valor: 'metro_lineal', etiqueta: 'Por metro lineal', unidad: 'm' },
  { valor: 'millar', etiqueta: 'Por millar', unidad: 'millar' },
  { valor: 'hora', etiqueta: 'Por hora', unidad: 'hora' },
  { valor: 'servicio', etiqueta: 'Servicio', unidad: 'servicio' },
  { valor: 'proyecto', etiqueta: 'Proyecto', unidad: 'proyecto' },
]

const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))

/** Agregar o editar un concepto del pedido. El precio lo escribe ventas; no se calcula aquí. */
export function DialogoPartida({ abierto, onCambio, pedidoId, partida }: { abierto: boolean; onCambio: (v: boolean) => void; pedidoId: string; partida: PartidaPedido | null }) {
  const agregar = useAgregarPartida()
  const actualizar = useActualizarPartida()
  const [concepto, setConcepto] = useState('')
  const [metodo, setMetodo] = useState<MetodoCalculo>('pieza')
  const [ancho, setAncho] = useState('')
  const [alto, setAlto] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [precio, setPrecio] = useState('')
  const [notas, setNotas] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!abierto) return
    setConcepto(partida?.concepto ?? '')
    setMetodo(partida?.metodo_calculo ?? 'pieza')
    setAncho(partida?.ancho != null ? String(partida.ancho) : '')
    setAlto(partida?.alto != null ? String(partida.alto) : '')
    setCantidad(partida ? String(partida.cantidad) : '1')
    setPrecio(partida?.precio_unitario != null ? String(partida.precio_unitario) : '')
    setNotas(partida?.notas_produccion ?? '')
    setErrores({})
  }, [abierto, partida])

  const m2 = metodo === 'm2'
  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const err: Record<string, string> = {}
    const c = num(cantidad)
    const pu = num(precio)
    const an = num(ancho)
    const al = num(alto)
    if (!concepto.trim()) err.concepto = 'Describe el concepto, por ejemplo “Lona impresa 13 oz”'
    if (!c || c <= 0 || Number.isNaN(c)) err.cantidad = 'La cantidad debe ser mayor a cero'
    if (pu === null || Number.isNaN(pu) || pu < 0) err.precio = 'Escribe el precio unitario acordado con el cliente'
    if (m2 && (!an || !al || an <= 0 || al <= 0)) err.medidas = 'Escribe ancho y alto en metros'
    setErrores(err)
    if (Object.keys(err).length) return
    const datos = {
      concepto: concepto.trim(),
      metodo_calculo: metodo,
      unidad: METODOS.find((x) => x.valor === metodo)?.unidad ?? 'pza',
      ancho: m2 ? an : null,
      alto: m2 ? al : null,
      cantidad: c!,
      precio_unitario: pu!,
      notas_produccion: notas.trim() || null,
    }
    try {
      if (partida) await actualizar.mutateAsync({ id: partida.id, cambios: datos })
      else await agregar.mutateAsync({ pedidoId, partida: datos })
      toast.success(partida ? 'Concepto actualizado' : 'Concepto agregado')
      onCambio(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el concepto')
    }
  }

  return (
    <GlassModal
      abierto={abierto}
      onCambio={onCambio}
      titulo={partida ? 'Editar concepto' : 'Agregar concepto'}
      descripcion="Escribe el precio acordado con el cliente. El total del pedido se recalcula solo."
      pie={
        <>
          <GlassButton variante="fantasma" onClick={() => onCambio(false)}>
            Cancelar
          </GlassButton>
          <GlassButton type="submit" form="form-partida" variante="primario" cargando={agregar.isPending || actualizar.isPending}>
            {partida ? 'Guardar concepto' : 'Agregar concepto'}
          </GlassButton>
        </>
      }
    >
      <form id="form-partida" onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <Campo etiqueta="Concepto" error={errores.concepto}>
          {(id, a) => <GlassInput id={id} {...a} value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej. Lona impresa 13 oz con ojillos" maxLength={160} />}
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Cómo se cobra">
            {(id, a) => (
              <GlassSelect id={id} {...a} value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoCalculo)}>
                {METODOS.map((x) => (
                  <option key={x.valor} value={x.valor}>
                    {x.etiqueta}
                  </option>
                ))}
              </GlassSelect>
            )}
          </Campo>
          <Campo etiqueta="Cantidad" error={errores.cantidad}>
            {(id, a) => <GlassInput id={id} {...a} inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="num" />}
          </Campo>
        </div>
        {m2 ? (
          <div className="grid grid-cols-2 gap-4">
            <Campo etiqueta="Ancho" error={errores.medidas}>
              {(id, a) => <GlassInput id={id} {...a} inputMode="decimal" value={ancho} onChange={(e) => setAncho(e.target.value)} sufijo="m" className="num" />}
            </Campo>
            <Campo etiqueta="Alto">
              {(id, a) => <GlassInput id={id} {...a} inputMode="decimal" value={alto} onChange={(e) => setAlto(e.target.value)} sufijo="m" className="num" />}
            </Campo>
          </div>
        ) : null}
        <Campo etiqueta={m2 ? 'Precio por pieza (ya con sus m²)' : 'Precio unitario'} error={errores.precio} ayuda="Sin IVA; el IVA se agrega en el total.">
          {(id, a) => <GlassInput id={id} {...a} inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} icono={<span className="text-sm font-semibold">$</span>} className="num" />}
        </Campo>
        <Campo etiqueta="Notas de producción" opcional>
          {(id, a) => <GlassTextarea id={id} {...a} rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. Ojillos cada 50 cm, dobladillo perimetral" />}
        </Campo>
      </form>
    </GlassModal>
  )
}
