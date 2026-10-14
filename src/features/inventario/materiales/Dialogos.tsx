import { ArrowDownToLine, ArrowUpFromLine, Ruler, Save, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useSesion } from '@/app/sesion'
import { Campo, GlassButton, GlassInput, GlassModal, GlassSelect, GlassTextarea, GlassToggle } from '@/components/glass'
import { UNIDADES_MATERIAL, type Material, type TipoMovimiento, type UnidadMaterial } from '@/data/modulos/inventario/contrato'
import { METODOS_PAGO } from '@/data/modulos/pagos/contrato'
import type { MetodoPago } from '@/data/tipos'
import { dinero } from '@/lib/format'
import { redondear } from '@/lib/utils'
import { useGuardarMaterial, useProveedores, useRegistrarMovimiento } from '../consultas'
import { conUnidad, SelectorPedido, type PedidoLigado } from '../piezas'
import { leerNumero } from '../util'

/** Alta o edición de un material. La existencia inicial solo al crear; el costo solo con ver_costos. */
export function MaterialModal({ abierto, material, onCerrar }: { abierto: boolean; material: Material | null; onCerrar: () => void }) {
  const { puede } = useSesion()
  const costos = puede('ver_costos')
  const proveedores = useProveedores(abierto)
  const guardar = useGuardarMaterial()
  const [f, setF] = useState({ nombre: '', categoria: '', unidad: 'm2' as UnidadMaterial, stock_minimo: '', existencia: '', proveedor_id: '', ubicacion: '', notas: '', costo: '' })
  const [intento, setIntento] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setIntento(false)
    setF(
      material
        ? {
            nombre: material.nombre,
            categoria: material.categoria ?? '',
            unidad: material.unidad,
            stock_minimo: String(material.stock_minimo),
            existencia: '',
            proveedor_id: material.proveedor_id ?? '',
            ubicacion: material.ubicacion ?? '',
            notas: material.notas ?? '',
            costo: material.costo_unitario !== null ? String(material.costo_unitario) : '',
          }
        : { nombre: '', categoria: '', unidad: 'm2', stock_minimo: '', existencia: '', proveedor_id: '', ubicacion: '', notas: '', costo: '' },
    )
  }, [abierto, material])

  const minimo = leerNumero(f.stock_minimo) ?? 0
  const existencia = leerNumero(f.existencia)
  const costo = leerNumero(f.costo)
  const errores = {
    nombre: !f.nombre.trim() ? 'Escribe el nombre del material' : null,
    minimo: minimo < 0 || (f.stock_minimo.trim() && leerNumero(f.stock_minimo) === null) ? 'El mínimo debe ser un número igual o mayor a cero' : null,
    existencia: f.existencia.trim() && (existencia === null || existencia < 0) ? 'La existencia inicial no puede ser negativa' : null,
    costo: f.costo.trim() && (costo === null || costo < 0) ? 'El costo no puede ser negativo' : null,
  }
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))

  const enviar = async () => {
    setIntento(true)
    if (Object.values(errores).some(Boolean)) return
    try {
      const m = await guardar.mutateAsync({
        id: material?.id,
        datos: {
          nombre: f.nombre.trim(),
          categoria: f.categoria.trim() || null,
          unidad: f.unidad,
          stock_minimo: minimo,
          proveedor_id: f.proveedor_id || null,
          ubicacion: f.ubicacion.trim() || null,
          notas: f.notas.trim() || null,
          ...(material ? {} : { existencia_inicial: existencia ?? 0 }),
          ...(costos ? { costo_unitario: costo } : {}),
        },
      })
      toast.success(material ? `${m.nombre} actualizado` : `${m.nombre} dado de alta`, { description: material ? undefined : `Existencia: ${conUnidad(m.existencia, m.unidad)}` })
      onCerrar()
    } catch (e) {
      toast.error(`No se guardó el material: ${(e as Error).message}`)
    }
  }

  return (
    <GlassModal
      abierto={abierto}
      onCambio={(v) => (v ? null : onCerrar())}
      titulo={material ? `Editar ${material.nombre}` : 'Nuevo material'}
      descripcion={material ? 'Para corregir la existencia usa Ajuste.' : 'La existencia inicial queda en el kárdex como un ajuste.'}
      pie={
        <>
          <GlassButton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </GlassButton>
          <GlassButton variante="primario" icono={<Save />} cargando={guardar.isPending} onClick={() => void enviar()}>
            {material ? 'Guardar cambios' : 'Dar de alta material'}
          </GlassButton>
        </>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          void enviar()
        }}
      >
        <Campo etiqueta="Nombre" error={intento ? errores.nombre : null} className="sm:col-span-2">
          {(id, a) => <GlassInput id={id} {...a} autoFocus value={f.nombre} onChange={set('nombre')} placeholder="Ej. Vinil blanco brillante" maxLength={200} />}
        </Campo>
        <Campo etiqueta="Unidad">
          {(id) => (
            <GlassSelect id={id} value={f.unidad} onChange={set('unidad')}>
              {(Object.keys(UNIDADES_MATERIAL) as UnidadMaterial[]).map((u) => (
                <option key={u} value={u}>
                  {UNIDADES_MATERIAL[u]}
                </option>
              ))}
            </GlassSelect>
          )}
        </Campo>
        <Campo etiqueta="Categoría" opcional>
          {(id) => <GlassInput id={id} value={f.categoria} onChange={set('categoria')} placeholder="Viniles, lonas, tintas…" />}
        </Campo>
        <Campo etiqueta="Stock mínimo" error={intento ? errores.minimo : null} ayuda="Al llegar aquí se enciende la alerta">
          {(id, a) => <GlassInput id={id} {...a} inputMode="decimal" value={f.stock_minimo} onChange={set('stock_minimo')} placeholder="0" sufijo={UNIDADES_MATERIAL[f.unidad]} />}
        </Campo>
        {material ? null : (
          <Campo etiqueta="Existencia inicial" error={intento ? errores.existencia : null} opcional>
            {(id, a) => <GlassInput id={id} {...a} inputMode="decimal" value={f.existencia} onChange={set('existencia')} placeholder="0" sufijo={UNIDADES_MATERIAL[f.unidad]} />}
          </Campo>
        )}
        <Campo etiqueta="Proveedor habitual" opcional>
          {(id) => (
            <GlassSelect id={id} value={f.proveedor_id} onChange={set('proveedor_id')}>
              <option value="">Sin proveedor</option>
              {(proveedores.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </GlassSelect>
          )}
        </Campo>
        <Campo etiqueta="Ubicación" opcional>
          {(id) => <GlassInput id={id} value={f.ubicacion} onChange={set('ubicacion')} placeholder="Ej. Bodega, anaquel 2" />}
        </Campo>
        {costos ? (
          <Campo etiqueta="Costo unitario" error={intento ? errores.costo : null} opcional ayuda="Solo lo ve quien tiene permiso de costos">
            {(id, a) => <GlassInput id={id} {...a} inputMode="decimal" value={f.costo} onChange={set('costo')} placeholder="0.00" sufijo={`/${UNIDADES_MATERIAL[f.unidad]}`} />}
          </Campo>
        ) : null}
        <Campo etiqueta="Notas" opcional className="sm:col-span-2">
          {(id) => <GlassTextarea id={id} rows={2} value={f.notas} onChange={set('notas')} />}
        </Campo>
        <button type="submit" hidden />
      </form>
    </GlassModal>
  )
}

