---
phase: 10
slug: schema-v1-1-credito-manual-admin-logout
status: draft
shadcn_initialized: false
preset: none
created: 2026-06-19
---

# Phase 10 — Contrato de Design de UI

> Contrato visual e de interação para os três blocos funcionais desta fase:
> (1) Modal de crédito manual no `ClientDetailView`,
> (2) Ícone de logout no header do `CourierScreen`,
> (3) Item "Sair" + dialog de confirmação no `AdminBottomNav`.
>
> Gerado por gsd-ui-researcher. Verificado por gsd-ui-checker.

---

## Sistema de Design

| Propriedade | Valor |
|-------------|-------|
| Ferramenta | none (sistema próprio via CSS custom properties) |
| Preset | não aplicável |
| Biblioteca de componentes | nenhuma — componentes inline em Tailwind + CSS vars |
| Biblioteca de ícones | `Icon.tsx` + dicionário `Ic` (SVG inline, traço 24×24) |
| Fonte display | Bricolage Grotesque Variable (títulos, números grandes) |
| Fonte body/UI | Hanken Grotesk (texto, labels, botões) |

**Fontes carregadas via Google Fonts — já presentes no projeto desde Phase 1 (UI-02).**
**shadcn não instalado — o projeto não usa shadcn. Registro de segurança: não aplicável.**

---

## Escala de Espaçamento

Múltiplos de 4. Todos os valores devem vir deste conjunto.

| Token | Valor | Uso |
|-------|-------|-----|
| xs | 4px | Gaps de ícone, espaçamento inline entre irmãos |
| sm | 8px | Gap interno de chips, espaçamento compacto |
| md | 16px | Padding padrão de card, gap entre seções do modal |
| lg | 24px | Padding lateral de telas, padding inferior do modal |
| xl | 32px | Espaçamento entre blocos maiores |
| 2xl | 48px | Separação de seções na tela |
| 3xl | 64px | Espaçamento de página (não usado nesta fase) |

Exceções: hit targets mínimos de 44px nos botões de logout e chips de motivo (UI-10). O chip de motivo tem `min-height: 44px` mesmo que o conteúdo seja menor.

---

## Tipografia

| Papel | Fonte | Tamanho | Peso | Line-height |
|-------|-------|---------|------|-------------|
| Body | Hanken Grotesk | 15px (`--text-base`) | 400 (normal) | 1.5 |
| Label / meta | Hanken Grotesk | 12.5px (`--text-sm`) | 700 (bold) | 1.4 |
| Heading de seção | Bricolage Grotesque | 21px (`--text-xl`) | 700 (bold) | 1.2 |
| Display / número grande | Bricolage Grotesque | 32px (`--text-3xl`) | 700 (bold) | 1.1 |

Regra de peso: exatamente 2 pesos efetivos — **400 (normal)** para texto corrido (body), **700 (bold)** para todos os demais papéis (labels, botões, chips, títulos e números grandes).

---

## Paleta de Cores

Fonte: `globals.css` + `brand.jsx` handoff. Tema claro obrigatório (v2 define tema escuro — fora de escopo).

| Papel | Valor | Uso |
|-------|-------|-----|
| Dominante (60%) | `#FAF5EC` (`--color-app-bg`) | Fundo do app, fundo do modal |
| Secundário (30%) | `#FFFFFF` (`--color-surface`) | Cards, bottom nav, header |
| Accent (10%) | `#B0702A` (`--color-accent`) | Ícone de logout ativo, borda de chip selecionado, texto de confirmação |
| Gold | `#E3AC3F` (`--color-gold`) | Chip de motivo selecionado (fundo), progresso bar, highlight |
| Gold Soft | `#F3DDA6` (`--color-gold-soft`) | Fundo de chip selecionado (alternativa suave ao gold) |
| Espresso | `#1E1207` (`--color-espresso`) | Botão primário (fundo), header do CourierScreen |
| Texto primário | `#241608` (`--color-text`) | Títulos, labels principais |
| Texto secundário | `#7C6A50` (`--color-text-sec`) | Subtítulos, labels de campo |
| Texto terciário | `#A89A82` (`--color-text-ter`) | Placeholders, ícone de logout (estado normal) |
| Borda | `rgba(43,26,12,0.10)` (`--color-border`) | Bordas de card, chips não selecionados |
| Borda suave | `rgba(43,26,12,0.06)` (`--color-border-2`) | Divisores internos |
| Destrutivo | `#B0702A` (`--color-accent`) | Nenhuma ação destrutiva real nesta fase |
| Bom / sucesso | `#3E7C53` (`--color-good`) | Toast de sucesso (ícone), not used for primary states nesta fase |

**Accent reservado para:** borda de chip selecionado no modal de grant (quando gold-soft não for usado), ícone de logout no header do CourierScreen em estado hover/focus, texto de quantidade no stepper do modal quando > 0.

