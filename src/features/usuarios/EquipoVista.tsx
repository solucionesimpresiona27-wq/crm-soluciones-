import { RotateCcw, Search, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSesion } from '@/app/sesion'
import { AnimatedNumber, EstadoVacio, GlassButton, GlassInput, GlassPanel, GlassSurface, Pildora, SegmentedControl, Skeleton } from '@/components/glass'
import type { Usuario } from '@/data/modulos/administracion/contrato'
import { haceCuanto } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { cn, normalizar } from '@/lib/utils'
import { NOMBRE_ROL } from '@/lib/permisos'
import { useUsuarios } from './consultas'
import { NuevoUsuarioModal } from './NuevoUsuarioModal'
import { AvatarUsuario, RolPildora } from './piezas'
import { UsuarioModal } from './UsuarioModal'
import { contarAnulaciones } from './util'

const POR_PAGINA = 30

export default function EquipoVista() {
  const lista = useUsuarios()
  const [params, setParams] = useSearchParams()
  const [nuevo, setNuevo] = useState(false)
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<'activos' | 'inactivos' | 'todos'>('activos')
  const [limite, setLimite] = useState(POR_PAGINA)
  const reducir = useReducedMotion()
  const abiertoId = params.get('usuario')
  const abierto = lista.data?.find((u) => u.id === abiertoId) ?? null
  const abrir = (id: string | null) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        if (id) n.set('usuario', id)
        else n.delete('usuario')
        return n
      },
      { replace: true },
    )

  const resumen = useMemo(() => {
    const u = lista.data ?? []
    return { activos: u.filter((x) => x.activo).length, inactivos: u.filter((x) => !x.activo).length, admins: u.filter((x) => x.activo && x.rol === 'admin').length }
  }, [lista.data])

  const visibles = useMemo(() => {
    const t = normalizar(texto)
    return (lista.data ?? [])
      .filter((u) => (estado === 'todos' ? true : estado === 'activos' ? u.activo : !u.activo))
      .filter((u) => !t || normalizar(`${u.nombre} ${u.email} ${u.puesto ?? ''} ${NOMBRE_ROL[u.rol]}`).includes(t))
  }, [lista.data, texto, estado])

  return (
    <div className="flex flex-col gap-4">
      <GlassSurface className="flex flex-col gap-3 rounded-module p-3 pl-5 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-baseline gap-5">
          <span className="flex items-baseline gap-2">
            <AnimatedNumber valor={resumen.activos} className="num text-3xl font-semibold leading-none tracking-tight text-fg" />
            <span className="text-sm text-fg-muted">{resumen.activos === 1 ? 'persona activa' : 'personas activas'}</span>
          </span>
          {resumen.inactivos ? <span className="text-sm text-fg-subtle"><span className="num">{resumen.inactivos}</span> desactivadas</span> : null}
          <span className="hidden items-center gap-1.5 text-sm text-fg-subtle sm:flex">
            <ShieldCheck className="size-4" aria-hidden /> <span className="num">{resumen.admins}</span> en administración
          </span>
        </div>
        <GlassButton variante="primario" icono={<UserPlus />} onClick={() => setNuevo(true)} className="max-sm:w-full">
          Agregar usuario
        </GlassButton>
      </GlassSurface>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="sm:w-80">
          <GlassInput icono={<Search />} aria-label="Buscar en el equipo" placeholder="Buscar por nombre, correo o rol" value={texto} onChange={(e) => { setTexto(e.target.value); setLimite(POR_PAGINA) }} />
        </div>
        <SegmentedControl
          etiqueta="Estado de la cuenta"
          tamano="sm"
          valor={estado}
          onCambio={(v) => { setEstado(v); setLimite(POR_PAGINA) }}
          segmentos={[
            { valor: 'activos', etiqueta: 'Activos', conteo: resumen.activos },
            { valor: 'inactivos', etiqueta: 'Desactivados', conteo: resumen.inactivos },
            { valor: 'todos', etiqueta: 'Todos' },
          ]}
        />
      </div>

      {lista.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Cargando equipo">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[10.5rem] rounded-tile" />
          ))}
        </div>
      ) : lista.isError ? (
        <GlassPanel>
          <EstadoVacio
            icono={<Users />}
            titulo="No se pudo cargar el equipo"
            descripcion={`${lista.error.message}. Revisa tu conexión e inténtalo de nuevo.`}
            accion={<GlassButton icono={<RotateCcw />} onClick={() => void lista.refetch()}>Reintentar</GlassButton>}
          />
        </GlassPanel>
      ) : visibles.length === 0 ? (
        <GlassPanel>
          <EstadoVacio icono={<Search />} titulo="Nadie coincide con la búsqueda" descripcion="Revisa cómo está escrito o cambia el filtro de estado." />
        </GlassPanel>
      ) : (
        <>
        <motion.ul
          aria-label="Equipo"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          initial={reducir ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={resorte.suave}
        >
          {visibles.slice(0, limite).map((u) => (
            <li key={u.id}>
              <TarjetaUsuario u={u} onAbrir={() => abrir(u.id)} />
            </li>
          ))}
        </motion.ul>
        {visibles.length > limite ? (
          <GlassButton variante="cristal" className="self-center" onClick={() => setLimite((l) => l + POR_PAGINA)}>
            Ver más ({visibles.length - limite})
          </GlassButton>
        ) : null}
        </>
      )}

      <NuevoUsuarioModal abierto={nuevo} onCambio={setNuevo} />
      <UsuarioModal usuario={abierto} onCerrar={() => abrir(null)} />
    </div>
  )
}

