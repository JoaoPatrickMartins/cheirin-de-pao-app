# Plano — Promoção nos produtos da Cestinha

> ✅ **Status:** **IMPLEMENTADO** em 19/09/2026 (execução direta, sem GSD, autorizada pelo usuário).
> **SEM COMMIT** — aguardando autorização explícita. Branch `feat/add-complementocliente`.
> Verificação: typecheck (shared + api + web) ✅ · builds api e web ✅ ·
> **899 testes do api passando + 3 todo** (+48) · **147 do web passando + 17 todo** (+4).
> Ver §13 para o que divergiu do plano.
> Continuação direta de [plano-pausa-ordenacao-novidade-cestinha.md](./plano-pausa-ordenacao-novidade-cestinha.md),
> que já entregou pausa, corte por horário, ordenação e novidade.

## 1. Objetivo

Permitir ao admin colocar um produto do "Além do Pãozin" **em promoção**, com desconto real em %
ou R$, e decidir **caso a caso** se aquela promoção também ganha destaque na vitrine.

Ordem final da vitrine:

```
Pão Francês  →  Novidades  →  Promoções destacadas  →  resto
                                                       (inclui promoção sem destaque:
                                                        tem o selo, não fura fila)
```

**Invariante de produto:** a promoção é um **preço**, não um enfeite. O cliente sempre vê de onde
veio o desconto (`de R$ 12,00` riscado sobre `R$ 9,84`), e o preço em pãezinhos cai junto.

---

## 2. Contexto — o que já existe