**Gold reservado para:** chip de motivo selecionado (fundo), não para ações primárias.

**Overlay do modal:** `rgba(0,0,0,0.5)` — padrão verificado no `ClientDetailView.tsx`.

---

## Contrato de Copywriting

### Modal de Crédito Manual (CREDM-01)

| Elemento | Texto |
|---------|-------|
| Título do modal | `Adicionar Créditos` |
| Label do campo quantidade | `Quantidade de pães` |
| Placeholder do campo | `0` |
| Hint de validação (range) | `Mínimo 1, máximo 500 pães` |
| Label do seletor de motivo | `Motivo` |
| Chip — Acerto | `Acerto` |
| Chip — Bonificação | `Bonificação` |
| Chip — Compensação | `Compensação` |
| Chip — Promoção | `Promoção` |
| Botão cancelar | `Descartar` |
| Botão confirmar (estado normal) | `Adicionar créditos` |
| Botão confirmar (estado desabilitado) | `Adicionar créditos` (opacity 0.45, disabled) |
| Toast de sucesso | `{N} crédito(s) adicionado(s) a {nome}` |
| Erro genérico de API | `Não foi possível adicionar os créditos. Tente novamente.` |

### Dialog de Confirmação de Logout Admin (LGOUT-02)

| Elemento | Texto |
|---------|-------|
| Título do dialog | `Sair da conta?` |
| Corpo do dialog | `Você será redirecionado para a tela de login.` |
| Botão cancelar | `Continuar na conta` |
| Botão confirmar | `Sair` |

### Logout Entregador (LGOUT-01)

| Elemento | Texto |
|---------|-------|
| aria-label do botão | `Sair` |
| Sem confirmação | Ação direta ao tocar — sem dialog |

### Notificação CREDM (CREDM-03)

| Elemento | Texto |
|---------|-------|
| Título push OneSignal | `Pãezinhos chegando!` |
| Corpo push OneSignal | `Você ganhou {N} pão(es) de crédito. Novo saldo: {total} pão(es).` |
| CTA da notificação in-app | `Ver saldo` |

---

## Especificações de Componentes

### 1. Modal de Grant de Créditos (`ClientDetailView`)

**Gatilho:** Botão `+ Adicionar créditos` dentro do card de saldo (abaixo do número de créditos, linha 335 do `ClientDetailView.tsx`).

**Estrutura do botão gatilho:**
- Variante: `ghost` (`border: 1.5px solid var(--color-border)`)
- Tamanho: `sm` (`padding: 8px 16px`, `font-size: 13px`)
- Ícone: `<Icon name="plus" size={16} />` à esquerda
- Label: `+ Adicionar créditos`
- Cor do texto: `var(--color-text-sec)` (cor discreta — admin vê o saldo e pode agir)
- `min-height: 44px` (UI-10)

**Overlay:**
- `position: fixed`, `inset: 0`
- `background: rgba(0,0,0,0.5)`
- `z-index: 50`
- Click no overlay fecha o modal (`setShowGrantModal(false)`)

**Container do modal (bottom sheet):**
- `position: fixed`, `bottom: 0`, `left: 0`, `right: 0`
- `background: var(--color-app-bg)` (`#FAF5EC`)
- `border-radius: 20px 20px 0 0`
- `padding: 24px 20px 32px` (safe-area-inset-bottom adicional via `padding-bottom: calc(32px + env(safe-area-inset-bottom, 0px))`)
- `max-height: 80vh`, `overflow-y: auto`
- `z-index: 51`
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="modal-grant-title"`

**Conteúdo do modal (de cima para baixo):**

1. **Handle bar:** `width: 36px`, `height: 4px`, `border-radius: 999px`, `background: var(--color-border)`, centralizado, `margin-bottom: 20px`
2. **Título:** `id="modal-grant-title"`, Bricolage Grotesque, `font-size: 21px` (`--text-xl`), `font-weight: 700`, `color: var(--color-text)`, `margin-bottom: 20px`
3. **Campo de quantidade:**
   - Label: `Quantidade de pães`, `font-size: 12.5px`, `font-weight: 700`, `color: var(--color-text-sec)`, `margin-bottom: 8px`
   - Input numérico: `type="number"`, `min="1"`, `max="500"`
   - Estilo: `background: var(--color-surface-alt)`, `border: 1.5px solid var(--color-border)`, foco em `var(--color-accent)`, `border-radius: 14px`, `padding: 12px 16px`, `font-size: 15px`, `font-family: Hanken Grotesk`
   - `min-height: 48px`
4. **Seletor de motivo (chips):**
   - Label: `Motivo`, mesma estilização do label de campo
   - Container: `display: flex`, `flex-wrap: wrap`, `gap: 8px`, `margin-top: 16px`, `margin-bottom: 8px`
   - Chip não selecionado: `padding: 8px 16px`, `border-radius: 999px`, `border: 1.5px solid var(--color-border)`, `background: transparent`, `color: var(--color-text)`, `font-size: 13px`, `font-weight: 700`, `min-height: 44px`
   - Chip selecionado: `border: none`, `background: var(--color-gold)`, `color: var(--color-espresso)` (`#1E1207`), `font-size: 13px`, `font-weight: 700`
   - Transição: `transition: background 0.15s, border 0.15s`
