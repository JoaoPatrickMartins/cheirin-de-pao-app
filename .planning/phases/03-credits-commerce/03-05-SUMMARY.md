---
phase: 03-credits-commerce
plan: 05
type: summary
status: complete
completed_at: 2026-06-14
---

# Summary: 03-05 — Tela de compra + componentes de crédito

## O que foi entregue

**Task 1 — Componentes reutilizáveis**
- `QuantityStepper.tsx`: stepper 48px com min/max enforced, botões disabled nos limites (aria-label para acessibilidade)
- `StepperInline.tsx`: variante 34px para agenda semanal (Fase 4), número cor accent quando value>0
- `ComboCard.tsx`: card selecionável com badge tag, preço riscado condicional (`antes > price`), radio indicator, borda/sombra ativa/inativa com transição 150ms
- `BannerInsuficiente.tsx`: retorna null quando `requerido <= saldo`; ícone alert, CTAs "Comprar mais" e "Usar {saldo}"

**Task 2 — Telas**
- `CombosScreen.tsx`: toggle Combos/Compra personalizada (Segmented Control gap 6px conforme UI-SPEC), carrega `/combos` e `/pricing` via Promise.all, ComboCard selecionável, QuantityStepper avulso com `max=avulsoLimite-1`, comparativo de economia com melhor combo, banner CRED-06 "Créditos não expiram", CTA bar fixo com seletor Pix/Cartão
- `PurchasedScreen.tsx`: ícone check animado (scaleIn 250ms), "+{N} pães adicionados" lendo N do navigate state, CTAs Montar minha agenda → /client/agenda + Voltar ao início → /client/home
- `AutoBuyScreen.tsx`: toggle mestre, seleção de modo (acabar/semanal), chips de dia da semana com scroll horizontal, seleção de combo com rádio 22px, nota de cobrança, PUT /users/me/auto-recharge [CRED-07/08/10]

## Contrato crítico — navigate state para PixWaitingScreen (camelCase obrigatório)

```typescript
// CombosScreen.tsx linha 94-102
const { paymentId, qr_code_base64: qrCodeBase64, qr_code: qrCode } = await res.json()
const comboQuantity = selectedCombo?.quantity ?? customQty
navigate('/client/creditos/pix', { state: { paymentId, qrCodeBase64, qrCode, comboQuantity } })
// NUNCA passa qr_code_base64 (snake_case) no state
```

## Testes

| Arquivo | Status | Requisito |
|---------|--------|-----------|
| `QuantityStepper.test.tsx` | 6/6 GREEN | UI-07 |
| `CombosScreen.test.tsx` | 4/4 GREEN | CRED-01 |

## Segurança

- T-03-09 MITIGADO: `POST /payments/pix` envia apenas `{ comboId }` ou `{ customQuantity }` — nunca o preço
- T-03-10 MITIGADO: `PUT /users/me/auto-recharge` via `apiFetch` com token Bearer; endpoint autenticado no backend

## Desvios do plano

Nenhum. Todos os arquivos entregues conforme especificado.