| Peça | Arquivo | O que faz hoje |
|---|---|---|
| Promoção de COMBO | [combo-pricing.ts](../../apps/api/src/lib/combo-pricing.ts) | `effectiveComboPrice(price, promotion)` com `PERCENT`/`FIXED` |
| Enum de desconto | [schema.prisma:67](../../apps/api/prisma/schema.prisma#L67) | `enum DiscountType { PERCENT FIXED }` — já existe, reusável |
| Payload do combo | [credits.service.ts:49](../../apps/api/src/modules/credits/credits.service.ts#L49) | serve `price` já efetivo + `antes` com o original |
| Riscado no front | [ComboCard.tsx:95](../../apps/web/src/components/client/ComboCard.tsx#L95) | `antes > price` → linha riscada acima do preço |
| Disponibilidade | [product-availability.ts](../../apps/api/src/lib/product-availability.ts) | pausa, corte por horário, novidade, `sortNovidadesFirst` |
| Ordem da vitrine | [admin-market.service.ts](../../apps/api/src/modules/admin-market/admin-market.service.ts) | `reorderProducts({ novidades, catalogo })` atômico |
| Tela de ordenar | [MarketProductsReorder.tsx](../../apps/web/src/components/admin/MarketProductsReorder.tsx) | 2 seções arrastáveis (@dnd-kit) |

### Três achados que definem o trabalho

**A1 — o padrão existe inteiro, e é para combo.** Desconto `PERCENT`/`FIXED`, preço efetivo numa
função pura, `antes` no payload, riscado no card. **Espelhar** isso é mais barato e mais seguro do
que inventar vocabulário novo — e deixa as duas promoções do sistema falando a mesma língua.

**A2 — o raio de alcance do preço é de 5 pontos no API e 6 no front.**

| Onde | Arquivo | O que muda |
|---|---|---|
| Catálogo | [market.service.ts:116](../../apps/api/src/modules/market/market.service.ts#L116) | `price` vira o efetivo + `priceBefore` |
| Cestinha | [market.service.ts:198](../../apps/api/src/modules/market/market.service.ts#L198) | `lineTotal` e `price` pelo efetivo |
| Subtotal do checkout | [market-checkout.service.ts:202](../../apps/api/src/modules/market/market-checkout.service.ts#L202) | soma pelo efetivo |
| **Snapshot do pedido** | [market-checkout.service.ts:244](../../apps/api/src/modules/market/market-checkout.service.ts#L244) | `unitPrice` grava o **cobrado**, não o de tabela |
| Margem do admin | [admin-market.service.ts:161](../../apps/api/src/modules/admin-market/admin-market.service.ts#L161) | margem pelo efetivo |

**A3 — o histórico é imune, porque tudo lá é snapshot.** `MarketOrderItem.unitPrice` e
`MarketOrder.totalValue` são gravados na compra, e é deles que os relatórios leem
([admin-reports.service.ts:528](../../apps/api/src/modules/admin-reports/admin-reports.service.ts#L528)).
Uma promoção de hoje **não reescreve a receita de ontem**. Nenhum backfill, nenhuma migração.

### Um efeito colateral que já vem pronto

Como tudo deriva de `price`, ligar a promoção corrige sozinho: o preço em pãezinhos
(`creditsForPrice`), o subtotal, o mínimo da Cestinha e até o gatilho do gancho grátis
(`cestinhaMinValue`). **Nenhuma linha extra** — todos já leem `price`.

### E um que precisa ser consertado

A margem do admin hoje usa o preço cheio. Durante a promoção o admin veria uma margem que não
existe. Corrigir isso abre de graça um aviso que vale dinheiro: **"esta promoção fica abaixo do
custo"**.

---

## 3. Decisões confirmadas

| # | Decisão | Detalhe |
|---|---|---|
| **P-1** | **Promoção é preço, não selo** | Desconto `PERCENT` ou `FIXED`, espelhando o combo. O cliente vê `de/por`. Anunciar promoção sem de/por real é exposição desnecessária no CDC. |
| **P-2** | **Sem agendamento de início** | A promoção vale a partir do momento em que é marcada. `promoFrom` fica como adição futura de um campo só, se aparecer a necessidade. |
| **P-3** | **Campos no `Product`, não model separado** | Consistente com `isNew`/`isPaused`, e sem join no caminho quente (o catálogo carrega em toda abertura da Home). Custo aceito: **sem histórico** de promoções passadas. |
| **P-4** | **Reusa o enum `DiscountType`** | `PERCENT`/`FIXED` já existem no schema para combos. Zero vocabulário novo. |
| **P-5** | **Expira sozinha, padrão 7 dias** | Chips 7/14/30/"até eu remover". Derivado de `now` na leitura, **sem cron** — igual novidade e pausa. Promoção tem fôlego mais curto que lançamento, daí 7 e não 14. |
| **P-6** | **Selo e destaque são coisas separadas** | `isPromo` (+ desconto) = o preço. `promoPriority` = furar fila. Uma promoção pode ter selo **sem** destaque — foi o pedido explícito. |
| **P-7** | **Um selo só por card — novidade ganha** | Produto que é novidade E promoção mostra só `✦ NOVIDADE`; o `de/por` no preço já denuncia a promoção. Evita empilhar pills numa grade de 2 colunas. |
| **P-8** | **O destaque se define arrastando** | A tela Ordenar ganha a seção **Promoções**, entre Novidades e Catálogo. Arrastar para lá dá destaque; arrastar de volta tira o destaque e **mantém** o selo. |
| **P-9** | **A seção Promoções não aceita produto sem desconto** | Durante o arraste de um não-promoção, a seção apaga e explica. Desconto é decisão de preço e mora no formulário. |
| **P-10** | **O ordenar NUNCA toca no desconto** | `reorderProducts` escreve só `isNew`, `promoPriority` e `sortOrder`. `isPromo`/`promoType`/`promoValue`/`promoUntil` são intocáveis ali. |
| **P-11** | **Um único `sortOrder`, três baldes** | Mesma decisão da ordenação atual: sequência contínua `novidades → promoções → catálogo`. Uma promoção que expira mantém o índice e reaparece no topo do catálogo comum. |
| **P-12** | **Preço efetivo nunca chega a zero** | `PERCENT` limitado a 1–90; `FIXED` menor que o preço; efetivo mínimo R$ 0,01. Preço zero quebraria a conta de crédito e liberaria item grátis. |
| **P-13** | **Abaixo do custo avisa, não bloqueia** | Vender no prejuízo pode ser decisão legítima (isca). O sistema precisa dizer, não decidir. |
| **P-14** | **Pão Francês fora** | Preço travado no avulso. Sem promoção, como já é sem novidade e sem pausa. |
| **P-15** | **Promoção e pausa são ortogonais** | Um produto pausado em promoção continua "Esgotado" com o preço promocional exibido. Nenhuma interação nova. |

---

## 4. Regras finais

### 4.1 Preço efetivo

```
promoVigente(p, now) =  p.isPromo === true
                        && p.promoValue > 0
                        && (p.promoUntil == null || p.promoUntil > now)

desconto(preço, tipo, valor) =  tipo === 'PERCENT' ? preço × (1 − valor/100)
                                                   : preço − valor

precoEfetivo(p, now)  =  promoVigente ? max(0.01, round2(desconto(...))) : p.price
precoAntes(p, now)    =  promoVigente && precoEfetivo < p.price ? p.price : null
```

`precoAntes` só existe quando o desconto **de fato** baixa o preço — um desconto de R$ 0 nunca
produz um riscado mentiroso.

A aritmética do desconto passa a viver em `lib/discount.ts`, e
[`effectiveComboPrice`](../../apps/api/src/lib/combo-pricing.ts#L17) passa a chamá-la. É uma troca
de 4 linhas num caminho de pagamento, mas ele está coberto por `combo-pricing.test.ts` — e
duplicar conta de desconto é exatamente o tipo de código que diverge com o tempo.

### 4.2 Ordem da vitrine

```
rank(p, now):
  0  se novidadeVigente(p, now)            // novidade ganha de promoção (P-7)
  1  se promoVigente(p, now) && p.promoPriority
  2  caso contrário

ordem = [ rank asc , sortOrder asc , name asc ]   (sort estável)
```

`sortNovidadesFirst` é substituída por `sortVitrine`, mesma mecânica com três degraus. Continua
sendo em runtime e não no `orderBy` do banco, pelo mesmo motivo de antes: o banco não sabe que um
`newUntil`/`promoUntil` venceu.

### 4.3 O que o cliente recebe

```ts
price:       number         // JÁ efetivo
priceBefore: number | null  // o cheio, só quando a promoção desconta
isNew:       boolean
isPromo:     boolean        // vigente
```

A API descreve a verdade (os dois flags); a regra "novidade ganha" (P-7) é aplicada **no card**,
onde ela é uma decisão de apresentação.

### 4.4 O que o admin recebe

```ts
price:          number          // o CHEIO — é a tela de cadastro
effectivePrice: number          // o que está sendo cobrado agora
isPromoVigente: boolean
promo: { type, value, until, priority }
margin / marginPct              // recalculados sobre effectivePrice
belowCost:      boolean         // effectivePrice < unitCost
```

---

## 5. Modelo de dados

```prisma
model Product {
  // ... campos atuais, incluindo os da onda anterior ...

  // ── Promoção (PREÇO, não enfeite) ──────────────────────────────────────────
  // Espelha a promoção de combo (Promotion + effectiveComboPrice): mesmo enum, mesma conta,
  // mesmo "antes" riscado no card. Derivada de `now` na leitura, sem cron — igual isNew/isPaused.
  // O preço efetivo nunca chega a zero (validado na escrita): zero quebraria a conta de crédito.
  isPromo       Boolean?
  promoType     DiscountType?
  promoValue    Float?
  promoUntil    DateTime?
  // Furar fila é decisão SEPARADA do desconto: dá para ter o selo sem destaque.
  // Escrito só pela tela de ordenar; o desconto, só pelo formulário.
  promoPriority Boolean?
}
```

Todos opcionais → sem migração, sem backfill, **sem índice novo** (mesma decisão da onda anterior:
o catálogo tem dezenas de linhas e há histórico de índice quebrando o `db push`). Só
`prisma generate`.

---

## 6. Backend

### 6.1 `lib/discount.ts` (novo — 10 linhas)

```ts
export function applyDiscount(price: number, type: 'PERCENT' | 'FIXED', value: number): number
```
`combo-pricing.ts` passa a chamá-la. Comportamento idêntico ao de hoje.

### 6.2 `lib/product-pricing.ts` (novo)

```ts
export interface PromoFields { isPromo?, promoType?, promoValue?, promoUntil?, promoPriority? }

export function isPromoVigente(p: PromoFields, now?: Date): boolean
export function effectiveProductPrice(price: number, p: PromoFields, now?: Date): number
export function priceView(price: number, p: PromoFields, now?: Date): { price, priceBefore }
/** Valida um desconto na ESCRITA (P-12). Devolve mensagem pt-BR ou null. */
export function validatePromo(price: number, type, value): string | null
```

### 6.3 `lib/product-availability.ts`

`sortNovidadesFirst` → **`sortVitrine`** com os três degraus (§4.2). A função antiga sai; o único
chamador é o `market.service.ts`.

### 6.4 `packages/shared/src/schemas/market.ts`

```ts
// Create/UpdateProductSchema ganham:
  isPromo:       z.boolean().optional(),
  promoType:     z.enum(['PERCENT', 'FIXED']).nullable().optional(),
  promoValue:    z.number().positive().nullable().optional(),
  promoUntil:    z.string().datetime().nullable().optional(),
// + refine: isPromo true exige promoType e promoValue

// ReorderProductsSchema ganha a terceira lista (default [] para não quebrar aba velha):
  promocoes: z.array(ObjectIdSchema).max(200).default([]),
```

### 6.5 Serviços

| Arquivo | Mudança |
|---|---|
| `market.service.ts` | catálogo e Cestinha servem `price` efetivo + `priceBefore` + `isPromo`; `sortVitrine` |
| `market-checkout.service.ts` | subtotal pelo efetivo; **`unitPrice` grava o efetivo** (o cobrado) |
| `admin-market.service.ts` | `effectivePrice`/`isPromoVigente`/`belowCost`; margem pelo efetivo; `validatePromo` no create/update; `reorderProducts` com 3 listas |

**`reorderProducts` — regras novas:**
- Os três baldes são exclusivos: id repetido entre quaisquer duas listas → 400.
- `novidades[i]` → `{ isNew: true, promoPriority: false, sortOrder: i }`
- `promocoes[i]` → `{ isNew: false, promoPriority: true, sortOrder: n + i }`
- `catalogo[i]` → `{ isNew: false, promoPriority: false, sortOrder: n + m + i }`
- Produto em `promocoes` **sem promoção vigente** → 400 acionável ("Defina o desconto em *Nome*
  antes de destacá-lo"). Backstop: o front já impede o drop.
- `isPromo`/`promoType`/`promoValue`/`promoUntil` **nunca** são escritos aqui (P-10).
- Tudo numa `$transaction` só, como já é.

---

## 7. Frontend admin

### 7.1 Formulário — bloco "Promoção" (abaixo de Novidade)

```
   🏷 Promoção                              [toggle]

      Desconto   [ % ]  [ R$ ]
                 [    18    ]

      R$ 12,00  →  R$ 9,84                    ao vivo
      ⚠ Abaixo do custo (R$ 10,20)            quando aplicável

      Prazo  (•) 7 dias  ( ) 14  ( ) 30  ( ) Até eu remover
      Termina em 26/09/2026

      Para destacar na vitrine, use Ordenar.   ← uma casa por decisão
```

Mesmo tratamento de `novidadeDirty` já usado no bloco de novidade: o prazo só é reenviado quando o
admin mexe nos controles, para que salvar uma edição de nome não reinicie a contagem.

### 7.2 Lista de produtos

- Linha em promoção: `R$ 12,00 → R$ 9,84` (o cheio riscado) e chip `🏷 promo` — ou `🏷 promo ·
  destaque` quando prioritária.
- A margem já exibida passa a ser a do preço efetivo; abaixo do custo vira aviso em
  `var(--color-warn)`.

### 7.3 Tela de ordenar — terceira seção

```
   ✦ NOVIDADES
    ⠿  🥐  Croissant
   ────────────────────────────────
   PROMOÇÕES
    ⠿  🫙  Geleia de Morango    −18%
   ────────────────────────────────
   CATÁLOGO
    ⠿  ☕  Café em grãos   🏷 promo     ← selo, sem destaque
    ⠿  🧈  Manteiga

   ┌──────────────────────────────┐
   │        Salvar ordem          │
   └──────────────────────────────┘
```

**Arrastando um produto SEM promoção**, a seção Promoções esmaece e mostra
*"Defina o desconto no produto primeiro"*. Implementação: o `handleDragOver` recusa mover para
`promocoes` quando o item arrastado não é promoção — uma linha, 100% confiável, sem depender do
`disabled` do droppable do @dnd-kit.

---

## 8. Frontend cliente

| Tela | Mudança |
|---|---|
| [ProdCard](../../apps/web/src/components/client/ProdCard.tsx) | riscado acima do preço; selo `🏷 PROMO` só quando **não** é novidade (P-7) |
| [MarketMiniCard](../../apps/web/src/components/client/MarketMiniCard.tsx) | mesmo par, em escala menor |
| [ProductDetail](../../apps/web/src/pages/client/ProductDetail.tsx) | riscado no bloco de preço; selo no herói |
| [CestinhaScreen](../../apps/web/src/pages/client/CestinhaScreen.tsx) | `de R$ 12,00` pequeno acima do `R$ 9,84 · un` |
| [MarketCheckoutScreen](../../apps/web/src/pages/client/MarketCheckoutScreen.tsx) | nada — já usa `line.price`, que chega efetivo |

O riscado reusa exatamente o tratamento do [ComboCard.tsx:95](../../apps/web/src/components/client/ComboCard.tsx#L95)
(12px, `--color-text-ter`, `line-through`), para as duas promoções do app lerem igual.

**Selo `🏷 PROMO`:** mesmo par espresso/ouro do `✦ NOVIDADE`, mesmo canto superior esquerdo — os
dois nunca aparecem juntos, então dividem o lugar sem conflito.

---

## 9. Ondas

| Onda | Escopo | Verificação |
|---|---|---|
| **A** | schema · `lib/discount.ts` + `combo-pricing` chamando ela · `lib/product-pricing.ts` · `sortVitrine` · schemas Zod · testes | typecheck 3 pacotes + testes das libs |
| **B** | leitura: catálogo e Cestinha com preço efetivo, `priceBefore`, `isPromo`, nova ordem | testes de catálogo/cestinha com relógio fixo |
| **C** | escrita: subtotal e **snapshot** do checkout · admin (`effectivePrice`, `belowCost`, `validatePromo`) · reorder com 3 listas | testes de checkout e do módulo admin |
| **D** | admin UI: bloco Promoção no form · de/por e aviso na lista · terceira seção no ordenar | UAT |
| **E** | cliente UI: riscado nas 4 telas · selo PROMO | testes do web + UAT |

A → B → C sequenciais. D e E em paralelo depois de C.

---

## 10. Testes

| Caso | Esperado |
|---|---|
| `PERCENT 18` sobre R$ 12,00 | R$ 9,84 |
| `FIXED 3` sobre R$ 12,00 | R$ 9,00 |
| `promoUntil` vencido | preço cheio, `priceBefore: null`, sem selo |
| `isPromo` desligado com valor gravado | preço cheio |
| desconto que zeraria o preço | recusado na escrita (P-12) |
| `PERCENT 91` / `FIXED >= price` | recusado na escrita |
| desconto que não baixa nada | `priceBefore: null` (sem riscado mentiroso) |
| novidade **e** promoção prioritária | ordena como novidade (rank 0) e mostra só `✦ NOVIDADE` |
| promoção sem `promoPriority` | selo sim, fila não |
| carrinho de produto em promoção | `lineTotal` com desconto; mínimo avaliado sobre o descontado |
| **checkout de produto em promoção** | `totalValue` e `unitPrice` gravam o **cobrado** |
| promoção vence entre carrinho e checkout | checkout recalcula no cheio (a autoridade é ele) |
| margem do admin em promoção | calculada sobre o efetivo |
| efetivo < custo | `belowCost: true`, sem bloquear (P-13) |
| reorder com não-promoção em `promocoes` | 400 acionável |
| reorder | não altera `isPromo`/`promoValue`/`promoUntil` |
| Pão Francês em qualquer lista/promoção | ignorado |

---

## 11. Riscos

| # | Risco | Mitigação |
|---|---|---|
| **R1** | Preço efetivo zero quebraria crédito, mínimo e liberaria item grátis | Validação na escrita (P-12) + piso de R$ 0,01 no cálculo |
| **R2** | `unitPrice` gravar o preço de tabela em vez do cobrado | É o ponto mais importante da Onda C; tem teste próprio. Erraria estorno e receita. |
| **R3** | Promoção vence entre montar o carrinho e finalizar | O checkout recalcula e é a autoridade; o cliente vê o total correto na tela de pagamento. Comportamento honesto, documentado. |
| **R4** | Refactor de `effectiveComboPrice` toca caminho de pagamento | Troca de 4 linhas, coberta por `combo-pricing.test.ts`; o comportamento não muda |
| **R5** | Promoção abaixo do custo passar despercebida | `belowCost` no payload + aviso no form e na lista (P-13) |
| **R6** | Sem histórico de promoções (P-3) | Aceito. O snapshot do pedido preserva o que foi cobrado, que é o que importa para auditoria e receita. |

---

## 12. O que divergiu do plano

| # | Divergência | Por quê |
|---|---|---|
| **W-1** | **`priceBefore` também em `CartLine`** | O plano só previa no catálogo. Sem ele, a linha da Cestinha mostraria o preço com desconto sem dizer de onde veio — a economia sumia justamente na tela em que o cliente decide pagar. |
| **W-2** | **`resolvePromo` valida contra o preço RESULTANTE** | Num PATCH que muda o preço E mexe na promoção, validar contra o preço antigo deixaria passar um desconto que zera o novo (baixar de R$ 10 para R$ 2 mantendo R$ 3 de desconto). |
| **W-3** | **`promoDirty` no formulário** | Mesmo motivo do `novidadeDirty` da onda anterior: salvar uma edição de nome reiniciaria a contagem da promoção. O prazo só é reenviado quando o admin mexe nos controles. |
| **W-4** | **A seção Promoções também recusa promoção VENCIDA** | O plano falava em "sem promoção". Uma flag `promoPriority` sobrando de uma promoção que expirou faria o produto nascer na seção errada ao abrir a tela de ordenar. |
| **W-5** | **Chip de desconto nas linhas da tela de ordenar** | Não estava no plano. Sem ele, uma promoção SEM destaque aparece no Catálogo sem nenhuma pista de que é promoção — e o admin não entenderia por que ela não está na seção de promoções. |
| **W-6** | **`PromoWrite` como tipo plano** | Os inputs do Prisma aceitam envelopes (`{ set: … }`) que não servem no caminho de `create`; um objeto só precisava atender a `create` e `update`. |
| **W-7** | **O `blocked` do droppable usa `disabled` + guarda no `onDragOver`** | O plano previa só a guarda. Os dois juntos fazem a seção **parecer** fechada (esmaecida, sem realce de drop) além de recusar — em vez de aceitar visualmente e depois desfazer. |

## 13. Processo

Mesma situação da onda anterior: os comandos GSD não estão disponíveis nesta sessão, e o usuário
autorizou explicitamente a execução direta.

E, como sempre: **nenhum commit ou push sem autorização explícita no momento.**

## 14. Para validar no app (UAT)

1. **Gestão › Além do Pãozin › Produtos** — abrir um produto, ligar **🏷 Promoção**, escolher
   `%` e `18`. A prévia deve mostrar `R$ 12,00 → R$ 9,84` ao vivo. Salvar.
2. Na lista, a linha mostra o preço cheio riscado, o novo em destaque e o chip `🏷 PROMO`.
3. No app do cliente, o card mostra o riscado, o selo `🏷 PROMO` e — a prova de que o desconto é
   real — o **`🥖 N pãezins` cai junto** (de 10 para 8,2 com avulso R$ 1,20).
4. Marcar o MESMO produto também como novidade: o selo passa a ser `✦ NOVIDADE` e o de promoção
   some, mas o de/por continua.
5. **Ordenar** → arrastar a promoção para a seção **🏷 Promoções**. Ela sobe na vitrine, mas
   **atrás** das novidades. Arrastar um produto sem desconto para lá: a seção esmaece e avisa.
6. Arrastar a promoção de volta para o Catálogo: perde o destaque, **mantém** o selo e o preço.
7. Com um custo cadastrado maior que o preço promocional, o formulário avisa
   **"⚠ Abaixo do custo"** — e deixa salvar assim mesmo.
