---
phase: 11-configura-es-e-perfil-do-cliente
plan: "02"
subsystem: backend/client-profile
tags: [backend, api, profile, otp, contact-change]
key-files:
  created:
    - apps/api/src/modules/client-profile/client-profile.schema.ts
    - apps/api/src/modules/client-profile/client-profile.repository.ts
    - apps/api/src/modules/client-profile/client-profile.service.ts
    - apps/api/src/modules/client-profile/client-profile.controller.ts
    - apps/api/src/modules/client-profile/client-profile.route.ts
  modified:
    - apps/api/src/server.ts
    - apps/api/src/modules/auth/auth.repository.ts
metrics:
  tasks_completed: 2
  tasks_total: 2
  commits: 2
---

# Plan 11-02 Summary — Módulo backend client-profile

## What Was Built

Módulo `client-profile` completo no backend com 4 endpoints REST autenticados:

- `GET /client/profile` — retorna dados completos do cliente autenticado (id, name, cpf, birthDate, phone, email, condominiumId, condominiumName, apartment, block, creditBalance)
- `PATCH /client/profile` — atualiza nome, birthDate, condomínio, apartamento, bloco. Nunca CPF. Mudança de condominiumId desativa schedules ativos e retorna `scheduleDeactivated: true`
- `POST /client/profile/contact/request-change` — valida conflito de contato, cria OTP com `purpose='CONTACT_CHANGE'` e envia via SMS/email (rate limit 5/min)
- `POST /client/profile/contact/confirm-change` — valida OTP com `timingSafeEqual`, marca como usado, atualiza contato no banco

## Commits

| Commit | Descrição |
|--------|-----------|
| `acfd97a` | feat(11-02): módulo client-profile — schema, repository, service |
| `9883b11` | feat(11-02): controller + route + wiring server.ts + prisma db push |

## Deviations

- O campo `channel` do OTP é armazenado como `"sms:{phone}"` ou `"email:{email}"` para que `confirmContactChange` possa recuperar o valor do novo contato sem campo extra no schema — solução pragmática dentro das constraints do `OtpCode` (sem campo `data`).
- `findActiveOtp` em `auth.repository.ts` corrigido para `purpose: { in: [null as unknown as string, 'LOGIN'] }` devido a limitação de tipo do Prisma com arrays contendo null.

## Self-Check

- [x] `npx tsc --noEmit` — zero erros de TypeScript
- [x] `npx prisma db push` — campo `purpose` aplicado ao Atlas sem erros
- [x] 5 arquivos criados em `apps/api/src/modules/client-profile/`
- [x] `server.ts` contém import e `await fastify.register(clientProfileRoute)`
- [x] CPF ausente do `UpdateProfileSchema` (CONF-03 ✓)
- [x] `purpose: 'CONTACT_CHANGE'` nos OTPs de mudança de contato (D-18 ✓)
- [x] `userId` sempre de `request.user.id` — nunca do body (T-10-02-01 ✓)
- [x] Rate limit 5/min nos endpoints OTP (T-11-02-04 ✓)

**Self-Check: PASSED**
