import { Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useEquipo } from '@/app/consultas'
import { useSesion } from '@/app/sesion'
import { Campo, GlassButton, GlassInput, GlassModal, GlassSelect, GlassTextarea } from '@/components/glass'
import { TIPOS_TAREA, type DatosTarea, type Prioridad, type TipoTarea } from '@/data/modulos/agenda/contrato'
import { useActualizarTarea, useCrearTarea, useEliminarTarea } from './consultas'
import { Ligar, type Ligado } from './Ligar'
import { Atajos } from './CapturaRapida'

export interface BorradorTarea {
  id?: string
  titulo: string
  descripcion?: string | null
  tipo: TipoTarea
  fecha: string
  hora?: string | null
  responsable_id: string | null
  prioridad: Prioridad
  cliente?: Ligado | null
  pedido?: Ligado | null
  creada_por?: string | null
}

const PRIORIDADES: Record<Prioridad, string> = {
  baja: 'Baja',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
}

/** Crear con todos los detalles o editar una tarea. */
export function TareaModal({ borrador, onCerrar, hoy }: { borrador: BorradorTarea | null; onCerrar: () => void; hoy: string }) {
  return (
    <GlassModal abierto={Boolean(borrador)} onCambio={(v) => !v && onCerrar()} titulo={borrador?.id ? 'Editar tarea' : 'Nueva tarea'} ancho="md">
      {borrador ? <Formulario key={borrador.id ?? 'nueva'} inicial={borrador} onListo={onCerrar} hoy={hoy} /> : null}
    </GlassModal>
  )
}

function Formulario({ inicial, onListo, hoy }: { inicial: BorradorTarea; onListo: () => void; hoy: string }) {
  const { sesion, puede } = useSesion()
  const equipo = useEquipo()
  const [b, setB] = useState(inicial)
  const [error, setError] = useState<string | null>(null)
  const crear = useCrearTarea()
  const actualizar = useActualizarTarea()
  const eliminar = useEliminarTarea()
  const ocupado = crear.isPending || actualizar.isPending || eliminar.isPending
  const yo = sesion?.perfil.id
  // La base exige autor o administración; si no, el aviso de error lo explica
  const puedeEliminar = Boolean(inicial.id)
  const verPedidos = puede('ver_precios')
  const set = <K extends keyof BorradorTarea>(k: K, v: BorradorTarea[K]) => setB((x) => ({ ...x, [k]: v }))

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!b.titulo.trim()) return setError('Escribe qué hay que hacer, por ejemplo "Llamar a Juan para confirmar medidas".')
    if (!b.fecha) return setError('Elige la fecha de la tarea.')
    setError(null)
    const datos: DatosTarea = {
      titulo: b.titulo,
      descripcion: b.descripcion ?? null,
      tipo: b.tipo,
      fecha: b.fecha,
      hora: b.hora || null,
      responsable_id: b.responsable_id,
      prioridad: b.prioridad,
      cliente_id: b.cliente?.id ?? null,
      ...(verPedidos ? { pedido_id: b.pedido?.id ?? null } : {}),
    }
    if (b.id) await actualizar.mutateAsync({ id: b.id, cambios: datos })
    else await crear.mutateAsync(datos)
    onListo()
  }

  return (
    <form onSubmit={(e) => void enviar(e).catch(() => {})} className="flex flex-col gap-4" noValidate>
      <Campo etiqueta="Qué hay que hacer" error={error ?? undefined}>
        {(id, p) => <GlassInput id={id} {...p} value={b.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Llamar a…" maxLength={200} autoFocus />}
      </Campo>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-fg">Cuándo</span>
        <div className="flex flex-wrap items-center gap-2">
          <Atajos hoy={hoy} valor={b.fecha} onCambio={(f) => set('fecha', f)} />
          <GlassInput type="date" value={b.fecha} onChange={(e) => set('fecha', e.target.value)} aria-label="Fecha" className="w-auto" />
          <GlassInput type="time" value={b.hora ?? ''} onChange={(e) => set('hora', e.target.value || null)} aria-label="Hora (opcional)" className="w-auto" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo etiqueta="Tipo">
          {(id, p) => (
            <GlassSelect id={id} {...p} value={b.tipo} onChange={(e) => set('tipo', e.target.value as TipoTarea)}>
              {Object.entries(TIPOS_TAREA).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </GlassSelect>
          )}
        </Campo>
        <Campo etiqueta="Responsable">
          {(id, p) => (
            <GlassSelect id={id} {...p} value={b.responsable_id ?? ''} onChange={(e) => set('responsable_id', e.target.value || null)}>
              {(equipo.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === yo ? `${m.nombre} (yo)` : m.nombre}
                </option>
              ))}
            </GlassSelect>
          )}
        </Campo>
        <Campo etiqueta="Prioridad">
          {(id, p) => (
            <GlassSelect id={id} {...p} value={b.prioridad} onChange={(e) => set('prioridad', e.target.value as Prioridad)}>
              {Object.entries(PRIORIDADES).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </GlassSelect>
          )}
        </Campo>
      </div>
      <Campo etiqueta="Cliente" opcional>
        {(id, p) => <Ligar id={id} {...p} tipo="cliente" etiqueta="Cliente" valor={b.cliente ?? null} onCambio={(v) => set('cliente', v)} />}
      </Campo>
      {verPedidos ? (
        <Campo etiqueta="Pedido" opcional ayuda="Si eliges un pedido, el cliente se toma de ahí.">
          {(id, p) => <Ligar id={id} {...p} tipo="pedido" etiqueta="Pedido" valor={b.pedido ?? null} onCambio={(v) => set('pedido', v)} />}
        </Campo>
      ) : null}
      <Campo etiqueta="Notas" opcional>
        {(id, p) => <GlassTextarea id={id} {...p} value={b.descripcion ?? ''} onChange={(e) => set('descripcion', e.target.value)} rows={2} />}
      </Campo>
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--divider)] pt-4">
        {puedeEliminar ? (
          <GlassButton
            type="button"
            variante="fantasma"
            icono={<Trash2 />}
            disabled={ocupado}
            onClick={() => {
              if (window.confirm('¿Eliminar esta tarea? No se puede deshacer.')) eliminar.mutate(b.id!, { onSuccess: onListo })
            }}
          >
            Eliminar
          </GlassButton>
        ) : null}
        <GlassButton type="button" variante="cristal" className="ml-auto" onClick={onListo} disabled={ocupado}>
          Cancelar
        </GlassButton>
        <GlassButton type="submit" variante="primario" disabled={ocupado}>
          {b.id ? 'Guardar tarea' : 'Agregar tarea'}
        </GlassButton>
      </div>
    </form>
  )
}
