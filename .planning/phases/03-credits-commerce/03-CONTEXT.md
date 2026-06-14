# Phase 3: Credits & Commerce - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Núcleo comercial do Cheirin de Pão — o cliente autenticado pode comprar créditos de pãezinhos via combo ou compra personalizada, pagar com Pix ou cartão via Mercado Pago, e ver o saldo atualizado na Home (variação A "Carteira"). Inclui a tab bar do Cliente e a UI de configuração de compra recorrente automática (sem o cron job de disparo, que fica para Fase 4/5).

**Entregáveis desta fase:**
- Home do Cliente — variação A "Carteira" (HomeA) completa, exceto dados reais de entrega
- Tab bar: Início / Agenda / Créditos / Pedidos (Agenda e Pedidos com placeholders)
- CombosScreen: compra de combos + compra personalizada (avulsa)
- Fluxo de pagamento Pix com QR code inline + tela de espera com polling
- Fluxo de pagamento cartão via Mercado Pago Bricks (formulário inline)
- UI de configuração de compra recorrente automática (salva preferência no banco)
- Saldo de créditos exibido em tempo real na Home após confirmação de pagamento
- Extrato de transações de créditos (acessível via botão "Extrato" na HomeA)

**Requisitos desta fase:** CRED-01..11, PAY-01..02, UI-04, UI-07, UI-08 (16 requisitos)

</domain>

<decisions>
## Implementation Decisions

### Fluxo Pix pós-pagamento
- **D-01:** Após gerar o QR code, o app exibe tela de espera com o QR code Pix + código copia-e-cola e faz **polling** a cada 3–5 segundos em `GET /payments/{id}/status`. Quando o backend detecta status `approved` (via webhook do Mercado Pago), o frontend atualiza o saldo e exibe tela de sucesso. Sem WebSocket/SSE.
- **D-02:** Créditos só são creditados **após o backend receber e validar o webhook** do Mercado Pago com `status: approved`. Nunca credita antecipadamente. O polling detecta a mudança e atualiza o frontend.
- **D-03:** QR code Pix é **gerado pelo backend**: backend chama a API do Mercado Pago, recebe `qr_code_base64` e `qr_code` (copia-e-cola) e retorna ao frontend. Sem redirecionamento — experiência nativa dentro do app.

### Compra Recorrente Automática
- **D-04:** Fase 3 implementa **apenas UI + configuração**: modal/tela de escolha do modo (quando estiver acabando / toda semana) + seletor de combo, e salva a preferência no banco (campo `autoRecharge` na coleção User ou Settings). O cron job que dispara a compra automática e a tokenização de cartão ficam para Fase 4/5.
- **D-05:** A modalidade "quando estiver acabando" usa **limiar calculado pelo sistema** baseado no agendamento semanal atual: disparo quando o saldo cobrir menos de 7 dias de entrega no ritmo configurado. Sem configuração explícita pelo cliente.
- **D-06:** Quando o cron for implementado (Fase 4/5), o pagamento automático usará **cartão tokenizado no Mercado Pago** (card token salvo na primeira compra manual por cartão via Bricks). O Brick já captura o token na primeira compra — Fase 3 salva esse token associado ao usuário para uso futuro.

### Tab bar e telas desta fase
- **D-07:** Aba **"Créditos"** abre diretamente a **CombosScreen** (combos + compra personalizada). O extrato/histórico de transações de créditos é acessível via botão "Extrato" no card de saldo da HomeA — não é uma aba separada.
- **D-08:** Abas **"Agenda"** (Fase 4) e **"Pedidos"** (Fase 5) ficam como **placeholder minimalista** com ícone + texto "Em breve — disponível na próxima atualização". Tab bar funcional end-to-end desde a Fase 3.
- **D-09:** **HomeA completa exceto dados de entrega**: card de saldo real (valor do banco), botões "Comprar créditos" (→ CombosScreen) e "Extrato" (→ extrato), card "Entrega de hoje" em estado placeholder ("Nenhuma entrega agendada"), Ações rápidas navegando para as telas corretas, "Próximas entregas" como placeholder. Dados reais de entrega chegam na Fase 5.

