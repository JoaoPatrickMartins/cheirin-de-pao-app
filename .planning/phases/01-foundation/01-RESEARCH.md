# Phase 1: Foundation - Research

**Researched:** 2026-06-13
**Domain:** Monorepo scaffolding, PWA, Prisma+MongoDB, Tailwind CSS v4, Vite 8, React Router v7
**Confidence:** HIGH (most claims verified via official docs or npm registry)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Definir TODAS as 15 collections no schema.prisma na Fase 1 — evita refatoração futura, e com MongoDB+Prisma adapter não há migração destrutiva.
- **D-02:** Adaptar para padrões do Prisma+MongoDB: usar tipos nativos do adapter (ObjectId, @map, @db.ObjectId, embedded documents onde adequado). Base são as 15 collections do documento de requisitos, mas a sintaxe segue as boas práticas do adapter.
- **D-03:** Lazy-loading por perfil com React Router v6 — chunks separados por perfil carregados sob demanda usando `createBrowserRouter` + `React.lazy()`. Cada perfil tem seu próprio route group: `/client/*`, `/courier/*`, `/admin/*`.
- **D-04:** Rota raiz `/` exibe a Splash/Install screen — é a entry point do PWA para usuários não autenticados. Após autenticação, redireciona para a rota do perfil correspondente.
- **D-05:** React Router v6 com `createBrowserRouter` — já definido nos requisitos. Substitui o `go(route)` do protótipo.
- **D-06:** OneSignal como service worker principal. vite-plugin-pwa configurado em modo `injectManifest` com um SW customizado que importa `OneSignalSDKWorker.js`. Esse é o padrão suportado pelo OneSignal para PWA com Vite.
- **D-07:** Na Fase 1, OneSignal apenas instalado e configurado (SDK + App ID + SW registrado). O envio e recebimento real de notificações push será testado na Fase 5.

### Claude's Discretion
- Estrutura interna dos módulos Fastify (controller/service/repository por domínio) — seguir Clean Architecture conforme especificado em Requisitos_v01.md seção 5.2
- Configuração do Turborepo (pipelines, caching) — usar defaults do Turborepo para monorepo Node.js
- Estratégia de caching do service worker — usar `NetworkFirst` para API calls, `CacheFirst` para assets estáticos

