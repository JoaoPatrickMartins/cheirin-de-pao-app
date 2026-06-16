---
phase: 07-admin-panel
plan: 10
subsystem: admin-clients-ui
tags: [react, typescript, admin-clientes, cliente-detalhe, filtro-chips, bloqueio]
dependency_graph:
  requires:
    - 07-07 (AdminLayout, AdminHead, AdminBottomNav disponíveis)
    - 07-06 (GET /admin/clients, GET /admin/clients/:id, PATCH /admin/clients/:id/block disponíveis)
  provides:
    - AdminClientes com chips de filtro por condomínio + sub-tela de detalhe (D-02)
    - ClientDetailView somente leitura com toggle de bloqueio e dialog de confirmação
  affects:
    - AdminLayout.tsx (substituída a tab clientes de <div /> para <AdminClientes />)
tech_stack:
  added: []
  patterns:
    - Sub-estado por aba (D-02): type AdminClientesSub = null | 'detalhe'
    - Chip de filtro sem biblioteca — botões inline com estado local filtroCondominio
    - Dialog de confirmação inline com role=dialog aria-modal=true (sem biblioteca externa)
    - Toggle otimista local: isBlocked atualizado no state após sucesso da API
key_files:
  created:
    - apps/web/src/pages/admin/tabs/AdminClientes.tsx
    - apps/web/src/components/admin/ClientDetailView.tsx
  modified:
    - apps/web/src/pages/admin/AdminLayout.tsx (importa e renderiza AdminClientes)
decisions:
  - Chips de filtro implementados como botões inline sem biblioteca — padrão já consolidado no projeto
  - Dialog de confirmação como overlay inline (sem portal ou biblioteca) — consistente com padrão do projeto
  - Avatar do cliente exibe iniciais (sem imagem) — API não fornece foto de perfil no MVP
metrics:
  duration: 18min
  completed_date: "2026-06-16T01:42:25Z"
  tasks_completed: 2
  files_modified: 1
  files_created: 2
---

# Phase 7 Plan 10: AdminClientes + ClientDetailView Summary

**One-liner:** Lista de clientes com chips de filtro por condomínio e sub-tela de detalhe somente leitura com toggle de bloqueio via PATCH /admin/clients/:id/block.

## What Was Built

### Task 1: AdminClientes (commit `388ea5e`)

**AdminClientes.tsx** — tab de clientes do painel admin:
- Estado interno: `sub: AdminClientesSub = null`, `selectedId`, `filtroCondominio`, `clientes`, `condominios`, `isLoading`
- Montagem: busca simultânea de `GET /admin/condominiums` (para chips) e `GET /admin/clients` (lista inicial)
- Ao trocar `filtroCondominio`: re-busca `GET /admin/clients?condominiumId={id}`
- Chips de filtro: "Todos" (key=null) + um chip por condomínio; chip ativo com borda `--color-accent`, fundo `--color-gold-soft`; inativo com `--color-border`, fundo `--color-surface`
- Card de cliente: opacity 0.6 quando bloqueado; ícone `ban` size=14 inline no nome; saldo Bricolage 17px weight=800
- Linha secundária: `{condomínio} · {apto} · últ. {data}` — truncada com ellipsis
- Coluna de saldo: cor `textTer` quando 0, `text` quando >0
- Sub-estado: `sub === 'detalhe' && selectedId` renderiza `<ClientDetailView />`; `onBack` limpa sub e selectedId
- Empty state: "Nenhum cliente encontrado" + "Tente filtrar por outro condomínio."
- AdminLayout.tsx: substituída a tab `clientes` de `<div />` para `<AdminClientes />`

### Task 2: ClientDetailView (commit `e60695b`)

**ClientDetailView.tsx** — detalhe somente leitura do cliente:
- Props: `{ clienteId: string; onBack: () => void }`
- Estado: `cliente: ClienteDetalhe | null`, `isLoading`, `isBlocking`, `showDialog`, `blockError`
- Montagem: busca `GET /admin/clients/{clienteId}`
- AppBar: botão voltar com `Icon arrowL` + título "Cliente" (Bricolage 20px)
- Card de avatar: iniciais do nome em `surface2` circular 64×64; nome Bricolage 20px weight=700; condo+apto 13px textSec; Pill "Bloqueado" com ícone `ban` quando isBlocked
- Card de dados (3 rows com separadores `--color-border-2`):
  - `wallet` "Saldo de créditos" — valor `{creditBalance} pães`
  - `clock` "Última compra" — data formatada em pt-BR ou "Sem compras"
  - `calendar` "Agendamento" — resumo do weeklyQty (dias com qty>0) ou "Sem agendamento"
- Nota somente leitura: 12px textTer
- Botão dinâmico: `ghost` com ícone `ban` "Bloquear cliente" | `gold` com ícone `check` "Desbloquear cliente"
- Dialog de confirmação: `role="dialog" aria-modal="true"`, overlay rgba(0,0,0,0.4), conteúdo com título dinâmico `{Bloquear/Desbloquear} {nome}?`, botões Cancelar + Confirmar
- Ao confirmar: chama `PATCH /admin/clients/:id/block`, atualiza `isBlocked` localmente, fecha dialog
- Tratamento de erro: mensagem inline "Não foi possível alterar. Tente novamente."

## Deviations from Plan

Nenhum — plano executado conforme especificado.

## Known Stubs

Nenhum — ambos os componentes buscam dados reais via apiFetch.

## Threat Surface Scan

| Threat ID | Status | Mitigação Aplicada |
|-----------|--------|-------------------|
| T-07-10-01 | Mitigado | apiFetch inclui JWT automaticamente; servidor verifica role=ADMIN |
| T-07-10-02 | Mitigado | condominiumId passado como query param — validado no servidor |
| T-07-10-03 | Mitigado | Dialog role=dialog aria-modal=true exige confirmação explícita antes de chamar PATCH |
| T-07-10-04 | Mitigado | GET /admin/clients/:id protegido por authenticate + role=ADMIN no servidor |

Nenhuma nova superfície não planejada introduzida.

## Self-Check: PASSED

Arquivos verificados:
- `apps/web/src/pages/admin/tabs/AdminClientes.tsx` — chips filtroCondominio + sub='detalhe' FOUND
- `apps/web/src/components/admin/ClientDetailView.tsx` — aria-modal + PATCH /block FOUND
- `apps/web/src/pages/admin/AdminLayout.tsx` — `<AdminClientes />` substituindo `<div />` FOUND

Commits verificados:
- `388ea5e` — feat(07-10): AdminClientes com chips de filtro e sub-estado de detalhe FOUND
- `e60695b` — feat(07-10): ClientDetailView com detalhe somente leitura e toggle de bloqueio FOUND

Verificações do plano:
1. Build frontend: SUCCESS (zero erros TypeScript)
2. Sub-estado: `grep "setSub.*detalhe\|sub.*detalhe"` — FOUND
3. Chips de filtro: `grep "filtroCondominio\|condominiumId"` — FOUND
4. Dialog aria-modal: `grep "aria-modal"` — FOUND
5. Toggle bloquear: `grep "clients.*block"` — FOUND
