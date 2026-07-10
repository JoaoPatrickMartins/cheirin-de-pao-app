---
phase: 12-cart-es-salvos
verified: 2026-06-19T23:00:00Z
status: human_needed
score: 14/15 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Testes de saved-cards.service.test.ts refletem a implementação pós-revisão (CR-03 + WR-04)"
    status: partial
    reason: "Dois assertions no teste 'remove no MP e depois no Prisma em caso de sucesso' divergem do código pós-revisão: (1) linha 247 espera { where: { id: 'card-1' } } mas a implementação pós-WR-04 usa { where: { id, userId } }; (2) linha 265 espera rejects.toThrow('MP API error') mas a implementação pós-CR-03 relança { error: '...', status: 502 }, não o Error original."
    artifacts:
      - path: "apps/api/src/modules/saved-cards/__tests__/saved-cards.service.test.ts"
        issue: "Assertions nas linhas 247 e 265 não refletem o comportamento pós-code-review (CR-03 e WR-04 já aplicados no service/repository mas não atualizados nos testes)"
    missing:
      - "Atualizar linha 247: esperar { where: { id: 'card-1', userId: 'user-1' } }"
      - "Atualizar linha 265: esperar rejects.toMatchObject({ error: expect.any(String), status: 502 }) ao invés de toThrow('MP API error')"
human_verification:
  - test: "Fluxo completo de seleção e pagamento com cartão salvo (Modo A)"
    expected: "CardPaymentScreen exibe lista de cartões com radio indicator, cartão padrão pré-selecionado, input CVV nativo, CTA 'Pagar com este cartão'; após POST bem-sucedido navega para /client/creditos/sucesso"
    why_human: "Integração real com GET /users/me/cards + MP Customer API; renderização visual do radio indicator e seleção de cartão requerem browser"
  - test: "Cadastrar novo cartão com salvar (CARD-02)"
    expected: "Card 'Adicionar novo cartão' expande com Brick inline; checkbox 'Salvar para compras futuras' marcado por padrão; após pagamento com saveCard:true o cartão aparece nas compras seguintes"
    why_human: "Requer credenciais MP Sandbox reais e formulário Brick funcionando; não testável via grep"
  - test: "CARD-03 — CTA 'Pagar sem salvar' via Brick buttonLabel com menor destaque"
    expected: "Com checkbox desmarcado, o Brick exibe label 'Pagar sem salvar' (implementado via customization.visual.buttonLabel); o botão do Brick tem visual diferente de 'Salvar cartão e pagar'; diferença visual percebida pelo usuário"
    why_human: "A diferença de destaque visual depende do comportamento de estilização do Brick do MP; não verificável via análise estática — o Brick controla seu próprio CSS"
  - test: "Gerenciamento completo na SettingsScreen (CARD-05)"
    expected: "Seção 'Cartões' entre 'Contato' e 'Condomínio'; listar cartões com badge Padrão; PATCH /users/me/cards/:id via 'Definir como padrão' + toast; dialog de remoção com •••• XXXX; DELETE + toast 'Cartão removido.'; estado vazio; rodapé condicional"
    why_human: "Comportamento visual, sequência de interações e toasts requerem browser + API real"
  - test: "Limite de 3 cartões enforçado servidor e cliente"
    expected: "Com 3 cartões cadastrados: (a) backend retorna 400 ao tentar salvar um 4º; (b) frontend não exibe 'Adicionar novo cartão' quando count = 3 (verificar se há guard no frontend)"
    why_human: "Requer estado real com 3 cartões cadastrados via MP Customer API"
---

# Phase 12: Cartões Salvos — Verification Report

