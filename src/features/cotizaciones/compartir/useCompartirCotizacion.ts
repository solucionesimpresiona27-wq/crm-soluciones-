import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { claves, usePlantillas } from '@/app/consultas'
import { useSesion } from '@/app/sesion'
import { api } from '@/data/api'
import type { Configuracion, CotizacionCompleta, Plantilla } from '@/data/tipos'
import { dinero, fechaLarga, hoyISO } from '@/lib/format'
import { enlaceWhatsApp, llenarPlantilla } from '@/lib/whatsapp'
import { redondear } from '@/lib/utils'
import { useCambiarEstadoCotizacion } from '../consultas'
import { diasRestantes } from '../lista/datos'
import { generarPdfCotizacion } from '../pdf/generarPdf'

/** Igual que la plantilla inicial de la base de datos, por si la configurada no existe o está inactiva. */
const PLANTILLA_ENVIO =
  'Hola {cliente} 👋, te compartimos la cotización *{folio}* por *{total}*.\n\n{enlace}\n\nVigencia: {vigencia}. Anticipo para iniciar: {anticipo}.\nQuedamos atentos a tus comentarios. ¡Gracias por considerar a {empresa}!'

function mensajeError(e: unknown, respaldo: string) {
  return e instanceof Error && e.message ? e.message : respaldo
}

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Se libera después: algunos navegadores todavía leen el archivo tras el clic.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** ¿El dispositivo puede compartir archivos (hoja de compartir del celular)? Se prueba con un PDF vacío. */
function puedeCompartirArchivos() {
  try {
    if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false
    const prueba = new File([new Blob([''], { type: 'application/pdf' })], 'prueba.pdf', { type: 'application/pdf' })
    return navigator.canShare({ files: [prueba] })
  } catch {
    return false
  }
}

/** Ventana provisional abierta dentro del clic: si se abre después de generar el PDF, el navegador la bloquea. */
function abrirVentanaProvisional(): Window | null {
  try {
    const v = window.open('', '_blank')
    if (!v) return null
    v.document.title = 'Abriendo WhatsApp…'
    v.document.body.style.cssText = 'font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;color:#22426B'
    v.document.body.textContent = 'Preparando el mensaje de WhatsApp…'
    return v
  } catch {
    return null
  }
}

/**
 * CONTRATO (lo implementa el flujo de PDF/WhatsApp):
 * - enviarWhatsApp: genera el PDF, lo comparte (celular) o lo descarga y abre WhatsApp con el
 *   mensaje de la plantilla "cotizacion_envio"; si era borrador la marca como enviada.
 * - descargarPdf: genera y descarga `<folio>.pdf`.
 */
