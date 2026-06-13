---
phase: 01-foundation
plan: "03"
subsystem: ui
tags: [vite, tailwind-v4, pwa, react-router, onesignal, fontsource, breadmark, splashscreen]

dependency_graph:
  requires:
    - phase: 01-01
      provides: monorepo scaffold, apps/web package.json, vitest test stubs
  provides:
    - vite.config.ts with VitePWA (injectManifest) + Tailwind v4
    - globals.css with all 16 design tokens, fonts, shadows, radii in @theme
    - BreadMark SVG component (full 4-path + reduced 2-path)
    - Icon component with 42-path Ic map from brand.jsx
    - useInstallPrompt hook (Android beforeinstallprompt + iOS UA detection)
    - SplashScreen with espresso bg, install card, iOS bottom sheet
    - React Router v7 with lazy profile routes (client/courier/admin)
    - main.tsx with Fontsource imports + OneSignal SDK init
    - PWA service worker (workbox precacheAndRoute) + OneSignal SW
  affects:
    - apps/web (all future frontend phases build on these tokens and components)
    - Phase 2 (ClientLayout, CourierLayout, AdminLayout stubs ready for implementation)
    - Phase 5 (OneSignal already initialized — push notifications can be enabled)

tech_stack:
  added:
    - vite-plugin-pwa (VitePWA injectManifest strategy)
    - "@tailwindcss/vite" (Tailwind v4 CSS-first)
    - workbox-precaching (PWA service worker)
    - react-onesignal (OneSignal SDK)
    - react-router v7 (createBrowserRouter, lazy routes)
    - "@fontsource-variable/bricolage-grotesque"
    - "@fontsource/hanken-grotesk"
  patterns:
    - Tailwind v4 CSS-first @theme token block (no tailwind.config.js)
    - VitePWA injectManifest with TypeScript service worker
    - Separate SW scopes: / (PWA) + /push/onesignal/ (OneSignal)
    - React Router v7 lazy routes via route.lazy (not React.lazy at module scope)
    - iOS install detection via UA regex + standalone mode check

key_files:
  created:
    - apps/web/vite.config.ts
    - apps/web/src/styles/globals.css
    - apps/web/src/sw.ts
    - apps/web/public/push/onesignal/OneSignalSDKWorker.js
    - apps/web/src/components/brand/BreadMark.tsx
    - apps/web/src/components/brand/Icon.tsx
    - apps/web/src/hooks/useInstallPrompt.ts
    - apps/web/src/pages/splash/SplashScreen.tsx
    - apps/web/src/pages/client/ClientLayout.tsx
    - apps/web/src/pages/courier/CourierLayout.tsx
    - apps/web/src/pages/admin/AdminLayout.tsx
    - apps/web/src/routes/router.tsx
    - apps/web/src/main.tsx
  modified:
    - apps/web/tsconfig.json (added types: vite/client + vitest/globals)

key_decisions:
  - "VitePWA uses injectManifest strategy (not generateSW) — custom sw.ts for full control over caching and OneSignal scope separation"
  - "OneSignal SW placed at /push/onesignal/ with matching serviceWorkerParam scope — prevents PWA SW controller conflict"
  - "React Router imported from 'react-router' not 'react-router-dom' (v7 API)"
  - "Fonts loaded via Fontsource (not Google CDN) — required for offline PWA mode"
  - "tsconfig.json updated with vite/client + vitest/globals types for clean TypeScript"

patterns_established:
  - "Design tokens: all colors/fonts/spacing in @theme {} in globals.css — never in tailwind.config.js"
  - "BreadMark: reduced=false for large displays, reduced=true for compact contexts"
  - "Route lazy loading: route.lazy(() => import(...).then(m => ({ Component: m.X })))"
  - "OneSignal.init at module level in main.tsx — react-onesignal prevents StrictMode double-init"

One-liner: PWA UI foundation complete — Tailwind v4 tokens, BreadMark, SplashScreen with install prompts, React Router v7, OneSignal SDK initialized.

## Self-Check

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` exits 0 in apps/web | PASSED |
| `npx vitest run` exits 0 (6 todo stubs) | PASSED |
| globals.css starts with `@import "tailwindcss"` | PASSED |
| globals.css contains 16+ color tokens in @theme | PASSED |
| vite.config.ts uses `strategies: 'injectManifest'` | PASSED |
| BreadMark.tsx has `role="img"` accessibility attribute | PASSED |
| router.tsx imports from `react-router` (not react-router-dom) | PASSED |
| OneSignal SW at `public/push/onesignal/OneSignalSDKWorker.js` | PASSED |
| Human checkpoint: SplashScreen visually verified | PASSED (approved) |
