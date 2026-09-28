# Plano — Módulo Financeiro & Relatórios de Vendas (admin)

> Levantamento e planejamento do módulo de **relatório financeiro (DRE, despesas, fluxo de caixa)**
> e de **relatórios de venda / performance / métricas** no administrativo.
> Data: 2026-09-21 · Branch sugerida: `feat/admin-financeiro-dre`
> Pré-requisito de leitura: [plano-relatorios.md](.projeto/docs/plano-relatorios.md) (módulo Relatórios, já entregue)

> **Status (2026-09-21): ✅ PLANO CONCLUÍDO — fases 0–7 e todos os itens de §14 que tinham fase.**
>
> Verificação: `turbo run typecheck test build` verde — **API 1445 testes · web 246 · shared 58**.
>
> ---
>
> **Onda final — os 6 itens que faltavam.** Auditoria contra o plano encontrou seis pendências
> dentro das fases (não do backlog "Futuro"); todas entregues:
>
> **🚩A1 · Fechamento de mês com snapshot** — o achado do §16 que tornava tudo não-auditável:
> `loadUnitCosts()` lê o custo de fornecimento de AGORA, então *o DRE de agosto muda sozinho quando
> o fornecedor sobe o preço em setembro*. Modelo `FinancialClose` com o DRE congelado (os DOIS
> regimes — congelar um só faria o outro voltar a divergir); `DreService` lê o snapshot antes de
> recalcular, e por isso **painel e tendência herdam o congelamento** de graça. Fechar TRAVA
> lançamento retroativo e **impede a materialização de recorrência no mês fechado** — sem isso a
> lista passaria a divergir do DRE congelado pelo simples ato de VISUALIZAR. Reabrir é permitido e
> deixa rastro no log. O leitor do snapshot mora em módulo próprio para quebrar o ciclo de
> importação com o `DreService`. 18 + 5 testes.
>
> **⭐C1 · Alertas financeiros** (o último dos 3 de escopo firmado) — 5 tipos no enum, regras PURAS
> em `lib/financial-alerts.ts` e cron diário às 8h. O desenho inteiro gira em torno do **silêncio**:
> limiares folgados, nada de tendência antes de 25% do mês decorrido, e **deduplicação** por
> `dedupeKey` — sem ela uma conta atrasada notificaria 30 vezes e o toggle seria desligado, levando
> junto os meses em que o canal importava. A chave ficou em **campo próprio** de `Notification`, não
> escondida no corpo (o corpo é lido na tela e enviado no push). 26 + 8 testes.
>
> **Contas a pagar no painel** — a Faixa 6 ganhou a terceira linha do balanço e a Faixa 0, os
> alertas de vencida/vencendo. O `PainelPosicao` ainda trazia o comentário "entram na Fase 1".
>
> **F7 · Movimentação do passivo** — `GET /admin/reports/credit-movement`, na MESMA tela do saldo:
> "devo R$ 7.500" e "subiu R$ 3.000 porque vendi combo" são a mesma pergunta em dois tempos. O
> **sinal do dado manda, não o rótulo** (um `ADMIN_GRANT` negativo reduz o passivo). Inclui o
> recorte **🚩A2**: `EXPIRY` existe no enum e nunca é escrito — crédito não expira —, e o relatório
> **nomeia** o problema em vez de fingir que não existe. 12 testes.
>
> **B5 · Compra ao fornecedor → conta a pagar** — `PurchaseOrder.paidAt`; a saída de caixa passa a
> ser o PAGAMENTO. **`paidAt ?? date` é o que impede o histórico de mudar sozinho**: toda compra
> anterior ao campo continua contando exatamente onde já estava. A compra **não vira `Expense`** —
> um espelho faria o DRE contar o mesmo gasto duas vezes —, só aparece em contas a pagar com
> `sourceKind` dizendo ao front qual endpoint chamar. 5 testes.
>
> **D3 · Pacote do contador** — ZIP com DRE em PDF nos dois regimes, razão em XLSX e comprovantes.
> **Comprovante que falha não some em silêncio**: vai ao `MANIFESTO.txt` com motivo e URL de origem,
> porque um ZIP incompleto sem lista deixa o contador sem saber o que pedir de volta. O teste **abre
> o ZIP gerado** e confere assinatura de PDF e de XLSX — um arquivo corrompido só apareceria na mão
> do contador. 12 testes.
>
> **Deploy:** nada manual. O `prisma db push` roda sozinho no playbook do Ansible a cada deploy
> (`ansible/playbook.yml`), e é idempotente.
>
> O que ele cria são os **ÍNDICES** — no Mongo, campo e coleção novos não precisam de migração
> nenhuma (a coleção nasce na primeira escrita, e documento antigo só não tem a chave; é por isso
> que a casa proíbe `where: { campo: null }`). Então `Notification.dedupeKey` e
> `PurchaseOrder.paidAt` já funcionam sem push.
>
> Dependem dele: `FinancialClose.month @unique` (sem o índice, dois cliques em "Fechar mês" criam
> dois snapshots) e `Budget @@unique([month, kind, categoryId])` (a trava contra meta duplicada, que
> este plano declara ser **do banco, não da aplicação** — o upsert faz busca-e-cria e é racy
> sozinho). Mais os índices de leitura de `Budget` e `Notification`.
>
> Nenhum deles colide com `ensure-indexes.ts`, que só declara o índice parcial de `Order.paymentId`
> — o `IndexOptionsConflict` de 14/08/2026 não se repete aqui.
>
> **O que resta é só o backlog "Futuro" do §11**, declarado desde o início e nunca prometido nesta
> onda: V10 V11 V13 V14 V16 V17 · F10 F12 F13 F14 · política de validade do crédito (A2 —
> o relatório agora mede o tamanho do problema; decidir a regra é do dono) · B1 · D5.
>
> ---
>
> **Fase 6 — Vendas & performance (feita).** `lib/period-sales.ts` generaliza `day-sales` de um dia
> para um intervalo — e **`buildDaySales` passou a ser uma chamada de um dia só a ele**: manter as
> duas implementações faria a tela do dia e a do período darem números diferentes para o MESMO dia.
> Duas coisas são novas e nenhuma é cosmética: a janela é encaixada em **dias BRT inteiros** (um
> preset "hoje" às 9h devolveria ZERO, porque `scheduledDate` é gravado ao meio-dia BRT) e a parada
> passa a ser `(dia, cliente, turno)`. `GET /admin/reports/{sales,customers}` compondo
> `AdminFinancialService`, `getPaymentsReport` e `getCondominiumRanking` — zero reagregação.
> Curva ABC pura (`withAbc`), mix de canal, ticket médio, receita por combo com **R$ por pãozinho**
> (a régua que compara combos de tamanhos diferentes), top clientes com LTV e concentração.
> Telas `RelVendas` e `RelClientes` num grupo novo em Relatórios; painel ganhou **mix de canal** de
> 4 canais (Cestinha e gancho já vinham no payload e não eram desenhados) e a **Faixa 7 de atalhos**.
> **+ ⭐D1 precificação assistida:** margem ao vivo no `ComboForm` (via `GET /admin/combos/pricing`)
> e no `MarketProductForm` — antes o custo só aparecia no aviso da promoção, então o preço CHEIO era
> definido no escuro. 59 testes novos.
>
> **Fase 7 — Margem, equilíbrio e metas (feita).** `lib/break-even.ts` PURO com margem de
> contribuição, ponto de equilíbrio e **os dois casos em que ele NÃO existe** (sem receita; margem de
> contribuição ≤ 0 → o problema é de PREÇO, não de volume) devolvendo `null` em vez de meta
> inventada. `margin.service.ts` com margem por produto (produto sem custo sai `null`, nunca 100%),
> **B3 rateio por condomínio** por pães entregues — com despesa que já tem centro de custo FORA dele
> — e o ponto de equilíbrio. **D2 simulador** em `GET /admin/financial/simulate`, reusando a mesma
> aritmética: sem alteração, devolve exatamente o relatório (contrato testado). Modelo `Budget` +
> `budget.service.ts` com **`expectedToDate` pro rata** (comparar 10 dias com a meta cheia dá sempre
> "30%" e não informa nada) e `isGood` resolvendo o sinal no servidor — receita acima da meta é bom,
> despesa acima é ruim. **D4 dashboard consolidado** em `trend.service.ts` + `FinTendencia`: compõe
> um DRE (caixa) e um fluxo de caixa POR MÊS, então a tendência nunca discorda das telas que ela
> resume — custo pago com paralelismo e cache de 5 min. O mês corrente é desenhado mas **fica fora
> das comparações** (medi-lo contra fechados mostraria uma queda que é só o calendário), a margem
> varia em **pontos percentuais**, e passivo/contas a pagar ficam FORA da série: são saldos de hoje,
> e seis barras iguais sugeririam uma estabilidade não medida. Telas `FinMargem`, `FinMetas` e
> `FinTendencia`. 76 testes novos.
>
> **Pendência de configuração — RESOLVIDA.** `ganchoCusto` agora é editável em `AdminGancho` (e o
> campo **estava sendo descartado em silêncio** pelo `response` schema do `GET /admin/settings/gancho`
> — a armadilha do `fast-json-stringify` que o próprio plano documenta, corrigida). As 3 alíquotas de
> gateway ganharam `GET/PATCH /admin/settings/gateway-rates` e a tela `FinAliquotas`, que declara
> quais ainda são a tabela pública de referência em vez da taxa negociada.
>
> **Exportação: CSV → XLSX em TODAS as telas** (pedido do usuário nesta sessão). `lib/csv.ts`
> removido; `lib/xlsx.ts` novo, com `exceljs` **carregado sob demanda** — é a mesma lib que a API já
> usa, e o chunk de 930 KB fica fora do precache do service worker, senão todo cliente que abre o app
> para comprar pão baixaria 1 MB que nunca executa. Número vai como NÚMERO com formato de célula (o
> CSV entregava tudo como texto e a coluna não somava do outro lado), várias abas por relatório e as
> ressalvas no rodapé da planilha. 16 telas: 12 migradas + 4 que **não tinham exportação**
> (Receita, Despesas, Contas a pagar) e as novas. 11 testes.
>
> ⚠️ **Pendente de deploy:** `prisma db push` precisa rodar para criar a coleção `Budget` e seus
> índices (além das 3 coleções da Fase 1, se ainda não rodou).
>
> ---
>
> **Status anterior (fases 0–5).**
>
> **Fase 1 — Despesas (feita).** `ExpenseCategory` + `Expense` + `ExpenseRecurrence` no schema;
> 16 categorias semeadas no boot; `lib/expense-recurrence.ts` com materialização preguiçosa travada
> por `@@unique([recurrenceId, recurrenceMonth])`; `admin-expenses` com 14 rotas (CRUD de
> lançamento/categoria/recorrência, contas a pagar, importação em massa, upload de comprovante em
> `receipts/`). Zod em `packages/shared/src/schemas/expense.ts`.
> Telas: **Financeiro virou hub** (decisão 8 — a tela de receita virou `FinReceita`), `AdminDespesas`
> agrupada por linha do DRE, `ExpenseForm`, `AdminContasPagar`, `AdminDespesasCategorias` e
> **⭐E1 `QuickExpense`** (teclado numérico, hoje/já paga, foto pela câmera, upload não bloqueante).
> **Passivo de crédito migrou** de Relatórios para Financeiro; o card "Custo de OTP por canal" foi
> **removido** dos "Em breve" — o OTP hoje é só e-mail, ele prometia um custo que não existe mais.
> 46 testes novos (15 recorrência + 31 serviço) + 11 nos helpers de data.
>
> **Fase 3 — Taxa de gateway (feita).** `Payment.gatewayFee`/`netAmount`/`feeBasis`;
> `lib/gateway-fee.ts` com as duas fontes (real do provedor × estimada por `Setting`), alíquotas
> semeadas no boot. Captura real no webhook: MP por `fee_details` (só o que o VENDEDOR paga) e
> Stripe por `balance_transaction.fee` — ambas DEPOIS do fulfillment e em try/catch próprio, porque
> creditar o cliente não pode falhar por causa de um campo contábil. A estimativa **nunca é
> persistida**: gravá-la congelaria uma alíquota que muda. Tela `FinGateway`. 23 testes.
>
> **Fase 4 — DRE (feita).** `lib/dre.ts` PURO (a aritmética e os sinais, testáveis sem banco) +
> `dre.service.ts` que só coleta, compondo `AdminFinancialService`, `AdminReportsService` e
> `GatewayService`. Os dois regimes numa passada, com a **ponte** caixa × competência — e ela é
> identidade EXATA, não aproximação, porque CMV/perdas/taxa não variam entre regimes (testado).
> `caveats` viajam no payload e a tela os exibe ACIMA dos números. Telas: `FinDre` (regime
> declarado no cabeçalho e no CSV) e o resultado na Faixa 2 do painel. 33 testes.
>
> **Fase 2 — Relatório de despesas (feita).** `GET /admin/reports/expenses` por grupo do DRE,
> categoria e recebedor, com comparativo LIGADO por padrão (gasto sem "vs. o mês passado" não diz
> se subiu) e `avgPrevious` dividindo pelos meses que EXISTEM, não por 3 fixo. Apura por
> COMPETÊNCIA. **+ A3:** `Setting ganchoCusto` e `hookAcquisition` — o CAC via gancho grátis, que
> era invisível; `null` quando o custo não foi informado. Tela `RelDespesas`. 19 testes.
>
> **Fase 5 — Fluxo de caixa (feita).** `GET /admin/financial/cashflow` — entradas pelo LÍQUIDO
> (é o que o extrato mostra), saídas por `paidAt` + compras + estornos, série diária CONTÍNUA
> (dia parado entra com zero, senão o acumulado salta no gráfico) e acumulado partindo de ZERO
> (variação do período, não saldo em conta — o sistema não conhece o extrato). Tela `FinCaixa`.
> 14 testes.
>
> **Fase 0 — fundação de período (feita).** `lib/date-range.ts` reescrito com mês fechado,
> intervalo arbitrário e `previousWindow` (janela anterior equivalente); `lib/period-query.ts` com
> a querystring compartilhada; `getDateRange` preservado byte a byte para não tocar nos 8
> relatórios. `PeriodPicker` no web (presets + meses fechados + intervalo + comparar), migrado nas
> 8 telas e no Financeiro. 31 testes novos em `date-range.test.ts`.
>
> **Fase 0.5 — Painel reformulado (feita).** `admin-dashboard` novo com
> `GET /admin/dashboard/{alerts,overview}` (sem `response` schema, cache TTL de 45s na visão
> geral); `GET /admin/dashboard` histórico intocado. `AdminPainel` virou composição de 7 faixas
> (`PainelAlertas`, `PainelResultado`, `PainelBase`, `PainelPosicao`). 19 testes no serviço + 8 na
> faixa de alertas.
>
> **Corrigidos em código nesta onda:**
> - 🚩 **Receita de gancho invisível** — `hook` entra em `getRevenue` e no `totalConsolidated`
>   (decisão 7). **A receita exibida no admin subiu**: é o conserto, não regressão.
> - 🚩 **Comparativo dia-vs-ontem** — `breadsTodayTrendPct`/`revenueTrendPct` passam a comparar com
>   o **mesmo dia da semana anterior**. Antes toda segunda aparecia em queda contra o domingo.
> - 🚩 **`itemsByWeekday` órfão** — a API calculava e o front nunca lia; agora é a série da Cestinha
>   no painel, separada da do pão (D-1).
> - KPI "Condomínios" saiu da grade (virou contexto no cabeçalho) e "Clientes" virou **clientes
>   ativos**; "em risco de churn" e "recarga automática" entraram — todos já calculados e nenhum
>   exibido antes.
>
> Verificação ao fim das fases 0–5: **API 1221 testes · web 235 · shared 58**.
>
> ⚠️ **Pendente de deploy:** `prisma db push` precisa rodar para criar as 3 coleções novas, seus
> índices e os 3 campos de taxa em `Payment` (o playbook já roda no deploy). Os seeds de
> categoria e de alíquota são idempotentes no boot.
>
> ---
>
> **Levantamento original (2026-09-21): 12 decisões fechadas.**
> - **Escopo firmado:** ⭐E1 lançamento rápido de despesa · ⭐D1 precificação assistida ·
>   ⭐C1 alertas financeiros · **§15 reformulação completa do Painel** (absorveu o C2 original).
> - **12/12 decisões tomadas** (§12). Onze no recomendado; a **nº2 (CMV do pão = custo comprado)**
>   divergiu e o §7.2 foi reescrito para ela, com a contrapartida declarada.
> - **Regime do DRE (§12 D1):** os dois regimes, **CAIXA como padrão**, ponte caixa×competência
>   sempre visível, regime declarado no cabeçalho e nas exportações.
> - **4 achados de código** (não são falta de relatório): receita de gancho invisível · DRE de mês
>   passado muda sozinho · crédito nunca expira · custo do gancho grátis não existe. Ver §16.
> - **Caminho crítico: Fases 0 → 0.5 → 1 → 3 → 4.** A Fase 0.5 (Painel) entrega valor visível
>   antes de qualquer linha de despesa existir — só compõe dado já calculado.
> - Nenhuma linha de código escrita ainda. Implementação deve entrar por `/gsd-execute-phase`.

