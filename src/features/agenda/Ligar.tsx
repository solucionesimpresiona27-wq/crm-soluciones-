import { useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { useId, useState } from 'react'
import { useDebounce } from '@/hooks/useDebounce'
import { GlassIconButton, GlassInput } from '@/components/glass'
import { api } from '@/data/api'

export interface Ligado {
  id: string
  nombre: string
}

/** Buscador para ligar la tarea a un cliente o a un pedido (opcional). */
export function Ligar({
  id,
  tipo,
  valor,
  onCambio,
  etiqueta,
}: {
  id?: string
  tipo: 'cliente' | 'pedido'
  valor: Ligado | null
  onCambio: (v: Ligado | null) => void
  etiqueta: string
}) {
  const [texto, setTexto] = useState('')
  const q = useDebounce(texto.trim())
  const idLista = useId()
  const consulta = useQuery({
    queryKey: ['agenda', 'ligar', tipo, q],
    enabled: q.length >= 2 && !valor,
    queryFn: async (): Promise<Ligado[]> =>
      tipo === 'cliente'
        ? // clientes_operacion: Diseño y Producción encuentran a los clientes con pedidos
          (await api.tareas.buscarClientes(q)).slice(0, 6)
        : (await api.pedidos.listar({ texto: q })).slice(0, 6).map((p) => ({
            id: p.id,
            nombre: `${p.folio} · ${p.titulo} · ${p.cliente}`,
          })),
  })

  if (valor)
    return (
      <div className="flex h-11 items-center gap-2 rounded-control bg-[var(--control-bg)] pl-4 pr-1 shadow-[inset_0_1px_0_var(--inner-hi)]">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{valor.nombre}</span>
        <GlassIconButton etiqueta={`Quitar ${etiqueta.toLowerCase()}`} icono={<X />} tamano="sm" onClick={() => onCambio(null)} />
      </div>
    )

  const resultados = consulta.data ?? []
  return (
    <div>
      <GlassInput
        id={id}
        icono={<Search />}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={tipo === 'cliente' ? 'Busca por nombre o teléfono' : 'Busca por folio, título o cliente'}
        aria-label={etiqueta}
        aria-controls={idLista}
        aria-expanded={resultados.length > 0}
        role="combobox"
        autoComplete="off"
      />
      {q.length >= 2 ? (
        <ul id={idLista} role="listbox" className="mt-1.5 flex flex-col gap-0.5 rounded-tile bg-[var(--control-bg)] p-1">
          {consulta.isFetching && !resultados.length ? <li className="px-3 py-2 text-sm text-fg-muted">Buscando…</li> : null}
          {!consulta.isFetching && !resultados.length ? <li className="px-3 py-2 text-sm text-fg-muted">Sin resultados para "{q}"</li> : null}
          {resultados.map((r) => (
            <li key={r.id} role="option" aria-selected={false}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center rounded-control px-3 text-left text-sm text-fg outline-none hover:bg-[var(--control-bg)] focus-visible:ring-2 focus-visible:ring-accent"
                onClick={() => {
                  onCambio(r)
                  setTexto('')
                }}
              >
                <span className="truncate">{r.nombre}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
