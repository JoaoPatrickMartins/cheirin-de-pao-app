import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// O vite-plugin-pwa põe o manifest e o registerSW em TODA página HTML. A /sobre/ não é o app: sem
// eles, instalar a partir dela não abre o app em `/` (plano-pagina-sobre.md §4.2). Fica DEPOIS do
// VitePWA na lista, na mesma fase `post`, para rodar depois da injeção dele.
function sobreSemPwa(): Plugin {
  return {
    name: 'cheirin:sobre-sem-pwa',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.path.startsWith('/sobre/')) return html
        return html
          .replace(/<link rel="manifest"[^>]*>/g, '')
          .replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/g, '')
      },
    },
  }
}

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
        globIgnores: [
          '**/push/onesignal/**',
          // O escritor de planilha (~930 KB) é carregado sob demanda em `lib/xlsx.ts` e só o ADMIN
          // chega nele, ao tocar em exportar. Precachear aqui faria TODO cliente — que abre o app
          // no celular para comprar pão — baixar quase 1 MB que ele nunca vai executar. Fica fora
          // do precache de propósito: o navegador o busca na primeira exportação e o guarda no
          // cache HTTP como qualquer outro asset com hash no nome.
          '**/exceljs*.js',
        ],
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
    sobreSemPwa(),
  ],
  build: {
    rollupOptions: {
      // Página pública "Sobre" (/sobre/) — HTML estático, fora do React (plano-pagina-sobre.md §4.2).
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        sobre: fileURLToPath(new URL('./sobre/index.html', import.meta.url)),
      },
    },
  },
})
