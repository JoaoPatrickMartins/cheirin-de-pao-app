# Feature: "Além do Pãozin" — Mini market de produtos de café da manhã

> **Status:** Requisitos **100% FECHADOS** + handoff entregue + pendências resolvidas (23/07/2026). Em elaboração: **plano de implementação** (`docs/plano-alem-do-paozin.md`).
> **Documentos irmãos:** [`brief-telas-alem-do-paozin.md`](./brief-telas-alem-do-paozin.md) (brief para o Claude Design) · [`handoff-alem-do-paozin.md`](./handoff-alem-do-paozin.md) (handoff dos designs).

---

## 1. Visão geral

Adicionar ao app uma **loja de outros produtos de café da manhã** ("Além do Pãozin") além do pão francês — pães doces, bolos, geleias, pão de queijo, queijo, presunto, mortadela etc. O cliente monta uma **Cestinha** (carrinho) com produtos (e opcionalmente pães) e recebe **junto com a entrega da manhã**, na mesma logística que já existe.

**Princípio inegociável:** o **pão francês continua sendo o principal** do app (combos, pedido avulso, agenda semanal). O mini market **complementa** e não pode competir nem atrapalhar o fluxo central. Ele ganha destaque próprio, mas o core do pão permanece **intocado**.

## 2. Nomenclatura (definida)

| Conceito | Nome |
|---|---|
| A loja / área | **Além do Pãozin** |
| O carrinho de compras | **Cestinha** |
| Unidade de crédito | **pãozinho** (1 crédito = 1 pão) — já existente |

## 3. Contexto técnico atual (o que já existe e baliza tudo)

Levantado do código antes de fechar o escopo:

- **Crédito = contagem de pães (`Int`)**, não dinheiro. `User.creditBalance` + ledger `CreditTransaction` (tipos: PURCHASE, DELIVERY, REFUND, EXPIRY, ADMIN_GRANT, ADMIN_DEBIT). Não existe carteira em R$.
- **Preço do pão avulso** vem do `Setting` `avulsoUnit` (hoje configurado ~**R$ 1,20**). Combo mais barato por pão (a "economia").
- **Não existe** conceito de produto/catálogo/estoque — o domínio é 100% pão. Tudo do mini market é **greenfield**.
- **Não existe** infra de imagem/upload (sem S3, sem multipart, sem campo de foto). Foto de produto = construir do zero.
- **Pedido (`Order`)** é centrado em `quantity` de pães, consome crédito em transação atômica, é materializado **no corte do slot** (cron a cada minuto) e roteado por entregador via `DeliveryList`.
- **Pagamento:** Pix via **Mercado Pago** + cartão via **Stripe**, com fulfillment idempotente (`creditForPayment`) e enum `PaymentPurpose` (hoje CREDITS, HOOK).
- **Cancelamento de avulso** já usa a lógica de corte (`isPastCutoffForDelivery`) e estorna em crédito (`REFUND`).

## 4. Decisões travadas

### 4.1 Posicionamento no app
- **DEC-01** — Aba própria "Além do Pãozin" na tab bar do cliente (hoje são 5 abas → passa a 6).
- **DEC-02** — Bloco fixo "Além do Pãozin" na Home como destaque/porta de entrada.
- **DEC-03** — Na tela de **pedido avulso de pão**, um passo/atalho "adicione algo do Além do Pãozin" que leva o cliente à Cestinha (carregando os pães já selecionados).

### 4.2 Produto (modelo)
- **DEC-04** — Produto vendido **sempre como item/pacote fixo** (ex.: "Presunto 200g" é um SKU). **Sem venda por peso** no v1.
- **DEC-05** — Campos do produto: nome, descrição (opcional), categoria, preço (R$), **foto** (obrigatória do ponto de vista de UX; com fallback de ícone/imagem padrão por categoria quando ausente), tipo de estoque + quantidade, disponibilidade, ativo/inativo.
- **DEC-06** — **Foto é essencial** → construir **upload + storage em S3** (o usuário já tem conta AWS e criará um bucket para o projeto). Guardar a URL no banco.
- **DEC-07** — **Categorias gerenciáveis**: semear 6 padrão (Pães doces, Bolos, Frios, Laticínios, Geleias/Doces, Salgados) e permitir ao admin **criar/editar/excluir** categorias.

### 4.3 Estoque
- **DEC-08** — Dois tipos de estoque:
  - **Diário (reseta):** capacidade que zera e recomeça a cada dia (ex.: "10 bolos por dia"), análogo à produção do pão.
  - **Fixo (inventário):** contagem absoluta que só cai até ser reposta (ex.: geleia, queijo).
