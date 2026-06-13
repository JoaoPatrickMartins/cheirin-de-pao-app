# Phase 1: Foundation - Pattern Map

**Mapped:** 2026-06-13
**Files analyzed:** 32 new files to create
**Analogs found:** 0 / 32 — greenfield project; all patterns sourced from RESEARCH.md

> This is a greenfield project. No codebase files exist yet. Every pattern reference
> below points to a specific Pattern or Code Example section in `01-RESEARCH.md`.
> The planner MUST treat RESEARCH.md patterns as the canonical implementation guide
> in lieu of existing analog files.

---

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `package.json` (root) | config | — | RESEARCH.md Code Example: "Complete root package.json" | research-only |
| `turbo.json` | config | — | RESEARCH.md Pattern 1: Turborepo 2.x `tasks` syntax | research-only |
| `tsconfig.base.json` | config | — | RESEARCH.md Code Example: `tsconfig.base.json` | research-only |
| `.env.example` | config | — | RESEARCH.md Code Example: `.env.example` | research-only |
| `docker-compose.yml` | config | — | standard Docker Compose Node + tooling pattern | research-only |
| `.devcontainer/devcontainer.json` | config | — | standard VS Code devcontainer pattern | research-only |
| `apps/web/package.json` | config | — | RESEARCH.md Standard Stack (apps/web install block) | research-only |
| `apps/web/vite.config.ts` | config | — | RESEARCH.md Pattern 2 + Pattern 6 | research-only |
| `apps/web/index.html` | config | — | standard Vite SPA entry point | research-only |
| `apps/web/tsconfig.json` | config | — | extends tsconfig.base.json; standard Vite TS config | research-only |
| `apps/web/src/styles/globals.css` | config | — | RESEARCH.md Pattern 2 + UI-SPEC Tailwind v4 Token File | research-only |
| `apps/web/src/main.tsx` | provider | request-response | RESEARCH.md Pattern 6 (OneSignal init) + Pattern 8 (Fontsource) | research-only |
| `apps/web/src/routes/router.tsx` | route | request-response | RESEARCH.md Pattern 3: React Router v7 createBrowserRouter | research-only |
| `apps/web/src/sw.ts` | utility | event-driven | RESEARCH.md Pattern 6: vite-plugin-pwa injectManifest SW | research-only |
| `apps/web/public/push/onesignal/OneSignalSDKWorker.js` | config | event-driven | RESEARCH.md Pattern 6: OneSignal subdirectory SW | research-only |
| `apps/web/public/pwa-192x192.png` | config | file-I/O | PWA icon asset (192x192 required) | research-only |
| `apps/web/public/pwa-512x512.png` | config | file-I/O | PWA icon asset (512x512 required) | research-only |
| `apps/web/public/apple-touch-icon.png` | config | file-I/O | iOS home screen icon asset | research-only |
| `apps/web/src/hooks/useInstallPrompt.ts` | hook | event-driven | RESEARCH.md Pattern 7: beforeinstallprompt + iOS detection | research-only |
| `apps/web/src/components/brand/BreadMark.tsx` | component | transform | RESEARCH.md Pattern 9 + brand.jsx BreadMark function | research-only |
| `apps/web/src/components/brand/Icon.tsx` | component | transform | brand.jsx `Ic` path map + `Icon` function | research-only |
| `apps/web/src/pages/splash/SplashScreen.tsx` | component | request-response | RESEARCH.md Pattern 7 + UI-SPEC SplashScreen spec | research-only |
| `apps/web/vitest.config.ts` | config | — | standard Vitest jsdom config (Wave 0 gap) | research-only |
| `apps/web/src/hooks/useInstallPrompt.test.ts` | test | — | RESEARCH.md Validation Architecture / VALIDATION.md | research-only |
| `apps/web/src/components/brand/BreadMark.test.tsx` | test | — | RESEARCH.md Validation Architecture / VALIDATION.md | research-only |
| `apps/web/src/pages/splash/SplashScreen.test.tsx` | test | — | RESEARCH.md Validation Architecture / VALIDATION.md | research-only |
| `apps/api/package.json` | config | — | RESEARCH.md Standard Stack (apps/api install block) | research-only |
| `apps/api/tsconfig.json` | config | — | extends tsconfig.base.json; Node/Fastify TS config | research-only |
| `apps/api/src/server.ts` | provider | request-response | RESEARCH.md Pattern 5: Fastify v5 server | research-only |
| `apps/api/src/plugins/prisma.ts` | plugin | CRUD | RESEARCH.md Code Example: Fastify Prisma plugin | research-only |
| `apps/api/src/modules/health/health.route.ts` | route | request-response | RESEARCH.md Pattern 5: health route with DB ping | research-only |
| `apps/api/prisma/schema.prisma` | model | CRUD | RESEARCH.md Pattern 4: Prisma v6 + MongoDB 15 collections | research-only |
| `packages/shared/package.json` | config | — | RESEARCH.md Standard Stack (packages/shared install block) | research-only |
| `packages/shared/tsconfig.json` | config | — | extends tsconfig.base.json; library TS config | research-only |
| `packages/shared/src/schemas/index.ts` | model | transform | Zod 4.4.3 schema export pattern | research-only |
| `packages/shared/src/types/index.ts` | model | transform | TypeScript type re-exports from Prisma client | research-only |
| `packages/shared/src/constants/index.ts` | utility | — | shared app-wide constants | research-only |

