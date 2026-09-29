import 'leaflet/dist/leaflet.css'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource/hanken-grotesk/400.css'
import '@fontsource/hanken-grotesk/500.css'
import '@fontsource/hanken-grotesk/600.css'
import '@fontsource/hanken-grotesk/700.css'
import '@fontsource/hanken-grotesk/800.css'
import './styles/globals.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './routes/router'
import { trackAccess } from './lib/analytics'
import { captureReferralFromUrl } from './lib/referral'
import { initOneSignal } from './lib/onesignal'

// Stripe.js é carregado sob demanda em lib/stripe.ts (stripePromise) e usado via
// <Elements> nas telas de cartão. Não há init global aqui.

// OneSignal: init único no bootstrap (fora de efeito, evita double-init do StrictMode).
// O opt-in de push é feito por gesto do usuário (Perfil / aviso da Home) via usePushOptIn.
initOneSignal()

// Indique e Ganhe — guarda o `?ref=` do link (30 dias) e limpa a URL. ANTES do trackAccess: o
// acesso pelo link é a 1ª etapa do funil do programa, e o código vai junto no evento.
const refFromLink = captureReferralFromUrl()

// Métrica de acesso (Relatórios) — dispara 1x por carga do app, antes do login.
// Em escopo de módulo (não em efeito), evita disparo duplo do StrictMode.
trackAccess(refFromLink)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
