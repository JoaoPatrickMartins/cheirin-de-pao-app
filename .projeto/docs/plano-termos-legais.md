# Plano — Termos legais (rodada 1: termo do entregador + aceite de turno)

> ✅ **Status:** **RODADA 1 CONCLUÍDA** em 05/10/2026 — **SEM COMMIT** (termo do entregador + aceite
> obrigatório + aceitar/recusar turno). Verificação: typecheck ✅ · `vite build` ✅ · api **1.976 + 3
> todo** (+17) · web **672 + 17 todo** (+14) · shared **117 + 4 todo** (+2). As próximas rodadas
> (§3/§9) ficam **registradas para implementação futura** (pedido do usuário, 05/10/2026). Execução
> direta, **sem GSD**. Branch de referência `feat/add-complementocliente`. Entra **antes do deploy** do app do
> entregador (ver [`plano-app-entregador.md`](./plano-app-entregador.md) e o
> [checklist](./checklist-deploy-app-entregador.md)).
>
> ⚖️ **Aviso:** este plano e os rascunhos que saírem dele **não substituem um advogado**. O texto do
> termo é um rascunho operacional, que o app passa a exigir já (decisão do usuário), e que precisa de
> revisão jurídica trabalhista e de proteção de dados. A revisão gera uma versão nova, e o app pede
> o aceite de novo.

---

## 0. Escopo

**Pedido do usuário (05/10/2026):** um termo para o entregador, principalmente sobre **não gerar
vínculo empregatício**, e a análise de **todos os outros termos** necessários.

| Rodada | O quê |
|---|---|
| **1 (este plano)** | **Termo do Entregador Parceiro** + aceite obrigatório no app + **aceitar ou recusar o turno** |
| Próximas (§3) | Termos de Uso do cliente completos, regulamento do Indique e Ganhe, Política de Privacidade completa, confidencialidade da equipe e contratos fora do app |

---

## 1. Análise: o termo e o vínculo empregatício

**Um termo sozinho não impede o reconhecimento de vínculo.** A Justiça do Trabalho decide pela
realidade (primazia da realidade) e confere os requisitos do art. 3º da CLT: **pessoalidade,
habitualidade (não eventualidade), onerosidade e subordinação**. O termo ajuda a provar o que foi
combinado, mas perde força se o dia a dia mostrar outra coisa. Por isso, o plano junta o termo com
um ajuste no app (§5).

**O que o app faz hoje e como pesa** (levantamento no código):

| Traço | Onde | Peso | Nesta rodada |
|---|---|---|---|
| Não há como **recusar um turno**: a divisão aprovada já vira "saiu para entrega" com o entregador | `approveDivision` (`admin-orders.service.ts`) | Alto (subordinação) | ✅ **Resolvido:** aceitar ou recusar turno, sem penalidade (D-T1) |
| **Escala e folgas** definidas pelo admin; o entregador só vê | A3 Disponibilidade, `CourierTimeOff`, E18 | Alto | ❌ Fica (o usuário não escolheu "disponibilidade dele"). Risco registrado (§8) |
| Modalidade **"semanal fixo"** | A3 Pagamento, A8 | Alto (parece salário) | ❌ Fica. Risco registrado |
| **Rota** salva pelo admin; **reordenar** só com permissão | A4, `podeReordenar` | Médio | ❌ Fica. O termo não promete liberdade de trajeto que o app não dá |
| **Foto obrigatória**, regras por entregador, lembretes de turno | A3 Regras, `COURIER_PENDING_REMINDER` | Médio | ❌ Fica. O termo trata como **padrão de qualidade do serviço** (resultado), não como ordem |
| **Crachá** pessoal com nº e validade | E15 | Baixo/médio (pessoalidade) | Fica: exigência de segurança dos condomínios, dita no termo |
| Cadastro só com **CPF**, sem MEI/CNPJ nem recibo | A3 | Médio | ❌ Fica (não escolhido). O termo diz que os tributos são do entregador |
| **Sem exclusividade** e sem horário além do turno aceito | — | A favor | O termo diz isso expressamente |
| Combustível como **reembolso** estimado e aprovado | A8 | Neutro | O termo trata como ressarcimento de despesa |