---

## 1. Objetivo

Duas frentes pedidas, que se cruzam num ponto:

**A. Vendas, performance e métricas** — relatórios de venda por intervalo livre, produtos/combos
mais vendidos, ticket médio, mix de canal, performance por condomínio/cliente, comparativo entre
períodos.

**B. Financeiro** — **DRE**, **registro e gerenciamento de despesas**, **relatório de despesas**,
fluxo de caixa, conciliação de gateway e margem.

> **O cruzamento:** o DRE é a única tela que precisa das *duas* pontas. Hoje o sistema conhece
> muito bem o lado da receita e quase nada do lado da despesa — e é exatamente por isso que não
> existe DRE ainda. **A frente B é a que tem trabalho de verdade; a frente A é em boa parte
> generalização do que já está construído.**

---

## 2. Mapa do terreno — o que JÁ existe (não duplicar)

### 2.1 Backend

| Módulo | Endpoint | O que entrega |
|---|---|---|
| [admin-financial](apps/api/src/modules/admin-financial/admin-financial.service.ts) | `GET /admin/financial?period=` | Receita por período; quebra combos × avulso; Cestinha (receita nova, GMV, CMV, margem, unidades sem custo); compras ao fornecedor finalizadas; receita por condomínio |
| [admin-reports](apps/api/src/modules/admin-reports/admin-reports.service.ts) | `GET /admin/reports/{8 rotas}` | `access`, `retention`, `credit-liability`, `condominiums`, `delivery`, `waste`, `schedule-profile`, `payments` |
| [admin-day-sales](apps/api/src/modules/admin-day-sales/admin-day-sales.service.ts) | `GET /admin/day-sales` (+ `/pdf`, `/excel`) | Itens vendidos de **UM** dia de entrega, com PDF e XLSX |
| [admin-supplier-orders](apps/api/src/modules/admin-supplier-orders/admin-supplier-orders.route.ts) | 20 rotas | Pedido ao fornecedor, custo, histórico, PDF/Excel |
| [admin-payments](apps/api/src/modules/admin-payments/admin-payments.route.ts) | `GET/POST /admin/payments` | Lista de pagamentos e estorno (ferramenta, não relatório) |
| [admin-orders](apps/api/src/modules/admin-orders) | `GET /admin/dashboard` | KPIs do painel, incl. `revenueTrendPct` (comparativo já existe **aqui e só aqui**) |

**Libs reutilizáveis (a base do módulo novo):**

| Lib | Papel |
|---|---|
| [lib/date-range.ts](apps/api/src/lib/date-range.ts) | `getDateRange(period)` em BRT — **fonte única de janela temporal** |
| [lib/revenue.ts](apps/api/src/lib/revenue.ts) | `excludeNonCreditPurpose` / `nonCreditPurposeMatchRaw` — segmentação de `PaymentPurpose` |
| [lib/product-cost.ts](apps/api/src/lib/product-cost.ts) | `loadUnitCosts()` — custo unitário esperado pela matriz de fornecimento (+ `basis`) |
| [lib/day-sales.ts](apps/api/src/lib/day-sales.ts) | `buildDaySales()` — agregação de vendas de um dia |
| [lib/storage.ts](apps/api/src/lib/storage.ts) | Upload S3 (`isStorageConfigured()`) — **serve de graça para comprovante de despesa** |

### 2.2 Frontend

| Arquivo | Papel |
|---|---|
| [AdminFinanceiro.tsx](apps/web/src/pages/admin/gestao/AdminFinanceiro.tsx) | Tela única de receita (dia/semana/mês) |
| [AdminRelatorios.tsx](apps/web/src/pages/admin/gestao/AdminRelatorios.tsx) | Hub de 8 relatórios + 4 cards "Em breve" |
| [RelShared.tsx](apps/web/src/pages/admin/gestao/RelShared.tsx) | `ReportAppBar` (com botão exportar), `ReportScroll`, `ReportCard`, `StatRow`, `SectionTitle`, `fmtBRL/fmtPct/fmtInt/fmtCredits` |
| [lib/csv.ts](apps/web/src/lib/csv.ts) | `buildCsv` + `downloadCsv` (`;` + BOM UTF-8 p/ Excel pt-BR) |
| [KpiCard](apps/web/src/components/admin/KpiCard.tsx) · [BarChart](apps/web/src/components/admin/BarChart.tsx) · [SegmentedControl](apps/web/src/components/admin/SegmentedControl.tsx) | Gráfico SVG próprio — **sem lib nova de chart** |

**Conclusão do mapa:** a infraestrutura de *apresentação* de relatório está pronta e madura.
Nenhuma peça visual nova precisa ser inventada, exceto o seletor de período custom e as telas de
despesa (que são formulário CRUD, não relatório).

