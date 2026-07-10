# Phase 6: Courier App - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 6-courier-app
**Areas discussed:** Confirmação de entrega, Mapa, Atribuição de entregas, Endpoints do entregador

---

## Confirmação de Entrega

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Status DELIVERED + push instantâneo | Cada check = PATCH imediato + notificação ao cliente | ✓ |
| Check local, push só ao concluir condomínio | Batch ao finalizar o bloco | |
| Você decide | Claude escolhe | |

**Escolha do usuário:** Status DELIVERED + push instantâneo

---

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Não — irreversível (Recomendado) | DELIVERED é estado final | ✓ |
| Sim — permite desmarcar até fechar a tela | Optimistic UI com persistência ao sair | |

**Escolha do usuário:** Não — entrega confirmada é irreversível

---

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Check + riscado + opacidade 50% (igual ao handoff) | Line-through, opacidade reduzida, check verde | ✓ |
| Linha desaparece após confirmar | Remove do accordion | |
| Você decide | Claude escolhe com base no handoff | |

**Escolha do usuário:** Check + riscado + opacidade 50% (igual ao handoff)

---

**Resposta livre:** "adicione dialog de confirmação da entrega"

**Decisão capturada:** Dialog de confirmação (modal) aparece antes de disparar o DELIVERED. Exibe nome do cliente + apartamento + quantidade. Botões: "Cancelar" e "Confirmar entrega".

---

## Mapa

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| SVG estilizado como no handoff (Recomendado para MVP) | Polyline dourada + pinos, zero dependência | |
| Leaflet + OpenStreetMap real | Mapa real com tiles OSM, OSRM, geocodificação | ✓ |
| Híbrido: SVG agora, Leaflet depois | SVG com schema preparado para migração | |

**Escolha do usuário:** Leaflet + OpenStreetMap real

---

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Adicionar na Fase 6 (schema + migração) | Campo lat/lng em Condominium | |
| Usar geocodificação dinâmica pelo endereço | Nominatim on-demand, sem campo lat/lng | ✓ |

**Escolha do usuário:** Geocodificação dinâmica via Nominatim

---

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| OSRM público (router.project-osrm.org) — Recomendado | API gratuita, sem setup | ✓ |
| OSRM self-hosted no mesmo VPS | Controle total, requer deploy extra | |
| Ordem estática: nearest-neighbor | Sem OSRM, mais simples | |

**Escolha do usuário:** OSRM público

---

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| react-leaflet (Recomendado) | Wrapper oficial, bem mantido | ✓ |
| Leaflet puro (sem wrapper) | useEffect manual, mais verboso | |

**Escolha do usuário:** react-leaflet

---

## Atribuição de Entregas

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Todas as ordens SCHEDULED do dia (MVP simples) | Sem atribuição, 1 entregador | |
| Só condomínios atribuídos a ele | Filtro por courierId | ✓ |

**Escolha do usuário:** Só condomínios atribuídos a ele

---

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Campo courierId em Condominium (Recomendado) | Entregador padrão por condomínio | |
| Campo courierId nos Orders do dia | Atribuição por pedido, mais flexível | ✓ |

**Escolha do usuário:** Campo courierId nos Orders do dia

---

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Admin usa endpoint para atribuir em batch | PATCH /admin/orders/assign-courier, sem UI | ✓ |
| Entregador vê todos e filtra pelo seu courierId | Cron já popula pelo mapeamento condo→entregador | |

**Escolha do usuário:** Admin usa endpoint em batch (curl/Postman na Fase 6)

---

## Endpoints do Entregador

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Novo módulo courier (Recomendado) | apps/api/src/modules/courier/ separado | ✓ |
| Extender o módulo orders | Adicionar rotas courier em orders.route.ts | |

**Escolha do usuário:** Novo módulo courier

---

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Extender admin-orders (Recomendado) | assign-courier no módulo existente da Fase 5 | ✓ |
| Novo módulo admin-assignments | Módulo separado para atribuição | |

**Escolha do usuário:** Extender admin-orders

---

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Campo opcional (courierId: String?) — Recomendado | Null para não atribuídos, zero breaking change | ✓ |
| Campo obrigatório com default do entregador principal | Cron preenche via tabela condo→courier | |

**Escolha do usuário:** Campo opcional (courierId: String?)

---

## Claude's Discretion

- **Ordem de apartamentos dentro do condomínio:** número crescente (simples e determinístico)
- **Card de progresso:** fiel ao handoff — espresso com `X/N paradas` (Bricolage 26px) + `Total de pães` (dourado) + barra de progresso dourada

## Deferred Ideas

- OSRM self-hosted no VPS → pós-MVP / Fase 7
- Atribuição automática de entregadores com aprovação do Admin (ADMO-11) → Fase 7
- UI de atribuição de entregadores no painel Admin → Fase 7
- Configuração da ordem de apartamentos pelo Admin → Fase 7
- Reversão de entrega confirmada (desfazer DELIVERED) → Fase 7