---

## Pattern Assignments

### `package.json` (root) — (config)

**Source:** RESEARCH.md Code Example "Complete root `package.json`" (lines 787–803)

**Pattern:**
```json
{
  "name": "cheirin-de-pao",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "turbo": "2.9.18"
  }
}
```

---

### `turbo.json` — (config)

**Source:** RESEARCH.md Pattern 1: Turborepo 2.x `tasks` syntax (lines 284–302)

**Critical rule:** Use `"tasks"` key — NOT `"pipeline"`. `pipeline` was renamed in Turborepo 2.0 and is silently ignored.

**Pattern:**
```jsonc
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

---

### `tsconfig.base.json` — (config)

**Source:** RESEARCH.md Code Example `tsconfig.base.json` (lines 806–822)

**Critical rule:** Use TypeScript 5.7.x — NOT 6.x. TS6 is strict-by-default and will break greenfield builds without explicit opt-out.

**Pattern:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "lib": ["ES2022"]
  }
}
```

---

### `.env.example` — (config)

**Source:** RESEARCH.md Code Example `.env.example` (lines 827–835)

**Pattern:**
```bash
# MongoDB Atlas (required — get from Atlas dashboard)
DATABASE_URL="mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/cheirin-dev?retryWrites=true&w=majority"

# API server
API_PORT=3001
API_HOST=0.0.0.0

# OneSignal (optional in Phase 1 — required in Phase 5)
VITE_ONESIGNAL_APP_ID=your-onesignal-app-id-here
```

---

### `apps/web/vite.config.ts` — (config)

**Source:** RESEARCH.md Pattern 2 (Tailwind v4) lines 339–351 + Pattern 6 (vite-plugin-pwa) lines 510–548

**Critical rules:**
- Use `@tailwindcss/vite` plugin — NOT PostCSS config
- No `tailwind.config.js` — all theme in CSS `@theme {}`
- PWA in `injectManifest` mode with `srcDir: 'src'`, `filename: 'sw.ts'`
- OneSignal icon assets listed in `includeAssets`

**Pattern:**
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
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
```

---

### `apps/web/src/styles/globals.css` — (config)

**Source:** RESEARCH.md Pattern 2 (lines 308–336) + UI-SPEC.md Tailwind v4 Token File (lines 268–311)

**Critical rules:**
- First line MUST be `@import "tailwindcss"` — NOT `@tailwind base/components/utilities` (v3 syntax)
- No `tailwind.config.js` — all custom tokens go inside `@theme {}`
- Color tokens under `--color-*` namespace auto-generate utility classes (`bg-espresso`, `text-gold`, etc.)
- Shadow tokens (`--shadow-soft`, `--shadow-strong`) accessed via `style={{ boxShadow: 'var(--shadow-soft)' }}` — no utility class generated

**Pattern (exact token set from UI-SPEC.md):**
```css
@import "tailwindcss";