export function useCompartirCotizacion(): {
  enviarWhatsApp: (c: CotizacionCompleta) => Promise<void>
  descargarPdf: (c: CotizacionCompleta) => Promise<void>
  trabajando: boolean
} {
  const qc = useQueryClient()
  const plantillas = usePlantillas()
  const { sesion } = useSesion()
  const cambiarEstado = useCambiarEstadoCotizacion()
  const [trabajando, setTrabajando] = useState(false)
  const ocupado = useRef(false)

  const configuracion = useCallback(
    (): Promise<Configuracion> => qc.ensureQueryData({ queryKey: claves.configuracion, queryFn: () => api.configuracion.obtener() }),
    [qc],
  )

  const marcarEnviada = useCallback(
    async (c: CotizacionCompleta) => {
      if (c.estado !== 'borrador') return
      try {
        await cambiarEstado.mutateAsync({ id: c.id, estado: 'enviada' })
        toast.success(`${c.folio} marcada como enviada`)
      } catch {
        /* el hook ya muestra el error */
      }
    },
    [cambiarEstado],
  )

  const descargarPdf = useCallback(
    async (c: CotizacionCompleta) => {
      if (ocupado.current) return
      ocupado.current = true
      setTrabajando(true)
      try {
        const blob = await generarPdfCotizacion(c, await configuracion())
        descargar(blob, `${c.folio}.pdf`)
        toast.success(`${c.folio}.pdf descargado`)
      } catch (e) {
        toast.error(mensajeError(e, 'No se pudo generar el PDF. Inténtalo de nuevo.'))
      } finally {
        ocupado.current = false
        setTrabajando(false)
      }
    },
    [configuracion],
  )

  const enviarWhatsApp = useCallback(
    async (c: CotizacionCompleta) => {
      if (ocupado.current) return
      ocupado.current = true
      setTrabajando(true)

      // Se decide antes de cualquier espera: compartir y abrir ventanas necesitan el clic "fresco".
      const compartirArchivo = puedeCompartirArchivos()
      const ventana = compartirArchivo ? null : abrirVentanaProvisional()

      try {
        const config = await configuracion()
        const blob = await generarPdfCotizacion(c, config)
        const nombre = `${c.folio}.pdf`
        const lista: Plantilla[] =
          plantillas.data ?? (await qc.ensureQueryData({ queryKey: claves.plantillas, queryFn: () => api.plantillas.listar() })) ?? []
        const plantilla = lista.find((p) => p.clave === 'cotizacion_envio' && p.activo)?.texto ?? PLANTILLA_ENVIO
        const variables = {
          cliente: c.cliente.nombre,
          folio: c.folio,
          total: dinero(c.total),
          vigencia: fechaLarga(c.fecha_vencimiento),
          anticipo: dinero(redondear((c.total * c.anticipo_pct) / 100)),
          empresa: config.nombre_comercial,
          vendedor: c.vendedor?.nombre ?? sesion?.perfil.nombre ?? '',
        }

        // Celular: hoja de compartir con el PDF adjunto
        if (compartirArchivo) {
          const archivo = new File([blob], nombre, { type: 'application/pdf' })
          const texto = llenarPlantilla(plantilla, { ...variables, enlace: '' })
          const compartir = async () => {
            await navigator.share({ files: [archivo], text: texto, title: `Cotización ${c.folio}` })
            await marcarEnviada(c)
          }
          try {
            await compartir()
          } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') return
            if (e instanceof DOMException && e.name === 'NotAllowedError') {
              // El navegador pide un toque nuevo para compartir (la generación tardó)
              toast('El PDF está listo', {
                description: 'Toca “Compartir” y elige WhatsApp.',
                duration: 15_000,
                action: { label: 'Compartir', onClick: () => void compartir().catch(() => toast.error('No se pudo abrir el menú de compartir.')) },
              })
              return
            }
            throw e
          }
          return
        }

        // Computadora: enlace temporal al PDF (si se puede subir) + descarga para adjuntarlo
        let enlace: string | null = null
        try {
          const dias = Math.max(1, diasRestantes(c.fecha_vencimiento, hoyISO()))
          enlace = await api.cotizaciones.compartirPdf(c.id, c.folio, blob, dias)
        } catch {
          enlace = null
        }
        descargar(blob, nombre)
        const texto = llenarPlantilla(plantilla, { ...variables, enlace: enlace ?? '' })
        const url = enlaceWhatsApp(c.cliente.whatsapp || c.cliente.telefono, texto)

        if (ventana && !ventana.closed) {
          ventana.opener = null
          ventana.location.href = url
        } else if (!window.open(url, '_blank', 'noopener')) {
          toast('Abre WhatsApp para enviar el mensaje', {
            description: 'El navegador bloqueó la ventana nueva.',
            duration: 15_000,
            action: { label: 'Abrir WhatsApp', onClick: () => window.open(url, '_blank', 'noopener') },
          })
        }

        toast.success(enlace ? 'Mensaje listo en WhatsApp' : `Adjunta ${nombre} en WhatsApp`, {
          description: enlace
            ? `El mensaje incluye el enlace al PDF. También se descargó ${nombre} por si prefieres adjuntarlo.`
            : `Se descargó ${nombre}; arrástralo al chat para enviarlo junto con el mensaje.`,
        })
        await marcarEnviada(c)
      } catch (e) {
        if (ventana && !ventana.closed) ventana.close()
        toast.error(mensajeError(e, 'No se pudo preparar el envío por WhatsApp. Inténtalo de nuevo.'))
      } finally {
        ocupado.current = false
        setTrabajando(false)
      }
    },
    [configuracion, marcarEnviada, plantillas.data, qc, sesion],
  )

  return { enviarWhatsApp, descargarPdf, trabajando }
}
