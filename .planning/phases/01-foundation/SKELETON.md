# Walking Skeleton — Cheirin de Pão

**Phase:** 1
**Generated:** 2026-06-13

## Capability Proven End-to-End

Developer runs `npm install && npm run dev` from the monorepo root, opens the app on a mobile device, sees the branded Splash screen (espresso background, gold BreadMark symbol), receives an install prompt, and the Fastify API responds at `/health` with `{"ok":true,"db":"connected"}` confirming a live MongoDB Atlas connection.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Monorepo | Turborepo 2.x with npm workspaces | Zero-config caching, `tasks` syntax; fits Node.js/TypeScript stack natively |
| Frontend framework | React 19 + Vite 8 (Rolldown) | PWA-first; fastest HMR; VitePWA injectManifest supports custom SW for OneSignal coexistence |
| Styling | Tailwind CSS v4 (CSS-first, `@tailwindcss/vite`) | No `tailwind.config.js` needed; design tokens live in `@theme {}` CSS block |
| Routing | React Router v7 (`createBrowserRouter`) | SPA with lazy profile chunks (`/client/*`, `/courier/*`, `/admin/*`); import from `react-router` not `react-router-dom` |
| Data layer | Prisma v6.19.3 + MongoDB Atlas | MUST be v6 — v7 dropped MongoDB support; Atlas M0 free tier includes replica set |
| Backend framework | Fastify v5 | Low-overhead, TypeScript-native; logger built-in; plugin architecture for Prisma decoration |
| Auth | OTP-only (Phase 2 — deferred) | No passwords anywhere; SMS or email code; session-based (Phase 2) |
| Push notifications | OneSignal SDK + separate SW scope | SW at `/push/onesignal/` to avoid scope conflict with main PWA SW at `/` |
| Font loading | Fontsource npm packages (self-hosted) | Bricolage Grotesque Variable + Hanken Grotesk; works offline in installed PWA |
| TypeScript | 5.7.x across all packages | v6 is strict-by-default — pin 5.x for controlled strict activation per package |
| Deployment target | Local dev run (`npm run dev`) | Phase 1 = local skeleton; VPS + Docker + Nginx deferred to Phase 7 |
| Directory layout | `apps/web`, `apps/api`, `packages/shared` | Frontend, backend, shared types/schemas cleanly separated; inter-package via workspace:* |

## Stack Touched in Phase 1

- [x] Project scaffold (Turborepo, Vite, Fastify, TypeScript, npm workspaces, Vitest, Dev Container)
- [x] Routing — `/` SplashScreen route, plus `/client/*`, `/courier/*`, `/admin/*` lazy stubs
- [x] Database — Prisma schema with all 15 collections; `prisma generate` produces client; `/health` endpoint pings Atlas with `$runCommandRaw({ ping: 1 })`
- [x] UI — SplashScreen with real branded component (BreadMark SVG), design tokens, Fontsource fonts, install prompts
- [x] Deployment — Full-stack local run with `npm run dev` (Turborepo orchestrates both `apps/web` and `apps/api`)

## Service Worker Architecture

Two service workers at separate scopes — this is load-bearing for Phase 5 push notifications:

| SW | Path | Scope | Purpose |
|----|------|-------|---------|
| PWA SW | `apps/web/src/sw.ts` (built by VitePWA) | `/` | Workbox precaching + offline |
| OneSignal SW | `apps/web/public/push/onesignal/OneSignalSDKWorker.js` | `/push/onesignal/` | Background push handling (active in Phase 5) |

OneSignal in Phase 1 = SDK initialized, push not yet tested (Phase 5 wires the full push flow).

## Out of Scope (Deferred to Later Slices)

- OTP authentication, session management, user registration → Phase 2
- Credit system, combo purchases, Mercado Pago → Phase 3
- Weekly scheduling, recurring orders → Phase 4
- Delivery tracking, push notifications functional end-to-end → Phase 5
- Courier route map (Leaflet + OSRM) → Phase 6
- Admin panel, financial reports → Phase 7
- VPS deployment, Docker Compose prod, Nginx, Let's Encrypt → Phase 7
- Dark theme (`THEMES.dark`) → v2 requirements (out of scope)
- PWA icon assets (real 192px / 512px art) → before Phase 7 deploy (placeholders in Phase 1)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: OTP login + 5-step registration + session cookie + role-based routing
- Phase 3: Credit balance display + combo purchase + Mercado Pago Pix/card payment
- Phase 4: Weekly schedule configuration + single order + credit reservation
- Phase 5: Delivery status tracking + push notifications via OneSignal end-to-end
- Phase 6: Courier delivery list + route map (Leaflet + OSRM)
- Phase 7: Full admin panel + VPS deploy + Docker + Nginx + CI/CD

## Critical Version Pins (enforce in every future phase)

| Package | Version | Why Pinned |
|---------|---------|------------|
| `prisma` | `6.19.3` (exact) | v7 does NOT support MongoDB |
| `@prisma/client` | `6.19.3` (exact) | Must match prisma exactly |
| `typescript` | `5.7.3` | v6 strict-by-default breaks greenfield |
| `react-router` | `7.17.0` | v7 API; import from `react-router` not `react-router-dom` |

## Developer Setup (Phase 1)

1. Copy `.env.example` to `.env`
2. Fill in `DATABASE_URL` from MongoDB Atlas dashboard (cluster → Connect → connection string)
3. (Optional) Create a OneSignal Web Push app, copy App ID to `VITE_ONESIGNAL_APP_ID`
4. Run `npm install` at repo root
5. Run `npm run dev` — frontend starts at `:5173`, API at `:3001`
6. Open `http://localhost:5173` — Splash screen appears
7. Open `http://localhost:3001/health` — should return `{"ok":true,"db":"connected"}`