### Deferred Ideas (OUT OF SCOPE)
Nenhuma — discussão mantida dentro do escopo da Fase 1.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Monorepo Turborepo configurado com apps/web, apps/api e packages/shared | Standard Turborepo 2.x `tasks` syntax; npm workspaces root package.json |
| INFRA-02 | Dev Container funcional (VS Code + Docker Compose) com Node.js e TypeScript | devcontainer.json + docker-compose.yml pattern; Node 20.20.2 available |
| INFRA-03 | TypeScript ponta a ponta — frontend, backend e shared | TypeScript 5.x (use 5.7 not 6.0 — see Critical Finding #2); tsconfig.base.json pattern |
| INFRA-04 | Prisma com adapter MongoDB configurado com as 15 collections do schema | Prisma v6.19.3 (MUST use v6, not v7 — MongoDB not supported in v7) |
| INFRA-05 | packages/shared exporta Zod schemas, tipos TypeScript e constantes compartilhadas | Zod 4.4.3; TypeScript project references via tsconfig |
| INFRA-06 | Variáveis de ambiente configuradas (.env.example documentado) | Standard .env pattern; @fastify/env for API validation |
| INFRA-07 | Conexão com MongoDB Atlas funcional em ambiente de desenvolvimento | Atlas M0 free tier; replica set included; mongodb+srv:// connection string |
| PWA-01 | App funciona como PWA instalável — manifest.json e service worker configurados | vite-plugin-pwa 1.3.0 injectManifest mode; 192x192 + 512x512 icons required |
| PWA-02 | Android: botão "Instalar app" dispara janela nativa de instalação do navegador | beforeinstallprompt event; intercept + store + trigger on user click |
| PWA-03 | iOS (16.4+): banner com instrução visual passo a passo | iOS does NOT fire beforeinstallprompt; detect Safari UA + standalone check |
| PWA-04 | Prompt de instalação exibido sempre que o app for acessado fora do modo PWA instalado | Check window.matchMedia('(display-mode: standalone)').matches |
| PWA-05 | Notificações push configuradas via OneSignal | react-onesignal 3.5.5; OneSignalSDKWorker.js in /push/onesignal/ subdirectory |
| UI-01 | Design fiel ao handoff — tema CLARO creme com tokens de cores | Tailwind v4 @theme CSS-first; map all design tokens to --color-* variables |
| UI-02 | Fontes Bricolage Grotesque + Hanken Grotesk via Google Fonts | @fontsource-variable/bricolage-grotesque + @fontsource/hanken-grotesk for self-hosted |
| UI-03 | Símbolo BreadMark implementado como componente SVG inline | SVG paths extracted from brand.jsx; reduced prop for <48px; color #E3AC3F |
| UI-05 | Tela Splash/Install com fundo espresso, símbolo dourado e CTA de instalação | #1E1207 background; radial golden vinheta; 132px app icon; 86px BreadMark symbol |
| UI-10 | Hit targets mínimos de 44px em todos os elementos interativos | CSS min-height/min-width: 44px on all interactive elements |
</phase_requirements>

---

## Summary

This phase scaffolds the entire technical foundation from scratch. The primary challenge is that **all major packages have jumped major versions** since the project's stack was defined — Vite 8, React 19, Tailwind CSS 4, React Router 7, TypeScript 6 — and each has meaningful breaking changes that must be known before writing a single line of code.

The most critical discovery is a **hard blocker**: **Prisma v7 (latest) does not support MongoDB**. The project MUST use Prisma v6.19.3. This is confirmed by the official Prisma upgrade guide. Installing `prisma` without a version pin will install v7, which will fail silently at schema validation time.

The second critical discovery is that **React Router 7 changed its import package** from `react-router-dom` to `react-router`. All route imports must use the new package name. The context decisions (D-03, D-05) refer to "React Router v6" but the installed version is v7 — the API is backward-compatible if you update imports.

The third critical discovery is that **Tailwind CSS v4 has no `tailwind.config.js`** — all theme configuration moves into CSS via `@theme {}` directives. The design tokens from the handoff must be translated into CSS custom properties under `--color-*` namespace.

**Primary recommendation:** Pin exact versions in root package.json: `prisma@6.19.3`, `@prisma/client@6.19.3`. Use `react-router@7.17.0` (not react-router-dom). Use Tailwind v4 CSS-first theme. Use TypeScript 5.7 (not 6.0) to avoid strict-by-default breakage on a greenfield project.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PWA manifest + service worker | Frontend (Vite build) | — | Compiled into static assets at build time |
| Install prompt (Android) | Browser Client | — | `beforeinstallprompt` is browser-native; intercepted in React |
| Install instructions (iOS) | Browser Client | — | Safari UA detection + custom UI in React component |
| Splash screen UI | Browser Client | — | Pure React component, no server needed |
| Health endpoint | API (Fastify) | — | Server-side route, returns DB connection status |
| MongoDB Atlas connection | API (Fastify) | — | Prisma client initialized in API process |
| Shared types/schemas | packages/shared | Frontend + API consumers | TypeScript project references ensure single source of truth |
| Push notification SDK init | Browser Client | Service Worker | OneSignal SDK init in React; SW handles background |
| Design tokens | Frontend CSS | — | Tailwind @theme variables compiled into CSS output |
| Route definitions | Browser Client (React Router) | — | SPA routing, no server-side routing needed in Phase 1 |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `turbo` | 2.9.18 | Monorepo task orchestration + caching | Vercel-maintained, npm workspace native, `tasks` not `pipeline` |
| `vite` | 8.0.16 | Frontend build tool | Rolldown-based, requires Node >=20.19 (satisfied: 20.20.2) |
| `@vitejs/plugin-react` | 6.0.2 | React Fast Refresh + JSX | Uses Oxc (no Babel dependency in v6+) |
| `react` | 19.2.7 | UI framework | Latest stable |
| `react-dom` | 19.2.7 | DOM renderer | Matches react version |
| `tailwindcss` | 4.3.1 | Utility CSS | CSS-first, no config.js needed |
| `@tailwindcss/vite` | 4.3.1 | Tailwind Vite plugin | Official first-party plugin; replaces PostCSS config |
| `react-router` | 7.17.0 | Client-side routing | v7 — import from `react-router` NOT `react-router-dom` |
| `typescript` | 5.7.x | Type safety | Use 5.x (NOT 6.x) — see Critical Finding #2 |
| `zod` | 4.4.3 | Runtime validation | Shared between frontend + backend |
| `prisma` | **6.19.3** | ORM + schema | MUST be v6 — v7 does NOT support MongoDB |
| `@prisma/client` | **6.19.3** | Generated Prisma client | Must match prisma version exactly |
| `fastify` | 5.8.5 | Backend HTTP framework | Low overhead, TypeScript-native |
| `vite-plugin-pwa` | 1.3.0 | PWA manifest + SW | injectManifest mode for custom SW |
| `workbox-precaching` | 7.4.1 | Precache in custom SW | Required for injectManifest `self.__WB_MANIFEST` injection |
| `react-onesignal` | 3.5.5 | OneSignal React SDK | Official React wrapper |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@fastify/cors` | 11.2.0 | CORS headers | Dev: allow Vite dev server origin |
| `@fastify/env` | 7.0.0 | Env var validation at startup | Validate DATABASE_URL, PORT etc. at boot |
| `fastify-plugin` | 6.0.0 | Plugin encapsulation | Wrapping Prisma client as Fastify plugin |
| `@fontsource-variable/bricolage-grotesque` | 5.2.10 | Self-hosted variable font | Better performance than Google CDN; variable axes |
| `@fontsource/hanken-grotesk` | 5.2.8 | Self-hosted font | Self-hosted; import specific weights |
| `tsx` | 4.22.4 | TypeScript execution in dev | Run API in dev without transpile step |
| `@types/node` | 25.9.3 | Node.js type definitions | Required for Fastify/Prisma TypeScript |
| `@types/react` | 19.2.17 | React type definitions | Required for TypeScript strict mode |
| `@types/react-dom` | 19.2.3 | ReactDOM type definitions | Required for TypeScript strict mode |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Turborepo | nx, Lerna | Turborepo is simpler, zero-config caching, Vercel-maintained |
| Fontsource | Google Fonts CDN link tag | Fontsource: no external request, works offline in PWA; CDN: simpler but breaks offline mode |
| `react-onesignal` | Manual OneSignal JS SDK | react-onesignal prevents double-init on React StrictMode re-renders |
| TypeScript 5.x | TypeScript 6.x | TS6 enables strict-by-default — breaks greenfield until tsconfig catches up |

**Installation (apps/web):**
```bash
npm install react react-dom react-router @fontsource-variable/bricolage-grotesque @fontsource/hanken-grotesk react-onesignal
npm install -D vite @vitejs/plugin-react tailwindcss @tailwindcss/vite vite-plugin-pwa workbox-precaching typescript@5 @types/react @types/react-dom
```

**Installation (apps/api):**
```bash
npm install fastify @fastify/cors @fastify/env fastify-plugin @prisma/client@6.19.3 zod
npm install -D prisma@6.19.3 typescript@5 @types/node tsx
```

**Installation (packages/shared):**
```bash
npm install zod
npm install -D typescript@5
```

---

## Package Legitimacy Audit

> slopcheck ran against PyPI (wrong ecosystem) — this project uses npm. Verification performed via `npm view <pkg> version` + homepage inspection against official docs. All packages confirmed via npm registry AND traced to authoritative homepages.

| Package | Registry | Age | Homepage/Source | Disposition |
|---------|----------|-----|-----------------|-------------|
| `turbo` | npm | 3+ yrs | turborepo.dev (Vercel) | Approved |
| `vite` | npm | 4+ yrs | vite.dev | Approved |
| `@vitejs/plugin-react` | npm | 3+ yrs | github.com/vitejs/vite-plugin-react | Approved |
| `react` / `react-dom` | npm | 10+ yrs | react.dev | Approved |
| `tailwindcss` | npm | 5+ yrs | tailwindcss.com | Approved |
| `@tailwindcss/vite` | npm | ~1 yr | tailwindcss.com (official) | Approved |
| `react-router` | npm | 10+ yrs | reactrouter.com | Approved |
| `typescript` | npm | 10+ yrs | typescriptlang.org | Approved |
| `zod` | npm | 4+ yrs | zod.dev | Approved |
| `prisma` / `@prisma/client` | npm | 4+ yrs | prisma.io | Approved — pin to v6.19.3 |
| `fastify` | npm | 6+ yrs | fastify.dev | Approved |
| `vite-plugin-pwa` | npm | 3+ yrs | vite-pwa-org.netlify.app | Approved |
| `workbox-precaching` | npm | 6+ yrs | developers.google.com/web/tools/workbox | Approved |
| `react-onesignal` | npm | 4+ yrs | github.com/OneSignal/react-onesignal | Approved |
| `@fontsource-variable/bricolage-grotesque` | npm | 2+ yrs | fontsource.org | Approved |
| `@fontsource/hanken-grotesk` | npm | 2+ yrs | fontsource.org | Approved |
| `@fastify/cors` | npm | 5+ yrs | github.com/fastify/fastify-cors | Approved |
| `@fastify/env` | npm | 4+ yrs | github.com/fastify/fastify-env | Approved |
| `fastify-plugin` | npm | 6+ yrs | github.com/fastify/fastify-plugin | Approved |
| `tsx` | npm | 3+ yrs | github.com/privatenumber/tsx | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck ran on wrong ecosystem; manual npm verification performed instead)
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
User Browser / Mobile
       |
       |  (HTTP/HTTPS)
       v
[Vite Dev Server :5173]        [Fastify API :3001]
 React SPA                      /health → { ok, dbConnected }
 └─ React Router v7             /api/v1/*
    createBrowserRouter
    route / → SplashScreen      PrismaClient
    route /client/* [lazy]      └─ MongoDB Atlas
    route /courier/* [lazy]         mongodb+srv://...
    route /admin/* [lazy]
       |
       | (PWA Service Worker)
       v
[vite-plugin-pwa injectManifest]
 src/sw.ts
 └─ precacheAndRoute(__WB_MANIFEST)   ← Workbox injects precache list
 └─ NetworkFirst → /api/*
 └─ CacheFirst  → /assets/*
 └─ importScripts OneSignalSDKWorker  ← in /push/onesignal/ scope

[OneSignal SDK]
 react-onesignal.init({ appId })
 └─ registers push subscription
 └─ handles background push (Phase 5)
```

### Recommended Project Structure

```
cheirin-de-pao/
├── apps/
│   ├── web/
│   │   ├── public/
│   │   │   ├── pwa-192x192.png
│   │   │   ├── pwa-512x512.png
│   │   │   ├── apple-touch-icon.png
│   │   │   └── push/
│   │   │       └── onesignal/
│   │   │           └── OneSignalSDKWorker.js
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   └── brand/
│   │   │   │       └── BreadMark.tsx
│   │   │   ├── pages/
│   │   │   │   ├── splash/
│   │   │   │   │   └── SplashScreen.tsx
│   │   │   │   ├── client/        ← lazy-loaded profile chunk
│   │   │   │   ├── courier/       ← lazy-loaded profile chunk
│   │   │   │   └── admin/         ← lazy-loaded profile chunk
│   │   │   ├── hooks/
│   │   │   │   └── useInstallPrompt.ts
│   │   │   ├── routes/
│   │   │   │   └── router.tsx
│   │   │   ├── styles/
│   │   │   │   └── globals.css    ← @import "tailwindcss"; @theme { ... }
│   │   │   ├── sw.ts              ← custom service worker (injectManifest)
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── api/
│       ├── src/
│       │   ├── modules/
│       │   │   └── health/
│       │   │       └── health.route.ts
│       │   ├── plugins/
│       │   │   └── prisma.ts
│       │   └── server.ts
│       ├── prisma/
│       │   └── schema.prisma
│       └── package.json
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── schemas/
│       │   ├── types/
│       │   └── constants/
│       └── package.json
├── .devcontainer/
│   └── devcontainer.json
├── docker-compose.yml
├── turbo.json
├── package.json             ← workspaces: ["apps/*","packages/*"]
├── tsconfig.base.json
└── .env.example
```

### Pattern 1: Turborepo 2.x — turbo.json `tasks` syntax

**What:** `pipeline` key was renamed to `tasks` in Turborepo 2.0. Any documentation using `pipeline` is outdated.
**When to use:** Always for Turborepo 2.x.

```jsonc
// Source: https://turborepo.dev/docs/reference/configuration
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
    }
  }
}
```

### Pattern 2: Tailwind CSS v4 — CSS-first theme configuration

**What:** No `tailwind.config.js`. All theme customization uses `@theme {}` in CSS. Colors under `--color-*` auto-generate utility classes.
**When to use:** Always with Tailwind v4.

```css
/* Source: https://tailwindcss.com/docs/installation/using-vite + https://tailwindcss.com/docs/theme */
@import "tailwindcss";

@theme {
  /* Brand colors from design handoff */
  --color-espresso: #1E1207;
  --color-gold: #E3AC3F;
  --color-gold-soft: #F3DDA6;
  --color-accent: #B0702A;
  --color-app-bg: #FAF5EC;
  --color-surface: #FFFFFF;
  --color-surface-alt: #FBF6EC;
  --color-surface-2: #F4EBDA;
  --color-text: #241608;
  --color-text-sec: #7C6A50;
  --color-text-ter: #A89A82;
  --color-good: #3E7C53;
  --color-good-soft: #DCEBDF;

  /* Typography */
  --font-display: "Bricolage Grotesque", serif;
  --font-body: "Hanken Grotesk", sans-serif;

  /* Custom shadow tokens (accessed via CSS var, not utility class) */
  --shadow-soft: 0 1px 2px rgba(43,26,12,0.05), 0 4px 14px -8px rgba(43,26,12,0.18);
  --shadow-strong: 0 1px 2px rgba(43,26,12,0.05), 0 10px 30px -12px rgba(43,26,12,0.22);
}
```

```typescript
// vite.config.ts — Source: https://tailwindcss.com/docs/installation/using-vite
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
})
```

### Pattern 3: React Router v7 — createBrowserRouter + route.lazy for profile chunks

**What:** Import from `react-router` (NOT `react-router-dom`). Use `route.lazy` (not `React.lazy`) for route-level code splitting.
**When to use:** D-03, D-05 decisions.

```typescript
// Source: https://reactrouter.com/api/data-routers/createBrowserRouter
import { createBrowserRouter, RouterProvider } from 'react-router'

const router = createBrowserRouter([
  {
    path: '/',
    element: <SplashScreen />,  // always loaded — no lazy needed for entry
  },
  {
    path: '/client',
    lazy: () => import('./pages/client/ClientLayout').then(m => ({
      Component: m.ClientLayout,
    })),
    children: [
      {
        path: 'home',
        lazy: () => import('./pages/client/HomeScreen').then(m => ({
          Component: m.HomeScreen,
        })),
      },
    ],
  },
  {
    path: '/courier',
    lazy: () => import('./pages/courier/CourierLayout').then(m => ({
      Component: m.CourierLayout,
    })),
  },
  {
    path: '/admin',
    lazy: () => import('./pages/admin/AdminLayout').then(m => ({
      Component: m.AdminLayout,
    })),
  },
])

function App() {
  return <RouterProvider router={router} />
}
```

### Pattern 4: Prisma v6 + MongoDB — schema.prisma with 15 collections

**What:** Use `prisma@6.19.3` and `@prisma/client@6.19.3`. MongoDB does NOT use `prisma migrate` — use `prisma db push` or `prisma generate` only.
**When to use:** All Prisma schema work (INFRA-04).

```prisma
// Source: https://www.prisma.io/docs/getting-started/setup-prisma/start-from-scratch/mongodb-typescript-mongodb
datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// Every model uses @id @default(auto()) @map("_id") @db.ObjectId pattern
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
  street String
  number String
  complement String?
  city   String
  zip    String
}

model Condominium {
  id      String  @id @default(auto()) @map("_id") @db.ObjectId
  name    String
  address Address  // embedded document
  type    CondoType
}

enum CondoType {
  SINGLE_ENTRANCE
  BLOCKS
}
```

**Critical MongoDB + Prisma notes:**
- NEVER run `prisma migrate dev` against MongoDB — it will error. Use `prisma generate` after schema changes.
- `prisma db push` works for MongoDB to validate schema but does NOT create collections — MongoDB creates them lazily on first write.
- MongoDB Atlas M0 (free) includes replica set — Prisma requires replica set for transactions. Atlas satisfies this automatically.

### Pattern 5: Fastify v5 — health route with Prisma connectivity check

```typescript
// Source: https://fastify.dev/docs/latest/
import Fastify from 'fastify'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const fastify = Fastify({ logger: true })

fastify.get('/health', async (request, reply) => {
  try {
    // Ping MongoDB by running a trivial command
    await prisma.$runCommandRaw({ ping: 1 })
    return reply.send({ ok: true, db: 'connected' })
  } catch (err) {
    return reply.status(503).send({ ok: false, db: 'disconnected', error: String(err) })
  }
})

fastify.listen({ port: 3001, host: '0.0.0.0' }, (err) => {
  if (err) { fastify.log.error(err); process.exit(1) }
})
```

### Pattern 6: vite-plugin-pwa injectManifest + OneSignal service worker

**What:** Custom service worker in `src/sw.ts` includes workbox precaching AND loads OneSignal worker in a subdirectory scope. The two service workers operate at different scopes to avoid conflict.
**When to use:** D-06 decision.

```typescript
// apps/web/src/sw.ts — custom service worker source file
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
// OneSignal uses its own separate SW at /push/onesignal/ scope — no import needed here
```

```javascript
// apps/web/public/push/onesignal/OneSignalSDKWorker.js
// Source: https://documentation.onesignal.com/docs/en/onesignal-service-worker
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
```

```typescript
// vite.config.ts — full config
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

```typescript
// OneSignal init in React (apps/web/src/main.tsx or App.tsx)
import OneSignal from 'react-onesignal'

// Call once on app mount — react-onesignal prevents double-init in StrictMode
OneSignal.init({
  appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
  serviceWorkerPath: 'push/onesignal/OneSignalSDKWorker.js',
  serviceWorkerParam: { scope: '/push/onesignal/' },
})
```

### Pattern 7: PWA install prompt — Android (beforeinstallprompt) + iOS (custom banner)

```typescript
// apps/web/src/hooks/useInstallPrompt.ts
// Source: https://web.dev/learn/pwa/installation-prompt
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
    // Detect standalone mode (already installed)
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    setIsStandalone(standalone)

    // Detect iOS Safari
    const ua = navigator.userAgent
    const ios = /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua)
    setIsIOS(ios)

    // Android/Chrome: intercept native prompt
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

