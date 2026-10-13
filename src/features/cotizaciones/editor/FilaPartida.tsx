import { ArrowDown, ArrowUp, Calculator, ChevronDown, Copy, Link2, Trash2 } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { memo, useEffect, useRef } from 'react'
import { Campo, GlassButton, GlassIconButton, GlassInput, GlassSurface, GlassTextarea, Pildora } from '@/components/glass'
import type { ProductoCatalogo } from '@/data/tipos'
import { METODOS, TIPOS_PARTIDA } from '@/lib/calculadora'
import { dinero } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { Calculadora } from './Calculadora'
import { conPrecioFila, importeFila, type ErroresFila, type PartidaEditor } from './modelo'
import { CampoNumero } from './piezas'
import type { AccionesPartida } from './useEditorCotizacion'

export interface FilaPartidaProps {
  p: PartidaEditor
  indice: number
  total: number
  errores: ErroresFila | undefined
  producto: ProductoCatalogo | undefined
  productos: ProductoCatalogo[] | undefined
  cargandoProductos: boolean
  puedeCostos: boolean
  /** Recién agregada: enfoca el concepto */
  enfocar: boolean
  acciones: AccionesPartida
}

/**
 * Un concepto de la cotización: fila de cristal con los datos que ve el cliente y,
 * debajo, la calculadora que se despliega con un resorte.
 */
