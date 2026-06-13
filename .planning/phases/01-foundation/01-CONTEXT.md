# Phase 1: Foundation - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Scaffolding técnico completo do monorepo Turborepo — o desenvolvedor sobe o projeto localmente com um único comando, o PWA é instalável no Android e iOS, e a tela Splash aparece com a identidade visual correta. Nenhuma funcionalidade de negócio nesta fase.

**Entregáveis desta fase:**
- Monorepo Turborepo: apps/web (React+Vite), apps/api (Fastify), packages/shared
- Dev Container funcional (VS Code + Docker Compose)
- TypeScript ponta a ponta
- Prisma schema completo (todas as 15 collections) conectado ao MongoDB Atlas
- PWA instalável (manifest + service worker via vite-plugin-pwa + injectManifest)
- OneSignal instalado e configurado (SDK + App ID + SW registrado) — não testado funcionalmente
- Tela Splash com fundo espresso, símbolo BreadMark dourado e CTAs
- Prompt de instalação para Android e iOS

</domain>

<decisions>
## Implementation Decisions

### Prisma Schema
- **D-01:** Definir TODAS as 15 collections no schema.prisma na Fase 1 — evita refatoração futura, e com MongoDB+Prisma adapter não há migração destrutiva.
- **D-02:** Adaptar para padrões do Prisma+MongoDB: usar tipos nativos do adapter (ObjectId, @map, @db.ObjectId, embedded documents onde adequado). Base são as 15 collections do documento de requisitos, mas a sintaxe segue as boas práticas do adapter.

**Collections (conforme Requisitos_v01.md, seção 5.3):**
USERS, CONDOMINIUMS, COMBOS, PROMOTIONS, SETTINGS, CREDIT_TRANSACTIONS, SCHEDULES, ORDERS, DELIVERIES, DELIVERY_LISTS, SUPPLIERS, PURCHASE_ORDERS, PURCHASE_ORDER_ITEMS, PAYMENTS, NOTIFICATIONS

### App Shell + Roteamento
- **D-03:** Lazy-loading por perfil com React Router v6 — chunks separados por perfil carregados sob demanda usando `createBrowserRouter` + `React.lazy()`. Cada perfil tem seu próprio route group: `/client/*`, `/courier/*`, `/admin/*`.
- **D-04:** Rota raiz `/` exibe a Splash/Install screen — é a entry point do PWA para usuários não autenticados. Após autenticação, redireciona para a rota do perfil correspondente.
- **D-05:** React Router v6 com `createBrowserRouter` — já definido nos requisitos. Substitui o `go(route)` do protótipo.

### Service Worker + OneSignal
- **D-06:** OneSignal como service worker principal. vite-plugin-pwa configurado em modo `injectManifest` com um SW customizado que importa `OneSignalSDKWorker.js`. Esse é o padrão suportado pelo OneSignal para PWA com Vite.
- **D-07:** Na Fase 1, OneSignal apenas instalado e configurado (SDK + App ID + SW registrado). O envio e recebimento real de notificações push será testado na Fase 5, quando o domínio de entregas existir.

### Claude's Discretion
- Estrutura interna dos módulos Fastify (controller/service/repository por domínio) — seguir Clean Architecture conforme especificado em Requisitos_v01.md seção 5.2
- Configuração do Turborepo (pipelines, caching) — usar defaults do Turborepo para monorepo Node.js
- Estratégia de caching do service worker — usar `NetworkFirst` para API calls, `CacheFirst` para assets estáticos

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos e Modelo de Negócio
- `.projeto/Cheirin_de_Pao_Requisitos_v01.md` — fonte de verdade completa: stack técnica (seção 5), estrutura do projeto (seção 5.5/5.8), collections MongoDB (seção 5.3), UI/UX (seção 6)
- `.projeto/Cheirin_de_Pao_Modelo_Funcionamento.md` — modelo de negócio: créditos, agendamentos, fluxos de pedido

### Design e UI
- `.projeto/design_handoff_cheirin_pao/README.md` — design handoff completo: tokens, tipografia, componentes, telas
- `.projeto/design_handoff_cheirin_pao/app/brand.jsx` — sistema de marca: tokens de tema, símbolo BreadMark, primitivas de UI
- `.projeto/design_handoff_cheirin_pao/Cheirin de Pão - App.html` — protótipo de referência (abre com servidor estático)

### Estrutura do Projeto (do Requisitos_v01.md seção 5.8)
```
apps/web/          → React + Vite (PWA)
apps/api/          → Fastify + Prisma
packages/shared/   → Zod schemas, tipos, constantes
.devcontainer/     → Dev Container config
docker-compose.yml → dev environment
```

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Nenhum — projeto greenfield. Apenas CLAUDE.md e README.md existem.

### Established Patterns
- Nenhum padrão estabelecido — Fase 1 define os padrões que as fases seguintes seguirão.

### Integration Points
- Prisma schema definido aqui será importado pelo packages/shared e consumido por todas as fases posteriores
- Estrutura de roteamento definida aqui determina como as Fases 2-7 adicionam suas telas
- Service worker configurado aqui é a base para notificações push da Fase 5

</code_context>

<specifics>
## Specific Ideas

- **BreadMark SVG:** Implementar como componente React SVG inline (não screenshot). Replicar o arco do pão + três ondas de aroma do protótipo. Abaixo de ~48px, ocultar ondas laterais e engrossar traço (prop `reduced`). Cor padrão: `#E3AC3F`.
- **Splash screen:** Fundo espresso `#1E1207` com vinheta dourada radial. Ícone do app 132px, raio 30%, fundo `#160C04`. Símbolo dourado 86px. Nome 32px Bricolage Grotesque. Tagline `PÃO FRESCO NA PORTA` 12px, letter-spacing 0.26em, dourado. Botão dourado "Instalar e criar conta" + link "Já tenho conta".
- **Tema:** Usar exclusivamente `THEMES.light` (creme). `THEMES.dark` não implementar.
- **Fontes:** Bricolage Grotesque + Hanken Grotesk via Google Fonts.

</specifics>

<deferred>
## Deferred Ideas

Nenhuma — discussão mantida dentro do escopo da Fase 1.

</deferred>

---

*Phase: 1-Foundation*
*Context gathered: 2026-06-13*