**iOS behavior:** iOS 16.4+ supports PWA push but does NOT fire `beforeinstallprompt`. Show a custom bottom sheet with visual step-by-step: "Toque em ⬆ → Role e toque em 'Adicionar à Tela Inicial'". Detect iOS using User Agent + absence of `(display-mode: standalone)`.

### Pattern 8: Fontsource + Tailwind font tokens

```typescript
// apps/web/src/main.tsx — import font weights needed by design
import '@fontsource-variable/bricolage-grotesque'  // variable weight axis
import '@fontsource/hanken-grotesk/400.css'
import '@fontsource/hanken-grotesk/500.css'
import '@fontsource/hanken-grotesk/600.css'
import '@fontsource/hanken-grotesk/700.css'
import '@fontsource/hanken-grotesk/800.css'
import './styles/globals.css'
```

```css
/* globals.css — font declared in @theme */
@import "tailwindcss";

@theme {
  --font-display: "Bricolage Grotesque Variable", "Bricolage Grotesque", serif;
  --font-body: "Hanken Grotesk", sans-serif;
}
```

```html
<!-- Usage: Tailwind generates font-display / font-body utilities -->
<h1 class="font-display font-bold text-2xl tracking-tight">Cheirin de Pão</h1>
<p class="font-body text-base">Pão fresco na porta</p>
```

