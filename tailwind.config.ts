import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'
import plugin from 'tailwindcss/plugin'

/**
 * Impresiona Glass Design System — tokens de Tailwind.
 * Los colores semánticos viven en CSS (src/styles/tokens.css) para cambiar con el tema.
 */
const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`

export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Marca (tomados del logo)
        navy: {
          50: '#EEF3F9',
          100: '#D9E3F0',
          200: '#B4C7E0',
          300: '#87A3C9',
          400: '#5A7FB0',
          500: '#3A6194',
          600: '#22426B',
          700: '#1B3557',
          800: '#142843',
          900: '#0E1C30',
          950: '#08111F',
        },
        amber: {
          100: '#FEF5CC',
          200: '#FDE98F',
          300: '#FBD94A',
          400: '#F9C206',
          500: '#DDA900',
          600: '#B38900',
          700: '#7A5D00',
        },
        // Semánticos (cambian con el tema)
        fg: { DEFAULT: rgb('--fg'), muted: rgb('--fg-muted'), subtle: rgb('--fg-subtle'), inverse: rgb('--fg-inverse') },
        accent: { DEFAULT: rgb('--accent'), fg: rgb('--accent-fg'), soft: rgb('--accent-soft') },
        luz: { DEFAULT: rgb('--luz'), fg: rgb('--luz-fg'), soft: rgb('--luz-soft') },
        success: { DEFAULT: rgb('--success'), soft: rgb('--success-soft') },
        warning: { DEFAULT: rgb('--warning'), soft: rgb('--warning-soft') },
        danger: { DEFAULT: rgb('--danger'), soft: rgb('--danger-soft') },
        line: rgb('--line'),
      },
      fontFamily: {
        sans: ['"Figtree Variable"', 'Figtree', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        xs: ['0.75rem', { lineHeight: '1.05rem' }],
        sm: ['0.8125rem', { lineHeight: '1.2rem' }],
        base: ['0.9375rem', { lineHeight: '1.45rem' }],
        md: ['1.0625rem', { lineHeight: '1.55rem' }],
        lg: ['1.25rem', { lineHeight: '1.65rem' }],
        xl: ['1.5rem', { lineHeight: '1.9rem' }],
        '2xl': ['1.875rem', { lineHeight: '2.2rem' }],
        '3xl': ['2.5rem', { lineHeight: '2.75rem' }],
        display: ['3.5rem', { lineHeight: '1', letterSpacing: '-0.035em' }],
        hero: ['5rem', { lineHeight: '0.95', letterSpacing: '-0.045em' }],
      },
      borderRadius: {
        // Radios concéntricos: módulo > control > detalle
        sheet: '2rem',
        module: '1.75rem',
        tile: '1.375rem',
        control: '1rem',
        chip: '0.75rem',
      },
      spacing: {
        4.5: '1.125rem',
        13: '3.25rem',
        15: '3.75rem',
        18: '4.5rem',
      },
      boxShadow: {
        glass: 'var(--glass-shadow)',
        'glass-lg': 'var(--glass-shadow-lg)',
        lift: 'var(--glass-shadow-lift)',
      },
      transitionTimingFunction: {
        // Resortes aproximados con linear() para estados CSS (hover, foco)
        spring: 'var(--ease-spring)',
        'spring-soft': 'var(--ease-spring-soft)',
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'drift-a': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '50%': { transform: 'translate3d(6vw, 4vh, 0) scale(1.08)' },
        },
        'drift-b': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1.05)' },
          '50%': { transform: 'translate3d(-5vw, -3vh, 0) scale(0.95)' },
        },
        glow: {
          '0%, 100%': { opacity: '0.85' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s ease-in-out infinite',
        'drift-a': 'drift-a 38s ease-in-out infinite',
        'drift-b': 'drift-b 46s ease-in-out infinite',
        glow: 'glow 5s ease-in-out infinite',
      },
    },
  },
  plugins: [
    animate,
    // Pantallas táctiles: agranda áreas de toque sin cambiar el diseño con ratón
    plugin(({ addVariant }) => {
      addVariant('pointer-coarse', '@media (pointer: coarse)')
    }),
  ],
} satisfies Config
