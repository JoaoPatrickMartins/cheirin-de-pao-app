# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-13
**Phase:** 1-Foundation
**Areas discussed:** Prisma Schema, App Shell + Roteamento, Service Worker + OneSignal

---

## Prisma Schema

| Option | Description | Selected |
|--------|-------------|----------|
| Todas as 15 collections agora | Define o schema completo — evita refatoração futura, sem migração destrutiva com MongoDB+Prisma | ✓ |
| Só as das primeiras fases | USERS, CONDOMINIUMS, SETTINGS incrementalmente | |

**User's choice:** Todas as 15 collections na Fase 1.
**Notes:** —

---

| Option | Description | Selected |
|--------|-------------|----------|
| Adaptar para Prisma+MongoDB | Seguir as 15 collections como base, usar tipos nativos (ObjectId, @map, embedded documents) | ✓ |
| Seguir à risca o documento | Implementar exatamente como descrito em Requisitos_v01.md | |

**User's choice:** Adaptar para padrões do Prisma+MongoDB.
**Notes:** Base nas 15 collections do Requisitos_v01.md, sintaxe segue boas práticas do adapter.

---

## App Shell + Roteamento

| Option | Description | Selected |
|--------|-------------|----------|
| Role-based no mesmo SPA | Bundle único, roteamento por perfil /client/*, /courier/*, /admin/* | |
| Lazy-loaded por perfil | Chunks separados por perfil com React.lazy() e code-splitting | ✓ |

**User's choice:** Lazy-loaded por perfil.
**Notes:** createBrowserRouter + React.lazy() por perfil.

---

| Option | Description | Selected |
|--------|-------------|----------|
| React Router v6 | Já definido nos requisitos. createBrowserRouter + lazy() | ✓ |
| TanStack Router | Type-safe com rotas como arquivos | |

**User's choice:** React Router v6.
**Notes:** Já especificado nos requisitos do projeto.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Splash + Install screen na raiz | Tela splash como entry point do PWA para não autenticados | ✓ |
| Redirect para /login | Rota raiz redireciona direto para login | |

**User's choice:** Splash/Install screen na rota raiz "/".
**Notes:** Faz sentido como first impression do PWA.

---

## Service Worker + OneSignal

| Option | Description | Selected |
|--------|-------------|----------|
| OneSignal como SW principal | injectManifest com SW customizado importando OneSignalSDKWorker.js | ✓ |
| SWs separados em escopos diferentes | Dois service workers com escopos distintos | |

**User's choice:** OneSignal como SW principal com vite-plugin-pwa em modo injectManifest.
**Notes:** Padrão suportado pelo OneSignal para PWA com Vite.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Apenas instalado e configurado | SDK + App ID + SW registrado. Envio/recebimento testado na Fase 5 | ✓ |
| Totalmente funcional na Fase 1 | Testar push desde o início | |

**User's choice:** Apenas instalado e configurado na Fase 1.
**Notes:** Funcionalidade completa de push será validada na Fase 5.

---

## Claude's Discretion

- Estrutura interna dos módulos Fastify — seguir Clean Architecture (Requisitos_v01.md seção 5.2)
- Configuração do Turborepo (pipelines, caching) — usar defaults
- Estratégia de caching do service worker — NetworkFirst para API, CacheFirst para assets

## Deferred Ideas

Nenhuma — discussão mantida dentro do escopo da Fase 1.
