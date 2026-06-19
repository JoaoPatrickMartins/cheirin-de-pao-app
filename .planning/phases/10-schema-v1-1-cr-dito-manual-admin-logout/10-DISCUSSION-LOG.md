# Phase 10: Schema v1.1 + Crédito Manual Admin + Logout - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 10-schema-v1-1-credito-manual-admin-logout
**Areas discussed:** UI do crédito manual, Localização do logout, Notificação CREDM, Escopo do schema v1.1

---

## UI do Crédito Manual

### Q1: Como o admin aciona o grant de créditos?

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Botão no card de saldo | Botão '+ Adicionar créditos' abaixo do número de créditos no card existente | ✓ |
| Botão nas ações do header | Botão 'Dar créditos' junto com o botão de bloquear no topo do ClientDetailView | |

**Escolha:** Botão no card de saldo
**Notas:** Mais contextual — admin vê o saldo e age no mesmo lugar.

### Q2: Como o formulário de grant aparece?

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Modal centralizado | Modal com overlay escuro, reutilizando padrão aria-modal existente no ClientDetailView | ✓ |
| Bottom sheet | Sheet desliza de baixo, novo padrão no projeto | |

**Escolha:** Modal centralizado
**Notas:** Reutiliza padrão já estabelecido no componente (linha 490).

### Q3: Como o admin seleciona o motivo?

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Chips horizontais | 4 chips clicáveis, estilo SegmentedControl existente | ✓ |
| Select dropdown | Select nativo HTML, sem novo componente | |

**Escolha:** Chips horizontais
**Notas:** Reutiliza SegmentedControl genérico já criado na Phase 7.

### Q4: O que acontece após confirmar com sucesso?

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Fechar modal + atualizar saldo | Modal fecha, saldo atualizado imediatamente, toast de sucesso | ✓ |
| Fechar modal sem reload | Saldo só atualiza se admin reabrir o detalhe do cliente | |

**Escolha:** Fechar modal + atualizar saldo
**Notas:** Feedback imediato essencial para operação admin.

---

## Localização do Logout

### Q1: Logout do entregador (CourierScreen)?

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Ícone no canto do header | Ícone LogOut no canto superior direito do header, discreto | ✓ |
| Botão 'Sair' abaixo do progresso | Botão no rodapé da tela após o card de progresso | |

**Escolha:** Ícone no canto do header

### Q2: Logout do admin (AdminLayout)?

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Item na AdminBottomNav | Ícone + label 'Sair' como último item do BottomNav | ✓ |
| Ícone no header do AdminLayout | Ícone no canto superior direito, igual ao entregador | |

**Escolha:** Item na AdminBottomNav
**Notas:** Padrão de apps mobile admin — logout acessível de qualquer aba.

### Q3: Confirmação antes do logout admin?

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Dialog de confirmação | "Sair da conta?" com Cancelar / Sair | ✓ |
| Logout direto | Clicou → saiu imediatamente, sem confirmação | |

**Escolha:** Dialog de confirmação
**Notas:** Admin tem tela com muitos dados — evitar logout acidental. Entregador: sem confirmação (logout rápido).

---

## Notificação CREDM

### Q1: Nome do novo tipo no enum NotificationType?

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| CREDIT_GRANTED | Consistente com CREDIT_PURCHASED — mesmo padrão de nomenclatura | ✓ |
| ADMIN_GRANT | Mais literal sobre quem fez a ação | |

**Escolha:** CREDIT_GRANTED

### Q2: Copywriting da notificação?

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Estilo Cheirin de Pão | "Pãezinhos chegando! 🥐" / "Você ganhou {N} pão(es) de crédito..." | ✓ |
| Formal com motivo | "Créditos adicionados" / "{N} créditos foram adicionados ({motivo})..." | |

**Escolha:** Estilo Cheirin de Pão
**Notas:** Tom informal, consistente com CREDIT_PURCHASED existente.

### Q3: CTA da notificação in-app?

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| CTA 'Ver saldo' → Home | Abre HomeScreen com deep link /client/home | ✓ |
| Sem CTA | Notificação informativa apenas | |

**Escolha:** CTA 'Ver saldo' → `/client/home`

---

## Escopo do Schema v1.1

### Q1: Aplicar tudo agora ou só o necessário?

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Tudo de uma vez | Schema v1.1 completo — todos os campos para Phases 11–14 em uma migração | ✓ |
| Só o que esta fase usa | Apenas ADMIN_GRANT, adminId, reason, CREDIT_GRANTED — menor risco | |

**Escolha:** Tudo de uma vez
**Notas:** Uma migração única que desbloqueia Phases 11–14. Risco baixo pois MongoDB é schemaless — campos nullable não quebram documentos existentes.

### Q2: Campos do model SavedCard?

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Mínimo viável | id, userId, mpCardId, brand, lastFour, expiresAt, isDefault, createdAt | ✓ |
| Você decide | Claude define com base no que MP Customer API retorna | |

**Escolha:** Mínimo viável (campos listados na decisão D-07)

---

## Claude's Discretion

- Validação de quantidade no modal (mínimo 1, máximo razoável)
- Ícone específico do botão de logout do entregador (LogOut de lucide-react)
- Cores dos chips de motivo quando selecionado (seguir padrão SegmentedControl existente)
- Posicionamento do item 'Sair' no AdminBottomNav como último tab

## Deferred Ideas

- Histórico de ADMIN_GRANTs visível ao cliente no extrato → defer v2
- Campo de motivo livre (texto customizado além das 4 opções) → fora do escopo CREDM-01