---

## 3. Os 4 buracos estruturais (o achado principal)

### 🕳️ Buraco 1 — **Não existe nenhum conceito de DESPESA no sistema**

```
$ grep -rni "expense|despesa" apps/api/src apps/web/src packages
(zero resultados)
```

O único "dinheiro que sai" que o sistema conhece é `PurchaseOrder` FINALIZED — **compra de
mercadoria**. Não existem, em lugar nenhum:

aluguel · combustível/deslocamento · pagamento do entregador · pró-labore · taxa de gateway ·
energia/internet · embalagem e sacolas · custo do gancho de porta físico · marketing ·
software/serviços · contador · impostos (DAS/Simples) · manutenção · perdas não-mercadoria

**Sem isso não existe DRE — existe "receita − CMV", que é lucro bruto, não resultado.**
Este é o coração do plano, exatamente como o rastreio de acesso foi o coração do plano anterior.

### 🕳️ Buraco 2 — **A taxa do gateway nunca é gravada**

`Payment.amount` é o **bruto**. Não há `fee`, `netAmount` nem o payload cru do Mercado
Pago/Stripe em nenhum lugar ([payments.repository.ts](apps/api/src/modules/payments/payments.repository.ts),
[mercadopago-pix.service.ts](apps/api/src/modules/payments/mercadopago-pix.service.ts),
[stripe.service.ts](apps/api/src/modules/payments/stripe.service.ts)).

Num negócio de ticket baixo e volume alto, a taxa (≈0,99% Pix · ≈4,98% cartão) é uma linha **grande**
do DRE e hoje é invisível. Toda receita reportada é bruta e ninguém sabe disso.

### 🕳️ Buraco 3 — **Todo relatório é "do início do período até AGORA"**

`getDateRange` só sabe fazer três janelas: início do dia / segunda desta semana / dia 1 deste mês,
sempre terminando em `new Date()`. Não existe:

- **mês fechado** ("agosto inteiro") — e DRE de mês em curso não fecha com nada;
- **intervalo arbitrário** (01/07 a 15/08);
- **período anterior** para comparação (o único comparativo do produto é `revenueTrendPct`, cravado no dashboard).

**Um DRE de "setembro até agora" não é um DRE.** Esta é a fundação que precisa vir antes de tudo.

### 🕳️ Buraco 4 — **O regime contábil nunca foi decidido**

O modelo é **pré-pago**: o cliente compra 30 pãezinhos hoje e consome ao longo de semanas.

- `getRevenue()` reconhece receita **no pagamento** → regime de **caixa**.
- `getCreditLiability()` já mede o **passivo** (crédito em circulação × preço médio histórico) →
  a peça de **competência** existe, mas está solta, sem ninguém a consumir.

Os dois números são legítimos e **muito diferentes** num mês de campanha (venda de combo alta,
consumo normal). Um DRE que não declara o regime mente por omissão. Detalhe em §7.

---

## 4. Buracos menores (frente de vendas / performance)

| # | Falta | Hoje | Esforço |
|---|---|---|---|
| a | **Vendas em intervalo > 1 dia** | `day-sales` é de um dia só; não existe "mais vendidos do mês" | generalizar `buildDaySales` |
| b | **Ticket médio** | não existe em nenhum lugar | trivial (já tem receita e contagem) |
| c | **Receita por combo** | `Payment.comboId` existe, nenhum relatório quebra por combo | baixo |
| d | **Comparativo entre períodos** | só no dashboard | depende do Buraco 3 |
| e | **Curva ABC de produto** | — | baixo (sobre o item a) |
| f | **Top clientes / LTV** | — | baixo |
| g | **Efetividade de promoção** | `Promotion` e `Product.isPromo` existem, sem leitura analítica | médio |
| h | **Conversão de banner → compra** | `BannerView` já é gravado | médio |
| i | **Coorte de receita** | já listado como "Em breve" na tela | médio |
| j | **Metas / orçamento** | conceito inexistente | novo modelo |
| k | **Custo por entrega / por parada** | depende do Buraco 1 (despesa de entrega) | baixo depois da Fase 1 |

### 🚩 Achado lateral (bug de receita, não de relatório)

`excludeNonCreditPurpose` exclui `HOOK` **e** `MARKET` de todas as agregações de receita.
`getRevenue()` devolve `MARKET` pelo caminho novo (`market.revenue`, somado em `totalConsolidated`),
mas **`HOOK` nunca volta**. Resultado: **a receita de gancho de porta pago não aparece em nenhum
número financeiro do admin** — só como contagem em `getPaymentsReport().byPurpose`.

É receita real, com Pix confirmado, invisível no financeiro. Corrigir junto (§8, Fase 4) e citar no
release note, porque **a receita total vai subir** quando entrar.

---

## 5. Catálogo — relatórios de VENDA, PERFORMANCE e MÉTRICAS

> Legenda: ✅ dado existe hoje · ⚙️ requer dado/infra nova · 〰️ derivável/aproximado · ♻️ generalizar o que existe

### 🥇 V-Tier 1 — o que mais falta e é barato

| # | Relatório | O que responde | Fonte | Status |
|---|---|---|---|---|
| V1 | **Vendas por intervalo** | O que vendi de 01/08 a 31/08, item a item, com receita e unidades | ♻️ `lib/day-sales.ts` sobre N dias | ♻️ |
| V2 | **Produtos & combos mais vendidos + curva ABC** | Quais 20% dos itens fazem 80% da receita | `MarketOrderItem` · `Payment.comboId` | ✅ |
| V3 | **Ticket médio** | Por pedido de crédito, por Cestinha, por cliente, por condomínio | `Payment` · `MarketOrder` | ✅ |
| V4 | **Mix de canal** | Combo × avulso × Cestinha × gancho — de onde vem a receita e como isso muda | `Payment.purpose`/`comboId` | ✅ |
| V5 | **Comparativo período a período** | Este mês × mês anterior × mesmo mês do ano passado, em toda tela | depende de §8 Fase 0 | ⚙️ |
| V6 | **Receita por combo** | Qual combo puxa a receita e qual só ocupa a vitrine | `Payment.comboId` + `Combo` | ✅ |

### 🥈 V-Tier 2 — performance comercial

| # | Relatório | O que responde | Fonte | Status |
|---|---|---|---|---|
| V7 | **Top clientes & LTV** | Quem sustenta o faturamento; receita acumulada por cliente | `Payment` por `userId` | ✅ |
| V8 | **Novos × recorrentes** | Quanto da receita do mês vem de cliente novo e quanto da base | `User.createdAt` × `Payment` | ✅〰️ |
| V9 | **Performance por condomínio** | Receita, ticket médio, pães/cliente, penetração — expandir ou cortar | ♻️ `getCondominiumRanking` + ticket | ♻️ |
| V10 | **Efetividade de promoção** | Vendeu mais com desconto? A margem sobreviveu? | `Promotion` · `Product.isPromo*` | ✅〰️ |
| V11 | **Conversão de banner → compra** | A peça na Home vira venda? | `BannerView` + `Payment` | ✅〰️ |
| V12 | **Sazonalidade** | Dia da semana e turno que mais vendem (planejar compra e escala) | `Order`/`MarketOrder` por `scheduledDate`/`slotId` | ✅ |

### 🥉 V-Tier 3 — métricas de negócio (backlog)

| # | Relatório | Observação | Status |
|---|---|---|---|
| V13 | **Receita recorrente estimada (MRR do pré-pago)** | Agendas ativas × pães/semana × preço médio por crédito | ✅〰️ |
| V14 | **Coorte de receita por mês de cadastro** | Já está na tela como "Em breve" | ✅〰️ |
| V15 | **LTV / CAC e payback** | **Depende da Fase 1** — CAC exige despesa de marketing | ⚙️ |
| V16 | **Churn de receita** | Receita perdida por cliente que parou de recomprar | ✅〰️ |
| V17 | **Velocidade de queima de crédito** | Parcialmente em `retention.repurchase` | ♻️ |

---

## 6. Catálogo — relatórios FINANCEIROS

### 🥇 F-Tier 1 — o pedido explícito

| # | Relatório | O que responde | Depende de | Status |
|---|---|---|---|---|
| F1 | **Registro & gestão de despesas** | Lançar, editar, categorizar, anexar comprovante, marcar como paga | modelo `Expense` | ⚙️ **NOVO** |
| F2 | **Relatório de despesas** | Quanto gastei, com o quê, com quem, fixo × variável, série mensal | F1 | ⚙️ |
| F3 | **DRE** | Receita bruta → líquida → lucro bruto → EBITDA → lucro líquido, com % da receita e comparativo | F1 + Fase 0 + Fase 3 | ⚙️ |
| F4 | **Contas a pagar** | O que vence esta semana / está atrasado | F1 | ⚙️ |

### 🥈 F-Tier 2 — o que o DRE puxa atrás de si

| # | Relatório | O que responde | Fonte | Status |
|---|---|---|---|---|
| F5 | **Fluxo de caixa realizado** | Entradas × saídas × saldo acumulado por dia/semana/mês | `Payment` PAID + `Expense` `paidAt` + `PurchaseOrder` | ⚙️ |
| F6 | **Conciliação de gateway** | Bruto × taxa × líquido × o que caiu na conta | `Payment` + `gatewayFee` | ⚙️ |
| F7 | **Movimentação do passivo de crédito** | Vendido, consumido, concedido, estornado, expirado — e o saldo que sobra | `CreditTransaction` por `type` | ✅ |
| F8 | **Margem por produto e por condomínio** | Onde a margem realmente está | ♻️ `loadUnitCosts` + receita | ♻️ |
| F9 | **Ponto de equilíbrio (break-even)** | Quantos pães/dia pagam a operação | F1 (despesa fixa) + margem de contribuição | ⚙️ |
| F10 | **Custo por entrega / por parada** | Quanto custa colocar uma sacola na porta | F1 (despesas de entrega) ÷ paradas | ⚙️ |

### 🥉 F-Tier 3 — backlog

| # | Relatório | Observação |
|---|---|---|
| F11 | **Metas × realizado** | Precisa do modelo `Budget` (§8, Fase 7) |
| F12 | **Projeção de caixa** | Recorrências futuras + contas a pagar + receita recorrente estimada |
| F13 | **Balancete simplificado / posição patrimonial** | Caixa + estoque + passivo de crédito − contas a pagar |
| F14 | **Rentabilidade por cliente** | Receita − CMV − custo de entrega rateado |

---

## 7. O DRE — linha a linha, com a fonte de cada linha

### 7.1 A estrutura

