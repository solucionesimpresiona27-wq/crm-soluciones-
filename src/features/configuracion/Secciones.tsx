import { Banknote, CreditCard, Eye, ImageUp, Landmark, Save, Send, Trash2, Undo2, type LucideIcon } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { claves } from '@/app/consultas'
import { Campo, EncabezadoPanel, GlassButton, GlassInput, GlassPanel, GlassSurface, GlassTextarea, GlassToggle } from '@/components/glass'
import { api } from '@/data/api'
import type { Configuracion } from '@/data/modulos/administracion/contrato'
import type { MetodoPago } from '@/data/tipos'
import { resorte } from '@/lib/motion'
import { useBorrador, type Borrador, type Campo as CampoConfig, type ReglaNumero } from './borrador'

export interface PropsSeccion {
  config: Configuracion
  onSucio: (sucio: boolean) => void
}

/* ------------------------------------------------------------------ piezas */

function Texto({ b, campo, etiqueta, ayuda, opcional, tipo = 'text', className, placeholder }: { b: Borrador; campo: CampoConfig; etiqueta: string; ayuda?: string; opcional?: boolean; tipo?: string; className?: string; placeholder?: string }) {
  return (
    <Campo etiqueta={etiqueta} ayuda={ayuda} opcional={opcional} error={b.errores[campo]} className={className}>
      {(id, p) => <GlassInput id={id} {...p} type={tipo} placeholder={placeholder} value={b.valor(campo) ?? ''} onChange={(e) => b.poner(campo, e.target.value)} className={tipo === 'number' ? 'num' : undefined} />}
    </Campo>
  )
}

function Numero({ b, campo, etiqueta, ayuda, sufijo, regla }: { b: Borrador; campo: CampoConfig; etiqueta: string; ayuda?: string; sufijo?: string; regla: ReglaNumero }) {
  return (
    <Campo etiqueta={etiqueta} ayuda={ayuda} error={b.errores[campo]}>
      {(id, p) => (
        <GlassInput id={id} {...p} type="number" inputMode="decimal" min={regla.min} max={regla.max} step={regla.entero ? 1 : 0.5} sufijo={sufijo} className="num" value={b.valor(campo) ?? ''} onChange={(e) => b.poner(campo, e.target.value)} />
      )}
    </Campo>
  )
}

function Area({ b, campo, etiqueta, ayuda, filas = 4, className }: { b: Borrador; campo: CampoConfig; etiqueta: string; ayuda?: string; filas?: number; className?: string }) {
  return (
    <Campo etiqueta={etiqueta} ayuda={ayuda} opcional className={className}>
      {(id, p) => <GlassTextarea id={id} {...p} rows={filas} value={b.valor(campo) ?? ''} onChange={(e) => b.poner(campo, e.target.value)} />}
    </Campo>
  )
}

