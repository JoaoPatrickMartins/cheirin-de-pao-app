# Phase 3: Credits & Commerce - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 3-Credits-Commerce
**Areas discussed:** Fluxo Pix pós-pagamento, Compra recorrente automática, Tab bar e telas desta fase, Mercado Pago — SDK e ambiente de testes

---

## Fluxo Pix pós-pagamento

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Tela de espera com polling | App exibe QR code + status "Aguardando..." e faz polling a cada 3–5 segundos | ✓ |
| Tela estática + navegação manual | App exibe QR code, cliente volta manualmente após pagar | |
| Simular instantâneo em dev | Mock em development, webhook em produção | |

**Escolha do usuário:** Tela de espera com polling

---

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Só após webhook confirmado | Créditos creditados apenas após backend receber webhook `approved` | ✓ |
| Otimisticamente ao gerar QR | Credita ao gerar QR, cancela se webhook não chegar | |

**Escolha do usuário:** Só após webhook confirmado

---

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| QR code gerado pelo backend | Backend chama MP, retorna qr_code_base64 e copia-e-cola para o frontend | ✓ |
| Redirecionamento para página do MP | App abre link de pagamento do MP em nova aba/webview | |

**Escolha do usuário:** QR code gerado pelo backend

---

## Compra Recorrente Automática

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| UI + configuração apenas | Fase 3 implementa configuração (modal + banco). Cron e tokenização ficam para Fase 4/5 | ✓ |
| Implementar tudo: UI + cron + cartão tokenizado | Fase 3 implementa tudo, incluindo cron job e tokenização de cartão | |

**Escolha do usuário:** UI + configuração apenas

---

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Fixo no sistema, baseado no agendamento semanal | Limiar = < 7 dias de cobertura no ritmo atual. Sem configuração explícita | ✓ |
| O próprio cliente define o limiar | Cliente configura "compre quando saldo < X pães" | |
| Limiar fixo configurado pelo Admin | Admin define o padrão nas configurações | |

**Escolha do usuário:** Fixo no sistema, baseado no agendamento semanal

---

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Cartão tokenizado no Mercado Pago (card token) | Token salvo na primeira compra via Bricks, usado em cobranças automáticas futuras | ✓ |
| Notificação push + link de pagamento | MP dispara notificação com link para cliente confirmar manualmente | |
| Decidir depois (Fase 4) | Deixar a decisão para quando o cron for implementado | |

**Escolha do usuário:** Cartão tokenizado no Mercado Pago

---

## Tab bar e telas desta fase

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Aba "Créditos" = CombosScreen (tela de compra) | Aba abre diretamente a tela de compra. Extrato acessível via botão na HomeA | ✓ |
| Aba "Créditos" = Extrato de créditos | Aba exibe histórico, CTA para comprar mais | |
| Aba "Créditos" = Hub com saldo + ações | Card de saldo grande + botões (duplica informação da Home) | |

**Escolha do usuário:** Aba "Créditos" = CombosScreen (tela de compra de combos)

---

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Placeholder minimalista com mensagem | Abas Agenda/Pedidos mostram "Em breve — disponível na próxima atualização" | ✓ |
| Abas desabilitadas visualmente | Agenda e Pedidos acinzentadas/não clicáveis na tab bar | |

**Escolha do usuário:** Placeholder minimalista com mensagem

---

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| HomeA completa exceto dados de entrega | Toda a estrutura da HomeA implementada; card entrega em estado placeholder | ✓ |
| HomeA simplificada: só saldo e botão comprar | Apenas card de saldo e botão de compra; resto fica para fases seguintes | |

**Escolha do usuário:** HomeA completa exceto dados de entrega

---

## Mercado Pago — SDK e ambiente de testes

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| SDK oficial `mercadopago` npm | Instala `mercadopago` no apps/api. Tipagem TypeScript incluída | ✓ |
| REST direto com fetch nativo | Chama API REST do MP diretamente. Mais controle, sem dependência extra | |

**Escolha do usuário:** SDK oficial `mercadopago` npm

---

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Sandbox do MP com credenciais de teste | Access Token de sandbox, números de cartão de teste, webhook via ngrok/MP CLI | ✓ |
| Mock local sem chamar o MP | Em development, pagamento aprovado automaticamente (sem chamar MP) | |

**Escolha do usuário:** Sandbox do Mercado Pago com credenciais de teste

---

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Mercado Pago Bricks no frontend | CardPayment Brick renderiza formulário inline, tokeniza no frontend, sem redirecionamento | ✓ |
| Redirecionamento para checkout do MP | Criar preference e redirecionar para URL do MP. Cliente sai do PWA | |

**Escolha do usuário:** Mercado Pago Bricks no frontend

---

## Claude's Discretion

- Estrutura interna dos módulos `payments` e `credits` na API (controller/service/repository)
- Validação de assinatura do webhook do Mercado Pago (`x-signature` header)
- Intervalo e limite de polling (3s inicial, max 5 tentativas)
- Modelo de dados de card token no schema Prisma (campo `cardToken` em `User` ou tabela separada)
- Componente `QuantityStepper` — props e comportamento interno

## Deferred Ideas

- Cron job de compra automática — disparo real quando saldo fica abaixo do limiar. Fase 4/5.
- Tokenização de cartão para uso via cron. Fase 4/5.
- Estorno e reembolso (PAY-04). Fase 5.
- Status de pagamento no painel Admin (PAY-03). Fase 5/7.
- Criação de promoções e descontos em combos (ADMG-03). Fase 7.
