# Handoff — Além do Pãozin (mini market · Cheirin de Pão)

> **Origem:** design gerado no Claude Design a partir de [`brief-telas-alem-do-paozin.md`](./brief-telas-alem-do-paozin.md). **Entregue em 23/07/2026** como insumo do plano de implementação.
> **Escopo:** este handoff cobre **apenas as adições** (telas novas). O que já existe no app permanece como está.
> **Requisitos:** [`add-feat-alem-do-paozin.md`](./add-feat-alem-do-paozin.md).
>
> ⚠️ **Adição solicitada pós-handoff:** incluir um **resumo de pedido antes da realização do pagamento** (passo "Revisar pedido"), espelhando o padrão que já existe hoje no app. Ver requisito **MKT-33** no doc de requisitos.

---

Spec de implementação da feature **Além do Pãozin**: mercadinho de produtos que acompanham o pão, com pagamento em dinheiro **ou** com pãezinhos (créditos). Mockup de referência: `Cheirin de Pão - App.html`. Tokens/primitivas em `app/brand.jsx`; dados mock em `app/data.jsx`.

Arquivos da feature:
- `app/screens-market.jsx` — Cliente: catálogo, detalhe, cestinha, cards (`ProdCard`, `MarketMiniCard`), bloco da Home (`MarketHomeBlock`), foto padrão (`ProdPhoto`).
- `app/screens-market2.jsx` — Cliente: checkout (`MarketCheckout`) e sucesso (`MarketDone`).
- `app/screens-market-admin.jsx` — Admin: hub `MarketAdmin` (produtos, form, categorias, estoque, config, separação).
- Integrações: `app/app.jsx` (roteamento + tab bar + `FloatingCart`), `app/screens-home.jsx` (bloco C1 + pedido no histórico C7), `app/screens-order.jsx` (add-on C8), `app/screens-roles.jsx` (E1), `app/screens-admin2.jsx` (entrada no hub de Gestão), `app/data.jsx` (catálogo, categorias, config, separação).

---

## 1. Conceito e regra de negócio

Cada **pãozinho/crédito** vale um pão fresco. No mercadinho ele também funciona como moeda: o cliente resgata créditos para pagar produtos, ao **preço avulso** (`pricing.avulsoUnit`, hoje R$ 1,20/pão).

- **Equivalência:** `pãezinhos = round(preçoR$ / avulsoUnit)`. Ex.: R$ 12,00 = 10 pãezinhos.
- **Desconto (foco da UX):** como o cliente compra créditos via combo (mais barato que o avulso), pagar com pãezinhos sai mais em conta. `economiaCredito = round((1 − comboUnitMaisBarato / avulsoUnit) × 100)` ≈ **37%**. **Todo card/tela deixa explícito que o desconto é no pagamento com pãezinhos** (selo `🥖 −X%`).
- **Split:** no checkout o cliente escolhe quantos pãezinhos aplicar (padrão = máximo); o restante vai em dinheiro. `creditValue = min(aplic × avulsoUnit, total)`, `cash = total − creditValue`.
- **Mínimo da cestinha:** `MARKET_CFG.minimo` (R$ 15,00). Abaixo disso o checkout fica bloqueado.
- **Entrega:** o pedido do market chega **junto com o pão**, no mesmo slot (respeita o corte). Sem frete próprio.

---

## 2. Modelo de dados (a mover para o backend)

**Produto** (`MARKET_PRODS`):
`{ id, nome, cat, preco (R$), desc, estoqueTipo: 'diario'|'fixo', estoque, dispo: 'sempre'|['seg','qua',…], ativo, esgotado?, limitado? }`
- `estoqueTipo` **diário** reseta a capacidade a cada dia; **fixo** é inventário que decrementa.
- `dispo` restrito = produto só aparece disponível nos dias listados.
- Foto: no app real, **upload S3** com preview; fallback = ícone/cor da categoria (no mockup a foto é uma imagem-padrão por categoria — ver §6).

**Categoria** (`MARKET_CATS`): `{ k, nome, emoji }` — 6 padrão + criadas pelo admin. Ordem editável.

**Config** (`MARKET_CFG`): `{ minimo }`. Resgate de crédito segue sempre `pricing.avulsoUnit` (config em Gestão › Compra personalizada).

**Pedido do market** (`MARKET_ORDER`) e **separação** (`MKT_SEPARACAO`) são mocks de leitura; no app derivam dos pedidos reais.

