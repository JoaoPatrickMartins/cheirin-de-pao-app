import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
// OneSignal uses its own SW at /push/onesignal/ scope — no import needed here