---

## 2. Decisões do usuário (05/10/2026, passo a passo)

| # | Decisão |
|---|---|
| D-T1 ✅ | **Ajuste no app:** o entregador pode **aceitar ou recusar cada turno**, sem penalidade. Os outros ajustes (disponibilidade informada por ele, tirar o "semanal fixo", MEI/CNPJ e recibo) **não** entram |
| D-T2 ✅ | **Aceite do termo bloqueia o app:** tela cheia no 1º acesso e a cada versão nova, com "Li e aceito". Guarda versão, data, aparelho e IP. O admin vê no cadastro quem aceitou e quando. Quem já trabalha aceita na próxima abertura |
| D-T3 ✅ | **Publicar já e revisar depois:** o aceite vale com o rascunho; a revisão jurídica vira uma versão nova, com novo aceite (como os Termos e a Política em 30/09) |
| D-T4 ✅ | **Nesta rodada, só o termo do entregador.** Os outros documentos ficam analisados na §3 para as próximas rodadas |
| D-T5 ✅ | **Turno sem resposta = aceito.** O turno aparece com Aceitar / Recusar; sem resposta, segue com o entregador. A recusa é livre até ele iniciar a rota, sem penalidade, e avisa o admin para redistribuir |

---

## 3. Inventário de todos os termos (análise para as próximas rodadas)

| Documento | Para quem | Hoje | Por que precisa | Prioridade |
|---|---|---|---|---|
| **Termo do Entregador Parceiro** | Entregador | Não existe | Natureza da relação (sem vínculo), turnos, remuneração, custos, conduta, dados de clientes, uso de imagem | **Rodada 1** |
| **Termos de Uso do cliente** (completos) | Cliente | 4 seções curtas em `/termos`, sem aceite | Pãezins (crédito; hoje "não expiram"), pagamento (Mercado Pago/Stripe), **recarga automática** (autorização de cobrança sem CVV — hoje só uma frase na tela), **arrependimento de 7 dias** (CDC art. 49, compra on-line: como devolver em dinheiro o que não foi usado), agenda e horário de corte, não entrega e devolução em pãezins, **entrega no gancho** (responsabilidade depois de deixado, foto como comprovante), o **gancho** (grátis com pedido mínimo, troca por defeito, cobrança por perda/quebra), **Além do Pãozin/Cestinha**, recados, suspensão por fraude, mudanças nos termos, foro do consumidor | Alta |
| **Aceite no cadastro do cliente** | Cliente | **Não existe**: o cadastro não mostra Termos nem Política | Prova de que o cliente concordou (clickwrap com versão), e novo aceite em mudança relevante | Alta |
| **Regulamento do Indique e Ganhe** | Cliente | Só "Como funciona" na tela | Promoção com bônus em pãezins: quem ganha, quando qualifica, prazo (`prazoDias`), limites, fraude, fim da campanha | Média |
| **Política de Privacidade** (completar) | Todos | Existe (atualizada na Onda 9) | Faltam: **base legal** de cada uso (LGPD art. 7º), **encarregado** (DPO) e contato, **transferência internacional** (Stripe, Google, OneSignal, AWS, Resend — art. 33), o que fica **guardado no aparelho** (sessão, `device_id`, fila offline, crachá), razão social/CNPJ | Média/alta |
| **Confidencialidade da equipe** | Quem usa o painel do admin | Não existe | O admin vê CPF, endereço, telefone, fotos de portas. Termo de sigilo com aceite no 1º acesso | Média |
| **Contrato com condomínio parceiro** | Condomínio (fora do app) | — | Autorização de acesso, ganchos nas portas, responsabilidades, LGPD (dados de moradores) | Média (jurídico/comercial) |
| **Contrato com fornecedor** (padaria) | Fornecedor (fora do app) | — | Fornecimento, preço, qualidade, entrega | Baixa para o app |

