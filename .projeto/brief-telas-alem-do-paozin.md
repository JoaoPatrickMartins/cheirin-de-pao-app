# Brief de telas — "Além do Pãozin" (para Claude Design)

> **Objetivo:** insumo para gerar os designs das telas da feature *Além do Pãozin* (mini market). Cada tela abaixo traz propósito, elementos, estados e conteúdo. Requisitos completos em [`add-feat-alem-do-paozin.md`](./add-feat-alem-do-paozin.md).
> **Fluxo:** gerar designs → entregar handoff → entrar no plano de implementação.

---

## 0. Sistema de design (obrigatório — alta fidelidade)

Recriar **fielmente** a linguagem visual do app existente. Referência: [`design_handoff_cheirin_pao/README.md`](./design_handoff_cheirin_pao/README.md) (seção *Design Tokens*).

- **Tema:** CLARO (creme) — padrão do produto. (Tema escuro fora de escopo inicial.)
- **Paleta (tema claro):**
  - App background `#FAF5EC` · Surface `#FFFFFF` · Surface alt `#FBF6EC` · Surface 2 `#F4EBDA` · Fundo da página `#C9BBA2`
  - Texto `#241608` · secundário `#7C6A50` · terciário `#A89A82`
  - **Espresso `#1E1207`** (cards de destaque / botão primário) · **Gold `#E3AC3F`** · Gold soft `#F3DDA6` · Accent `#B0702A`
  - Sucesso `#3E7C53` / soft `#DCEBDF`
  - Botão primário: bg `#1E1207` / texto `#FBF3E4`
- **Símbolo:** `BreadMark` (arco do pão + ondas de aroma), dourado `#E3AC3F`.
- **Primitivas já existentes** a reutilizar: `Btn`, `Card`, `Pill`, `Field`, `AppBar`, `Stepper`, `Switch`, `Row`, `StatusBar`.
- **Palco:** mobile PWA, largura de referência **390px**.
- **Idioma:** português (BR), tom aconchegante e "descolado" da marca Cheirin de Pão.

**Identidade da área "Além do Pãozin":** deve ter destaque próprio, mas conviver com o café da manhã / pão. Usar o dourado como fio condutor e o espresso nos blocos de destaque. Ícone/emoji sugerido para a aba a definir no design (algo de "cesta/mercadinho").

---

## CLIENTE

### C1. Bloco "Além do Pãozin" na Home
- **Propósito:** porta de entrada e destaque, sem competir com o card de saldo/entrega do pão.
- **Onde:** Home (HomeA "Carteira"), abaixo do bloco de saldo/entrega de hoje.
- **Elementos:** título "Além do Pãozin", subtítulo curto ("Complete seu café da manhã"), faixa horizontal com 3–4 produtos em destaque (foto + nome + preço), CTA "Ver tudo" → aba.
- **Estados:** carregando (skeleton); sem produtos ativos (esconde o bloco).

### C2. Catálogo — aba "Além do Pãozin"
- **Propósito:** navegar/descobrir produtos por categoria.
- **Elementos:** AppBar com título + ícone da Cestinha (com contador de itens); chips de **categorias** (horizontais, roláveis); **grid de produtos** (card: foto, nome, preço em R$, **badge "Pague com pãezinhos: até X% de economia"**, botão "+" para adicionar à Cestinha); busca (opcional).
- **Estados:** carregando; **catálogo vazio**; produto **"Esgotado"** (card esmaecido, sem "+"); produto de **estoque limitado** (pill "Últimas unidades").

### C3. Detalhe do produto
- **Propósito:** ver o produto e adicionar à Cestinha.
- **Elementos:** foto grande (ou ícone padrão da categoria se sem foto), nome, categoria, descrição, **preço em R$** + **equivalente em pãezinhos** ("ou 10 pãezinhos"), badge de economia, seletor de quantidade (`Stepper`), aviso de disponibilidade ("disponível seg/qua/sex" quando restrito), CTA "Adicionar à Cestinha".
- **Estados:** esgotado (CTA desabilitado + "Esgotado"); estoque baixo (aviso).

### C4. Cestinha (carrinho)
- **Propósito:** revisar itens antes do checkout.
- **Elementos:** lista de itens (foto, nome, qty editável, preço da linha) — pode conter **pães + produtos**; subtotal em R$; **aviso de mínimo** quando abaixo (`marketMinimoCestinha`): "Faltam R$ X para o mínimo da Cestinha"; CTA "Ir para pagamento" (desabilitado se abaixo do mínimo); ação remover/ajustar item; link "continuar comprando".
- **Estados:** Cestinha vazia; abaixo do mínimo.

