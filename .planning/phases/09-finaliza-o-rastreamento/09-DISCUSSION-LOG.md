# Phase 9: Finalização Rastreamento - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 09-finaliza-o-rastreamento
**Areas discussed:** Abordagem: auditoria vs. novo, Deep link dos pushes de rastreamento, Badge do sino — sincronização, actionRoute das notificações in-app

---

## Abordagem: auditoria vs. novo

| Option | Description | Selected |
|--------|-------------|----------|
| Auditoria + gaps | Mesma estratégia da Fase 8: verificar o que já funciona end-to-end, identificar gaps funcionais reais e criar planos apenas para o que está quebrado ou faltando | ✓ |
| Planejar do zero | Ignorar o código existente e planejar a fase como se fosse nova, cobrindo todos os requisitos ACOMP-01..05 formalmente | |

**User's choice:** Auditoria + gaps (mesma estratégia da Fase 8)
**Notes:** Código substancial já existe (TrackingScreen 564 linhas, NotificationsScreen 277 linhas, hooks, crons, rotas backend).

---

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, auditar e marcar 05-03/05-04 | Verificar o que os planos 05-03 e 05-04 cobriam e marcá-los como concluídos no ROADMAP | ✓ |
| Não, focar só nos ACOMP-01..05 | Ignorar a numeração de planos da Fase 5 e focar apenas nos requisitos | |

**User's choice:** Sim, auditar e marcar 05-03/05-04

---

## Deep link dos pushes de rastreamento

| Option | Description | Selected |
|--------|-------------|----------|
| /client/pedidos | Abre TrackingScreen com status da entrega + histórico. Direto ao ponto — o cliente quer ver o pedido | ✓ |
| /client/notificacoes | Abre a central de notificações. Mais contexto, mas um passo a mais para ver o status | |
| Sem deep link (só abre o app) | Push informativo sem navegação específica | |

**User's choice (push de véspera):** `/client/pedidos`

---

| Option | Description | Selected |
|--------|-------------|----------|
| /client/pedidos | Consistente com o push de véspera. O cliente vê o status ENTREGUE na TrackingScreen | ✓ |
| /client/notificacoes | Abre a central para o cliente ver o card de confirmação com a mensagem completa | |
| Mesma tela do push de véspera | Qualquer push de tracking vai para /client/pedidos | |

**User's choice (push de entrega confirmada):** `/client/pedidos`

---

| Option | Description | Selected |
|--------|-------------|----------|
| Estender no ClientLayout | Adicionar 'pedidos' ao handler existente — já funciona para clientes autenticados. Menor mudança | ✓ |
| Você decide | Claude escolhe a melhor abordagem baseado no padrão existente | |

**User's choice (onde montar o deep link):** Estender no ClientLayout existente

---

## Badge do sino — sincronização

| Option | Description | Selected |
|--------|-------------|----------|
| Context de notificações | Criar NotifContext com unreadCount + refresh(). HomeScreen e NotificationsScreen compartilham o contexto | ✓ |
| Polling periódico (30s) | useNotifBadge passa a fazer polling a cada 30s — eventual, usa mesmo padrão do useOrderTracking | |
| React Router focus event | HomeScreen revalida o badge ao receber foco via visibilitychange | |

**User's choice:** Context de notificações (NotifContext)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Automaticamente ao abrir a tela | Ao montar NotificationsScreen, chama mark-all-read e atualiza o Context. UX mais simples. | ✓ |
| Botão explícito | Botão 'Marcar todas como lidas' no header da NotificationsScreen | |

**User's choice:** Automaticamente ao abrir a tela

---

## actionRoute das notificações in-app

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, CTA 'Ver pedido' → /client/pedidos | Consistente com o deep link do push. Adicionar actionRoute no sendEveReminders e CTA_CONFIG | ✓ |
| Não, notificação informativa sem CTA | DELIVERY_EVE é apenas um lembrete. Sem ação necessária | |

**User's choice (DELIVERY_EVE):** CTA 'Ver pedido' → /client/pedidos

---

| Option | Description | Selected |
|--------|-------------|----------|
| CTA 'Acompanhar' → /client/pedidos | Consistente com DELIVERY_EVE. Configurado preventivamente. | ✓ |
| Você decide | Claude configura conforme padrão da tela | |

**User's choice (OUT_FOR_DELIVERY):** CTA 'Acompanhar' → /client/pedidos

---

## Claude's Discretion

- Polling do `useOrderTracking` (30s) mantido sem alteração de intervalo
- Estrutura interna do `NotifContext`: React Context nativo seguindo padrão do `AuthContext`
- `deliveredAt` no card da TrackingScreen: exibir se disponível no response
- Estado vazio da NotificationsScreen: implementar conforme design handoff

## Deferred Ideas

- **Push de OUT_FOR_DELIVERY**: fora dos requisitos ACOMP-02/03 — defer → v2 se demandado
- **Badge em tempo real enquanto app está aberto**: WebSocket/SSE — defer → v2
- **Toggles granulares de notificações push**: já deferido no STATE.md — mantido