- **DEC-09** — Estoque é **global** (não por condomínio) no v1.
- **DEC-10** — **Reposição manual** pelo admin (ajusta a contagem). Sem procurement automático de fornecedor no v1.
- **DEC-11** — Reserva de estoque **no checkout** (débito atômico, evita vender o último item duas vezes); **devolve** o estoque em cancelamento ou falha de pagamento.
- **DEC-12** — Produto **esgotado** aparece na loja marcado "Esgotado" (visível, não adicionável). Admin pode **desativar** para ocultar de vez.
- **DEC-13** — **Alerta de baixo estoque** para o admin.
- **DEC-14** — Disponibilidade: produto pode ser "sempre disponível" ou restrito a **dias da semana** específicos (campo opcional; padrão = sempre).

### 4.4 Economia: crédito × dinheiro (o motor da feature)
- **DEC-15** — O market aceita **dinheiro E crédito** (as duas formas).
- **DEC-16** — **Valor de resgate do crédito no market = preço do pão avulso** (`Setting avulsoUnit`, hoje R$ 1,20). Ou seja: **1 pãozinho = R$ 1,20 de poder de compra** no Além do Pãozin.
- **DEC-17** — O **desconto** ao pagar com saldo **acontece de forma implícita**: como o cliente comprou os créditos mais baratos no combo, gastá-los a valor de face (avulso) rende a economia do combo. **Não se rastreia de qual combo veio cada crédito** (o saldo é único e fungível).
  - **Exemplo (geleia R$ 12,00):** só dinheiro = R$ 12,00. Com saldo = 12,00 ÷ 1,20 = **10 pãozinhos**. Se vieram do combo 3 (custaram R$ 1,00 cada), o cliente pagou R$ 10,00 por R$ 12,00 de produto = **~16% de economia**. Combo 2 → ~8%. Combo 1 → ~4%.
- **DEC-18** — **Badge/indicativo** no produto: **"Pague com pãezinhos: até X% de economia"**, onde **X = o maior desconto entre os combos ativos** (hoje ~16%, do combo 3). Calculado dinamicamente: `X = max_combos( (avulsoUnit − comboPreço/comboQtd) / avulsoUnit )`.
- **DEC-19** — **Helper de precificação no cadastro do admin:** ao digitar o preço (R$), o formulário mostra em tempo real o **equivalente em pãezinhos** (`preço ÷ avulsoUnit`) e o **custo efetivo via combos** (faixa: "com saldo, o cliente gasta o equivalente a R$ 10,00 [combo 3] a R$ 11,50 [combo 1]"). Deixa a precificação tangível na hora do cadastro.

### 4.5 Pagamento misto (obrigatório no v1)
- **DEC-20** — **Pagamento misto** é obrigatório no v1: parte em crédito (pãezinhos) + parte em dinheiro (Pix/cartão) no mesmo pedido.
- **DEC-21** — **Split na tela:** o cliente escolhe **quantos pãezinhos aplicar** (controle tipo stepper), com **padrão = o máximo** que ele tem/que cobre o carrinho; o app mostra ao vivo o **valor restante em dinheiro**.
  - Fórmula: máx. de pãezinhos aplicáveis = `floor(valorCestinha_R$ / avulsoUnit)`; padrão aplicado = `min(saldo, floor(valorCestinha / avulsoUnit))`; dinheiro = `valorCestinha − (pãezinhosAplicados × avulsoUnit)`.
  - O "resto quebrado" (fração de crédito) cai naturalmente no dinheiro.
  - Se o crédito cobre 100% e sobra R$ 0,00 → pedido só em crédito, sem cobrança no gateway.
- **DEC-22** — Reaproveitar o gateway existente para a parte em dinheiro: **Pix (Mercado Pago) + cartão (Stripe)**. Criar um novo `PaymentPurpose = MARKET` (não credita pão; confirma o pedido do market e efetiva a reserva de estoque).

### 4.6 Guarda-corpo de saldo (proteção do café da manhã)
- **DEC-23** — **Sem trava dura** — o crédito é do cliente, ele decide como gastar.
- **DEC-24** — **Apenas aviso suave (não bloqueante)** no checkout quando aplicar o crédito deixaria o saldo abaixo do que a **agenda semanal ativa** do cliente vai consumir nos próximos dias: *"Isso vai deixar seu saldo abaixo do que sua agenda desta semana precisa (X pães). Continuar?"* (usa a projeção de agenda — `schedule-projection.ts`).
- **DEC-25** — Comprar no market **não dispara auto-recarga**. A lógica de corte existente continua cuidando do pão (auto-recarga só no cenário de entrega de pão sem saldo, como já é hoje).