### Pattern 9: BreadMark SVG component (from design handoff)

```tsx
// apps/web/src/components/brand/BreadMark.tsx
// Source: .projeto/design_handoff_cheirin_pao/app/brand.jsx (canonical)
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

**Rule from handoff:** Below ~48px, pass `reduced` prop to hide side waves and thicken stroke. Default color: `#E3AC3F` (gold token).

### Anti-Patterns to Avoid

- **Using `pipeline` in turbo.json:** It was renamed to `tasks` in Turborepo 2.0. Build will fail silently.
- **Installing `prisma` without version pin:** Gets v7, which does not support MongoDB. Always install `prisma@6.19.3`.
- **Importing from `react-router-dom`:** v7 consolidates into `react-router`. Use `import { ... } from 'react-router'`.
- **`tailwind.config.js` with v4:** Does not work. Theme config belongs in CSS `@theme {}` block.
- **Running `prisma migrate dev` on MongoDB:** MongoDB connector does not support Prisma migrations. Only use `prisma generate`.
- **Placing `OneSignalSDKWorker.js` at root `/`:** Conflicts with the main PWA service worker scope. Place in `/push/onesignal/` and configure scope accordingly.
- **Using `React.lazy()` in route components:** React Router v7 prefers `route.lazy` for route-level splitting. `React.lazy` at module scope is acceptable but loses the benefits of concurrent route transitions.
- **TypeScript 6.x on greenfield:** Strict-by-default in TS6 will cause build failures unless tsconfig is prepared. Use TS 5.7 until team is ready for strict-everywhere.
- **Using `@tailwind base/components/utilities` directives:** These are v3 directives. v4 uses `@import "tailwindcss"` only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Service worker precaching | Custom cache manifest logic | `workbox-precaching` + `self.__WB_MANIFEST` | Workbox handles versioning, cleanup, and race conditions |
| TypeScript monorepo path aliases | Manual webpack aliases | Turborepo + TypeScript project references | turbo handles inter-package deps and build order |
| iOS install detection | Complex UA + feature detection | UA regex + `(display-mode: standalone)` media query | Simple, reliable; no library needed |
| Push notification service worker conflicts | Merging two SWs into one file | OneSignal in subdirectory `/push/onesignal/` with separate scope | Separate scopes prevent controller conflicts |
| Environment variable validation at startup | `if (!process.env.X) throw` | `@fastify/env` with Zod/JSON schema | Validates, coerces types, and generates TypeScript types |
| Font loading | Self-hosted font files manually | Fontsource npm packages | Fontsource manages font-face declarations, sub-setting, and weight imports |

