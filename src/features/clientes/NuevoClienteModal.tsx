import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, User } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Campo, GlassButton, GlassInput, GlassModal, SegmentedControl } from '@/components/glass'
import { api } from '@/data/api'
import type { ClienteBreve } from '@/data/tipos'

interface Props {
  abierto: boolean
  onCambio: (abierto: boolean) => void
  nombreInicial?: string
  onCreado?: (cliente: ClienteBreve) => void
}

/** Alta rápida de cliente: nombre y WhatsApp bastan; lo demás se completa después. */
export function NuevoClienteModal({ abierto, onCambio, nombreInicial = '', onCreado }: Props) {
  const qc = useQueryClient()
  const [tipo, setTipo] = useState<'empresa' | 'persona'>('empresa')
  const [nombre, setNombre] = useState(nombreInicial)
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [factura, setFactura] = useState(false)
  const [rfc, setRfc] = useState('')
  const [razon, setRazon] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (abierto) {
      setNombre(nombreInicial)
      setError(null)
    }
  }, [abierto, nombreInicial])

  const crear = useMutation({
    mutationFn: () =>
      api.clientes.crear({
        nombre,
        whatsapp,
        email,
        tipo,
        requiere_factura: factura,
        rfc: factura ? rfc : undefined,
        razon_social: factura ? razon : undefined,
      }),
    onSuccess: (c) => {
      toast.success(`Cliente ${c.nombre} creado`)
      void qc.invalidateQueries({ queryKey: ['clientes'] })
      onCreado?.(c)
      setWhatsapp('')
      setEmail('')
      setRfc('')
      setRazon('')
      setFactura(false)
      onCambio(false)
    },
    onError: (e: Error) => setError(e.message),
  })

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) {
      setError('Escribe el nombre del cliente')
      return
    }
    const tel = whatsapp.replace(/\D/g, '')
    if (whatsapp && tel.length < 10) {
      setError('El WhatsApp debe tener 10 dígitos')
      return
    }
    setError(null)
    crear.mutate()
  }

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
      <form id="form-nuevo-cliente" onSubmit={enviar} className="flex flex-col gap-4">
        <SegmentedControl
          etiqueta="Tipo de cliente"
          valor={tipo}
          onCambio={setTipo}
          segmentos={[
            { valor: 'empresa', etiqueta: <><Building2 className="size-4" /> Empresa</> },
            { valor: 'persona', etiqueta: <><User className="size-4" /> Persona</> },
          ]}
        />
        <Campo etiqueta={tipo === 'empresa' ? 'Nombre comercial' : 'Nombre completo'} error={error && !nombre.trim() ? error : null}>
          {(id, a) => <GlassInput id={id} {...a} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus autoComplete="off" />}
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="WhatsApp" opcional>
            {(id, a) => <GlassInput id={id} {...a} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" placeholder="33 1234 5678" autoComplete="off" />}
          </Campo>
          <Campo etiqueta="Correo" opcional>
            {(id, a) => <GlassInput id={id} {...a} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />}
          </Campo>
        </div>
        <label className="flex cursor-pointer items-center gap-3 text-sm text-fg">
          <input type="checkbox" checked={factura} onChange={(e) => setFactura(e.target.checked)} className="size-4 accent-[rgb(var(--accent))]" />
          Requiere factura
        </label>
        {factura ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="RFC" opcional>
              {(id, a) => <GlassInput id={id} {...a} value={rfc} onChange={(e) => setRfc(e.target.value.toUpperCase())} maxLength={13} autoComplete="off" />}
            </Campo>
            <Campo etiqueta="Razón social" opcional>
              {(id, a) => <GlassInput id={id} {...a} value={razon} onChange={(e) => setRazon(e.target.value)} autoComplete="off" />}
            </Campo>
          </div>
        ) : null}
        {error && nombre.trim() ? <p className="text-sm font-medium text-danger">{error}</p> : null}
      </form>
    </GlassModal>
  )
}
