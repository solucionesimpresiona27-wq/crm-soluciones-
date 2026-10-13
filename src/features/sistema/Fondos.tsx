import { AnimatePresence, motion } from 'motion/react'
import type { CSSProperties } from 'react'
import type { Fondo } from './contexto'

/* Composición "fotográfica" hecha solo con CSS: un atardecer sobre el mar con montañas.
   Bordes duros (sol, montañas, reflejos) para que la refracción del cristal se note. */
const cielo: CSSProperties = {
  background:
    'linear-gradient(180deg, #2A47B0 0%, #4C45C8 20%, #9447B8 40%, #E0598F 57%, #FF9050 67%, #FFC970 74%)',
}

const capa = (estilo: CSSProperties): CSSProperties => ({ position: 'absolute', ...estilo })

function FondoFoto() {
  return (
    <div className="absolute inset-0 overflow-hidden" style={cielo}>
      {/* Nubes */}
      <div
        style={capa({
          left: '6%',
          top: '18%',
          width: '46%',
          height: '9%',
          borderRadius: '50%',
          background: 'linear-gradient(180deg, rgba(255,190,205,0.75), rgba(214,110,170,0.35))',
          filter: 'blur(6px)',
        })}
      />
      <div
        style={capa({
          right: '-6%',
          top: '30%',
          width: '52%',
          height: '7%',
          borderRadius: '50%',
          background: 'linear-gradient(180deg, rgba(255,200,170,0.8), rgba(235,120,140,0.3))',
          filter: 'blur(5px)',
        })}
      />
      {/* Sol con halo */}
      <div
        style={capa({
          left: '56%',
          top: '44%',
          width: '30vmin',
          height: '30vmin',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 42% 38%, #FFF8DA 0%, #FFE27D 38%, #FFB443 72%, #FF8A3D 100%)',
          boxShadow: '0 0 90px 36px rgba(255, 168, 82, 0.55)',
        })}
      />
      {/* Montañas lejanas y cercanas */}
      <div
        style={capa({
          inset: 0,
          background: 'linear-gradient(180deg, #8D55C0 52%, #4A2D86 70%)',
          clipPath:
            'polygon(0% 63%, 8% 57%, 15% 60%, 24% 51%, 33% 58%, 41% 54%, 50% 59%, 58% 53%, 66% 60%, 74% 55%, 83% 61%, 91% 56%, 100% 60%, 100% 72%, 0% 72%)',
        })}
      />
      <div
        style={capa({
          inset: 0,
          background: 'linear-gradient(180deg, #43287A 60%, #1B1446 72%)',
          clipPath:
            'polygon(0% 66%, 10% 61%, 19% 66%, 30% 59%, 38% 65%, 47% 62%, 56% 68%, 70% 63%, 80% 68%, 90% 64%, 100% 67%, 100% 72%, 0% 72%)',
        })}
      />
      {/* Mar con ondas */}
      <div
        style={capa({
          left: 0,
          right: 0,
          top: '70%',
          bottom: 0,
          background: 'linear-gradient(180deg, #FF9D5C 0%, #C94B8A 22%, #4B2F8F 58%, #121848 100%)',
        })}
      />
      <div
        style={capa({
          left: 0,
          right: 0,
          top: '70%',
          bottom: 0,
          background: 'repeating-linear-gradient(180deg, transparent 0 7px, rgba(255,255,255,0.12) 7px 9px)',
        })}
      />
      {/* Reflejo del sol en el agua */}
      <div
        style={capa({
          left: 'calc(56% + 4vmin)',
          width: '22vmin',
          top: '71%',
          bottom: '4%',
          background: 'repeating-linear-gradient(180deg, rgba(255,222,140,0.95) 0 4px, transparent 4px 12px)',
          WebkitMaskImage: 'linear-gradient(180deg, #000 0%, transparent 100%)',
          maskImage: 'linear-gradient(180deg, #000 0%, transparent 100%)',
        })}
      />
      {/* Cabo en primer plano */}
      <div
        style={capa({
          inset: 0,
          background: '#0D0A29',
          clipPath: 'polygon(0% 100%, 0% 77%, 7% 75%, 14% 79%, 22% 85%, 29% 92%, 34% 100%)',
        })}
      />
      {/* En modo oscuro el fondo se atenúa, como los fondos de pantalla del teléfono */}
      <div className="absolute inset-0 hidden bg-black/30 dark:block" />
    </div>
  )
}

function FondoRayas() {
  return (
    <>
      <div
        className="absolute inset-0 dark:hidden"
        style={{ background: 'repeating-linear-gradient(-45deg, #0E1C30 0 12px, #F6F8FB 12px 24px)' }}
      />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{ background: 'repeating-linear-gradient(-45deg, #03070D 0 12px, #CBD5E1 12px 24px)' }}
      />
    </>
  )
}

/**
 * Capa de fondo del escenario. Es "pegajosa": mide lo que la pantalla y se queda fija
 * mientras se recorre la vitrina, como un fondo de pantalla detrás del Centro de Control.
 */
export function CapaFondo({ fondo, foco }: { fondo: Fondo; foco: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="sticky top-0 h-dvh w-full">
        <AnimatePresence initial={false}>
          <motion.div
            key={fondo}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {fondo === 'foto' ? <FondoFoto /> : fondo === 'rayas' ? <FondoRayas /> : fondo === 'liso' ? <div className="absolute inset-0 bg-[var(--page)]" /> : null}
          </motion.div>
        </AnimatePresence>
        {/* Luz del foco (se enciende desde la botonera) */}
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(52% 46% at 26% 46%, rgba(249,194,6,0.72) 0%, rgba(249,194,6,0.28) 42%, rgba(249,194,6,0) 72%)',
          }}
          initial={false}
          animate={{ opacity: foco ? 1 : 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  )
}