```
  RECEITA BRUTA
    (+) Venda de créditos — combos                    ✅ getRevenue().byType.combos
    (+) Venda de créditos — compra personalizada      ✅ getRevenue().byType.avulso
    (+) Cestinha — parte em dinheiro                  ✅ getRevenue().market.revenue
    (+) Gancho de porta pago                          🚩 existe no banco, some em todo relatório
  (−) DEDUÇÕES
    (−) Estornos                                      〰️ Payment REFUNDED (hoje só a TAXA é reportada)
    (−) Taxa de gateway (Pix / cartão)                ❌ NÃO EXISTE — Fase 3
  = RECEITA LÍQUIDA
  (−) CUSTO DA MERCADORIA VENDIDA (CMV)
    (−) Pão comprado no período                       ✅ purchases.breadCost  ← D2, ver 7.2
    (−) Produtos da Cestinha vendidos                 ✅ getRevenue().market.cmv
    (−) Perdas de item (Cestinha não entregue)        ✅ getWasteReport().items.lostValue
  = LUCRO BRUTO                        → margem bruta %
  (−) DESPESAS OPERACIONAIS
    (−) Pessoal e entrega                             ❌ Expense · grupo PEOPLE
    (−) Operação (combustível, embalagem, gancho)     ❌ Expense · grupo OPERATION
    (−) Comercial e marketing                         ❌ Expense · grupo SALES
    (−) Administrativas (aluguel, energia, software)  ❌ Expense · grupo ADMIN
  = RESULTADO OPERACIONAL / EBITDA     → margem operacional %
  (−) IMPOSTOS E TAXAS                                ❌ Expense · grupo TAXES
  = LUCRO LÍQUIDO                      → margem líquida %
```

Toda linha exibida com **valor**, **% da receita líquida** e **Δ vs período anterior** — é o que
transforma o DRE em ferramenta de decisão em vez de tabela.

### 7.2 O CMV do pão — **decidido: pão COMPRADO** (D2)

```
CMV do pão = Σ (PurchaseOrderItem.quantity × unitPrice) dos PurchaseOrder FINALIZED no período
           = getRevenue().purchases.breadCost   ← já implementado
```

A decomposição alternativa (`CMV = pão entregue × custo` + `Perda = sobra × custo`) foi **avaliada e
não adotada**. O que sustenta a escolha:

1. **É dinheiro pago, não estimativa.** `PurchaseOrderItem.unitPrice` é snapshot do custo real da
   compra. A rota do "pão entregue" precisaria multiplicar unidades entregues por um custo unitário
   *médio* — ou seja, trocar um número exato por um derivado.
2. **A distorção é pequena por construção.** O pão é `stockType: DAILY` e o `PurchaseOrder`
   `DELIVERY_BATCH` é gerado **no corte, a partir da demanda confirmada daquele (dia, turno)**.
   Compra e entrega são praticamente o mesmo dia — não há estoque de pão atravessando o mês.
3. **Menos uma peça para sair de sincronia.** Zero código novo: a linha já existe e já é usada na
   tela de Financeiro.

**A contrapartida, explícita:** o desperdício de pão **não aparece como linha do DRE** — fica
embutido no CMV. Duas mitigações:

- **O dado não se perde:** `getWasteReport()` continua medindo `ordered` × `delivered` × `wasteRate`,
  e [RelDesperdicio](apps/web/src/pages/admin/gestao/RelDesperdicio.tsx) segue sendo a tela que
  responde "quanto de pão está sobrando".
- **Nota de rodapé obrigatória no DRE:** `"CMV do pão = custo comprado no período. Desperdício em
  Relatórios › Desperdício."` — com link. O DRE declara a base em vez de deixar o leitor supor.

> Consequência de projeto: a linha de perdas do DRE cobre **só perda de item** (Cestinha não entregue
> resolvida como perda, `lossResolvedAt` + `stockReturned: false`), não sobra de pão. O rótulo da
> linha diz isso: **"Perdas de item"**, não "Perdas e desperdício".

### 7.3 Caixa × competência — a ponte

```
  RESULTADO (competência)
  (+/−) Variação do passivo de crédito no período     ✅ CreditTransaction PURCHASE − DELIVERY
  (+/−) Despesas do período ainda não pagas            ⚙️ Expense com paidAt = null
  (+/−) Compras recebidas e não pagas                  〰️ PurchaseOrder
  = CAIXA GERADO NO PERÍODO
```

**Recomendação: entregar os dois regimes, com CAIXA como padrão e a ponte sempre visível.**

Motivo: caixa é o que o dono reconcilia com o extrato do banco e é o número que ele já vê hoje
(trocar o padrão mudaria todos os números conhecidos sem aviso). Competência é o que responde "o
mês deu lucro?" e o que o contador pede. A ponte impede a pergunta inevitável — *"por que os dois
números são diferentes?"* — de virar desconfiança no relatório.

---

## 8. Modelo de dados novo

### 8.1 `ExpenseCategory` — categorias editáveis, agrupadas pelo DRE

```prisma
// Grupo do DRE onde a categoria entra. É o grupo — não a categoria — que define a LINHA do
// DRE: o admin cria "Gasolina da moto" e "Pedágio" sem que ninguém mexa no código do DRE.
enum ExpenseGroup {
  COGS       // CMV lançado à mão (exceção — o normal vem de PurchaseOrder)
  PEOPLE     // entregador, pró-labore, encargos
  OPERATION  // combustível, embalagem, gancho físico, manutenção
  SALES      // marketing, comissão, material de divulgação
  ADMIN      // aluguel, energia, internet, software, contador
  TAXES      // DAS/Simples, tributos, tarifa bancária
  OTHER
}

model ExpenseCategory {
  id        String       @id @default(auto()) @map("_id") @db.ObjectId
  name      String       @unique
  group     ExpenseGroup
  // Fixa = existe mesmo com venda zero. É o que permite calcular ponto de equilíbrio (F9);
  // sem esta flag, break-even não sai de jeito nenhum.
  isFixed   Boolean      @default(false)
  emoji     String?
  sortOrder Int          @default(0)
  isActive  Boolean      @default(true)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
}
```

Seed padrão em [defaults-seed.ts](apps/api/src/bootstrap/defaults-seed.ts) (mesmo padrão das 6
categorias do mercadinho): Entregador · Pró-labore · Combustível · Embalagem · Gancho de porta ·
Aluguel · Energia · Internet · Software · Contador · Marketing · Taxa de gateway · Tarifa bancária ·
Impostos · Manutenção · Outros.

### 8.2 `Expense` — o lançamento

```prisma
enum ExpenseStatus {
  PENDING   // a pagar (entra em contas a pagar)
  PAID
  CANCELLED
}

model Expense {
  id             String        @id @default(auto()) @map("_id") @db.ObjectId
  categoryId     String        @db.ObjectId
  description    String
  amount         Float
  // DUAS datas, porque os dois regimes precisam de uma cada (§7.3). Sem as duas, o DRE de
  // competência e o fluxo de caixa dariam o mesmo número — e aí um dos dois está errado.
  competenceDate DateTime      // a QUE mês a despesa pertence
  dueDate        DateTime?     // vencimento (alimenta contas a pagar)
  paidAt         DateTime?     // quando saiu do caixa; null = não pago
  status         ExpenseStatus
  // Quem recebeu: fornecedor cadastrado OU texto livre (o entregador não é Supplier).
  supplierId     String?       @db.ObjectId
  payee          String?
  paymentMethod  String?       // Pix, dinheiro, cartão, boleto — texto livre (não é PaymentMethod)
  // Centro de custo opcional. Sem ele, "custo por condomínio" fica sempre rateado por estimativa.
  condominiumId  String?       @db.ObjectId
  receiptUrl     String?       // comprovante no S3 (lib/storage.ts, já pronto)
  notes          String?
  // Parcela gerada por uma recorrência. Nulo = lançamento avulso.
  recurrenceId   String?       @db.ObjectId
  // Mês de competência da parcela, "YYYY-MM" (BRT). Existe só para a trava de idempotência:
  // o índice único abaixo é o que impede a recorrência de gerar aluguel duas vezes em agosto.
  recurrenceMonth String?
  createdById    String        @db.ObjectId
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  @@index([competenceDate])
  @@index([status, dueDate])
  @@index([categoryId, competenceDate])
  @@unique([recurrenceId, recurrenceMonth])
}
```

### 8.3 `ExpenseRecurrence` — a despesa fixa que se repete

```prisma
model ExpenseRecurrence {
  id            String       @id @default(auto()) @map("_id") @db.ObjectId
  categoryId    String        @db.ObjectId
  description   String
  amount        Float
  dayOfMonth    Int           // 1..28 — 29/30/31 não existem em todo mês; clampar seria surpresa silenciosa
  supplierId    String?       @db.ObjectId
  payee         String?
  condominiumId String?       @db.ObjectId
  startsAt      DateTime
  endsAt        DateTime?     // null = sem fim
  isActive      Boolean       @default(true)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
}
```

**Geração das parcelas: preguiçosa (lazy), não por cron.** Ao abrir o mês no módulo de despesas, o
serviço materializa as parcelas que faltam — protegido pelo `@@unique([recurrenceId,
recurrenceMonth])`. Um cron mensal seria mais uma engrenagem para quebrar em silêncio (o projeto já
tem [plugins/cron.ts](apps/api/src/plugins/cron.ts) com 3 jobs críticos), e a parcela só precisa
existir quando alguém for olhar. Gerada como `PENDING`, com valor **editável** — conta de luz varia.

### 8.4 `Payment` — taxa de gateway (Fase 3)

```prisma
model Payment {
  // ... campos atuais
  gatewayFee Float?  // taxa retida pelo gateway (R$)
  netAmount  Float?  // amount − gatewayFee
  feeBasis   String? // 'GATEWAY' (real, veio do provedor) | 'ESTIMATED' (Setting × amount)
}
```

`feeBasis` é a mesma disciplina de `ProductCost.basis` em [product-cost.ts](apps/api/src/lib/product-cost.ts):
o relatório **declara** que a taxa é estimativa em vez de exibir um número redondo e errado.

**Duas fontes, nesta ordem:**
1. **Estimativa por `Setting`** (`taxaPix`, `taxaCartaoCredito`, `taxaCartaoDebito`) — funciona
   **retroativamente** sobre todo o histórico, resolve 100% do DRE, custo quase zero.
2. **Captura real no webhook** — o MP devolve `fee_details[]` e o Stripe
   `balance_transaction.fee`. Grava `gatewayFee` com `feeBasis: 'GATEWAY'` e passa a ter o número
   exato dali para frente, sem quebrar o histórico estimado.

### 8.5 `Budget` — metas (Fase 7, opcional)

```prisma
model Budget {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  month      String   // "YYYY-MM" (BRT)
  // Meta de despesa de uma categoria, OU meta de receita quando categoryId é nulo.
  categoryId String?  @db.ObjectId
  kind       String   // 'REVENUE' | 'EXPENSE'
  amount     Float
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([month, kind, categoryId])
}
```

---

## 9. Arquitetura — backend