### 4.7 Mínimo & frete
- **DEC-26** — **Sem frete** (o market pega carona na entrega da manhã).
- **DEC-27** — **Mínimo de R$ X** (novo `Setting`, ex. `marketMinimoCestinha`, valor configurável pelo admin) sobre o **valor em R$ da Cestinha inteira** (pães valorados a `avulsoUnit` + produtos ao preço). O mínimo é medido em **dinheiro**, independentemente da forma de pagamento, e **aplica-se sempre** — inclusive quando o cliente já tem pão agendado/pedido naquele dia.

### 4.8 Entrega / logística
- **DEC-28** — Produtos do market **pegam carona na entrega da manhã**: mesmo **condomínio + data + slot + entregador** do pão; entram na `DeliveryList` junto dos pães.
- **DEC-29** — Respeita o **corte do slot** (pedir para amanhã de manhã exige estar antes do corte de hoje) — reaproveita `isPastCutoffForDelivery`.
- **DEC-30** — Pedido de market **num dia sem pão agendado** para aquele cliente: ainda assim entra no slot de entrega do condomínio (o entregador já vai lá para outros).
- **DEC-31** — Telas de **separação (admin)** e **entrega (entregador)** passam a mostrar os itens do market junto dos pães.

### 4.9 Pedido / carrinho
- **DEC-32** — **Cestinha unificada** no cliente: pode conter **pães + produtos**. No **backend**, o pedido do market é uma entidade **separada** (`MarketOrder`) que **compartilha os trilhos de entrega** do pão — o `Order` de pão **não é refatorado**.
- **DEC-33** — Regra de fluxo: pedido **só de pão** continua na tela de pedido avulso existente (core intocado). Qualquer Cestinha que contenha **≥ 1 produto do market** passa pelo **checkout da Cestinha** (com as regras do market). Pães dentro da Cestinha são valorados a `avulsoUnit` e consomem 1 crédito cada (idêntico ao avulso — sem mudar a economia do pão).
- **DEC-34** — **v1 = só avulso** (pedido pontual para um dia). Produtos do market na **agenda recorrente** ficam para o **v2**.

### 4.10 Cancelamento / estorno
- **DEC-35** — Cancelar o pedido do market **só antes do corte do slot**; depois do corte (já foi para separação), **não é possível**.
- **DEC-36** — No cancelamento, **tudo volta como crédito (pãezinhos)** — inclusive a parte paga em dinheiro, convertida a `avulsoUnit` (R$ 1,20) por crédito. **Sem estorno no cartão/Pix** (mantém a operação simples e o dinheiro no ecossistema).
  - *Ponto de arredondamento (a decidir no plano):* a parte em dinheiro nem sempre divide em crédito inteiro. Recomendação: arredondar **a favor do cliente** (`ceil`).
- **DEC-37** — O **estoque volta** (devolução) no cancelamento.

## 4-bis. Atualizações pós-handoff (23/07/2026)

Handoff do Claude Design entregue ([`handoff-alem-do-paozin.md`](./handoff-alem-do-paozin.md)) — cobre **apenas as adições**; o que já existe fica como está. Ao integrar o design surgiram estes ajustes/decisões, anotados sobre as DEC originais:

> **Princípio (instrução do usuário, 23/07):** layout e dados do mockup são **placeholders**. Manter o app real **exatamente como está**, **adicionar só o que é novo**, **modificar só o necessário**. Não tratar como literais: números mock (ex.: 37%), rótulos renomeados, nem elementos "removidos" no protótipo.