@theme {
  /* Fonts */
  --font-display: "Bricolage Grotesque Variable", "Bricolage Grotesque", serif;
  --font-body: "Hanken Grotesk", sans-serif;

  /* Text sizes — exactly 4 role-aligned tokens */
  --text-sm: 12.5px;
  --text-base: 15px;
  --text-xl: 21px;
  --text-3xl: 32px;

  /* Color tokens — THEMES.light only */
  --color-page-bg: #C9BBA2;
  --color-app-bg: #FAF5EC;
  --color-surface: #FFFFFF;
  --color-surface-alt: #FBF6EC;
  --color-surface-2: #F4EBDA;
  --color-espresso: #1E1207;
  --color-icon-bg: #160C04;
  --color-text: #241608;
  --color-text-sec: #7C6A50;
  --color-text-ter: #A89A82;
  --color-gold: #E3AC3F;
  --color-gold-soft: #F3DDA6;
  --color-accent: #B0702A;
  --color-good: #3E7C53;
  --color-good-soft: #DCEBDF;
  --color-primary-btn-text: #FBF3E4;

  /* Shadows (accessed via CSS var — no utility class) */
  --shadow-soft: 0 1px 2px rgba(43,26,12,0.05), 0 4px 14px -8px rgba(43,26,12,0.18);
  --shadow-strong: 0 1px 2px rgba(43,26,12,0.05), 0 10px 30px -12px rgba(43,26,12,0.22);

  /* Border radii */
  --radius-field: 14px;
  --radius-btn: 16px;
  --radius-card: 22px;
  --radius-pill: 999px;
  --radius-app-icon: 30%;
}
```

---

### `apps/web/src/main.tsx` — (provider, request-response)

**Source:** RESEARCH.md Pattern 8 (Fontsource imports, lines 618–624) + Pattern 6 (OneSignal init, lines 551–560)

**Pattern:**
```typescript
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
import { RouterProvider } from 'react-router'
import { router } from './routes/router'