5. **Botões de ação:**
   - `display: flex`, `gap: 12px`, `margin-top: 24px`
   - Descartar: variante `ghost` (borda + texto), `flex: 1`, `min-height: 52px`
   - Adicionar créditos: variante `primary` (espresso + texto claro), `flex: 1`, `min-height: 52px`
   - Adicionar créditos desabilitado: `opacity: 0.45`, `cursor: default` — desabilitado até que quantidade ≥ 1 E motivo selecionado

**Estado de carregamento do botão Adicionar créditos:**
- Texto: `Confirmando...` (sem spinner — padrão do projeto)
- `disabled: true`, `opacity: 0.7`

**Após sucesso:**
- Modal fecha imediatamente
- `creditBalance` no card atualizado com o novo valor retornado pela API
- Toast aparece no topo: `background: var(--color-espresso)`, `color: var(--color-primary-btn-text)`, `border-radius: 12px`, `padding: 12px 16px`, `position: fixed`, `top: 16px`, `left: 50%`, `transform: translateX(-50%)`, `z-index: 9999`, desaparece após 2500ms

---

### 2. Logout Entregador — Header do `CourierScreen` (LGOUT-01)

**Posicionamento:** Canto superior direito do header, à direita dos textos existentes.

**Estrutura do header (após alteração):**
```
[BreadMark logo (42×42)] [textos (flex: 1)] [botão logout]
```

**Botão de logout:**
- `background: none`, `border: none`
- `padding: 8px`
- `border-radius: 12px`
- `display: flex`, `align-items: center`, `justify-content: center`
- `min-height: 44px`, `min-width: 44px` (UI-10)
- `cursor: pointer`
- Ícone: `<Icon name="logout" size={22} color="var(--color-text-ter)" />`
- Hover/focus: `background: var(--color-surface-2)` (`rgba(43,26,12,0.06)` equivalente)
- `aria-label="Sair"`
- onClick: chama `logout()` do `AuthContext` diretamente, sem dialog

---

### 3. Logout Admin — Item "Sair" no `AdminBottomNav` (LGOUT-02)

**Implementação:** Botão especial fora do array `TABS`, com lógica própria. `AdminTab` type não é modificado.

**Posicionamento:** Último item da nav (6.º elemento visualmente), após "Gestão".

**Botão "Sair" na nav:**
- Mesma estrutura visual dos outros tabs: `flex: 1`, `display: flex`, `flex-direction: column`, `align-items: center`, `gap: 4px`, `padding: 4px 0`
- Ícone: `<Icon name="logout" size={22} color="var(--color-text-ter)" />` (sempre terciário — não tem estado "ativo")
- Label: `Sair`, `font-size: 10px`, `font-weight: 700`, `color: var(--color-text-ter)`
- `background: none`, `border: none`, `cursor: pointer`
- `min-height: 44px` (UI-10)
- aria-label: `"Sair da conta"`
- onClick: abre dialog de confirmação (`useState` local no `AdminBottomNav`)

**Dialog de confirmação:**
- Overlay: `position: fixed`, `inset: 0`, `background: rgba(0,0,0,0.5)`, `z-index: 50`
- Container: `position: fixed`, `bottom: 0`, `left: 0`, `right: 0`, `background: var(--color-app-bg)`, `border-radius: 20px 20px 0 0`, `padding: 24px 20px calc(32px + env(safe-area-inset-bottom, 0px))`
- `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby="dialog-logout-title"`
- Título: `id="dialog-logout-title"`, `font-size: 21px`, Bricolage Grotesque, `font-weight: 700`, `color: var(--color-text)`, `margin-bottom: 8px`
- Corpo: `font-size: 15px`, Hanken Grotesk, `color: var(--color-text-sec)`, `margin-bottom: 24px`, `line-height: 1.5`
- Botões: `display: flex`, `gap: 12px`
  - Continuar na conta: variante `ghost`, `flex: 1`, `min-height: 52px` — onClick: fecha dialog
  - Sair: variante `primary` (espresso), `flex: 1`, `min-height: 52px` — onClick: `logout()` do `AuthContext`

---

### 4. `NotificationsScreen` — Entrada `CREDIT_GRANTED` no `CTA_CONFIG`

