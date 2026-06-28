# Plano — Redesign da Home do Cliente (1:1 com protótipo + animações premium)

> ⚠️ **Documento temporário de planejamento.** Referência durante a implementação.
> **Apagar ao concluir todas as fases**, quando não for mais necessário.

---

## 1. Objetivo

Reconstruir a **Home do Cliente** ([HomeScreen.tsx](../../apps/web/src/pages/client/HomeScreen.tsx)) para ficar **1:1 com o protótipo `HomeA` ("Carteira")**, elevando o acabamento (premium/sofisticado) e adicionando uma **camada de animações sutis e elegantes** que reforcem a sensação de produto único — sem sacrificar a funcionalidade já existente (saldo real, entrega real, agenda real, banners de corte/risco).

**Fonte da verdade visual (canônica):**
- [screens-home.jsx](../../.projeto/design_handoff_cheirin_pao/app/screens-home.jsx) → `HomeA`, `Greet`, `TodayDelivery`, `QuickActions`, `NextDays`
- [brand.jsx](../../.projeto/design_handoff_cheirin_pao/app/brand.jsx) → primitivas `Card`, `Btn`, `Pill`, `BreadMark`, `Icon`, tokens `THEMES.light`
- [README.md](../../.projeto/design_handoff_cheirin_pao/README.md) → "Home: variação A (implementar **apenas `HomeA`**)", tema **claro**

O print enviado pelo usuário é exatamente um render desse `HomeA` (confere: "Bom dia, Marina · Residencial Aurora · A 102", "38 pães / Rende ~9 dias" = `floor(38/4)`, "Entrega de hoje · 4 pães · Chega até 7:15 · A caminho", Agenda/Avulso/Histórico, Qui12/Sex13/Sáb14/Dom15(folga)/Seg16).

---

## 2. Diff seção a seção — atual × protótipo (o que muda)

| Seção | Hoje (HomeScreen.tsx) | Protótipo `HomeA` (alvo) | Ação |
|---|---|---|---|
| **Header / Greet** | Label "Condomínio" + `{greeting}, {firstName}` (display 22). Sino com ícone `accent`. Sem avatar. | Avatar 42×42 espresso com `BreadMark` dourado 28; linha 1 = `Bom dia, {nome}` (12.5 textTer); linha 2 = `{condomínio} · {apto}` (Bricolage 17, text). Sino 40×40 surface + dot dourado. | Recriar `Greet` 1:1. Usar `user.condominiumName` + `user.apartment` (fallback gracioso). Manter dot condicional a `unreadCount`. |
| **Card de saldo** | Footer com "Comprar créditos" **espresso** + "Extrato" **soft**, sem ícones. "Rende ~`floor(saldo)` dias" (assume 1/dia — incorreto). | Footer "Comprar créditos" **dourado (gold) + ícone `plus`**, full; "Extrato" **soft + ícone `clock`**. "Rende ~`floor(saldo/4)` dias". Card com `border2`. | Ajustar [CreditBalanceCard.tsx](../../apps/web/src/components/client/CreditBalanceCard.tsx): botões nas variantes/ícones do protótipo + hover `translateY(-1px)`+brilho. Recalcular "rende" pelo **ritmo real** da agenda (ver §5). |
| **Entrega de hoje** | Card único espresso: ícone + label + título + pill de status (3 estados). Sem ETA, sem rodapé branco, sem chevron. | **Duas seções**: topo espresso (caixa de ícone 46×46 `rgba(227,172,63,.16)` + label dourado + título Bricolage 18) **+ rodapé branco** (relógio "Chega até **HH:MM**" · `Pill good` com dot + "A caminho" · chevron). Watermark `BreadMark` no topo. | Recriar `TodayDelivery` 1:1 **preservando** os estados funcionais (SCHEDULED/OUT_FOR_DELIVERY/DELIVERED, `!isToday`→"PRÓXIMA ENTREGA", e empty state). ETA = `order.deliveryTime` (fallback quando ausente). |
| **Ações rápidas** | 1 card branco "AÇÕES RÁPIDAS" com grid 4-col de 3 botões (Comprar créditos, Avulso, Minha agenda). | **3 cards separados** (grid `1fr 1fr 1fr`, gap 10): Agenda/Semanal, Avulso/Pedir hoje, Histórico/Pedidos. Caixa de ícone surface2 + título 13 + sub 10.5. Sem header. | Recriar `QuickActions` 1:1. Remover "Comprar créditos" (virou botão do card de saldo). Rotas: Agenda→`/client/agenda`, Avulso→`/client/creditos?tab=avulso` (manter atual; ver §5), Histórico→`/client/pedidos`. |
| **Próximas entregas** | Dentro de card branco com header. Dias surface2, "`{qty} pão`" / "folga". | **Sem card wrapper** (header solto: título Bricolage 16 + "Editar agenda" accent). Strip `overflowX auto`. Dia = chip 62px (surface+border2 ativo / transparent+border+opacity .5 folga), abbr + número Bricolage 20 + `Pill gold` com glifo de pão / "folga". | Recriar `NextDays` 1:1 **preservando** dados reais (`dailyQty`), skeleton de loading e empty state. Glifo do badge = `BreadMark` reduzido (handoff: trocar emoji 🥖 por ícone da marca). |
| **Layout** | `div padding 20, gap 14` (header dentro). | `Greet` full-bleed (`4px 20px 14px`) + container `padding 0 20px, gap 14`, `paddingBottom 90`. | Reestruturar wrapper. |
| **Banners corte/risco** | Existem (funcionais, condicionais). | Não constam no `HomeA`. | **Manter** (funcionais). Harmonizar leve com o novo acabamento. |