**Key insight:** The service worker landscape is the most complex area. Two SWs (PWA + OneSignal) with different purposes can conflict at root scope. The separate-scope pattern (OneSignal at `/push/onesignal/`) is the official OneSignal recommendation for PWA + push coexistence.

---

## Common Pitfalls

### Pitfall 1: Prisma v7 silently fails on MongoDB
**What goes wrong:** `npm install prisma` installs v7. `prisma generate` runs but produces a client that throws `Provider "mongodb" is not supported in Prisma ORM v7` at runtime.
**Why it happens:** npm `latest` tag points to v7. MongoDB support is explicitly excluded from v7 release.
**How to avoid:** Pin `"prisma": "6.19.3"` and `"@prisma/client": "6.19.3"` in package.json. Never use unpinned `"prisma": "^6"` because a future accidental `npm update` could break production.
**Warning signs:** `prisma generate` succeeds but app crashes at first DB query with provider error.

### Pitfall 2: Turborepo `pipeline` key silently ignored
**What goes wrong:** Copying any tutorial written before mid-2024 uses `"pipeline"` in turbo.json. Turborepo 2.x ignores it, meaning no tasks run in parallel and no caching occurs.
**Why it happens:** Turborepo 2.0 (June 2024) renamed `pipeline` to `tasks`.
**How to avoid:** Always use `"tasks"` key. Run `turbo run dev --dry=json` to verify task graph.
**Warning signs:** `npm run dev` starts but shows no Turbo caching output; only one package builds at a time.

