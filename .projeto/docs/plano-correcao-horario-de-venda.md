# Plano — Correção: o horário do produto vira HORÁRIO DE VENDA

> ✅ **Status:** **IMPLEMENTADO** em 19/09/2026 (execução direta, sem GSD, autorizada pelo usuário).
> **SEM COMMIT** — aguardando autorização explícita. Branch `feat/add-complementocliente`.
> Verificação: typecheck (shared + api + web) ✅ · builds api e web ✅ ·
> **902 testes do api passando + 3 todo** · **148 do web passando + 17 todo**.
> Ver §10 para o que divergiu do plano.
> Corrige a decisão **D-3** de [plano-pausa-ordenacao-novidade-cestinha.md](./plano-pausa-ordenacao-novidade-cestinha.md)
> depois do UAT: o corte por ciclo de entrega não entrega o que o controle aparenta fazer.
> Decisões fechadas com o usuário em 19/09/2026.

## 1. O que está errado

O admin configura `às 20:00` esperando "fecha às 20:00". O que acontece de verdade depende de
quantos turnos estão ativos no condomínio:

**Manhã + tarde ativos** (padrão da operação):

| Hora | Ciclo de referência | Produto |
|---|---|---|
| 18:00 | 06:30 de 21/09 | disponível |
| **20:00** | 06:30 de 21/09 | **ESGOTADO** |
| 22:00 | 15:30 de 21/09 | ESGOTADO |
| 06:00 | 15:30 de 20/09 | ESGOTADO |
| **10:00** | 06:30 de 21/09 | **disponível** ← reabre num horário que ninguém configurou |

**Só o turno da manhã ativo:**

| Hora | Produto |
|---|---|
| 19:59 | disponível |
| **20:00** | **ESGOTADO** |
| 21:59 | ESGOTADO |
| **22:00** | **disponível** ← fica esgotado só 2 horas |

**Sem turno ativo:** o horário do produto **nunca bloqueia nada**, em silêncio.

### Causa raiz

`availableUntil` virou o **corte do pedido para a próxima entrega**, não o fechamento da venda.
Quando o ciclo de entrega avança, o produto reabre — e a hora em que ele reabre não é a que o
admin digitou: é derivada do `cutoffTime` do turno (10:00 da tarde ou 22:00 da manhã).

O sistema usa um número diferente do que foi configurado. E a microcópia do formulário
(*"Ele volta sozinho quando o ciclo vira"*) é verdadeira e inútil: não há como o admin saber
quando isso é.

Isto é consequência direta da semântica escolhida na primeira rodada (corte por ciclo em vez de
vitrine). Ela modela bem o corte do fornecedor; não modela "fechei a venda deste item".

---

## 2. Decisões confirmadas

| # | Decisão | Detalhe |
|---|---|---|
| **C-1** | **O horário vira RELÓGIO DE LOJA** | Absoluto: dentro da janela o produto vende, fora dela fica "Esgotado" — para qualquer data de entrega. Abre e fecha nos horários digitados e em nenhum outro. |
| **C-2** | **A janela PODE cruzar a meia-noite** | "Fecha às 20:00, reabre às 22:00" = fechado só nessas 2 horas. Era proibido antes (a resolução por dia de ciclo exigia a janela num dia só); com relógio puro, a restrição perde razão de existir. |
| **C-3** | **A UI passa a falar "fecha/reabre"** | `das … às …` fica ambíguo quando a janela vira o dia. `Fecha às [20:00] · Reabre às [22:00]` é como o admin descreve, e serve aos dois casos. |
| **C-4** | **Os campos NÃO são renomeados** | `availableUntil` = fecha; `availableFrom` = reabre. Já era o significado literal dos nomes. Zero migração, e o `20:00` já gravado passa a significar exatamente o que o admin esperava. |
| **C-5** | **Cliente não muda nada** | Segue vendo só "Esgotado". O conserto é todo no backend + formulário do admin. |
| **C-6** | **Os dias continuam sendo DIA DE ENTREGA** | `availableDays` segue validado contra a data de entrega no checkout. Só muda a apresentação: dois blocos com nomes próprios, para parar de parecer a mesma regra. |
| **C-7** | **`referenceCycle` é removido** | Com o horário em relógio, nada mais precisa dele. Some junto o buraco do "sem turno ativo". |
| **C-8** | **Pausa manual não muda** | `isPaused`/`pausedUntil` continuam como estão. Os dois mecanismos seguem compondo por OR. |

---

## 3. A regra nova

Comparação de `"HH:MM"` (lexicográfica = cronológica, mesma convenção de `lib/cutoff.ts`), contra
`nowHHMM()` em BRT.

