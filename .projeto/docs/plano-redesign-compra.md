# Plano — Redesign da aba Compra (Dias em aberto + vigilância de corte)

> ⚠️ **Documento temporário de planejamento.** Referência durante a implementação.
> **Apagar ao concluir todas as fases**, quando não for mais necessário.

---

## 1. Objetivo

A aba Compra hoje ([AdminPedido.tsx](../../apps/web/src/pages/admin/tabs/AdminPedido.tsx)) opera **um único turno de um único dia** (o "próximo corte" pela Regra A) e mistura três níveis numa só tela: orientação temporal, operação do dia e histórico. Resultado: confusa e sem panorama.

Redesenhar em **três telas** e reposicionar a tela como **vigilância de corte** — não "mais uma tela pra conferir", mas o sistema cuidando do prazo pelo admin (core value do produto aplicado à operação).

**Risco operacional que motiva tudo:** a cron materializa os `Order` dos clientes no corte, mas o `PurchaseOrder` (pedido à padaria) é criado **manualmente** no `POST /admin/supplier-orders`. Se o admin esquecer, **nenhum pão é pedido**. O redesign protege contra isso com geração automática + push.

---

## 2. Decisões travadas

| Tema | Decisão |
|---|---|
| Estrutura | 3 telas: **DiasEmAberto** (nova pré-tela) → **AdminPedido(date)** (fluxo atual escopado a um dia) → **Histórico** (existente) |
| Janela | Próximos **7 dias** corridos a partir de hoje (BRT) |
| Partição lista × histórico | Por **data**: dia que passou sai da lista e vira registro |
| Geração | **Rede de segurança automática** no corte (gera com split padrão se ninguém agir) + **⚡ Gerar direto** (1 toque) + **botão manual sempre presente** ("Ajustar antes de gerar — fluxo completo") |
| Quantidade do "Gerar direto" / auto | **Só confirmados** (pedidos materializados). Previstos não entram no pedido ao fornecedor. No corte os previstos já viraram confirmados (createOrdersAtCutoff roda antes da rede de segurança), então o auto pede o total real. Decisão do usuário (2026-06-27) |
| Split padrão | Principal leva tudo; **75/25** quando há fornecedor reserva (espelha o default atual) |
| Status no card | Codificado só em **rail (cor) + pill (rótulo)**; medalhão só destaca hoje/amanhã |
| Barra de progresso | **Só no estado Parcial** |
| Dias vazios | **Colapsados** em uma linha |
| Risco | Pill/aviso vira **atalho** pros clientes sem crédito; para D+2+ é **estimativa** (saldo é point-in-time) |
| Histórico | Movido pra pré-tela; sai do detalhe |
| Desambiguação de data | Cada dia diz "entrega <dia> de manhã · corte <véspera> 22:00" (Regra A explícita) |

---

## 3. Backend

| # | Mudança | Base existente |
|---|---|---|
| B1 | `GET /admin/supplier-orders/upcoming-days?days=7` — para cada dia × slot: totais (confirmado+previsto), `generated`, `pastCutoff`, `riskCount`, `cutoffAt` | `projectScheduleDetailForDate`, `_buildDeliveryRows`, `getSlotsStatus` |
| B2 | `?date=YYYY-MM-DD` opcional em `_resolveSlot` → `draft`, `generated-status`, `draft/:condo`, `POST`. Default = Regra A | `brtNoonFromStr`, precedente em `admin-orders` |
| B3 | `createQuick(slotId, dateStr?)` — gera com split padrão sem o admin montar itens. `POST .../quick` | `getDraft`, `/admin/suppliers` |
| B4 | Rede de segurança no cron `cutoff-orders`: se não há PO finalizado pro slot no corte, chama `createQuick` (idempotente via checagem) | [cron.ts](../../apps/api/src/plugins/cron.ts) cron 4 |
| B6 | *(follow-up)* Push OneSignal T-30min "corte fecha, N pães pendentes" | módulo notifications + OneSignal |

## 4. Frontend