**Reaproveitamento:** o registro de aceite desta rodada (§6) já nasce **genérico** (`doc` + `versão`),
para servir aos Termos do cliente, ao regulamento e à confidencialidade nas próximas rodadas.

---

## 4. Termo do Entregador Parceiro — estrutura do rascunho

Escrito em linguagem simples, no mesmo padrão de `content/legal.ts` (seções com parágrafos curtos).
**Não promete o que o app não faz.**

| # | Seção | Conteúdo |
|---|---|---|
| 1 | O que é este termo | Prestação de serviço de entrega, **autônoma**, por meio do app; aceite eletrônico; versão e data |
| 2 | **Natureza da relação** | **Não há vínculo empregatício** nem relação de subordinação. O entregador presta o serviço por conta própria, **sem exclusividade** (pode trabalhar para outros, inclusive no mesmo setor) e **sem horário além dos turnos que aceitar** |
| 3 | **Turnos: aceitar ou recusar** | A operação **oferece** turnos. O entregador pode **aceitar ou recusar cada um**, sem justificar e **sem penalidade** (não afeta pagamento, ofertas futuras nem avaliação). Sem resposta, o turno fica com ele. Pode recusar até iniciar a rota. A disponibilidade cadastrada é só uma referência para as ofertas |
| 4 | Requisitos e cadastro | Dados verdadeiros; CNH e documentos do veículo em dia (moto/carro); celular com internet; foto para o crachá |
| 5 | Como o serviço é prestado | **Padrões de qualidade do resultado**: entregar no gancho do cliente, confirmar no app, foto como comprovante quando a operação pedir, informar a não entrega com o motivo. O app sugere a ordem das paradas |
| 6 | Remuneração | Pela modalidade combinada no cadastro (por entrega, por rota ou valor semanal); semana de segunda a domingo; a operação revisa e aprova a proposta; pagamento pelo meio combinado. **Tributos e contribuições são do entregador** |
| 7 | Custos e equipamentos | Veículo, manutenção, multas, celular e internet são do entregador. O combustível, quando combinado, é **ressarcimento de despesa** estimado pela rota |
| 8 | Riscos e segurança | Respeito ao trânsito; recomendação de seguro pessoal e do veículo; o que acontece em acidente ou ocorrência (canal da operação). **Sem descontos** no pagamento sem acordo |
| 9 | Conduta nos condomínios | Identificação com o crachá digital, regras de cada portaria, só as áreas necessárias à entrega |
| 10 | **Dados dos clientes** (LGPD) | Nome, bloco e apartamento só para a entrega; sigilo; proibido copiar, guardar, divulgar ou contatar o cliente fora do app; recados só pelos modelos; comunicar qualquer incidente |
| 11 | Dados do entregador | Remete à Política de Privacidade ("Se você é entregador"): localização só durante a rota, fotos 90 dias |
| 12 | **Uso de imagem** | Autoriza o uso da foto e do primeiro nome no app (crachá e cliente) enquanto durar a parceria; sai ao encerrar |
| 13 | Ocorrências | "Falar com a operação" (WhatsApp e ocorrência no app) |
| 14 | Encerramento | Qualquer lado pode encerrar a qualquer momento, sem multa; o que foi feito é pago; o acesso e o crachá são desativados |
| 15 | Mudanças | Versão nova é avisada no app e precisa de novo aceite para seguir |
| 16 | Contato e foro | E-mail e WhatsApp; foro a definir pelo jurídico |

**Pendências do rascunho (para o advogado):** razão social, CNPJ e endereço; prazo de pagamento;
foro; requisitos de motofrete (Lei 12.009/2009: idade, curso, equipamentos) se houver moto; seguro;
como tratar a pessoalidade (o crachá é pessoal: não dá para mandar outra pessoa no lugar).

---

## 5. Aceitar ou recusar o turno (D-T1, D-T5)

**Hoje:** aprovar a divisão (`POST /admin/orders/approve-division`, no dia, poucas horas antes do turno)
grava o `courierId` e já põe o pedido em `OUT_FOR_DELIVERY`. O entregador recebe "Novas entregas" e
não tem como recusar. Não existe registro de divisão aprovada.

