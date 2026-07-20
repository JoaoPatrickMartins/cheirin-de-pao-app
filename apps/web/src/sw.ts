import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

// Atualização imediata do PWA. Sem isto, com registerType 'autoUpdate' + injectManifest o SW
// novo fica em "waiting" e só assume quando TODAS as instâncias do app são fechadas — num PWA
// instalado isso pode levar dias, prendendo o cliente num bundle antigo (foi o que deixou um
// Pedido único pago sem gerar a Order). Com skipWaiting + clients.claim() o SW novo assume ao
// instalar e o registro autoUpdate recarrega a aba com o bundle novo já na próxima abertura.
// O lib deste tsconfig (DOM, sem "WebWorker") não expõe skipWaiting/clients/addEventListener no
// ServiceWorkerGlobalScope; tipamos localmente só o que usamos, evitando puxar a lib WebWorker
// (que conflitaria com a DOM). O vite-plugin-pwa compila o SW à parte — isto é só p/ tipagem.
const swSelf = self as unknown as {
  skipWaiting(): Promise<void>
  clients: { claim(): Promise<void> }
  addEventListener(type: 'activate', listener: (event: { waitUntil(p: Promise<unknown>): void }) => void): void
}
void swSelf.skipWaiting()
swSelf.addEventListener('activate', (event) => {
  event.waitUntil(swSelf.clients.claim())
})

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
// OneSignal uses its own SW at /push/onesignal/ scope — no import needed here
