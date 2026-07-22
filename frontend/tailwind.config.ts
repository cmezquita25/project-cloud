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

        /* --- Marca (azul Google Drive) --- */
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

        /* --- Colores funcionales Google --- */
        success: rgb('--color-success'), // verde  #188038
        warning: rgb('--color-warning'), // amarillo #fbbc04
        danger: {
          DEFAULT: rgb('--color-danger'), // rojo #d93025
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
        dropdown: '50',
        overlay: '60',
        modal: '70',
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
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'fade-out': 'fade-out 150ms ease-in forwards',
        'scale-in': 'scale-in 120ms ease-out',
        'slide-up': 'slide-up 240ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-in-right': 'slide-in-right 240ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-in-left': 'slide-in-left 240ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-out-left': 'slide-out-left 240ms cubic-bezier(0.32, 0.72, 0, 1) forwards',
      },
    },
  },
  plugins: [],
} satisfies Config