// OneSignal: react-onesignal prevents double-init on React StrictMode re-renders
OneSignal.init({
  appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
  serviceWorkerPath: 'push/onesignal/OneSignalSDKWorker.js',
  serviceWorkerParam: { scope: '/push/onesignal/' },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
```

---

### `apps/web/src/routes/router.tsx` — (route, request-response)

**Source:** RESEARCH.md Pattern 3: React Router v7 (lines 358–397)

**Critical rules:**
- Import from `'react-router'` — NOT `'react-router-dom'`
- Use `route.lazy` (not `React.lazy`) for route-level code splitting
- Route `/` renders `SplashScreen` directly (no lazy — always loaded as entry point)
- `/client/*`, `/courier/*`, `/admin/*` each use `lazy:` for profile chunk splitting

**Pattern:**
```typescript
import { createBrowserRouter } from 'react-router'
import { SplashScreen } from '../pages/splash/SplashScreen'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <SplashScreen />,  // always loaded — entry point for unauthenticated users
  },
  {
    path: '/client',
    lazy: () => import('../pages/client/ClientLayout').then(m => ({
      Component: m.ClientLayout,
    })),
    children: [],
  },
  {
    path: '/courier',
    lazy: () => import('../pages/courier/CourierLayout').then(m => ({
      Component: m.CourierLayout,
    })),
  },
  {
    path: '/admin',
    lazy: () => import('../pages/admin/AdminLayout').then(m => ({
      Component: m.AdminLayout,
    })),
  },
])
```

---

### `apps/web/src/sw.ts` — (utility, event-driven)

**Source:** RESEARCH.md Pattern 6 (lines 492–507)

**Critical rule:** OneSignal uses its own separate SW at `/push/onesignal/` scope — do NOT import it here. Two separate service workers with different scopes prevent controller conflicts.

**Pattern:**
```typescript
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
// OneSignal handles its own SW at /push/onesignal/ scope — no import needed
```

---

### `apps/web/public/push/onesignal/OneSignalSDKWorker.js` — (config, event-driven)

**Source:** RESEARCH.md Pattern 6 (lines 503–507)

**Critical rule:** This file MUST be at this exact path to match the `serviceWorkerPath` configured in OneSignal init. Placing at root `/` conflicts with the main PWA service worker.

**Pattern:**
```javascript
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
```

---

### `apps/web/src/hooks/useInstallPrompt.ts` — (hook, event-driven)

**Source:** RESEARCH.md Pattern 7: PWA install prompt (lines 563–612)

**Pattern — full implementation:**
```typescript
import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    setIsStandalone(standalone)

    const ua = navigator.userAgent
    const ios = /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua)
    setIsIOS(ios)

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setIsInstallable(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const triggerInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setIsInstallable(false)
    setDeferredPrompt(null)
  }

  return { isInstallable, isIOS, isStandalone, triggerInstall }
}
```

---

### `apps/web/src/components/brand/BreadMark.tsx` — (component, transform)

**Source:** RESEARCH.md Pattern 9 (lines 644–682) + brand.jsx BreadMark function (lines 64–82)

**Rule from UI-SPEC.md:** Pass `reduced={true}` when rendered at less than 48px. On SplashScreen: `size={86}`, `color="#E3AC3F"`, `reduced={false}`. SVG must include `role="img"` and `aria-label="Cheirin de Pão"`.

**Pattern (TypeScript port of brand.jsx source):**
```tsx
interface BreadMarkProps {
  size?: number
  color?: string
  reduced?: boolean
  side?: number
  strong?: number
}

export function BreadMark({
  size = 100,
  color = '#E3AC3F',
  reduced = false,
  side = 0.5,
  strong = 1,
}: BreadMarkProps) {
  if (reduced) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Cheirin de Pão">
        <path d="M20 80 C20 56 33 46 50 46 C67 46 80 56 80 80" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" />
        <path d="M50 46 C44 36 56 31 50 20" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Cheirin de Pão">
      <path d="M22 80 C22 58 34 48 50 48 C66 48 78 58 78 80" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" opacity={strong} />
      <path d="M50 48 C45 39 55 34 50 24" fill="none" stroke={color} strokeWidth="5.5" strokeLinecap="round" opacity={strong} />
      <path d="M36 52 C32 45 39 41 36 34" fill="none" stroke={color} strokeWidth="4.5" strokeLinecap="round" opacity={side} />
      <path d="M64 52 C60 45 67 41 64 34" fill="none" stroke={color} strokeWidth="4.5" strokeLinecap="round" opacity={side} />
    </svg>
  )
}
```

---

### `apps/web/src/components/brand/Icon.tsx` — (component, transform)

**Source:** brand.jsx `Ic` map (lines 99–142) and `Icon` function (lines 144–150)

**Rule from UI-SPEC.md:** Thin wrapper around the `Ic` path map. Props: `name`, `size` (default 22), `stroke` (default 1.9), `color` (default `currentColor`). 24x24 viewBox. All paths are stroke-based (no fill). Used in iOS install sheet (share icon, list icon).

**Pattern:**
```tsx
const Ic: Record<string, string> = {
  arrowU: 'M12 19V5M6 11l6-6 6 6',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  x: 'M6 6l12 12M18 6 6 18',
  chevD: 'M6 9l6 6 6-6',
  // add remaining Ic paths from brand.jsx as needed per feature
}

interface IconProps {
  name: keyof typeof Ic
  size?: number
  stroke?: number
  color?: string
}

export function Icon({ name, size = 22, stroke = 1.9, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d={Ic[name]} />
    </svg>
  )
}
```

Note: Populate `Ic` with the full path map from `brand.jsx` lines 99–142. Phase 1 only needs `arrowU` (share icon for iOS sheet) and `list` — but define all for forward compatibility.

---

### `apps/web/src/pages/splash/SplashScreen.tsx` — (component, request-response)

**Source:** UI-SPEC.md SplashScreen spec (lines 177–209) + RESEARCH.md Pattern 7 (iOS/Android prompt)

**Layout (from UI-SPEC.md):**
1. Full viewport, background `#1E1207` (espresso), flex column centered
2. Top radial vinheta: `radial-gradient(ellipse at 50% 0%, rgba(227,172,63,0.15), transparent)`
3. App icon: 132×132px, border-radius 30%, background `#160C04`, box-shadow `var(--shadow-strong)`, contains `<BreadMark size={86} />`
4. App name: "Cheirin de Pão", 32px Bricolage Grotesque 700, `#FBF3E4`
5. Tagline: "PÃO FRESCO NA PORTA", 12px Hanken Grotesk 700, letter-spacing 0.26em, `#E3AC3F`
6. Flex spacer
7. Install card: white surface, padding 20px, border-radius 22px, `shadow-soft`
   - Gold CTA button: "Instalar e criar conta" — calls `triggerInstall()` on Android, opens iOS sheet on iOS
   - Ghost link: "Já tenho conta — entrar"
8. iOS bottom sheet (conditional): fixed bottom, slides up, see iOS pattern below

**Interaction rules (from UI-SPEC.md):**
- All interactive elements: `min-height: 44px` (WCAG 2.5.5 / UI-10)
- Button hover: `transform: translateY(-1px)` + `filter: brightness(1.05)`, 150ms ease
- iOS sheet mount: `transform: translateY(0)` from `translateY(100%)`, 300ms ease-out
- Reduced motion: `@media (prefers-reduced-motion: reduce)` — set all durations to 0ms

**Copywriting (exact, from UI-SPEC.md):**
- Primary CTA: "Instalar e criar conta"
- Secondary: "Já tenho conta — entrar"
- iOS sheet title: "Adicionar à tela inicial"
- iOS step 1: "Toque no botão de compartilhar"
- iOS step 2: "Role para baixo e toque em"
- iOS step 3: "'Adicionar à Tela Inicial'"
- iOS dismiss: "Entendi"

**Skeleton structure:**
```tsx
import { useInstallPrompt } from '../../hooks/useInstallPrompt'
import { BreadMark } from '../../components/brand/BreadMark'
import { Icon } from '../../components/brand/Icon'

export function SplashScreen() {
  const { isInstallable, isIOS, isStandalone, triggerInstall } = useInstallPrompt()
  const [showIOSSheet, setShowIOSSheet] = useState(false)

  const handleCTA = () => {
    if (isInstallable) {
      triggerInstall()
    } else if (isIOS && !isStandalone) {
      setShowIOSSheet(true)
    }
  }

  return (
    <div className="min-h-screen bg-espresso flex flex-col items-center px-5 relative overflow-hidden">
      {/* radial vinheta */}
      {/* app icon 132px */}
      {/* BreadMark size=86 */}
      {/* app name + tagline */}
      {/* flex spacer */}
      {/* install card */}
      {/* iOS bottom sheet (conditional) */}
    </div>
  )
}
```

---

### `apps/web/vitest.config.ts` — (config)

**Source:** RESEARCH.md Validation Architecture + VALIDATION.md Wave 0 Requirements

**Pattern:**
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
})
```