export const FilaPartida = memo(function FilaPartida({
  p,
  indice,
  total,
  errores,
  producto,
  productos,
  cargandoProductos,
  puedeCostos,
  enfocar,
  acciones,
}: FilaPartidaProps) {
  const reducir = useReducedMotion()
  const concepto = useRef<HTMLInputElement>(null)
  const idCalc = `calc-${p.clave}`
  const info = METODOS[p.metodo_calculo]
  const set = (fn: (x: PartidaEditor) => PartidaEditor) => acciones.cambiar(p.clave, fn)
  const importe = importeFila(p)
  const numero = indice + 1

  useEffect(() => {
    if (!enfocar) return
    const el = concepto.current
    if (!el) return
    el.focus({ preventScroll: true })
    el.scrollIntoView({ block: 'center', behavior: reducir ? 'auto' : 'smooth' })
  }, [enfocar, reducir])

  return (
    <GlassSurface className="rounded-tile p-3 sm:p-4" aria-label={`Concepto ${numero}${p.concepto.trim() ? `: ${p.concepto.trim()}` : ''}`} role="group">
      <div className="flex gap-3">
        <span
          className="num mt-[1.9rem] hidden size-8 shrink-0 sm:grid place-items-center rounded-full bg-fg/[0.06] text-sm font-semibold text-fg-muted shadow-[inset_0_1px_0_var(--inner-hi)]"
          aria-hidden
        >
          {numero}
        </span>

        <div className="grid min-w-0 flex-1 gap-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <Campo
              etiqueta={
                <span className="inline-flex items-center gap-2">
                  <span className="num grid size-5 place-items-center rounded-full bg-fg/[0.07] text-2xs font-semibold text-fg-muted sm:hidden" aria-hidden>
                    {numero}
                  </span>
                  Concepto
                  {p.tipo !== 'concepto' ? (
                    <Pildora tono="acento" punto={false} className="h-5 px-2 text-2xs">
                      {TIPOS_PARTIDA[p.tipo]}
                    </Pildora>
                  ) : null}
                </span>
              }
              error={errores?.concepto}
            >
              {(id, a) => (
                <GlassInput
                  ref={concepto}
                  id={id}
                  {...a}
                  value={p.concepto}
                  onChange={(e) => {
                    const v = e.target.value
                    set((x) => ({ ...x, concepto: v }))
                  }}
                  placeholder={p.tipo === 'concepto' ? 'Lona impresa 13 oz, playeras con logo…' : TIPOS_PARTIDA[p.tipo]}
                  autoComplete="off"
                  className="font-medium"
                />
              )}
            </Campo>
            <div className="flex items-baseline justify-between gap-3 sm:block sm:min-w-[8.5rem] sm:pt-[1.85rem] sm:text-right">
              <p className="text-sm text-fg-muted sm:sr-only">Importe</p>
              <p className="num text-lg font-semibold leading-tight tracking-tight text-fg" aria-label={`Importe ${dinero(importe)}`}>
                {dinero(importe)}
              </p>
            </div>
          </div>

          <Campo etiqueta="Descripción" opcional>
            {(id, a) => (
              <GlassTextarea
                id={id}
                {...a}
                rows={1}
                value={p.descripcion}
                onChange={(e) => {
                  const v = e.target.value
                  set((x) => ({ ...x, descripcion: v }))
                }}
                placeholder="Material, acabados o detalles que verá el cliente"
                className="min-h-11 resize-none [field-sizing:content]"
              />
            )}
          </Campo>

          <div className="grid grid-cols-6 gap-3 sm:grid-cols-[6.5rem_6rem_minmax(8.5rem,1fr)_6rem]">
            <Campo etiqueta={info.cantidad} error={errores?.cantidad} className="col-span-3 sm:col-span-1">
              {(id, a) => (
                <CampoNumero id={id} {...a} valor={p.cantidad} onValor={(v) => set((x) => ({ ...x, cantidad: v }))} placeholder="0" />
              )}
            </Campo>
            <Campo etiqueta="Unidad" className="col-span-3 sm:col-span-1">
              {(id, a) => (
                <GlassInput
                  id={id}
                  {...a}
                  value={p.unidad}
                  onChange={(e) => {
                    const v = e.target.value
                    set((x) => ({ ...x, unidad: v }))
                  }}
                  placeholder={info.unidad}
                  maxLength={20}
                  autoComplete="off"
                />
              )}
            </Campo>
            <Campo
              etiqueta={
                <span className="inline-flex items-center gap-1.5">
                  Precio unitario
                  {p.vinculado ? (
                    <span className="inline-flex items-center gap-1 text-xs font-normal text-fg-subtle">
                      <Link2 className="size-3.5 text-warning" aria-hidden />
                      <span className="max-sm:sr-only">calculado</span>
                    </span>
                  ) : null}
                </span>
              }
              className="col-span-4 sm:col-span-1"
            >
              {(id, a) => (
                <CampoNumero
                  id={id}
                  {...a}
                  valor={p.precio_unitario}
                  onValor={(v) => set((x) => conPrecioFila(x, v))}
                  prefijo="$"
                  fijos={2}
                  placeholder="0.00"
                />
              )}
            </Campo>
            <Campo etiqueta="Descuento" error={errores?.descuento} className="col-span-2 sm:col-span-1">
              {(id, a) => (
                <CampoNumero id={id} {...a} valor={p.descuento_pct} onValor={(v) => set((x) => ({ ...x, descuento_pct: v }))} max={100} sufijo="%" placeholder="0" />
              )}
            </Campo>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <GlassButton
              variante={p.abierta ? 'luz' : 'cristal'}
              tamano="sm"
              icono={<Calculator />}
              iconoDerecha={
                <ChevronDown className={cn('transition-transform duration-300 ease-spring', p.abierta && 'rotate-180')} aria-hidden />
              }
              aria-expanded={p.abierta}
              aria-controls={p.abierta ? idCalc : undefined}
              onClick={() => set((x) => ({ ...x, abierta: !x.abierta }))}
              className="h-10 px-4 pointer-coarse:h-11"
            >
              Calculadora
            </GlassButton>
            <div className="flex items-center gap-1.5" role="group" aria-label={`Acciones del concepto ${numero}`}>
              <GlassIconButton
                etiqueta={`Subir el concepto ${numero}`}
                icono={<ArrowUp />}
                tamano="sm"
                disabled={indice === 0}
                onClick={() => acciones.mover(p.clave, -1)}
              />
              <GlassIconButton
                etiqueta={`Bajar el concepto ${numero}`}
                icono={<ArrowDown />}
                tamano="sm"
                disabled={indice === total - 1}
                onClick={() => acciones.mover(p.clave, 1)}
              />
              <GlassIconButton etiqueta={`Duplicar el concepto ${numero}`} icono={<Copy />} tamano="sm" onClick={() => acciones.duplicar(p.clave)} />
              <GlassIconButton
                etiqueta={`Quitar el concepto ${numero}`}
                icono={<Trash2 />}
                tamano="sm"
                className="text-danger"
                onClick={() => acciones.eliminar(p.clave)}
              />
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {p.abierta ? (
          <motion.div
            key="calc"
            initial={reducir ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reducir ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reducir ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={resorte.expansion}
            className="overflow-hidden"
          >
            <motion.div
              initial={reducir ? false : { y: -10, scale: 0.985 }}
              animate={{ y: 0, scale: 1 }}
              exit={reducir ? undefined : { y: -6, scale: 0.99 }}
              transition={resorte.expansion}
              className="origin-top px-0.5 pb-0.5 pt-3"
            >
              <Calculadora
                id={idCalc}
                p={p}
                producto={producto}
                productos={productos}
                cargandoProductos={cargandoProductos}
                puedeCostos={puedeCostos}
                cambiar={acciones.cambiar}
              />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </GlassSurface>
  )
})
