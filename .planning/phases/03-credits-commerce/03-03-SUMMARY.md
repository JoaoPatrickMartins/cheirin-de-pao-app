---
plan: 03-03
phase: 03-credits-commerce
status: complete
completed: 2026-06-14
tasks_total: 2
tasks_complete: 2
---

## Summary

Wave 2 — Webhooks module + server.ts registration complete.

## What Was Built

**Task 1 — WebhooksService (HMAC + idempotency):**
- `webhooks.service.ts`: `validateSignature` using `node:crypto createHmac('sha256')` — parses MP `x-signature` header (ts/v1 format), builds manifest `id:{dataId};request-id:{xRequestId};ts:{ts};`, compares HMAC-SHA256 against v1
- `processApprovedPayment`: fetches Payment by mercadoPagoId, returns immediately if `status === 'PAID'` (idempotency guard), calls `PaymentsRepository.creditUserBalance` + `updatePaymentStatus('PAID')` only for PENDING payments
- `processPayment`: entry point that skips non-`payment.updated` actions
- All 6 `webhooks.service.test.ts` tests GREEN

**Task 2 — Controller + Route + server.ts:**
- `webhooks.controller.ts`: extracts `x-signature`, `x-request-id`, `data.id` query param; returns 400 if any absent; returns 401 if HMAC invalid; processes and returns 200
- `webhooks.route.ts`: `POST /webhooks/mercadopago` with NO `authenticate` preHandler (public endpoint for MP calls)
- `server.ts`: imports and registers `paymentsRoute`, `creditsRoute`, `webhooksRoute`; adds `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_PUBLIC_KEY` to `envSchema.required`

## Key Security Properties
- T-03-01: HMAC-SHA256 validation before any payment processing
- T-03-02: Idempotency via `Payment.status === 'PAID'` guard
- T-03-03: Credit quantity read from DB (Combo.quantity or Payment.customQuantity), never from webhook payload

## Self-Check: PASSED
- `npx tsc --noEmit` clean on apps/api
- `webhooks.service.test.ts` 6/6 GREEN
- POST /webhooks/mercadopago has no authenticate preHandler ✓
- 3 modules registered in server.ts ✓

## key-files
created:
  - apps/api/src/modules/webhooks/webhooks.service.ts
  - apps/api/src/modules/webhooks/webhooks.controller.ts
  - apps/api/src/modules/webhooks/webhooks.route.ts
modified:
  - apps/api/src/server.ts
  - apps/api/src/modules/webhooks/__tests__/webhooks.service.test.ts
