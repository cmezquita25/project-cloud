import type { Config } from 'tailwindcss'

/**
 * Theme global de Project Cloud.
 *
 * Todos los colores son TOKENS SEMÁNTICOS que apuntan a CSS variables
 * definidas en `src/index.css` (formato `R G B` para permitir `<alpha-value>`).
 * Esto da control absoluto: cambiar el branding = editar variables, no clases.
 *
 * Estrategia de modo oscuro: `class` (se añade `dark` a <html>).
 */

/** Helper: token de color basado en CSS variable con soporte de opacidad. */
const rgb = (name: string) => `rgb(var(${name}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* --- Superficies --- */
        canvas: rgb('--color-canvas'), // fondo raíz de la app
        surface: rgb('--color-surface'), // tarjetas, paneles
        'surface-hover': rgb('--color-surface-hover'),
        'surface-active': rgb('--color-surface-active'),
        'surface-container': rgb('--color-surface-container'), // barras, sidebar
        overlay: rgb('--color-overlay'), // scrims de modales

        /* --- Contenido (texto/iconos sobre superficies) --- */
        'content-primary': rgb('--color-content-primary'),
        'content-secondary': rgb('--color-content-secondary'),
        'content-tertiary': rgb('--color-content-tertiary'),
        'content-inverse': rgb('--color-content-inverse'),

        /* --- Bordes / divisores --- */
        border: rgb('--color-border'),
        'border-strong': rgb('--color-border-strong'),

        /* --- Marca (preset Invicter por defecto; ver index.css) --- */
        primary: {
          DEFAULT: rgb('--color-primary'),
          hover: rgb('--color-primary-hover'),
          active: rgb('--color-primary-active'),
          subtle: rgb('--color-primary-subtle'), // fondos suaves (selección, chips)
          on: rgb('--color-primary-on'), // texto sobre primary
        },

        /* --- Gradientes --- */
        'gradient-start': rgb('--color-gradient-start'),
        'gradient-end': rgb('--color-gradient-end'),
        'btn-text': rgb('--color-btn-text'),

        /* --- Halos y brillos (siguen al preset y al white-label) --- */
        'glow-a': rgb('--glow-a'),
        'glow-b': rgb('--glow-b'),
        'glow-c': rgb('--glow-c'),

        /* --- Colores funcionales (emerald / amber / red de la landing) --- */
        success: rgb('--color-success'),
        warning: rgb('--color-warning'),
        danger: {
          DEFAULT: rgb('--color-danger'),
          subtle: rgb('--color-danger-subtle'),
          on: rgb('--color-danger-on'),
        },

        /* --- Acento de selección/foco --- */
        focus: rgb('--color-focus'),
      },
      fontFamily: {
        // Fuente principal del cuerpo (textos, párrafos, controles).
        sans: [
          'Poppins',
          'Roboto',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Arial',
          'sans-serif',
        ],
        // Fuente de títulos/encabezados (Google Sans).
        heading: [
          '"Google Sans"',
          'Poppins',
          'Roboto',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        // Google Drive usa esquinas notablemente redondeadas.
        drive: '0.75rem', // 12px, tarjetas
        pill: '9999px',
      },
      boxShadow: {
        // Elevaciones estilo Material.
        'elevation-1': '0 1px 2px 0 rgb(60 64 67 / 0.30), 0 1px 3px 1px rgb(60 64 67 / 0.15)',
        'elevation-2': '0 1px 3px 0 rgb(60 64 67 / 0.30), 0 4px 8px 3px rgb(60 64 67 / 0.15)',
        'elevation-3': '0 4px 8px 3px rgb(60 64 67 / 0.15), 0 1px 3px 0 rgb(60 64 67 / 0.30)',
        menu: '0 2px 6px 2px rgb(60 64 67 / 0.15), 0 1px 2px 0 rgb(60 64 67 / 0.30)',
      },
      zIndex: {
        sidebar: '30',
        topbar: '40',
        overlay: '60',
        modal: '70',
        dropdown: '75',
        toast: '80',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-out-left': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-100%)' },
        },
        /* --- Sistema visual Invicter (portado de la landing) --- */
        'aurora-drift': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1) rotate(0deg)' },
          '33%': { transform: 'translate3d(6%, -8%, 0) scale(1.15) rotate(30deg)' },
          '66%': { transform: 'translate3d(-5%, 5%, 0) scale(0.95) rotate(-20deg)' },
        },
        'gradient-x': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '0.9', transform: 'scale(1.08)' },
        },
        'ping-dot': {
          '0%': { transform: 'scale(1)', opacity: '0.9' },
          '75%, 100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        /*
          --- Fase 7: entradas y salidas ---
          Todas terminan en `transform: none`/`opacity: 1` y las de entrada se
          usan con `fill-mode: backwards`: al acabar no queda NINGÚN estilo
          aplicado. Importa porque un `transform` que se quedara en un
          contenedor descolocaría el recuadro de selección (es `fixed`).
        */
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'scale-out': {
          from: { opacity: '1', transform: 'scale(1)' },
          to: { opacity: '0', transform: 'scale(0.96)' },
        },
        'slide-down': {
          from: { transform: 'translateY(0)' },
          to: { transform: 'translateY(100%)' },
        },
        'veil-rise': {
          from: { opacity: '0', transform: 'translateY(1.25rem)' },
          to: { opacity: '1', transform: 'none' },
        },
        'theme-icon-in': {
          from: { opacity: '0', transform: 'rotate(-90deg) scale(0.6)' },
          to: { opacity: '1', transform: 'none' },
        },
        'step-in-right': {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'step-in-left': {
          from: { opacity: '0', transform: 'translateX(-24px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'fade-out': 'fade-out 150ms ease-in forwards',
        // Afinada a la curva de la landing (antes 120ms ease-out).
        'scale-in': 'scale-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slide-up 240ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-in-right': 'slide-in-right 240ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-in-left': 'slide-in-left 240ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-out-left': 'slide-out-left 240ms cubic-bezier(0.32, 0.72, 0, 1) forwards',
        'aurora-drift': 'aurora-drift 18s ease-in-out infinite',
        'gradient-x': 'gradient-x 6s ease infinite',
        shimmer: 'shimmer 2.5s linear infinite',
        'pulse-glow': 'pulse-glow 5s ease-in-out infinite',
        'ping-dot': 'ping-dot 1.8s cubic-bezier(0, 0, 0.2, 1) infinite',
        // Fase 7. Salidas más cortas que las entradas.
        'rise-in': 'rise-in 420ms cubic-bezier(0.16, 1, 0.3, 1) backwards',
        'scale-out': 'scale-out 140ms ease-in forwards',
        'slide-down': 'slide-down 200ms ease-in forwards',
        'veil-rise': 'veil-rise 520ms cubic-bezier(0.16, 1, 0.3, 1) backwards',
        'theme-icon-in': 'theme-icon-in 320ms cubic-bezier(0.16, 1, 0.3, 1) backwards',
        'step-in-right': 'step-in-right 320ms cubic-bezier(0.16, 1, 0.3, 1) backwards',
        'step-in-left': 'step-in-left 320ms cubic-bezier(0.16, 1, 0.3, 1) backwards',
        'pulse-glow-once': 'pulse-glow 1.2s ease-out 1',
      },
    },
  },
  plugins: [],
} satisfies Config
