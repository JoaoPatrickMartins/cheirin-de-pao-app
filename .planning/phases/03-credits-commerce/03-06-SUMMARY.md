---
phase: 03-credits-commerce
plan: 06
type: summary
status: complete
completed_at: 2026-06-14
checkpoint: pending-human-verify
---

# Summary: 03-06 — Fluxos de pagamento Pix e Cartão

## O que foi entregue

**Task 1 — SDK + Polling + PixWaitingScreen**
- `@mercadopago/sdk-react` instalado em apps/web
- `usePaymentPolling.ts`: intervalo 3000ms, MAX_ATTEMPTS=5, `clearInterval` no cleanup (T-03-12 mitigado), callback `onApproved(creditBalance)` + `onRejected?()` opcionais
- `PixWaitingScreen.tsx`: lê `{ paymentId, qrCodeBase64, qrCode, comboQuantity }` do navigate state (camelCase, compatível com 03-05 T2); QR como `<img src="data:image/png;base64,..."/>`; copia-e-cola com feedback "Copiado!" 2s; spinner CSS `spin` inline; banner timeout (goldSoft) e rejected; ao aprovado → `updateCreditBalance` + navega `/client/creditos/sucesso`

**Task 2 — CardPaymentScreen + initMercadoPago**
- `main.tsx`: `initMercadoPago(VITE_MP_PUBLIC_KEY, { locale: 'pt-BR' })` com guard `if (import.meta.env.VITE_MP_PUBLIC_KEY)` — não executa em testes
- `CardPaymentScreen.tsx`: CardPayment Brick com `initialization={{ amount }}`; `onSubmit` envia `token/installments/issuerId/comboId/customQuantity` para `POST /payments/card`; `PUT /users/me/card-token` fire-and-forget após sucesso (D-06)

## Testes

| Arquivo | Status | Requisito |
|---------|--------|-----------|
| `usePaymentPolling.test.ts` | 5/5 GREEN | cleanup + MAX_ATTEMPTS |
| Suite completa | 33/33 GREEN | — |

## Segurança

- T-03-05 MITIGADO: apenas `VITE_MP_PUBLIC_KEY` no frontend; nenhuma referência a `MP_ACCESS_TOKEN`
- T-03-12 MITIGADO: polling para em 5 tentativas + clearInterval no cleanup

## Checkpoint humano (Task 3)

Aguardando verificação manual dos fluxos Pix e Cartão com credenciais sandbox do Mercado Pago. Ver instruções em `03-06-PLAN.md` Task 3.
