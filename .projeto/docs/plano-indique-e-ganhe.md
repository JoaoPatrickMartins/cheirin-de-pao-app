# Plano — Indique e Ganhe

> 📝 **Status:** IMPLEMENTADO (Ondas 0–9) e **UAT concluído** em 29/09/2026, **sem commit**. Planejado em
> 28/09/2026; execução direta, sem GSD (decisão do usuário — D-6).
>
> ✅ **Onda 0 (correções prévias) CONCLUÍDA** em 28/09/2026 — **SEM COMMIT**, branch
> `feat/add-complementocliente`. Crédito em dobro, bloqueio, OTP duplicado e IP real no rate
> limit. Verificação: typecheck (api + web) ✅ · **1.467 testes do api passando + 3 todo** (+16) ·
> **246 do web passando + 17 todo**. Detalhes em §10.
>
> ✅ **Onda 1 (design) CONCLUÍDA** em 28/09/2026 — handoff do Claude Design salvo em
> [`.projeto/design_handoff_indique_e_ganhe/`](../design_handoff_indique_e_ganhe/README.md) e
> conferido contra este plano (§11). Tudo o que o handoff mudou ou acrescentou já está incorporado.
>
> ✅ **Onda 2 (fundação) CONCLUÍDA** em 28/09/2026 — **SEM COMMIT**. Schema (`Referral`,
> `ReferralMilestone`, `CondoInterest`, campos no `User`, tipos novos), índice parcial de
> `referralCode`, seeds `indicacao*`, `lib/referral-config`, `lib/referral-code`, `lib/tx-retry` e
> `packages/shared/src/referral.ts`. `prisma generate` rodado; **`db push` não** (o deploy roda).
> Verificação: typecheck (api + web + shared) ✅ · **1.502 testes do api passando + 3 todo** (+35) ·
> **246 do web passando + 17 todo** · shared 74 + 4 todo (+16). Detalhes em §10.
>
> ✅ **Onda 3 (cadastro e vínculo) CONCLUÍDA** em 28/09/2026 — **SEM COMMIT**. `RegisterSchema` +
> rota com `referralCode`/`referralSource`, `attachReferralAtSignup`, `markReferralVerified` nos 3
> logins (não no refresh) com `REFERRAL_SIGNUP`, módulo `referrals` com `GET /referrals/config` e
> `GET /referrals/code/:code` (10/min). Verificação: typecheck (api + web) ✅ · **1.530 testes do api
> passando + 3 todo** (+28) · **246 do web passando + 17 todo**.
>
> ✅ **Onda 4 (qualificação e recompensa) CONCLUÍDA** em 28/09/2026 — **SEM COMMIT**.
> `qualifyReferral` + sinais + `rewardReferral` (trava por status + retry) + metas por posição +
> convite + `afterDelivery` nos 4 pontos + `sweepReferrals` no `daily-jobs` + comemoração; rotas
> `summary`, `me`, `celebration/seen`, `home-card/dismiss`; `DEFAULT_OFF` das prefs do admin.
> Verificação: typecheck (api + web) ✅ · **1.591 testes do api passando + 3 todo** (+61) ·
> **246 do web passando + 17 todo**.
>
> ✅ **Onda 5 (telas do cliente) CONCLUÍDA** em 28/09/2026 — **SEM COMMIT**. Base visual (token
> `warn-soft`, 6 ícones, `cdp-spin`), kit `components/client/referral/`, C1 `ReferralScreen`, C2
> (Perfil), C3 (card da Home), C4 (código no cadastro), C5 (comemoração + fila de overlays), C6
> (central — tipos novos + visual D-17), C7 (extrato — visual D-17), captura do `?ref=`, rota e
> destino de banner. Verificação: typecheck (api + web + shared) ✅ · **1.591 do api + 3 todo** ·
> **306 do web passando + 17 todo** (+60) · shared 74 + 4 todo.
>
> 🗄️ **Banco de teste sincronizado** em 29/09/2026: o `DATABASE_URL` local é `cheirin-de-pao-teste`
> (não é produção) e o usuário liberou `prisma db push` nele. Rodado sem `--accept-data-loss`:
> coleções `Referral`, `ReferralMilestone`, `CondoInterest` e seus índices criados; o índice
> parcial `User.referralCode_1` (`$type: 'string'`) aceito pelo Atlas via `ensureIndexes`.
>
> ✅ **Onda 6 (admin) CONCLUÍDA** em 29/09/2026 — **SEM COMMIT**. API: `rejectReferral`,
> `GET/PATCH /admin/settings/indicacao`, módulo `admin-referrals` (summary, lista, detalhe, aprovar,
> recusar, card do cliente, conferir código, vínculo manual), `lib/bread-price.ts`. Telas: A1 (card
> no hub), A2 (hub), A3 (config), A4 (lista + sheet), A5 (linha "Indicado por", card, sheet de
> vínculo), A8 (3 toggles "novo" + tom/ícone). Sem schema novo (nada de `db push`). Verificação:
> typecheck (api + web + shared) ✅ · **1.642 testes do api passando + 3 todo** (+51) · **341 do web
> passando + 17 todo** (+35) · shared 74 + 4 todo. Detalhes em §10; divergências V-24 a V-32.
>
> ✅ **Onda 7 (relatório, funil, DRE) CONCLUÍDA** em 29/09/2026 — **SEM COMMIT**. `TYPE_META` com os 3
> tipos; linha "Bonificações de indicação" no DRE (só competência, com parcela na ponte); `ref` no
> funil (`TrackEventSchema` + `trackAccess`); `GET /admin/reports/referrals` e a tela A6 (Relatórios ›
> Aquisição & clientes e atalho `trend` do hub). Sem schema novo. Verificação: typecheck (api + web +
> shared) ✅ · **1.657 testes do api passando + 3 todo** (+15) · **346 do web passando + 17 todo** (+5) ·
> shared 74 + 4 todo. Divergências V-33 a V-36.
>
> ✅ **Onda 8 (lista de espera) CONCLUÍDA** em 29/09/2026 — **SEM COMMIT**. Módulo `condo-interests`
> (`POST /condominiums/interest` público 5/min + `GET/PATCH` do admin), C8 (card no vazio da busca do
> cadastro + formulário `CondoWaitlist`) e A7 (seção em Condomínios). Sem schema novo (`CondoInterest`
> já estava no banco de teste). Verificação: typecheck (api + web + shared) ✅ · **1.672 testes do api
> passando + 3 todo** (+15) · **357 do web passando + 17 todo** (+11) · shared 74 + 4 todo.
> Divergências V-37 a V-40.
>
> ✅ **Onda 9 (verificação) CONCLUÍDA** em 29/09/2026 — **SEM COMMIT**. Typecheck (api + web + shared) ✅ ·
> **1.672 testes do api + 3 todo** · **357 do web + 17 todo** · **shared 74 + 4 todo** · `build` da api
> (tsup) e do web (tsc + vite + PWA) ✅ · boot da API compilada contra o banco de teste ✅ (índices
> garantidos, todas as rotas novas registradas sem conflito). Revisão de gênero nos rótulos do admin
> (V-41). **Falta o UAT manual** (§15), que é do usuário.
>
> ✅ **UAT concluído** em 29/09/2026 com o usuário (resultado na §15): itens 1–7, 12–15 validados no
> app; 8–11, 16 e 17 dispensados por decisão do usuário (cobertos por teste automático). Um ajuste
> (U-1, chips do A4 no desktop). Suítes depois do ajuste: api 1.672 + 3 todo · web 357 + 17 todo.
>
> ⏭️ **Próximo passo:** commit (só com pedido explícito), deploy e as pendências da §17 (conferir o
> `db push` no Actions, os IPs reais nos logs, ligar o programa com os valores do negócio).
>
> 🔁 **Retomada (para a próxima sessão)** — a feature está completa e validada, sem commit:
> - **D-18 (29/09/2026):** o funil do A6 fica como está — "Cadastros" conta todas as origens, mesmo
>   passando de 100% das visitas pelo link (decisão do usuário, era a P-2).
> - Ajuste novo → registrar na §18 (a numeração continua em V-42) e rodar `npx tsc --noEmit -p .` +
>   `npx vitest run` em `apps/api`, `apps/web` e `packages/shared`.
> - Banco de teste `cheirin-de-pao-teste`: ficou com os dados do UAT (ver §15) e o programa ligado
>   (5 / 3 / limite 10 / prazo 60, sem campanha nem metas).
> Nenhuma decisão em aberto — a P-1 virou D-17 e a P-2 virou D-18 (§2).

## 1. Objetivo

Um programa de indicação: o cliente compartilha um link ou código; quando um amigo se cadastra com
ele, **paga e recebe o primeiro pedido**, quem indicou ganha **X pãezins** e o amigo ganha **Y
pãezins** de boas-vindas. X, Y e todas as regras são configurados pelo admin.

**Invariantes de produto:**

1. **Ninguém ganha pão sem dinheiro real e entrega física.** É o que torna a fraude cara: conta
   falsa precisa pagar e receber pão num condomínio atendido.
2. **Uma recompensa por amigo, garantida pelo banco** — trava por status dentro de transação, nunca
   checagem num objeto lido antes (o defeito corrigido na Onda 0).
3. **A indicação nunca atrapalha o cadastro.** Código inválido, programa desligado ou erro interno
   → o cadastro segue normal, só sem vínculo.
4. **O que foi prometido é cumprido.** O valor é congelado no cadastro; mudar a configuração ou
   desligar o programa não altera nem cancela indicações já vinculadas.

---

## 2. Decisões confirmadas

| # | Decisão |
|---|---|
| D-1 | **Gatilho:** 1ª entrega concluída (pão **ou** Cestinha) **+** ≥ 1 pagamento real aprovado (compra de pães ou Cestinha; gancho não conta) |
| D-2 | **O amigo também ganha** (boas-vindas), no **mesmo momento** de quem indicou. Valor configurável; 0 desliga |
| D-3 | **Todos os valores e regras são configurados pelo admin** (Gestão › Indique e Ganhe) |
| D-4 | **Mesmo apartamento → análise do admin** (não paga sozinho, não recusa sozinho) |
| D-5 | **Tudo numa versão só:** entra também relatório/funil, sinal de mesmo aparelho, mensagem personalizável, metas, campanha, linha no DRE e lista de espera de condomínio |
| D-6 | Plano direto em `.projeto/docs`, sem GSD |
| D-7 | **As telas passam pelo Claude Design antes** — o handoff é a porta de entrada das ondas de tela (§11) |
| D-8 | Correções pedidas antes da feature: crédito em dobro, bloqueio fraco, OTP duplicado — Onda 0 ✅ |

### Decisões que vieram do handoff (Onda 1)

| # | Decisão |
|---|---|
| D-9 | **O handoff é a fonte das telas:** layout, textos, estados e tokens são finais (§8, §9, §11) |
| D-10 | **Três tipos no extrato:** `REFERRAL_BONUS` (indicação), `REFERRAL_WELCOME` (boas-vindas) e `REFERRAL_GOAL` (meta) — o handoff mostra a meta como linha própria |
| D-11 | O "fechar por 30 dias" do card da Home fica **no servidor** (preferência por usuário), não no `localStorage` |
| D-12 | **Só "Em análise" tem ações** no admin: aprovar, ou recusar com motivo (4 opções) + detalhe obrigatório. Indicação aguardando não é recusável |
| D-13 | **Faixas dos valores = as dos controles do handoff:** recompensa e bônus 0–50, limite 0–99, prazo 0–180 dias, até 5 metas |
| D-14 | "Indicação recompensada" (aviso ao admin) **nasce desligada**; os outros dois avisos novos nascem ligados |
| D-15 | Lista de espera com **um campo só, "E-mail ou celular"** — o servidor descobre qual é; cidade obrigatória |
| D-16 | **Uma campanha por vez** (não há sobreposição). O rótulo dela fica congelado na indicação, junto com o multiplicador |

### D-18 — funil do relatório (decidido em 29/09/2026, era a P-2)

A etapa "Cadastros" do funil do A6 conta **todas** as origens (link, código digitado e vínculo do admin),
igual ao KPI "Cadastros por indicação". Quando parte dos cadastros não veio pelo link, a passagem
"visitas → cadastros" pode passar de 100% — aceito pelo usuário no UAT.

### D-17 — redesenho de telas existentes (decidido em 28/09/2026, era a P-1)

**Regra do usuário:** o que é **novo da indicação** segue o handoff por inteiro. O que o handoff
muda em **telas que já existem** só entra se for **mudança apenas de tela (front), sem alterar
nenhuma funcionalidade** — nada de API, dado ou comportamento novo por causa do redesenho.

| Tela | Entra (só front) | Fica de fora |
|---|---|---|
| Central de notificações | Ícone em círculo (hoje: quadrado arredondado); borda de "novo" dourada (hoje: `accent`); texto espresso no botão dourado (hoje: creme). Vale para todos os avisos | — |
| Extrato de pãezins | Cabeçalho espresso com o saldo (o app já sincroniza o saldo); agrupamento por dia (BRT, no front); ícone e título por tipo; linhas de bônus com selo "Bônus" e o rodapé | **Detalhe do pagamento na compra** ("Combo 30 · Pix · R$ 30,00"): exigiria mudar a API `/credits/history`. A linha de compra mostra a `description` que já existe |

O "Bônus de indicação +N este mês" do cabeçalho entra, porque é da indicação (vem de
`summary.bonusThisMonth`).

---

## 3. Contexto — o que já existe

