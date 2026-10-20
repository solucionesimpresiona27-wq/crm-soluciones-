import { Building2, FileText, User, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useEquipo } from '@/app/consultas'
import { Campo, GlassButton, GlassInput, GlassModal, GlassSelect, GlassToggle, SegmentedControl } from '@/components/glass'
import type { Cliente, DatosCliente, TipoCliente } from '@/data/modulos/clientes/contrato'
import { useActualizarCliente, useEtiquetas } from '../consultas'
import { enfocarPrimerError, validarCodigoPostal, validarCorreo, validarRfc, validarTelefono } from '../validacion'

export const REGIMENES = [
  '601 General de Ley Personas Morales',
  '603 Personas Morales con Fines no Lucrativos',
  '605 Sueldos y Salarios',
  '606 Arrendamiento',
  '612 Personas Físicas con Actividades Empresariales y Profesionales',
  '616 Sin obligaciones fiscales',
  '621 Incorporación Fiscal',
  '625 Plataformas Tecnológicas',
  '626 Régimen Simplificado de Confianza',
]

export const USOS_CFDI: Record<string, string> = {
  G01: 'Adquisición de mercancías',
  G03: 'Gastos en general',
  I08: 'Otra maquinaria y equipo',
  S01: 'Sin efectos fiscales',
  CP01: 'Pagos',
}

export type SeccionEdicion = 'general' | 'fiscal'

type Errores = Partial<Record<keyof DatosCliente, string>>

