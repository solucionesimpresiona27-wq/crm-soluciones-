import { cn } from '@/lib/utils'

/**
 * Campo de luz: el fondo que el cristal refracta, inspirado en los fondos de pantalla
 * de iOS pero con la paleta del logo (azul profundo, plata y la luz amarilla del foco).
 * `vivo` anima lentamente las luces; se usa solo en pantallas con pocas capas de cristal
 * (inicio de sesión) para cuidar el rendimiento.
 */
export function LightField({ vivo = false, escena = 'app' }: { vivo?: boolean; escena?: 'app' | 'acceso'; intensidad?: 'normal' | 'alta' }) {
  const acceso = escena === 'acceso'
  return (
    <div className="light-field" aria-hidden>
      <div
        className={cn('light-field__orb', vivo && 'animate-drift-a')}
        style={{
          width: '72vmax',
          height: '72vmax',
          left: '-22vmax',
          top: '-30vmax',
          background: 'radial-gradient(circle at center, var(--orb-azul) 0%, transparent 64%)',
        }}
      />
      <div
        className={cn('light-field__orb', vivo && 'animate-drift-b')}
        style={{
          width: acceso ? '44vmax' : '50vmax',
          height: acceso ? '44vmax' : '50vmax',
          right: acceso ? '-6vmax' : '-16vmax',
          top: acceso ? '30vh' : '-12vmax',
          background: 'radial-gradient(circle at center, var(--orb-luz) 0%, transparent 62%)',
        }}
      />
      <div
        className={cn('light-field__orb', vivo && 'animate-drift-a [animation-delay:-14s]')}
        style={{
          width: '64vmax',
          height: '64vmax',
          left: '30vw',
          bottom: '-38vmax',
          background: 'radial-gradient(circle at center, var(--orb-plata) 0%, transparent 62%)',
        }}
      />
      <div
        className={cn('light-field__orb', vivo && 'animate-drift-b [animation-delay:-20s]')}
        style={{
          width: '46vmax',
          height: '46vmax',
          left: '-14vmax',
          bottom: '-20vmax',
          background: 'radial-gradient(circle at center, var(--orb-profundo) 0%, transparent 62%)',
        }}
      />
    </div>
  )
}