Install: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`

---

### `apps/api/src/server.ts` — (provider, request-response)

**Source:** RESEARCH.md Pattern 5: Fastify v5 server (lines 463–484)

**Pattern:**
```typescript
import Fastify from 'fastify'
import cors from '@fastify/cors'
import prismaPlugin from './plugins/prisma'
import { healthRoute } from './modules/health/health.route'

const fastify = Fastify({ logger: true })

fastify.register(cors, {
  origin: process.env.NODE_ENV === 'production'
    ? 'https://yourdomain.com'
    : 'http://localhost:5173',
})
fastify.register(prismaPlugin)
fastify.register(healthRoute)

fastify.listen(
  { port: Number(process.env.API_PORT ?? 3001), host: process.env.API_HOST ?? '0.0.0.0' },
  (err) => {
    if (err) { fastify.log.error(err); process.exit(1) }
  }
)
```

---

### `apps/api/src/plugins/prisma.ts` — (plugin, CRUD)

**Source:** RESEARCH.md Code Example "Fastify server with Prisma plugin" (lines 841–861)

**Pattern:**
```typescript
import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import { PrismaClient } from '@prisma/client'

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
  }
}

const prismaPlugin: FastifyPluginAsync = fp(async (fastify) => {
  const prisma = new PrismaClient()
  await prisma.$connect()
  fastify.decorate('prisma', prisma)
  fastify.addHook('onClose', async (app) => {
    await app.prisma.$disconnect()
  })
})