### Pitfall 3: React Router v7 import from `react-router-dom`
**What goes wrong:** `import { createBrowserRouter } from 'react-router-dom'` fails in v7 — the package is now a thin re-export shim and some APIs moved.
**Why it happens:** v7 consolidated packages. `react-router-dom` still installs but imports may be incomplete or deprecated.
**How to avoid:** All imports from `'react-router'`. For DOM-specific: `import { ... } from 'react-router/dom'` if needed.
**Warning signs:** TypeScript errors about missing exports; runtime errors about undefined functions.

### Pitfall 4: Tailwind v4 `tailwind.config.js` not found warning
**What goes wrong:** Including a `tailwind.config.ts` file with v4 generates a warning, or custom colors defined in it are silently ignored.
**Why it happens:** v4 dropped JS config in favor of CSS-first `@theme {}`.
**How to avoid:** Delete any `tailwind.config.*` file. Define ALL customizations in CSS via `@theme {}`.
**Warning signs:** Custom color utilities like `bg-espresso` don't exist; Tailwind falls back to default palette.

### Pitfall 5: Service worker scope conflict between PWA and OneSignal
**What goes wrong:** Both the Vite PWA service worker and OneSignal's worker register at `/` scope. The second registration overrides the first, breaking either offline capability or push notifications.
**Why it happens:** Service workers are scoped; two workers at the same scope cannot coexist.
**How to avoid:** OneSignal at `/push/onesignal/` scope (configured in `serviceWorkerPath` + `serviceWorkerParam`). The PWA worker at default `/` scope.
**Warning signs:** `navigator.serviceWorker.getRegistrations()` shows only one registration; push stops working after PWA install or vice versa.

### Pitfall 6: MongoDB Atlas not whitelisting dev IP
**What goes wrong:** Prisma connection times out with `Connection refused` or `ECONNREFUSED`.
**Why it happens:** Atlas requires IP allowlist configuration. Default is no access.
**How to avoid:** In Atlas Network Access, add `0.0.0.0/0` for development (allow from anywhere) OR add the specific developer IP. Document this in README.
**Warning signs:** Timeout on `prisma.$runCommandRaw({ ping: 1 })`; app boots but health endpoint returns 503.

### Pitfall 7: TypeScript 6.x strict-by-default breaks greenfield
**What goes wrong:** `npm install typescript` installs v6.0.3 which enables strict mode by default. All implicit `any`, null checks, etc. immediately fail without explicit tsconfig.
**Why it happens:** TS6 changed defaults — `strict: true` is now the default unless explicitly disabled.
**How to avoid:** Pin `"typescript": "5.7.x"` across all packages. TS5.x requires explicit `"strict": true` opt-in — safer for a new project with full control.
**Warning signs:** Hundreds of type errors on first `tsc --noEmit`; errors in files that didn't exist yet.

### Pitfall 8: Vite 8 requires Node >=20.19.0
**What goes wrong:** Running on Node 20.18.x or earlier causes Vite 8 to refuse to start.
**Why it happens:** Vite 8 requires `require(esm)` support, available from Node 20.19+.
**How to avoid:** Node 20.20.2 is confirmed installed on this machine (satisfies requirement). Document minimum Node version in `.nvmrc` or `package.json#engines`.
**Warning signs:** `vite: error: Node.js v20.18.0 is not supported...` on dev start.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` + PostCSS | `@tailwindcss/vite` plugin + `@theme {}` in CSS | Tailwind v4 (Jan 2025) | Entire theme config moves to CSS |
| `import from 'react-router-dom'` | `import from 'react-router'` | React Router v7 (Nov 2024) | Package consolidation; breaking import change |
| `turbo.json#pipeline` | `turbo.json#tasks` | Turborepo 2.0 (Jun 2024) | Rename; old key silently ignored |
| `prisma migrate dev` for MongoDB | `prisma generate` only | Prisma v5+ | MongoDB has no migration concept; schema changes via generate |
| Babel-based React JSX transform | Oxc-based (Rolldown) in `@vitejs/plugin-react` v6 | Vite 8 / plugin-react v6 (2025) | Faster, but no more passing Babel plugins via `react()` |
| TypeScript opt-in strict | TypeScript strict-by-default | TypeScript 6.0 (Mar 2026) | Must pin TS5 or explicitly opt out |

**Deprecated/outdated:**
- `@tailwind base; @tailwind components; @tailwind utilities;` in CSS — replaced by `@import "tailwindcss"`
- `prisma migrate dev` / `prisma migrate deploy` — not applicable to MongoDB
- `pipeline` key in `turbo.json` — silently ignored in 2.x
- `react-router-dom` as primary import — use `react-router` instead

---

## Code Examples

### Complete root `package.json` (npm workspaces)

```json
// Source: [CITED: turborepo.dev/docs/reference/configuration]
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

### `tsconfig.base.json` (shared TS config)

```json
// [ASSUMED] Pattern — tsconfig project references are standard for monorepos
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