```
abertoAgora(p, now):
  f = p.availableFrom   (reabre)
  u = p.availableUntil  (fecha)
  h = nowHHMM(now)

  !f && !u   →  sempre aberto
   f && !u   →  h >= f                    (fechado da meia-noite até f)
  !f &&  u   →  h <  u                    (fechado de u até a meia-noite)
   f <   u   →  h >= f && h < u           (janela normal)
   f >   u   →  h >= f || h < u           (CRUZA a meia-noite — fechado de u até f)
   f ===  u  →  inválido, recusado na escrita
```

**Conferindo os dois casos do usuário:**

| Config | `from` | `until` | Fechado | Aberto |
|---|---|---|---|---|
| Fecha 20h, reabre 22h | `22:00` | `20:00` | 20:00–22:00 | resto do dia |
| Fecha 20h, reabre 6h | `06:00` | `20:00` | 20:00–06:00 | 06:00–20:00 |
| Só "fecha 20h" | — | `20:00` | 20:00–00:00 | 00:00–20:00 |
| Só "reabre 6h" | `06:00` | — | 00:00–06:00 | 06:00–00:00 |

**Hora da volta (só o admin vê):** a próxima ocorrência de `from` no relógio — hoje se ainda não
passou, senão amanhã. Sem `from`, a próxima meia-noite.

---

## 4. O que muda no código

### 4.1 `lib/product-availability.ts`

| Sai | Entra |
|---|---|
| `orderWindowBlock(p, slot, dateStr, now)` | `storeHoursBlock(p, now)` — sem turno, sem data |
| `effectiveCutoffInstant`, `windowOpenInstant` | — (eram a conta do ciclo) |
| `instantAt`, `addDaysStr`, `deliveryInstant` | — (helpers só do ciclo) |
| `referenceCycle`, `ReferenceCycle`, `CycleSlot` | — (C-7) |
| `acceptsOrder(p, slot, dateStr, now)` | `acceptsOrder(p, now)` |
| `isUnavailableForClient(p, {outOfStock, cycle}, now)` | `isUnavailableForClient(p, {outOfStock}, now)` |
| `availabilityOf(p, {isActive, outOfStock, cycle}, now)` | `availabilityOf(p, {isActive, outOfStock}, now)` |
| — | `nextOpening(p, now): Date \| null` — a hora da volta |

`vitrinePause`, `isNovidadeVigente`, `vitrineRank`, `sortVitrine` ficam intactos.

### 4.2 Serviços

| Arquivo | Mudança |
|---|---|
| `market.service.ts` | some o `referenceCycle` do catálogo e da Cestinha; some a chamada `getUserCondoId` |
| `market-checkout.service.ts` | passo 7.1 vira `acceptsOrder(product, now)` |
| `admin-market.service.ts` | `withAvailability` sem ciclo; revalidação da janela aceita cruzar meia-noite, recusa `from === until` |
| `market.repository.ts` | `getUserCondoId` deixa de ser usado — remover |

**Ganho de lado:** o catálogo para de fazer 3 queries por carga (`getUserCondoId` + as 2 de
`getCondoDeliverySlots`), e ele é carregado em toda abertura da Home, do bloco "Além do Pãozin" e
da faixa de add-on. A Cestinha idem.

### 4.3 `packages/shared`

- Remover o refine `availableFrom < availableUntil` (C-2 torna a janela cruzada legal).
- Adicionar refine `availableFrom !== availableUntil`.

### 4.4 Formulário do admin

Dois blocos, com nomes próprios (C-6):

```
   Dias de ENTREGA
   [ Sempre ]  [ Dias da semana ]
       [Seg][Ter][Qua][Qui][Sex][Sáb][Dom]
   Em que dias este produto pode chegar na casa do cliente.

   ───────────────────────────────────────────────

   Horário de VENDA
   [ Sempre aberto ]  [ Fecha e reabre ]
       Fecha às  [20:00]     Reabre às  [22:00]

   Fechado das 20:00 às 22:00 · aberto o resto do dia
   Nesse intervalo o cliente vê "Esgotado". Volta sozinho às 22:00.
```

Prévia ao vivo conforme o preenchimento:
- os dois → *"Fechado das 20:00 às 22:00 · aberto o resto do dia"*
- só fecha → *"Fechado das 20:00 à meia-noite"*
- só reabre → *"Fechado da meia-noite às 06:00"*

Validação: com "Fecha e reabre" ligado, pelo menos um campo preenchido; os dois preenchidos não
podem ser iguais.