Helpers em `data.jsx`: `paezinhosDe(preco, unit)`, `economiaCredito(pricing, combos)`.

---

## 3. CLIENTE

### C1 — Bloco na Home (`MarketHomeBlock`)
Abaixo dos atalhos e acima de "Próximas entregas" (nas 3 variações de Home). Título "Além do Pãozin" + subtítulo + "Ver tudo" → aba. Faixa horizontal de até 6 `MarketMiniCard`.
- **Estados:** `loading` (skeleton); **sem produtos ativos → esconde o bloco** (`return null`).

### C2 — Catálogo (`MarketCatalog`, aba "Cestinha")
AppBar com ícone da cestinha (basket) + botão de cesta com contador; busca; chips de categoria roláveis; banner "Duas formas de pagar" (dinheiro ou pãezinhos, economia até X%); grid 2 col de `ProdCard`.
- **Estados:** catálogo vazio (empty state); **esgotado** (card esmaecido, badge "Esgotado", botão desabilitado); **estoque limitado** (badge "Últimas"); busca sem resultado.

### C3 — Detalhe (`ProductDetail`)
Foto grande, categoria, nome, **painel de 2 preços** (À vista R$ × Com pãezinhos, com selo −X% e "economize até X%"), descrição, aviso de disponibilidade (quando restrito), aviso de estoque baixo, `Stepper` + CTA "Adicionar".
- **Estados:** esgotado (CTA "Esgotado" desabilitado); estoque baixo (aviso).

### C4 — Cestinha (`Cestinha`)
Lista de itens (foto, nome, qty editável, preço da linha, remover); pode conter **pães + produtos** (linha "Seu pedido de pão", paga com créditos, quando vem do add-on C8); subtotal R$; aviso de mínimo ("Faltam R$ X…"); "Continuar comprando"; CTA "Ir para pagamento" (desabilitado abaixo do mínimo).
- **Estados:** vazia; abaixo do mínimo.

### C5 — Checkout (`MarketCheckout`) — coração da economia
Resumo do pedido (itens + total); slot de entrega (reusar seletor "amanhã cedo"); **controle de split "Usar meus pãezinhos"** (stepper + barra + atalhos "Só dinheiro"/"Usar o máximo", **padrão = máximo**), com leitura ao vivo: pãezinhos aplicados (× avulso), valor restante em dinheiro, saldo disponível, **selo −X%** e linha "Economia de R$ Y pagando com pãezinhos"; balanço equilibrado **Com pãezinhos × Em dinheiro**; forma de pagamento da parte em dinheiro (**cartão salvo priorizado** / Pix / novo cartão); **aviso suave dourado (não bloqueante)** quando o uso de crédito deixa o saldo abaixo do que a agenda da semana precisa; CTA "Confirmar pedido".
- **Estados:** só crédito (esconde gateway, mostra "pago 100% com pãezinhos"); misto; erro de pagamento (a implementar); sem pãezinhos (total no dinheiro).
- `AGENDA_SEMANA` é mock — no app, calcular do agendamento real do cliente.

### C6 — Sucesso (`MarketDone`)
Check em círculo, "Pedido confirmado", resumo dos itens, quando chega ("chega junto com seu pão, {slot}"), pãezinhos usados + valor cobrado, CTAs "Acompanhar" / "Voltar ao início".

### C7 — Market no histórico (`HistoryScreen`)
Card do pedido do market com ícone próprio (basket), resumo de itens, status (mesma timeline do pão: Agendado → Saiu → Entregue), **Cancelar só antes do corte**.
- **Estados:** cancelável / não-cancelável; cancelado (nota "estornado em X pãezinhos").

### C8 — Add-on no pedido de pão (`SingleScreen`)
Após escolher os pães, bloco "Adicione algo do Além do Pãozin" (faixa de `MarketMiniCard` com botão +) + CTA "Adicionar à Cestinha" → leva à Cestinha carregando os pães selecionados (`mkt.addBread(qtd)`).

### Estado do carrinho (mockup → app)
No mockup vive em memória no `ClientApp` (`cart`, `mktPaes`, `mktSel`, `mktLast`) via o objeto **`mkt`** (`add/setQty/remove/qtyOf/items/subtotal/count/open/confirm/addBread`). No app: carrinho por usuário no backend, persistente entre sessões e dispositivos.

---

## 4. ADMIN — hub "Além do Pãozin" (`MarketAdmin`)
Entrada em **Gestão › Além do Pãozin**. Sub-seções (chips): Produtos · Categorias · Estoque · Separação · Config.

