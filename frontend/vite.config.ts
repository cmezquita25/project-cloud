import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { readFileSync } from 'node:fs'

// Versión de la app: fuente única en /version.json (la comparte el backend
// vía api/version.php, generado por scripts/sync-version.mjs).
const versionInfo = JSON.parse(readFileSync(path.resolve(__dirname, '../version.json'), 'utf8')) as {
  version: string
  released_at: string
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(versionInfo.version),
    __APP_RELEASED_AT__: JSON.stringify(versionInfo.released_at),
  },
  // Base absoluta para soportar correctamente rutas anidadas en React Router (ej. /admin/users)
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@app': path.resolve(__dirname, './src/app'),
      '@features': path.resolve(__dirname, './src/features'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // En desarrollo, redirige /api al backend PHP local.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // IMPORTANTE: la salida de assets NO se llama "assets" para no colisionar
    // con la carpeta /assets ya existente en el hosting (imágenes de otros
    // proyectos referenciadas por URL). Los assets de la app viven en /app-assets.
    assetsDir: 'app-assets',
    // Code-splitting por vendor para cache eficiente en Plesk.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          icons: ['lucide-react'],
          charts: ['apexcharts', 'react-apexcharts'],
          framer: ['framer-motion'],
        },
      },
    },
  },
})
