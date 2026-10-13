import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { useEffect, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'

const base = import.meta.env.BASE_URL
const ISO = `url(${base}brand/isotipo.png)`

/** Máscara con la silueta del foco; `desplazamiento` permite recortar solo un borde (bisel). */
function mascara(desplazamiento?: { x: number; y: number }): CSSProperties {
  if (!desplazamiento) {
    return {
      WebkitMaskImage: ISO,
      maskImage: ISO,
      WebkitMaskSize: 'contain',
      maskSize: 'contain',
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
      maskPosition: 'center',
    }
  }
  const pos = `center, calc(50% + ${desplazamiento.x}px) calc(50% + ${desplazamiento.y}px)`
  return {
    WebkitMaskImage: `${ISO}, ${ISO}`,
    maskImage: `${ISO}, ${ISO}`,
    WebkitMaskSize: 'contain, contain',
    maskSize: 'contain, contain',
    WebkitMaskRepeat: 'no-repeat, no-repeat',
    maskRepeat: 'no-repeat, no-repeat',
    WebkitMaskPosition: pos,
    maskPosition: pos,
    WebkitMaskComposite: 'source-out',
    maskComposite: 'subtract',
  }
}

/**
 * El foco del logo convertido en un objeto de cristal: refracta el campo de luz,
 * tiene bordes biselados que atrapan la luz y se inclina siguiendo al puntero.
 * Al cargar, la luz amarilla se "enciende" detrás del cristal.
 */
export function BulboCristal({ className, bisel = 3 }: { className?: string; bisel?: number }) {
  const reducir = useReducedMotion()
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const sx = useSpring(px, { stiffness: 110, damping: 18, mass: 0.7 })
  const sy = useSpring(py, { stiffness: 110, damping: 18, mass: 0.7 })
  const rotateY = useTransform(sx, [-1, 1], [-10, 10])
  const rotateX = useTransform(sy, [-1, 1], [8, -8])
  const brilloX = useTransform(sx, [-1, 1], ['18%', '82%'])
  const brilloY = useTransform(sy, [-1, 1], ['6%', '58%'])
  const especular = useTransform(
    [brilloX, brilloY],
    ([x, y]) =>
      `radial-gradient(55% 38% at ${x} ${y}, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.3) 32%, rgba(255,255,255,0) 62%)`,
  )

  useEffect(() => {
    if (reducir || !window.matchMedia('(hover: hover)').matches) return
    const mover = (e: PointerEvent) => {
      px.set((e.clientX / window.innerWidth) * 2 - 1)
      py.set((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', mover)
    return () => window.removeEventListener('pointermove', mover)
  }, [px, py, reducir])

  return (
    <div className={cn('relative aspect-[462/659]', className)} style={{ perspective: 900 }} aria-hidden>
      {/* La luz que enciende el foco (centrada en el globo) */}
      <div className="pointer-events-none absolute left-1/2 top-[37%] aspect-square w-[175%] -translate-x-1/2 -translate-y-1/2">
        <motion.div
          className="size-full rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(255,214,64,0.95) 0%, rgba(249,194,6,0.55) 18%, rgba(249,194,6,0.18) 40%, rgba(249,194,6,0) 64%)',
          }}
          initial={reducir ? false : { opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', visualDuration: 1.2, bounce: 0.08, delay: reducir ? 0 : 0.5 }}
        />
      </div>

      <motion.div
        className="absolute inset-0"
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        initial={reducir ? false : { opacity: 0, y: 28, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', visualDuration: 0.95, bounce: 0.14 }}
      >
        {/* Cuerpo de cristal: desenfoca, satura y aclara lo que hay detrás */}
        <div
          className="glass-lens absolute inset-0"
          style={{
            ...mascara(),
            backdropFilter: 'blur(12px) saturate(210%) brightness(1.12)',
            WebkitBackdropFilter: 'blur(12px) saturate(210%) brightness(1.12)',
            background: 'linear-gradient(170deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.12) 55%, rgba(255,255,255,0.28) 100%)',
          }}
        />
        {/* Tinte de los colores del logo */}
        <div
          className="absolute inset-0 opacity-[0.38] dark:opacity-[0.5]"
          style={{ ...mascara(), backgroundImage: ISO, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }}
        />
        {/* Bisel superior izquierdo: el borde que atrapa la luz */}
        <div className="absolute inset-0" style={{ ...mascara({ x: bisel, y: bisel * 1.3 }), background: 'linear-gradient(160deg, #ffffff 0%, rgba(255,255,255,0.75) 50%, rgba(255,255,255,0.4) 100%)' }} />
        {/* Bisel inferior derecho: reflejo secundario más suave */}
        <div className="absolute inset-0" style={{ ...mascara({ x: -bisel * 0.8, y: -bisel }), background: 'linear-gradient(340deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.25) 60%, rgba(255,255,255,0.1) 100%)' }} />
        {/* Sombra interior para dar grosor */}
        <div
          className="absolute inset-0 mix-blend-multiply dark:mix-blend-normal"
          style={{ ...mascara({ x: -bisel * 2.2, y: -bisel * 2.6 }), background: 'rgba(34,66,107,0.14)' }}
        />
        {/* Reflejo especular que sigue al puntero */}
        <motion.div className="absolute inset-0" style={{ ...mascara(), background: especular }} />
      </motion.div>
    </div>
  )
}