**Como fica:**
1. A aprovação continua igual e **cria a oferta** do turno para cada entregador (`CourierShiftOffer`,
   status `OFFERED`). O push "Novas entregas" passa a dizer **"Turno da manhã: 18 entregas. Toque para
   aceitar ou recusar."**
2. No E1 aparece o cartão do turno: **"☀️ Manhã · 18 paradas · 06:30"** com **Aceitar** e **Recusar**.
   Sem resposta, o turno segue com ele (D-T5). **Aceitar** ou **Iniciar rota** grava `ACCEPTED`.
3. **Recusar** abre um sheet: motivo **opcional** (Imprevisto · Veículo · Saúde · Outro) e o aviso
   "Recusar não tem penalidade. A operação redistribui estas entregas." Confirmar:
   - as paradas voltam para `SEPARATED` **sem entregador** (pão, Cestinha e o gancho na rota);
   - a oferta fica `DECLINED` (quando e o motivo);
   - os admins recebem **`ADMIN_SHIFT_DECLINED`** ("Antônio recusou o turno da manhã · 18 paradas",
     ligado por padrão), e o card de divisão mostra as paradas sem entregador e o selo "recusou";
   - o lembrete de turno não sai para quem recusou.
4. **Prazo:** pode recusar até **iniciar a rota** (ou resolver a 1ª parada). Depois disso, 409 com
   "A rota já começou: fale com a operação".
5. **Sem penalidade de verdade:** recusas não entram em Meus números, pagamentos nem em nenhuma
   métrica. O histórico fica guardado só para auditoria (é a prova da autonomia).

**Decisões técnicas (minhas):**

| # | Decisão | Motivo |
|---|---|---|
| T-T1 | Modelo novo **`CourierShiftOffer`** (`courierId`, `date`, `slotId`, `status` OFFERED·ACCEPTED·DECLINED·WITHDRAWN, `stops`, `offeredAt`, `respondedAt`, `reason`). Índice por `courierId + date + slotId`, **sem único** (o admin pode oferecer de novo depois de uma recusa) | Histórico completo para auditoria |
| T-T2 | Reaprovar a divisão: quem continua com paradas mantém a oferta (não volta para OFFERED se já aceitou); quem perdeu todas fica `WITHDRAWN` | Não pedir aceite de novo a cada ajuste |
| T-T3 | **Recusar precisa de sinal** (não entra na fila offline): mexe na operação na hora. Sem sinal: "Sem sinal: fale com a operação" com o WhatsApp | Recusa guardada que sobe depois do turno não serve |
| T-T4 | `ADMIN_SHIFT_DECLINED` nas três listas de tipos (prefs da API, `AdminNotificacoes`, `AdminNotificationsScreen`), com `dedupeKey` por oferta | Padrão dos avisos novos |

---

## 6. Aceite do termo (D-T2)

**Decisões técnicas (minhas):**

| # | Decisão | Motivo |
|---|---|---|
| T-T5 | Modelo novo **`LegalAcceptance`** (`userId`, `doc`, `version`, `acceptedAt`, `ip`, `userAgent`, `deviceId`), genérico. Índice `userId + doc` | Serve aos próximos documentos (§3) |
| T-T6 | Versão vigente no **`packages/shared`** (`LEGAL_DOCS.COURIER_TERMS = { version: '1.0', date: '05/10/2026' }`); o texto em `apps/web/src/content/courierTerms.ts`, no padrão do `legal.ts` | Versão igual na API e no app. Revisão jurídica = mudar a versão |
| T-T7 | `GET /courier/me` ganha `terms: { version, acceptedVersion, acceptedAt }`; **`POST /courier/terms/accept { version }`** grava o aceite (versão diferente da vigente → 409). O IP vem do `request.ip` (atrás do Nginx: `trustProxy` — conferir) | Prova do aceite |
| T-T8 | **Bloqueio só na tela** (`TermsGate` em tela cheia, por cima de tudo no `CourierScreen`): rolar, marcar "Li e aceito o Termo do Entregador Parceiro" e "Aceitar e continuar"; "Sair" fica disponível. A API **não** recusa as ações de quem não aceitou | Recusar na API descartaria entregas guardadas na fila offline |
| T-T9 | Sem sinal: se o crachá guardado (cache da Onda 11) já diz que a versão vigente foi aceita, segue; senão o gate mostra o texto e "Precisa de sinal para aceitar" | Não travar o corredor sem sinal de quem já aceitou |
| T-T10 | **Página pública `/termos-entregador`** (mesmo `LegalShell`) + linha **"Termo do entregador"** no Perfil (E14) | Transparência e link para mandar a quem vai se cadastrar |
| T-T11 | **Admin A3:** na edição, "Termo aceito em 05/10/2026 · v1.0" ou "Termo pendente"; na lista, o selo "termo pendente" | D-T2 |