```
apps/api/src/lib/
├── date-range.ts            # ESTENDER: from/to explícitos, mês fechado, período anterior
├── period-sales.ts          # NOVO — generaliza buildDaySales para intervalo (V1/V2)
├── gateway-fee.ts           # NOVO — taxa real ou estimada, com feeBasis
├── expense-recurrence.ts    # NOVO — materialização preguiçosa das parcelas
└── dre.ts                   # NOVO — monta a demonstração linha a linha

apps/api/src/modules/
├── admin-expenses/          # NOVO — CRUD de despesa, categoria e recorrência
│   ├── admin-expenses.controller.ts
│   ├── admin-expenses.service.ts
│   ├── admin-expenses.schema.ts      # Zod em packages/shared/src/schemas/expense.ts
│   └── admin-expenses.route.ts
└── admin-financial/         # EXPANDIR (não criar módulo novo)
    ├── admin-financial.service.ts    # já existe — receita
    ├── dre.service.ts                # NOVO
    ├── cashflow.service.ts           # NOVO
    ├── dre-pdf.ts · dre-excel.ts     # padrão de admin-day-sales
    └── admin-financial.route.ts      # + /dre, /cashflow, /expenses-report, /gateway
```

**Endpoints novos:**

| Método | Rota | Entrega |
|---|---|---|
| `GET/POST/PATCH/DELETE` | `/admin/expenses` | CRUD do lançamento (+ `POST /:id/receipt` p/ comprovante) |
| `GET/POST/PATCH/DELETE` | `/admin/expense-categories` | CRUD de categoria |
| `GET/POST/PATCH/DELETE` | `/admin/expense-recurrences` | CRUD de recorrência |
| `GET` | `/admin/expenses/payable` | Contas a pagar (F4) |
| `GET` | `/admin/reports/expenses` | Relatório de despesas (F2) + `/pdf` + `/excel` |
| `GET` | `/admin/financial/dre` | DRE (F3) + `/pdf` + `/excel` |
| `GET` | `/admin/financial/cashflow` | Fluxo de caixa (F5) |
| `GET` | `/admin/financial/gateway` | Conciliação de gateway (F6) |
| `GET` | `/admin/reports/sales` | Vendas por intervalo (V1/V2/V3/V4) + `/pdf` + `/excel` |
| `GET` | `/admin/reports/customers` | Top clientes, LTV, novos × recorrentes (V7/V8) |
| `GET` | `/admin/reports/credit-movement` | Movimentação do passivo (F7) |