const TEXTOS: Record<TipoMovimiento, { titulo: string; boton: string; descripcion: string }> = {
  entrada: { titulo: 'Entrada', boton: 'Registrar entrada', descripcion: 'Compra o material recibido: la existencia sube.' },
  consumo: { titulo: 'Consumo', boton: 'Registrar consumo', descripcion: 'Material usado en un trabajo: la existencia baja.' },
  merma: { titulo: 'Merma', boton: 'Registrar merma', descripcion: 'Material dañado o desperdiciado: la existencia baja.' },
  ajuste: { titulo: 'Ajuste', boton: 'Ajustar existencia', descripcion: 'Escribe lo que contaste físicamente; la diferencia queda en el kárdex.' },
}

/** Entrada, consumo, merma o ajuste de un material. */
export function MovimientoModal({ material, tipo, onCerrar }: { material: Material | null; tipo: TipoMovimiento; onCerrar: () => void }) {
  const { puede } = useSesion()
  const costos = puede('ver_costos')
  const gastos = puede('registrar_gastos')
  const entrada = tipo === 'entrada'
  const proveedores = useProveedores(Boolean(material) && entrada)
  const registrar = useRegistrarMovimiento()
  const [f, setF] = useState({ cantidad: '', proveedor_id: '', costo: '', referencia: '', notas: '' })
  const [pedido, setPedido] = useState<PedidoLigado | null>(null)
  const [conGasto, setConGasto] = useState(false)
  const [metodo, setMetodo] = useState<MetodoPago>('transferencia')
  const [intento, setIntento] = useState(false)

  useEffect(() => {
    if (!material) return
    setF({ cantidad: tipo === 'ajuste' ? String(material.existencia) : '', proveedor_id: material.proveedor_id ?? '', costo: material.costo_unitario !== null ? String(material.costo_unitario) : '', referencia: '', notas: '' })
    setPedido(null)
    setConGasto(false)
    setIntento(false)
  }, [material, tipo])

  if (!material) return null
  const u = UNIDADES_MATERIAL[material.unidad]
  const n = leerNumero(f.cantidad)
  const costo = leerNumero(f.costo)
  const resultante = n === null ? null : tipo === 'ajuste' ? n : tipo === 'entrada' ? material.existencia + n : material.existencia - n
  const total = entrada && n && costo ? redondear(n * costo) : null
  const errores = {
    cantidad:
      n === null
        ? tipo === 'ajuste'
          ? 'Escribe la existencia que contaste'
          : 'Escribe la cantidad'
        : tipo === 'ajuste'
          ? n < 0
            ? 'La existencia no puede ser negativa'
            : n === material.existencia
              ? 'Es la misma existencia; no hay nada que ajustar'
              : null
          : n <= 0
            ? 'La cantidad debe ser mayor a cero'
            : resultante !== null && resultante < 0
              ? `Solo hay ${conUnidad(material.existencia, material.unidad)}. Si la existencia está mal, pide un ajuste.`
              : null,
    notas: (tipo === 'ajuste' || tipo === 'merma') && !f.notas.trim() ? (tipo === 'ajuste' ? 'Escribe el motivo del ajuste' : 'Escribe qué pasó con el material') : null,
    costo: f.costo.trim() && (costo === null || costo < 0) ? 'El costo no puede ser negativo' : null,
    gasto: conGasto && !total ? 'Para registrar el gasto escribe cantidad y costo unitario' : null,
  }
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))

  const enviar = async () => {
    setIntento(true)
    if (Object.values(errores).some(Boolean) || n === null) return
    const prov = proveedores.data?.find((p) => p.id === f.proveedor_id)
    try {
      const r = await registrar.mutateAsync({
        datos: {
          material_id: material.id,
          tipo,
          cantidad: n,
          pedido_id: tipo === 'consumo' || tipo === 'merma' ? (pedido?.id ?? null) : null,
          proveedor_id: entrada ? f.proveedor_id || null : null,
          referencia: entrada ? f.referencia.trim() || null : null,
          notas: f.notas.trim() || null,
        },
        existenciaContada: tipo === 'ajuste' ? n : undefined,
        costoUnitario: entrada && costos && f.costo.trim() && costo !== material.costo_unitario ? costo : undefined,
        gasto:
          entrada && conGasto && total
            ? {
                concepto: `Compra de ${material.nombre} (${conUnidad(n, material.unidad)})`,
                categoria: 'material',
                monto: total,
                metodo_pago: metodo,
                proveedor_id: f.proveedor_id || null,
                referencia: f.referencia.trim() || null,
              }
            : null,
      })
      toast.success(`${TEXTOS[tipo].titulo} registrada: ${material.nombre}`, {
        description: `Existencia: ${conUnidad(resultante ?? material.existencia, material.unidad)}${entrada && conGasto && total ? ` · gasto de ${dinero(total)}${prov ? ` con ${prov.nombre}` : ''}` : ''}`,
      })
      for (const a of r.avisos) toast.warning(a)
      onCerrar()
    } catch (e) {
      toast.error(`No se registró: ${(e as Error).message}`)
    }
  }

  return (
    <GlassModal
      abierto
      onCambio={(v) => (v ? null : onCerrar())}
      titulo={`${TEXTOS[tipo].titulo} · ${material.nombre}`}
      descripcion={`${TEXTOS[tipo].descripcion} Hay ${conUnidad(material.existencia, material.unidad)}.`}
      ancho="sm"
      pie={
        <>
          <GlassButton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </GlassButton>
          <GlassButton
            variante={tipo === 'merma' ? 'peligro' : 'primario'}
            icono={entrada ? <ArrowDownToLine /> : tipo === 'ajuste' ? <Ruler /> : tipo === 'merma' ? <TriangleAlert /> : <ArrowUpFromLine />}
            cargando={registrar.isPending}
            onClick={() => void enviar()}
          >
            {TEXTOS[tipo].boton}
          </GlassButton>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void enviar()
        }}
      >
        <Campo etiqueta={tipo === 'ajuste' ? 'Existencia contada' : 'Cantidad'} error={intento ? errores.cantidad : null}>
          {(id, a) => <GlassInput id={id} {...a} autoFocus inputMode="decimal" value={f.cantidad} onChange={set('cantidad')} placeholder="0" sufijo={u} className="num text-md" />}
        </Campo>
        {resultante !== null && !errores.cantidad ? (
          <p className="-mt-2 text-sm text-fg-muted" role="status">
            Quedarán <span className="num font-semibold text-fg">{conUnidad(resultante, material.unidad)}</span>
            {material.stock_minimo > 0 && resultante <= material.stock_minimo ? <span className="font-semibold text-amber-600 dark:text-amber-300"> · por debajo del mínimo</span> : null}
          </p>
        ) : null}

        {entrada ? (
          <>
            <Campo etiqueta="Proveedor" opcional>
              {(id) => (
                <GlassSelect id={id} value={f.proveedor_id} onChange={set('proveedor_id')}>
                  <option value="">Sin proveedor</option>
                  {(proveedores.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </GlassSelect>
              )}
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              {costos ? (
                <Campo etiqueta="Costo unitario" opcional error={intento ? errores.costo : null} ayuda={total ? `Total ${dinero(total)}` : 'Actualiza el costo del material'}>
                  {(id, a) => <GlassInput id={id} {...a} inputMode="decimal" value={f.costo} onChange={set('costo')} placeholder="0.00" sufijo={`/${u}`} />}
                </Campo>
              ) : null}
              <Campo etiqueta="Referencia" opcional className={costos ? undefined : 'sm:col-span-2'}>
                {(id) => <GlassInput id={id} value={f.referencia} onChange={set('referencia')} placeholder="Factura o nota" maxLength={200} />}
              </Campo>
            </div>
            {gastos && costos ? (
              <div className="flex flex-col gap-3">
                <GlassToggle
                  icono={<ArrowDownToLine />}
                  titulo="Registrar también el gasto"
                  subtitulo={total ? `Compra de material por ${dinero(total)}` : 'Escribe el costo para calcular el monto'}
                  activo={conGasto}
                  onCambio={setConGasto}
                  className="w-full"
                />
                {conGasto ? (
                  <Campo etiqueta="Método de pago" error={intento ? errores.gasto : null}>
                    {(id, a) => (
                      <GlassSelect id={id} {...a} value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
                        {(Object.keys(METODOS_PAGO) as MetodoPago[]).map((m) => (
                          <option key={m} value={m}>
                            {METODOS_PAGO[m]}
                          </option>
                        ))}
                      </GlassSelect>
                    )}
                  </Campo>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}

        {tipo === 'consumo' || tipo === 'merma' ? (
          <Campo etiqueta="Pedido" opcional>
            {(id) => <SelectorPedido id={id} valor={pedido} onCambio={setPedido} ayuda="Liga el material al trabajo para saber cuánto se usó" />}
          </Campo>
        ) : null}

        <Campo etiqueta={tipo === 'ajuste' ? 'Motivo' : tipo === 'merma' ? 'Qué pasó' : 'Notas'} opcional={tipo !== 'ajuste' && tipo !== 'merma'} error={intento ? errores.notas : null}>
          {(id, a) => (
            <GlassTextarea
              id={id}
              {...a}
              rows={2}
              maxLength={2000}
              value={f.notas}
              onChange={set('notas')}
              placeholder={tipo === 'ajuste' ? 'Ej. conteo físico del viernes' : tipo === 'merma' ? 'Ej. se rasgó al instalar' : undefined}
            />
          )}
        </Campo>
        <button type="submit" hidden />
      </form>
    </GlassModal>
  )
}
