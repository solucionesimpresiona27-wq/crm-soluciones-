/**
 * Filtros SVG de refracción para el cristal (efecto lente en los bordes).
 * Se aplican con `backdrop-filter: url(#...)` solo en navegadores Chromium
 * (clase `lens-ready` en <html>); los demás usan el desenfoque normal.
 *
 * El mapa de desplazamiento codifica X en el canal rojo y Y en el verde:
 * el centro es neutro y los bordes desplazan el fondo hacia adentro,
 * como el borde grueso de una lente convexa.
 */
function mapa(ancho: number, alto: number, radio: number, desenfoque: number) {
  const inset = Math.round(Math.min(ancho, alto) * 0.16)
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${ancho}' height='${alto}'>
<defs>
<linearGradient id='r' x1='0' x2='1' y1='0' y2='0'><stop offset='0' stop-color='#ff0000'/><stop offset='1' stop-color='#000000'/></linearGradient>
<linearGradient id='g' x1='0' x2='0' y1='0' y2='1'><stop offset='0' stop-color='#00ff00'/><stop offset='1' stop-color='#000000'/></linearGradient>
<filter id='b' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='${desenfoque}'/></filter>
</defs>
<rect width='${ancho}' height='${alto}' fill='#000000'/>
<rect width='${ancho}' height='${alto}' fill='url(#r)'/>
<rect width='${ancho}' height='${alto}' fill='url(#g)' style='mix-blend-mode:screen'/>
<rect x='${inset}' y='${inset}' width='${ancho - inset * 2}' height='${alto - inset * 2}' rx='${radio}' fill='#808000' filter='url(#b)'/>
</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const MAPA_CIRCULO = mapa(200, 200, 70, 13)
const MAPA_CAPSULA = mapa(480, 160, 56, 12)

export function LensFilterDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden focusable="false">
      <defs>
        <filter
          id="impresiona-lente"
          x="0"
          y="0"
          width="1"
          height="1"
          primitiveUnits="objectBoundingBox"
          colorInterpolationFilters="sRGB"
        >
          <feImage href={MAPA_CIRCULO} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="mapa" />
          <feDisplacementMap in="SourceGraphic" in2="mapa" scale="0.16" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter
          id="impresiona-lente-capsula"
          x="0"
          y="0"
          width="1"
          height="1"
          primitiveUnits="objectBoundingBox"
          colorInterpolationFilters="sRGB"
        >
          <feImage href={MAPA_CAPSULA} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="mapa" />
          <feDisplacementMap in="SourceGraphic" in2="mapa" scale="0.1" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  )
}

/** Activa la refracción solo donde el navegador la soporta y el usuario no pidió menos transparencia. */
export function detectarLente() {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent
  const chromium = /Chrome\/\d+/.test(ua) && !/Edg\/1[0-7]\d\./.test(ua) && !/OPR\//.test(ua)
  const ios = /iPhone|iPad|iPod/.test(ua)
  const menosTransparencia = window.matchMedia('(prefers-reduced-transparency: reduce)').matches
  return chromium && !ios && !menosTransparencia
}
