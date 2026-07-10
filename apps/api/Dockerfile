# Stage 1 — prune: reduz o monorepo só ao que a API precisa

FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build:api          

# Stage 2 — installer 

FROM node:20-alpine AS installer
# Prisma (engine musl) precisa de openssl no Alpine
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

COPY --from=builder /app/out/json ./
RUN npm install

COPY --from=builder /app/out/full ./
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json

RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# bundla a API (tsup inlina o shared -> dist/server.js)
RUN npm run build --filter=@cheirin-de-pao/api

# Stage 3 — runner
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app/apps/api

COPY --from=installer /app/node_modules        /app/node_modules
COPY --from=installer /app/package.json        /app/package.json
COPY --from=installer /app/apps/api/dist       ./dist
COPY --from=installer /app/apps/api/prisma     ./prisma
COPY --from=installer /app/apps/api/package.json ./package.json

COPY apps/api/.env.production ./.env

EXPOSE 3001
CMD ["node", "dist/server.js"]

