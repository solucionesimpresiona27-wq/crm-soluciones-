import { Star } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Campo, GlassButton, GlassInput, GlassModal, GlassToggle } from '@/components/glass'
import type { Contacto, DatosContacto } from '@/data/modulos/clientes/contrato'
import { useGuardarContacto } from '../consultas'
import { enfocarPrimerError, validarCorreo, validarTelefono } from '../validacion'

/** Alta o edición de un contacto de la empresa. */
export function ContactoModal({
  abierto,
  onCambio,
  clienteId,
  contacto,
  esPrimero,
}: {
  abierto: boolean
  onCambio: (v: boolean) => void
  clienteId: string
  contacto: Contacto | null
  esPrimero: boolean
}) {
  const guardar = useGuardarContacto(clienteId)
  const [d, setD] = useState<DatosContacto>({ nombre: '' })
  const [errores, setErrores] = useState<Partial<Record<keyof DatosContacto, string>>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!abierto) return
    setD(
      contacto
        ? { nombre: contacto.nombre, puesto: contacto.puesto ?? '', whatsapp: contacto.whatsapp ?? '', telefono: contacto.telefono ?? '', email: contacto.email ?? '', principal: contacto.principal }
        : { nombre: '', puesto: '', whatsapp: '', telefono: '', email: '', principal: esPrimero },
    )
    setErrores({})
    setError(null)
  }, [abierto, contacto, esPrimero])

  const set = <K extends keyof DatosContacto>(k: K, v: DatosContacto[K]) => {
    setD((x) => ({ ...x, [k]: v }))
    setErrores((e) => ({ ...e, [k]: undefined }))
  }

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault()
    const e: typeof errores = {}
    if (!d.nombre.trim()) e.nombre = 'Escribe el nombre del contacto'
    const w = validarTelefono(d.whatsapp)
    if (w) e.whatsapp = w
    const c = validarCorreo(d.email)
    if (c) e.email = c
    setErrores(e)
    if (Object.values(e).some(Boolean)) return enfocarPrimerError('form-contacto')
    try {
      await guardar.mutateAsync({ id: contacto?.id, datos: d })
      toast.success(contacto ? 'Contacto actualizado' : `Contacto ${d.nombre.trim()} agregado`)
      onCambio(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el contacto. Inténtalo de nuevo.')
    }
  }

  return (
    <GlassModal
      abierto={abierto}
      onCambio={onCambio}
      ancho="sm"
      titulo={contacto ? 'Editar contacto' : 'Nuevo contacto'}
      descripcion="La persona con quien tratas en la empresa: compras, gerencia, diseño…"
      pie={
        <>
          <GlassButton variante="fantasma" onClick={() => onCambio(false)}>
            Cancelar
          </GlassButton>
          <GlassButton variante="primario" type="submit" form="form-contacto" cargando={guardar.isPending}>
            {contacto ? 'Guardar contacto' : 'Agregar contacto'}
          </GlassButton>
        </>
      }
    >
      <form id="form-contacto" onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre" error={errores.nombre}>
            {(id, a) => <GlassInput id={id} {...a} value={d.nombre} onChange={(e) => set('nombre', e.target.value)} autoComplete="off" autoFocus />}
          </Campo>
          <Campo etiqueta="Puesto" opcional>
            {(id, a) => <GlassInput id={id} {...a} value={d.puesto ?? ''} onChange={(e) => set('puesto', e.target.value)} placeholder="Compras" autoComplete="off" />}
          </Campo>
          <Campo etiqueta="WhatsApp" opcional error={errores.whatsapp}>
            {(id, a) => <GlassInput id={id} {...a} value={d.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} inputMode="tel" placeholder="33 1234 5678" autoComplete="off" />}
          </Campo>
          <Campo etiqueta="Correo" opcional error={errores.email}>
            {(id, a) => <GlassInput id={id} {...a} type="email" value={d.email ?? ''} onChange={(e) => set('email', e.target.value)} autoComplete="off" />}
          </Campo>
        </div>
        <GlassToggle
          icono={<Star />}
          titulo="Contacto principal"
          subtitulo="Aparece en la lista y en los documentos"
          activo={Boolean(d.principal)}
          onCambio={(v) => set('principal', v)}
        />
        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
      </form>
    </GlassModal>
  )
}