**Phase Goal:** MP Customer API + cartão salvo no fluxo compra
**Verified:** 2026-06-19T23:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /users/me/cards retorna apenas cartões do usuário autenticado, nunca de outro usuário | ✓ VERIFIED | `saved-cards.service.ts:28-30` usa `repo.findByUser(userId)` que chama `prisma.savedCard.findMany({ where: { userId } })`; service `setDefault`/`removeCard`/`createCardWithSaved` verificam `savedCard.userId !== userId` e lançam 404 |
| 2 | POST /payments/card com savedCardId chama CardToken.create com card_id + customer_id + security_code antes de Payment.create | ✓ VERIFIED | `payments.service.ts:166-177` chama `this.cardTokenApi.create({ body: { card_id, customer_id, security_code } })` e usa o token retornado em `Payment.create`; teste `payments-card-saved.test.ts:162-176` verifica e garante que `security_code` não aparece nos args do Payment.create |
| 3 | Salvar cartão com saveCard:true é atomicamente vinculado ao fluxo de Payment.create bem-sucedido | ✓ VERIFIED | `payments.service.ts:217`: `if (saveCard && rawToken && !savedCardId)` está dentro do bloco após `this.repo.createPayment(...)` — Customer.createCard só é chamado após Payment.create bem-sucedido (T-12-04) |
| 4 | setDefault usa prisma.$transaction — impossível ter dois cartões padrão simultâneos | ✓ VERIFIED | `saved-cards.repository.ts:33-46`: `prisma.$transaction([updateMany, update])` com ambas as operações em sequência atômica; testes cobrem (linha 173-201) |
| 5 | DELETE /users/me/cards/:id remove no MP Customer API E no Prisma (sincronizado) | ✓ VERIFIED | `saved-cards.service.ts:87-98`: remove no MP via `customerCardApi.remove()`, somente após sucesso chama `repo.deleteById(cardId, userId)`; se MP falhar, relança 502 e Prisma não é modificado (CR-03 fix aplicado) |
| 6 | Limite de 3 cartões é enforçado no service, não apenas no frontend | ✓ VERIFIED | `saved-cards.service.ts:152-154` (saveNewCard): `count >= 3` → throw 400; `payments.service.ts:223`: `count < 3` antes de chamar CustomerCard.create; race condition coberta por recontagem pós-criação (CR-01 fix) |
| 7 | CardPaymentScreen exibe lista de cartões salvos (Modo A) quando GET /users/me/cards retorna itens | ✓ VERIFIED | `CardPaymentScreen.tsx:50-68`: useEffect chama `apiFetch('/users/me/cards')`; `hasSavedCards = savedCards.length > 0` (linha 70); JSX exibe `SavedCardsList` em modo select quando `hasSavedCards && !loadingCards` |
| 8 | Cartão padrão vem pré-selecionado ao abrir a tela | ✓ VERIFIED | `CardPaymentScreen.tsx:55-58`: `cards.find(c => c.isDefault) ?? cards[0]` define `selectedCardId` no useEffect |
| 9 | CVV é capturado por input nativo (type=password, maxLength=4) — nunca pelo Brick em modo CVV-only | ✓ VERIFIED | `CardPaymentScreen.tsx:288-326`: `<input type="password" inputMode="numeric" maxLength={4}>` com limpeza pós-POST (`setCvv('')`); validação por bandeira (amex=4, outros=3) via WR-02 fix |
| 10 | CTA muda dinamicamente entre 3 estados | ⚠️ PARTIAL | "Pagar com este cartão" (linha 155) e "Pagar com cartão"/Modo B funcionam via `ctaLabel`. "Salvar cartão e pagar"/"Pagar sem salvar" são implementados como `buttonLabel` do Brick (CR-02 fix) — não como botão externo com estilo explícito `12.5px color-text-sec sem fundo`. Funcional mas visual do Brick não verificável via grep |
| 11 | "Pagar sem salvar" tem menor destaque visual: 12.5px, color-text-sec, sem fundo de botão | ? UNCERTAIN | Implementado via `customization.visual.buttonLabel` do Brick (linha 432) — o estilo do botão é controlado pelo MP Brick, não pelo app. Não é possível verificar estilo programaticamente |
| 12 | Modo B (sem cartões salvos) preserva comportamento atual do Brick | ✓ VERIFIED | `CardPaymentScreen.tsx:499-563`: bloco `!loadingCards && !hasSavedCards` renderiza Brick + checkbox `saveModeBCard` (unchecked por padrão) |
| 13 | SettingsScreen exibe seção 'Cartões' entre 'Contato' e 'Condomínio' | ✓ VERIFIED | `SettingsScreen.tsx:309-334`: `<SectionCard title="Cartões">` posicionado após seção Contato (linha 295) e antes de Condomínio (linha 337) |
| 14 | Remover cartão exige confirmação via dialog; confirmação dispara DELETE /users/me/cards/:id e exibe toast 'Cartão removido.' | ✓ VERIFIED | Dialog em `SettingsScreen.tsx:396-493`; `handleRemoveConfirm` (linha 166-184) chama `apiFetch('/users/me/cards/${cardToRemove.id}', { method: 'DELETE' })`; toast "Cartão removido." (linha 173) |
| 15 | Testes unitários cobrindo CARD-01, CARD-02, CARD-04, CARD-05, CARD-06 passam sem quebrar testes existentes | ⚠️ PARTIAL | 21 testes declarados no SUMMARY como passando; porém após CR-03 e WR-04 (code review fixes), dois assertions em `saved-cards.service.test.ts` estão divergentes da implementação atual (linhas 247 e 265) — ver seção Gaps |