/** Edición del cliente por secciones (generales o fiscales) en un cajón lateral / hoja en celular. */
export function EditarClienteModal({ abierto, onCambio, cliente, seccion }: { abierto: boolean; onCambio: (v: boolean) => void; cliente: Cliente; seccion: SeccionEdicion }) {
  const actualizar = useActualizarCliente(cliente.id)
  const equipo = useEquipo()
  const sugerencias = useEtiquetas()
  const [d, setD] = useState<DatosCliente>({ nombre: '' })
  const [etiquetaNueva, setEtiquetaNueva] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

  useEffect(() => {
    if (!abierto) return
    setD({
      nombre: cliente.nombre,
      tipo: (cliente.tipo as TipoCliente) ?? 'empresa',
      whatsapp: cliente.whatsapp ?? '',
      telefono: cliente.telefono ?? '',
      email: cliente.email ?? '',
      direccion: cliente.direccion ?? '',
      ciudad: cliente.ciudad ?? '',
      origen: cliente.origen ?? '',
      etiquetas: [...cliente.etiquetas],
      dias_credito: cliente.dias_credito,
      vendedor_id: cliente.vendedor_id,
      requiere_factura: cliente.requiere_factura,
      rfc: cliente.rfc ?? '',
      razon_social: cliente.razon_social ?? '',
      regimen_fiscal: cliente.regimen_fiscal ?? '',
      codigo_postal_fiscal: cliente.codigo_postal_fiscal ?? '',
      uso_cfdi: cliente.uso_cfdi ?? '',
      email_facturacion: cliente.email_facturacion ?? '',
    })
    setErrores({})
    setErrorGeneral(null)
    setEtiquetaNueva('')
  }, [abierto, cliente])

  const set = <K extends keyof DatosCliente>(k: K, v: DatosCliente[K]) => {
    setD((x) => ({ ...x, [k]: v }))
    if (errores[k]) setErrores((e) => ({ ...e, [k]: undefined }))
  }

  const agregarEtiqueta = (t: string) => {
    const v = t.trim().replace(/,$/, '').trim()
    if (!v) return
    if (!(d.etiquetas ?? []).some((e) => e.toLowerCase() === v.toLowerCase())) set('etiquetas', [...(d.etiquetas ?? []), v])
    setEtiquetaNueva('')
  }

  const validar = (): Errores => {
    const e: Errores = {}
    if (seccion === 'general') {
      if (!d.nombre.trim()) e.nombre = 'Escribe el nombre del cliente'
      const w = validarTelefono(d.whatsapp)
      if (w) e.whatsapp = w
      const t = validarTelefono(d.telefono, 'El teléfono')
      if (t) e.telefono = t
      const c = validarCorreo(d.email)
      if (c) e.email = c
      if ((d.dias_credito ?? 0) < 0 || (d.dias_credito ?? 0) > 365) e.dias_credito = 'Los días de crédito van de 0 a 365'
    } else {
      const r = validarRfc(d.rfc)
      if (r) e.rfc = r
      const cp = validarCodigoPostal(d.codigo_postal_fiscal)
      if (cp) e.codigo_postal_fiscal = cp
      const c = validarCorreo(d.email_facturacion, 'El correo de facturación')
      if (c) e.email_facturacion = c
      if (d.requiere_factura && !(d.rfc ?? '').trim()) e.rfc = 'Para facturar se necesita el RFC'
    }
    return e
  }

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault()
    const e = validar()
    setErrores(e)
    if (Object.values(e).some(Boolean)) {
      setErrorGeneral('Revisa los campos marcados en rojo.')
      enfocarPrimerError('form-editar-cliente')
      return
    }
    setErrorGeneral(null)
    const cambios: Partial<DatosCliente> =
      seccion === 'general'
        ? {
            nombre: d.nombre,
            tipo: d.tipo,
            whatsapp: d.whatsapp,
            telefono: d.telefono,
            email: d.email,
            direccion: d.direccion,
            ciudad: d.ciudad,
            origen: d.origen,
            etiquetas: etiquetaNueva.trim() ? [...(d.etiquetas ?? []), etiquetaNueva.trim()] : d.etiquetas,
            dias_credito: d.dias_credito,
            vendedor_id: d.vendedor_id || null,
          }
        : {
            requiere_factura: d.requiere_factura,
            rfc: d.rfc,
            razon_social: d.razon_social,
            regimen_fiscal: d.regimen_fiscal,
            codigo_postal_fiscal: d.codigo_postal_fiscal,
            uso_cfdi: d.uso_cfdi,
            email_facturacion: d.email_facturacion,
          }
    try {
      await actualizar.mutateAsync(cambios)
      toast.success(seccion === 'general' ? 'Datos del cliente guardados' : 'Datos fiscales guardados')
      onCambio(false)
    } catch (err) {
      setErrorGeneral(err instanceof Error ? err.message : 'No se pudieron guardar los cambios. Inténtalo de nuevo.')
    }
  }

  const libres = (sugerencias.data ?? []).filter((s) => !(d.etiquetas ?? []).includes(s)).slice(0, 8)
  const vendedores = (equipo.data ?? []).filter((m) => m.rol === 'admin' || m.rol === 'ventas')

  return (
    <GlassModal
      abierto={abierto}
      onCambio={onCambio}
      lateral
      ancho="md"
      titulo={seccion === 'general' ? 'Editar cliente' : 'Datos fiscales'}
      descripcion={seccion === 'general' ? cliente.nombre : 'Se usan para facturar. Copia los datos tal como vienen en la constancia de situación fiscal.'}
      pie={
        <>
          <GlassButton variante="fantasma" onClick={() => onCambio(false)}>
            Cancelar
          </GlassButton>
          <GlassButton variante="primario" type="submit" form="form-editar-cliente" cargando={actualizar.isPending}>
            {seccion === 'general' ? 'Guardar cambios' : 'Guardar datos fiscales'}
          </GlassButton>
        </>
      }
    >
      <form id="form-editar-cliente" onSubmit={enviar} noValidate className="flex flex-col gap-4">
        {seccion === 'general' ? (
          <>
            <SegmentedControl
              etiqueta="Tipo de cliente"
              className="w-full [&>*]:flex-1"
              valor={d.tipo ?? 'empresa'}
              onCambio={(v) => set('tipo', v)}
              segmentos={[
                { valor: 'empresa', etiqueta: <><Building2 className="size-4" /> Empresa</> },
                { valor: 'persona', etiqueta: <><User className="size-4" /> Persona</> },
              ]}
            />
            <Campo etiqueta={d.tipo === 'persona' ? 'Nombre completo' : 'Nombre comercial'} error={errores.nombre}>
              {(id, a) => <GlassInput id={id} {...a} value={d.nombre} onChange={(e) => set('nombre', e.target.value)} autoComplete="off" />}
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="WhatsApp" opcional error={errores.whatsapp}>
                {(id, a) => <GlassInput id={id} {...a} value={d.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} inputMode="tel" placeholder="33 1234 5678" autoComplete="off" />}
              </Campo>
              <Campo etiqueta="Teléfono fijo" opcional error={errores.telefono}>
                {(id, a) => <GlassInput id={id} {...a} value={d.telefono ?? ''} onChange={(e) => set('telefono', e.target.value)} inputMode="tel" autoComplete="off" />}
              </Campo>
            </div>
            <Campo etiqueta="Correo" opcional error={errores.email}>
              {(id, a) => <GlassInput id={id} {...a} type="email" value={d.email ?? ''} onChange={(e) => set('email', e.target.value)} autoComplete="off" />}
            </Campo>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
              <Campo etiqueta="Dirección" opcional>
                {(id, a) => <GlassInput id={id} {...a} value={d.direccion ?? ''} onChange={(e) => set('direccion', e.target.value)} autoComplete="off" />}
              </Campo>
              <Campo etiqueta="Ciudad" opcional>
                {(id, a) => <GlassInput id={id} {...a} value={d.ciudad ?? ''} onChange={(e) => set('ciudad', e.target.value)} placeholder="Guadalajara" autoComplete="off" />}
              </Campo>
            </div>

            <Campo etiqueta="Etiquetas" opcional ayuda="Escribe y presiona Enter. Sirven para filtrar la lista (p. ej. mayoreo, restaurante).">
              {(id, a) => (
                <div className="flex flex-col gap-2">
                  {(d.etiquetas ?? []).length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {(d.etiquetas ?? []).map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => set('etiquetas', (d.etiquetas ?? []).filter((x) => x !== e))}
                          className="inline-flex h-8 items-center gap-1 rounded-full bg-accent/[0.14] pl-3 pr-2 text-xs font-semibold text-accent outline-none pointer-coarse:h-11 dark:bg-navy-400/20 dark:text-navy-200"
                          aria-label={`Quitar etiqueta ${e}`}
                        >
                          {e}
                          <X className="size-3.5" aria-hidden />
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <GlassInput
                    id={id}
                    {...a}
                    value={etiquetaNueva}
                    onChange={(e) => (e.target.value.endsWith(',') ? agregarEtiqueta(e.target.value) : setEtiquetaNueva(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        agregarEtiqueta(etiquetaNueva)
                      }
                    }}
                    placeholder="Nueva etiqueta"
                    autoComplete="off"
                  />
                  {libres.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {libres.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => agregarEtiqueta(s)}
                          className="h-8 rounded-full bg-fg/[0.06] px-3 text-xs font-medium text-fg-muted outline-none transition-colors hover:bg-fg/[0.1] pointer-coarse:h-11"
                        >
                          + {s}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </Campo>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Vendedor asignado">
                {(id, a) => (
                  <GlassSelect id={id} {...a} value={d.vendedor_id ?? ''} onChange={(e) => set('vendedor_id', e.target.value || null)}>
                    <option value="">Sin asignar</option>
                    {vendedores.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                    {d.vendedor_id && !vendedores.some((m) => m.id === d.vendedor_id) && cliente.vendedor ? <option value={d.vendedor_id}>{cliente.vendedor.nombre}</option> : null}
                  </GlassSelect>
                )}
              </Campo>
              <Campo etiqueta="Días de crédito" error={errores.dias_credito} ayuda="0 = pago de contado">
                {(id, a) => (
                  <GlassInput id={id} {...a} type="number" min={0} max={365} inputMode="numeric" className="num" value={d.dias_credito ?? 0} onChange={(e) => set('dias_credito', Math.round(Number(e.target.value) || 0))} />
                )}
              </Campo>
            </div>
            <Campo etiqueta="¿Cómo nos conoció?" opcional>
              {(id, a) => <GlassInput id={id} {...a} value={d.origen ?? ''} onChange={(e) => set('origen', e.target.value)} placeholder="Recomendación, Facebook, pasó por el local…" autoComplete="off" />}
            </Campo>
          </>
        ) : (
          <>
            <GlassToggle
              icono={<FileText />}
              titulo="Requiere factura"
              subtitulo={d.requiere_factura ? 'Las cotizaciones y pedidos se marcan para facturar' : 'Apagado: se vende sin factura'}
              activo={Boolean(d.requiere_factura)}
              onCambio={(v) => set('requiere_factura', v)}
              tono="acento"
            />
            <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
              <Campo etiqueta="RFC" error={errores.rfc} opcional={!d.requiere_factura}>
                {(id, a) => (
                  <GlassInput id={id} {...a} value={d.rfc ?? ''} onChange={(e) => set('rfc', e.target.value.toUpperCase().replace(/\s/g, ''))} maxLength={13} className="num uppercase" placeholder="ABC201231XX1" autoComplete="off" />
                )}
              </Campo>
              <Campo etiqueta="Razón social" opcional ayuda="Sin el régimen societario (S.A. de C.V.), como en la constancia">
                {(id, a) => <GlassInput id={id} {...a} value={d.razon_social ?? ''} onChange={(e) => set('razon_social', e.target.value)} autoComplete="off" />}
              </Campo>
            </div>
            <Campo etiqueta="Régimen fiscal" opcional>
              {(id, a) => (
                <GlassSelect id={id} {...a} value={d.regimen_fiscal ?? ''} onChange={(e) => set('regimen_fiscal', e.target.value)}>
                  <option value="">Sin indicar</option>
                  {REGIMENES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  {d.regimen_fiscal && !REGIMENES.includes(d.regimen_fiscal) ? <option value={d.regimen_fiscal}>{d.regimen_fiscal}</option> : null}
                </GlassSelect>
              )}
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Código postal fiscal" opcional error={errores.codigo_postal_fiscal}>
                {(id, a) => <GlassInput id={id} {...a} value={d.codigo_postal_fiscal ?? ''} onChange={(e) => set('codigo_postal_fiscal', e.target.value.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" className="num" autoComplete="off" />}
              </Campo>
              <Campo etiqueta="Uso de CFDI" opcional>
                {(id, a) => (
                  <GlassSelect id={id} {...a} value={d.uso_cfdi ?? ''} onChange={(e) => set('uso_cfdi', e.target.value)}>
                    <option value="">Sin indicar</option>
                    {Object.entries(USOS_CFDI).map(([k, v]) => (
                      <option key={k} value={k}>
                        {k} · {v}
                      </option>
                    ))}
                    {d.uso_cfdi && !(d.uso_cfdi in USOS_CFDI) ? <option value={d.uso_cfdi}>{d.uso_cfdi}</option> : null}
                  </GlassSelect>
                )}
              </Campo>
            </div>
            <Campo etiqueta="Correo para facturas" opcional error={errores.email_facturacion} ayuda="Si lo dejas vacío se usa el correo principal">
              {(id, a) => <GlassInput id={id} {...a} type="email" value={d.email_facturacion ?? ''} onChange={(e) => set('email_facturacion', e.target.value)} autoComplete="off" />}
            </Campo>
          </>
        )}
        {errorGeneral ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {errorGeneral}
          </p>
        ) : null}
      </form>
    </GlassModal>
  )
}

