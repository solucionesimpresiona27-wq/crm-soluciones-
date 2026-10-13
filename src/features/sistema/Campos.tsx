import { Building2, Mail, Phone, Save } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Campo, GlassButton, GlassInput, GlassPanel, GlassSelect, GlassTextarea } from '@/components/glass'

const correoValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())

/** Formulario de ejemplo sobre cristal fuerte: ayuda, error y campo bloqueado. */
export function MuestrarioCampos() {
  const [correo, setCorreo] = useState('compras@grupoaltamira')
  const refCorreo = useRef<HTMLInputElement>(null)
  const errorCorreo = correoValido(correo) ? null : 'Falta el dominio del correo. Ejemplo: compras@grupoaltamira.com'

  const guardar = (e: FormEvent) => {
    e.preventDefault()
    if (errorCorreo) {
      refCorreo.current?.focus()
      return
    }
    toast('Formulario de ejemplo', { description: 'Todo está correcto. En la vitrina no se guarda nada.' })
  }

  return (
    <GlassPanel className="h-full p-4 sm:p-6">
      <form onSubmit={guardar} noValidate className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Cliente" ayuda="Escribe al menos 3 letras para buscarlo." className="sm:col-span-2">
          {(id, a) => <GlassInput id={id} {...a} icono={<Building2 />} placeholder="Nombre o razón social" autoComplete="off" />}
        </Campo>
        <Campo etiqueta="Correo" error={errorCorreo}>
          {(id, a) => (
            <GlassInput
              ref={refCorreo}
              id={id}
              {...a}
              type="email"
              inputMode="email"
              icono={<Mail />}
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              autoComplete="off"
            />
          )}
        </Campo>
        <Campo etiqueta="WhatsApp" ayuda="10 dígitos, sin lada internacional.">
          {(id, a) => <GlassInput id={id} {...a} type="tel" inputMode="tel" icono={<Phone />} defaultValue="33 1234 5678" />}
        </Campo>
        <Campo etiqueta="Material">
          {(id, a) => (
            <GlassSelect id={id} {...a} defaultValue="lona">
              <option value="lona">Lona front 13 oz</option>
              <option value="vinil">Vinil adhesivo brillante</option>
              <option value="coroplast">Coroplast 4 mm</option>
              <option value="estireno">Estireno calibre 40</option>
            </GlassSelect>
          )}
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Ancho">
            {(id, a) => <GlassInput id={id} {...a} inputMode="decimal" defaultValue="3.00" sufijo="m" className="num" />}
          </Campo>
          <Campo etiqueta="Alto">
            {(id, a) => <GlassInput id={id} {...a} inputMode="decimal" defaultValue="1.50" sufijo="m" className="num" />}
          </Campo>
        </div>
        <Campo etiqueta="Precio por m²" ayuda="Antes de IVA.">
          {(id, a) => <GlassInput id={id} {...a} inputMode="decimal" defaultValue="185.00" sufijo="MXN" className="num pr-14" />}
        </Campo>
        <Campo etiqueta="Folio" ayuda="Se asigna al guardar.">
          {(id, a) => <GlassInput id={id} {...a} value="COT-0142" disabled readOnly className="num" />}
        </Campo>
        <Campo etiqueta="Notas" opcional ayuda="Aparecen al pie de la cotización." className="sm:col-span-2">
          {(id, a) => <GlassTextarea id={id} {...a} placeholder="Instalación incluida en la zona metropolitana de Guadalajara." />}
        </Campo>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--divider)] pt-4 sm:col-span-2">
          <GlassButton variante="fantasma" type="reset" onClick={() => setCorreo('compras@grupoaltamira')}>
            Descartar
          </GlassButton>
          <GlassButton variante="primario" type="submit" icono={<Save />}>
            Guardar cotización
          </GlassButton>
        </div>
      </form>
    </GlassPanel>
  )
}