- **A1 Produtos** (`MA_Produtos`): grid/lista (foto, nome, categoria, preço, estoque + tipo, status Ativo/Baixo/Esgotado/Inativo); filtro por categoria; **alerta de baixo estoque** em destaque; "Novo produto".
- **A2 Criar/editar** (`MarketProductForm`): **upload de foto** (S3, preview, validação tipo/tamanho — no mockup é `<image-slot>` arrastável); nome; descrição; categoria (select + "criar nova" inline); **preço R$ com precificação ao vivo** ("= N pãezinhos · com saldo o cliente gasta o equivalente a R$ X (combo mais barato) a R$ Y (combo mais caro)"); tipo de estoque (Diário/Fixo) + quantidade; disponibilidade (sempre / dias da semana); toggle ativo. Salvar.
- **A3 Categorias** (`MA_Categorias`): lista (emoji + nº de produtos + ordem); criar/editar/excluir; **excluir bloqueado se houver produtos** na categoria.
- **A4 Estoque** (`MA_Estoque`): por produto, repor inventário (fixo) ou ajustar capacidade (diário); ordena os mais baixos no topo; destaca baixo/esgotado.
- **A5 Config** (`MA_Config`): **mínimo da Cestinha (R$)**; nota de que o resgate segue o preço avulso (`avulsoUnit`).
- **A6 Separação** (`MA_Separacao`): por condomínio/slot, itens do market **junto dos pães** ("142 🥖 + N itens", com chips por produto). No app real, integrar à tela de separação existente.

Persistência: no mockup as edições são locais (sessão). No app, CRUD real com otimista/rollback.

---

## 5. ENTREGADOR (E1 · `CourierScreen`)
Na lista de paradas, os itens do market aparecem junto do total de pães: chips dourados por parada ("1 geleia", "2 suco") + "+N itens" ao lado do número de pães. Marcação de entrega inalterada. Anexado por parada em `ENTREGAS[].paradas[].mkt`.

---

## 6. Navegação e chrome

- **Tab bar do cliente (5 itens):** `Início · Agenda · Créditos · Cestinha · Pedidos` — ícones `home / calendar / wallet / basket / clock`. A aba "Cestinha" abre o catálogo.
- **Botão flutuante da Cestinha** (`FloatingCart`): aparece quando há itens no carrinho, sobre as telas de tab (exceto no próprio catálogo/checkout); mostra contador + subtotal; abre a Cestinha.
- **Ícone da área:** sempre o **basket** (cestinha), nunca o carrinho, em toda a feature.
- Rotas adicionadas ao `ClientApp`: `market · product · cestinha · checkout · marketDone`.

---

## 7. Design tokens (de `app/brand.jsx`, tema light)

- Tipografia: títulos **Bricolage Grotesque** (700/800, tracking negativo); corpo **Hanken Grotesk** (400–800).
- Cores: `espresso #1E1207` (blocos de destaque, botão primário), `gold #E3AC3F` / `goldSoft` (fio condutor da área + selos de desconto), `accent #B0702A`, `good #3E7C53` (economia), superfícies creme (`appBg #FAF5EC`, `surface`, `surface2`), texto `#241608`/`textSec`/`textTer`.
- Botão primário: bg `espresso` / texto `#FBF3E4`. Raios 16–22 (cards), 40 (telefone). Sombras `shadowSoft`/`shadow`.
- **Use os tokens do `brand.jsx`** (`useT()`), não hard-code hex. Exceção: `CAT_TINT` em `screens-market.jsx` (gradientes de foto-padrão por categoria) — trocar por fotos reais no app.
- Tema **claro** é o escopo; o tema escuro do protótipo já herda os mesmos componentes.

---

## 8. Foto padrão (mockup) → fotos reais (app)
No mockup, `ProdPhoto` desenha um gradiente por categoria (`CAT_TINT`) + emoji, apenas para demonstração — **não** mostra placeholder de "arraste". No app: renderizar a foto do produto (S3); sem foto, cair no ícone/cor da categoria. O `<image-slot>` arrastável existe só na tela de criar/editar produto do admin.

---

## 9. Acessibilidade / pontas soltas
- Selos de desconto precisam de texto acessível (não confiar só em cor) — já usam "🥖 −X%".
- Estados de erro de pagamento (C5) e loading de rede: só esboçados no mockup; implementar no app.
- Números (`AGENDA_SEMANA`, receita, separação) são mock — ligar aos dados reais.