### Mercado Pago — SDK e ambiente
- **D-10:** Backend usa o **SDK oficial `mercadopago` npm** (`apps/api`). Usar as classes `Payment`, `MerchantOrder` etc. com tipagem TypeScript incluída.
- **D-11:** Desenvolvimento e testes com **credenciais sandbox do Mercado Pago** (Access Token de sandbox). Webhooks testados via **ngrok** ou Mercado Pago CLI. Zero custo, comportamento idêntico ao prod. Env vars: `MP_ACCESS_TOKEN` (sandbox em dev, produção em prod), `MP_WEBHOOK_SECRET`.
- **D-12:** Cartão via **Mercado Pago Bricks** no frontend (`apps/web`): o componente `CardPayment` Brick renderiza formulário de cartão seguro inline — o cliente não sai do app. O Brick tokeniza o cartão no frontend e envia o token para o backend processar. PCI-compliant sem redirecionamento.

### Claude's Discretion
- Estrutura interna do módulo payments na API (controller/service/repository) — seguir Clean Architecture já estabelecida em `modules/auth/`
- Endpoint de webhook do Mercado Pago — validar assinatura com `MP_WEBHOOK_SECRET` antes de processar
- Modelo de dados para transações de crédito — usar a coleção `CREDIT_TRANSACTIONS` já definida no Prisma schema da Fase 1
- Intervalo de polling — iniciar em 3 segundos, max 5 tentativas, depois parar e sugerir "verificar mais tarde"
- Stepper de quantidade (UI-07) — implementar como componente reutilizável `<QuantityStepper min={1} max={N} value={v} onChange={fn} />` usado na CombosScreen (compra personalizada) e reutilizado na Fase 4 (agendamento)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos e Regras de Negócio
- `.projeto/Cheirin_de_Pao_Requisitos_v01.md` §CRED — CRED-01..11 (sistema de créditos completo)
- `.projeto/Cheirin_de_Pao_Requisitos_v01.md` §PAY — PAY-01..02 (pagamentos Pix e cartão)
- `.projeto/Cheirin_de_Pao_Modelo_Funcionamento.md` — modelo de negócio: como créditos são adquiridos, consumidos e como a compra recorrente funciona

### Design e UI
- `.projeto/design_handoff_cheirin_pao/app/screens-home.jsx` — HomeA (variação "Carteira"): card de saldo espresso, botões, entrega de hoje, ações rápidas, próximas entregas. **Leitura obrigatória** — alta fidelidade.
- `.projeto/design_handoff_cheirin_pao/app/screens-order.jsx` — CombosScreen (combos + compra personalizada), fluxo de pagamento Pix (QR code + espera), fluxo cartão. **Leitura obrigatória.**
- `.projeto/design_handoff_cheirin_pao/app/brand.jsx` — tokens de tema (espresso, dourado, creme), tipografia Bricolage Grotesque + Hanken Grotesk
- `.projeto/design_handoff_cheirin_pao/README.md` — guia geral de design tokens e componentes

### Código Existente (Fases 1 e 2)
- `apps/api/prisma/schema.prisma` — coleção `CREDIT_TRANSACTIONS` (transações de crédito), `PAYMENTS` (pagamentos), `COMBOS` (combos configurados pelo Admin), `USERS` (campo de saldo e autoRecharge)
- `apps/api/src/modules/auth/auth.route.ts` — padrão de módulo Fastify a seguir para o módulo `payments` e `credits`
- `apps/web/src/lib/apiFetch.ts` — wrapper de fetch com Authorization header — usar em todos os hooks de pagamento
- `apps/web/src/contexts/AuthContext.tsx` — expõe `user` com saldo — HomeA lê o saldo daqui após invalidação

