/**
 * onesignal.ts — inicialização centralizada do OneSignal (Web SDK v16 via react-onesignal).
 *
 * Motivação: antes o init ficava inline no main.tsx e os hooks liam `(window as any).OneSignal`
 * na montagem; se o SDK ainda não tivesse carregado, faziam `return` e NUNCA reanexavam os
 * listeners (corrida). Aqui o init roda uma única vez e expomos `oneSignalReady`, uma Promise
 * que resolve quando o init termina — os hooks (registro do player_id, deep-link, opt-in)
 * esperam por ela antes de tocar em `PushSubscription`/`Notifications`.
 */
import OneSignal from 'react-onesignal'

const APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined

// safari_web_id gerado pelo painel (Settings → Web Configuration, modo Custom Code). Habilita
// web push no Safari/macOS; no iOS 16.4+ (PWA instalado) o push usa VAPID e independe deste id,
// mas mantê-lo não atrapalha e ainda cobre o Safari desktop.
const SAFARI_WEB_ID = 'web.onesignal.auto.0dd8fdab-49d8-437b-ac06-36c9d15991be'

let resolveReady: () => void = () => {}
/** Resolve quando `OneSignal.init()` termina (ou imediatamente se não houver App ID). */
export const oneSignalReady: Promise<void> = new Promise((resolve) => {
  resolveReady = resolve
})

let started = false

/** Inicializa o OneSignal uma única vez. Chamado no bootstrap do app (main.tsx). */
export function initOneSignal(): void {
  if (started) return
  started = true

  if (!APP_ID) {
    // Sem App ID (ex.: dev sem a env definida): não há o que inicializar. Resolve mesmo assim
    // para não deixar os hooks pendurados aguardando `oneSignalReady`.
    resolveReady()
    return
  }

  OneSignal.init({
    appId: APP_ID,
    safari_web_id: SAFARI_WEB_ID,
    // Service worker próprio, isolado do SW do PWA (Workbox roda no escopo '/').
    serviceWorkerPath: 'push/onesignal/OneSignalSDKWorker.js',
    serviceWorkerParam: { scope: '/push/onesignal/' },
    autoResubscribe: true,
  })
    .catch(() => {
      // Falha de init não pode quebrar o app; o push apenas fica indisponível.
    })
    .finally(() => resolveReady())
}