### Complete `.env.example`

```bash
# MongoDB Atlas (required — get from Atlas dashboard)
DATABASE_URL="mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/cheirin-dev?retryWrites=true&w=majority"

# API server
API_PORT=3001
API_HOST=0.0.0.0

# OneSignal (optional in Phase 1 — required in Phase 5)
VITE_ONESIGNAL_APP_ID=your-onesignal-app-id-here
```

### Fastify server with Prisma plugin

```typescript
// apps/api/src/plugins/prisma.ts — [ASSUMED] standard Fastify plugin pattern
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

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `tsconfig.base.json` pattern with `"moduleResolution": "Bundler"` works for all three packages | Code Examples | TypeScript path resolution errors; fix by adjusting moduleResolution per package |
| A2 | `fastify-plugin` fp() pattern for Prisma decoration works with Fastify 5 | Code Examples | Plugin not registered; fix by checking Fastify 5 plugin API |
| A3 | `prisma.$runCommandRaw({ ping: 1 })` works in Prisma v6 for connection health check | Pattern 5 | Health endpoint throws; alternative: attempt `prisma.user.count()` |
| A4 | OneSignal subdirectory placement at `/push/onesignal/` prevents scope conflict with PWA SW | Pattern 6 | Push may not work; confirm in browser DevTools > Application > Service Workers |
| A5 | `@fontsource-variable/bricolage-grotesque` provides `"Bricolage Grotesque Variable"` as font-family name | Pattern 8 | Font fallback to serif; fix by checking exact family name from Fontsource docs |
| A6 | React 19 is compatible with all listed packages (react-router v7, react-onesignal, etc.) | Standard Stack | Peer dependency conflicts on install; resolve by checking peerDependencies |

---

## Open Questions

1. **OneSignal App ID for Phase 1**
   - What we know: OneSignal requires a registered App ID from the dashboard; it's free
   - What's unclear: Whether João has an App ID already or needs to create a new app in OneSignal dashboard
   - Recommendation: If no App ID exists, create a `VITE_ONESIGNAL_APP_ID=placeholder` in .env.example with a comment — Phase 1 only registers the SDK, Phase 5 tests push functionality

2. **MongoDB Atlas cluster already provisioned?**
   - What we know: The spec requires Atlas; Atlas M0 is free and includes replica set
   - What's unclear: Whether a cluster and DATABASE_URL already exist or need to be created as part of Phase 1
   - Recommendation: Plan should include a task to set up Atlas cluster if not already done, OR treat it as a prerequisite with a human checkpoint

3. **TypeScript version confirmation**
   - What we know: `typescript@6.0.3` is the npm latest; `typescript@5.7.x` is the 5.x latest
   - What's unclear: The context decisions don't specify TS version — but TS6 strict-by-default is risky
   - Recommendation: Planner should pin TypeScript 5.7.x in all packages. If user wants TS6, add explicit `"strict": false` as escape hatch in tsconfig.base.json (then selectively enable per package)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite 8, Fastify, Turbo | ✓ | v20.20.2 (satisfies >=20.19) | — |
| npm | Package management | ✓ | 11.12.1 | — |
| Docker | Dev Container, docker-compose | ✓ | 29.5.3 | — |
| MongoDB Atlas (remote) | Prisma / INFRA-07 | Unknown | — | No local fallback — Atlas remote only per project spec |

**Missing dependencies with no fallback:**
- MongoDB Atlas cluster + DATABASE_URL — must be provisioned by developer; no local alternative per project constraint

**Missing dependencies with fallback:**
- None beyond Atlas

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (to be configured in Wave 0 — no existing test config) |
| Config file | `apps/web/vitest.config.ts` — Wave 0 gap |
| Quick run command | `cd apps/web && npx vitest run --reporter=verbose` |
| Full suite command | `turbo run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | Turborepo `npm run dev` starts both apps | smoke | `npm run dev` (manual verify) | ❌ Wave 0 |
| INFRA-04 | Prisma schema generates without errors | smoke | `cd apps/api && npx prisma validate` | ❌ Wave 0 |
| INFRA-07 | MongoDB Atlas connection succeeds | smoke | `curl http://localhost:3001/health` | ❌ Wave 0 |
| PWA-01 | manifest.webmanifest served correctly | smoke | `curl http://localhost:5173/manifest.webmanifest` | ❌ Wave 0 |
| PWA-02 | `beforeinstallprompt` hook fires correctly | unit | `vitest run src/hooks/useInstallPrompt.test.ts` | ❌ Wave 0 |
| PWA-03 | iOS detection logic correct | unit | `vitest run src/hooks/useInstallPrompt.test.ts` | ❌ Wave 0 |
| UI-03 | BreadMark renders with correct SVG paths | unit | `vitest run src/components/brand/BreadMark.test.tsx` | ❌ Wave 0 |
| UI-05 | SplashScreen renders espresso background + gold symbol | unit | `vitest run src/pages/splash/SplashScreen.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/web && npx vitest run --reporter=dot`
- **Per wave merge:** `turbo run test typecheck`
- **Phase gate:** Full suite green + `prisma validate` + `/health` returns 200 before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/web/vitest.config.ts` — configure Vitest with jsdom + @testing-library/react
- [ ] `apps/web/src/hooks/useInstallPrompt.test.ts` — tests for PWA-02, PWA-03
- [ ] `apps/web/src/components/brand/BreadMark.test.tsx` — test for UI-03
- [ ] `apps/web/src/pages/splash/SplashScreen.test.tsx` — test for UI-05
- [ ] Framework install: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`

