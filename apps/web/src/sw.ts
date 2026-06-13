import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
// OneSignal uses its own SW at /push/onesignal/ scope — no import needed here