- **DEC-38 (novo) / MKT-33 — Confirmação antes do pagamento = SHEET (opção B, escolhida).** Ao tocar "Confirmar" no checkout, sobe um **sheet de confirmação** sobre a tela (checkout escurecido atrás): resumo condensado — 2 itens + quando chega, split pãezinhos/dinheiro, **Total a pagar** — com CTA "Confirmar e pagar · R$ X" e link "Revisar itens". Só o CTA do sheet dispara a cobrança → sucesso. Referência visual: [artifact](https://claude.ai/code/artifact/ebc3e380-254e-45b6-8e71-33cfa053a909).

- **DEC-01 (resolvida) — Manter a tab bar existente e só adicionar a aba nova.** ✅ **Perfil NÃO sai** — a tab bar atual (`Início · Agenda · Pães · Pedidos · Perfil`) fica **exatamente como está** (sem renomear "Pães"). A **Cestinha** entra como **aba nova** (Q14 = aba própria) → passa a **6 abas**. *Obs.: 6 itens ficam apertados em 390px — tratar densidade no design/impl (rótulos/ícones), sem remover nada existente.* O protótipo com 5 abas / Perfil fora é mock.

- **DEC-07 (revisada) — Categorias padrão** passam a ser as do handoff: **Geleias & Mel · Bolos & Doces · Pão de Queijo & Salgados · Bebidas · Frios & Frescos · Especiais** (seguem gerenciáveis pelo admin).

- **DEC-18 (resolvida) — Selo de desconto sempre com o valor REAL e dinâmico.** ✅ O "37%" do protótipo é **mock**. No app o selo usa `economiaCredito(pricing, combos)` → **hoje ~16–17%** (combo de 60 pães a R$ 59,99 vs. avulso R$ 1,20). Nunca hard-codar o número do mockup.

- **DEC-27 (nota) — Mínimo da Cestinha:** default do protótipo = **R$ 15,00** (`MARKET_CFG.minimo`), configurável pelo admin.

- **DEC-39 (resolvida) / MKT-34 — Carrinho persistente entre sessões já no v1.** ✅ Cestinha salva **por usuário no backend**, persistente entre sessões e dispositivos.

- **Novos elementos de UI** (detalhados no handoff): `FloatingCart` (botão flutuante da cestinha), painel de **dois preços** ("À vista" × "Com pãezinhos"), banner **"Duas formas de pagar"**, rótulo **"à vista"**, ícone **basket** como identidade da área.

## 5. Escopo

### v1 (esta entrega)
Tudo do item 4, incluindo **pagamento misto** (obrigatório por decisão do usuário) e **foto via S3**.

### v2 (backlog — fora desta entrega)
- Fidelidade/cashback: **ganhar crédito** comprando no market.
- Produtos do market na **agenda recorrente**.
- **Venda por peso** (preço variável por grama).
- **Estoque por condomínio**.
- **Procurement automático** de fornecedor para os produtos do market.

## 6. Modelo de dados novo (proposto — a detalhar no plano)

> Prisma + MongoDB. Confirmar reuso de tipos de `packages/shared` antes de duplicar.

- **`Product`** — `name`, `description?`, `categoryId`, `price Float` (R$), `photoUrl?`, `stockType` (`DAILY` | `FIXED`), `stock Int?` (para FIXED), `dailyCapacity Int?` (para DAILY), `availableDays Json?` (dias da semana ou nulo = sempre), `isActive Boolean`, timestamps.
- **`ProductCategory`** — `name`, `icon/emoji?`, `sortOrder?`, `isActive`. Semeada com as 6 padrão.
- **`MarketOrder`** — `userId`, `condominiumId`, `scheduledDate`, `slotId`, `status` (espelha o ciclo de entrega), vínculo à `DeliveryList`, `paymentId?`, valores (`totalValue`, `creditsApplied`, `moneyAmount`), marcos de cancelamento/entrega.
- **`MarketOrderItem`** — `marketOrderId`, `productId`, `qty`, `unitPrice` (snapshot), `lineTotal`.
- **Extensões:**
  - `TransactionType` += `MARKET_PURCHASE` (débito) e `MARKET_REFUND` (crédito).
  - `PaymentPurpose` += `MARKET`.
  - `Setting` += `marketMinimoCestinha` (R$).
- **Estoque diário:** avaliar derivar disponibilidade da soma de itens pedidos por produto/data (evita contador mutável e drift) vs. contador dedicado — decidir no plano.

## 7. Impactos em telas/fluxos existentes

- **Home (cliente):** novo bloco fixo "Além do Pãozin".
- **Tab bar (cliente):** 6ª aba — atenção à densidade em telas estreitas (tratar no design).
- **Pedido avulso (`SingleScreen`):** atalho "adicione algo do Além do Pãozin" → Cestinha.
- **Pedidos (histórico/acompanhamento):** pedidos do market aparecem junto.
- **Admin → Gestão:** novo hub "Além do Pãozin" (produtos, categorias, estoque, config do mínimo).
- **Admin → Separação de pedidos:** incluir itens do market.
- **Entregador → lista/rota:** incluir itens do market.

## 8. Questões técnicas em aberto (para a fase de plano)

1. Estoque diário: derivar-da-soma vs. contador dedicado (atomicidade da reserva).
2. Arredondamento da conversão dinheiro→crédito no estorno (recomendado `ceil`).
3. Modelagem do vínculo `MarketOrder` ↔ `DeliveryList` / separação (reuso vs. campos novos).
4. Validação dupla nas rotas (JSON Schema do Fastify + Zod) — atualizar os **dois** ao criar endpoints. *(ver memória do projeto)*
5. Config de bucket S3 + biblioteca de upload (`@fastify/multipart`?), limites de tamanho/tipo, e URL pública vs. assinada.
6. Reaproveitamento de `packages/shared` (tipos/constantes) para os novos schemas.
7. Densidade da tab bar com 6 itens (decisão de UX/design).

## 9. Próximos passos

1. ✅ **Designs das telas** gerados no Claude Design (brief em [`brief-telas-alem-do-paozin.md`](./brief-telas-alem-do-paozin.md)).
2. ✅ **Handoff entregue** — [`handoff-alem-do-paozin.md`](./handoff-alem-do-paozin.md).
3. ✅ **Pendências de reconciliação resolvidas** (§4-bis): Perfil mantido (+ aba nova = 6 abas), desconto sempre real, carrinho persistente v1, MKT-33 = sheet (B).
4. ⏳ **Plano de implementação** — `.projeto/docs/plano-alem-do-paozin.md` (e depois fase GSD `.planning/phases/15-alem-do-paozin/`) com IDs MKT, ondas e verificação.

## 10. Tabela de requisitos (IDs para o plano)

| ID | Requisito | Origem |
|---|---|---|
| MKT-01 | Aba própria "Além do Pãozin" na tab bar do cliente | DEC-01 |
| MKT-02 | Bloco fixo de destaque na Home | DEC-02 |
| MKT-03 | Atalho "adicionar ao pedido" no pedido avulso de pão | DEC-03 |
| MKT-04 | Produto como item/pacote fixo (sem peso) | DEC-04 |
| MKT-05 | Cadastro de produto com campos definidos | DEC-05 |
| MKT-06 | Upload e storage de foto em S3 (+ fallback por categoria) | DEC-06 |
| MKT-07 | CRUD de categorias (6 padrão + gerenciáveis) | DEC-07 |
| MKT-08 | Estoque diário (reseta) e fixo (inventário) | DEC-08 |
| MKT-09 | Estoque global | DEC-09 |
| MKT-10 | Reposição manual de estoque pelo admin | DEC-10 |
| MKT-11 | Reserva atômica no checkout + devolução em cancelamento/falha | DEC-11 |
| MKT-12 | Estado "Esgotado" + desativar produto | DEC-12 |
| MKT-13 | Alerta de baixo estoque para o admin | DEC-13 |
| MKT-14 | Disponibilidade por dias da semana | DEC-14 |
| MKT-15 | Aceitar dinheiro e crédito | DEC-15 |
| MKT-16 | Resgate de crédito a valor avulso (`avulsoUnit`) | DEC-16 |
| MKT-17 | Desconto implícito via economia do combo | DEC-17 |
| MKT-18 | Badge "pague com pãezinhos: até X% de economia" (dinâmico) | DEC-18 |
| MKT-19 | Helper de precificação no cadastro do admin | DEC-19 |
| MKT-20 | Pagamento misto crédito + dinheiro | DEC-20/21 |
| MKT-21 | Novo `PaymentPurpose = MARKET` + reuso Pix/cartão | DEC-22 |
| MKT-22 | Aviso suave de saldo x agenda (não bloqueante) | DEC-23/24 |
| MKT-23 | Market não dispara auto-recarga | DEC-25 |
| MKT-24 | Sem frete | DEC-26 |
| MKT-25 | Mínimo da Cestinha em R$ (Setting), sempre aplicável | DEC-27 |
| MKT-26 | Carona na entrega da manhã (mesmo slot/entregador) | DEC-28/29/30 |
| MKT-27 | Itens do market na separação e na entrega | DEC-31 |
| MKT-28 | Cestinha unificada (cliente) + `MarketOrder` separado (backend) | DEC-32/33 |
| MKT-29 | v1 só avulso (recorrência = v2) | DEC-34 |
| MKT-30 | Cancelamento só antes do corte | DEC-35 |
| MKT-31 | Estorno tudo em crédito (inclusive parte em dinheiro) | DEC-36 |
| MKT-32 | Devolução de estoque no cancelamento | DEC-37 |
| MKT-33 | Resumo do pedido ("Revisar pedido") antes da cobrança | DEC-38 |
| MKT-34 | Persistência do carrinho entre sessões (v1) | DEC-39 |
| MKT-35 | Notificação ao cliente na entrega do market (paridade `DELIVERED`) | §4.8 (revisão) |
| MKT-36 | Segmentação financeira por `purpose` (isola MARKET; corrige HOOK junto) | §4.7 (revisão) |