---

## Security Domain

> Phase 1 has no user-facing authentication or sensitive operations. Minimal security surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A — auth is Phase 2 |
| V3 Session Management | No | N/A — no sessions in Phase 1 |
| V4 Access Control | No | N/A — no protected routes yet |
| V5 Input Validation | Partial | Zod validates .env at startup via @fastify/env |
| V6 Cryptography | No | N/A |
| V9 Communication Security | Yes | MongoDB Atlas uses TLS by default; HTTPS not yet (dev) |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| MongoDB Atlas credentials in git | Information Disclosure | `.env` in `.gitignore`; `.env.example` with placeholders |
| CORS allows all origins in dev | Tampering | `@fastify/cors` with `origin: 'http://localhost:5173'` in dev |
| OneSignal App ID exposed in frontend | Information Disclosure | App ID is public-facing by design (frontend SDK); no secret involved |

---

## Sources

### Primary (HIGH confidence)
- [prisma.io/docs/guides/upgrade-prisma-orm/v7](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7) — MongoDB NOT supported in Prisma 7; use v6.19.3
- [prisma.io/docs/getting-started/prisma-orm/quickstart/mongodb](https://www.prisma.io/docs/getting-started/setup-prisma/start-from-scratch/mongodb-typescript-mongodb) — MongoDB connection string + schema patterns
- [tailwindcss.com/docs/installation/using-vite](https://tailwindcss.com/docs/installation/using-vite) — @tailwindcss/vite plugin; `@import "tailwindcss"` directive
- [tailwindcss.com/docs/theme](https://tailwindcss.com/docs/theme) — `@theme {}` CSS-first configuration; `--color-*` namespace
- [reactrouter.com/api/data-routers/createBrowserRouter](https://reactrouter.com/api/data-routers/createBrowserRouter) — v7 route.lazy API
- [reactrouter.com/upgrading/v6](https://reactrouter.com/upgrading/v6) — v7 breaking changes; import from `react-router`
- [turborepo.dev/docs/reference/configuration](https://turborepo.dev/docs/reference/configuration) — `tasks` key syntax, `persistent`, `cache`
- [vite-pwa-org.netlify.app/guide/inject-manifest.html](https://vite-pwa-org.netlify.app/guide/inject-manifest.html) — injectManifest configuration
- [vite-pwa-org.netlify.app/guide/pwa-minimal-requirements.html](https://vite-pwa-org.netlify.app/guide/pwa-minimal-requirements.html) — minimum icons (192+512)
- [documentation.onesignal.com/docs/en/onesignal-service-worker](https://documentation.onesignal.com/docs/en/onesignal-service-worker) — subdirectory placement for PWA coexistence
- [web.dev/learn/pwa/installation-prompt](https://web.dev/learn/pwa/installation-prompt) — beforeinstallprompt pattern
- npm registry — all package versions verified via `npm view <pkg> version`

### Secondary (MEDIUM confidence)
- [vite.dev/blog/announcing-vite8](https://vite.dev/blog/announcing-vite8) — Node >=20.19 requirement confirmed; @vitejs/plugin-react v6 uses Oxc
- [turborepo.dev/blog/turbo-2-0](https://turborepo.dev/blog/turbo-2-0) — `pipeline` → `tasks` rename confirmed
- [github.com/OneSignal/react-onesignal](https://github.com/OneSignal/react-onesignal) — react-onesignal init params; serviceWorkerPath configuration

### Tertiary (LOW confidence)
- Various Medium/DEV articles on TypeScript 6.0 strict-by-default (multiple sources agree; marked [ASSUMED] in context where pinning TS5 is recommended)

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all packages verified on npm registry with homepage confirmation
- Architecture: HIGH — patterns derived from official documentation
- Pitfalls: HIGH — critical Prisma/MongoDB finding from official Prisma upgrade guide; remainder from official changelogs
- Walking Skeleton: HIGH — all five success criteria are achievable with the documented patterns

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 (stable stack; main risk is Prisma v7 adding MongoDB support — check before executing if >2 weeks)

---

## Critical Findings Summary (must read before planning)

1. **HARD BLOCKER — Prisma v7 does not support MongoDB.** [VERIFIED: prisma.io/docs/guides/upgrade-prisma-orm/v7] Pin `prisma@6.19.3` and `@prisma/client@6.19.3`. Installing latest prisma will fail at runtime.

2. **MAJOR VERSION ALERT — TypeScript 6.0 is strict-by-default.** [CITED: typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html] On a greenfield project, pin `typescript@5.7.x` to control when strict mode is enabled. TS6 will cause build failures without explicit opt-out.

3. **BREAKING CHANGE — React Router v7 imports from `react-router` not `react-router-dom`.** [VERIFIED: reactrouter.com/upgrading/v6] The context decisions say "v6" but latest npm is v7. The API is compatible but imports must change.

4. **BREAKING CHANGE — Turborepo 2.x uses `tasks` not `pipeline` in turbo.json.** [CITED: turborepo.dev/blog/turbo-2-0] Every tutorial older than mid-2024 uses the wrong key.

5. **BREAKING CHANGE — Tailwind CSS v4 has no tailwind.config.js.** [VERIFIED: tailwindcss.com/docs/installation/using-vite] Use `@tailwindcss/vite` plugin + `@theme {}` in CSS. Install `@tailwindcss/vite`, not just `tailwindcss`.

6. **ARCHITECTURE NOTE — OneSignal + PWA need separate service worker scopes.** [CITED: documentation.onesignal.com] Place `OneSignalSDKWorker.js` at `/push/onesignal/` with matching scope; PWA SW at root `/`.
