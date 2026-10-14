import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, FileText, User } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Campo, GlassButton, GlassInput, GlassModal, GlassToggle, SegmentedControl } from '@/components/glass'
import { api } from '@/data/api'
import type { ClienteBreve } from '@/data/tipos'
import { validarCorreo, validarRfc, validarTelefono } from './validacion'

interface Props {
  abierto: boolean
  onCambio: (abierto: boolean) => void
  nombreInicial?: string
  onCreado?: (cliente: ClienteBreve) => void
}

type Errores = Partial<Record<'nombre' | 'whatsapp' | 'email' | 'rfc' | 'contacto', string>>

/**
 * Alta rápida de cliente: nombre y WhatsApp bastan; lo demás se completa después en la ficha.
 * En empresas se puede capturar de una vez a la persona de contacto (queda como principal).
 * Lo usan la lista de clientes y el editor de cotizaciones.
 */
export function NuevoClienteModal({ abierto, onCambio, nombreInicial = '', onCreado }: Props) {
  const qc = useQueryClient()
  const [tipo, setTipo] = useState<'empresa' | 'persona'>('empresa')
  const [nombre, setNombre] = useState(nombreInicial)
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [contacto, setContacto] = useState('')
  const [puesto, setPuesto] = useState('')
  const [factura, setFactura] = useState(false)
  const [rfc, setRfc] = useState('')
  const [razon, setRazon] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (abierto) {
      setNombre(nombreInicial)
      setErrores({})
      setError(null)
    }
  }, [abierto, nombreInicial])

  const limpiar = () => {
    setWhatsapp('')
    setEmail('')
    setContacto('')
    setPuesto('')
    setRfc('')
    setRazon('')
    setFactura(false)
  }

  const crear = useMutation({
    mutationFn: async () => {
      const c = await api.clientes.crear({
        nombre,
        whatsapp,
        email,
        tipo,
        requiere_factura: factura,
        rfc: factura ? rfc : undefined,
        razon_social: factura ? razon : undefined,
      })
      let errorContacto: string | null = null
      if (tipo === 'empresa' && contacto.trim()) {
        try {
          await api.contactos.crear(c.id, { nombre: contacto, puesto, whatsapp, email, principal: true })
        } catch (e) {
          errorContacto = e instanceof Error ? e.message : 'No se pudo guardar el contacto'
        }
      }
      return { c, errorContacto }
    },
    onSuccess: ({ c, errorContacto }) => {
      toast.success(`Cliente ${c.nombre} creado`)
      if (errorContacto) toast.error(`El contacto no se guardó: ${errorContacto}. Agrégalo desde la ficha del cliente.`)
      void qc.invalidateQueries({ queryKey: ['clientes'] })
      onCreado?.(c)
      limpiar()
      onCambio(false)
    },
    onError: (e: Error) => setError(e.message),
  })

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    const errs: Errores = {}
    if (!nombre.trim()) errs.nombre = 'Escribe el nombre del cliente'
    const w = validarTelefono(whatsapp)
    if (w) errs.whatsapp = w
    const c = validarCorreo(email)
    if (c) errs.email = c
    if (factura) {
      const r = validarRfc(rfc)
      if (r) errs.rfc = r
    }
    setErrores(errs)
    if (Object.values(errs).some(Boolean)) return
    setError(null)
    crear.mutate()
  }

  const quitar = (k: keyof Errores) => errores[k] && setErrores((x) => ({ ...x, [k]: undefined }))

  return (
    <GlassModal
      abierto={abierto}
      onCambio={onCambio}
      titulo="Nuevo cliente"
      descripcion="Con el nombre y el WhatsApp ya puedes cotizar. Los demás datos se completan después."
      ancho="sm"
      pie={
        <>
          <GlassButton variante="fantasma" onClick={() => onCambio(false)}>
            Cancelar
          </GlassButton>
          <GlassButton variante="primario" type="submit" form="form-nuevo-cliente" cargando={crear.isPending}>
            Crear cliente
          </GlassButton>
        </>
      }
    >
      <form id="form-nuevo-cliente" onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <SegmentedControl
          etiqueta="Tipo de cliente"
          valor={tipo}
          onCambio={setTipo}
          className="w-full [&>*]:flex-1"
          segmentos={[
            { valor: 'empresa', etiqueta: <><Building2 className="size-4" /> Empresa</> },
            { valor: 'persona', etiqueta: <><User className="size-4" /> Persona</> },
          ]}
        />
        <Campo etiqueta={tipo === 'empresa' ? 'Nombre comercial' : 'Nombre completo'} error={errores.nombre}>
          {(id, a) => (
            <GlassInput
              id={id}
              {...a}
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value)
                quitar('nombre')
              }}
              autoFocus
              autoComplete="off"
            />
          )}
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="WhatsApp" opcional error={errores.whatsapp}>
            {(id, a) => (
              <GlassInput
                id={id}
                {...a}
                value={whatsapp}
                onChange={(e) => {
                  setWhatsapp(e.target.value)
                  quitar('whatsapp')
                }}
                inputMode="tel"
                placeholder="33 1234 5678"
                autoComplete="off"
              />
            )}
          </Campo>
          <Campo etiqueta="Correo" opcional error={errores.email}>
            {(id, a) => (
              <GlassInput
                id={id}
                {...a}
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  quitar('email')
                }}
                autoComplete="off"
              />
            )}
          </Campo>
        </div>
        {tipo === 'empresa' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Persona de contacto" opcional>
              {(id, a) => <GlassInput id={id} {...a} value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Con quién tratas" autoComplete="off" />}
            </Campo>
            <Campo etiqueta="Puesto" opcional>
              {(id, a) => <GlassInput id={id} {...a} value={puesto} onChange={(e) => setPuesto(e.target.value)} placeholder="Compras, gerencia…" autoComplete="off" disabled={!contacto.trim()} />}
            </Campo>
          </div>
        ) : null}
        <GlassToggle
          icono={<FileText />}
          titulo="Requiere factura"
          subtitulo={factura ? 'Captura RFC y razón social' : 'Se puede activar después'}
          activo={factura}
          onCambio={setFactura}
          tono="acento"
        />
        {factura ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="RFC" opcional error={errores.rfc}>
              {(id, a) => (
                <GlassInput
                  id={id}
                  {...a}
                  value={rfc}
                  onChange={(e) => {
                    setRfc(e.target.value.toUpperCase().replace(/\s/g, ''))
                    quitar('rfc')
                  }}
                  maxLength={13}
                  className="num"
                  autoComplete="off"
                />
              )}
            </Campo>
            <Campo etiqueta="Razón social" opcional>
              {(id, a) => <GlassInput id={id} {...a} value={razon} onChange={(e) => setRazon(e.target.value)} autoComplete="off" />}
            </Campo>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
      </form>
    </GlassModal>
  )
}