**Convenções da casa a respeitar (não são sugestões):**
- `preHandler: [fastify.authenticate]` na rota, **role check ADMIN no controller**.
- **Sem `response` schema** em payload aninhado — o `fast-json-stringify` descarta campos quando o
  schema sai de sincronia (motivo documentado em [admin-reports.route.ts](apps/api/src/modules/admin-reports/admin-reports.route.ts#L10-L11)).
- `round2()` em toda soma de R$ — `Float` acumula drift.
- Zod em `packages/shared/src/schemas/` e re-export no [index.ts](packages/shared/src/index.ts).
- Índice declarável vai **no `schema.prisma`**, nunca em [ensure-indexes.ts](apps/api/src/lib/ensure-indexes.ts)
  (a duplicação quebrou o deploy em 14/08/2026 — `IndexOptionsConflict`).
- `prisma db push` para o Mongo (sem migrations).

---

## 10. Arquitetura — frontend

### 10.1 "Financeiro" vira hub (espelho do que Relatórios já é)

Hoje [AdminFinanceiro.tsx](apps/web/src/pages/admin/gestao/AdminFinanceiro.tsx) é **uma tela só**.
Com DRE + despesas + fluxo de caixa ela não cabe mais. Vira hub, no molde exato de
[AdminRelatorios.tsx](apps/web/src/pages/admin/gestao/AdminRelatorios.tsx):

```
Gestão › Financeiro                         Gestão › Relatórios
├── Receita            (tela atual)         ├── Aquisição & clientes  (4 — existentes)
├── DRE                        F3           ├── Operação & financeiro (4 — existentes)
├── Despesas                   F1           └── Vendas & performance  ← GRUPO NOVO
├── Relatório de despesas      F2               ├── Vendas por período      V1/V2/V3/V4
├── Contas a pagar             F4               ├── Clientes & LTV          V7/V8
├── Fluxo de caixa             F5               └── Sazonalidade            V12
├── Conciliação de gateway     F6
├── Passivo de crédito         F7  (move de Relatórios)
└── Margem                     F8
```

**A linha divisória:** Financeiro = dinheiro (o contador entende). Relatórios = comportamento
(o operador entende). "Passivo de crédito" muda de lado — é linha de balanço, não métrica de
cliente.

### 10.2 Componentes

**Novos (3):**
- `PeriodPicker` — presets (hoje · 7d · este mês · **mês fechado** · trimestre) + intervalo custom
  + toggle "comparar com período anterior". **Substitui `SegmentedControl` nos relatórios** e é a
  peça de UI mais importante do plano.
- `DreTable` — linha, valor, % da receita, Δ vs período anterior; grupos recolhíveis; subtotais em
  negrito; negativo em `var(--color-bad)`.
- `ExpenseForm` — no molde de [FornecedorForm.tsx](apps/web/src/pages/admin/gestao/FornecedorForm.tsx)
  / [MarketProductForm.tsx](apps/web/src/pages/admin/gestao/MarketProductForm.tsx), com upload de
  comprovante reusando [BannerImagePicker](apps/web/src/components/admin/BannerImagePicker.tsx).

**Reusados sem alteração:** `ReportAppBar` · `ReportScroll` · `ReportCard` · `StatRow` ·
`SectionTitle` · `KpiCard` · `BarChart` · `FilterChips` · `ConfirmSheet` · `Toast` ·
`fmtBRL/fmtPct/fmtInt` · `buildCsv/downloadCsv`.

**Sem lib nova de gráfico.** O `BarChart` SVG próprio + barras proporcionais em CSS cobrem tudo o
que este plano precisa, como já cobrem os 8 relatórios atuais.

### 10.3 Exportação

| Formato | Onde | Como |
|---|---|---|
| **CSV** | toda tela | cliente, `lib/csv.ts` (já pronto) |
| **PDF** | DRE · relatório de despesas | servidor, `pdfmake` — padrão [day-sales-pdf.ts](apps/api/src/modules/admin-day-sales/day-sales-pdf.ts) |
| **Excel** | DRE · relatório de despesas · vendas | servidor, `exceljs` — padrão [day-sales-excel.ts](apps/api/src/modules/admin-day-sales/day-sales-excel.ts) |

Formatação compartilhada entre PDF e XLSX num `*-format.ts`, como
[day-sales-format.ts](apps/api/src/modules/admin-day-sales/day-sales-format.ts) — pelo motivo que
o próprio arquivo documenta: senão os dois divergem no primeiro ajuste.

---

## 11. Roadmap por fases

| Fase | Entrega | Destrava | Esforço |
|---|---|---|---|
| **0** ✅ | **Fundação de período** — `date-range.ts` com `from`/`to`, mês fechado e período anterior; `PeriodPicker` no web; migrar os 8 relatórios existentes | 🔓 **tudo** | S |
| **0.5** ✅ | **Painel reformulado — parte 1** (§15) — faixas 0/1/4/6, `GET /admin/dashboard/{alerts,overview}`, correção do comparativo dia-vs-ontem e do `itemsByWeekday` órfão. **Só compõe dado já calculado** | 🔓 visão do negócio | S/M |
| **1** ✅ | **Despesas — registro e gestão** (F1) — `ExpenseCategory` + `Expense` + `ExpenseRecurrence`, seed de categorias, CRUD, comprovante S3, lista com filtros, formulário · **+ ⭐E1 lançamento rápido (escopo firmado) · E2 importação CSV · A4 auditoria** · painel: contas a pagar | 🔓 F2 F3 F4 F5 F9 F10 V15 | **M/L** |
| **2** ✅ | **Relatório de despesas** (F2) — por categoria/grupo/fornecedor, fixo × variável, série mensal, comparativo; CSV + PDF + Excel · **+ A3 custo do gancho · B4 perda de Cestinha** | — | S/M |
| **3** ✅ | **Taxa de gateway & receita líquida** (F6) — `gatewayFee`/`netAmount`/`feeBasis`, Settings de taxa, captura real no webhook, conciliação · **+ B2** | 🔓 linha de dedução do DRE | S/M |
| **4** ✅ | **DRE** (F3) — `lib/dre.ts`, regime caixa + competência com a ponte, CMV pão entregue × perda (§7.2), **correção da receita de gancho** (§4 🚩), tela com comparativo, PDF + Excel · **+ A1 fechamento com snapshot (obrigatório) · D3 pacote do contador** | — | **M/L** |
| **5** ✅ | **Fluxo de caixa & contas a pagar** (F4, F5) — entradas × saídas × saldo acumulado; vencidas/a vencer · **+ B5 compra → conta a pagar · ⭐C1 alertas financeiros** · painel: caixa na Faixa 2 | — | M |
| **6** ✅ | **Vendas & performance** (V1–V4, V6, V7, V9) — `lib/period-sales.ts`, mais vendidos, curva ABC, ticket médio, mix de canal, top clientes/LTV, performance por condomínio · **+ ⭐D1 precificação assistida (escopo firmado)** · painel: mix de canal e atalhos | — | M/L |
| **7** ✅ | **Margem, break-even e metas** (F8, F9, F11) — margem por produto/condomínio, ponto de equilíbrio sobre despesa fixa, `Budget` e realizado × meta · **+ B3 rateio por condomínio · D2 simulador · D4 dashboard consolidado** | — | M |
| **Futuro** | V10 V11 V12 V13 V14 V16 V17 · F10 F12 F13 F14 · A2 validade do crédito · **B1 despesa do entregador automática** (saiu por D6) · D5 metas por condomínio — cards "Em breve" na tela, como o Tier 3 do plano anterior | — | — |

⭐ = **escopo firmado** (as 3 recomendações aprovadas: E1 lançamento rápido · D1 precificação
assistida · C1 alertas financeiros). O C2 original (widget financeiro no painel) foi **promovido à
reformulação completa do §15** e entra como Fase 0.5.

**Fases 0 → 1 → 4 são o caminho crítico do pedido.** Fase 2 pode rodar em paralelo com a 3.
Fase 6 (vendas) é independente das fases 1–5 e pode ser antecipada se a prioridade virar —
**recomendo não antecipar**: o que o negócio não tem hoje é visão de despesa, não de venda.

> **Sugestão de corte para a primeira entrega:** Fases 0 + 0.5 + 1 + 3 + 4 = **painel completo com
> visão ponta a ponta + DRE funcionando com despesas reais.** É o menor recorte que responde ao
> pedido inteiro. Fase 2 é praticamente de graça em cima da 1, e a Fase 0.5 entrega valor visível
> antes de qualquer linha de despesa existir.

---

## 12. Decisões — registro

> **12/12 decididas em 2026-09-21.** ✅ = no recomendado · ⚠️ = divergiu da recomendação (e o plano
> foi reescrito para a escolha, não para a recomendação).

### ✅ D1 · Regime do DRE — **DECIDIDA (2026-09-21): o recomendado**

**Decisão: os dois regimes, CAIXA como padrão, com a ponte de §7.3 sempre visível.**

| Item | Definição |
|---|---|
| **Padrão da tela** | **Caixa** — receita reconhecida no `Payment` PAID, despesa no `Expense.paidAt` |
| **Alternativa** | **Competência** via toggle — receita reconhecida no consumo do crédito (`CreditTransaction` DELIVERY × preço médio do período) e na entrega da Cestinha; despesa por `Expense.competenceDate` |
| **Ponte** | Sempre visível ao pé do DRE: `Resultado (competência) ± Δ passivo de crédito ± despesas a pagar ± compras a pagar = Caixa gerado` |
| **Rótulo obrigatório** | O cabeçalho do DRE **declara o regime em uso**. Um DRE sem regime declarado mente por omissão |
| **Exportação** | PDF e XLSX carregam o regime no cabeçalho e na primeira aba |

**Por quê:** caixa é o número que o dono reconcilia com o extrato e é o que ele **já vê hoje** —
mudar o padrão para competência alteraria todos os números conhecidos sem aviso. Competência é o que
responde "o mês deu lucro?" e o que o contador pede. A ponte impede a pergunta inevitável —
*"por que os dois números são diferentes?"* — de virar desconfiança no relatório.

**Consequências no plano:** `lib/dre.ts` nasce com `regime: 'cash' | 'accrual'` como parâmetro de
primeira classe (não um acréscimo depois); `GET /admin/financial/dre` aceita `?regime=`, com `cash`
como default; a Faixa 2 do painel (§15.3) usa **caixa**, sem toggle — painel é leitura rápida, não
análise contábil.

### ✅ Decisões 2 a 12 — **todas decididas (2026-09-21)**

| # | Decisão | Escolha | Onde entra |
|---|---|---|---|
| **2** | **CMV do pão** | ⚠️ **Pão COMPRADO no período** — *divergiu da recomendação* | §7.2 reescrito · `purchases.breadCost` · nota de rodapé obrigatória no DRE |
| **3** | **Taxa de gateway** | ✅ **Estimar por `Setting` + capturar real no webhook**, com `feeBasis` declarando a base | §8.4 · Fase 3 |
| **4** | **Categorias de despesa** | ✅ **Tabela `ExpenseCategory`** com ~16 seeds; `ExpenseGroup` amarra a linha do DRE | §8.1 · Fase 1 |
| **5** | **Centro de custo** | ✅ **`condominiumId` opcional** no lançamento; sem ele, rateio automático por pães entregues (B3) | §8.2 · Fase 1 / Fase 7 |
| **6** | **Pessoal** | ✅ **Despesa comum no grupo `PEOPLE`** — sem folha, sem encargo calculado | §8.1 · Fase 1. **B1 (geração automática) sai do escopo firmado** e volta para backlog |
| **7** | **Receita de gancho** | ✅ **Entra na receita bruta**, em linha própria | §4 🚩 · §7.1 · Fase 4 — **comunicar que a receita total vai subir** |
| **8** | **Navegação** | ✅ **Financeiro vira hub** (9 itens); Vendas como grupo novo em Relatórios; Passivo migra para Financeiro | §10.1 |
| **9** | **Impostos** | ✅ **Só registrar**, grupo `TAXES`, com guia anexada e recorrência mensal. **Sem cálculo de tributo** | §8.1 · Fase 1 |
| **10** | **Estoque** | ✅ **Só posição patrimonial** (Faixa 6 do painel), fora do resultado. CMV = custo do vendido | §15.3 Faixa 6 |
| **11** | **Recorrências** | ✅ **Materialização preguiçosa** ao abrir o mês, travada por `@@unique([recurrenceId, recurrenceMonth])`, valor editável, nasce `PENDING` | §8.3 · Fase 1 |
| **12** | **Permissão do financeiro** | ✅ **Fora da v1** — todo `ADMIN` vê tudo, como hoje. Risco registrado | §13 (risco) |

#### ⚠️ Nota sobre a decisão 2 (a única fora do recomendado)

A escolha tem defesa técnica real e o plano foi reescrito para ela, não para a recomendação:
`PurchaseOrderItem.unitPrice` é **custo pago de fato** (não média derivada), e o pão é
`stockType: DAILY` comprado por demanda confirmada do turno — compra e entrega são o mesmo dia, então
a distorção é pequena por construção. **Contrapartida aceita:** o desperdício de pão não vira linha
do DRE; fica em [RelDesperdicio](apps/web/src/pages/admin/gestao/RelDesperdicio.tsx), com nota de
rodapé e link no DRE. Detalhe completo em §7.2.

#### Ajustes de escopo decorrentes

- **B1 (despesa do entregador gerada da operação)** sai do escopo firmado da Fase 7 → **backlog**.
  A decisão 6 optou por lançamento manual, e gerar automático exigiria definir regra de pagamento
  (por parada / por dia / fixo) que ainda não existe no cadastro de entregador.
- **A linha de perdas do DRE muda de rótulo** para **"Perdas de item"** — cobre Cestinha não
  entregue resolvida como perda, não sobra de pão.
- **O DRE ganha nota de rodapé obrigatória** declarando a base do CMV do pão, com link para o
  relatório de desperdício.

---

## 13. Riscos e armadilhas (as do projeto, já pagas uma vez)

| Risco | Por que morde | Mitigação |
|---|---|---|
| **Mongo: `null` × chave ausente** | `where: { campo: null }` **não encontra** documento onde a chave nunca existiu. Já documentado em `Condominium.*Override`, `Product.isPaused`, `User.creditMilli`. | Campo novo é nullable e resolvido **em código** (`?? default`). Nunca filtrar por `null`. |
| **`Float` em dinheiro** | `0.1 + 0.2 = 0.30000000000000004`. O DRE soma dezenas de linhas — o erro aparece no total. | `round2()` em toda soma, como `admin-financial.service.ts` já faz. |
| **`fast-json-stringify` engolindo campos** | Payload do DRE é todo aninhado; schema fora de sincronia **descarta em silêncio**. | **Sem `response` schema** nas rotas novas — regra já escrita em `admin-reports.route.ts`. |
| **Índice duplicado** | Duplicar índice do schema em `ensure-indexes.ts` derrubou o deploy em 14/08/2026 (`IndexOptionsConflict`). | Índice declarável fica **só** no `schema.prisma`. |
| **Competência em UTC** | Despesa de 31/08 23h BRT = 01/09 02h UTC → cai no mês errado. | Competência sempre BRT, via o `date-range.ts` estendido. Cobrir com teste de virada de mês. |
| **Somar GMV à receita** | A Cestinha paga em pãezinhos **já foi faturada** na compra do combo. Somar conta a mesma nota duas vezes (D-2). | O DRE consome `market.revenue`, **nunca** `market.gmv`. Testar que `dre.receitaBruta ≠ f(gmv)`. |
| **`MARKET_REFUND` virar despesa** | Estorno devolve crédito ao cliente — é redução de receita/passivo, não saída de caixa. | Tratar em **deduções** e na movimentação do passivo (F7), jamais em `Expense`. |
| **Recorrência duplicada** | Aluguel lançado duas vezes em agosto = DRE errado e ninguém percebe. | `@@unique([recurrenceId, recurrenceMonth])` — a trava é no banco, não na aplicação. |
| **Comprovante sem S3 configurado** | `lib/storage.ts` sobe sem as envs e **só falha no upload**. | `isStorageConfigured()` esconde o campo de comprovante — o lançamento nunca depende do anexo. |
| **Migrar os 8 relatórios na Fase 0** | Trocar `SegmentedControl` por `PeriodPicker` toca 8 telas que hoje funcionam. | Manter `period=day|week|month` aceito na API (retrocompatível) e migrar tela por tela. |

---

## 14. Funcionalidades ligadas — recomendações

> Não são relatórios: são funcionalidades que o módulo financeiro **puxa atrás de si**. Priorizadas
> por "quanto isso muda a decisão do dono" ÷ "quanto custa", e todas ancoradas em peça que **já
> existe** no projeto.

### 🔴 A. Confiabilidade do número — o que faz o DRE parar de mentir (P0)

#### A1 · Fechamento de mês com snapshot 🚩 **achado**

`market.cmv` sai de [loadUnitCosts()](apps/api/src/lib/product-cost.ts), que lê
`SupplierProduct.unitCost` **de agora** — a função não tem parâmetro de data. Consequência:

> **O DRE de agosto muda sozinho quando o fornecedor subir o preço em setembro.**

Um relatório financeiro que dá número diferente a cada consulta não serve para decidir nem para
entregar ao contador. (A outra metade já está certa: `PurchaseOrderItem.unitPrice` é snapshot do
custo pago — o problema é só do CMV do mercadinho.)

```prisma
model FinancialClose {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  month      String   @unique // "YYYY-MM" (BRT)
  closedAt   DateTime
  closedById String   @db.ObjectId
  // DRE congelado do mês — o número que foi ao contador, imutável. Depois de fechado, a tela
  // lê AQUI, nunca recalcula: é o que torna o relatório auditável.
  snapshot   Json
  notes      String?
}
```

Mês fechado bloqueia lançamento retroativo (ou exige reabertura explícita, com registro de quem
reabriu). **Esforço: S. Entra na Fase 4 — sem ele o DRE não é confiável.**

#### A2 · Política de validade do crédito 🚩 **achado**

`TransactionType.EXPIRY` está declarado no enum e **nunca é escrito em runtime** — o grep só acha a
string em descrição de Swagger. Ou seja: **crédito não expira, e o passivo cresce para sempre.**

Isso não é bug de relatório, é decisão de negócio com impacto direto de balanço: o cliente que
comprou 30 pães em 2026 e sumiu segue como dívida em pão no `getCreditLiability()` indefinidamente.
As opções são política, não código — expirar em N meses (precisa de aviso ao cliente e provavelmente
não passa no CDC sem cuidado), reconhecer como receita após inatividade prolongada (baixa contábil,
mantendo a obrigação comercial), ou assumir o passivo perpétuo e **declarar isso no DRE**.

**Recomendação: assumir o passivo perpétuo na v1 e exibir o "passivo de crédito inativo há mais de
12 meses" como recorte em F7.** Nomear o problema já resolve 80% dele; a política pode vir depois.
**Esforço: S (só o recorte). Decisão: do dono.**

#### A3 · Custo do gancho de porta 🚩 **achado**

Existe `Setting ganchoPreco` (R$ 5,00 — o que se **cobra** pelo extra). **Não existe `ganchoCusto`.**
Mas `HookRequest.type` separa `FREE` / `PAID` / `BONUS` e `deliveredAt` diz quando saiu.

Logo, com **um Setting novo**, o CAC fica exatamente calculável:

```
Custo de aquisição via gancho = count(HookRequest FREE + BONUS, deliveredAt no período) × ganchoCusto
```

É a primeira parcela de CAC real do produto, e hoje é um custo invisível que sai do bolso em cada
cliente novo. **Esforço: XS. Alto valor.**

#### A4 · Auditoria de lançamento

Valor de despesa editado depois do fechamento é o vetor clássico de número que não bate. Campos
`updatedById` + coleção leve de log (ou o padrão de [AdminNote](apps/api/prisma/schema.prisma))
registrando valor anterior → novo. **Esforço: XS.**

### 🟠 B. Automações que ligam operação → financeiro (dado já existe) (P1)

| # | Funcionalidade | Peça que já existe | Esforço |
|---|---|---|---|
| B1 | ~~**Despesa do entregador gerada da operação**~~ — **movida para backlog pela decisão 6** (§12): o lançamento é manual, e o automático exigiria regra de pagamento (por parada / por dia / fixo) que não existe no cadastro de entregador | `DeliveryList.courierId` · `Order.courierId` · `MarketOrder.courierId` | — |
| B2 | **Taxa de gateway lançada sozinha** — a dedução do DRE sai do `Payment`, sem lançamento manual | Fase 3 | — |
| B3 | **Rateio de despesa indireta por condomínio** — driver = pães entregues no período; destrava rentabilidade por condomínio (F14) sem exigir centro de custo em tudo | `getCondominiumRanking().breadsDelivered` | S |
| B4 | **Perda de Cestinha → linha de perda automática** | `MarketOrder.lossResolvedAt` + `stockReturned: false` + `getWasteReport().items.lostValue` (**já calculado**) | XS |
| B5 | **Compra ao fornecedor → conta a pagar** — `PurchaseOrder` FINALIZED abre um `PENDING` no contas a pagar em vez de virar saída de caixa na hora | `PurchaseOrder`/`PurchaseOrderItem` | S |

> B4 é o melhor custo-benefício do plano inteiro: o número **já está computado** em
> `getWasteReport()` e só não aparece em nenhuma demonstração financeira.

### 🟠 C. Alertas e proatividade — a infra está pronta (P1)

O projeto já tem `NotificationType` com 10 tipos `ADMIN_*`, toggle individual por tipo em
`User.adminNotificationPrefs`, push OneSignal ([lib/push.ts](apps/api/src/lib/push.ts)) e
[AdminNotificacoes.tsx](apps/web/src/pages/admin/gestao/AdminNotificacoes.tsx) para ligar/desligar.
**Adicionar um aviso financeiro é acrescentar um valor ao enum e um disparo** — o encanamento inteiro
já existe:

| Tipo novo | Dispara quando | Valor |
|---|---|---|
| `ADMIN_EXPENSE_DUE` | conta vence amanhã / venceu | evita multa e juros |
| `ADMIN_EXPENSE_ANOMALY` | categoria ≥ 40% acima da média de 3 meses | pega vazamento cedo |
| `ADMIN_MARGIN_DROP` | margem bruta cai X p.p. vs período anterior | o alerta mais importante |
| `ADMIN_RESULT_NEGATIVE` | resultado do mês vira negativo em curso | tempo de reagir |
| `ADMIN_GOAL_AT_RISK` | receita abaixo do ritmo da meta (com Fase 7) | gestão comercial |

**C2 · Widget financeiro no Painel.** [AdminPainel.tsx](apps/web/src/pages/admin/tabs/AdminPainel.tsx)
é a tela que o dono abre todo dia e hoje mostra só receita do dia. Um cartão com **resultado do mês ·
contas a pagar da semana · margem** põe o financeiro no caminho natural, em vez de escondido em
Gestão › Financeiro › DRE. **Esforço: S. Faz o módulo ser usado.**

### 🟡 D. Gestão e decisão — onde está o valor de negócio (P1/P2)

**D1 · Precificação assistida** — o admin define `Combo.price`, `avulsoUnit` e `Product.price`
**sem ver a margem**. Com `loadUnitCosts()` já pronto, o formulário pode mostrar ao vivo: custo
unitário, margem em R$ e %, e aviso quando a margem cai abaixo de um piso. Vale para
[ComboForm](apps/web/src/pages/admin/gestao/ComboForm.tsx),
[MarketProductForm](apps/web/src/pages/admin/gestao/MarketProductForm.tsx) e a tela de compra
personalizada. **É a funcionalidade com maior impacto por linha de código deste documento** — margem
se perde no cadastro, não no relatório. **Esforço: S/M.**

**D2 · Simulador de cenário** — "se o pão subir R$ 0,05, o que acontece com o lucro?" · "quantos
pães/dia pagam a operação?" · "vale entrar no condomínio X?". Sobre o break-even (F9) e a margem de
contribuição, é uma tela de inputs sem persistência. **Esforço: S** depois da Fase 7.

**D3 · Pacote do contador** — ZIP mensal: DRE em PDF + razão de despesas em XLSX + comprovantes
anexados. `pdfmake`, `exceljs` e S3 já estão no projeto. **Esforço: S. Valor prático alto todo mês.**

**D4 · Dashboard financeiro consolidado** — uma tela com receita, despesa, resultado, margem, caixa,
passivo de crédito e contas a pagar, cada um com faixa de 6 meses no `BarChart`. Diferente do DRE:
o DRE é o detalhe de um mês, este é a **tendência**. **Esforço: S** (consome os endpoints das outras fases).

**D5 · Metas por categoria e por condomínio** — extensão natural do `Budget` (§8.5).

### 🟢 E. Entrada de dados — o que decide se o módulo vive ou morre (P1)

Módulo de despesa morre por **atrito de lançamento**, não por falta de relatório. Três funcionalidades
baratas que mudam a adoção:

| # | Funcionalidade | Por quê |
|---|---|---|
| E1 | **Lançamento rápido (3 toques)** — valor + categoria + foto do comprovante, direto do celular | É PWA. O dono lança o combustível **no posto**, não em casa à noite (quando ele não lança) |
| E2 | **Importação CSV de despesas** | Backfill do histórico — sem meses anteriores, não há comparativo nem média, e o DRE nasce sem contexto |
| E3 | **Duplicar lançamento** | A despesa repetida que não vale uma recorrência |
| E4 | **Marcar como conciliado** | Fecha o ciclo contra o extrato sem construir conciliação bancária de verdade |

**E1 e E2 deveriam entrar na própria Fase 1**, não depois: são o que faz a Fase 1 gerar dado.

### ⚪ F. Fora de escopo — registrado para não virar expectativa

| Item | Motivo |
|---|---|
| **Emissão de NF-e / NFS-e** | Integração fiscal é projeto próprio, com certificado digital e homologação |
| **Folha de pagamento com encargos** | Não é ERP; entregador entra como despesa no grupo `PEOPLE` |
| **Cálculo de imposto (Simples/MEI)** | Responsabilidade do contador; calcular errado é pior que não calcular |
| **CMV por lote** | Exige rastreio de lote que não existe — [product-cost.ts](apps/api/src/lib/product-cost.ts) já documenta e assume a aproximação |
| **Depreciação de ativo** | Volume não paga a complexidade (avaliar se houver veículo próprio) |
| **Contas a receber** | **Não se aplica** — o modelo é pré-pago, não existe fiado |
| **Custo de OTP por canal** (card "Em breve" atual) | **Obsoleto**: o OTP hoje é só e-mail (`channel: 'email'`), o SMS saiu. **Remover o card da tela** — ele promete relatório de um custo que não existe mais |

---

## 15. Reformulação do Painel — visão ponta a ponta do negócio

> **Escopo firmado.** A recomendação C2 (widget financeiro) foi **absorvida por esta seção**: em vez
> de pendurar um cartão no painel atual, o painel é reformulado para ser a visão completa do negócio.

### 15.1 O que o Painel é hoje

[AdminPainel.tsx](apps/web/src/pages/admin/tabs/AdminPainel.tsx) · `GET /admin/dashboard`
([admin-orders.service.ts:602](apps/api/src/modules/admin-orders/admin-orders.service.ts#L602))

```
[alerta] pedidos parados                          ← único alerta do painel
┌─────────────────┬─────────────────┐
│ A entregar hoje │ Receita do dia  │
│ Clientes        │ Condomínios     │             ← grade 2×2
└─────────────────┴─────────────────┘
[card] Pedido de amanhã · corte · N pães
[card] Fornadas por dia          (BarChart, semana corrente)
[card] Receita por tipo · hoje   (combos × avulso)
```

### 15.2 Diagnóstico — 8 problemas, 3 deles bugs

| # | Problema | Consequência |
|---|---|---|
| 1 | **Tudo é "hoje"** — não há seletor de período em lugar nenhum do painel | O dono **não consegue ver o mês** na tela que ele abre todo dia. Esta é a falha principal |
| 2 | **Nenhuma linha de resultado** — só receita, nunca custo, margem ou lucro | O painel responde "quanto entrou", jamais "o mês está dando lucro" |
| 3 | **Só operação** — nada de retenção, churn, passivo, crescimento | Visão de um turno, não do negócio |
| 4 | **KPI morto ocupando 25% da grade** — "Condomínios" é número quase constante | Espaço nobre gasto com dado que não muda e não gera decisão |
| 5 | 🚩 **`itemsByWeekday` é órfão** — a API calcula, declara no `response` schema e **o front nunca lê** | A Cestinha é invisível no gráfico semanal; trabalho de agregação jogado fora a cada carga |
| 6 | 🚩 **Comparativo dia-vs-ontem** — `breadsTodayTrendPct` e `revenueTrendPct` comparam hoje com ontem | É a comparação **mais ruidosa possível**: segunda × domingo dá −60% e não significa nada |
| 7 | **Alertas espalhados** — parados no painel, ganchos pendentes só em Gestão, `ADMIN_LOW_STOCK` só em push, Cestinha sem desfecho sem superfície | Não existe "o que preciso resolver agora" |
| 8 | 🚩 **A rota tem `response` schema** — payload aninhado com allowlist | Campo novo aninhado é **descartado em silêncio** pelo `fast-json-stringify` — exatamente o risco que [admin-reports.route.ts](apps/api/src/modules/admin-reports/admin-reports.route.ts#L10-L11) documenta ter custado caro |
| — | **Becos sem saída** — 8 relatórios existem e o painel não leva a nenhum | O que foi construído não é encontrado |

### 15.3 O Painel reformulado — 7 faixas

```
╔═ FAIXA 0 · CENTRAL DE ALERTAS ═════════════════════════════╗
║  só aparece o que exige ação, ordenado por urgência        ║
╚════════════════════════════════════════════════════════════╝
╔═ FAIXA 1 · PERÍODO ════════════════════════════════════════╗
║  [ Hoje | 7 dias | Este mês | Mês fechado ]  □ comparar    ║
╚════════════════════════════════════════════════════════════╝
╔═ FAIXA 2 · RESULTADO ══════════════╗ ╔═ FAIXA 3 · HOJE ════╗
║ Receita consolidada      Δ%        ║ ║ A entregar  · pães  ║
║ Resultado (lucro/prej.)  Δ%        ║ ║ Pedido de amanhã    ║
║ Margem bruta %           Δpp       ║ ║ Taxa de entrega     ║
║ Caixa (entradas−saídas)            ║ ║ Paradas · clientes  ║
╚════════════════════════════════════╝ ╚═════════════════════╝
╔═ FAIXA 4 · BASE E CRESCIMENTO ═════════════════════════════╗
║ Clientes ativos · Novos · Em risco · Recarga automática    ║
╚════════════════════════════════════════════════════════════╝
╔═ FAIXA 5 · GRÁFICOS ═══════════════════════════════════════╗
║ Volume por dia (pães + itens) · Receita no período ·        ║
║ Mix de canal (combo/avulso/Cestinha/gancho)                 ║
╚════════════════════════════════════════════════════════════╝
╔═ FAIXA 6 · POSIÇÃO ════════════════════════════════════════╗
║ Passivo de crédito · Estoque a custo · Contas a pagar      ║
╚════════════════════════════════════════════════════════════╝
╔═ FAIXA 7 · ATALHOS ════════════════════════════════════════╗
║ leva ao relatório que explica o número acima                ║
╚════════════════════════════════════════════════════════════╝
```

#### Faixa 0 · Central de alertas — "o que resolver agora"

| Alerta | Fonte | Existe? |
|---|---|---|
| Pedidos parados (data passada sem desfecho) | `stuckCount` | ✅ já no painel |
| Ganchos aguardando entrega | `GET /admin/hook-requests/summary` | ✅ hoje só como badge em [AdminGestao](apps/web/src/pages/admin/tabs/AdminGestao.tsx#L87) |
| Cestinha não entregue **sem desfecho de perda** | `MarketOrder.lossResolvedAt: null` + status `NOT_DELIVERED` | ✅ dado existe |
| Produto com estoque baixo / esgotado | `Product.stock` · `ProductDailyStock` · `ADMIN_LOW_STOCK` | ✅ hoje só em push |
| Corte se aproximando sem pedido gerado | `deliverySlots.cutoffTime` × `PurchaseOrder` do dia | 〰️ derivável |
| Pagamentos falhos recuperáveis | `Payment` FAILED recentes | ✅ dado existe |
| **Contas a pagar vencendo / vencidas** | `Expense` `dueDate` + `status: PENDING` | ⚙️ Fase 1 |
| **Margem em queda · resultado negativo** | `lib/dre.ts` | ⚙️ Fase 4 |

Cada alerta é um **deep-link**, no padrão que o painel já usa para pedidos parados
(`onNavigate('entregas', { segment: 'historico', filter: 'parados' })`). Faixa vazia = nenhum
cartão, nem placeholder — ausência de alerta é a informação.

#### Faixa 2 · Resultado — as 4 linhas que faltam

| KPI | Fonte | Fase |
|---|---|---|
| **Receita consolidada** no período, Δ vs período anterior | `getRevenue()` + gancho corrigido (§4 🚩) | 0 |
| **Resultado do período** (lucro/prejuízo em R$) | `lib/dre.ts` | 4 |
| **Margem bruta %**, Δ em pontos percentuais | `lib/dre.ts` | 4 |
| **Caixa do período** (entradas − saídas) | `cashflow.service.ts` | 5 |

Antes da Fase 4 a faixa mostra **só a receita** — não um "R$ 0,00" que parece prejuízo, nem
um esqueleto de KPI vazio.

#### Faixa 3 · Operação — mantida, com duas correções

Preserva o que funciona (a entregar hoje, pedido de amanhã com corte) e conserta os problemas 5 e 6:
volume passa a mostrar **pães e itens** (consome o `itemsByWeekday` órfão) e o comparativo deixa de
ser dia-vs-ontem — passa a ser **período vs período anterior equivalente**, ou **mesmo dia da semana
anterior** quando o período é "hoje". Segunda compara com segunda.

#### Faixa 4 · Base e crescimento — tudo já calculado, nada exposto

| KPI | Fonte | Observação |
|---|---|---|
| **Clientes ativos** (agenda ativa ou pedido em 30d) | `retention.autoRecharge.activeClients` | **Substitui "Clientes"**: o total cadastrado só cresce e não informa |
| Novos no período | `clientsNewCount` | ✅ já vem (hoje fixo em 7 dias) |
| **Em risco de churn** (saldo zerado sem recarga) | `retention.credit.atRisk` | ✅ **já calculado, nunca exibido no painel** |
| **Recarga automática** (% de adoção) | `retention.autoRecharge.rate` | ✅ maior alavanca de retenção do modelo |

> "Condomínios" (problema 4) sai da grade e vira linha de contexto no cabeçalho.

#### Faixa 6 · Posição — o balanço em três números

| KPI | Fonte | Fase |
|---|---|---|
| **Passivo de crédito** — quanto se deve em pão | `getCreditLiability()` ✅ pronto | 0 |
| **Estoque a custo** | `Product.stock` × `loadUnitCosts()` ✅ ambos prontos | 0 |
| **Contas a pagar** | `Expense` PENDING | 1 |

### 15.4 Arquitetura — dividir o endpoint (não engordar)

Empilhar 20 métricas em `GET /admin/dashboard` tem dois defeitos concretos: o `response` schema da
rota descarta campo aninhado em silêncio (problema 8), e a primeira pintura da tela fica **refém da
agregação mais lenta**.

```
GET /admin/dashboard                  # MANTIDO intocado — operação. Retrocompatível.
GET /admin/dashboard/alerts           # NOVO — Faixa 0. Só contagens, barato, sem cache.
GET /admin/dashboard/overview?from&to # NOVO — Faixas 2/4/5/6. Pesado, com cache.
```

- Três requisições em paralelo, **renderização progressiva**: operação pinta primeiro (é o que o
  painel já faz hoje), resultado e posição chegam depois sem travar a tela.
- **Sem `response` schema** nas duas rotas novas — regra da casa para payload aninhado.
- **Cache TTL em memória (30–60 s)** no `overview`. Não uma coleção materializada: o painel é aberto
  por 1–2 admins repetidamente, um TTL curto resolve e não cria mais um estado para dessincronizar
  (`MaterializedCycle` existe porque o corte **precisa** de durabilidade; um painel não).
- `overview` **reusa** `AdminFinancialService`, `AdminReportsService` e `lib/dre.ts` — zero
  agregação nova. O painel é uma **composição** dos relatórios, não uma segunda implementação deles.
  É o que garante que painel e relatório nunca mostrem números diferentes.

### 15.5 Frontend

- `AdminPainel.tsx` vira **composição de faixas**, cada faixa um componente próprio
  (`PainelAlertas`, `PainelResultado`, `PainelOperacao`, `PainelBase`, `PainelGraficos`,
  `PainelPosicao`) — a tela hoje é um arquivo de ~600 linhas com estilo inline; 7 faixas no mesmo
  arquivo ficariam ilegíveis.
- Reusa `PeriodPicker` (Fase 0), `KpiCard`, `BarChart`, `Icon` e o padrão de deep-link já existente.
- **Sem lib de gráfico nova.**
- Cada faixa tolera a sua fonte faltando: um endpoint que falha esconde a faixa em vez de derrubar
  o painel — o [AdminPainel](apps/web/src/pages/admin/tabs/AdminPainel.tsx#L71) já falha em silêncio
  hoje, o comportamento só passa a ser por faixa.

### 15.6 Entrega faseada (o painel acompanha as fases, não espera por elas)

| Quando | O painel ganha |
|---|---|
| **Fase 0** | Faixa 1 (período + comparativo correto) · Faixa 0 com os 6 alertas que já existem · Faixa 4 completa · Faixa 6 sem contas a pagar · correção do `itemsByWeekday` · saída do KPI "Condomínios" |
| **Fase 1** | Contas a pagar na Faixa 6 · alerta de vencimento na Faixa 0 |
| **Fase 4** | Resultado e margem na Faixa 2 · alerta de margem/resultado negativo |
| **Fase 5** | Caixa na Faixa 2 |
| **Fase 6** | Mix de canal e atalhos de venda na Faixa 5/7 |

> **A maior parte do valor do painel sai na Fase 0** — faixas 0, 1, 4 e 6 são composição de dado
> que **já está calculado** e hoje não aparece na tela. É o melhor custo-benefício do plano inteiro,
> e não depende do módulo de despesas.

---

## 16. Resumo executivo

- **A infraestrutura de relatório está pronta.** 8 relatórios, receita completa, CSV/PDF/Excel,
  gráficos próprios, CMV e margem da Cestinha. Nada disso precisa ser reescrito.
- **O que falta é o outro lado do caixa.** Zero conceito de despesa no sistema. Este é o trabalho
  real, e é ele que destrava DRE, fluxo de caixa, break-even, custo por entrega e CAC/LTV.
- **Três buracos menores bloqueiam o DRE junto com ele:** taxa de gateway não gravada, ausência de
  mês fechado/intervalo livre, e o regime contábil nunca decidido.
- **Caminho crítico: Fases 0 → 1 → 3 → 4.** No fim delas existe DRE de verdade, com despesa real,
  receita líquida de taxa e os dois regimes reconciliados.
- **A frente de vendas (Fase 6) é sobretudo generalização** de `lib/day-sales.ts` de um dia para um
  intervalo — alto valor, esforço médio, independente das outras fases.

### 🚩 Quatro achados do levantamento (nenhum é "falta de relatório")

| Achado | Onde | Impacto |
|---|---|---|
| **Receita de gancho pago é invisível** — `excludeNonCreditPurpose` tira `HOOK` de tudo e, ao contrário de `MARKET`, ele nunca volta | [revenue.ts](apps/api/src/lib/revenue.ts) · [admin-financial.service.ts](apps/api/src/modules/admin-financial/admin-financial.service.ts) | receita real subfaturada no admin (§4) |
| **DRE de mês passado muda sozinho** — `loadUnitCosts()` lê o custo de fornecimento **de agora**, sem dimensão histórica | [product-cost.ts](apps/api/src/lib/product-cost.ts) | sem snapshot de fechamento o relatório não é auditável (§14 A1) |
| **Crédito nunca expira** — `TransactionType.EXPIRY` está no enum e **jamais é escrito** em runtime | [schema.prisma](apps/api/prisma/schema.prisma) | passivo de crédito cresce indefinidamente (§14 A2) |
| **Custo do gancho grátis não existe** — há `ganchoPreco` (receita), não há `ganchoCusto` | [gancho-config.ts](apps/api/src/lib/gancho-config.ts) | CAC exato, calculável com 1 Setting, hoje invisível (§14 A3) |

### As 3 funcionalidades de maior retorno por esforço

1. **D1 · Precificação assistida** — margem ao vivo no cadastro de combo/produto. `loadUnitCosts()`
   já existe e hoje o preço é definido às cegas. **Margem se perde no cadastro, não no relatório.**
2. **E1 · Lançamento rápido de despesa** (valor + categoria + foto, no celular, no posto) — é o que
   decide se a Fase 1 gera dado ou vira tela vazia.
3. **C2 · Widget financeiro no Painel** — põe resultado do mês e contas a pagar na tela que o dono
   já abre todo dia, em vez de três níveis abaixo em Gestão.