export default prismaPlugin
```

---

### `apps/api/src/modules/health/health.route.ts` — (route, request-response)

**Source:** RESEARCH.md Pattern 5 (lines 463–485)

**Behavior:** GET `/health` — pings MongoDB via `prisma.$runCommandRaw({ ping: 1 })`. Returns `{ ok: true, db: 'connected' }` on success or `503` with error on failure.

**Pattern:**
```typescript
import { FastifyPluginAsync } from 'fastify'

export const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (request, reply) => {
    try {
      await fastify.prisma.$runCommandRaw({ ping: 1 })
      return reply.send({ ok: true, db: 'connected' })
    } catch (err) {
      return reply.status(503).send({ ok: false, db: 'disconnected', error: String(err) })
    }
  })
}
```

---

### `apps/api/prisma/schema.prisma` — (model, CRUD)

**Source:** RESEARCH.md Pattern 4: Prisma v6 + MongoDB (lines 402–454)

**Critical rules:**
- MUST use `prisma@6.19.3` — v7 does NOT support MongoDB
- NEVER run `prisma migrate dev` — MongoDB does not support Prisma migrations
- Only commands: `prisma generate` (after schema changes) and `prisma validate` (CI check)
- Every model: `@id @default(auto()) @map("_id") @db.ObjectId`
- Embedded documents use `type` keyword (composite types, not separate collections)

**15 Collections (from CONTEXT.md D-01):**
USERS, CONDOMINIUMS, COMBOS, PROMOTIONS, SETTINGS, CREDIT_TRANSACTIONS, SCHEDULES, ORDERS, DELIVERIES, DELIVERY_LISTS, SUPPLIERS, PURCHASE_ORDERS, PURCHASE_ORDER_ITEMS, PAYMENTS, NOTIFICATIONS

**Pattern — datasource + generator + User model (base for all 15 models):**
```prisma
datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// === PATTERN for every model ===
// id field: @id @default(auto()) @map("_id") @db.ObjectId
// timestamps: createdAt @default(now()), updatedAt @updatedAt
// relations: String @db.ObjectId with @relation