### Integrações Externas
- Mercado Pago SDK npm: `mercadopago` — documentação oficial em https://github.com/mercadopago/sdk-nodejs
- Mercado Pago Bricks (frontend): SDK JS do MP para `CardPayment` Brick — documentação em https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/card-payment-brick/introduction
- Mercado Pago Pix: criar pagamento com `payment_method_id: "pix"` → retorna `qr_code_base64` e `qr_code` (copia-e-cola)
- Mercado Pago Webhooks: validar assinatura com `x-signature` header e `MP_WEBHOOK_SECRET`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/lib/apiFetch.ts` — injetar `Authorization: Bearer <token>` automaticamente — todos os hooks de compra e pagamento devem usar este wrapper
- `apps/web/src/contexts/AuthContext.tsx` — `user` com saldo de créditos — HomeA consome o saldo via context; após pagamento aprovado, invalidar/refetch o usuário para atualizar o saldo
- `apps/api/src/plugins/authenticate.ts` — preHandler de autenticação — todas as rotas de payments e credits usam este plugin
- `apps/api/src/plugins/prisma.ts` — decorator `fastify.prisma` disponível sem configuração adicional
- Coleção `COMBOS` no Prisma schema — os combos configurados pelo Admin já estão no schema; Fase 3 apenas lê esses dados

### Established Patterns
- **Módulo Fastify**: `modules/{domain}/{domain}.route.ts` + `controller.ts` + `service.ts` + `repository.ts` — Fase 3 cria `modules/payments/` e `modules/credits/` seguindo o mesmo padrão de `modules/auth/`
- **Clean Architecture**: controller → service → repository por domínio — manter separação de responsabilidades
- **Roteamento React**: `createBrowserRouter` + lazy loading por perfil — tab bar é adicionada dentro do layout `/client/*` sem alterar estrutura raiz
- **AuthContext pattern**: React Context com hook `useAuth()` — criar `useCredits()` análogo para saldo e transações

### Integration Points
- **Tab bar**: adicionar ao `ClientLayout.tsx` como componente fixo no bottom — abas navegam para sub-rotas de `/client/`
- **Webhook endpoint**: `POST /webhooks/mercadopago` — registrar **sem** o plugin `authenticate` (webhook vem do MP, não do cliente)
- **Polling endpoint**: `GET /payments/:id/status` — autenticado, retorna `{ status: 'pending' | 'approved' | 'rejected', credits?: number }`
- **Saldo no AuthContext**: após pagamento aprovado, fazer refetch do usuário (ou ter endpoint `GET /me` que retorna saldo atualizado) para HomeA exibir créditos corretos

</code_context>

<specifics>
## Specific Ideas

- **QR code Pix inline**: exibir `qr_code_base64` como `<img src={`data:image/png;base64,${qrCode}`} />` — sem dependência extra. Abaixo do QR: o código copia-e-cola com botão "Copiar" usando `navigator.clipboard.writeText`.
- **Polling com cleanup**: usar `useEffect` com `setInterval` e cleanup no `return` — parar polling ao desmontar a tela ou ao receber status `approved`/`rejected`.
- **CombosScreen tab toggle**: o design handoff mostra um segmento/toggle "Combos | Compra personalizada" com `background: t.surface2` e o item ativo com `background: t.surface` + `boxShadow: t.shadowSoft`. Replicar exatamente.
- **Stepper de quantidade**: o design usa `−` e `+` com min/max respeitados. Componente `QuantityStepper` — já previsto em UI-07 e será reutilizado na Fase 4.
- **Card de saldo HomeA**: fundo `linear-gradient(135deg, espresso, #2E1D0D)` com BreadMark watermark `opacity: 0.1`. Número grande em `Bricolage Grotesque 800 52px` cor `#FAF5EC`. Label "SEUS CRÉDITOS" em `12.5px 600` cor `#C7B595`.
- **Compra recorrente — ponto de entrada**: o design mostra acesso via configurações dentro da tela de créditos ou como opção pós-compra. Implementar como modal acessível após compra bem-sucedida e via botão nas configurações da conta.

</specifics>

<deferred>
## Deferred Ideas

- **Cron job de compra automática** — disparo automático quando saldo fica abaixo do limiar ou no dia configurado. Implementação completa (cron + pagamento automático com card token) fica para Fase 4/5.
- **Tokenização de cartão para compra recorrente** — salvar o card token do Brick para cobranças futuras. A infraestrutura de salvar o token pode ser feita na Fase 3, mas o uso via cron fica para Fase 4/5.
- **Estorno e reembolso de pagamentos** (PAY-04) — requisito da Fase 5, não desta fase.
- **Status de pagamento no painel Admin** (PAY-03) — requisito da Fase 5/7.
- **Promoções e descontos em combos** (ADMG-03) — implementação no Admin Panel, Fase 7. A CombosScreen da Fase 3 exibe `c.antes` (preço riscado) se o campo existir no combo, mas a criação de promoções fica para depois.

</deferred>

---

*Phase: 3-Credits-Commerce*
*Context gathered: 2026-06-14*
