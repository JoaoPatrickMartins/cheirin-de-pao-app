import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // host: true vincula em todas as interfaces (IPv4 0.0.0.0 + IPv6) — necessário p/
  // o port forwarding do Chrome (que encaminha p/ 127.0.0.1) e para acesso via LAN
  server: { host: true },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
        type: 'module',
      },
      manifest: {
        name: 'Cheirin de Pão',
        short_name: 'Cheirin',
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
