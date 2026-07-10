---
title: Documentação completa da API REST
type: task
priority: high
created: 2026-06-14
status: pending
resolves_phase: null
---

# Documentação completa da API REST

Gerar documentação completa e detalhada de todas as rotas da API (Fastify/Prisma) incluindo:

## Escopo

### Por rota, documentar:
- **Método HTTP** + **path** completo
- **Autenticação** exigida (pública / Bearer token / role: ADMIN|CLIENT|COURIER)
- **Parâmetros de path** (`:id`, etc.) com tipo e descrição
- **Request body**: todos os campos com tipo, obrigatoriedade, validação (Zod) e exemplo
- **Query params** se houver
- **Respostas possíveis**: status code + shape do JSON para cada caso (200, 201, 400, 401, 403, 404, 409, 500)
- **Exemplo de request** (curl ou JSON)
- **Exemplo de resposta** (JSON formatado)
- **Notas de negócio** relevantes (ex.: OTP expira em 5 min, CPF é validado com dígito verificador, etc.)

### Rotas a documentar (já implementadas):
- `POST /auth/otp/send` — envia OTP para login ou cadastro
- `POST /auth/otp/verify` — verifica OTP e cria sessão
- `POST /auth/register` — cadastro de novo cliente
- `POST /auth/couriers` — admin cadastra entregador (requer ADMIN)
- `GET /condominiums` — lista condomínios disponíveis
- `GET /health` — health check do servidor

### Formato de saída:
- Arquivo `apps/api/docs/API.md` em Markdown legível para humanos
- Opcionalmente: `apps/api/docs/openapi.yaml` (OpenAPI 3.0) para uso com Swagger UI / Postman import

## Critério de aceite
- Todo campo de request e response está descrito com tipo e exemplo
- Todos os status codes de erro estão documentados
- Exemplos de curl funcionais para cada rota
- Documentação atualizada a cada nova fase que adiciona rotas
