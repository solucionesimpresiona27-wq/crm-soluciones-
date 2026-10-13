import { ListOrdered, Plus } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { GlassButton, GlassPanel } from '@/components/glass'
import type { ProductoCatalogo, TipoPartida } from '@/data/tipos'
import { TIPOS_PARTIDA } from '@/lib/calculadora'
import { dinero } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { FilaPartida } from './FilaPartida'
import type { Errores, PartidaEditor } from './modelo'
import { EncabezadoSeccion } from './piezas'
import type { AccionesPartida } from './useEditorCotizacion'

const AGREGAR: TipoPartida[] = ['concepto', 'instalacion', 'transporte']

function BotonesAgregar({ onAgregar, className }: { onAgregar: (t: TipoPartida) => void; className?: string }) {
  return (
    <div className={className} role="group" aria-label="Agregar concepto">
      {AGREGAR.map((tipo) => (
        <GlassButton
          key={tipo}
          variante="cristal"
          tamano="sm"
          icono={<Plus />}
          onClick={() => onAgregar(tipo)}
          className="h-11 gap-1.5 px-4"
          aria-label={`Agregar ${TIPOS_PARTIDA[tipo].toLowerCase()}`}
        >
          {TIPOS_PARTIDA[tipo]}
        </GlassButton>
      ))}
    </div>
  )
}

export function SeccionConceptos({
  partidas,
  subtotal,
  errores,
  mostrarErrores,
  ultima,
  productoDe,
  productos,
  cargandoProductos,
  puedeCostos,
  acciones,
  onAgregar,
}: {
  partidas: PartidaEditor[]
  subtotal: number
  errores: Errores
  mostrarErrores: boolean
  ultima: string | null
  productoDe: (id: string | null) => ProductoCatalogo | undefined
  productos: ProductoCatalogo[] | undefined
  cargandoProductos: boolean
  puedeCostos: boolean
  acciones: AccionesPartida
  onAgregar: (t: TipoPartida) => void
}) {
  const reducir = useReducedMotion()
  const vacia = partidas.length === 0

  return (
    <GlassPanel className="p-3 sm:p-6" aria-labelledby="titulo-conceptos">
      <EncabezadoSeccion
        id="titulo-conceptos"
        icono={<ListOrdered />}
        titulo="Conceptos"
        descripcion={
          vacia ? (
            'Lo que incluye la cotización: productos, servicios, instalación y transporte.'
          ) : (
            <>
              {partidas.length} {partidas.length === 1 ? 'concepto' : 'conceptos'}, subtotal <span className="num">{dinero(subtotal)}</span>
            </>
          )
        }
        className="px-1 sm:px-0"
      />

      {vacia ? (
        <div className="mt-5 flex flex-col items-center gap-4 rounded-tile border border-dashed border-[rgb(var(--line)/0.14)] px-4 py-10 text-center">
          <div>
            <p className="text-md font-semibold text-fg">Agrega el primer concepto</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-fg-muted">
              Elige un producto del catálogo para calcular el precio, o captura instalación y transporte por separado.
            </p>
          </div>
          <BotonesAgregar onAgregar={onAgregar} className="flex flex-wrap justify-center gap-2" />
          {mostrarErrores && errores.partidas ? (
            <p className="text-sm font-medium text-danger" role="alert">
              {errores.partidas}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <ol className="mt-5 flex flex-col gap-3" aria-label="Conceptos de la cotización">
            <AnimatePresence initial={false}>
              {partidas.map((p, i) => (
                <motion.li
                  key={p.clave}
                  layout={reducir ? false : 'position'}
                  initial={reducir ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reducir ? { opacity: 0 } : { opacity: 0, scale: 0.96, transition: { duration: 0.16 } }}
                  transition={resorte.suave}
                >
                  <FilaPartida
                    p={p}
                    indice={i}
                    total={partidas.length}
                    errores={mostrarErrores ? errores.filas[p.clave] : undefined}
                    producto={productoDe(p.producto_id)}
                    productos={productos}
                    cargandoProductos={cargandoProductos}
                    puedeCostos={puedeCostos}
                    enfocar={ultima === p.clave}
                    acciones={acciones}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
          <BotonesAgregar onAgregar={onAgregar} className="mt-4 flex flex-wrap gap-2 px-1 sm:px-0" />
        </>
      )}
    </GlassPanel>
  )
}