model User {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  email     String?  @unique
  phone     String?  @unique
  role      UserRole
  name      String
  cpf       String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum UserRole {
  CLIENT
  COURIER
  ADMIN
}

// Embedded document (composite type) example:
type Address {
  street     String
  number     String
  complement String?
  city       String
  zip        String
}

model Condominium {
  id      String    @id @default(auto()) @map("_id") @db.ObjectId
  name    String
  address Address
  type    CondoType
}

enum CondoType {
  SINGLE_ENTRANCE
  BLOCKS
}

// ... remaining 13 collections follow the same @id + @map("_id") + @db.ObjectId pattern
// Reference: Requisitos_v01.md section 5.3 for complete field definitions per collection
```

The remaining 13 models (COMBOS, PROMOTIONS, SETTINGS, CREDIT_TRANSACTIONS, SCHEDULES, ORDERS, DELIVERIES, DELIVERY_LISTS, SUPPLIERS, PURCHASE_ORDERS, PURCHASE_ORDER_ITEMS, PAYMENTS, NOTIFICATIONS) follow the same structural pattern. The executor MUST read `.projeto/Cheirin_de_Pao_Requisitos_v01.md` section 5.3 for field-level detail on each collection.

---

### `packages/shared/src/schemas/index.ts` — (model, transform)

**Source:** RESEARCH.md Standard Stack (Zod 4.4.3)

**Role:** Zod schemas shared between frontend validation and API request parsing. Must be importable from both `apps/web` and `apps/api` via workspace reference.

**Pattern:**
```typescript
import { z } from 'zod'

// Example: base ID schema (MongoDB ObjectId as string)
export const ObjectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId')

// Example: user role enum
export const UserRoleSchema = z.enum(['CLIENT', 'COURIER', 'ADMIN'])

// Re-export all schemas as named exports (no default export)
```

---

### `packages/shared/src/types/index.ts` — (model, transform)

**Role:** TypeScript types inferred from Zod schemas or re-exported from Prisma client. Single source of truth for shared types.

**Pattern:**
```typescript
import type { User, Condominium } from '@prisma/client'
import type { z } from 'zod'
import { UserRoleSchema } from './schemas'

// Re-export Prisma types for consumers that don't depend on Prisma directly
export type { User, Condominium }

// Infer types from Zod schemas
export type UserRole = z.infer<typeof UserRoleSchema>
```

---

## Shared Patterns

### Anti-Patterns to Enforce (RESEARCH.md lines 685–694)

These apply to ALL files and MUST be enforced at every step:

| Anti-Pattern | Correct Alternative |
|---|---|
| `"pipeline"` in turbo.json | `"tasks"` |
| `npm install prisma` (unpinned) | `npm install prisma@6.19.3` |
| `import from 'react-router-dom'` | `import from 'react-router'` |
| `tailwind.config.js` or `tailwind.config.ts` | No config file — use `@theme {}` in CSS |
| `prisma migrate dev` | `prisma generate` only |
| OneSignalSDKWorker.js at root `/` | Place at `/push/onesignal/` with scope config |
| `React.lazy()` for routes | `route.lazy` in React Router v7 |
| `typescript` (unpinned) | `typescript@5.7.x` |
| `@tailwind base/components/utilities` | `@import "tailwindcss"` |

### TypeScript Configuration

**Apply to:** `tsconfig.json` in every workspace package.

All tsconfigs extend `tsconfig.base.json` at root with package-specific overrides:
- `apps/web`: add `"lib": ["ES2022", "DOM"]`, `"jsx": "react-jsx"`
- `apps/api`: add `"lib": ["ES2022"]`, remove DOM types
- `packages/shared`: add `"declaration": true`, `"declarationMap": true`

### Environment Variable Handling

**Apply to:** `apps/api/src/server.ts`

Use `@fastify/env` with JSON schema to validate and coerce env vars at startup:
```typescript
import env from '@fastify/env'
const schema = {
  type: 'object',
  required: ['DATABASE_URL'],
  properties: {
    DATABASE_URL: { type: 'string' },
    API_PORT: { type: 'integer', default: 3001 },
    API_HOST: { type: 'string', default: '0.0.0.0' },
  },
}
fastify.register(env, { schema, dotenv: true })
```

### CORS Configuration

**Apply to:** `apps/api/src/server.ts`

Dev: allow `http://localhost:5173` (Vite dev server). Never allow `*` in production.

### Hit Target Minimum

**Apply to:** All interactive elements in `SplashScreen.tsx` and `IOSInstallSheet` component.

Every button, link, and tap target must have `min-height: 44px` (WCAG 2.5.5). Use Tailwind `min-h-[44px]` utility.

### Reduced Motion

**Apply to:** All animated elements in `SplashScreen.tsx`.

```css
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0ms !important; animation-duration: 0ms !important; }
}
```

Or in Tailwind: use `motion-reduce:transition-none` utility.

### Font Loading

**Apply to:** `apps/web/src/main.tsx`

Import Fontsource packages (self-hosted, works offline) — NOT Google Fonts CDN link tags. CDN breaks offline PWA mode. Always import specific weights for Hanken Grotesk (400, 500, 600, 700, 800); use variable import for Bricolage Grotesque.

---

## No Analog Found

All 37 files have no existing codebase analog — this is a greenfield project.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| All files listed above | various | various | Project has zero existing source files. RESEARCH.md patterns are canonical. |

**Executor instruction:** For every file without a codebase analog, treat the corresponding RESEARCH.md Pattern section as the analog. The pattern excerpts in the "Pattern Assignments" sections above are copy-paste ready implementations derived from those patterns.

---

## Critical Version Pins (enforce on every package.json)

| Package | Version to Pin | Why |
|---------|---------------|-----|
| `prisma` | `6.19.3` (exact) | v7 does NOT support MongoDB — hard blocker |
| `@prisma/client` | `6.19.3` (exact) | must match prisma exactly |
| `typescript` | `5.7.x` | v6 is strict-by-default — breaks greenfield |
| `turbo` | `2.9.18` | for reproducible dev environment |

---

## Metadata

**Analog search scope:** Entire project root — no source files found
**Files scanned:** 0 source files (greenfield)
**Pattern sources:** `01-RESEARCH.md`, `01-UI-SPEC.md`, `.projeto/design_handoff_cheirin_pao/app/brand.jsx`
**Pattern extraction date:** 2026-06-13