| Peça | Arquivo | Uso aqui |
|---|---|---|
| **Handoff desta feature** | [`design_handoff_indique_e_ganhe/`](../design_handoff_indique_e_ganhe/README.md) | Fonte das telas: `README.md` (spec), `design/Indique e Ganhe - Telas.html` (todas as telas e estados), `screenshots/` |
| Saldo canônico | [`User.creditMilli`](../../apps/api/prisma/schema.prisma#L300) | Milésimos de pão. Recompensa em pãezins inteiros × 1000 |
| Crédito + aviso ao cliente | [`grantCredits`](../../apps/api/src/modules/admin-clients/admin-clients.service.ts#L938) | Molde do crédito e da notificação |
| Trava por status | [`claimAndCreditPurchase`](../../apps/api/src/modules/payments/payments.repository.ts#L70), [`fulfillMarketOrder`](../../apps/api/src/modules/payments/fulfill-market-order.ts#L32-L36) | Molde da trava da recompensa (transação + `updateMany` guardado + retry em P2034) |
| Config em `Setting` | [`lib/gancho-config.ts`](../../apps/api/src/lib/gancho-config.ts), [`AdminGancho.tsx`](../../apps/web/src/pages/admin/gestao/AdminGancho.tsx) | Molde de config: seed + parse defensivo + GET/PATCH + tela |
| Cadastro | [`AuthService.register`](../../apps/api/src/modules/auth/auth.service.ts#L311), [`RegisterSchema`](../../apps/api/src/modules/auth/auth.schema.ts), [`OnboardingScreen.tsx:185`](../../apps/web/src/pages/auth/OnboardingScreen.tsx#L185) | Vínculo do código |
| Pontos de "entregue" | [`updateOrderStatus`](../../apps/api/src/modules/admin-orders/admin-orders.service.ts#L290) (entregador, separação e admin; propaga a Cestinha da mesma parada), [`resolveStuckOrder`](../../apps/api/src/modules/admin-orders/admin-orders.service.ts#L1856), [`resolveStuckMarketOrder`](../../apps/api/src/modules/admin-orders/admin-orders.service.ts#L1958), [`confirmMarketDelivery`](../../apps/api/src/modules/courier/courier.service.ts#L558) | Gatilho da qualificação |
| Cron diário | [`plugins/cron.ts:25`](../../apps/api/src/plugins/cron.ts#L25) (`daily-jobs`, 00:00 BRT) | Varredura de segurança |
| Notificações | `NotificationsService.notifyUser/notifyAdmins`, [`NotificationsScreen.tsx`](../../apps/web/src/pages/client/NotificationsScreen.tsx#L19-L53) | Avisos. O botão da notificação in-app vem de `CTA_CONFIG[type]`, não do `actionRoute` |
| Prefs do admin | [`admin-notification-prefs.schema.ts`](../../apps/api/src/modules/admin-notification-prefs/admin-notification-prefs.schema.ts), [`AdminNotificacoes.tsx`](../../apps/web/src/pages/admin/gestao/AdminNotificacoes.tsx) | Toggles novos |
| Banners | [`BANNER_SCREENS`](../../packages/shared/src/schemas/banner.ts#L28) | Divulgar o programa por pop-up/faixa sem código novo |
| Analytics | [`trackAccess`](../../apps/web/src/main.tsx#L26), `AnalyticsEvent` | Funil de cliques no link |
| Relatórios | [`AdminRelatorios.tsx:44`](../../apps/web/src/pages/admin/gestao/AdminRelatorios.tsx#L44), `RelShared.tsx` | Relatório novo em "Aquisição & clientes" |
| Detalhe do cliente | [`ClientDetailView.tsx:870`](../../apps/web/src/components/admin/ClientDetailView.tsx#L870) (Membro desde), [`:940`](../../apps/web/src/components/admin/ClientDetailView.tsx#L940) (`GanchosCard`) | "Indicado por" + card de indicações |
| Hub de Gestão | [`AdminGestao.tsx`](../../apps/web/src/pages/admin/tabs/AdminGestao.tsx#L52-L67) (`HUB_ITEMS`, `HubCard` com `badge` numérico) | Card do A1 |
| Índices parciais | [`lib/ensure-indexes.ts`](../../apps/api/src/lib/ensure-indexes.ts) | Índice único parcial de `referralCode` |
| Perfil (hub do cliente) | [`SettingsScreen.tsx:137`](../../apps/web/src/pages/client/SettingsScreen.tsx#L137), [`ProfileMenuRow.tsx`](../../apps/web/src/components/client/ProfileMenuRow.tsx) | Entrada "Indique e ganhe" |
| Extrato | [`CreditHistoryScreen.tsx`](../../apps/web/src/pages/client/CreditHistoryScreen.tsx), `GET /credits/history` (array) | C7 |
| Handoff anterior | [`handoff-alem-do-paozin.md`](../handoff-alem-do-paozin.md) + [`brief-telas-alem-do-paozin.md`](../brief-telas-alem-do-paozin.md) | Formato seguido na Onda 1 |

### Achados que moldam o desenho

1. **O saldo é um número só, sem lotes.** O bônus se mistura ao saldo pago — por isso ele **não
   expira** (coerente com "crédito não expira neste sistema") e não vira dinheiro.
2. **Não existe um ponto único de "entregue".** São quatro serviços. A qualificação é **uma
   função** chamada nos quatro, mais uma varredura diária como rede de segurança.
3. **O User nasce antes do OTP.** O vínculo acontece no cadastro; "cadastro confirmado" é marcado
   no primeiro login (OTP, senha ou reset) — cadastro abandonado não avisa ninguém.
4. **No iPhone o link se perde:** o PWA instalado não enxerga o `localStorage` do Safari. O campo
   de código **digitável** é obrigatório, e o código vai escrito na mensagem de compartilhamento.
5. **Não há fallback de SPA no repositório** → o link é `/?ref=CODIGO` (a raiz sempre carrega).
6. **O deploy roda `prisma db push`,** que cria os índices do schema. Índice único em campo que
   documentos antigos não têm quebraria o push → o de `User.referralCode` é **parcial**, em
   `ensure-indexes.ts`.
7. **Coleção nova nasce com todas as chaves** (gravar `null` explícito) — então dá para consultar
   `Referral` por campo normalmente, ao contrário de `User`/`Condominium`.

---

## 4. Regras de negócio

### 4.1 Jornada

1. **Quem indica** abre Perfil › Indique e ganhe: vê o código (`JOAO7K2F`), os botões de
   compartilhar, o resumo, o progresso de metas, a lista de indicados, "Como funciona" e as regras.
2. **O amigo** abre o link. O app guarda o código (30 dias) e o cadastro mostra o selo "Indicado
   por João M. · Você ganha Y pãezins quando o 1º pedido chegar". Sem link, ele digita o código.
3. **O amigo cadastra e entra** → indicação `PENDING`; quem indicou recebe "Sua indicação chegou!".
4. **O amigo paga e recebe a 1ª entrega** → qualifica → `REWARDED`: quem indicou ganha X
   (× campanha), o amigo ganha Y, os dois são avisados e veem a comemoração na próxima abertura.
5. Se cair num sinal de análise (§4.4) → `ON_HOLD` até o admin aprovar ou recusar.

### 4.2 Estados (com as chaves e os rótulos do handoff)

| Modelo | Chave (API e handoff) | Quem indicou vê | Admin vê | Selo (tom + ícone) |
|---|---|---|---|---|
| `PENDING` sem `verifiedAt` | `cadastro` | Cadastro em andamento | Cadastro | neutro + `edit` |
| `PENDING` com `verifiedAt` | `aguardando` | Aguardando 1º pedido | Aguardando | cliente: dourado · admin: neutro · `clock` |
| `ON_HOLD` | `analise` | Em análise | Em análise | cliente: neutro · admin: dourado · `search` |
| `REWARDED` | `ganhou` | Ganhou +X | Recompensada | verde + `check` |
| `REJECTED` | `recusada` | Não valeu | Recusada (+ motivo, só admin) | neutro + `x` |
| `EXPIRED` | `expirou` | Prazo encerrado | Expirada | neutro + `clock` |

A API devolve a chave (`state`) já calculada; o front só traduz. Todo selo leva **ícone + texto**,
nunca só cor.

Transições: `PENDING → REWARDED | ON_HOLD` (automático) · `PENDING → EXPIRED` (varredura) ·
`ON_HOLD → REWARDED | REJECTED` (admin, D-12). Terminais: REWARDED, REJECTED, EXPIRED.

### 4.3 Qualificação — "o amigo realizou o pedido" (D-1)

`qualifyReferral` confere, nesta ordem:

1. existe indicação do amigo e ela está `PENDING`;
2. está dentro do prazo (`expiresAt` nulo ou futuro) — senão vira `EXPIRED`;
3. o amigo tem ≥ 1 entrega `DELIVERED` (`Order` ou `MarketOrder`);
4. o amigo tem ≥ 1 `Payment` `PAID` **que não é gancho** (`purpose` nulo/ausente = CREDITS, ou
   `MARKET`) com `amount ≥ indicacaoCompraMinima`. Filtrado **em código** (armadilha null × ausente).

Se 3 ou 4 falha, continua `PENDING` e é reavaliada na próxima entrega ou na varredura.

**Texto × regra da compra mínima.** O handoff diz ao cliente "O 1º pedido do amigo precisa ser de
pelo menos R$ X". Para um cliente novo (saldo 0), o 1º pedido é pago na hora — combo, diferença do
pedido único ou Cestinha —, então o 1º pagamento é o valor do 1º pedido. A regra fica no pagamento,
que é dinheiro de verdade. Se um pagamento posterior passar do mínimo dentro do prazo, também vale.

### 4.4 Sinais de análise (D-4) → `ON_HOLD`

| Sinal | Rótulo no admin | Regra |
|---|---|---|
| `SAME_ADDRESS` | Mesmo apartamento | Mesmo `condominiumId` + `block` + `apartment` + `complement` (trim, maiúsculas, sem espaços; ausente = vazio) |
| `SAME_DEVICE` | Mesmo aparelho | Algum `Session.deviceId` em comum entre quem indicou e o amigo |
| `OVER_LIMIT` | Limite do mês | Quem indicou já tem ≥ `indicacaoLimiteMensal` recompensas no mês BRT corrente (0 = sem limite) |
| `REFERRER_BLOCKED` | Indicador bloqueado | Quem indicou está bloqueado |

Mesmo condomínio em outro apartamento **não** é sinal — é bom para a rota. Os sinais são
gravados em `flags` e **nunca chegam ao cliente**. O limite mensal **não nega**: manda para análise.

### 4.5 Valores, campanha, metas e prazo

- **Congelados no cadastro:** `rewardMilli` (X × multiplicador da campanha), `welcomeMilli` (Y),
  `campaignMultiplier` e `campaignLabel` (D-16).
- **Campanha** ("Semana em dobro"): cadastro dentro da janela `[inicio, fim]` (dias BRT) multiplica
  a recompensa **de quem indica** (2× a 5×). O bônus do amigo não muda.
- **Metas:** ao **cruzar** N indicações recompensadas (contagem vitalícia), quem indicou ganha um
  bônus extra (`REFERRAL_GOAL`), uma vez por marco. Não é retroativo: meta criada depois não paga
  quem já passou dela.
- **Prazo:** `expiresAt = createdAt + indicacaoPrazoDias` (0 = sem prazo). O texto do handoff:
  "Seu amigo tem N dias, a partir do cadastro, para fazer e receber o 1º pedido."

### 4.6 Código e link

- Formato: primeiro nome sem acento, maiúsculas, até 6 letras + 4 caracteres de
  `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (sem 0/O/1/I/L). Ex.: `JOAO7K2F`. Prefixo reserva `PAO`.
- Exibido em 2 grupos (`JOAO` · `7K2F`, sufixo em dourado), com `aria-label` soletrado.
- Gerado na primeira abertura da tela, gravado em `User.referralCode`. Colisão no índice → gera de
  novo (até 5 tentativas).
- Entrada do usuário é normalizada: maiúsculas, sem espaços e hífens.
- Link: `${window.location.origin}/?ref=CODIGO` — certo em dev e produção sem variável nova.
- Código válido = dono `CLIENT` e não bloqueado. Entregador e admin não participam.

### 4.7 Privacidade (LGPD)

- Quem indica vê só "Maria S." + status + datas — nunca endereço, condomínio ou contato ("Só você vê").
- A validação pública do código devolve só primeiro nome + inicial.
- Nada de importar contatos: o compartilhamento é feito pelo próprio cliente.

### 4.8 Programa desligado

- Some o card da Home, o campo do cadastro e o convite pós-entrega; a validação do código responde
  inválido; código novo não vincula.
- A seção do Perfil some **para quem nunca indicou**. Quem tem histórico continua vendo a linha,
  que leva à tela em estado "pausado" (só histórico, sem compartilhar) — adendo A-4 (§11).
- Indicações já vinculadas **seguem e são pagas** (invariante 4).

---

## 5. Modelo de dados

```prisma
enum ReferralStatus {
  PENDING   // cadastrou com código; aguardando qualificação
  ON_HOLD   // qualificou, mas caiu num sinal (flags) — aguarda o admin
  REWARDED  // recompensa creditada (quem indicou + amigo)
  REJECTED  // admin recusou
  EXPIRED   // prazo encerrado sem qualificar
}

// Coleção NOVA: todo documento nasce com todas as chaves (null explícito) — consultar por campo é seguro.
model Referral {
  id                 String         @id @default(auto()) @map("_id") @db.ObjectId
  referrerId         String         @db.ObjectId
  referredId         String         @unique @db.ObjectId // 1 indicador por amigo
  code               String         // código usado (cópia do momento)
  source             String         // 'LINK' | 'CODE' | 'ADMIN'
  status             ReferralStatus
  rewardMilli        Int            // recompensa de quem indica, congelada (já com a campanha)
  welcomeMilli       Int            // bônus do amigo, congelado (0 = sem)
  campaignMultiplier Int            // 1 = sem campanha
  campaignLabel      String?        // rótulo congelado ("Semana em dobro") — admin e "em dobro" na lista
  expiresAt          DateTime?
  verifiedAt         DateTime?      // 1º login do amigo (cadastro confirmado)
  qualifiedAt        DateTime?
  qualifyingOrderId  String?        @db.ObjectId // Order ou MarketOrder que qualificou
  qualifyingKind     String?        // 'ORDER' | 'MARKET'
  flags              String[]       // SAME_ADDRESS | SAME_DEVICE | OVER_LIMIT | REFERRER_BLOCKED
  rewardedAt         DateTime?
  reviewedById       String?        @db.ObjectId
  reviewedAt         DateTime?
  rejectReason       String?        // SAME_RESIDENCE | SAME_DEVICE | DUPLICATE_ACCOUNT | OTHER
  rejectDetail       String?        // obrigatório na recusa; só o admin vê
  rewardSeenAt       DateTime?      // quem indicou viu a comemoração
  welcomeSeenAt      DateTime?      // o amigo viu a comemoração
  createdAt          DateTime       @default(now())
  updatedAt          DateTime       @updatedAt

  @@index([referrerId, createdAt])
  @@index([status, createdAt])
  @@index([referrerId, status, rewardedAt])
}

// Um documento por marco pago — o índice único é a trava de "uma vez por marco".
model ReferralMilestone {
  id         String    @id @default(auto()) @map("_id") @db.ObjectId
  referrerId String    @db.ObjectId
  threshold  Int
  bonusMilli Int
  seenAt     DateTime? // viu a comemoração "Meta atingida"
  createdAt  DateTime  @default(now())

  @@unique([referrerId, threshold])
}

// Lista de espera: visitante de condomínio ainda não atendido (C8 → A7).
model CondoInterest {
  id          String    @id @default(auto()) @map("_id") @db.ObjectId
  condoName   String
  zip         String?
  city        String
  groupKey    String    // nome + cidade normalizados — agrupa no admin
  contactName String
  email       String?   // o campo único "E-mail ou celular" vira um dos dois (D-15)
  phone       String?
  refCode     String?   // veio por indicação? (mede demanda gerada pelo programa)
  visitorId   String?
  handledAt   DateTime? // admin marcou como tratado
  createdAt   DateTime  @default(now())

  @@index([groupKey, createdAt])
  @@index([createdAt])
}
```

Alterações em modelos existentes:

| Onde | Mudança |
|---|---|
| `User` | `referralCode String?` — **sem** `@unique` no schema; índice único **parcial** (`$exists: true`) em `ensure-indexes.ts`. **Nunca gravar `null`** nesse campo. · `referralInviteAt DateTime?` — trava do convite pós-1ª entrega (claim com `isSet: false`). · `referralCardDismissedAt DateTime?` — card da Home fechado (D-11). Ler os três por `select` + `?? null` |
| `TransactionType` | `REFERRAL_BONUS` (quem indica, por indicação) · `REFERRAL_WELCOME` (amigo) · `REFERRAL_GOAL` (meta) — D-10 |
| `NotificationType` | `REFERRAL_SIGNUP` · `REFERRAL_REWARD` · `REFERRAL_WELCOME` · `REFERRAL_INVITE` · `ADMIN_REFERRAL_REVIEW` · `ADMIN_REFERRAL_REWARDED` · `ADMIN_CONDO_INTEREST` |
| `AnalyticsEvent` | `refCode String?` — funil de cliques |

Descrições gravadas no lançamento (viram a 2ª linha do extrato, C7):
`REFERRAL_BONUS` → "Maria S. recebeu o 1º pedido" · `REFERRAL_WELCOME` → "Você veio pela indicação
do João M." · `REFERRAL_GOAL` → "Bônus pela 5ª indicação que valeu".

---

## 6. Configuração (`Setting`) — tudo no admin (D-3)

| Chave | Padrão (seed) | Validação (D-13) | O que é |
|---|---|---|---|
| `indicacaoAtiva` | `false` | bool; **só liga com recompensa ≥ 1** | Liga/desliga o programa |
| `indicacaoRecompensa` | `5` | int 0..50 | X pãezins para quem indica |
| `indicacaoBonusIndicado` | `0` | int 0..50 | Y pãezins para o amigo (0 = sem) |
| `indicacaoCompraMinima` | `0` | R$ ≥ 0 | Valor mínimo pago pelo amigo (0 = qualquer) |
| `indicacaoLimiteMensal` | `10` | int 0..99 | Recompensas/mês antes de ir para análise (0 = sem limite) |
| `indicacaoPrazoDias` | `60` | int 0..180 | Prazo para o amigo qualificar (0 = sem prazo) |
| `indicacaoMensagem` | texto padrão | 20..500 chars, contém `{codigo}` ou `{link}` | Texto do compartilhamento. Variáveis: `{codigo}`, `{link}`, `{nome}`, `{bonus}` |
| `indicacaoCampanha` | `null` (JSON) | `{ rotulo, multiplicador 2..5, inicio, fim }`, `inicio ≤ fim`, `fim ≥ hoje` | Campanha por período (uma só — D-16) |
| `indicacaoMetas` | `[]` (JSON) | até 5 itens `{ quantidade 1..999, bonus 1..50 }`, quantidades distintas, em ordem | Metas de quem indica |

- **Mensagem padrão:** *"Oi! Recebo pão fresquinho na porta com o Cheirin de Pão 🥖 Cadastra com o
  meu código {codigo} e ganha {bonus} pãezins no primeiro pedido: {link}"*.
- **Render** (`renderReferralMessage`, igual ao `refMsg` do handoff): com Y = 0, remove o trecho
  " e ganha {bonus} pãezins no primeiro pedido" quando ele está na mensagem. Mensagem
  personalizada que usa `{bonus}` com Y = 0 → aviso no admin (`bonusWarn`).
- **"≈ R$" no admin:** X × preço médio pago por pãozin (`estPricePerCredit`, a mesma base do
  relatório e do DRE); sem vendas ainda → `avulsoUnit`. O `REF_UNIT` do protótipo é só mock.
- `lib/referral-config.ts` → `getReferralConfig(prisma)` no padrão de `gancho-config.ts`: valor
  ausente ou inválido cai no padrão, **nunca lança**. Sem cache (as leituras de Setting já são
  diretas no projeto).

---

## 7. Backend

### 7.1 `lib/tx-retry.ts` (novo — extraído da Onda 0)

Move `isWriteConflict` + o laço de retry de `claimAndCreditPurchase` para
`withWriteConflictRetry(fn, attempts = 3)`. Pagamento e indicação passam a usar o mesmo helper.

### 7.2 `lib/referral-config.ts` e `lib/referral-code.ts` (novos)

- Config: §6.
- Código: `normalizeCode(raw)`, `generateCode(name)`, `ensureReferralCode(prisma, userId)` (lê; se
  não tem, gera e grava com retry em colisão P2002), `shortName(name)` → "Maria S.".

### 7.3 `lib/referral.ts` (novo — toda a regra mora aqui)

| Função | O que faz |
|---|---|
| `attachReferralAtSignup(fastify, user, rawCode, source)` | Programa ativo + código válido → cria `Referral` PENDING com os valores congelados e todas as chaves. Best-effort: nunca derruba o cadastro |
| `markReferralVerified(fastify, userId)` | 1º login do amigo → `verifiedAt` (claim `verifiedAt: null`) + `REFERRAL_SIGNUP` para quem indicou |
| `afterDelivery(fastify, userId, order)` | Chamado nos 4 pontos de entrega: `qualifyReferral` + convite pós-1ª entrega. Nunca lança |
| `qualifyReferral(fastify, referredId, order?)` | §4.3 e §4.4 → `rewardReferral` ou `ON_HOLD` (+ `ADMIN_REFERRAL_REVIEW`) |
| `rewardReferral(fastify, id, from, reviewerId?)` | Transação com `withWriteConflictRetry`: claim `updateMany({ id, status: from })` → `REWARDED`; crédito `REFERRAL_BONUS` a quem indicou e `REFERRAL_WELCOME` ao amigo (se > 0), `referenceId = referral.id`. Depois: avisos + metas |
| `grantMilestoneIfReached(fastify, referrerId)` | Conta REWARDED; se igual a um marco, cria `ReferralMilestone` (P2002 = já pago → sai) e credita `REFERRAL_GOAL` |
| `rejectReferral(fastify, id, reason, detail, adminId)` | Só `ON_HOLD → REJECTED` (D-12) |
| `sweepReferrals(fastify)` | Expira PENDING vencidas; reavalia PENDING cujo amigo já tem entrega |
| `sendReferralInvite(fastify, userId)` | Programa ativo → claim `referralInviteAt: { isSet: false }` → `REFERRAL_INVITE` (uma vez na vida) |
| `buildCelebration(fastify, userId)` | Monta o `celebration` do `summary` (§7.7) |

### 7.4 Cadastro e login

- `RegisterSchema`: `referralCode: z.string().trim().max(20).optional()` e
  `referralSource: z.enum(['LINK','CODE']).optional()`. Opcionais de propósito: versões antigas do
  PWA não mandam e seguem funcionando. Declarar no JSON schema da rota (documentação).
- `AuthService.register`: depois de `createUser`, `attachReferralAtSignup` em `try/catch`.
- `verifyOtpAndCreateSession`, `loginWithPassword`, `resetPasswordWithOtp`: `markReferralVerified`
  best-effort **depois** de emitir os tokens (não no refresh).

### 7.5 Pontos de entrega — `afterDelivery`

| Serviço | Quando chamar |
|---|---|
| [`updateOrderStatus`](../../apps/api/src/modules/admin-orders/admin-orders.service.ts#L290) | `newStatus === 'DELIVERED'` — cobre entregador, separação, admin e a Cestinha propagada |
| [`resolveStuckOrder`](../../apps/api/src/modules/admin-orders/admin-orders.service.ts#L1856) | `outcome === 'DELIVERED'` |
| [`resolveStuckMarketOrder`](../../apps/api/src/modules/admin-orders/admin-orders.service.ts#L1958) | `outcome === 'DELIVERED'` |
| [`confirmMarketDelivery`](../../apps/api/src/modules/courier/courier.service.ts#L558) | Quando `completeMarketStop` moveu a Cestinha |

Custo no caminho quente: uma `findUnique` por `referredId`. Quem não tem indicação para aí.

### 7.6 Varredura diária

`sweepReferrals` num `try/catch` próprio dentro do `daily-jobs` ([cron.ts:25](../../apps/api/src/plugins/cron.ts#L25)).
Sem cron novo — o projeto evita crons que falham em silêncio.

### 7.7 Módulo `referrals` (cliente, novo)

| Rota | Auth | Resposta / uso |
|---|---|---|
| `GET /referrals/config` | pública | `{ active, welcomeBreads }` — o cadastro decide se mostra o campo (C4) |
| `GET /referrals/code/:code` | pública, **10/min** | `{ valid, referrerName?, welcomeBreads? }` — `referrerName` = "João M." |
| `GET /referrals/summary` | CLIENT | Entradas leves: `{ active, hasReferrals, isNew, rewardBreads, campaign, homeCard: { visible }, bonusThisMonth, celebration }` — Perfil (C2), Home (C3), comemoração (C5) e cabeçalho do extrato (C7) |
| `GET /referrals/me` | CLIENT | Tela C1 (abaixo) |
| `POST /referrals/celebration/seen` | CLIENT | `{ referralIds, goalThresholds, welcome }` — marca o que o modal mostrou |
| `POST /referrals/home-card/dismiss` | CLIENT | Grava `referralCardDismissedAt` (D-11) |

- **`isNew`** = o cliente ainda não tem `referralCode` (nunca abriu a tela) → selo "novo" no C2.
- **`homeCard.visible`** = programa ativo + ≥ 1 entrega recebida + card não fechado nos últimos 30 dias.
- **`rewardBreads`** já vem com a campanha aplicada (X × multiplicador), como o `refX` do handoff.
- **`celebration`** = `null` ou `{ variant: 'friend' | 'goal' | 'multi' | 'referrer', breads,
  names[], goal?: { threshold, bonus, next? }, referrerName? }`. Prioridade: `friend` → `goal` →
  `multi` (≥ 2 recompensas não vistas) → `referrer`. Uma comemoração por abertura; o resto espera a
  próxima.
- **`GET /referrals/me`** devolve:
  - `state: 'active' | 'paused'`, `code`, `link`, `message` (já renderizada);
  - `rewardBreads`, `baseRewardBreads` (para "Em vez de 5…"), `welcomeBreads`, `campaign: { label, until } | null`;
  - `rules: { prazoDias, compraMinima }`;
  - `stats: { earnedBreads, valeram, emAndamento }` — `earnedBreads` soma `REFERRAL_BONUS` +
    `REFERRAL_GOAL`, tudo o que o programa deu a ele (adendo A-15);
  - `goals: { count, milestones[], justHit?, next? }`;
  - `referrals: [{ id, name, state, date, rewardBreads?, campaign }]` (`campaign` = teve multiplicador → "em dobro").

Toda resposta com JSON schema **declarado** — o `fast-json-stringify` descarta campo não declarado.

### 7.8 Admin

| Rota | O que faz |
|---|---|
| `GET/PATCH /admin/settings/indicacao` | Config (§6), no módulo `admin-settings`, padrão do gancho. 422 ao ligar com recompensa 0 ou com mensagem sem `{codigo}`/`{link}` |
| `GET /admin/referrals?state&q&page` | Lista: `de` e `para` (nomes completos), data, condomínio do amigo, `state`, `signals[]` (rótulos da §4.4); contagem por estado para os chips e o badge do A1/A2 |
| `GET /admin/referrals/:id` | Detalhe: ids e nomes das duas pessoas (atalho), sinais, valores congelados (X, Y, `campaignLabel`), linha do tempo `{ cadastro, login, pagamento, entrega, recompensa }` |
| `POST /admin/referrals/:id/approve` | `ON_HOLD → REWARDED` |
| `POST /admin/referrals/:id/reject` | `{ reason: 'SAME_RESIDENCE' \| 'SAME_DEVICE' \| 'DUPLICATE_ACCOUNT' \| 'OTHER', detail }` (detalhe obrigatório) — `ON_HOLD → REJECTED` |
| `GET /admin/clients/:id/referrals` | A5: `{ code, referredBy: { id, name } \| null, stats: { fez, valeram, earnedBreads }, referrals[] }` — gera o código do cliente se ainda não existir |
| `GET /admin/clients/:id/referral-code-check?code=` | Sheet "Vincular" (A5): `{ valid, self, owner?: { name, condo } }` |
| `POST /admin/clients/:id/referral` | `{ code }` — vínculo manual (`source: 'ADMIN'`) se o cliente não tem indicação; roda `qualifyReferral` na hora (pode recompensar ou ir para análise) |
| `GET /admin/reports/referrals?period` | Relatório A6 (§7.10) |
| `GET /admin/condominiums/interests` · `PATCH /admin/condominiums/interests/handled` | A7: grupos por `groupKey` → `{ key, name, city, count, viaReferral, handled, contacts[] }`. PATCH `{ groupKey, handled }` marca ou reabre o grupo inteiro; pedido novo num grupo tratado o reabre sozinho |

### 7.9 Notificações

| Tipo | Para | Título / corpo | Ícone · tom | Botão → destino |
|---|---|---|---|---|
| `REFERRAL_SIGNUP` | quem indicou | "Sua indicação chegou! 🎉" / "Maria se cadastrou com o seu código. Quando ela receber o 1º pedido, você ganha X pãezins." | `users` · verde | Ver indicações → `/client/perfil/indique` |
| `REFERRAL_REWARD` | quem indicou | "Você ganhou X pãezins!" / "Maria recebeu o 1º pedido. Obrigado por espalhar o cheirinho de pão 🥖" | `gift` · dourado | Ver saldo → `/client/creditos/extrato` |
| `REFERRAL_WELCOME` | amigo | "Presente de boas-vindas 🎁" / "Você ganhou Y pãezins por ter vindo pela indicação do João." | `gift` · dourado | Ver saldo → `/client/creditos/extrato` |
| `REFERRAL_INVITE` | cliente após a 1ª entrega | "Gostou do pãozin?" / "Indique um vizinho: quando ele receber o 1º pedido, você ganha X pãezins." | `spark` · neutro | Indicar agora → `/client/perfil/indique` |
| `ADMIN_REFERRAL_REVIEW` | admins (toggle, ligado) | "Indicação para analisar" / "João → Maria: mesmo apartamento." | — | — |
| `ADMIN_REFERRAL_REWARDED` | admins (toggle, **desligado por padrão** — D-14) | "Indicação recompensada" / "João ganhou X pãezins pela Maria." | — | — |
| `ADMIN_CONDO_INTEREST` | admins (toggle, ligado) | "Pedido de novo condomínio" / "Residencial Sol (Campinas) — 3º pedido." | — | — |

- Tipos de admin entram em `ADMIN_NOTIFICATION_TYPES` (api) e `NOTIF_ITEMS` (web) — cópias à mão.
- **Desligado por padrão:** hoje ausência = ligado. Adicionar um conjunto `DEFAULT_OFF` (só
  `ADMIN_REFERRAL_REWARDED`) no `fill()` das prefs e no `notifyAdmins`.

### 7.10 Relatório, analytics e financeiro

- **Funil:** `AnalyticsEvent.refCode` + `ref` opcional em `TrackEventSchema` e no enum/JSON da rota;
  `trackAccess` manda o código capturado naquela carga. Etapas: visitas pelo link (visitantes
  únicos com código) → cadastros → confirmados → recompensados, com % de passagem entre etapas.
- **Relatório (A6):**
  - KPIs: cadastros por indicação, recompensadas, conversão (recompensadas ÷ cadastros), pãezins
    concedidos (quem indicou + amigos; metas contam em quem indicou);
  - custo estimado (pães × `estPricePerCredit`), com a divisão "N para quem indicou · N para amigos";
  - custo × receita dos indicados (PAID sem gancho no período) + "Cada R$ 1 em bônus trouxe R$ X";
  - top 5 indicadores (nome, indicações que valeram, pãezins ganhos);
  - distribuição pelas 6 chaves de estado.
- **Movimentação de créditos:** `TYPE_META` em [`credit-movement.service.ts:39`](../../apps/api/src/modules/admin-reports/credit-movement.service.ts#L39) ganha
  `REFERRAL_BONUS` ("Bônus de indicação"), `REFERRAL_WELCOME` ("Boas-vindas de indicação") e
  `REFERRAL_GOAL` ("Meta de indicações"), todos de entrada.
- **DRE:** linha própria no grupo `SALES` — "Bonificações de indicação" = pães `REFERRAL_*`
  creditados no período × `estPricePerCredit`. Compensa a receita por competência que o consumo
  desses pães infla ([dre.ts:459](../../apps/api/src/lib/dre.ts#L459)). Meses fechados leem o
  snapshot (`FinancialClose`) e não mudam.

### 7.11 Lista de espera de condomínio

`POST /condominiums/interest` (pública, **5/min**): `{ condoName, zip?, city, contactName, contact,
refCode? }` → `CondoInterest` + `ADMIN_CONDO_INTEREST`.
- `contact` é o campo único do handoff (D-15): com "@" → valida como e-mail; senão → celular
  (`PhoneSchema`). Inválido → 400 com mensagem para o campo.
- `groupKey` = nome + cidade sem acento, minúsculas e sem espaços duplicados.

### 7.12 Extrato — sem mudança na API (D-17)

`GET /credits/history` **não muda**: continua o mesmo array, com os mesmos campos. O detalhe do
pagamento na compra ficou de fora. O saldo do cabeçalho vem do que o app já sincroniza; o
"+N este mês" vem de `summary.bonusThisMonth` (§7.7).

---

## 8. Frontend cliente — segue o handoff (D-9)

Textos, estados e medidas: usar os do handoff ([README §3](../design_handoff_indique_e_ganhe/README.md)
e `design/app/screens-referral*.jsx`), que são finais.

### 8.0 Base visual (handoff §6)

| O quê | Onde | Detalhe |
|---|---|---|
| Token `--color-warn-soft: #F6E0DC` | `styles/globals.css` | O `danger` do handoff é o `--color-warn` que já existe (`#B23A2E`); só a versão suave é nova. O teste `design-tokens` exige que toda `var(--x)` esteja declarada |
| Texto sobre dourado | — | O `onGold` do handoff = `var(--color-espresso)` |
| Ícones `share`, `copy`, `link`, `chat`, `target`, `ticket` | `components/brand/Icon.tsx` | Paths prontos no `brand.jsx` do handoff (objeto `Ic`). `chat` é o balão do WhatsApp, sem logotipo |
| Skeleton | — | Reusar `cdp-shimmer` (equivale ao `rfShimmer`) |
| Spinner | `styles/globals.css` | `@keyframes cdp-spin` (equivale ao `rfSpin`), se ainda não houver um genérico |
| Cursor piscando (`rfBlink`) | — | Não precisa: o input real tem cursor nativo |
| Kit reutilizável | `components/client/referral/` (novo) | `RefStatePill`, `RefCode`, `RefCodeCard`, `RefShareButtons`, `RefItem` — usados em C1, C4 e A5 |

### 8.1 Telas (handoff → app)

| Tela | Componente no handoff | Arquivo no app | Notas |
|---|---|---|---|
| **C1** Indique e ganhe | `ReferralScreen` + `RefHero`, `RefSummary`, `RefGoals`, `RefHowItWorks`, `RefRules`, `RefSkel`, `RefToast` | `pages/client/ReferralScreen.tsx` (novo), rota `/client/perfil/indique` | 8 estados: `loading`, `empty`, `full`, `campaign`, `goal`, `nobonus`, `paused`, `error`. "Como funciona" sobe quando a lista está vazia. Copiar → "Copiado!" por 1,8 s (`aria-live`). WhatsApp: `https://wa.me/?text=` + `encodeURIComponent`; "Mais opções" = `navigator.share`, sem suporte cai em copiar |
| **C2** Perfil | `ProfileHub` / `ProfRow` | `SettingsScreen.tsx` + `ProfileMenuRow.tsx` | Seção "Indique e ganhe" entre Pedidos e Conta. `ProfileMenuRow` ganha `tone="gold"` (quadrado `gold-soft` + ícone `accent`) e selo dourado com ícone opcional: "novo" (`isNew`) ou o rótulo da campanha com `spark`. Programa desligado: §4.8 |
| **C3** Card na Home | `RefHomeCard` / `HomeRefSlot` | `HomeScreen.tsx` + `components/client/ReferralHomeCard.tsx` | Entre `QuickActions` e `MarketHomeBlock`. Variante campanha (fundo `gold-soft` + eyebrow "SEMANA EM DOBRO · ATÉ 11/10"). X de 44 px com `aria-label="Fechar por 30 dias"` → `POST /referrals/home-card/dismiss` |
| **C4** Cadastro | `RegisterReferral`, `RefBadge`, `RefCodeField` / `OnbRefCode` | `OnboardingScreen.tsx` (passo 1) + `components/auth/ReferralCodeField.tsx` | Veio pelo link: selo **acima do título**, com "Trocar" (abre o campo com o código). Sem link: "Tenho um código de indicação" abaixo dos campos. Campo com maiúsculas automáticas e fonte Bricolage espaçada; valida ao sair (`GET /referrals/code/:code`). **O Continuar só trava durante a validação.** O link "Validar" e a dica "JOAO7K2F é válido" são só do protótipo |
| **C5** Comemoração | `RefCelebration` | `components/client/ReferralCelebration.tsx` + `ClientLayout.tsx` | Sheet inferior (raio 28, halo `gold-soft`), 4 variantes, dados de `summary.celebration`. Fila de overlays única: tutorial → gancho → **comemoração** → pop-up de banner, uma de cada vez. `role="dialog"`, `aria-modal`, trap de foco e volta do foco ao fechar |
| **C6** Notificações | `RefNotifs` / `REF_NOTIFS` | `NotificationsScreen.tsx` | `getTone`/`getIcon`/`CTA_CONFIG` dos 4 tipos (§7.9). Estilo da lista conforme o handoff para todos os avisos (D-17): ícone em círculo, borda dourada no novo, texto `espresso` no botão dourado |
| **C7** Extrato | `RefStatement` | `CreditHistoryScreen.tsx` | Conforme o handoff, **só no front** (D-17): cabeçalho espresso com o saldo + "Bônus de indicação +N este mês"; grupos por dia ("Hoje", "Sáb, 27/09"); ícone por tipo em círculo (`gift` bônus, `star` meta, `coin` compra, `truck` entrega, `basket` Cestinha); linhas de bônus com selo "Bônus" e valor em `accent`; compra em verde; usos em neutro com "−"; título por tipo e a `description` na 2ª linha; rodapé "Pãezins de bônus não viram dinheiro e não expiram." **Sem** o detalhe do pagamento na compra |
| **C8** Lista de espera | `RefWaitlist` | `OnboardingScreen.tsx` (sub-tela do passo 3) + `CondoSearch.tsx` | O estado vazio vira o card do handoff, com o botão dourado "Meu condomínio não está aqui". Formulário pré-preenchido: condomínio = o termo buscado, seu nome = passo 1, contato = e-mail do passo 2. Estados: enviando, erro (`warn-soft`, "Seus dados continuam aqui"), sucesso → "Voltar ao início" (splash) |

### 8.2 Captura e infraestrutura

| Onde | O que |
|---|---|
| `lib/referral.ts` (novo) | Captura de `?ref=` → `localStorage` `cdp_ref` `{ code, source, at }` (30 dias, `try/catch`); limpa a query com `history.replaceState`; `buildLink`, `renderReferralMessage` (= `refMsg`), `share()` (Web Share → WhatsApp `wa.me` → copiar) |
| [`main.tsx`](../../apps/web/src/main.tsx#L26) | Captura antes do `trackAccess`; `trackAccess` manda o `ref` |
| `OnboardingScreen.tsx` | Manda `referralCode` + `referralSource` no `register`; limpa `cdp_ref` no 201 |
| `router.tsx` | `/client/perfil/indique` (ao lado de `perfil/gancho`). O C7 já é `/client/creditos/extrato` |
| `packages/shared/.../banner.ts` | `indique: { route: '/client/perfil/indique', label: 'Indique e ganhe' }` |

## 9. Frontend admin — segue o handoff (D-9)

| Tela | Componente no handoff | Arquivo no app | Notas |
|---|---|---|---|
| **A1** Card na Gestão | `RAGestaoCard` | `AdminGestao.tsx` | **Primeiro** card do hub, ícone `gift` em `gold-soft`. O `HubCard` ganha selo em texto ("3 em análise"), além do número que já existe |
| **A2** Hub | `RAHub` | `gestao/AdminIndicacao.tsx` (novo) | AppBar com atalho `trend` → relatório; segmento Configuração · Indicações (contagem em análise) |
| **A3** Configuração | `RAConfig` | `gestao/IndicacaoConfig.tsx` (novo) | Estados: `off`, `zeroErr`, `noGoals`, `msgErr`, `bonusWarn`, `saving`, `saved`. Multiplicador em botões 2×–5× + frase ao vivo ("ganha 10 em vez de 5"); metas com lixeira e "Adicionar meta" (desabilita em 5); chips que inserem variáveis; prévia em balão. Steppers com **44 px** (o `Stepper` do protótipo tem 34 — o handoff pede aumentar) |
| **A4** Indicações | `RAList` + `RADetail` | `gestao/IndicacoesLista.tsx` + `gestao/IndicacaoDetalheSheet.tsx` (novos) | Chips: Em análise (com contagem) · Aguardando (inclui cadastro) · Recompensadas · Recusadas · Expiradas · Todas; busca; sinais em `warn-soft`; card em análise com borda dourada. Sheet com as duas pessoas, valores congelados e linha do tempo ("aguardando você"). Aprovar com confirmação; recusar com motivo + detalhe, botão em `warn` |
| **A5** Detalhe do cliente | `RAClientGeral` + `RALinkSheet` | `ClientDetailView.tsx` + `components/admin/IndicacoesCard.tsx` + `VincularIndicacaoSheet.tsx` (novos) | "Indicado por João Silva ›" logo abaixo de "Membro desde"; sem indicação, a linha vira "Vincular indicação". Card com o código do cliente, fez / valeram / ganhos e lista. Sheet: válido, inválido, próprio cliente, sucesso. `TX_LABEL` ganha os 3 tipos |
| **A6** Relatório | `RAReport` | `gestao/RelIndicacoes.tsx` (novo) + item em `AdminRelatorios.tsx` ("Aquisição & clientes") | Também abre pelo atalho do A2. Período no padrão dos outros relatórios |
| **A7** Condomínios | `RACondoInterests` | `AdminCondos.tsx` | Seção "Pedidos de novos condomínios" abaixo da lista; grupo expansível; pill "N por indicação"; "Marcar como tratado" / "Reabrir"; grupo tratado esmaecido |
| **A8** Preferências | `RANotifPrefs` | `AdminNotificacoes.tsx` + `AdminNotificationsScreen.tsx` | 3 toggles com selo "novo"; "Indicação recompensada" desligado por padrão (D-14); tom e ícone dos 3 tipos de admin |

---

## 10. Ondas de implementação

| Onda | Conteúdo | Depende de |
|---|---|---|
| **0 ✅** | Correções prévias (abaixo) | — |
| **1 ✅** | **Design no Claude Design → handoff** (§11) | — |
| **2 ✅** | Fundação: schema, `ensure-indexes`, seeds, `referral-config`, `referral-code`, `tx-retry` | — |
| **3 ✅** | Cadastro e vínculo: `RegisterSchema`, `attach`, validação pública, `markVerified`, `REFERRAL_SIGNUP` | 2 |
| **4 ✅** | Qualificação e recompensa: `referral.ts`, 4 pontos de entrega, varredura, metas, campanha, convite, avisos, `summary`/`me`/`celebration` | 2, 3 |
| **5 ✅** | Telas do cliente (§8), incluindo C6 e C7 conforme D-17 | 3, 4 |
| **6 ✅** | Telas do admin + endpoints admin (§9) | 4 |
| **7 ✅** | Relatório, funil, `TYPE_META`, linha no DRE | 4 |
| **8 ✅** | Lista de espera de condomínio (C8 + A7) | 2 |
| **9 ✅** | Verificação: typecheck, testes, build, UAT (§15) | todas |

### Onda 0 — correções prévias ✅ (28/09/2026, sem commit)

| Correção | Arquivos | Resultado |
|---|---|---|
| **Crédito em dobro** | `payments.repository.ts` (`claimAndCreditPurchase`), `credit-payment.ts`, `payments.service.ts`, `notify-credit-purchase.ts` | PAID + crédito numa transação guardada por status (retry em P2034). O cartão salvo e a recarga automática passam pelo mesmo ponto do webhook. REFUNDED não é recreditado. Um aviso ao admin por compra |
| **Bloqueio** | `auth.service.ts`, `auth.repository.ts`, `admin-clients.service.ts`, `LoginScreen.tsx` | OTP, reset e refresh recusam conta bloqueada (403). Bloquear revoga as sessões. Janela residual ≤ 15 min (access token stateless, por escolha do projeto) |
| **OTP duplicado** | `auth.service.ts` | `register` não envia mais código; o envio é só o `POST /auth/otp/send` que a tela já faz. Tela intacta, dev (1234) igual |
| **IP real no rate limit** | `server.ts` | `trustProxy: 1`. Cada cliente passa a ter o próprio limite. Nginx sem alteração (detalhes abaixo) |

Testes: `credit-payment.test.ts` (+7), `payments.service.test.ts` (+1), `webhooks.service.test.ts`
(+1), `auth.service.test.ts` (+5), `admin-clients.service.test.ts` (+2).

#### IP real no rate limit ✅ (corrigido no código — ⏳ falta deploy)

**O problema.** O Fastify não tinha `trustProxy`
([server.ts:60](../../apps/api/src/server.ts#L60)) e enxergava o endereço do proxy em toda
requisição. **Todos os clientes dividiam o mesmo limite:** 200/min geral, 5 OTP/min, 10 logins/min.
Qualquer um conseguia esgotar esses limites de propósito e bloquear o login de todos por 1 minuto.
Os limites da §7.7 e da §7.11 dependem desta correção.

**Diagnóstico (28/09/2026):**
- as 6.253 requisições das 24 h anteriores chegaram todas de `172.30.0.1`, o gateway da rede Docker;
- a API está atrás do `nginx/1.18.0 (Ubuntu)` do próprio host: `api.cheirindepao.com.br` →
  `64.227.99.152` (DigitalOcean, sem CDN na frente);
- o `location /` do site (`/etc/nginx/sites-available/app_cheirin_pao_backend_prod`, ligado por
  symlink em `sites-enabled`) faz `proxy_pass http://127.0.0.1:8005` + `include proxy_params`;
- esse `proxy_params` já manda `Host $http_host`, `X-Real-IP $remote_addr`,
  `X-Forwarded-For $proxy_add_x_forwarded_for` e `X-Forwarded-Proto $scheme` → **o Nginx não
  precisa de alteração**;
- a porta 8005 não responde de fora (a conexão expira), então a única entrada é pelo Nginx.

**Correção:** `trustProxy: 1`, ou seja, confiar em exatamente um salto (o Nginx). O `request.ip`
passa a ser o último endereço do `X-Forwarded-For`, justamente o que o Nginx acrescentou (o IP
real). Um valor forjado pelo cliente fica à esquerda e é ignorado. Nenhum código lê `request.ip`,
`protocol` ou `hostname`; só o rate limit e o log mudam.

**Simulação** (Fastify 5.8.5 + `@fastify/rate-limit`, limite 2, chegando de `172.30.0.1`):

| Situação | Sem `trustProxy` | Com `trustProxy: 1` |
|---|---|---|
| Cliente B depois de A esgotar o limite | 429 | 200 |
| A forjando `X-Forwarded-For: 9.9.9.9` | continua 429 | continua 429 (identificado pelo IP real) |

**Cuidados:**
- `true` confiaria no IP que o cliente escrever.
- Se a frente mudar (Cloudflare, outro proxy) ou a porta 8005 for aberta para a internet, o valor
  precisa ser revisto.
- Endurecimento opcional: publicar a porta só no loopback (`127.0.0.1:${APP_PORT}:3001` no compose
  da API). Hoje quem protege a porta é o firewall, e o Docker passa por cima do `ufw`. Antes, conferir
  que nenhum outro serviço do servidor chama a API pelo IP da máquina.

**Verificação depois do deploy** — os mesmos comandos do diagnóstico:
- **No servidor (definitivo):**
  ```bash
  docker ps --format '{{.Names}}'   # confirma o nome do container (sem permissão? use sudo)
  docker logs --since 24h app_cheirin_pao_backend_prod \
    | grep -o '"remoteAddress":"[^"]*"' | sort | uniq -c | sort -rn | head
  ```
  - um endereço só (ex.: `172.30.0.1`) = limite compartilhado — a correção ainda não está no ar;
  - vários IPs públicos = corrigido.

  O Fastify loga `remoteAddress: req.ip`, a mesma chave do rate limit. **Sem `2>&1`:** um erro do
  Docker ("permission denied", "No such container") tem que aparecer na tela, não ser engolido pelo
  `grep`. O `docker logs` só guarda o que aconteceu desde o último deploy (o container é recriado).
  Para ver se alguém já foi barrado:
  `docker logs --since 24h app_cheirin_pao_backend_prod | grep -c '"statusCode":429'`.
- **Sem acesso ao servidor:** `curl -s -o /dev/null -D - https://api.cheirindepao.com.br/health | grep -i x-ratelimit`,
  duas vezes com alguns segundos de intervalo. Com o limite por cliente, `x-ratelimit-remaining`
  cai 1 por requisição sua, e só isso.

### Onda 2 — fundação ✅ (28/09/2026, sem commit)

| Peça | Arquivos | Resultado |
|---|---|---|
| **Schema** | `prisma/schema.prisma` | `ReferralStatus`, `Referral`, `ReferralMilestone`, `CondoInterest` (§5); `User.referralCode` / `referralInviteAt` / `referralCardDismissedAt`; `TransactionType` +3; `NotificationType` +7; `AnalyticsEvent.refCode`. `prisma validate` + `format` + `generate`. O `format` realinhou o bloco do `User` (só espaço) |
| **Índice parcial** | `lib/ensure-indexes.ts` | `User.referralCode_1` único com `partialFilterExpression: { referralCode: { $type: 'string' } }` |
| **Seeds** | `bootstrap/defaults-seed.ts` (`seedReferralDefaults`), `server.ts` | As 9 chaves `indicacao*` com `update: {}`; valores saem de `REFERRAL_DEFAULTS` (semente = fallback da leitura) |
| **Config** | `lib/referral-config.ts` | `getReferralConfig` (um `findMany`, parse defensivo, nunca lança), `activeCampaign`, `currentRewardBreads`, `REFERRAL_SETTING_KEYS` |
| **Código** | `lib/referral-code.ts` | `generateCode` (CSPRNG), `codePrefix`, `normalizeCode`, `shortName`, `firstName`, `ensureReferralCode` (claim `null` OU ausente + retry em P2002/E11000, até 5) |
| **Retry** | `lib/tx-retry.ts`, `payments.repository.ts` | `withWriteConflictRetry` + `isWriteConflict`; `claimAndCreditPurchase` passou a usar (testes da Onda 0 intactos) |
| **Shared** | `packages/shared/src/referral.ts` | Alfabeto, `normalizeReferralCode`, `splitReferralCode`, `REFERRAL_LIMITS` (D-13), `DEFAULT_REFERRAL_MESSAGE`, `renderReferralMessage` (= `refMsg`), `referralMessageHasCodeOrLink`, `referralMessageBonusWarning`, `breadsLabel` (= `paez`), `ReferralCampaignSchema`, `ReferralGoalsSchema` |

Testes: `lib/__tests__/tx-retry.test.ts` (5), `referral-code.test.ts` (17), `referral-config.test.ts`
(13, inclui o seed); `packages/shared/src/__tests__/referral.test.ts` (16).

### Onda 3 — cadastro e vínculo ✅ (28/09/2026, sem commit)

| Peça | Arquivos | Resultado |
|---|---|---|
| **Cadastro** | `auth.schema.ts`, `auth.route.ts`, `auth.service.ts` | `referralCode` (trim, até 20) e `referralSource` (`LINK`/`CODE`) opcionais, com `.catch(undefined)`: valor adulterado é descartado, nunca 400. JSON schema documenta sem `maxLength`/`enum` (senão o Fastify recusaria antes do Zod). `register` chama `attachReferralAtSignup` depois do `createUser`, dentro de `try/catch` |
| **Login** | `auth.service.ts` | `markReferralVerified` depois de `issueTokens` em `verifyOtpAndCreateSession`, `loginWithPassword` e `resetPasswordWithOtp`. Refresh e login recusado não marcam |
| **Regra** | `lib/referral.ts` (novo) | `findCodeOwner`, `isValidOwner` (CLIENT não bloqueado), `checkPublicCode`, `createReferral` (congela X × campanha, Y, rótulo, prazo; todas as chaves; P2002 no `referredId` → `null`), `attachReferralAtSignup` (best-effort, nunca lança), `markReferralVerified` (claim `verifiedAt: null` → `REFERRAL_SIGNUP` com o valor congelado; nunca lança) |
| **Rotas públicas** | `modules/referrals/` (novo), `server.ts` | `GET /referrals/config` → `{ active, welcomeBreads }` (erro → inativo, o cadastro não trava); `GET /referrals/code/:code` (10/min) → `{ valid, referrerName?, welcomeBreads? }` |

Testes: `auth.service.test.ts` (+8, com `lib/referral.js` mockado), `lib/__tests__/referral.test.ts`
(16), `modules/referrals/__tests__/referrals.route.test.ts` (4 — primeiro teste de rota por
`inject` do projeto, para pegar campo fora do response schema).

### Onda 4 — qualificação e recompensa ✅ (28/09/2026, sem commit)

| Peça | Arquivos | Resultado |
|---|---|---|
| **Qualificação** | `lib/referral.ts` | `qualifyReferral(fastify, referredId, now)` → `NONE` \| `PENDING` \| `EXPIRED` \| `ON_HOLD` \| `REWARDED`. 1ª entrega (pão ou Cestinha, `deliveredAt ?? scheduledDate` em código) até o prazo + pagamento PAID sem gancho ≥ mínimo (filtrado em código). Não fechou e o prazo passou → `EXPIRED` |
| **Sinais** | `lib/referral.ts` (`computeReferralFlags`, `REFERRAL_FLAG_LABELS`) | `SAME_ADDRESS` (condomínio + bloco + complemento + apto normalizados), `SAME_DEVICE` (qualquer `Session.deviceId` em comum), `OVER_LIMIT` (mês BRT), `REFERRER_BLOCKED` → `ON_HOLD` + `ADMIN_REFERRAL_REVIEW` |
| **Recompensa** | `lib/referral.ts` (`rewardReferral`) | Transação com `withWriteConflictRetry`: claim `updateMany({ id, status: from })` → `REWARDED`; `REFERRAL_BONUS` (valor congelado) + `REFERRAL_WELCOME` se > 0, `referenceId = referral.id`. Depois: `REFERRAL_REWARD`, `REFERRAL_WELCOME`, `ADMIN_REFERRAL_REWARDED` (cada um best-effort) e a meta. Aceita `ON_HOLD` + `reviewerId` (aprovação, Onda 6) |
| **Metas** | `lib/referral.ts` (`grantMilestoneForReward`) | Paga quando ESTA recompensa é a N-ésima (posição por `rewardedAt`, desempate pelo id) e há meta em N. `ReferralMilestone` único → P2002 = já pago. Não retroativa por construção |
| **Convite** | `lib/referral.ts` (`sendReferralInvite`) | Lê `referralInviteAt` antes (quem já foi convidado sai com 1 consulta); programa ligado → claim `null`/ausente → `REFERRAL_INVITE` |
| **Gatilho** | `admin-orders.service.ts` (`updateOrderStatus`, `resolveStuckOrder`, `resolveStuckMarketOrder`), `courier.service.ts` (`confirmMarketDelivery`, só com `moved > 0`) | `afterDelivery(fastify, userId)`: qualifica + convida, nunca lança |
| **Varredura** | `plugins/cron.ts` (`daily-jobs`) | `sweepReferrals` em `try/catch` próprio; reavalia toda `PENDING` e loga as contagens |
| **Comemoração** | `lib/referral.ts` (`buildCelebration`, `markCelebrationSeen`) | `friend` → `goal` → `multi` → `referrer`; devolve `seen` (o que marcar ao fechar) |
| **Rotas** | `modules/referrals/*` | `GET /referrals/summary`, `GET /referrals/me`, `POST /referrals/celebration/seen`, `POST /referrals/home-card/dismiss` (CLIENT), com response schema completo |
| **Prefs do admin** | `admin-notification-prefs.schema.ts` (+3 tipos, `DEFAULT_OFF_ADMIN_NOTIFICATION_TYPES`, `isAdminNotificationOn`), `…service.ts` (`fill`), `notifications.service.ts` (`notifyAdmins`) | `ADMIN_REFERRAL_REWARDED` nasce desligado; os outros dois, ligados. A tela (A8) é da Onda 6 |

Testes: `lib/__tests__/referral-reward.test.ts` (37, com um "banco" em memória que simula a trava por
status e o índice único das metas), `admin-orders-referral.test.ts` (4), `courier-referral.test.ts`
(3), `referrals.service.test.ts` (7), `referrals.client-routes.test.ts` (7), prefs (+2), `notifyAdmins` (+1).

### Onda 5 — telas do cliente ✅ (28/09/2026, sem commit)

| Peça | Arquivos | Resultado |
|---|---|---|
| **Base visual** | `styles/globals.css`, `components/brand/Icon.tsx` | `--color-warn-soft: #F6E0DC`; `@keyframes cdp-spin` + `.cdp-spin`; ícones `share`, `copy`, `link`, `chat`, `target`, `ticket` (paths do `brand.jsx`) |
| **Infra** | `lib/referral.ts` (novo), `hooks/useReferralSummary.ts` (novo), `main.tsx`, `routes/router.tsx`, `shared/.../banner.ts` | Captura do `?ref=` (30 dias, limpa a URL, descarta lixo) antes do `trackAccess`; `buildReferralLink` (origem do app), `buildReferralMessage` (shared), `whatsappShareUrl`, `copyText`, `shareReferral` (Web Share → copiar), `checkReferralCode`. Resumo com cache de módulo por usuário (30 s) + `patchReferralSummary`. Rota `/client/perfil/indique`; banner `indique` |
| **Kit** | `components/client/referral/` | `RefPrimitives` (`RefCard`, `RefPill`, `RefSection`, `RefSkel`, `REF_STATE`, `RefStatePill`), `RefCode` (2 grupos, `role="img"` + `aria-label` soletrado) + `RefCodeCard` ("Copiado!" 1,8 s), `RefShareButtons`, `RefItem` |
| **C1** | `pages/client/ReferralScreen.tsx` | Os 8 estados a partir do `/referrals/me`; "Como funciona" sobe com a lista vazia; Regras com `aria-expanded`; toast `role="status"`; voltar → Perfil |
| **C2** | `ProfileMenuRow.tsx` (`tone="gold"`, `badgeTone`, `badgeIcon`), `SettingsScreen.tsx` | Seção entre Pedidos e Conta; selo campanha (`spark`) > "novo" (`isNew`); desligado some, menos para quem tem histórico (A-4) |
| **C3** | `components/client/ReferralHomeCard.tsx`, `HomeScreen.tsx` | Entre `QuickActions` e `MarketHomeBlock`; variante campanha; X de 44 px grava no servidor e some na hora |
| **C4** | `components/auth/ReferralCodeField.tsx` (novo), `OnboardingScreen.tsx` | `useSignupReferral` + `ReferralBadge` + `ReferralCodeToggle` + `ReferralCodeField`. Link conferido → selo acima do título com "Trocar"; sem link → "Tenho um código…". Valida ao sair; Continuar só trava validando. `register` leva `referralCode`/`referralSource`; `cdp_ref` limpo no 201 |
| **C5** | `components/client/ReferralCelebration.tsx`, `ClientLayout.tsx` | 4 variantes; `role="dialog"`, `aria-modal`, `aria-labelledby`, foco no CTA, trap de foco, Esc, volta do foco. Fila: tutorial → gancho (`hookChecked`) → comemoração → banner (espera o resumo). Fechar → `POST /celebration/seen`; uma por abertura |
| **C6** | `NotificationsScreen.tsx` | `getTone`/`getIcon`/`CTA_CONFIG` dos 4 tipos; para todos os avisos: ícone em círculo, borda dourada no novo, texto espresso no botão dourado |
| **C7** | `CreditHistoryScreen.tsx` | Cabeçalho espresso (saldo do `useAuth` + "+N este mês" do resumo); grupos por dia BRT; ícone/título por tipo; selo "Bônus"; compra em verde, uso em neutro com "−"; rodapé. `/credits/history` intacta |

Testes (web, +60): `lib/__tests__/referral.test.ts` (12), `RefCode.test.tsx` (3), `ProfileMenuRow.test.tsx`
(2), `ReferralScreen.test.tsx` (10), `ReferralCodeField.test.tsx` (8), `ClientLayout.referral.test.tsx` (6),
`ReferralCelebration.test.tsx` (6), `ReferralHomeCard.test.tsx` (4), `NotificationsScreen.test.tsx` (+5),
`CreditHistoryScreen.test.tsx` (4). Os testes antigos das telas passaram sem mudança.

### Onda 6 — admin ✅ (29/09/2026, sem commit)

| Peça | Arquivos | Resultado |
|---|---|---|
| **Recusa** | `lib/referral.ts` (`rejectReferral`, `REFERRAL_REJECT_REASONS`) | Só `ON_HOLD → REJECTED` (D-12), trava por status no `updateMany`; grava motivo, detalhe, `reviewedById`/`reviewedAt`. Sem aviso ao cliente (ele vê "Não valeu") |
| **Config (A3)** | `admin-settings.schema.ts` (`UpdateReferralSettingsSchema`), `…service.ts` (`getReferralSettings`/`setReferralSettings`), `…controller.ts`, `…route.ts` | `GET/PATCH /admin/settings/indicacao`. Forma (faixas da D-13, schemas do shared) → 400; regra de negócio → 422: ligar com recompensa 0, mensagem sem `{codigo}`/`{link}`, campanha nova/alterada terminando antes de hoje. Grava as 9 chaves numa transação e devolve o que a leitura enxerga. GET traz `unitPrice` (≈ R$) e `today` |
| **Preço do pãozin** | `lib/bread-price.ts` (novo) | `estimateBreadUnitPrice`: R$ pagos em pão ÷ pães comprados (a conta do passivo/DRE); sem vendas → avulso; sem nada → 0 |
| **Admin das indicações** | `modules/admin-referrals/` (novo), `server.ts` | `GET /admin/referrals/summary` (selo do A1/A2), `GET /admin/referrals?state&q&page` (20 por página, "Em análise" da mais antiga, busca por qualquer das duas pessoas, contagem global por chip), `GET /admin/referrals/:id` (pessoas, sinais, valores congelados, linha do tempo com o 1º pagamento sem gancho e a 1ª entrega), `POST …/approve` (`rewardReferral` a partir de ON_HOLD), `POST …/reject`, `GET /admin/clients/:id/referrals` (gera o código se faltar), `GET …/referral-code-check`, `POST /admin/clients/:id/referral` (vínculo manual `ADMIN`, avaliado na hora) |
| **A1** | `tabs/AdminGestao.tsx` | Primeiro card do hub, `gift` em `gold-soft`, selo em texto "N em análise" (`HubCard` ganhou `gold` e `badgeText`) |
| **A2** | `gestao/AdminIndicacao.tsx` (novo) | AppBar com o atalho `trend` (abre o A6 — ligado na Onda 7), segmento Configuração · Indicações com a contagem em análise |
| **A3** | `gestao/IndicacaoConfig.tsx` (novo) | Os estados do handoff (`off`, `zeroErr`, `noGoals`, `msgErr`, `bonusWarn`, `saving`, `saved`); steppers de 44 px; multiplicador 2×–5× com a frase ao vivo; metas editáveis com lixeira e "Adicionar meta" (trava em 5); chips que inserem no cursor; prévia com `renderReferralMessage` (shared) e o link real |
| **A4** | `gestao/IndicacoesLista.tsx`, `gestao/IndicacaoDetalheSheet.tsx` (novos) | Chips (Em análise com contagem), busca, cards com sinais e borda dourada em análise, vazio por filtro, "Carregar mais". Sheet com as pessoas (atalho → aba Clientes pelo evento `cdp:open-admin-client`), valores congelados, linha do tempo "aguardando você"; aprovar com confirmação; recusar com motivo (o 1º sinal sugere) + detalhe, botão `warn`; 409 recarrega |
| **A5** | `components/admin/IndicacoesCard.tsx`, `VincularIndicacaoSheet.tsx` (novos), `ClientDetailView.tsx`, `tabs/AdminClientes.tsx` | "Indicado por João Silva ›" abaixo de "Membro desde" (abre o outro cliente; `key` recomeça a tela) ou "Vincular indicação"; card com código, fez / valeram / ganhos e a lista; sheet com válido/inválido/próprio/sucesso, conferindo enquanto digita. `TX_LABEL` + 3 tipos |
| **A8** | `gestao/AdminNotificacoes.tsx`, `AdminNotificationsScreen.tsx` | 3 toggles com selo "novo" ("recompensada" chega desligada do servidor — D-14); tom e ícone dos 3 avisos |
| **Kit** | `components/admin/referral/RaKit.tsx` (novo) | `RA_STATE`, `RaStatePill`, `RaSignal`, `RaChips`, `RaLabel`, `RaInline`, `RaSwitch` (48 × 28), `RaStepper` (44 px), `RaBtn` (+ `danger`), `RaSpinner`, `RaAppBar`, `RaSheet` (dialog, trap de foco, Esc, volta do foco) |

Testes (api, +51): `admin-settings.referral.test.ts` (9, Settings em memória), `admin-settings.referral-route.test.ts`
(6), `admin-referrals.service.test.ts` (24), `admin-referrals.route.test.ts` (12). Web (+35):
`IndicacaoConfig.test.tsx` (12), `IndicacoesLista.test.tsx` (10, inclui o sheet), `IndicacoesCard.test.tsx`
(9, inclui o vínculo), `AdminNotificacoes.test.tsx` (2), `AdminGestao.referral.test.tsx` (2).

### Onda 7 — relatório, funil e DRE ✅ (29/09/2026, sem commit)

| Peça | Arquivos | Resultado |
|---|---|---|
| **Movimentação de créditos** | `admin-reports/credit-movement.service.ts` | `TYPE_META` + `REFERRAL_BONUS` ("Bônus de indicação"), `REFERRAL_WELCOME` ("Boas-vindas de indicação"), `REFERRAL_GOAL` ("Meta de indicações"), todos de entrada |
| **DRE** | `lib/dre.ts` (`referralBonus`, `referralBonusCost`), `admin-financial/dre.service.ts` | "Bonificações de indicação" = pães `REFERRAL_*` creditados no período × preço médio histórico (o da receita por competência). Só na competência, logo depois do comercial; a ponte ganha a parcela própria e continua fechando. Meses fechados seguem no snapshot |
| **Funil** | `analytics.schema.ts`, `analytics.service.ts`, `analytics.route.ts`; web `lib/analytics.ts`, `main.tsx` | `trackAccess(ref)` manda o código capturado na carga; a API normaliza e grava em `AnalyticsEvent.refCode` (lixo → `null`, nunca 400) |
| **Relatório (API)** | `admin-reports/referrals-report.service.ts` (novo), controller, route | `GET /admin/reports/referrals` (período dos outros relatórios). Coorte: funil (visitantes únicos com código → cadastros → confirmados → recompensados), conversão, estados. Fluxo: pãezins (quem indicou + metas × amigos), custo, receita dos indicados (sem gancho, sem recusadas), "cada R$ 1 trouxe R$ X", top 5 |
| **A6** | `gestao/RelIndicacoes.tsx` (novo), `AdminRelatorios.tsx`, `AdminIndicacao.tsx` | KPIs 2 col + custo espresso com a divisão, funil com % de passagem, custo × receita, top 5, estados (barra empilhada + legenda); carregando, vazio e falha. Item em Aquisição & clientes; o atalho `trend` do hub abre o relatório e o voltar devolve ao hub |

Testes (api, +15): `credit-movement.service.test.ts` (+1), `dre.test.ts` (+5), `analytics.referral.test.ts`
(3), `referrals-report.service.test.ts` (6). Web (+5): `lib/__tests__/analytics.test.ts` (2),
`RelIndicacoes.test.tsx` (3).

### Onda 8 — lista de espera de condomínio ✅ (29/09/2026, sem commit)

| Peça | Arquivos | Resultado |
|---|---|---|
| **API** | `modules/condo-interests/` (novo), `server.ts` | `POST /condominiums/interest` (pública, 5/min): contato único — com "@" e-mail (minúsculo), senão celular em dígitos (`PhoneSchema`); inválido → 400 com a mensagem do campo; cidade obrigatória; CEP opcional (8 dígitos); `groupKey` = nome + cidade sem acento/minúsculos/espaços simples; código de indicação normalizado (lixo descartado); o mesmo contato no mesmo grupo não entra de novo; aviso `ADMIN_CONDO_INTEREST` best-effort ("Residencial Sol (Campinas) — 3º pedido."). `GET /admin/condominiums/interests` (grupos: em aberto → mais pedidos → recência) e `PATCH …/interests/handled` (grupo inteiro; 404 se não existe) |
| **C8** | `components/auth/CondoWaitlist.tsx` (novo), `CondoSearch.tsx` (`onNotListed`), `OnboardingScreen.tsx` | No passo "Onde você mora?", o vazio da busca vira o card do handoff com o botão dourado; a sub-tela toma a tela inteira, pré-preenchida (termo buscado, nome, e-mail). Enviando (campos esmaecidos + spinner), erro (`warn-soft`, "Seus dados continuam aqui", "Tentar de novo"), sucesso ("Anotado!" → "Voltar ao início"). Leva o código do link (`getStoredReferral`) e o `device_id` |
| **A7** | `components/admin/CondoInterestsSection.tsx` (novo), `AdminCondos.tsx` | "Pedidos de novos condomínios" abaixo da lista: grupo expansível (`aria-expanded`, o 1º aberto), "N por indicação", contatos (e-mail ou celular formatado, "· indicado", data), "Marcar como tratado" / "Reabrir"; tratado esmaecido com selo verde |

Testes (api, +15): `condo-interests.service.test.ts` (10), `condo-interests.route.test.ts` (5). Web (+11):
`CondoWaitlist.test.tsx` (7, inclui o card do `CondoSearch`), `CondoInterestsSection.test.tsx` (4).

### Onda 9 — verificação ✅ (29/09/2026, sem commit)

| Verificação | Resultado |
|---|---|
| Typecheck | `tsc --noEmit` limpo em `apps/api`, `apps/web` e `packages/shared` |
| Testes | api **1.672 passando + 3 todo** (base antes da Onda 6: 1.591) · web **357 + 17 todo** (base: 306) · shared **74 + 4 todo** |
| Build | `npm run build -w @cheirin-de-pao/api` (tsup) ✅ · `npm run build -w @cheirin-de-pao/web` (tsc + vite + service worker) ✅. O aviso `inlineDynamicImports` do vite já existia |
| Boot | API compilada (`node dist/server.js`, porta 3099) contra `cheirin-de-pao-teste`: sobe em ~5 s, `ensureIndexes` garante os índices, todas as rotas novas respondem (públicas 200/400; admin 401 sem token) — nenhum conflito entre `admin-referrals`, `condo-interests` e os módulos existentes. Nenhuma escrita no banco |
| UAT | Roteiro da §15 com a preparação e a cobertura automática — **fica com o usuário** |

**Ajustes durante o UAT (29/09/2026):**

| # | Item do UAT | Problema | Correção |
|---|---|---|---|
| U-1 | 4 (A4) | Chips de filtro das indicações não rolavam com o mouse no desktop: "Expiradas" e "Todas" ficavam fora de alcance (a barra de rolagem é escondida) | `RaChips` passou a usar o `useDragScroll` (o mesmo dos `FilterChips`): arrastar rola, e o clique depois do arraste não troca o filtro |


---

## 11. Etapa de design — Claude Design → handoff (Onda 1) ✅

**Por quê:** fidelidade alta é mandatória no projeto. As telas não existiam no handoff original,
então passaram pelo mesmo fluxo do Além do Pãozin: brief → Claude Design → handoff → implementação.

1. ✅ **Brief:** [`brief-telas-indique-e-ganhe.md`](../brief-telas-indique-e-ganhe.md).
2. ✅ **Handoff salvo** em [`.projeto/design_handoff_indique_e_ganhe/`](../design_handoff_indique_e_ganhe/README.md),
   cópia fiel do pacote do Claude Design:
   - `README.md` — especificação completa (a referência de textos e estados);
   - `design/Indique e Ganhe - Telas.html` — quadro com todas as telas e estados (abrir no navegador);
   - `design/Cheirin de Pão - App.html` — protótipo navegável com a feature integrada;
   - `design/app/screens-referral*.jsx` — as telas; `brand.jsx` (tokens e ícones); `data.jsx`
     (mocks e `refMsg`);
   - `screenshots/` — 11 prints, um por grupo de telas.

   **Não foi mesclado** em `design_handoff_cheirin_pao/`: o pacote traz versões alteradas de
   arquivos daquele protótipo (inclusive mudanças do Além do Pãozin que nunca foram salvas lá), e
   misturar apagaria o registro do handoff original.
3. ✅ **Conferência handoff × plano (28/09/2026).** Todas as telas da §8/§9 têm design, com os
   estados da §4.2 e da §4.8. O que o handoff mudou ou acrescentou, já incorporado:

   | # | Adendo | Onde |
   |---|---|---|
   | A-1 | Terceiro tipo de lançamento (meta) | D-10, §5 |
   | A-2 | Chaves de estado e rótulos distintos para cliente e admin | §4.2 |
   | A-3 | Card da Home fechado no servidor | D-11, §5, §7.7 |
   | A-4 | Programa desligado: o handoff tira a seção do Perfil; o plano a mantém para quem tem histórico — senão a tela "pausada", que o próprio handoff prevê, fica sem porta de entrada | §4.8 |
   | A-5 | Só "Em análise" tem ações; recusa com motivo + detalhe obrigatório | D-12, §7.8 |
   | A-6 | Faixas dos controles do admin | D-13, §6 |
   | A-7 | Aviso "recompensada" desligado por padrão | D-14, §7.9 |
   | A-8 | Contato único na lista de espera; cidade obrigatória; tratar/reabrir por grupo | D-15, §5, §7.11 |
   | A-9 | Rótulo da campanha congelado | D-16, §5 |
   | A-10 | Token `warn-soft`, 6 ícones novos, spinner | §8.0 |
   | A-11 | Endpoint `summary` para as entradas (C2, C3, C5, C7) e `celebration` com prioridade | §7.7 |
   | A-12 | Compra mínima: texto do handoff × regra no pagamento | §4.3 |
   | A-13 | "Ver saldo" leva ao extrato, não à Home | §7.9 |
   | A-14 | Redesenho da central de notificações e do extrato — só a parte de front (sem o detalhe do pagamento) | D-17 |
   | A-15 | "Pãezins ganhos" (C1) soma também as metas | §7.7 |
   | A-16 | O link "Validar" e a dica "JOAO7K2F é válido" no cadastro são só do protótipo | §8.1 |
   | A-17 | "Ver saldo"/"Indicar mais" do C5 e ícones/tons do C6 conforme o handoff | §7.9, §8.1 |

4. **Porta:** liberada — as Ondas 5, 6 e 8 já podem usar o handoff.
5. Divergências entre handoff e implementação vão para a §18.

---

## 12. Testes

| Arquivo | Casos principais |
|---|---|
| `lib/__tests__/referral-code.test.ts` | Formato, normalização, nomes com acento/curtos, colisão → nova tentativa |
| `lib/__tests__/referral-config.test.ts` | Padrões, valores fora das faixas da §6 caem no padrão, JSON quebrado de campanha/metas |
| `lib/__tests__/referral.test.ts` | Vínculo no cadastro (válido, inválido, bloqueado, programa desligado, erro não derruba); qualificação (sem entrega, sem pagamento, só gancho, abaixo do mínimo, vencida); cada sinal → ON_HOLD; mesmo condomínio outro apto → paga; corrida de duas entregas → **uma** recompensa; P2034 → retry; bônus 0 → só quem indica; campanha (multiplicador e rótulo congelados); meta cruzada paga uma vez (P2002); meta não retroativa; convite uma vez na vida; `buildCelebration` respeita a prioridade |
| `lib/__tests__/referral-message.test.ts` | `renderReferralMessage` = `refMsg` do handoff: variáveis, Y = 0 remove o trecho padrão, mensagem personalizada |
| `auth.service.test.ts` | `register` com código chama o vínculo e não falha se ele lança; login marca `verifiedAt` |
| `admin-orders` / `courier` | Os 4 pontos chamam `afterDelivery` só em DELIVERED |
| `admin-referrals` | Aprovar e recusar só ON_HOLD; recusa exige detalhe; vínculo manual (já tem indicação, próprio cliente, código inválido) |
| `admin-settings` | Validação da §6; não liga com recompensa 0; mensagem sem `{codigo}`/`{link}` → 422 |
| `admin-notification-prefs` | `ADMIN_REFERRAL_REWARDED` nasce desligado |
| `condominiums` | Contato único: e-mail, celular, inválido; `groupKey`; reabrir grupo |
| `admin-reports` | Funil e custos com fixtures |
| `dre` | Linha nova só com `REFERRAL_*` do período |
| web | `lib/referral.ts` (captura, validade, `share` com fallbacks); `ReferralScreen` (os 8 estados); `RefCode` (grupos + `aria-label`); `ReferralCodeField` (estados; Continuar só trava validando); `ProfileMenuRow` (`tone="gold"`); fila de overlays do `ClientLayout`; `OnboardingScreen` manda `referralCode` |

## 13. Riscos e armadilhas

| Risco | Mitigação |
|---|---|
| `null` × chave ausente no Mongo | `Referral` nasce com todas as chaves; em `User` ler por `select` + `?? null`; `referralCode` nunca `null` |
| Índice único em `User.referralCode` quebrar o `db push` | Índice **parcial** em `ensure-indexes.ts`, fora do schema |
| Recompensa em dobro | Claim por status na mesma transação + retry P2034; metas com `@@unique` |
| Resposta perdendo campo novo | Declarar tudo no JSON schema da rota (allowlist do `fast-json-stringify`) |
| Link perdido no iPhone | Campo digitável + código escrito na mensagem |
| Rate limit sem efeito atrás do Nginx | Corrigido na Onda 0 (`trustProxy: 1`); conferir nos logs depois do deploy |
| Autoindicação na família | `SAME_ADDRESS` + `SAME_DEVICE` → análise |
| Custo fora de controle | Limite mensal → análise; desligar a qualquer momento; relatório de custo |
| Botão da notificação in-app ignorando rota | Entradas em `CTA_CONFIG` por tipo |
| PWA antigo em cache | Campos novos opcionais em todos os schemas; `/credits/history` continua array |
| Latência na confirmação do entregador | `afterDelivery` sai com uma `findUnique` quando não há indicação; nunca lança |
| DRE de mês fechado mudando | Meses fechados leem o snapshot |
| Dois overlays na abertura | Fila única com prioridade no `ClientLayout` (tutorial → gancho → comemoração → banner) |
| Regressão em telas existentes (D-17) | Redesenho só de front, sem tocar em API nem comportamento; testes das telas continuam passando; conferir no UAT (§15, item 16) |

## 14. Acessibilidade (handoff §7)

- Todo estado tem **ícone + texto** no selo; os sinais do admin levam ícone de alerta.
- Código com `aria-label` soletrado; "Copiado!" e toast em `aria-live` / `role="status"`; erros em
  `role="alert"`.
- Modais e sheets com `role="dialog"` + `aria-modal`, trap de foco e volta do foco ao gatilho.
- Alvos ≥ 44 px: fechar, lixeira, "Trocar", link do código, botões de compartilhar (48) e steppers.

## 15. Para validar no app (UAT)

**Preparação.**
- Admin: Gestão › Indique e Ganhe › Configuração — defina X ≥ 1, **Y > 0** (para ver os textos do
  bônus do amigo) e ligue o programa. Para o item 9, crie uma campanha que inclua hoje e uma meta baixa
  (ex.: na 1ª indicação, +2).
- Duas contas de cliente de teste, em apartamentos **diferentes** do mesmo condomínio (no mesmo
  apartamento a indicação vai para análise — é o item 7).
- Item 5 precisa de pagamento aprovado (Pix de teste) e de entrega confirmada pelo entregador ou pelo
  admin. Item 8 (prazo) só fecha na varredura das 00:00 BRT — dá para testar com prazo de 1 dia.

**Cobertura automática** (o UAT confirma o que o teste não vê: visual, push, fluxo real no aparelho):

| Itens | Já coberto por teste |
|---|---|
| 1, 12 | `IndicacaoConfig.test.tsx`, `admin-settings.referral*.test.ts`, `ProfileMenuRow`/`SettingsScreen` |
| 2 | `ReferralScreen.test.tsx`, `RefCode.test.tsx`, `lib/__tests__/referral.test.ts` |
| 3, 4 | `ReferralCodeField.test.tsx`, `referrals.route.test.ts`, `referral.test.ts` (api) |
| 5, 6, 10 | `referral-reward.test.ts`, `admin-orders-referral.test.ts`, `courier-referral.test.ts`, `ReferralCelebration.test.tsx`, `ClientLayout.referral.test.tsx` |
| 7, 8, 17 | `referral-reward.test.ts` (sinais, limite, prazo), `admin-referrals.*.test.ts`, `IndicacoesLista.test.tsx`, `auth.service.test.ts` |
| 9, 11 | `referral-reward.test.ts` (campanha, metas), `ReferralHomeCard.test.tsx`, `referrals.client-routes.test.ts` |
| 13 | `admin-referrals.service.test.ts` (vínculo), `IndicacoesCard.test.tsx` |
| 14 | `referrals-report.service.test.ts`, `RelIndicacoes.test.tsx`, `dre.test.ts` |
| 15 | `condo-interests.*.test.ts`, `CondoWaitlist.test.tsx`, `CondoInterestsSection.test.tsx` |
| 16 | `NotificationsScreen.test.tsx`, `CreditHistoryScreen.test.tsx` (os testes antigos seguem passando) |

1. Admin configura X, Y, limite, prazo, campanha, metas e mensagem (com prévia) e liga o programa; o cliente vê a seção no Perfil com o selo "novo".
2. Cliente abre a tela: código em 2 grupos, "Copiar" → "Copiado!", WhatsApp com a mensagem certa, "Mais opções" (menu do celular), "Copiar link" → "Link copiado".
3. Amigo abre o link → selo "Indicado por João M." acima do título, com o bônus; conclui; quem indicou recebe "Sua indicação chegou!".
4. Amigo digita o código à mão → válido (borda verde + selo); código errado → aviso suave e o Continuar segue livre.
5. Amigo compra e recebe a 1ª entrega (entregador confirma) → X para quem indicou, Y para o amigo, avisos, comemoração nos dois apps ("Indicar mais" / "Ver meu saldo"), extratos com o selo "Bônus".
6. Mesmo fluxo pela Cestinha e pela resolução de pedido parado.
7. Amigo no mesmo apartamento → "Em análise" (cliente) e sinal "Mesmo apartamento" (admin); aprovar → paga; recusar com motivo → cliente vê "Não valeu".
8. Limite mensal estourado → análise. Prazo vencido → "Prazo encerrado" no dia seguinte.
9. Campanha ativa → selo no hero, no Perfil e na Home; X multiplicado e "em dobro" na lista; meta cruzada → comemoração "Meta atingida" e bônus uma vez.
10. Várias recompensas enquanto o cliente estava fora → uma comemoração "multi".
11. Card da Home: só depois da 1ª entrega; fechar → some por 30 dias, também em outro aparelho.
12. Desligar o programa → entradas somem; quem tem histórico vê a tela "pausada"; pendências continuam e pagam.
13. Admin vincula indicação manualmente (válido, inválido, próprio cliente).
14. Relatório: funil, custos, "cada R$ 1 trouxe R$ X", top 5 e distribuição batem com os casos acima; linha no DRE.
15. Condomínio não atendido → "Meu condomínio não está aqui" → formulário pré-preenchido → admin vê o grupo em Condomínios, marca como tratado e reabre.
16. Central de notificações e extrato com o visual novo (D-17), e tudo que já funcionava continua igual: botões dos avisos antigos, marcar como lido, lista e valores do extrato.
17. Cliente bloqueado não recebe recompensa (análise) e não entra por OTP/refresh (Onda 0).

### Resultado do UAT (29/09/2026, com o usuário)

| Item | Resultado | Observação |
|---|---|---|
| 1 | ✅ | Config salva e conferida no banco (9 chaves) |
| 2 | ✅ | Código `BRENDAKGHS`; copiar, WhatsApp, "Mais opções" (fallback de copiar no Linux), regras, "novo" some |
| 3 | ✅ | Indicação `LINK`; selo acima do título; aviso "Sua indicação chegou!" |
| 4 | ✅ | Indicação `CODE` (digitado com minúsculas/espaço → normalizado); inválido não trava o Continuar |
| 5 | ✅ | Fluxo real: Separação → rota → entregador confirma a Cestinha → +5 / +3, 3 avisos, convite, comemorações, extratos |
| 6 | ✅ | Resolução de pedido parado → recompensa (Pedro) e → análise (Carla) |
| 7 | ✅ | Mesmo apartamento **e** mesmo aparelho (a amiga usou o navegador da indicadora — detecção correta) → análise → recusa com motivo; cliente vê "Não valeu"; nenhum pãozin |
| 8 | ➖ | Dispensado pelo usuário (o limite não foi salvo na tentativa; regra coberta por teste automático) |
| 9, 10, 11 | ➖ | Dispensados (cobertos por teste automático); a comemoração "multi" apareceu no teste A |
| 12 | ✅ | Desligado: entradas somem, tela pausada para quem tem histórico, cadastro sem campo/selo; religado |
| 13 + aprovar | ✅ | Vínculo manual (`ADMIN`) de cliente antigo → análise (mesmo aparelho) → **Aprovar** paga e registra o revisor |
| 14 | ✅ com ressalva | Relatório bateu com o cálculo. A linha do DRE não aparece **neste banco**: há 41 compras de pão semeadas sem pagamento aprovado, então o preço médio do passivo é R$ 0 (o relatório usa o fallback do avulso, R$ 1,20). Em produção, com combos pagos, os dois usam o mesmo preço. Posição/sinal/ponte cobertos por `dre.test.ts` |
| 15 | ✅ | Lista de espera com o código do link; aviso ao admin; grupo "1 por indicação"; tratar/reabrir |
| 16, 17 | ➖ | Dispensados (telas percorridas durante o UAT sem estranheza; bloqueio é da Onda 0, com teste) |

**Funil do A6 → D-18.** Com os dados do UAT o funil mostrou Visitas 3 → Cadastros 4 (133%): 2 dos 4
cadastros não vieram pelo link (código digitado e vínculo do admin). Decisão do usuário: **manter** a
etapa com todas as origens.

**Durante o UAT (não são defeitos da feature):**
- Queda momentânea da conexão com o Atlas (server selection timeout nos 3 nós) — voltou sozinha; nenhum
  dado ficou pela metade.
- O e-mail de teste `@exemplo.test` fez o Mercado Pago recusar o Pix (domínio reservado); o checkout
  cancelou a Cestinha com "Falha ao iniciar o pagamento", como previsto. Trocado para um domínio real.

**Alterações feitas no banco de teste para o UAT** (com o aval do usuário): 3 Cestinhas com a data
movida (joao → hoje; Carla e Pedro → ontem, para virarem "paradas") e o e-mail da Carla trocado para
`carla.uat965409@flakeian.com`. Ficaram no banco: os clientes joao andre, Carla Menezes e Pedro
Albuquerque, 4 indicações da Brenda (3 recompensadas, 1 recusada) e 1 pedido de condomínio.

## 16. Fora de escopo

Expiração do bônus (exigiria lotes + cron) · saque/conversão em dinheiro · cupom de desconto (outra
feature) · indicação multinível · entregador/admin indicando · importar contatos · slide novo no
tutorial · estorno automático da recompensa quando o amigo é estornado (admin debita à mão — o
motivo "Uso indevido" já existe) · tema escuro das telas novas (o `brand.jsx` do handoff traz os
tokens escuros, mas o app não tem tema escuro).

## 17. Pendências operacionais

- **Índices no banco: automáticos no deploy.** Todo deploy do backend roda `prisma db push`
  dentro do container, logo depois do `up -d` ([playbook.yml:87-123](../../ansible/playbook.yml#L87-L123)).
  Ligado por `run_db_push: true` no [mainBackend.yml](../../.github/workflows/mainBackend.yml).
  ⚠️ **Conferido no Actions em 29/09/2026: só a `main` faz deploy.** O job `release` tem
  `if: github.ref == 'refs/heads/main'` e `buildar_imagem_docker`/`deploy` dependem dele — na
  `development` os três ficam *skipped* (execução de 20/09), apesar dos passos preparados para ela.
  Branch de feature roda só testes + build. Último deploy de produção (20/09, PR #42): verde, com o
  passo do Ansible OK — a tarefa do `db push` não ignora erro, então ele sincronizou. O log exige
  login no GitHub para ser lido. Ele cria as coleções e os índices do
  schema: `Referral.referredId` único, `ReferralMilestone` único e os `@@index`.
  - Depois do deploy desta feature, conferir no Actions o passo **"Mostrar o resultado do db
    push"**. Ele roda com a app já no ar, então uma falha fica vermelha sem derrubar nada — mas
    deixa a feature sem as travas de unicidade.
  - O índice parcial de `User.referralCode` é criado pela própria API no boot (`ensure-indexes`) —
    também automático.
  - `npm run db:push -w @cheirin-de-pao/api` à mão só para testar **localmente** antes do deploy.
    Sem ele a app funciona, porque o Mongo cria a coleção no primeiro insert, mas sem os índices
    únicos.
- Depois do deploy do backend, confirmar nos logs que aparecem os IPs reais e não só `172.30.0.1`
  (§10, "IP real no rate limit").
- Ligar o programa no admin com os valores definidos pelo negócio.

## 18. O que divergiu do plano

| # | Onda | Plano dizia | Implementado | Por quê |
|---|---|---|---|---|
| V-1 | 2 | `renderReferralMessage` na API e uma cópia em `web/lib/referral.ts`; teste em `lib/__tests__/referral-message.test.ts` | Uma função só em `packages/shared/src/referral.ts` (junto com alfabeto, normalização, faixas da D-13 e os schemas Zod de campanha/metas); teste em `packages/shared/src/__tests__/referral.test.ts` | A prévia do A3, o botão do WhatsApp e o `/referrals/me` precisam montar o **mesmo** texto. Duas cópias divergiriam na primeira mudança |
| V-2 | 2 | Índice parcial com `$exists: true` | `$type: 'string'` | Um `null` gravado por engano fica fora do índice, em vez de colidir com todos os outros `null`. A regra "nunca gravar `null`" continua valendo |
| V-3 | 2 | Metas: valor inválido cai no padrão (`[]`) | Item inválido é descartado; os válidos ficam (dedupe pela quantidade, ordem crescente, até 5). JSON quebrado ou não-lista continua `[]` | Uma meta quebrada não deve apagar as outras que o cliente já está perseguindo |
| V-4 | 2 | `indicacaoAtiva` bool | Na leitura, `ativa` só é `true` com `'true'` **e** recompensa ≥ 1 | A regra "só liga com recompensa ≥ 1" é do PATCH; a leitura garante o mesmo se o banco tiver outro valor |
| V-5 | 2 | `shortName` → "Maria S." | Inicial do **último** sobrenome | "Maria da Silva" viraria "Maria d." com a segunda palavra |
| V-6 | 2 | Campanha `{ rotulo, multiplicador, inicio, fim }` | Datas `"YYYY-MM-DD"` (dia BRT, inclusivo); rótulo de 1 a 30 caracteres | O plano não fixava o formato nem o tamanho do rótulo; 30 cabe no selo do hero e no eyebrow da Home |
| V-7 | 3 | `REFERRAL_SIGNUP`: "… Quando **ela** receber o 1º pedido, você ganha X pãezins." (o handoff usa "ele"/"ela") | "… Quando o 1º pedido chegar, você ganha X pãezins." Sem nome, "Alguém se cadastrou…" | O aviso é gerado para qualquer amigo e o sistema não sabe o gênero; a frase neutra diz o mesmo. O convite (`REFERRAL_INVITE`, "um vizinho… quando ele receber") fala de alguém genérico e fica como no handoff |
| V-8 | 3 | `referralCode: z.string().trim().max(20).optional()` | Mesma regra + `.catch(undefined)` (e `referralSource` também) | Com a validação estrita, um `?ref=` adulterado devolvia 400 para o cadastro inteiro — contra a invariante 3 |
| V-9 | 4 | Prazo: "`expiresAt` nulo ou futuro — senão EXPIRED" (conferido na hora da avaliação) | O prazo é conferido contra o momento da **entrega**. Entrega dentro do prazo avaliada depois dele (varredura) paga; sem entrega/pagamento até o prazo → `EXPIRED` | Se o gatilho falhar na hora da entrega, a varredura do dia seguinte expiraria uma indicação que cumpriu a regra — contra a invariante 4 |
| V-10 | 4 | `GET /referrals/me` devolve `link` e `message` já renderizada | Devolve `messageTemplate` + `referrerFirstName` (+ `code`, `welcomeBreads`); o app monta `link` e `message` com `renderReferralMessage` (shared, V-1) | O link é `${window.location.origin}/?ref=` (§4.6) — a API não sabe a origem do app, e montar lá exigiria uma variável nova |
| V-11 | 4 | `grantMilestoneIfReached(fastify, referrerId)`: "conta REWARDED; se igual a um marco…" | `grantMilestoneForReward(fastify, { id, referrerId, rewardedAt })`: a **posição** desta recompensa (por `rewardedAt`) | Duas recompensas simultâneas contariam as duas "6" e a meta da 5ª passaria em branco. A posição também dá o "não retroativo" sem regra extra |
| V-12 | 4 | `qualifyReferral(fastify, referredId, order?)` e `afterDelivery(fastify, userId, order)` | Sem o parâmetro `order`: a entrega que qualifica é sempre a 1ª do amigo, lida do banco | "1ª entrega" é a mais antiga, não necessariamente a que disparou; a consulta só roda para quem tem indicação `PENDING` |
| V-13 | 4 | Textos com artigo/pronome de gênero: "indicação **do** João", "João ganhou X **pela** Maria" | "indicação **de** João", "João ganhou X **por indicar** Maria", "Você veio pela indicação de João M." | Mesmo motivo da V-7: o sistema não sabe o gênero das pessoas |
| V-14 | 4 | `celebration = { variant, breads, names[], goal?, referrerName? }` | + `seen: { referralIds, goalThresholds, welcome }` (o app devolve no `celebration/seen`); `goal.next`; nas metas do `/me`, `reached` e `paid` por marco | O modal precisa dizer ao servidor o que mostrou; `paid` distingue meta passada antes de existir (não paga) |
| V-15 | 4 | `ADMIN_NOTIFICATION_TYPES` + `DEFAULT_OFF` na Onda 6 (A8) | Feito na Onda 4 (só a parte da API) | Os avisos `ADMIN_REFERRAL_*` já disparam na Onda 4 — sem o `DEFAULT_OFF`, "recompensada" chegaria ligada para todo admin até a Onda 6 |
| V-16 | 4 | Testes da regra em `lib/__tests__/referral.test.ts` | Onda 3 em `referral.test.ts`; Onda 4 em `referral-reward.test.ts` | Arquivo único passaria de mil linhas; o "banco" em memória só serve à Onda 4 |
| V-17 | 5 | Teste "`OnboardingScreen` manda `referralCode`" | Testado pelo `payload()` do `useSignupReferral` (o que o `register` espalha no body), num harness que espelha o passo 1 | O cadastro não tem teste de tela; percorrer os 5 passos (CPF, condomínio, OTP) só para isto testaria mais o formulário do que a indicação |
| V-18 | 5 | C5: "**A** Maria recebeu…", "indicação **do** João" | "Maria recebeu…", "indicação **de** João"; meta: número por extenso até 20 ("Cinco vizinhos"), algarismo depois | V-13. O handoff só mostrava o "Cinco" |
| V-19 | 5 | C7: "Bônus de indicação +N este mês" sempre; título "Extrato" | O canto some com N = 0; o título continua "Extrato de pãezins" (o de hoje); linha sem descrição mostra a hora; meta ganha o número lido da descrição ("Meta de 5 indicações") | "+0 este mês" não diz nada; trocar o título não estava na lista da D-17 |
| V-20 | 5 | C2: com o programa desligado, a seção some | Some — menos para quem tem histórico (A-4), com a descrição "Acompanhe suas indicações" e sem selo | O handoff não tinha texto para esse caso |
| V-21 | 5 | `trackAccess` manda o `ref` (§8.2) | A captura já roda no `main.tsx`; o envio do `ref` no evento fica para a Onda 7, junto com o `TrackEventSchema` da API | Mandar antes da API aceitar seria um campo ignorado; as duas pontas entram juntas |
| V-22 | 5 | Fila de overlays no `ClientLayout` | Além da fila, o banner passa a esperar o resumo da indicação (ou a falha dele) e a comemoração espera a resposta do gancho | Sem isso, o banner abriria antes de o resumo chegar e a comemoração cairia por cima dele — dois overlays juntos |
| V-23 | 5 | "Mais opções" sem Web Share cai em copiar | Copia a MENSAGEM e mostra o toast "Mensagem copiada — é só colar na conversa" | O handoff não tinha o texto do fallback (o toast do protótipo era só demonstração) |
| V-24 | 6 | Rotas do A5 (`/admin/clients/:id/referrals`, `…/referral-code-check`, `…/referral`) sem módulo definido; badge do A1/A2 vindo da contagem da lista | Todas as rotas admin da indicação num módulo próprio, `admin-referrals` (inclusive as de `/admin/clients/:id/…`), + `GET /admin/referrals/summary` (`{ pendingReview }`) para o selo | O `admin-clients` fica intacto; o hub de Gestão não precisa puxar uma página da lista só para mostrar um número (mesmo padrão do `hook-requests/summary`) |
| V-25 | 6 | "≈ R$" = `estPricePerCredit`, "a mesma base do relatório e do DRE" | `estimateBreadUnitPrice` (`lib/bread-price.ts`): R$ pagos em pão ÷ pães comprados — a conta do `getCreditLiability`, que alimenta o DRE. O GET da config devolve `unitPrice` e `today` | Existem duas contas com o nome `estPricePerCredit`: a do passivo/DRE (todo pagamento de pão) e a da movimentação de créditos (só combos). Ficou a do DRE, que é a que a linha "Bonificações de indicação" vai usar (Onda 7). `today` = dia BRT do servidor, para a tela validar a campanha com o mesmo relógio |
| V-26 | 6 | Campanha: `fim ≥ hoje` sempre | Só para campanha **nova ou alterada**; a que já estava gravada pode ter vencido | Uma campanha vencida gravada barraria salvar qualquer outra coisa da tela. Vencida, ela só deixa de valer |
| V-27 | 6 | Vínculo manual sem regra para o programa desligado | Desligado → 422 ("ligue em Gestão › Indique e Ganhe"); o `GET /admin/clients/:id/referrals` traz `active` e, desligado e sem indicação, a linha "Vincular indicação" não aparece | §4.8: "código novo não vincula" — vale para o admin também, senão o vínculo congelaria valores de um programa fora do ar |
| V-28 | 6 | A4: textos do handoff só para bônus do amigo > 0; recusada "(+ motivo, só admin)" sem lugar definido; "detalhe obrigatório" | Com Y = 0: "João ganha +5 agora e recebe uma notificação." / "Aprovada. +5 pãezins para João."; "—" no quadro de valores. Recusada: bloco "MOTIVO DA RECUSA" (motivo + detalhe) no sheet; linha do tempo termina em "Recusada" ou "Prazo encerrado". Depois de recusar: "Recusada. O cliente vê apenas 'Não valeu'." + botão "Fechar" (também após aprovar). Detalhe com 3 a 500 caracteres; o 1º sinal pré-seleciona o motivo | O handoff não cobria esses casos; "+0" e "Amigo ganha +0" prometeriam algo que não existe |
| V-29 | 6 | Lista do A4 sem ordem nem paginação definidas | "Em análise" da mais antiga para a mais nova (fila); os outros filtros, da mais recente. 20 por página + "Carregar mais". Busca sem resultado: "Nenhuma indicação … com “termo”." | Quem espera há mais tempo deve ser analisado primeiro; sem paginação, "Todas" cresceria sem limite |
| V-30 | 6 | A3: metas com valores fixos no protótipo ("5ª", "+10"); só os erros do handoff | As caixas "5ª" e "+10" são campos editáveis com o mesmo visual. Avisos a mais, no padrão `RAInline`: compra mínima inválida, mensagem fora de 20–500 caracteres, campanha sem nome/datas ou com fim antes do início, meta fora da faixa ou repetida. Os chips inserem a variável no cursor. Sem base de preço, o "≈ R$" some. Carregando = skeleton; falha = aviso + "Tentar de novo" | Sem editar, o admin só conseguiria trocar uma meta apagando e recriando; os avisos são os que o servidor devolveria como 400/422 |
| V-31 | 6 | A5: "se **a** Maria já recebeu", "código **da própria** Maria", "Maria agora aparece como **indicada** por João Silva" | "se Maria já recebeu", "Esse é o código de Maria.", "Vinculado! Agora Maria aparece com a indicação de João Silva." (+ "A recompensa já foi creditada." ou "A indicação foi para análise.", conforme o desfecho). A linha "Indicado por" segue o formato das linhas do card do app (ícone `gift` + rótulo), com o nome em `accent` e o chevron do handoff; o card de indicações sem sombra, como os vizinhos; lista vazia: "Nenhuma indicação ainda." | V-7/V-13/V-18: o sistema não sabe o gênero. O card de cadastro é tela existente (D-17): a linha nova entra no formato das outras |
| V-32 | 6 | A8: "tom e ícone dos 3 tipos de admin" sem valores no handoff | Análise = dourado + `search` (o selo "Em análise"); recompensada = verde + `gift`; pedido de condomínio = neutro + `building` | O handoff não desenhou a central do admin; seguem os ícones e tons que as telas da indicação já usam |
| V-33 | 7 | DRE: "linha própria no grupo SALES — Bonificações de indicação" (sem regime definido) | A linha entra nas despesas operacionais logo depois do comercial, **só na competência**. A ponte caixa × competência ganha a parcela "Bonificações de indicação" (fora do Δ despesa). `referralBonus` é opcional nos insumos | No caixa o bônus não passou pelo banco (nem receita nem saída); é na competência que o consumo do pão de bônus vira receita e precisa ser compensado. Sem a parcela própria, a ponte explicaria o bônus como "despesa ainda não paga" |
| V-34 | 7 | A6: KPIs, funil e custos sem base de data definida | Duas leituras, declaradas em `caveats`: **coorte** (indicações cadastradas no período) para funil, "Recompensadas", conversão e estados; **fluxo** (o que aconteceu no período) para pãezins, custo, receita dos indicados e top 5 (por `rewardedAt`). Receita dos indicados sem as indicações recusadas | Uma indicação feita no fim do mês só recompensa no seguinte: contar a conversão pela data da recompensa misturaria coortes. Custo e receita são dinheiro do mês. Recusada = o admin decidiu que a pessoa não veio pelo programa |
| V-35 | 7 | Funil: `ref` opcional no `TrackEventSchema` e no JSON da rota | `ref` com `.catch(undefined)` e sem `maxLength` no JSON; o service normaliza (como no cadastro) e só grava `refCode` com cara de código (4–20 letras/dígitos) | Mesmo motivo da V-8: um `?ref=` adulterado não pode derrubar o evento de acesso, que conta para os outros relatórios |
| V-36 | 7 | A6 com os estados "carregando" e "sem dados" | Também: falha → aviso; top 5 vazio → "Nenhuma indicação valeu no período."; "Por estado" some com a coorte vazia; custo "—" sem base de preço; as ressalvas no rodapé, como nos outros relatórios; a trilha "Relatórios › Aquisição & clientes" também quando aberto pelo atalho do hub | O handoff só desenhou os dois estados; as ressalvas explicam a V-34 na própria tela |
| V-37 | 8 | `POST /condominiums/interest` e as rotas do A7 sem módulo definido (o público no `condominiums`, o admin no `admin-condominiums`) | Um módulo próprio, `condo-interests`, com as três rotas; o POST responde 201 | O `condominiums.route.ts` é um arquivo de handlers inline e o `admin-condominiums` é o CRUD do condomínio; a lista de espera tem regra própria (contato único, grupo, aviso) e fica testável num lugar só |
| V-38 | 8 | Contato único, `groupKey`, `refCode?` | Também: o mesmo contato no mesmo grupo não é gravado de novo (nem avisa de novo); e-mail em minúsculas; CEP opcional com 8 dígitos; código de indicação adulterado é descartado (nunca 400); `visitorId` gravado | Quem toca "Avisar" duas vezes não deve virar dois pedidos nem dois avisos ao admin; o código segue a regra do cadastro (V-8) |
| V-39 | 8 | "PATCH marca ou reabre o grupo inteiro; pedido novo num grupo tratado o reabre sozinho" | "Tratado" é derivado: o grupo está tratado quando TODOS os pedidos dele estão marcados. O pedido novo nasce com `handledAt: null`, então reabre o grupo sem nenhuma escrita extra. Ordem: em aberto → mais pedidos → mais recente. Sem pedidos: "Nenhum pedido por enquanto."; falha ao marcar → aviso | Derivar evita um estado de grupo guardado à parte que poderia divergir dos pedidos |
| V-40 | 8 | C8 conforme o handoff | Card do vazio com os textos do `RefWaitlist` ("Conta pra gente onde você mora…"), e não os da variante do `screens-onboarding.jsx`. "Se veio por indicação, o código fica guardado." só aparece quando havia código. Erro 400 mostra a mensagem do campo na faixa de erro. A dica "Um dos dois basta." fica fora do rótulo, ligada por `aria-describedby`. Na tela da conta (`AccountScreen`) o `CondoSearch` mantém o vazio antigo | O README do handoff descreve o card do `RefWaitlist`; prometer o código guardado a quem não veio por link confundiria; a conta é tela existente (D-17) e lá não há cadastro a fazer |
| V-41 | 9 | Rótulos do admin do handoff: "Indicado por João Silva", etiquetas "INDICOU / INDICADO" no sheet, "· indicado" no A7, "Os dois recebem uma notificação" | "Indicação de João Silva ›", "QUEM INDICOU / QUEM VEIO", "· por indicação", "As duas pessoas recebem uma notificação." Referências genéricas ("o cliente", "amigo") ficam como no handoff | Revisão final da regra de gênero (V-7, V-13, V-18): esses rótulos falam de uma pessoa específica, cujo gênero o sistema não sabe |
