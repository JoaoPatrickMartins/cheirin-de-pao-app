---
phase: 12
slug: cartoes-salvos
created: 2026-06-19
---

# Phase 12 — Pattern Map

> Analog files e trechos de código existentes para cada arquivo da Fase 12.

---

## Coverage

- Arquivos classificados: 10 (6 novos + 2 modificados + 2 testes)
- Analogs encontrados: 10/10
- Trechos sem analog (usar RESEARCH.md): 4

---

## Padrões Transversais

**1. Módulo backend: route → controller → service → repository**
Idêntico a `client-profile` e `payments` — classe com `constructor(private fastify: FastifyInstance)`, acesso Prisma via `this.fastify.prisma`, autenticação via `preHandler: [fastify.authenticate]`.

**2. Erros de negócio: `throw { error: string, status: number }`**
Controller usa `isBusinessError()` guard (copiado de `payments.controller.ts` linhas 18-31) para distinguir erro nosso do erro bruto do SDK MP, nunca vazando detalhes internos.

**3. IDOR protection: nunca retornar 403**
Verificar `savedCard.userId !== userId` e lançar 404, igual ao padrão em `payments.service.ts`.

**4. Transação atômica `setDefault` usa `prisma.$transaction`**
Padrão já existente em `payments.repository.ts` linhas 35-50 — evita race condition com dois cartões padrão simultâneos.

---

## Mapa por Arquivo

### Backend — Novos

| Arquivo | Copiar de | Linhas de referência |
|---------|-----------|----------------------|
| `apps/api/src/modules/saved-cards/saved-cards.route.ts` | `apps/api/src/modules/client-profile/client-profile.route.ts` | 1-29 inteiro |
| `apps/api/src/modules/saved-cards/saved-cards.controller.ts` | `apps/api/src/modules/payments/payments.controller.ts` | 1-31 (imports + guards) + 70-94 (método padrão) |
| `apps/api/src/modules/saved-cards/saved-cards.service.ts` | `apps/api/src/modules/payments/payments.service.ts` (1-17 construtor MP) + `apps/api/src/modules/client-profile/client-profile.service.ts` (estrutura geral) | — |
| `apps/api/src/modules/saved-cards/saved-cards.repository.ts` | `apps/api/src/modules/client-profile/client-profile.repository.ts` | 1-9 (estrutura) + 10-70 (métodos tipados) |
| `apps/api/src/modules/saved-cards/saved-cards.schema.ts` | `apps/api/src/modules/payments/payments.schema.ts` | 1-37 (padrão Zod + type inference) |

### Backend — Testes

| Arquivo | Copiar de | Linhas de referência |
|---------|-----------|----------------------|
| `apps/api/src/modules/saved-cards/__tests__/saved-cards.service.test.ts` | `apps/api/src/modules/payments/__tests__/payments.service.test.ts` | 1-50 (mock MP + createMockFastify) + 52-170 (describe aninhado) |

### Frontend — Novos

| Arquivo | Copiar de | Linhas de referência |
|---------|-----------|----------------------|
| `apps/web/src/components/client/SavedCardItem.tsx` | `apps/web/src/components/client/ComboCard.tsx` | 20-140 (card selecionável + radio indicator 26×26px) |
| `apps/web/src/components/client/SavedCardsList.tsx` | `apps/web/src/screens/client/SettingsScreen.tsx` (43-54 fetch + loading state) + `apps/web/src/lib/apiFetch.ts` | — |

### Frontend — Modificados

| Arquivo | Padrão a replicar | Linhas de referência |
|---------|-------------------|----------------------|
| `apps/web/src/screens/client/CardPaymentScreen.tsx` | CTA bar: `CombosScreen.tsx` 348-413; Toast: `SettingsScreen.tsx` 135-156 | — |
| `apps/web/src/screens/client/SettingsScreen.tsx` | Dialog: `SettingsScreen.tsx` 306-395; SectionCard: 417-443; Item de cartão baseado em ContactRow: 461-507 | — |

---

## Trechos sem analog (usar RESEARCH.md)

| Trecho | Referência |
|--------|-----------|
| `getOrCreateMpCustomer` (idempotente) | RESEARCH.md Padrão 1 |
| `createCardWithSaved` com `CardToken.create` + CVV | RESEARCH.md Padrão 2 |
| Renderização SVG Mastercard (dois círculos sobrepostos) | UI-SPEC §Ícone de Bandeira |
| Input CVV nativo `<input type="password">` | RESEARCH.md Padrão 4 |

---

## Radio Indicator — Especificação Exata (ComboCard)

```
Círculo externo: 26×26px
  - não selecionado: borda 2px --color-border, fundo transparente
  - selecionado: borda 2px --color-accent, fundo transparente
Círculo interno (quando selecionado): 13×13px, fundo --color-accent
Transição: 150ms ease-out em borda e fundo
```

## CTA Bar — Especificação Exata (CombosScreen)

```
position: fixed
bottom: calc(56px + env(safe-area-inset-bottom))
left: 0; right: 0
padding: 10px 20px 12px
border-top: 1px solid var(--color-border-2)
background: var(--color-app-bg)
```

## Toast — Especificação Exata (SettingsScreen)

```
position: fixed; top: 16px; left: 50%; transform: translateX(-50%)
background: var(--color-espresso)
color: var(--color-primary-btn-text) (#FBF3E4)
font-size: 15px; font-weight: 600
border-radius: 12px; padding: 12px 16px
auto-dismiss: 2500ms; z-index: 9999
```

## Dialog Confirmação — Especificação Exata (SettingsScreen)

```
overlay: rgba(0,0,0,0.45) cobrindo toda a tela
card: bg --color-surface, radius 22px, padding 24px
max-width: calc(100vw - 48px) | max-width absoluta: 320px
botões em coluna: "Manter cartão" em cima, "Remover cartão" embaixo, gap: 8px
```