| Propriedade | Valor |
|-------------|-------|
| Chave no `CTA_CONFIG` | `CREDIT_GRANTED` |
| Label do CTA | `Ver saldo` |
| Rota | `/client/home` |
| Tom visual (`getTone`) | `'gold'` |
| Ícone (`getIcon`) | `'coin'` (já presente em `Ic` — `Icon.tsx` linha verificada) |

---

## Contratos de Interação

### Validação do Modal de Grant

| Regra | Comportamento |
|-------|--------------|
| quantidade < 1 | Botão Adicionar créditos desabilitado (opacity 0.45) |
| quantidade > 500 | Botão Adicionar créditos desabilitado + hint vermelho: `Máximo 500 pães` |
| quantidade não inteiro | `type="number"` + `step="1"` + validação via Zod no backend |
| motivo não selecionado | Botão Adicionar créditos desabilitado |
| quantidade ≥ 1 E motivo selecionado | Botão Adicionar créditos habilitado |
| Confirmação em andamento | Botão Adicionar créditos: `disabled=true`, texto `Confirmando...` |

### Estados do Botão "+ Adicionar créditos"

| Estado | Visual |
|--------|--------|
| Normal | Borda `var(--color-border)`, texto `var(--color-text-sec)` |
| Hover | `background: var(--color-surface-2)` |
| Desabilitado (loading do modal) | `opacity: 0.45`, `cursor: default` |

### Acessibilidade

- Modal de grant: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="modal-grant-title"`. Foco vai para o campo de quantidade ao abrir (`autoFocus`).
- Dialog de logout admin: `role="alertdialog"`, `aria-modal="true"`. Foco vai para o botão Continuar na conta ao abrir.
- Botão de logout entregador: `aria-label="Sair"`.
- Chips de motivo: cada botão tem `aria-pressed={motivo === m}`.
- Todos os elementos interativos: `min-height: 44px`, `min-width: 44px` (UI-10).
- Fechar com Escape: `keydown Escape` fecha o modal/dialog ativo.

---

## Registro de Segurança de Registry

| Registry | Blocos Usados | Gate de Segurança |
|----------|--------------|-------------------|
| shadcn official | nenhum | não aplicável — shadcn não instalado |
| terceiros | nenhum | não aplicável |

Nenhum pacote novo instalado nesta fase. Todos os componentes são inline, seguindo padrões existentes verificados no codebase.

---

## Fontes das Decisões

| Seção | Fonte |
|-------|-------|
| Paleta de cores completa | `apps/web/src/styles/globals.css` (verificado) + `brand.jsx` (handoff) |
| Escala tipográfica (4 tokens) | `apps/web/src/styles/globals.css` — `--text-sm/base/xl/3xl` |
| Border radius tokens | `apps/web/src/styles/globals.css` — `--radius-*` |
| Modal bottom sheet pattern | `ClientDetailView.tsx` linhas 487–606 (RESEARCH.md — Padrão 3) |
| Toast inline pattern | `ScheduleScreen.tsx` linhas 49–92 (RESEARCH.md — Padrão 4) |
| Chips de motivo (inline) | RESEARCH.md — Padrão 5 (SegmentedControl hard-coded, chips criados inline) |
| Ícone logout | `Icon.tsx` linha 32 — `logout: 'M15 12H4M11...'` (RESEARCH.md — Padrão 6) |
| Posição botão gatilho CREDM | CONTEXT.md D-03 |
| Conteúdo do modal CREDM | CONTEXT.md D-04, D-05 |
| Comportamento pós-grant | CONTEXT.md D-06 |
| Logout entregador (sem dialog) | CONTEXT.md D-08 |
| Logout admin (com dialog) | CONTEXT.md D-09 |
| Copywriting push CREDM | CONTEXT.md D-12 |
| CTA_CONFIG CREDIT_GRANTED | CONTEXT.md D-14 |
| Validação quantidade (max 500) | Claude's Discretion — CONTEXT.md |
| Ícone gold no CTA_CONFIG | Claude's Discretion — consistência com `CREDIT_PURCHASED` existente |
| Dialog bottom sheet (vs. centered) | Claude's Discretion — padrão do projeto é bottom sheet (Padrão 3 verificado) |
| Labels CREDM cancelar/confirmar | gsd-ui-checker revision — substituídos por labels contextuais (Descartar / Adicionar créditos) |
| Label LGOUT-02 cancelar | gsd-ui-checker revision — substituído por label contextual (Continuar na conta) |

---

## Checklist de Verificação

- [ ] Dimensão 1 — Copywriting: APROVAR
- [ ] Dimensão 2 — Visuais: APROVAR
- [ ] Dimensão 3 — Cor: APROVAR
- [ ] Dimensão 4 — Tipografia: APROVAR
- [ ] Dimensão 5 — Espaçamento: APROVAR
- [ ] Dimensão 6 — Segurança de Registry: APROVAR

**Aprovação:** pendente
