# syntax=docker/dockerfile:1
# =============================================================================
# Cheirin de Pão — API (Fastify + Prisma)
#
# Build a partir da RAIZ do monorepo (o contexto precisa enxergar
# packages/shared e o package-lock.json da raiz):
#
#   docker build -f apps/api/Dockerfile -t cheirin-api .
#
# Run (carregando as variáveis de ambiente do arquivo):
#
#   docker run --rm -p 3001:3001 --env-file apps/api/.env.production cheirin-api
#
# A API roda via `tsx` (transpila TypeScript on-the-fly). Motivo: o pacote
# interno @cheirin-de-pao/shared é TypeScript puro (sem etapa de build), então
# `node dist/server.js` falharia ao importar o .ts. O tsx resolve o workspace.
# =============================================================================

# ---------- Stage 1: dependências + Prisma Client -----------------------------
FROM node:20-alpine AS deps
WORKDIR /app

# OpenSSL é exigido pelo query engine do Prisma no Alpine (musl).
RUN apk add --no-cache openssl

# Manifests primeiro para aproveitar o cache de layers do Docker.
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json

# Instala root + workspace da API (traz também a dep interna packages/shared,
# além de tsx e do Prisma CLI, que são devDependencies necessárias em runtime/build).
RUN npm ci --workspace apps/api --include-workspace-root

# Gera o Prisma Client para a plataforma do container (linux-musl).
# Gerar DENTRO do build garante o binário correto (não copie o client do host).
COPY apps/api/prisma ./apps/api/prisma
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# ---------- Stage 2: runtime --------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl

# node_modules (com o Prisma Client já gerado), manifests e o schema Prisma.
COPY --from=deps /app ./

# tsconfig raiz (apps/api/tsconfig.json faz "extends" dele) + código-fonte.
COPY tsconfig.base.json ./tsconfig.base.json
COPY packages/shared/src ./packages/shared/src
COPY apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY apps/api/src ./apps/api/src

WORKDIR /app/apps/api
EXPOSE 3001

# Healthcheck bate no endpoint /health (503 se o Mongo não responder).
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health >/dev/null 2>&1 || exit 1

# tsx transpila TS on-the-fly e resolve o workspace @cheirin-de-pao/shared.
CMD ["npx", "tsx", "src/server.ts"]