### C5. Checkout da Cestinha
- **Propósito:** escolher forma de pagamento e confirmar. **Coração da economia.**
- **Elementos:**
  - Resumo do pedido (itens + total R$) e **data/slot de entrega** (respeita corte do slot — reusar seletor tipo "amanhã cedo").
  - **Controle de split** "Usar meus pãezinhos": stepper/slider de quantos pãezinhos aplicar (**padrão = máximo**), mostrando ao vivo:
    - pãezinhos aplicados (× valor avulso) e **valor restante em dinheiro**;
    - saldo disponível do cliente.
  - **Forma de pagamento da parte em dinheiro:** Pix / cartão salvo / novo cartão (priorizar cartão salvo, como no fluxo de combos). Se 100% em crédito, esconder o gateway.
  - **Aviso suave (não bloqueante)** quando o uso de crédito deixa o saldo abaixo do que a agenda da semana precisa: banner dourado "Isso vai deixar seu saldo abaixo do que sua agenda desta semana precisa (X pães). Continuar?".
  - CTA "Confirmar pedido".
- **Estados:** só crédito (sem gateway); misto; abaixo do mínimo (não deveria chegar aqui); erro de pagamento.

### C6. Confirmação / sucesso
- **Elementos:** check em círculo (estilo `PurchasedScreen`), "Pedido confirmado", resumo do que vem e **quando chega** ("chega junto com seu pão, amanhã às 06:30"), CTAs "Acompanhar" / "Voltar ao início".

### C7. Market no acompanhamento / histórico de Pedidos
- **Propósito:** ver o pedido do market junto dos pedidos de pão.
- **Elementos:** na lista de Pedidos, item do market com ícone próprio + lista resumida de produtos + status (mesma timeline de entrega do pão: Agendado → Saiu → Entregue); ação **Cancelar** visível **só antes do corte**.
- **Estados:** cancelável / não-cancelável (após corte); cancelado (com nota "estornado em X pãezinhos").

### C8. Add-on no pedido avulso de pão
- **Propósito:** oferecer produtos sem sair do fluxo do pão.
- **Elementos:** na `SingleScreen`, após escolher os pães, um bloco "Adicione algo do Além do Pãozin" (faixa de produtos) + CTA "Adicionar à Cestinha" → leva à Cestinha carregando os pães selecionados.

### Estados globais do cliente
Vazio de catálogo · Esgotado · Estoque limitado · Abaixo do mínimo · Saldo insuficiente para o crédito desejado (cai para misto) · Erro de pagamento.

---

## ADMIN

### A1. Lista de produtos
- **Onde:** Admin → Gestão → novo hub "Além do Pãozin".
- **Elementos:** lista/grid (foto, nome, categoria, preço, **estoque** com tipo, status ativo/esgotado); filtro por categoria; **alerta de baixo estoque** em destaque; CTA "Novo produto".

### A2. Criar / editar produto
- **Elementos:**
  - **Upload de foto** (S3) com preview + fallback de ícone da categoria; validação de tipo/tamanho.
  - Nome; descrição; **categoria** (select + "criar nova categoria" inline).
  - **Preço (R$)** com **helper de precificação ao vivo**: "= 10 pãezinhos · com saldo o cliente gasta o equivalente a R$ 10,00 (combo 3) a R$ 11,50 (combo 1)".
  - **Tipo de estoque:** Diário (reseta) / Fixo (inventário) + campo de quantidade correspondente.
  - **Disponibilidade:** sempre / dias da semana (seletor de dias).
  - Toggle ativo/inativo. CTA salvar.

### A3. Gestão de categorias
- **Elementos:** lista das categorias (6 padrão + criadas); criar/editar/excluir; ícone/emoji e ordem; aviso ao excluir categoria com produtos.

### A4. Ajuste de estoque
- **Elementos:** por produto, ajustar/repor contagem (fixo) ou capacidade diária; visão de **baixo estoque**; histórico de ajustes (opcional).

### A5. Configurações do Além do Pãozin
- **Elementos:** **mínimo da Cestinha (R$)** (`marketMinimoCestinha`); nota informativa de que o resgate de crédito segue o preço avulso (`avulsoUnit`).

### A6. Pedidos do market na separação
- **Onde:** integrar à tela de separação de pedidos existente.
- **Elementos:** por condomínio/slot, os itens do market aparecem **junto** dos pães ("3 pães · 1 geleia · 1 pão de queijo"), com quantidades para separar.

---

## ENTREGADOR

### E1. Lista/rota com itens do market
- **Elementos:** na lista de entregas por parada/cliente, mostrar os itens do market junto do total de pães (ex.: "Ap 302 — 4 pães + 1 bolo"); marcação de entrega igual à atual.

---

## Notas para o design
- **Não** recriar o "chrome" de demonstração do protótipo (troca de perfil/tema).
- Densidade da **tab bar com 6 itens**: propor solução (ícones + rótulos curtos, ou priorização) que caiba bem em 390px.
- Manter consistência com telas já existentes: `CombosScreen` (loja/checkout), `SingleScreen` (pedido/seleção de data), `TrackScreen` (timeline de entrega), hub `AdminGestao`.
- Badge de economia e "equivalente em pãezinhos" devem aparecer de forma clara mas sem poluir o card do produto.