| # | Mudança |
|---|---|
| F1 | `AdminCompra` container (view `dias`/`detalhe`/`historico` + `selectedDate`); [AdminLayout.tsx:33](../../apps/web/src/pages/admin/AdminLayout.tsx#L33) renderiza ele |
| F2 | `DiasEmAberto` — hero de corte (urgência), day-cards, vazios colapsados, botão Histórico |
| F3 | `AdminPedido` recebe `{ deliveryDate, onBack }`; subtítulo desambiguado; sem botão Histórico; seta voltar |
| F4 | Footer do detalhe: **⚡ Gerar direto** (primário) + **Ajustar antes (fluxo completo)** (secundário) + faixa de auto-geração |
| F5 | Status só em rail+pill; progresso só no Parcial; pill Risco → atalho |

## 5. Faseamento

1. **Backend núcleo** — B1 + B2 (testável via curl).
2. **Pré-tela** — F1–F3.
3. **Gerar direto + manual** — B3 + F4/F5.
4. **Rede de segurança** — B4.
5. **Follow-ups** — B6 (push), split padrão configurável em Gestão, polish (countdown ao vivo, animações, risco-estimado).

## 6. Pontos a confirmar

- **Quantidade do gerar-direto** = **só confirmados** (decidido). Os day-cards mostram os confirmados como número principal e "+N prev." como contexto; dias sem confirmados ainda (só agenda) aparecem como "Previsto".
- **Performance** do `upcoming-days`: 7 dias × N slots reexecutam `projectScheduleDetailForDate` (refetch de schedules). Aceitável no v1; otimizar com 1 fetch de schedules se necessário.

## 8. Checklist — teste real do push T-30min (deixado para o teste E2E)

> Não testado em dev (depende de OneSignal real + device inscrito + timing). Quando for fazer o teste real:

1. **Env (apps/api/.env)** — copiar do `.env.example` e preencher pelo painel OneSignal (*Settings → Keys & IDs*):
   `ONESIGNAL_APP_ID=…` e `ONESIGNAL_REST_API_KEY=…`. (Hoje ausentes no `.env` → push é pulado silenciosamente.)
2. **Admin inscrito** — um usuário `ADMIN` precisa ter `oneSignalPlayerId` no banco; gravado quando esse admin abre o PWA e **aceita notificações**. Sem device → `admins.length === 0` → pula.
3. **Disparo T-30** — o cron roda por minuto, mas só dispara quando `HH:MM (BRT) == cutoffTime − 30min`. Pra não esperar: em Gestão → Horários de corte, setar o `cutoffTime` de um turno = (agora + 30min).
4. **Pendência real** — ter pães esperados pro turno (agendamento/avulso na data de entrega) e **não** ter gerado o pedido.
5. Cron roda em dev (`tsx watch`); não roda em `NODE_ENV=test`.

Obs.: o **número** do push usa esperado (confirmados + previstos) — alerta do que vem no corte; no corte vira o que será pedido. "Pendente" = sem `PurchaseOrder` FINALIZED para o `(slotId, data)` + há pães esperados.

Atalho opcional (não implementado): endpoint dev-only de dry-run que roda a detecção e retorna o que seria enviado, sem OneSignal nem timing.

## 9. Pré-confirmação T-2h da recarga automática (bug "previsto/sem crédito")

**Diagnóstico:** a recarga automática (`payments.chargeAutoRecharge`, off-session sem CVV) só era tentada **no exato minuto do corte**, dentro de `createOrdersAtCutoff → createOrdersForCondoSlot`. Antes do corte, o agendado fica "previsto" e a projeção marca "sem crédito" pelo saldo **atual** (point-in-time) — a recarga ainda nem foi tentada. Isso deixa a confirmação dependente de uma única tentativa no minuto do corte + latência do Stripe; qualquer demora/falha (ou o servidor não estar vivo naquele minuto — `node-cron` não faz backfill) deixa o pedido sem confirmar mesmo com auto-recarga ativa.

**Correção:** nova passada **T-2h** (`SchedulesService.preconfirmAutoRechargeAhead`, no cron por minuto). Roda em **janela `[corte − 2h, corte)`**, cobrando a auto-recarga e materializando as orders **apenas dos clientes com auto-recarga ativa** (`createOrdersForCondoSlot(..., { onlyAutoRecharge: true })`). O corte continua como fallback (idempotente → não cobra duas vezes). Dá 2h de margem para o pagamento processar.

**Robustez (anti-spam + retry na janela):** a cada minuto na janela, retenta quem ainda falta, mas com teto de **`MAX_RECHARGE_ATTEMPTS = 3` cobranças por (user, slot, dia)** (`rechargeAttempts` Map compartilhado) — retenta falhas transitórias sem martelar o cartão em recusas. O push "sem saldo" é **suprimido na janela** (`suppressInsufficientPush`) e enviado **1x no corte**. Quem confirma vira Order e é pulado por idempotência.

**Backfill de cortes perdidos** (`backfillMissedCutoffs`, no cron por minuto): examina as entregas de hoje/amanhã cujo **instante absoluto** do corte já passou mas que ainda não foram materializadas, e materializa o ciclo — **1x por ciclo**.

**Marca persistida no banco (corrige #3 — cross-midnight + restart):** o "ciclo materializado" virou o model **`MaterializedCycle`** (`@@unique([condominiumId, slotId, deliveryDate])`, índice garantido em `ensure-indexes.ts`). `createOrdersAtCutoff` e o backfill marcam o ciclo no banco; a janela T-2h e o backfill usam **instantes absolutos** (`cutoffInstantForDelivery`) em vez de comparar HH:MM. Resultado: o backfill recupera cortes **mesmo cruzando a meia-noite** e **sobrevive a restart**. Marcas antigas são limpas no cron diário (`cleanupOldMaterializedCycles`). Só o anti-spam de cobrança (`autoRechargeAttempts`) segue em memória (resetar no restart = no máx. +3 cobranças, aceitável).

**Testes:** `preconfirmAutoRechargeAhead / backfillMissedCutoffs` — (1) teto de 3 cobranças na janela + push suprimido; (2) cobrança aprovada confirma 1x e para; (3) backfill materializa 1x por ciclo via marca persistida.

## 7. Follow-ups implementados (fase 5)

- **Push T-30min** (`sendCutoffReminders` no cron por minuto): avisa admins quando faltam ~30min pro corte e há pedido pendente.
- **Split padrão configurável** (Setting `supplierSplit` + UI em Gestão): `createQuick`/rede de segurança usam o split salvo.
- **Polish**: risco a D+2+ rotulado como estimativa; countdown ao vivo (20s).

---

Mockup de referência (alta fidelidade, tokens reais): publicado como Artifact "Compra · Redesign — Dias em aberto".
