import { ArrowDown, ArrowUp, Check, FolderPlus, Pencil, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Campo, EstadoVacio, GlassButton, GlassIconButton, GlassInput, GlassPanel, Pildora, Skeleton } from '@/components/glass'
import type { Categoria } from '@/data/modulos/catalogo/contrato'
import { cn } from '@/lib/utils'
import { useCategorias, useGuardarCategoria } from './consultas'

/** Administración de categorías: crear, renombrar, ordenar y desactivar. */
export function CategoriasVista() {
  const categorias = useCategorias()
  const guardar = useGuardarCategoria()
  const [editando, setEditando] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [nueva, setNueva] = useState({ nombre: '', grupo: '' })

  const lista = categorias.data ?? []
  const grupos = [...new Set(lista.map((c) => c.grupo))]

  const ejecutar = async (datos: Parameters<typeof guardar.mutateAsync>[0], aviso?: string) => {
    try {
      await guardar.mutateAsync(datos)
      if (aviso) toast.success(aviso)
      return true
    } catch (e) {
      toast.error(`${(e as Error).message.replace(/\.?$/, '.')} Inténtalo de nuevo.`)
      return false
    }
  }

  const mover = async (grupo: Categoria[], i: number, dir: -1 | 1) => {
    const a = grupo[i]
    const b = grupo[i + dir]
    if (!a || !b) return
    const oa = a.orden === b.orden ? a.orden + dir : b.orden
    await ejecutar({ id: a.id, nombre: a.nombre, grupo: a.grupo, orden: oa })
    await ejecutar({ id: b.id, nombre: b.nombre, grupo: b.grupo, orden: a.orden })
  }

  const crear = async () => {
    if (!nueva.nombre.trim() || !nueva.grupo.trim()) return toast.error('Escribe el nombre y elige o escribe el grupo de la categoría.')
    const max = Math.max(0, ...lista.filter((c) => c.grupo === nueva.grupo.trim()).map((c) => c.orden))
    if (await ejecutar({ nombre: nueva.nombre, grupo: nueva.grupo, orden: max + 10 }, 'Categoría creada')) setNueva({ nombre: '', grupo: nueva.grupo })
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        {categorias.isPending ? (
          <GlassPanel className="flex flex-col gap-3 p-5">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-11 rounded-control" />
            ))}
          </GlassPanel>
        ) : lista.length === 0 ? (
          <GlassPanel>
            <EstadoVacio icono={<FolderPlus />} titulo="Aún no hay categorías" descripcion="Crea la primera para ordenar el catálogo." />
          </GlassPanel>
        ) : (
          grupos.map((g) => {
            const grupo = lista.filter((c) => c.grupo === g).sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'))
            return (
              <GlassPanel key={g} className="p-3 sm:p-5">
                <h2 className="px-2 pb-2 text-lg font-semibold tracking-tight text-fg">{g}</h2>
                <ul className="divide-y divide-[var(--divider)]">
                  {grupo.map((c, i) => (
                    <li key={c.id} className="flex min-h-14 flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1.5">
                      {editando === c.id ? (
                        <form
                          className="flex min-w-0 flex-1 basis-full items-center gap-2"
                          onSubmit={async (e) => {
                            e.preventDefault()
                            if (await ejecutar({ id: c.id, nombre, grupo: c.grupo }, 'Categoría renombrada')) setEditando(null)
                          }}
                        >
                          <GlassInput aria-label={`Nuevo nombre de ${c.nombre}`} autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} className="min-w-0 flex-1" />
                          <GlassIconButton type="submit" etiqueta="Guardar nombre" icono={<Check />} tamano="sm" destacado />
                          <GlassIconButton etiqueta="Cancelar" icono={<X />} tamano="sm" onClick={() => setEditando(null)} />
                        </form>
                      ) : (
                        <>
                          <span className={cn('min-w-[9rem] flex-1 break-words font-medium', c.activo ? 'text-fg' : 'text-fg-subtle')}>{c.nombre}</span>
                          {!c.activo ? <Pildora>Inactiva</Pildora> : null}
                          <div className="ml-auto flex items-center gap-2">
                            <GlassIconButton etiqueta={`Subir ${c.nombre}`} icono={<ArrowUp />} tamano="sm" disabled={i === 0 || guardar.isPending} onClick={() => void mover(grupo, i, -1)} />
                            <GlassIconButton etiqueta={`Bajar ${c.nombre}`} icono={<ArrowDown />} tamano="sm" disabled={i === grupo.length - 1 || guardar.isPending} onClick={() => void mover(grupo, i, 1)} />
                            <GlassIconButton
                              etiqueta={`Renombrar ${c.nombre}`}
                              icono={<Pencil />}
                              tamano="sm"
                              onClick={() => {
                                setEditando(c.id)
                                setNombre(c.nombre)
                              }}
                            />
                            <GlassButton variante="fantasma" tamano="sm" className="pointer-coarse:h-11" onClick={() => void ejecutar({ id: c.id, nombre: c.nombre, grupo: c.grupo, activo: !c.activo }, c.activo ? 'Categoría desactivada' : 'Categoría activada')}>
                              {c.activo ? 'Desactivar' : 'Activar'}
                            </GlassButton>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </GlassPanel>
            )
          })
        )}
      </div>

      <GlassPanel className="flex flex-col gap-4 p-5 lg:sticky lg:top-4">
        <h2 className="text-lg font-semibold tracking-tight text-fg">Nueva categoría</h2>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void crear()
          }}
        >
          <Campo etiqueta="Nombre">{(id, a) => <GlassInput id={id} {...a} value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} placeholder="Ej. Stickers" />}</Campo>
          <Campo etiqueta="Grupo" ayuda="Elige uno de la lista o escribe uno nuevo.">
            {(id, a) => (
              <>
                <GlassInput id={id} {...a} list="grupos-catalogo" value={nueva.grupo} onChange={(e) => setNueva({ ...nueva, grupo: e.target.value })} placeholder="Ej. Impresión y publicidad" />
                <datalist id="grupos-catalogo">
                  {grupos.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </>
            )}
          </Campo>
          <GlassButton type="submit" variante="primario" icono={<FolderPlus />} cargando={guardar.isPending}>
            Crear categoría
          </GlassButton>
        </form>
      </GlassPanel>
    </div>
  )
}
