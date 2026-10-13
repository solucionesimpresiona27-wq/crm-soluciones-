import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const demo = env.VITE_DEMO === 'true'

  return {
    // En modo demo (vista previa) las rutas son relativas para poder alojarse en cualquier carpeta.
    base: demo ? './' : '/',
    plugins: [
      react(),
      !demo &&
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['brand/favicon.png', 'brand/apple-touch-icon.png'],
          manifest: {
            name: 'CRM Soluciones Impresiona',
            short_name: 'Impresiona',
            description: 'Clientes, cotizaciones, pedidos y cobranza de Soluciones Impresiona.',
            lang: 'es-MX',
            theme_color: '#22426B',
            background_color: '#0B1626',
            display: 'standalone',
            start_url: '/',
            icons: [
              { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
              { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
              { src: '/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            ],
          },
          workbox: {
            // Solo archivos de la app; los datos siempre se consultan en línea.
            globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
            navigateFallbackDenylist: [/^\/auth\//],
            runtimeCaching: [],
          },
        }),
    ].filter(Boolean),
    resolve: {
      alias: [
        // Solo se empaqueta una implementación de datos: la real o la de la vista previa.
        {
          find: /^@\/data\/implementacion$/,
          replacement: fileURLToPath(new URL(demo ? './src/data/demo/apiDemo.ts' : './src/data/supabaseApi.ts', import.meta.url)),
        },
        { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      ],
    },
    build: {
      target: 'es2022',
      sourcemap: false,
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          // Librerías en piezas estables para que el navegador las guarde en caché entre versiones.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id)) return 'react'
            if (/[\\/]node_modules[\\/](motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'motion'
            if (id.includes('@supabase')) return 'supabase'
            if (id.includes('@radix-ui')) return 'ui'
            return undefined
          },
        },
      },
      outDir: demo ? 'dist-demo' : 'dist',
    },
    server: { port: 5173, host: true },
    preview: { port: 4173, host: true },
    test: {
      include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
      environment: 'node',
    },
  }
})
