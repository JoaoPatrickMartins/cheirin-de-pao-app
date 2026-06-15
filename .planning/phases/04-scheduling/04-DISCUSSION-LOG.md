# Phase 4: Scheduling - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 4-Scheduling
**Areas discussed:** Recorrência semanal, Data no pedido único, Notificação de domingo, Cron de compra automática

---

## Recorrência semanal

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Cron diário (recomendado) | Todo dia à madrugada cria Orders do dia seguinte para cada Schedule ativo | ✓ |
| Ao salvar a agenda | Cria Orders para os próximos 7 dias e reserva todos os créditos imediatamente | |
| Lazy — Phase 6/7 gera | Schedule é apenas configuração; Orders criados quando entregador monta rota | |

**User's choice:** Cron diário

---

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Meia-noite + Order criado mesmo sem crédito (recomendado) | Cria Order com status SCHEDULED, marca como "sem cobertura" se não tiver crédito | |
| **Meia-noite + só cria Order se tiver crédito** | Se saldo insuficiente, Order não é criado e cliente recebe notificação de alerta | ✓ |
| Horário de corte configurado pelo Admin | Cron processa após horário de corte configurado — Fase 4 usa 22h hard-coded | |

**User's choice:** Meia-noite + só cria Order se tiver crédito

---

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Projeção calculada no frontend (recomendado) | Soma das quantidades do plan local — não depende de Orders no banco | ✓ |
| Dados do banco (Orders reais) | Busca Orders da semana corrente do backend — mais preciso mas só funciona após o cron | |

**User's choice:** Projeção calculada no frontend

---

## Data no pedido único

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Quick chips + "Outra data" (recomendado) | Chips rápidos + input type=date nativo para datas arbitrárias | ✓ |
| Só quick chips | Apenas chips de datas próximas como no design handoff | |
| Date picker completo | Componente de calendário completo — novo padrão no projeto | |

**User's choice:** Quick chips + "Outra data"

---

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Hard-coded 21h por enquanto (recomendado) | Constante CUTOFF_HOUR = 21; "Amanhã" desabilitado após 21h | ✓ |
| Sem restrição por enquanto | Qualquer data futura aceita; validação real entra na Fase 7 | |

**User's choice:** Hard-coded 21h

---

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Até 30 dias à frente (recomendado) | Range razoável; date picker usa min/max | ✓ |
| Sem limite definido | Qualquer data futura — pode gerar pedidos muito distantes | |

**User's choice:** Até 30 dias à frente

---

## Notificação de domingo

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Só salva a preferência (recomendado) | notifyReconfigure: true/false salvo no Schedule; envio fica para Fase 5 | |
| Já implementa o envio via OneSignal | Fase 4 configura OneSignal e implementa o cron de domingo | ✓ |

**User's choice:** Já implementa o envio via OneSignal

---

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Cron no backend + OneSignal REST API (recomendado) | Sem SDK extra — só fetch com API key | |
| OneSignal SDK no backend | @onesignal/node-onesignal — mais tipagem, Fase 5 usa o mesmo SDK | ✓ |

**User's choice:** OneSignal SDK no backend

---

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Frontend registra o player_id após instalação (recomendado) | POST /users/push-token com player_id — padrão OneSignal + PWA | ✓ |
| OneSignal External User ID | Setar userId do banco como external_id — exige config extra no painel | |

**User's choice:** Frontend registra o player_id

---

## Cron de compra automática

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Sim — entra na Fase 4 (recomendado) | UI já existe da Fase 3; Fase 4 completa CRED-07/10 | ✓ |
| Não — defer para Fase 5 | Junto com notificações push; Fase 4 mais enxuta | |

**User's choice:** Sim — entra na Fase 4

---

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Saldo < consumo de 7 dias (recomendado) | Definido em D-05 da Fase 3 — consistente com decisão anterior | ✓ |
| Saldo = 0 ou abaixo de threshold fixo | Número fixo, não leva em conta o ritmo de consumo | |

**User's choice:** Saldo < consumo de 7 dias

---

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Notificação de falha + não retenta (recomendado) | Push "Compra automática falhou", próximo cron tenta novamente | ✓ |
| Retenta 1 vez após 1 hora | Retry em 1h se falhar, depois notifica | |

**User's choice:** Notificação de falha + não retenta

---

## Claude's Discretion

- Estrutura interna dos módulos `schedules` e `orders` (controller/service/repository)
- Biblioteca de cron no backend (`node-cron` ou `@fastify/schedule`)
- Endpoints específicos: `GET /schedules/me`, `POST /orders`, `PUT /schedules/me`
- Campo `oneSignalPlayerId` no modelo User do Prisma schema

## Deferred Ideas

- Múltiplos agendamentos por condomínio (ex: 2 moradores com horários diferentes)
- Cancelamento de pedido único após confirmação (reembolso de créditos) — Fase 5/7
- Pausa de agenda (ex: férias) — fase futura
- Horário de corte configurável pelo Admin (ADMO-01) — Fase 7