---

## 3. Sistema de animações (premium, sutil, performático)

Princípio: **discretas e com propósito** — entrada orquestrada + microinterações + 2–3 detalhes "vivos". Tudo respeita `prefers-reduced-motion` (já zera transições/animações em [globals.css](../../apps/web/src/styles/globals.css#L49)).

| # | Animação | Onde | Detalhe |
|---|---|---|---|
| AN1 | **Entrada escalonada (reveal)** | Cada seção, na montagem | `opacity 0→1` + `translateY 10px→0`, stagger ~70ms (header→saldo→entrega→ações→próximas). Easing `cubic-bezier(.22,1,.36,1)`, ~480ms. |
| AN2 | **Count-up do saldo** | "38" no card de saldo | Conta `0→saldo` em ~900ms (ease-out, rAF). **Test/SSR-safe**: sem `window.matchMedia` ou reduced-motion → mostra valor final direto (não quebra [HomeScreen.test.tsx](../../apps/web/src/pages/client/__tests__/HomeScreen.test.tsx)). |
| AN3 | **Sheen no card espresso** | Card de saldo | Varredura diagonal de luz sutil 1× na entrada (gradiente translúcido animando `background-position`). |
| AN4 | **Float do BreadMark** | Watermarks (saldo/entrega) | Deriva vertical lentíssima (`translateY ±4px`, ~6s ease-in-out infinite), quase imperceptível. |
| AN5 | **Pulso "A caminho"** | Dot verde do status OUT_FOR_DELIVERY | Anel pulsante (scale+fade) — sensação de tempo real. |
| AN6 | **Press/hover** | Botões, cards de ação, chips, sino | `:active` scale .97; botões hover `translateY(-1px)`+`brightness(1.05)` (espelha primitiva `Btn`). |
| AN7 | **Sino (opcional)** | Header quando `unreadCount>0` | Leve "wiggle" 1× na entrada + pulso suave do dot dourado. |
| AN8 | **Chips dia (sub-stagger)** | `NextDays` | Entram em cascata esquerda→direita; chip ativo com leve "pop". |

Implementação: `@keyframes` num bloco "Home animations" em [globals.css](../../apps/web/src/styles/globals.css) + `animation-delay` inline para stagger; hook `useCountUp` (rAF) para AN2. (Caso a decisão seja `motion`/framer-motion — ver §5 — AN1/AN8 viram `staggerChildren` e AN2/AN5 ganham spring.)

---

## 4. Arquivos afetados

| Arquivo | Mudança |
|---|---|
| [HomeScreen.tsx](../../apps/web/src/pages/client/HomeScreen.tsx) | Reestrutura completa: novo `Greet`, `TodayDeliveryCard`, `QuickActions`, `NextDays` (1:1), orquestração de entrada. Preserva hooks/dados/banners. |
| [CreditBalanceCard.tsx](../../apps/web/src/components/client/CreditBalanceCard.tsx) | Botões nas variantes do protótipo (gold+plus / soft+clock), hover, border2, "rende" pelo ritmo real, count-up + sheen. |
| [globals.css](../../apps/web/src/styles/globals.css) | Bloco de `@keyframes` (fade-up, sheen, float, pulse-ring, wiggle). |
| **(novo, opcional)** `components/brand/ui/` | Primitivas leves `Pill`/`Btn` reutilizáveis (Pill aparece em entrega + dias; Btn no card) espelhando `brand.jsx`, p/ reduzir duplicação. Senão, inline. |
| [HomeScreen.test.tsx](../../apps/web/src/pages/client/__tests__/HomeScreen.test.tsx) | Manter verde ("42"/"Joao"/"pães") e estender p/ nova estrutura (labels Agenda/Avulso/Histórico). |

---

## 5. Decisões

| Tema | Decisão |
|---|---|
| **Abordagem de animação** | ✅ **framer-motion** (decisão do usuário, 2026-06-28). Orquestração via `staggerChildren`/`variants`, gestos `whileTap`, count-up via `useMotionValue`+`animate`. Loops ambientes (sheen/float/pulso) ficam em CSS `@keyframes` (mais simples). |
| Fidelidade | **1:1 com `HomeA`** + tokens de [globals.css](../../apps/web/src/styles/globals.css) (já batem com o handoff). Tema **claro** apenas. |
| Glifo do badge de dias | `BreadMark` reduzido (não emoji 🥖) — handoff manda trocar emoji por ícone da marca. |
| "Rende ~N dias" | Calcular pelo **ritmo real**: `dailyAvg = weeklyTotal/7` (se há agenda) → `dias = round(saldo / dailyAvg)`; fallback ~`saldo/4` (protótipo) quando sem agenda. Corrige o atual `floor(saldo)`. |
| Rota "Avulso" | Manter atual `/client/creditos?tab=avulso` (sem regressão). *Flag:* protótipo sugere "Pedir hoje" = pedido único `/client/agenda/pedido-unico` — confirmar se troca. |
| Banners corte/risco | **Mantidos** (funcionais), apenas harmonizados. |

---

## 6. Faseamento

1. **Fundação visual** — `Greet` (avatar+condo), wrapper de layout, `globals.css` keyframes. Sem animação ainda; valida estrutura 1:1.
2. **Card de saldo** — variantes de botão + border + "rende" real + count-up + sheen.
3. **Entrega de hoje** — recriar `TodayDelivery` 1:1 com os 3 estados + ETA + rodapé + chevron + empty state.
4. **Ações rápidas + Próximas entregas** — 3 cards + strip de dias (dados reais, skeleton, empty) + chips.
5. **Camada de animação** — orquestração de entrada (AN1/AN8), microinterações (AN6), detalhes vivos (AN4/AN5/AN7).
6. **Testes & verificação** — atualizar `HomeScreen.test.tsx`; `npm run typecheck` + `test`; rodar o app e conferir 1:1 contra o print (com `prefers-reduced-motion` também).

---

## 7. Riscos / atenção

- **Count-up vs teste**: garantir valor final em jsdom/sem matchMedia (§3 AN2).
- **Dados ausentes**: `condominiumName`/`apartment` e `deliveryTime` são opcionais → fallbacks graciosos (sem "undefined").
- **Estados da entrega**: não perder os 3 estados + `!isToday` + empty ao mapear pro novo layout.
- **prefers-reduced-motion**: count-up (JS) precisa checar explicitamente; CSS já é coberto.
- **Tom das animações**: sutileza > exibicionismo — nada de bounce exagerado; sofisticação discreta.

---

## 8. Ajustes pós-feedback (2026-06-28)

Sobre `NextDays`, a pedido do usuário:
- Badge usa **emoji 🥖** ao lado da quantidade (substitui o `BreadMark` reduzido, que renderizava como um arco "^").
- Mostra a **semana inteira (7 dias)** a partir de amanhã; dias sem agendamento exibem **"folga"**. (Quando o usuário não tem agenda nenhuma, mantém-se o empty state "Configure sua agenda".)
- Faixa vira **carrossel** horizontal com `scroll-snap` + swipe nativo (classe `.cdp-carousel` esconde a scrollbar), **responsivo** (em telas largas cabe tudo; em telas estreitas faz swipe), com **fade na borda direita** sinalizando mais conteúdo.
- **Destaque de hoje**: a faixa agora é ancorada em HOJE (hoje + 6 dias); o chip de hoje recebe **borda dourada (2px) + rótulo "Hoje" em accent**, mesmo em folga, como marcador "você está aqui".

### Correção de status do card "Entrega de hoje"
- **Bug**: o enum `OrderStatus` do backend tem 6 valores; o tipo `TodayOrder.status` só conhecia 3. O `else` do card mapeava qualquer estado fora dos 3 (ex.: **`SEPARATED`**) como **"ENTREGUE"**. Corrigido: default seguro = **"Agendado"** (espelha o `StatusPill` do histórico); "Entregue" só com `DELIVERED`. Tipo ampliado em [useOrderTracking.ts](../../apps/web/src/hooks/useOrderTracking.ts). Teste de regressão em [HomeScreen.test.tsx](../../apps/web/src/pages/client/__tests__/HomeScreen.test.tsx).
- **Cores do badge** alinhadas ao histórico: Agendado = neutro + relógio; A caminho = dourado (`gold-soft`/`accent`) + ponto; Entregue = verde (`good-soft`/`good`) + check. Anel pulsante de "A caminho" recolorido p/ accent.