---

## 7. Passos

1. **Shared:** `LEGAL_DOCS` (versão do termo) + testes.
2. **API:**
   - schema: `LegalAcceptance` e `CourierShiftOffer` → `prisma generate` → `db push` no banco de teste
     (conferir o alvo); `NotificationType.ADMIN_SHIFT_DECLINED`;
   - aceite: `terms` no `/courier/me`, `POST /courier/terms/accept`, o aceite no `GET /admin/couriers`
     (lista e edição) — tudo nos JSON schemas de resposta;
   - turno: oferta no `approveDivision` (e o texto novo do push), `GET` da oferta de hoje dentro do
     `/courier/orders/today` (por turno), `POST /courier/shifts/:id/accept` e `…/decline { reason? }`
     (devolve as paradas, avisa os admins), `ACCEPTED` ao iniciar a rota, lembrete pulando quem recusou,
     o card de divisão do admin com "recusou" e as paradas sem entregador.
3. **Web:**
   - `content/courierTerms.ts` (o rascunho da §4), página `/termos-entregador`, `TermsGate`, linha no
     Perfil, status no A3;
   - cartão do turno no E1 (Aceitar / Recusar), `DeclineShiftSheet`, aviso sem sinal, selo "recusou" e
     paradas sem entregador no `DeliveryDivisionCard`, o tipo novo nas preferências do admin.
4. **Testes:**
   - api: aceite (versão errada → 409, guarda IP/aparelho, `/courier/me` com o estado), oferta criada na
     aprovação e mantida na reaprovação, recusa devolve pão + Cestinha + gancho e avisa o admin, recusar
     depois de iniciar → 409, iniciar grava ACCEPTED, lembrete não sai para quem recusou;
   - web: gate bloqueia até aceitar e some depois, versão nova pede de novo, sem sinal com aceite
     guardado passa, página pública, cartão do turno (aceitar, recusar com e sem motivo, sem sinal),
     A3 com o status, divisão com "recusou".
5. **Registro:** §10 deste plano, cabeçalho, checklist (padrões, configuração, roteiro, combinados com
   a equipe: explicar o termo e a recusa de turno) e o aviso no `plano-app-entregador.md`.

---

## 8. Riscos e pontos de atenção

| # | Risco | Tratamento |
|---|---|---|
| R-T1 | **Vínculo reconhecido apesar do termo** (escala e folgas do admin, "semanal fixo", rota e foto impostas, pessoalidade) | Fora desta rodada por decisão do usuário. **Recomendado:** levar a §1 ao advogado e reavaliar "disponibilidade dele", "sem semanal fixo" e "MEI/recibo" |
| R-T2 | Rascunho sem revisão jurídica já valendo (D-T3) | Versão nova depois da revisão, com novo aceite. Pendências listadas na §4 |
| R-T3 | Recusa de madrugada perto do turno deixa paradas sem entregador | Aviso imediato ao admin (push) e as paradas aparecem sem entregador no card de divisão |
| R-T4 | "Silêncio = aceite" enfraquece um pouco a prova de autonomia | A recusa é livre e registrada; o histórico mostra recusas sem consequência |
| R-T5 | IP atrás do proxy | Conferir `trustProxy` do Fastify e o `X-Forwarded-For` do Nginx; sem isso, o IP gravado é o do proxy |
| R-T6 | Entregador que nunca abriu com sinal fica no gate | Mensagem clara; o aceite exige sinal uma vez |