**Score:** 13/15 truths verificadas como VERIFIED; 1 PARTIAL (gap real), 1 UNCERTAIN (requer human)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/modules/saved-cards/saved-cards.schema.ts` | Zod schemas SavedCardParams + SetDefaultBody | ✓ VERIFIED | Existe, referenciado em controller |
| `apps/api/src/modules/saved-cards/saved-cards.repository.ts` | findByUser, findById, countByUser, create, setDefault ($transaction), deleteById | ✓ VERIFIED | Implementado completo; $transaction confirmado (linha 34); deleteById inclui userId (WR-04) |
| `apps/api/src/modules/saved-cards/saved-cards.service.ts` | listCards, getOrCreateMpCustomer, setDefault, removeCard, createCardWithSaved, saveNewCard | ✓ VERIFIED | Todos os 6 métodos presentes; IDOR em todos; CVV descartado; limite enforçado |
| `apps/api/src/modules/saved-cards/saved-cards.controller.ts` | list, setDefault, remove com isBusinessError guard | ✓ VERIFIED | Todos os 3 handlers; guard presente (linha 17-29) |
| `apps/api/src/modules/saved-cards/saved-cards.route.ts` | GET /users/me/cards, PATCH /users/me/cards/:id, DELETE /users/me/cards/:id com preHandler: [fastify.authenticate] | ✓ VERIFIED | 3 rotas com `auth = { preHandler: [fastify.authenticate] }` (linha 11) |
| `apps/api/src/modules/saved-cards/__tests__/saved-cards.service.test.ts` | Testes TDD cobrindo CARD-01/04/05/06 | ⚠️ STUB | Arquivo existe com 16 testes; porém 2 assertions estão desatualizadas após WR-04 (delete sem userId) e CR-03 (erro relançado como objeto não Error) |
| `apps/api/src/modules/payments/__tests__/payments-card-saved.test.ts` | Testes do path saveCard:true em POST /payments/card (CARD-02) | ✓ VERIFIED | 5 testes; assertions corretas para CR-01 race condition fix |
| `apps/api/src/modules/payments/payments.service.ts` | Expandido com savedCardId + saveCard flows | ✓ VERIFIED | `createCard` aceita ambos os flows; CardToken.create antes de Payment.create; saveCard após Payment.create |
| `apps/api/src/server.ts` | savedCardsRoute registrado | ✓ VERIFIED | Linha 191: `fastify.register(savedCardsRoute)` |
| `apps/web/src/components/client/SavedCardItem.tsx` | Card com radio indicator, mode='select'|'manage' | ✓ VERIFIED | Arquivo existe; renderBrandIcon (Visa/Mastercard/Elo/genérico); radio 26×26px; modo manage com badge Padrão |
| `apps/web/src/components/client/SavedCardsList.tsx` | Lista com skeleton, erro, vazio | ✓ VERIFIED | Arquivo existe; skeleton 3 cards; erro; vazio por modo; role="radiogroup" no select |
| `apps/web/src/pages/client/CardPaymentScreen.tsx` | Refatorado com Modo A + Modo B + CVV nativo | ✓ VERIFIED | Modo A (savedCards > 0) e Modo B (savedCards === 0); CVV input nativo; CTA dinâmica |
| `apps/web/src/pages/client/SettingsScreen.tsx` | SavedCardsSection com manage, dialog, toast | ✓ VERIFIED | Seção Cartões presente; dialog remoção; handleSetDefault + handleRemoveConfirm; todos os toasts |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `saved-cards.route.ts` | `fastify.authenticate` preHandler | `preHandler: [fastify.authenticate]` | ✓ WIRED | Linha 11: `const auth = { preHandler: [fastify.authenticate] }` aplicado aos 3 endpoints |
| `payments.service.ts (createCard)` | `CardToken.create + Payment.create` | `cardTokenApi.create({ card_id, customer_id, security_code })` | ✓ WIRED | Linha 166-177; token gerado antes de `paymentApi.create` (linha 183) |
| `saved-cards.service.ts (setDefault)` | `prisma.$transaction` | `repo.setDefault → prisma.$transaction([updateMany, update])` | ✓ WIRED | Repository linha 34: `prisma.$transaction([...])` |
| `server.ts` | `savedCardsRoute` | `fastify.register(savedCardsRoute)` | ✓ WIRED | Linha 191 confirmado |
| `CardPaymentScreen.tsx` | `GET /users/me/cards` | `apiFetch('/users/me/cards')` em useEffect | ✓ WIRED | Linha 50: `apiFetch('/users/me/cards')` |
| `CardPaymentScreen.tsx (cartão salvo)` | `POST /payments/card` | `{ savedCardId, securityCode, comboId, customQuantity }` | ✓ WIRED | Linhas 92-100: body com savedCardId e securityCode |
| `SettingsScreen.tsx (SavedCardsSection)` | `GET /users/me/cards` | `apiFetch('/users/me/cards')` em useEffect | ✓ WIRED | Linha 67 |
| `SettingsScreen.tsx (remover)` | `DELETE /users/me/cards/:id` | `apiFetch('/users/me/cards/${id}', { method: 'DELETE' })` | ✓ WIRED | Linha 170 |
| `SettingsScreen.tsx (padrão)` | `PATCH /users/me/cards/:id` | `apiFetch('/users/me/cards/${id}', { method: 'PATCH', body: { isDefault: true } })` | ✓ WIRED | Linha 143-147 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `CardPaymentScreen.tsx` | `savedCards` | `apiFetch('/users/me/cards') → GET /users/me/cards → prisma.savedCard.findMany({ where: { userId } })` | Sim — query Prisma real | ✓ FLOWING |
| `SettingsScreen.tsx` | `savedCards` | `apiFetch('/users/me/cards') → GET /users/me/cards → prisma.savedCard.findMany({ where: { userId } })` | Sim — query Prisma real | ✓ FLOWING |
| `payments.service.ts (createCard)` | `paymentToken` | `cardTokenApi.create() → MP Customer API → token` | Sim — MP API real | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| savedCardsRoute registrado em server.ts | `grep -n "savedCardsRoute" server.ts` | Linhas 31 e 191 confirmadas | ✓ PASS |
| cardTokenApi.create presente antes de Payment.create | `grep -n "cardTokenApi.create" payments.service.ts` | Linha 166, antes da linha 183 (paymentApi.create) | ✓ PASS |
| $transaction em setDefault | `grep -n "\$transaction" saved-cards.repository.ts` | Linha 34 confirmada | ✓ PASS |
| CVV input nativo (type=password) em CardPaymentScreen | `grep -c "type.*password" CardPaymentScreen.tsx` | 1 occurrence linha 289 | ✓ PASS |
| "Pagar sem salvar" presente em CardPaymentScreen | `grep CardPaymentScreen.tsx` | Linha 432 via buttonLabel | ✓ PASS |
| users/me/cards em SettingsScreen (GET + PATCH + DELETE) | `grep -c "users/me/cards" SettingsScreen.tsx` | 3 occurrences (GET:67, PATCH:143, DELETE:170) | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Descrição | Status | Evidência |
|-------------|-------------|-----------|--------|-----------|
| CARD-01 | 12-01, 12-02 | Cliente vê lista de cartões salvos no fluxo de compra | ✓ SATISFIED | GET /users/me/cards implementado; CardPaymentScreen Modo A funcional |
| CARD-02 | 12-01, 12-02 | Salvar cartão no fluxo de compra (opcionalmente) | ✓ SATISFIED | saveCard flow em payments.service.ts; Brick + checkbox no frontend |
| CARD-03 | 12-02 | Opção sem salvar com menor destaque visual | ⚠️ UNCERTAIN | Implementado via Brick buttonLabel (CR-02 fix); estilo visual depende do MP Brick — requer verificação humana |
| CARD-04 | 12-01, 12-02 | CVV solicitado para validação de transação (D-16 PCI DSS) | ✓ SATISFIED | CVV capturado via input nativo; CardToken.create usa card_id + customer_id + security_code; token de uso único; CVV nunca armazenado. Nota: REQUIREMENTS.md diz "sem re-digitar" mas RESEARCH.md confirma CVV obrigatório por PCI DSS em cada transação com MP — design decision documentada |
| CARD-05 | 12-03 | Gerenciar cartões (padrão, remover) nas configurações | ✓ SATISFIED | SettingsScreen com seção Cartões, PATCH e DELETE implementados, dialog e toasts presentes. Nota: REQUIREMENTS.md traceability ainda mostra "Pending" (linha 326) — staleness documental, código implementado |
| CARD-06 | 12-01, 12-02 | Cartão salvo funciona para combo e compra personalizada | ✓ SATISFIED | payments.service.ts aceita `comboId?` e `customQuantity?` em ambos os flows; CardPaymentScreen passa ambos os campos no POST body |

**CARD-05 documentation staleness:** A tabela de traceability em REQUIREMENTS.md linha 326 mostra `Pending` para CARD-05. O código em SettingsScreen.tsx está implementado e o checkpoint humano foi aprovado (12-03-SUMMARY.md). Isto é uma discrepância documental — o arquivo REQUIREMENTS.md não foi atualizado para `Complete`.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `saved-cards.service.test.ts` | 247 | `expect(...delete).toHaveBeenCalledWith({ where: { id: 'card-1' } })` — falta `userId` | ⚠️ Warning | Assertion stale após WR-04 fix (deleteById agora inclui userId); teste pode falhar ou passar por coincidência dependendo de como o mock está configurado |
| `saved-cards.service.test.ts` | 265 | `expect(...removeCard).rejects.toThrow('MP API error')` — erro original suprimido | ⚠️ Warning | Após CR-03 fix, removeCard captura o Error e relança como `{ error: '...', status: 502 }`; o `.toThrow()` não corresponde a um objeto plain — teste deve usar `.toMatchObject({ status: 502 })` |

**Nenhum marcador TBD/FIXME/XXX não referenciado encontrado nos arquivos desta fase.**

---

### Human Verification Required

#### 1. Fluxo completo de seleção e pagamento com cartão salvo (CARD-01, CARD-06)

**Test:** Acesse /client/creditos → escolha combo → toque em "Cartão". Com cartão(s) salvo(s) cadastrado(s): verifique Modo A com lista, radio indicator, pré-seleção do cartão padrão, input CVV e botão "Pagar com este cartão".
**Expected:** CardPaymentScreen exibe Modo A com SavedCardsList; cartão padrão pré-selecionado; input CVV visível; POST /payments/card com savedCardId + securityCode; navegação para sucesso após pagamento aprovado
**Why human:** Integração real com MP Customer API; renderização visual e interação de seleção requerem browser

#### 2. Cadastrar novo cartão com salvar (CARD-02)

**Test:** Na CardPaymentScreen, toque em "Adicionar novo cartão", mantenha checkbox "Salvar para compras futuras" marcado, complete uma compra com cartão de teste do MP Sandbox.
**Expected:** Após pagamento, cartão aparece na lista em compras subsequentes; `mpCardId` salvo no banco; `CustomerCard.create` chamado no MP
**Why human:** Requer credenciais MP Sandbox reais; formulário Brick; verificação de persistência

#### 3. CARD-03 — Visual "Pagar sem salvar" via Brick buttonLabel

**Test:** Com Brick expandido e checkbox "Salvar para compras futuras" desmarcado, observe o botão de submit do Brick.
**Expected:** O botão do Brick exibe "Pagar sem salvar" com visual de menor destaque em relação a "Salvar cartão e pagar"
**Why human:** O Brick do MP controla seu próprio CSS; a diferença de destaque visual não é verificável estaticamente — depende do comportamento de estilização do SDK @mercadopago/sdk-react

#### 4. Gerenciamento completo na SettingsScreen (CARD-05)

**Test:** Acesse /client/perfil → SettingsScreen → seção "Cartões". Verifique: (a) posição correta entre Contato e Condomínio; (b) "Definir como padrão" → toast + badge; (c) "Remover" → dialog com •••• XXXX → confirmar → toast; (d) estado vazio; (e) rodapé só quando 1-2 cartões
**Expected:** Todos os fluxos funcionam conforme descrito no checkpoint humano do 12-03-PLAN.md
**Why human:** Comportamento visual, dialogs e toasts requerem browser + API real

#### 5. Limite de 3 cartões (backend + frontend)

**Test:** Com 3 cartões cadastrados, tente salvar um 4º marcando "Salvar para compras futuras"
**Expected:** Backend retorna 400 e cartão não é salvo; (verificar se frontend oculta opção "Adicionar novo cartão" quando count = 3)
**Why human:** Requer estado real com 3 cartões no MP Customer API

---

### Gaps Summary

**Gap principal:** Dois assertions em `saved-cards.service.test.ts` estão desatualizados após os fixes da code review (CR-03 e WR-04). A implementação foi corretamente atualizada mas os testes não foram ajustados na mesma iteração:

1. **Linha 247** — O teste espera `{ where: { id: 'card-1' } }` para `prisma.savedCard.delete`, mas após o fix WR-04 o repositório usa `{ where: { id, userId } }`. Se este teste rodar com Vitest (que usa `toHaveBeenCalledWith` com matching exato), a assertion falhará porque `userId` está ausente.

2. **Linha 265** — O teste espera `.toThrow('MP API error')` mas após o fix CR-03, `removeCard` captura o Error original e relança um objeto `{ error: '...', status: 502 }`. Um plain object não é uma instância de `Error`, então `.toThrow()` pode não casar corretamente.

**Impacto:** Estes são testes de regressão para comportamento de segurança crítico (IDOR via deleteById com userId, e encapsulamento de erro MP). Se os testes falharem, o CI potencialmente retornaria falso para o coverage de CARD-05. Os PLANs documentam os requisitos de teste corretamente; a implementação está correta; os testes precisam ser atualizados para refletir o estado pós-code-review.

**Nota sobre CARD-05 no REQUIREMENTS.md:** A tabela de traceability mostra `Pending` para CARD-05, mas o código está implementado e o checkpoint humano foi aprovado. Recomenda-se atualizar REQUIREMENTS.md para marcar CARD-05 como `[x]` e alterar o status da tabela para `Complete`.

---

_Verified: 2026-06-19T23:00:00Z_
_Verifier: Claude (gsd-verifier)_
