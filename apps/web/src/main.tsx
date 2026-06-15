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
import OneSignal from 'react-onesignal'
import { initMercadoPago } from '@mercadopago/sdk-react'
import { RouterProvider } from 'react-router'
import { router } from './routes/router'

// initMercadoPago chamado uma vez; guard para não chamar em testes (sem VITE_MP_PUBLIC_KEY)
if (import.meta.env.VITE_MP_PUBLIC_KEY) {
  initMercadoPago(import.meta.env.VITE_MP_PUBLIC_KEY as string, { locale: 'pt-BR' })
}

// react-onesignal prevents double-init on StrictMode re-renders.
// Phase 1: SDK initialized only. Push notifications tested in Phase 5.
// Placeholder VITE_ONESIGNAL_APP_ID shows a console warning but does not break the app.
OneSignal.init({
  appId: import.meta.env.VITE_ONESIGNAL_APP_ID as string,
  serviceWorkerPath: 'push/onesignal/OneSignalSDKWorker.js',
  serviceWorkerParam: { scope: '/push/onesignal/' },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
