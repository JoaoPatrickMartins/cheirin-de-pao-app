# 🥖 Cheirin de Pão

> PWA de entrega recorrente de pãezinhos em condomínios, baseado em sistema de créditos.
> O cliente compra combos que viram créditos, monta uma agenda semanal e os pãezinhos
> chegam na porta toda manhã — o sistema cuida de créditos, agendamentos e notificações
> automaticamente.

**Perfis de usuário:** Cliente (compra, agenda, acompanha) · Entregador (rota e confirmação de entrega) · Admin (operação completa — pedido ao fornecedor, financeiro, gestão).

---

## 📑 Índice

1. [Visão Geral](#-visão-geral)
2. [Stack Tecnológica](#-stack-tecnológica)
3. [Estrutura do Monorepo](#-estrutura-do-monorepo)
4. [Pré-requisitos](#-pré-requisitos)
5. [Começando (Setup Local)](#-começando-setup-local)
6. [Variáveis de Ambiente](#-variáveis-de-ambiente)
7. [Comandos Disponíveis](#-comandos-disponíveis)
8. [Banco de Dados (MongoDB + Prisma)](#-banco-de-dados-mongodb--prisma)
9. [Integrações Externas](#-integrações-externas)
10. [Cron Jobs (tarefas agendadas)](#-cron-jobs-tarefas-agendadas)
11. [API — Arquitetura e Endpoints](#-api--arquitetura-e-endpoints)
12. [Frontend (PWA)](#-frontend-pwa)
13. [Testes](#-testes)
14. [Deploy em Produção](#-deploy-em-produção)
15. [Checklist de Pré-Deploy](#-checklist-de-pré-deploy)
16. [Segurança](#-segurança)
17. [Troubleshooting](#-troubleshooting)
18. [Documentação Adicional](#-documentação-adicional)

---

## 🎯 Visão Geral

**Core value:** o cliente configura a agenda **uma vez** e os pãezinhos chegam todo dia sem que ele precise fazer nada. O sistema cuida de:

- **Créditos** — combos comprados viram saldo de "pães" (1 crédito = 1 pão).
- **Agendamento** — agenda semanal por dia e por turno (slot), com horário de corte configurável por condomínio.
- **Automação** — no horário de corte de cada turno, o sistema gera os pedidos, debita créditos, aciona recarga automática (opcional) e monta o pedido ao fornecedor.
- **Notificações** — push (OneSignal) + in-app para cliente, entregador e admin.

A aplicação é um **PWA** (instalável, offline-first via Service Worker) com backend REST.

---

## 🧱 Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| **Monorepo** | Turborepo `2.9.18` + npm workspaces |
| **Gerenciador** | npm `11.12.1` |
| **Runtime** | Node.js `20 LTS` (≥ 20.19 — detecção automática de ESM) |
| **Linguagem** | TypeScript `5.7.3` |
| **Frontend** | React `19` · Vite `8` · Tailwind CSS `4` · React Router `7` |
| **PWA** | `vite-plugin-pwa` + Workbox (Service Worker `injectManifest`) |
| **Animação/UI** | framer-motion · driver.js (onboarding) · @dnd-kit (drag & drop) |
| **Mapas** | Leaflet + react-leaflet (OpenStreetMap / OSRM) |
| **Backend** | Fastify `5` · Prisma `6.19.3` · Zod `4` |
| **Banco** | MongoDB Atlas (remoto — dev e prod) |
| **Docs API** | OpenAPI 3 via `@fastify/swagger` + Swagger UI (`/docs`) |
| **Auth** | OTP por e-mail (Resend) + senha (bcrypt) · JWT (access) + sessão por device (refresh) |
| **Pagamentos** | **Cartão** → Stripe · **Pix** → Mercado Pago |
| **E-mail** | Resend (envio de OTP) |
| **Push** | OneSignal |
| **Relatórios** | pdfmake (PDF) · exceljs (Excel) |

> As escolhas de stack são **definidas e não revisitáveis** (ver [CLAUDE.md](CLAUDE.md)).

---

## 📂 Estrutura do Monorepo

```
cheirin-de-pao-app/
├── apps/
│   ├── api/                     # Backend Fastify + Prisma
│   │   ├── prisma/
│   │   │   └── schema.prisma    # 20+ models (MongoDB)
│   │   ├── src/
│   │   │   ├── bootstrap/       # seeds automáticos no boot (admin, defaults)
│   │   │   ├── lib/             # utilitários (cutoff, geocode, push, índices)
│   │   │   ├── modules/         # módulos por domínio (route/controller/service/repository/schema)
│   │   │   ├── plugins/         # prisma, authenticate (JWT), cron
│   │   │   ├── scripts/         # migrações/seed manuais (tsx)
│   │   │   └── server.ts        # entrypoint (registra env, plugins e rotas)
│   │   ├── .env                 # dev (NÃO versionado)
│   │   ├── .env.example         # modelo das variáveis do backend
│   │   ├── .env.production      # produção-like (NÃO versionado — contém segredos)
│   │   └── API.md               # referência completa dos endpoints
│   └── web/                     # Frontend React PWA
│       ├── public/              # ícones PWA, favicon, assets estáticos
│       ├── src/
│       │   ├── components/      # componentes reutilizáveis
│       │   ├── contexts/        # Auth, Notificações, etc.
│       │   ├── hooks/           # hooks customizados
│       │   ├── lib/             # api client, helpers
│       │   ├── pages/           # telas (cliente, entregador, admin)
│       │   ├── routes/          # roteamento por role
│       │   ├── sw.ts            # Service Worker (PWA)
│       │   └── main.tsx         # entrypoint
│       ├── .env                 # dev (NÃO versionado)
│       ├── .env.example         # modelo das variáveis do frontend
│       └── .env.production      # build de produção (NÃO versionado)
├── packages/
│   └── shared/                  # código compartilhado (schemas Zod, tipos, constantes)
├── .devcontainer/               # Dev Container (VS Code)
├── docker-compose.yml           # ambiente de DEV (web + api em node:20-alpine)
├── turbo.json                   # pipeline Turborepo
├── tsconfig.base.json           # config TS raiz (herdado pelos apps)
└── package.json                 # workspaces + scripts raiz
```

Cada módulo do backend segue o padrão **route → controller → service → repository → schema**, com testes em `__tests__/`.

---

## ✅ Pré-requisitos

- **Node.js 20 LTS** (≥ 20.19). O projeto usa ESM com detecção automática de módulos.
- **npm 11+** (definido em `packageManager`).
- **Conta no MongoDB Atlas** com um cluster e uma connection string. **Não há Mongo local** — o banco é remoto em dev e prod.
- Contas/credenciais das integrações (opcionais para subir a API, obrigatórias para funcionalidades completas):
  - Stripe (cartão)
  - Mercado Pago (Pix)
  - Resend (OTP por e-mail)
  - OneSignal (push)
- (Opcional) **Docker + Docker Compose** para o ambiente de desenvolvimento em containers.

---

## 🚀 Começando (Setup Local)

```bash
# 1. Clonar e entrar no projeto
git clone <repo-url> cheirin-de-pao-app
cd cheirin-de-pao-app

# 2. Instalar dependências (workspaces — instala tudo de uma vez)
npm install

# 3. Configurar variáveis de ambiente (ver seção "Variáveis de Ambiente")
cp apps/api/.env.example apps/api/.env      # backend
cp apps/web/.env.example apps/web/.env      # frontend
# edite os dois arquivos e preencha os valores

# 4. Gerar o Prisma Client (necessário após install e após mudar o schema)
cd apps/api && npx prisma generate && cd ../..

# 5. Rodar tudo em modo dev (api + web em paralelo via Turborepo)
npm run dev
```

Serviços em dev:

| Serviço | URL |
|---------|-----|
| Frontend (Vite) | http://localhost:5173 |
| API (Fastify) | http://localhost:3001 |
| Swagger UI (docs da API) | http://localhost:3001/docs |
| Health check | http://localhost:3001/health |

### Alternativa: Docker (dev)

```bash
docker compose up
```

Sobe `web` (5173) e `api` (3001) em containers `node:20-alpine` com hot-reload por volume.
Não há serviço de MongoDB no compose — o banco continua sendo o **Atlas remoto**.

> **Nota:** nunca rode `npm install` com `sudo` — isso quebra permissões e pode fazer o `tsc` emitir `.js` dentro de `src/` (que o Vite passa a carregar por engano).

---

## 🔐 Variáveis de Ambiente

O projeto usa **dois conjuntos** de variáveis: backend (`apps/api`) e frontend (`apps/web`).
O backend valida as variáveis no boot via `@fastify/env` — se faltar uma **obrigatória**, a API **não sobe**.

### Backend — `apps/api/.env`

| Variável | Obrigatória | Default | Descrição / Onde obter |
|----------|:-----------:|---------|------------------------|
| `DATABASE_URL` | ✅ | — | Connection string do MongoDB Atlas (`mongodb+srv://...`). Dashboard do Atlas → Connect. |
| `JWT_SECRET` | ✅ | — | Segredo de assinatura do access token. Gere: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `STRIPE_SECRET_KEY` | ✅ | — | `sk_test_...` (dev) / `sk_live_...` (prod). Stripe Dashboard → Developers → API keys. |
| `STRIPE_PUBLISHABLE_KEY` | ➖ | `''` | `pk_test_.../pk_live_...`. Mesma chave usada no frontend. |
| `STRIPE_WEBHOOK_SECRET` | ➖ | `''` | `whsec_...`. Gerado ao criar o endpoint de webhook (ou via `stripe listen`). |
| `MP_ACCESS_TOKEN` | ➖¹ | — | Access Token do Mercado Pago (`APP_USR-...`). Necessário para gerar **Pix**. MP → Suas integrações → Credenciais. |
| `MP_WEBHOOK_SECRET` | ➖ | — | Assinatura secreta do webhook do MP (painel → Webhooks). Só p/ o endpoint público. |
| `RESEND_API_KEY` | ➖² | — | `re_...`. Envio de OTP por e-mail. https://resend.com/api-keys |
| `RESEND_FROM` | ➖² | — | Remetente verificado, ex.: `"Cheirin de Pão <noreply@cheirindepao.com.br>"` |
| `ONESIGNAL_APP_ID` | ➖ | — | App ID do OneSignal (push). Settings → Keys & IDs. |
| `ONESIGNAL_REST_API_KEY` | ➖ | — | REST API Key do OneSignal (envio server-side de push). |
| `OTP_DEV_CODE` | ➖ | `1234` | Em `NODE_ENV=development`, esse código é aceito sem enviar e-mail real. |
| `NODE_ENV` | ➖ | `development` | `production` desativa o bypass de OTP e ativa os crons. |
| `API_PORT` | ➖ | `3001` | Porta da API. |
| `API_HOST` | ➖ | `0.0.0.0` | Host de bind. |
| `CORS_ORIGIN` | ➖ | `http://localhost:5173` | Origem permitida em produção, ex.: `https://app.cheirindepao.com.br` |
| `ADMIN_NAME` | ➖³ | — | Nome do admin semeado no 1º boot (se não houver nenhum ADMIN no banco). |
| `ADMIN_EMAIL` | ➖³ | — | E-mail do admin inicial. |
| `ADMIN_PHONE` | ➖³ | — | Telefone do admin inicial. |
| `ADMIN_CPF` | ➖³ | — | CPF do admin inicial (obrigatório para o seed rodar). |

> ¹ Opcional para **bootar** a API, mas **obrigatório** para criar cobranças Pix (o serviço lança erro claro se ausente).
> ² Não obrigatório para subir, mas **obrigatório em produção** — sem Resend não há como enviar o OTP de login.
> ³ O seed do admin só roda se `ADMIN_NAME` + (`ADMIN_EMAIL` **ou** `ADMIN_PHONE`) + `ADMIN_CPF` estiverem preenchidos **e** não existir nenhum usuário `ADMIN`.

### Frontend — `apps/web/.env`

As variáveis do frontend são **embutidas no bundle em build-time** (prefixo `VITE_`). Nada aqui é secreto do lado do servidor — use apenas chaves públicas.

| Variável | Obrigatória | Descrição |
|----------|:-----------:|-----------|
| `VITE_API_URL` | ✅ | URL base da API. Dev: `http://localhost:3001`. Prod: domínio da API, ex.: `https://api.cheirindepao.com.br` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | ✅ | `pk_test_.../pk_live_...` — a mesma publishable key do backend. |
| `VITE_ONESIGNAL_APP_ID` | ✅ | Mesmo App ID do backend (`ONESIGNAL_APP_ID`). |
| `VITE_SUPPORT_WHATSAPP` | ➖ | Número de suporte (só dígitos + DDI), ex.: `5511999998888`. |

> O Vite carrega automaticamente `.env`, `.env.production`, `.env.local` etc. conforme o `--mode`.
> `npm run build` usa `--mode production` (lê `.env.production`); `npm run dev` usa `.env`/`.env.local`.

---

## 🛠 Comandos Disponíveis

### Raiz (Turborepo — orquestra todos os workspaces)

| Comando | O que faz |
|---------|-----------|
| `npm run dev` | Sobe **api + web** em paralelo (modo dev, hot-reload). |
| `npm run build` | Builda todos os workspaces (respeitando dependências). |
| `npm run typecheck` | Type-check em todos os workspaces (`tsc --noEmit`). |
| `npm run test` | Roda todos os testes (Vitest) de todos os workspaces. |

### Backend — `apps/api` (rodar de dentro de `apps/api/`)

| Comando | O que faz |
|---------|-----------|
| `npm run dev` | API com hot-reload (`tsx watch src/server.ts`). |
| `npm run build` | Compila TypeScript → `dist/` (`tsc`). |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run test` | Testes com Vitest. |
| `npx prisma generate` | Gera o Prisma Client (após install / mudança de schema). |
| `npx prisma db push` | Sincroniza o schema com o MongoDB (índices, coleções). |
| `npx prisma validate` | Valida o `schema.prisma`. |
| `npm run migrate:slots` | Migração: estrutura de delivery slots. |
| `npm run seed:slots` | Seed: slots de entrega padrão. |
| `npm run migrate:slotid` | Migração: introduz `slotId` estável. |
| `npm run migrate:phone` | Backfill: normalização de telefone. |

> ⚠️ **NUNCA rode `prisma migrate dev`** — MongoDB não suporta migrações do Prisma. Use apenas `generate`, `db push` e `validate`.

### Frontend — `apps/web` (rodar de dentro de `apps/web/`)

| Comando | O que faz |
|---------|-----------|
| `npm run dev` | Vite dev server (porta 5173, `host: true`). |
| `npm run build` | `tsc && vite build` → `dist/` (modo production). |
| `npm run preview` | Serve o build de produção localmente. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run test` | Testes com Vitest (jsdom). |

---

## 🗄 Banco de Dados (MongoDB + Prisma)

- **Provider:** MongoDB (Atlas remoto). Schema em [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma).
- **~20 models**: `User`, `Condominium`, `Combo`, `Promotion`, `Setting`, `CreditTransaction`, `Schedule`, `Order`, `Delivery`, `DeliveryList`, `Supplier`, `PurchaseOrder`, `PurchaseOrderItem`, `Payment`, `Notification`, `Session`, `AdminNote`, `OtpCode`, `SavedCard`, `MaterializedCycle`, `AnalyticsEvent`.

### Fluxo de setup do banco

```bash
cd apps/api

# 1. Gerar o client (obrigatório após install e após editar o schema)
npx prisma generate

# 2. Sincronizar o schema com o Atlas (cria coleções/índices)
npx prisma db push
```

### Seeds automáticos (no boot da API)

Ao subir, a API executa dois bootstraps **idempotentes**:

- **`seedAdminIfAbsent`** — cria o primeiro usuário `ADMIN` a partir das variáveis `ADMIN_*` (só se não existir nenhum admin).
- **`seedDefaultsIfAbsent`** — garante defaults operacionais (preço do avulso, limite, combo padrão) quando o admin ainda não configurou.

### Índices de runtime

No boot, `ensureIndexes()` garante os índices necessários de forma **best-effort** (não bloqueia nem derruba o boot se o Atlas estiver lento).

---

## 🔌 Integrações Externas

| Serviço | Uso | Variáveis | Webhook (endpoint público) |
|---------|-----|-----------|----------------------------|
| **Stripe** | Pagamento com **cartão** (inclusive off-session/card-on-file) | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLISHABLE_KEY` | `POST /webhooks/stripe` |
| **Mercado Pago** | Pagamento com **Pix** (QR code gerado no backend) | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` | `POST /webhooks/mercadopago` |
| **Resend** | Envio do **OTP por e-mail** (login/cadastro) | `RESEND_API_KEY`, `RESEND_FROM` | — |
| **OneSignal** | **Push notifications** (PWA) | `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`, `VITE_ONESIGNAL_APP_ID` | — |
| **OpenStreetMap / OSRM** | Geocoding e rota do entregador (Leaflet) | — (gratuito, sem chave) | — |

### Configurando os webhooks

Os endpoints de webhook precisam de **URL pública** (em dev, use `stripe listen` ou um túnel):

- **Stripe:** crie o endpoint em Dashboard → Developers → Webhooks apontando para `https://api.SEU-DOMINIO/webhooks/stripe`. Copie o `whsec_...` para `STRIPE_WEBHOOK_SECRET`.
- **Mercado Pago (Pix):** o status também é confirmado por *pull* (polling do `getStatus`), então o webhook é opcional; se configurar, aponte para `https://api.SEU-DOMINIO/webhooks/mercadopago` e preencha `MP_WEBHOOK_SECRET`.

---

## ⏰ Cron Jobs (tarefas agendadas)

Os crons rodam **dentro da API** (`node-cron`), timezone **America/Sao_Paulo**. Não são registrados em `NODE_ENV=test`.

| Agenda (cron) | Nome | O que faz |
|---------------|------|-----------|
| `0 0 * * *` (meia-noite) | `daily-jobs` | Notificações de saldo baixo · limpeza de ciclos materializados antigos · lembrete de agenda pausada há muito tempo. |
| `0 20 * * 0` (dom. 20h) | `weekly-reminder` | Push de lembrete de reconfiguração semanal (quem tem `notifyReconfigure`). |
| `0 21 * * *` (diário 21h) | `eve-reminders` | Push de véspera + `Notification DELIVERY_EVE` para os pedidos do dia seguinte. |
| `* * * * *` (a cada minuto) | `cutoff-orders` | No corte de cada slot: cria as Orders, debita créditos, recarga automática (T-2h), pedido ao fornecedor (auto-geração +60min), lembretes de corte/entrega ao admin e ao entregador, e backfill de cortes perdidos. |

> ⚠️ Para os crons funcionarem em produção, a API deve rodar como um **processo persistente** (não serverless). Como o job `cutoff-orders` roda a cada minuto e é sensível a *downtime*, mantenha a API sempre no ar (process manager / restart automático). O backfill recupera cortes perdidos após restart, mas evite janelas longas de indisponibilidade.

---

## 🌐 API — Arquitetura e Endpoints

- **Base URL (dev):** `http://localhost:3001`
- **Documentação interativa:** `GET /docs` (Swagger UI / OpenAPI 3)
- **Health check:** `GET /health` → `{ ok: true, db: "connected" }` (503 se o Mongo não responder)
- **Auth:** Bearer JWT no header `Authorization: Bearer <token>` (obtido via `POST /auth/otp/verify` ou `POST /auth/login`).
- **Roles:** `CLIENT` · `COURIER` · `ADMIN`.
- **Rate limit:** global **200 req/min**; endpoints de OTP **5 req/min** por IP.

### Grupos de rotas

- **auth** — `/auth/register`, `/auth/login`, `/auth/otp/send`, `/auth/otp/verify`, `/auth/refresh`, `/auth/logout`, `/auth/password/set|change|reset`
- **cliente** — condomínios, créditos, pagamentos, agendas, pedidos, notificações, perfil, cartões salvos, gancho
- **entregador** — pedidos do dia, confirmação de entrega
- **admin** — dashboard, settings, condomínios, combos, fornecedores, entregadores, clientes, pedidos ao fornecedor, separação, financeiro, relatórios, pagamentos/estornos
- **webhooks** — `/webhooks/stripe`, `/webhooks/mercadopago`
- **analytics** — ingestão pública de eventos de acesso/login

📖 **Referência completa dos endpoints:** [apps/api/API.md](apps/api/API.md)

---

## 📱 Frontend (PWA)

- **SPA React 19** com roteamento por role (React Router 7).
- **PWA instalável** — `vite-plugin-pwa` com Service Worker (`src/sw.ts`, estratégia `injectManifest`, `registerType: autoUpdate`). Ícones e manifest definidos em [apps/web/vite.config.ts](apps/web/vite.config.ts).
- **Design de alta fidelidade** — cores/tipografia/espaçamentos mandatórios (fontes Bricolage Grotesque + Hanken Grotesk).
- **Onboarding** — slides + tour guiado (driver.js) no primeiro acesso.
- **Mapas** — Leaflet + OpenStreetMap (rota do entregador).

O build de produção (`npm run build`) gera `apps/web/dist/` — arquivos estáticos servidos por qualquer servidor web (Nginx recomendado).

---

## 🧪 Testes

```bash
# Todos os testes (raiz — via Turborepo)
npm run test

# Backend
cd apps/api && npm run test

# Frontend
cd apps/web && npm run test
```

- **Runner:** Vitest (backend Node; frontend jsdom + Testing Library).
- Testes ficam em `__tests__/` ao lado do código (services, generators, schemas, etc.).

---

## 🚢 Deploy em Produção

**Alvo de hospedagem (definido no projeto):** VPS (DigitalOcean/Hostinger) com **Docker + Nginx + Let's Encrypt**.

A arquitetura recomendada:

```
                        ┌──────────────────────────────┐
   Internet ──HTTPS──►  │  Nginx (443)  + Let's Encrypt │
                        │                                │
                        │  app.dominio  → estático (web) │
                        │  api.dominio  → proxy :3001    │
                        └──────────────┬─────────────────┘
                                       │
                             ┌─────────▼─────────┐        ┌──────────────┐
                             │  API Fastify :3001 │──────► │ MongoDB Atlas │
                             │  (tsx src/server)  │        └──────────────┘
                             └────────────────────┘
```

### 0. Preparação do servidor (VPS)

Provisione uma VPS Linux (Ubuntu/Debian). Os comandos abaixo assumem `apt`.

**Base (sempre):**

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ufw

# Firewall — libere SSH + HTTP + HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw enable
```

**Opção A — com Docker (recomendado, casa com o Dockerfile da API):**

```bash
# Docker Engine + plugin do Compose (script oficial)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # relogue para aplicar o grupo
```

**Opção B — sem Docker (Node direto no host):**

```bash
# Node.js 20 LTS (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable            # habilita o npm da versão fixada em packageManager

# PM2 — process manager para manter a API sempre no ar (os crons dependem disso)
sudo npm install -g pm2
```

**Nginx + TLS (ambas as opções, para servir o frontend e fazer proxy da API):**

```bash
sudo apt install -y nginx
sudo apt install -y certbot python3-certbot-nginx   # Let's Encrypt
```

**CLIs opcionais:**

| CLI | Quando usar | Instalação |
|-----|-------------|-----------|
| **Prisma** | `generate` / `db push` — **não precisa instalar global**, é usado via `npx` (já é devDependency da API). | — |
| **Stripe CLI** | Testar/encaminhar webhooks (`stripe listen`) e obter o `whsec_` em staging/local. | [docs](https://docs.stripe.com/stripe-cli#install) |
| **mongosh** | Inspecionar o banco no Atlas manualmente (debug). | `sudo apt install -y mongodb-mongosh` |

### Configuração dos serviços externos (dashboards)

Antes de subir, configure cada integração no respectivo painel e preencha as variáveis
de ambiente correspondentes (ver [Variáveis de Ambiente](#-variáveis-de-ambiente)):

| Serviço | O que fazer no painel | Preenche |
|---------|------------------------|----------|
| **MongoDB Atlas** | Criar cluster de produção · criar usuário do banco · **Network Access**: liberar o IP da VPS · copiar a connection string | `DATABASE_URL` |
| **Stripe** | Ativar modo **Live** · copiar as API keys · criar **Webhook** apontando para `https://api.SEU-DOMINIO/webhooks/stripe` e copiar o signing secret | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` |
| **Mercado Pago** | Suas integrações → **credenciais de produção** · copiar o Access Token · (opcional) criar Webhook em `https://api.SEU-DOMINIO/webhooks/mercadopago` | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` |
| **Resend** | **Verificar o domínio** de envio (registros DNS SPF/DKIM) · gerar API key | `RESEND_API_KEY`, `RESEND_FROM` |
| **OneSignal** | Criar app **Web Push** (PWA) · configurar o site/origem · copiar App ID e REST API Key | `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`, `VITE_ONESIGNAL_APP_ID` |
| **DNS** | Apontar `app.SEU-DOMINIO` e `api.SEU-DOMINIO` (registros A) para o IP da VPS | — |

> **Chaves `live` vs. `test`:** em produção use as chaves **live** do Stripe/MP e o
> `NODE_ENV=production` (desativa o bypass do OTP). A publishable key do Stripe e o App ID
> do OneSignal precisam ser os **mesmos** no backend e no frontend (`VITE_*`).

### 1. Rodar a API com Docker (recomendado)

Existe um **Dockerfile** pronto e validado em [apps/api/Dockerfile](apps/api/Dockerfile).
Ele instala as dependências, gera o Prisma Client (binário `linux-musl`) e roda a API via
`tsx`. Construa **a partir da raiz** do monorepo:

```bash
# Build (contexto = raiz do repo)
docker build -f apps/api/Dockerfile -t cheirin-api .

# Run (mantenha o container sempre no ar — os crons dependem disso)
docker run -d --name cheirin-api \
  --restart unless-stopped \
  -p 3001:3001 \
  --env-file apps/api/.env.production \
  cheirin-api

# Antes do primeiro deploy, sincronize o schema com o Atlas (uma vez):
docker run --rm --env-file apps/api/.env.production \
  -w /app/apps/api cheirin-api npx prisma db push
```

> **Por que `tsx` e não `node dist/server.js`?** O pacote interno `@cheirin-de-pao/shared`
> é TypeScript puro (sem etapa de build) e é importado pela API. Rodar o JS compilado
> falharia ao importar o `.ts` do shared (`Unknown file extension ".ts"`). O `tsx`
> transpila on-the-fly e resolve o workspace corretamente. O Dockerfile já cuida disso.

### 2. Rodar a API sem Docker (alternativa)

Se preferir rodar direto no host, use o `tsx` (mesma razão acima) com um **process manager**
para manter a API sempre ativa:

```bash
cd apps/api
npm ci                                    # instala deps (inclui tsx e prisma)
npx prisma generate                       # gera o Prisma Client
npx prisma db push                        # sincroniza schema/índices com o Atlas

# PM2 mantendo o processo vivo e reiniciando em falha/boot
NODE_ENV=production pm2 start "npx tsx src/server.ts" --name cheirin-api --update-env
pm2 save && pm2 startup
```

> Alternativa equivalente: unit `systemd` com `Restart=always` executando
> `npx tsx src/server.ts` em `apps/api` com as variáveis de ambiente definidas.

### 3. Build do Frontend

```bash
cd apps/web
# garanta apps/web/.env.production com VITE_API_URL apontando p/ o domínio da API
npm run build             # gera apps/web/dist/
```

Publique o conteúdo de `apps/web/dist/` como estático no Nginx.

### 4. Exemplo de configuração Nginx

> O **Dockerfile da API** está versionado em [apps/api/Dockerfile](apps/api/Dockerfile). A configuração do **Nginx** abaixo ainda **não está versionada** — use como ponto de partida.

```nginx
# Frontend (PWA estático)
server {
    listen 443 ssl;
    server_name app.cheirindepao.com.br;

    ssl_certificate     /etc/letsencrypt/live/app.cheirindepao.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.cheirindepao.com.br/privkey.pem;

    root /var/www/cheirin/web;   # conteúdo de apps/web/dist
    index index.html;

    # SPA fallback — todas as rotas caem no index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Service Worker não deve ser cacheado agressivamente
    location = /sw.js {
        add_header Cache-Control "no-cache";
    }
}

# API (reverse proxy)
server {
    listen 443 ssl;
    server_name api.cheirindepao.com.br;

    ssl_certificate     /etc/letsencrypt/live/api.cheirindepao.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.cheirindepao.com.br/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5. TLS com Let's Encrypt

```bash
sudo certbot --nginx -d app.cheirindepao.com.br -d api.cheirindepao.com.br
```

### 6. Configurações finais de produção

- Defina `CORS_ORIGIN=https://app.cheirindepao.com.br` no backend.
- Configure os webhooks apontando para `https://api.cheirindepao.com.br/webhooks/{stripe,mercadopago}` e preencha os *secrets*.
- Garanta `NODE_ENV=production` (desativa o bypass de OTP; ativa envio real por e-mail).
- Libere no MongoDB Atlas o IP da VPS (Network Access).

---

## ☑️ Checklist de Pré-Deploy

Ordem recomendada (banco → build → deploy):

- [ ] `apps/api/.env.production` (ou variáveis do host) preenchido com credenciais de **produção**.
- [ ] `apps/web/.env.production` com `VITE_API_URL` apontando para o domínio da API + chaves **live**.
- [ ] MongoDB Atlas: cluster de produção pronto e IP da VPS liberado.
- [ ] `npx prisma generate` executado.
- [ ] **Migrações no Atlas** (rodar antes de subir a nova API): `npm run migrate:slots` → `npx prisma generate` → `npx prisma db push`.
- [ ] `npm run typecheck` e `npm run test` verdes; `apps/web` builda (`npm run build`) e a imagem da API builda (`docker build -f apps/api/Dockerfile .`).
- [ ] Webhooks (Stripe/MP) configurados com URLs públicas e *secrets* corretos.
- [ ] `NODE_ENV=production` e `CORS_ORIGIN` corretos.
- [ ] Process manager / restart automático configurado (crons exigem API persistente).
- [ ] Admin inicial semeado (`ADMIN_*`) ou já existente no banco.
- [ ] `GET /health` responde `{ ok: true, db: "connected" }`.

---

## 🔒 Segurança

- **Nunca commite segredos.** Os arquivos `.env`, `.env.local`, `.env.*.local` e `.env.production` estão no `.gitignore` — mantenha-os fora do versionamento.
- ⚠️ **Atenção:** os arquivos `apps/api/.env.production` e `apps/web/.env.production` presentes na *working tree* contêm **credenciais reais (Stripe live, Mercado Pago, Resend, MongoDB, JWT)**. Eles não vão para o git, mas **considere rotacionar essas chaves** se houver qualquer risco de exposição, e prefira injetar segredos via variáveis de ambiente do host/orquestrador em produção.
- `JWT_SECRET` deve ser um valor forte e único por ambiente.
- Autenticação: **sessão única por device** — um novo login derruba as sessões de outros dispositivos (refresh retorna 401).
- Rate limit ativo (global + OTP) para mitigar abuso.
- Em produção, o bypass de OTP (`OTP_DEV_CODE`) é **desativado** — o código é gerado e enviado por e-mail de verdade.

---

## 🩺 Troubleshooting

| Sintoma | Causa provável / Solução |
|---------|--------------------------|
| API não sobe: erro de env obrigatória | Falta `DATABASE_URL`, `JWT_SECRET` ou `STRIPE_SECRET_KEY`. Preencha o `.env`. |
| `Unknown file extension ".ts"` ao rodar `node dist/server.js` | Esperado: o pacote `@cheirin-de-pao/shared` é TS puro. Rode a API com **`tsx`** (via Dockerfile ou `npx tsx src/server.ts`), não com o JS compilado. |
| `PrismaClient` não encontrado / tipos quebrados | Rode `npx prisma generate` em `apps/api`. |
| Frontend não fala com a API (CORS) | Ajuste `CORS_ORIGIN` no backend e `VITE_API_URL` no frontend. |
| OTP não chega por e-mail | Configure `RESEND_API_KEY` + `RESEND_FROM` (domínio verificado no Resend). Em dev, use `OTP_DEV_CODE`. |
| Pix falha ao gerar | Falta `MP_ACCESS_TOKEN` (produção do Mercado Pago). |
| Arquivos `.js` estranhos em `apps/web/src/` | `tsc` emitiu ao lado do TS. Não rode `tsc` sem `--noEmit` no web; nunca use `sudo npm`. |
| Crons não disparam | `NODE_ENV=test` desativa os crons; a API precisa estar rodando como processo persistente. |

---

## 📚 Documentação Adicional

| Documento | Conteúdo |
|-----------|----------|
| [CLAUDE.md](CLAUDE.md) | Constraints do projeto, stack e convenções. |
| [apps/api/API.md](apps/api/API.md) | Referência completa dos endpoints REST. |
| `http://localhost:3001/docs` | Swagger UI (OpenAPI 3) — interativo. |
| [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma) | Modelo de dados completo. |
| [.planning/](.planning/) | Roadmap, requisitos e histórico de fases (GSD). |
| [.projeto/docs/](.projeto/docs/) | Planos técnicos de features específicas. |

---

<p align="center">🥖 <b>Cheirin de Pão</b> — pão fresco na porta todo dia.</p>
