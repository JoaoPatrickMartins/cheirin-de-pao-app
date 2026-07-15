import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    // host: true vincula em todas as interfaces (IPv4 0.0.0.0 + IPv6) — necessário p/
    // o port forwarding do Chrome (que encaminha p/ 127.0.0.1) e para acesso via LAN
    host: true,
    // Proxy de dev: as chamadas de API vão para /api (mesma origem, porta 5173) e o Vite
    // as repassa server-side para a API. Assim TODO o tráfego usa a 5173 — a única porta
    // que o port-forward do VS Code encaminha de forma confiável no devcontainer — sem
    // depender do forward da 3001 e sem CORS. Só afeta `vite dev`; build/preview/prod
    // usam a VITE_API_URL real (vem de secret no deploy). Ver apps/web/.env.development.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      // O OneSignal tem service worker próprio em /push/onesignal/ (escopo isolado). Fora do
      // precache do Workbox para preservar essa isolação e evitar cache redundante do SW dele.
      injectManifest: {
        globIgnores: ['**/push/onesignal/**'],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
      manifest: {
        name: 'Cheirin de Pão',
        short_name: 'Cheirin de Pão',
        description: 'Pão fresco na porta todo dia',
        theme_color: '#1E1207',
        background_color: '#1E1207',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
    }),
  ],
})