/** Panel de sección con barra "Cambios sin guardar" que aparece con resorte. */
function Seccion({ titulo, descripcion, b, onSucio, children, validar, mensajeGuardado = 'Cambios guardados' }: { titulo: string; descripcion: string; b: Borrador; onSucio: (s: boolean) => void; children: ReactNode; validar?: () => string | null; mensajeGuardado?: string }) {
  const reducir = useReducedMotion()
  useLayoutEffect(() => onSucio(b.sucio), [b.sucio, onSucio])
  useLayoutEffect(() => () => onSucio(false), [onSucio])
  const guardar = () => {
    const error = validar?.()
    if (error) return Promise.resolve(void toast.error(error))
    return b.guardar().then(
      () => toast.success(mensajeGuardado),
      (e: Error) => toast.error(e.message, { description: 'Corrige el dato y vuelve a guardar.' }),
    )
  }
  return (
    <GlassPanel className="flex flex-col">
      <form
        className="flex flex-col"
        onSubmit={(e) => {
          e.preventDefault()
          void guardar()
        }}
      >
        <EncabezadoPanel titulo={titulo} descripcion={descripcion} className="px-5 pb-4 pt-5" />
        <div className="grid gap-4 px-5 pb-5 pt-1 sm:grid-cols-2">{children}</div>
        <AnimatePresence initial={false}>
          {b.sucio ? (
            <motion.div
              key="barra"
              initial={reducir ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducir ? { opacity: 0 } : { opacity: 0, y: 12 }}
              transition={resorte.agil}
              className="sticky bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-10 mx-3 mb-3 lg:bottom-16"
            >
              <GlassSurface className="flex items-center gap-2 rounded-full py-1.5 pl-4 pr-1.5 shadow-glass" role="status">
                <span className="size-2 shrink-0 rounded-full bg-luz shadow-[0_0_10px_rgba(249,194,6,0.9)]" aria-hidden />
                <span className="mr-auto text-sm font-medium text-fg">Cambios sin guardar</span>
                <GlassButton variante="fantasma" tamano="sm" icono={<Undo2 />} className="pointer-coarse:h-11" onClick={b.descartar}>
                  Descartar
                </GlassButton>
                <GlassButton type="submit" variante="primario" tamano="sm" icono={<Save />} className="pointer-coarse:h-11" cargando={b.guardando}>
                  Guardar
                </GlassButton>
              </GlassSurface>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </form>
    </GlassPanel>
  )
}

/* ----------------------------------------------------------------- Empresa */

const CAMPOS_EMPRESA: CampoConfig[] = ['nombre_comercial', 'eslogan', 'direccion', 'ciudad', 'telefono', 'whatsapp', 'email', 'sitio_web', 'instagram', 'facebook', 'tiktok']

export function EmpresaSeccion({ config, onSucio }: PropsSeccion) {
  const b = useBorrador(config, CAMPOS_EMPRESA)
  const sinNombre = !String(b.valor('nombre_comercial') ?? '').trim()
  return (
    <div className="flex flex-col gap-4">
      <LogoTarjeta config={config} />
      <Seccion titulo="Empresa" descripcion="Así aparece tu negocio en cotizaciones, PDF y mensajes." b={b} onSucio={onSucio} validar={() => (sinNombre ? 'Escribe el nombre comercial: aparece en cada cotización' : null)}>
        <Campo etiqueta="Nombre comercial" error={sinNombre ? 'Escribe el nombre comercial' : null}>
          {(id, p) => <GlassInput id={id} {...p} value={b.valor('nombre_comercial') ?? ''} onChange={(e) => b.poner('nombre_comercial', e.target.value)} />}
        </Campo>
        <Texto b={b} campo="eslogan" etiqueta="Eslogan" opcional />
        <Texto b={b} campo="direccion" etiqueta="Dirección" opcional className="sm:col-span-2" />
        <Texto b={b} campo="ciudad" etiqueta="Ciudad" opcional />
        <Texto b={b} campo="telefono" etiqueta="Teléfono" tipo="tel" opcional />
        <Texto b={b} campo="whatsapp" etiqueta="WhatsApp" tipo="tel" opcional ayuda="Se muestra en el PDF y el portal" />
        <Texto b={b} campo="email" etiqueta="Correo" tipo="email" opcional />
        <Texto b={b} campo="sitio_web" etiqueta="Sitio web" opcional placeholder="www.tu-sitio.mx" />
        <Texto b={b} campo="instagram" etiqueta="Instagram" opcional />
        <Texto b={b} campo="facebook" etiqueta="Facebook" opcional />
        <Texto b={b} campo="tiktok" etiqueta="TikTok" opcional />
      </Seccion>
    </div>
  )
}

function LogoTarjeta({ config }: { config: Configuracion }) {
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const incluido = `${import.meta.env.BASE_URL}brand/logo.png`
  const subir = useMutation({
    mutationFn: (f: File) => api.configuracion.subirLogo(f),
    onSuccess: (c) => {
      qc.setQueryData(claves.configuracion, c)
      toast.success('Logo actualizado', { description: 'Ya aparece en las cotizaciones y el PDF.' })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const quitar = useMutation({
    mutationFn: () => api.configuracion.quitarLogo(),
    onSuccess: (c) => {
      qc.setQueryData(claves.configuracion, c)
      toast.success('Se usará el logo incluido')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  return (
    <GlassPanel className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <div className="grid h-24 w-full shrink-0 place-items-center rounded-tile bg-white p-3 shadow-[inset_0_0_0_1px_rgba(14,28,48,0.08)] sm:w-48">
        <img src={config.logo_url || incluido} alt={`Logo de ${config.nombre_comercial}`} className="max-h-full max-w-full object-contain" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="text-md font-semibold text-fg">Logo</h2>
        <p className="text-sm text-fg-muted">{config.logo_url ? 'Logo propio. Se imprime en el PDF y en el portal del cliente.' : 'Usando el logo incluido de Soluciones Impresiona.'} PNG, JPG, WebP o SVG de hasta 2 MB.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <GlassButton variante="cristal" icono={<ImageUp />} cargando={subir.isPending} onClick={() => input.current?.click()}>
            Subir logo
          </GlassButton>
          {config.logo_url ? (
            <GlassButton variante="fantasma" icono={<Trash2 />} cargando={quitar.isPending} onClick={() => quitar.mutate()}>
              Usar el incluido
            </GlassButton>
          ) : null}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="sr-only"
          tabIndex={-1}
          aria-label="Archivo del logo"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) subir.mutate(f)
            e.target.value = ''
          }}
        />
      </div>
    </GlassPanel>
  )
}

/* ---------------------------------------------------------- Datos fiscales */

const CAMPOS_FISCALES: CampoConfig[] = ['rfc', 'razon_social', 'regimen_fiscal', 'mostrar_datos_fiscales']

export function FiscalesSeccion({ config, onSucio }: PropsSeccion) {
  const b = useBorrador(config, CAMPOS_FISCALES)
  const mostrar = Boolean(b.valor<boolean>('mostrar_datos_fiscales'))
  const faltan = mostrar && (!String(b.valor('rfc') ?? '').trim() || !String(b.valor('razon_social') ?? '').trim())
  return (
    <Seccion titulo="Datos fiscales" descripcion="Quedan ocultos en cotizaciones y PDF hasta que los actives." b={b} onSucio={onSucio}>
      <Texto b={b} campo="rfc" etiqueta="RFC" opcional />
      <Texto b={b} campo="razon_social" etiqueta="Razón social" opcional />
      <Texto b={b} campo="regimen_fiscal" etiqueta="Régimen fiscal" opcional className="sm:col-span-2" />
      <div className="flex flex-col gap-2 sm:col-span-2">
        <GlassToggle
          icono={<Eye />}
          titulo="Mostrar en cotizaciones y PDF"
          subtitulo={mostrar ? 'Se imprimen RFC y razón social' : 'Apagado: no se muestran'}
          activo={mostrar}
          onCambio={(v) => b.poner('mostrar_datos_fiscales', v)}
          className="self-start"
        />
        {faltan ? <p className="text-sm text-warning">Completa el RFC y la razón social antes de mostrarlos.</p> : null}
      </div>
    </Seccion>
  )
}

/* ------------------------------------------------------------ Cotizaciones */

const CAMPOS_COTIZACION: CampoConfig[] = ['iva_pct', 'anticipo_pct', 'vigencia_dias', 'tiempo_entrega_default', 'prefijo_cotizacion', 'prefijo_pedido', 'condiciones_cotizacion', 'notas_pie_cotizacion', 'datos_bancarios']
const NUM_COTIZACION: Partial<Record<CampoConfig, ReglaNumero>> = {
  iva_pct: { min: 0, max: 100, nombre: 'IVA' },
  anticipo_pct: { min: 0, max: 100, nombre: 'Anticipo' },
  vigencia_dias: { min: 1, max: 365, entero: true, nombre: 'Vigencia' },
}

export function CotizacionesSeccion({ config, onSucio }: PropsSeccion) {
  const b = useBorrador(config, CAMPOS_COTIZACION, NUM_COTIZACION)
  return (
    <Seccion titulo="Cotizaciones" descripcion="Valores con los que nace cada cotización nueva. Las ya creadas no cambian." b={b} onSucio={onSucio} validar={() => (!String(b.valor('prefijo_cotizacion') ?? '').trim() || !String(b.valor('prefijo_pedido') ?? '').trim() ? 'Escribe los prefijos de folio (p. ej. COT y PED)' : null)}>
      <div className="grid grid-cols-3 gap-3 sm:col-span-2">
        <Numero b={b} campo="iva_pct" etiqueta="IVA" sufijo="%" regla={NUM_COTIZACION.iva_pct!} />
        <Numero b={b} campo="anticipo_pct" etiqueta="Anticipo" sufijo="%" regla={NUM_COTIZACION.anticipo_pct!} />
        <Numero b={b} campo="vigencia_dias" etiqueta="Vigencia" sufijo="días" regla={NUM_COTIZACION.vigencia_dias!} />
      </div>
      <Texto b={b} campo="tiempo_entrega_default" etiqueta="Tiempo de entrega por defecto" opcional className="sm:col-span-2" />
      <Texto b={b} campo="prefijo_cotizacion" etiqueta="Prefijo de cotización" ayuda="Folios como COT-0001" />
      <Texto b={b} campo="prefijo_pedido" etiqueta="Prefijo de pedido" ayuda="Folios como PED-0001" />
      <Area b={b} campo="condiciones_cotizacion" etiqueta="Condiciones" ayuda="Una por renglón. Se imprimen en el PDF." filas={7} className="sm:col-span-2" />
      <Area b={b} campo="notas_pie_cotizacion" etiqueta="Notas al pie" filas={2} className="sm:col-span-2" />
      <Area b={b} campo="datos_bancarios" etiqueta="Datos bancarios" ayuda="Banco, titular y CLABE para transferencias. Se muestran en el PDF si los escribes." filas={3} className="sm:col-span-2" />
    </Seccion>
  )
}

/* ------------------------------------------------------------------- Pagos */

const METODOS: { valor: MetodoPago; nombre: string; icono: LucideIcon }[] = [
  { valor: 'transferencia', nombre: 'Transferencia', icono: Send },
  { valor: 'efectivo', nombre: 'Efectivo', icono: Banknote },
  { valor: 'deposito', nombre: 'Depósito', icono: Landmark },
  { valor: 'tarjeta', nombre: 'Tarjeta', icono: CreditCard },
]
const CAMPOS_PAGOS: CampoConfig[] = ['metodos_pago_activos']

export function PagosSeccion({ config, onSucio }: PropsSeccion) {
  const b = useBorrador(config, CAMPOS_PAGOS)
  const activos = (b.valor<MetodoPago[]>('metodos_pago_activos') ?? []) as MetodoPago[]
  return (
    <Seccion titulo="Métodos de pago" descripcion="Los que aparecen al registrar un cobro y en el PDF." b={b} onSucio={onSucio}>
      <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
        {METODOS.map((m) => {
          const on = activos.includes(m.valor)
          const Icono = m.icono
          return (
            <GlassToggle
              key={m.valor}
              icono={<Icono />}
              titulo={m.nombre}
              subtitulo={on ? 'Activo' : 'Apagado'}
              activo={on}
              tono="acento"
              onCambio={(v) => {
                if (!v && activos.length === 1) {
                  toast.error('Deja al menos un método de pago activo')
                  return
                }
                b.poner('metodos_pago_activos', METODOS.map((x) => x.valor).filter((x) => (x === m.valor ? v : activos.includes(x))))
              }}
            />
          )
        })}
      </div>
    </Seccion>
  )
}

/* ---------------------------------------------------------------- Clientes */

const CAMPOS_CLIENTES: CampoConfig[] = ['dias_reactivacion']
const NUM_CLIENTES: Partial<Record<CampoConfig, ReglaNumero>> = { dias_reactivacion: { min: 1, max: 3650, entero: true, nombre: 'Días para reactivación' } }

export function ClientesSeccion({ config, onSucio }: PropsSeccion) {
  const b = useBorrador(config, CAMPOS_CLIENTES, NUM_CLIENTES)
  return (
    <Seccion titulo="Clientes" descripcion="Cuándo un cliente que ya compró aparece en “Reactivar”." b={b} onSucio={onSucio}>
      <Numero b={b} campo="dias_reactivacion" etiqueta="Días sin comprar" sufijo="días" regla={NUM_CLIENTES.dias_reactivacion!} ayuda="Recomendado: 90 días" />
    </Seccion>
  )
}