function TarjetaUsuario({ u, onAbrir }: { u: Usuario; onAbrir: () => void }) {
  const { sesion } = useSesion()
  const anulaciones = contarAnulaciones(u)
  const propio = sesion?.perfil.id === u.id
  return (
    <GlassSurface variante="fuerte" className={cn('relative flex h-full flex-col gap-3 rounded-tile p-4', !u.activo && 'opacity-70')}>
      <div className="flex items-start gap-3">
        <AvatarUsuario nombre={u.nombre || u.email} activo={u.activo} />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onAbrir}
            className="block max-w-full truncate rounded-full text-left font-semibold text-fg outline-none after:absolute after:inset-0 after:rounded-tile focus-visible:after:ring-2 focus-visible:after:ring-accent"
            aria-label={`Abrir ${u.nombre || u.email}`}
          >
            {u.nombre || 'Sin nombre'}
            {propio ? <span className="font-normal text-fg-subtle"> · tú</span> : null}
          </button>
          <p className="truncate text-sm text-fg-muted">{u.email}</p>
          {u.puesto ? <p className="truncate text-xs text-fg-subtle">{u.puesto}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <RolPildora rol={u.rol} />
        {u.activo ? <Pildora tono="exito">Activo</Pildora> : <Pildora>Inactivo</Pildora>}
        {anulaciones ? (
          <Pildora tono="luz" punto={false}>
            {anulaciones === 1 ? '1 permiso a mano' : `${anulaciones} permisos a mano`}
          </Pildora>
        ) : null}
      </div>
      <div className="mt-auto flex items-end justify-between gap-3 border-t border-[var(--divider)] pt-3 text-sm">
        <span className="flex flex-col">
          <span className="text-xs text-fg-subtle">Último acceso</span>
          <span className="text-fg">{u.ultimo_acceso ? haceCuanto(u.ultimo_acceso) : 'Nunca'}</span>
        </span>
        <span className="flex flex-col items-end">
          <span className="text-xs text-fg-subtle">Comisión</span>
          <span className="num font-semibold text-fg">{Number(u.comision_pct).toLocaleString('es-MX', { maximumFractionDigits: 2 })} %</span>
        </span>
      </div>
    </GlassSurface>
  )
}