### 4.5 Lista do admin

`windowLabel` passa a dizer `fecha 20:00 · reabre 22:00` (hoje diz `22:00–20:00`, que com a janela
cruzada leria ao contrário). A pill de estado segue igual: `⏸ Pausado · volta 22:00`.

### 4.6 Cliente

**Nada.** (C-5)

---

## 5. Ondas

| Onda | Escopo | Verificação |
|---|---|---|
| **A** | `lib/product-availability.ts`: `storeHoursBlock`, `nextOpening`, remoção do ciclo · schemas Zod · testes reescritos | typecheck + testes da lib |
| **B** | serviços: catálogo, Cestinha, checkout, admin · remoção do `getUserCondoId` | testes de leitura e checkout |
| **C** | formulário (dois blocos + prévia) · `windowLabel` na lista | UAT |

---

## 6. Testes

| Caso | Esperado |
|---|---|
| fecha 20:00 / reabre 22:00, às 19:59 | aberto |
| mesmo, às 20:00 | **fechado** |
| mesmo, às 21:59 | fechado |
| mesmo, às 22:00 | aberto |
| mesmo, às 23:00 e às 06:00 | aberto (é o caso que hoje falha) |
| fecha 20:00 / reabre 06:00, às 23:00 | fechado |
| só fecha 20:00, às 23:00 | fechado |
| só fecha 20:00, às 00:00 | aberto |
| só reabre 06:00, às 05:59 / 06:00 | fechado / aberto |
| sem horário nenhum | sempre aberto |
| `from === until` | recusado na escrita |
| hora da volta com `from` | próxima ocorrência de `from` |
| hora da volta sem `from` | próxima meia-noite |
| pausa manual dentro do horário aberto | fechado (OR, C-8) |
| pausa temporária expirada, fora do horário | segue fechado, motivo `horario` |
| checkout fora do horário | 409 "está esgotado" |
| condomínio sem turno ativo | **irrelevante** — o horário não depende mais de turno |

---

## 7. Riscos

| # | Risco | Mitigação |
|---|---|---|
| **R1** | A semântica de dados já gravados muda | É a correção pedida: `até 20:00` passa a significar o que o admin esperava. Nenhum produto fica mais permissivo do que está hoje — só mais restritivo e previsível. |
| **R2** | Remover `referenceCycle` apaga código testado | É código morto depois da mudança; fica no histórico do git. Manter função testada e sem chamador é passivo. |
| **R3** | Janela cruzada confunde na leitura | Por isso a UI fala "fecha/reabre" (C-3) e mostra a frase pronta ("Fechado das 20:00 às 22:00"). |
| **R4** | Produto fica fechado sem ninguém perceber | A lista do admin já marca com trilho dourado e pill `⏸ Pausado · volta 22:00`. |

---

## 8. O que divergiu do plano

| # | Divergência | Por quê |
|---|---|---|
| **X-1** | **`getCatalog()` perdeu o parâmetro `userId`** | O plano só previa remover a query. Sem o ciclo, o catálogo é idêntico para todo cliente — manter um parâmetro não usado seria fumaça. O controller e a rota seguem autenticados por política. |
| **X-2** | **A validação passou a recusar `fecha === reabre`** | O plano dizia só "remover o refine". Sem nada no lugar, fechar e reabrir na mesma hora gravaria uma janela de duração zero (ou 24h) — ambíguo, e não há resposta certa para escolher em silêncio. |
| **X-3** | **`storeHoursSummary` no front** | Não estava no plano. `windowLabel` serve à lista (curto); o formulário precisava da frase pronta ("Fechado das 20:00 às 22:00") — é a **consequência** que o admin quer conferir, não a regra. |
| **X-4** | **Microcópia "chegar" × "comprar" nos dois blocos** | O plano previa só separar os blocos. O que resolve a confusão de verdade é a frase sob cada um dizendo o verbo. |

## 9. Processo

GSD indisponível nesta sessão; execução direta depende de autorização explícita.
**Nenhum commit ou push sem autorização explícita no momento.**

## 10. Para validar (UAT)

1. Produto com **Fecha às 20:00 · Reabre às 22:00**. Antes das 20h: disponível no app.
2. Às 20:01: **Esgotado** no cliente; `⏸ Pausado · volta 22:00` no admin.
3. Às 22:01: disponível de novo — **sem ninguém tocar em nada**.
4. Produto com **Fecha às 20:00** e reabre vazio: esgotado das 20h até a meia-noite.
5. Desativar todos os turnos do condomínio: o horário do produto **continua funcionando**
   (é o caso que hoje falha silenciosamente).