---

## 9. Fora desta rodada

Termos de Uso do cliente e aceite no cadastro · regulamento do Indique e Ganhe · Política de
Privacidade completa · confidencialidade da equipe · contratos com condomínios e fornecedor ·
disponibilidade informada pelo entregador · fim do "semanal fixo" · MEI/CNPJ e recibo de pagamento.

---

## 10. Registro de execução

### Rodada 1 — concluída em 05/10/2026 · **sem commit**

**Shared**
- `legal.ts`: `LEGAL_DOCS.COURIER_TERMS` (título, versão **1.0**, data 05/10/2026, `/termos-entregador`),
  `isLegalDoc`, `needsLegalAcceptance`.
- `courier.ts`: `SHIFT_OFFER_STATUSES`, `SHIFT_DECLINE_REASONS` (Imprevisto · Problema no veículo ·
  Saúde · Outro motivo) e `shiftDeclineLabel`.

**API**
- **Schema:** `LegalAcceptance` (41) e `CourierShiftOffer` (42) com os índices; `NotificationType.
  ADMIN_SHIFT_DECLINED`. `prisma db push` no `cheirin-de-pao-teste` (3 índices criados).
- **Termo:** `GET /courier/me` ganha `terms { version, acceptedVersion, acceptedAt }`; **`POST
  /courier/terms/accept { version }`** grava versão, quando, IP (`trustProxy` já ligado), navegador e
  aparelho (`X-Device-Id`); versão ≠ vigente → 409 `OUTDATED`; aceitar de novo não duplica. `GET
  /admin/couriers` traz `terms` de cada entregador.
- **Turno:** `lib/courier-shift-offers.ts` (`syncShiftOffers`, chamado pela `approveDivision`): cria
  `OFFERED` e avisa "Turno da manhã · N paradas às 06:30. Toque para aceitar ou recusar."; reaprovação só
  atualiza as paradas (e avisa se aumentaram); quem perdeu tudo → `WITHDRAWN`. Best-effort.
  `modules/courier/courier-shifts.ts`: **`GET /courier/shifts`** (turnos de hoje), **`POST
  /courier/shifts/:id/accept`** e **`…/decline { reason? }`** (devolve pão, Cestinha e o gancho na rota
  para a divisão sem entregador, grava `DECLINED` e o motivo, avisa `ADMIN_SHIFT_DECLINED`; rota
  iniciada ou parada resolvida → 409 `STARTED`; outro dia → `PAST`). **Iniciar a rota** marca o turno
  `ACCEPTED` (`via: START`).
- **Divisão (`getDivisionSuggestion`):** aprovada com paradas SEPARATED sobrando → sugestão só delas,
  com `partial { dispatchedStops }` e `declined[]`; quem recusou fica `offReason: RECUSOU` (fora da
  sugestão).
- `ADMIN_SHIFT_DECLINED` nas preferências do admin (nasce ligado).

**Web**
- `content/courierTerms.ts`: o rascunho do termo (15 seções da §4, com os `TODO(jurídico)`).
- Página pública **`/termos-entregador`** (`CourierTermsPage`, "Versão 1.0 · 05/10/2026").
- **`TermsGate`** (tela cheia por cima de tudo): "Antes de começar" / "O termo mudou", texto, "Li e
  aceito…" (checkbox), "Aceitar e continuar", erro sem sinal, "Sair do app". O aceite atualiza o perfil
  e o crachá guardado no aparelho.
- **Perfil (E14):** linha "Termo do entregador" → tela com "Você aceitou a versão 1.0 em DD/MM/AAAA" e o
  texto.
- **E1:** `ShiftOfferCard` ("TURNO OFERECIDO · ☀️ Turno da manhã · 18 paradas · entrega 06:30" com
  Aceitar / Recusar; aceito: "… aceito · Recusar"); some quando a rota do turno começa.
  `DeclineShiftSheet`: motivo opcional, "Recusar não tem penalidade…", "Recusar turno" / "Manter o
  turno", sem sinal aponta o WhatsApp da operação.
