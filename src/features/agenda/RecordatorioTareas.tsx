import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useSesion } from '@/app/sesion'
import { useMisPendientes } from './consultas'

const CLAVE = 'impresiona:recordatorio-tareas'

function yaAvisado(id: string) {
  try {
    return sessionStorage.getItem(CLAVE) === id
  } catch {
    return false
  }
}
function marcarAvisado(id: string) {
  try {
    sessionStorage.setItem(CLAVE, id)
  } catch {
    /* sin almacenamiento: puede repetirse al recargar */
  }
}

/**
 * Recordatorio al entrar: si la persona tiene tareas vencidas, muestra un aviso una sola vez por sesión
 * del navegador. No pinta nada; se monta una vez dentro del shell (con sesión y router).
 */
export function RecordatorioTareas() {
  const { sesion } = useSesion()
  const navegar = useNavigate()
  // En la agenda las vencidas ya están a la vista: el aviso solo taparía la captura y las hojas
  const enAgenda = useLocation().pathname.startsWith('/agenda')
  const id = sesion?.perfil.id ?? ''
  const avisado = !id || enAgenda || yaAvisado(id)
  const consulta = useMisPendientes(!avisado)

  // Entrar a la agenda cuenta como aviso visto
  useEffect(() => {
    if (enAgenda && id) marcarAvisado(id)
  }, [enAgenda, id])

  useEffect(() => {
    if (avisado || !consulta.data) return
    marcarAvisado(id)
    const vencidas = consulta.data.filter((t) => t.vencida)
    if (!vencidas.length) return
    const n = vencidas.length
    toast.warning(n === 1 ? 'Tienes una tarea vencida' : `Tienes ${n} tareas vencidas`, {
      description: n === 1 ? vencidas[0].titulo : `La más antigua: ${vencidas[0].titulo}`,
      id: 'recordatorio-tareas',
      duration: 9000,
      // Se oculta mientras haya un diálogo o cajón abierto (ver styles/index.css)
      className: 'aviso-recordatorio',
      action: { label: 'Ver agenda', onClick: () => navegar('/agenda') },
    })
  }, [avisado, consulta.data, id, navegar])

  return null
}
