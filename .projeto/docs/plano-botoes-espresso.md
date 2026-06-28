# Plano — Padronizar botões CTA dourados → fundo espresso

**Objetivo:** Todos os botões de ação primária com fundo dourado/âmbar (`--color-gold` #E3AC3F e os CTAs `--color-accent` #B0702A mostrados nos prints) passam a usar o estilo espresso já existente em "Salvar condomínio" / "Salvar horários":

- `background: var(--color-espresso)` (#1E1207)
- `color: #FAF5EC` (texto e ícones)

## Botões convertidos

### Gold (`--color-gold`)
- `AdminCondos.tsx` — GoldBtn "Adicionar condomínio"
- `AdminCombos.tsx` — GoldBtn "Novo combo"
- `AdminFornecedores.tsx` — GoldBtn "Novo fornecedor"
- `AdminEntregadores.tsx` — GoldBtn "Cadastrar entregador"
- `CreditBalanceCard.tsx` — "Comprar créditos"
- `BannerInsuficiente.tsx` — "Comprar mais" (também remove borda dourada)
- `DeliveryDivisionCard.tsx` — "Aprovar divisão" (+ ícone)
- `PixWaitingScreen.tsx` — 2 botões
- `HomeScreen.tsx` — "Comprar créditos"
- `QrScanner.tsx` — botão de scan

### Accent CTA (`--color-accent`) — barras de ação mostradas nos prints
- `AdminPedido.tsx` — Footer CTA ("Escolher fornecedores" / "Ver no histórico")
- `AdminPedido.tsx` — "Gerar direto" (inline, step 0)
- `AdminPedido.tsx` — "Finalizar pedido"
- `ClientDetailView.tsx` — "Salvar" (notas internas)

## Excluído de propósito
- `DiasEmAberto.tsx` "Gerar direto" — fica dourado: está sobre card escuro (gradiente espresso); espresso sumiria. Não aparece nos prints.
- Usos decorativos de gold/accent: progress bars, dots, badges, tags, segmentos de gráfico, avatares.
- Botões accent semânticos: bloquear/desbloquear cliente, etc.

## Validação
- `npm run typecheck` no app web.