- **A2:** aviso "Fulano recusou o turno da manhã às 05:20 (motivo) · N paradas", "N paradas já estão na
  rua… Distribua só as que voltaram e aprove", selo **"recusou o turno"** no card de divisão; o polling
  segue no estado parcial.
- **A3:** na edição, "termo v1.0 aceito em DD/MM/AAAA" ou "termo pendente" + "ver o termo"; na lista, o
  selo **"termo pendente"**.
- Notificações do admin: "Turno recusado" (novo) e o ícone/tom na central.

**Testes novos**
- shared (+2): `legal.test.ts` (versão vigente e quem precisa aceitar; motivos da recusa).
- api (+17): `courier-shift-offers` (3: cria e avisa; só atualiza/avisa se aumentou; WITHDRAWN),
  `courier-shifts` (5: hoje por turno; aceitar; recusar devolve tudo e avisa; sem motivo; STARTED/PAST),
  `courier-me` (+2: `terms` no perfil; aceite com IP/aparelho, sem duplicar, 409), `admin-couriers`
  (+1: `terms` na lista), divisão (+2: parcial com quem recusou fora; recusa superada não conta),
  `approveDivision` (1: chama o sincronizador com dia BRT e turno), `courier-runs` (+1: iniciar aceita),
  `courier.route` (+2: turnos/recusa com `code` e 400 de motivo inválido; aceite do termo com IP e
  aparelho).
- web (+14): `TermsAndShifts.test.tsx` (6: texto do termo, gate, versão nova, página pública, cartão,
  sheet), `CourierScreen` (+5: gate até aceitar e libera; Perfil com o termo aceito; aceitar turno;
  recusar com motivo; cartão some com a rota iniciada), `AdminEntregas.shifts` (1), `AdminEntregadores`
  (+1), `EntregadorForm` (+1); `AdminNotificacoes` atualizado (o aviso novo).

**Verificação:** typecheck (api + web + shared) ✅ · `vite build` ✅ · api **1.976 + 3 todo** (+17)
· web **672 + 17 todo** (+14) · shared **117 + 4 todo** (+2). `prisma db push` no banco de teste.

**Divergências**
- **VT-1:** o card de divisão volta à sugestão sempre que sobram paradas **sem entregador** depois da
  aprovação — por recusa **ou** por separação feita depois. Antes, essas paradas sumiam da tela.
- **VT-2:** a aprovação deixa de mandar "Novas entregas" e passa a mandar o **turno oferecido** (mesmo
  tipo `COURIER_NEW_ORDERS`, sem toggle). O `PATCH /admin/orders/assign-courier` (só API, sem tela)
  mantém o aviso antigo e **não** cria oferta.
- **VT-3:** aceitar ou deixar sem resposta **não tira** o "Recusar": ele vale até iniciar a rota ou
  resolver a 1ª parada (D-T5). Na tela, a trava conta também a parada resolvida na sessão e a guardada
  sem sinal (correção de 06/10/2026, ver [plano-correcao-recusa-turno.md](./plano-correcao-recusa-turno.md)).
- **VT-4:** o aceite usa a **versão que o servidor diz** (`me.terms.version`), não a do app em cache —
  evita gravar versão errada. O texto mostrado é o do app.
- **VT-5:** o "Sair" do bloqueio abre a confirmação de saída de sempre (o bloqueio some enquanto ela
  está aberta), para não perder entregas guardadas.
- **VT-6:** no Perfil, o termo abre numa **tela sobreposta** (padrão das telas do entregador: mesma fila
  e câmera); a rota pública é para link externo e para o A3.
- **VT-7:** **todos os entregadores atuais** aparecem com "termo pendente" no A3 até abrirem o app depois
  do deploy.
- **VT-8:** o texto não promete liberdade de trajeto: diz que o app sugere a ordem e que o caminho até
  cada prédio é do entregador (reordenar continua com permissão).
- **VT-9:** a recusa precisa de sinal (T-T3); o aceite do termo também.
