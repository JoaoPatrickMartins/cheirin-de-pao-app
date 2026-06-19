# Phase 8: Finalização Pagamentos - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 08-finalizacao-pagamentos
**Areas discussed:** Código existente, HomeA Carteira, Banner crédito insuficiente, Credenciais MP sandbox

---

## Código Existente

**Descoberta durante scout:** Os planos 03-03/03-05/03-06 têm código substancial no repositório (webhooks.service.ts completo, CombosScreen 407 linhas, PixWaitingScreen 262 linhas, CardPaymentScreen 127 linhas) mas o ROADMAP os marca como não executados.

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Auditar e completar gaps | Phase 8 audita o código existente, identifica o que funciona, cria planos só para gaps reais | ✓ |
| Tratar como se não existisse | Planejar do zero, ignorando código atual | |
| Executar planos 03-03/05/06 primeiro | Rodar /gsd:execute-phase 3 antes da Phase 8 | |

**User's choice:** Auditar e completar gaps

| Critério de gap | Descrição | Selecionado |
|----------------|-----------|-------------|
| Funcionalidade faltando ou quebrada | Criar plano se não funciona, não existe, ou não foi testado end-to-end | ✓ |
| Cobertura de requisitos CRED/PAY | Verificar cobertura de cada requisito | |
| Fidelidade ao design handoff | Diferenças visuais significativas | |

**User's choice:** Funcionalidade faltando ou quebrada

| Ação sobre planos 03 | Descrição | Selecionado |
|--------------------|-----------|-------------|
| Sim, marcar como concluídos | Marcar 03-03/05/06 como concluídos no ROADMAP ao verificar | ✓ |
| Não, deixar como estão | Manter status atual no ROADMAP | |

**User's choice:** Sim, marcar como concluídos ao verificar

---

## HomeA Carteira

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Saldo real + tab bar funcional | "Entrega de hoje" como placeholder até Phase 9 | |
| Home completa incluindo status da entrega | Implementar "Entrega de hoje" com dados reais já na Phase 8 | ✓ |

**User's choice:** Home completa incluindo status da entrega

| Dados da entrega | Descrição | Selecionado |
|-----------------|-----------|-------------|
| 3 estados visuais + dado real do banco | Agendado/Saiu/Entregue via GET /orders/today; sem push ainda | ✓ |
| Apenas placeholder visual fiel | Card com design correto mas estado estático | |

**User's choice:** 3 estados visuais + dado real do banco

| Abordagem HomeScreen | Descrição | Selecionado |
|--------------------|-----------|-------------|
| Verificar e completar | Auditar botões, saldo, "Entrega de hoje", "Próximas entregas" | ✓ |
| Só verificar | Confirmar que o existente funciona sem novas implementações | |

**User's choice:** Verificar e completar

---

## Banner Crédito Insuficiente

| Localização do banner | Descrição | Selecionado |
|----------------------|-----------|-------------|
| Só na CombosScreen | Banner já existe na tela de compra | |
| CombosScreen + HomeA | Adicionar aviso também na HomeA quando saldo zerado | |
| CombosScreen + HomeA + push | Banner nas telas + notificação push quando saldo crítico | ✓ |

**User's choice:** CombosScreen + HomeA + push notification

| Disparo da push | Descrição | Selecionado |
|----------------|-----------|-------------|
| Cron de meia-noite quando saldo < consumo semanal | Reutiliza cron existente da Phase 4 | ✓ |
| Imediatamente após configurar agenda | Disparado pelo schedules.service ao salvar | |

**User's choice:** No cron de meia-noite quando saldo < consumo semanal

| Formato da push | Descrição | Selecionado |
|----------------|-----------|-------------|
| Deep link para CombosScreen | additionalData: { screen: 'creditos' } | ✓ |
| Push com 2 botões de ação | Action buttons "Comprar" e "Ajustar agenda" via OneSignal | |

**User's choice:** Deep link para CombosScreen

---

## Credenciais MP Sandbox

| Abordagem | Descrição | Selecionado |
|-----------|-----------|-------------|
| user_setup blocking nos planos | Executor para e pede as credenciais antes dos testes | ✓ |
| Assumir que já estão configuradas | Pular instrução de setup | |
| Criar script de setup | Script verifica env vars e orienta o desenvolvedor | |

**User's choice:** user_setup blocking nos planos

| Ferramenta para webhooks locais | Descrição | Selecionado |
|--------------------------------|-----------|-------------|
| ngrok | Túnel HTTPS para localhost, configuração simples no dashboard MP | ✓ |
| Mercado Pago CLI | CLI oficial do MP, mais integrado | |
| Simular manualmente via curl | Sem túnel, mas manual | |

**User's choice:** ngrok

---

## Claude's Discretion

- Estrutura interna do alerta de crédito insuficiente na HomeA (card dismissível vs banner fixo) — implementar conforme design handoff
- Threshold exato para alerta na HomeA (saldo = 0 vs saldo < consumo próximos 7 dias) — começar com saldo = 0
- Mensagem exata na push notification de crédito insuficiente — estilo conversacional Cheirin de Pão

## Deferred Ideas

- Push de crédito insuficiente com 2 botões de ação (action buttons OneSignal) — defer; deep link suficiente por agora
- Alerta baseado em previsão de 7 dias (não apenas saldo zerado) — defer para ajuste pós-lançamento
- Script de setup automático de env vars — user_setup blocking é suficiente
