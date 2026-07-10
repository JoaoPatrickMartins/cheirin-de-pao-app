# builder
FROM node:20 AS builder

WORKDIR /app

COPY . ./

RUN npm install

RUN npm run build:web

# installer
FROM node:20 AS installer

WORKDIR /app

COPY --from=builder /app/out/json ./

RUN npm install

COPY --from=builder /app/out/full ./

COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json

COPY ./apps/web/.env.production ./.env.production

RUN npm run build --filter=@cheirin-de-pao/web


# serving container
FROM nginx:1.23.3-alpine

WORKDIR /etc/nginx

COPY --from=installer /app/apps/web/dist /usr/share/nginx/html

# Containers run nginx with global directives and daemon off
ENTRYPOINT ["nginx", "-g", "daemon off;"]