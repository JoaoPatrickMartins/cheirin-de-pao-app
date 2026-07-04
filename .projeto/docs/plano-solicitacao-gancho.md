# Plano — Solicitação de Gancho

## Objetivo

Após o cliente realizar o **primeiro pedido**, exibir uma mensagem breve explicando o gancho do
Cheirin de Pão e pedir que ele **confirme o recebimento do gancho de porta**. Ao confirmar, uma
**solicitação de gancho** é registrada e aparece para o Admin em **Gestão → Solicitação de Gancho**,
onde é possível buscar, filtrar (pendentes/entregues) e marcar a entrega do gancho como realizada.

## Contexto (o que já existe)

- Onboarding do cliente: `apps/web/src/pages/client/ClientLayout.tsx` (fases `slides → tour → done`),
  flags por conta em `apps/web/src/lib/onboarding.ts` (localStorage, por `userId`, com try/catch).
- O gancho já é o **slide 2 de 3** em `apps/web/src/components/client/onboardingSlides.tsx`
  (`kind: 'gancho'`, título "Seu gancho do Cheirin"), com a arte `DoorScene` reutilizável.
- Modal canônico do cliente: `apps/web/src/components/client/CancelOrderDialog.tsx` (backdrop fixo,
  `role="dialog"`, tokens de design). Será o molde do novo modal.
- Pedido único (primeiro pedido) criado via `POST /orders`
  (`apps/api/src/modules/orders/orders.service.ts` `createSingleOrder`).
- Hub de Gestão (cards): `apps/web/src/pages/admin/tabs/AdminGestao.tsx`; sub-páginas em
  `apps/web/src/pages/admin/gestao/`. Melhor template de lista (busca + chips de status + lista + ação):
  `apps/web/src/pages/admin/tabs/AdminClientes.tsx`. Shell de sub-página com `onBack`:
  `apps/web/src/pages/admin/gestao/AdminEntregadores.tsx`.
- Cliente da API: `apps/web/src/lib/apiFetch.ts` (sem react-query; `useState`/`useEffect`).
- `AuthUser` (`apps/web/src/contexts/AuthContext.tsx`) já carrega booleans vindos do backend
  (`hasPassword`, `condominiumJustChanged`) e tem `updateUser(partial)`.

## Decisões de arquitetura

1. **Persistência: campos no `User`** (não um novo model). O gancho é único por cliente e o padrão do
   schema já usa pares "flag + timestamp + autor" (ex.: `isBlocked`/`blockedAt`/`blockedById`,
   `offSessionConsentAt`). Campos novos:
   - `hookRequestedAt   DateTime?`  → cliente confirmou; solicitação PENDENTE.
   - `hookDeliveredAt   DateTime?`  → admin marcou entrega; solicitação ENTREGUE.
   - `hookDeliveredById String? @db.ObjectId` → auditoria (admin que entregou).

   Estado derivado: `null` em `hookRequestedAt` = não solicitado; `hookRequestedAt != null &&
   hookDeliveredAt == null` = **pendente**; `hookDeliveredAt != null` = **entregue**.
   ⚠️ MongoDB: **não** rodar `prisma migrate`; apenas `prisma generate` / `prisma validate`.

2. **Gatilho do modal: gate no `ClientLayout`** (mesmo padrão dos overlays de onboarding), condicionado à
   fase `'done'` (não durante slides/tour) e a `needsConsent`. Cobre tanto "logo após o 1º pedido" quanto
   "reaparece na próxima visita" — robusto a refresh.
   - **Não há `/auth/me`** neste app: o `AuthUser` é persistido em localStorage no login. Então o gate NÃO
     usa `AuthUser`; em vez disso o `ClientLayout` chama `GET /client/hook-request` no mount (para CLIENT),
     que devolve `{ hasOrdered, hookRequestedAt, needsConsent }` calculado no servidor.
   - Imediatismo pós-pedido: a `PurchasedScreen` (chokepoint único de sucesso de pedido, `kind==='order'`)
     dispara o evento `window` `cdp:refresh-hook`; o `ClientLayout` reavalia e o modal surge na hora.
   - **Confirmação obrigatória** (decisão do usuário): o modal **não** tem botão "Agora não", backdrop não
     fecha e não há ESC/close — só sai ao confirmar o recebimento do gancho (`hookRequestedAt` preenchido).

## Mudanças

### Backend (`apps/api`)

1. **Schema** `prisma/schema.prisma` (model `User`): adicionar `hookRequestedAt`, `hookDeliveredAt`,
   `hookDeliveredById`. Rodar `prisma generate`.

2. **(Cancelado — não há `/auth/me`.)** O status do gancho é servido pelo próprio módulo `client-hook`
   (item 3), evitando tocar o `auth`/`AuthUser`.

3. **Novo módulo `client-hook`** (`route`/`controller`/`service`, registrado em `server.ts`):
   - `GET /client/hook-request` (CLIENT): retorna `{ hasOrdered, hookRequestedAt, hookDeliveredAt,
     needsConsent }` — `needsConsent = order.count>0 && hookRequestedAt==null`. Consumido pelo gate.
   - `POST /client/hook-request` (CLIENT): seta `hookRequestedAt = now()` só se ainda `null`
     (idempotente); retorna `{ hookRequestedAt }`.

4. **Novo módulo `admin-hooks`** (espelha `admin-clients`):
   - `GET /admin/hook-requests` — querystring `q` (nome/apto/condomínio), `status`
     (`pending` | `delivered` | `all`, default `pending`), `sort`, `page`, `limit`. `where`:
     `hookRequestedAt: { not: null }` + filtro por `hookDeliveredAt` (`null` p/ pending, `not null` p/
     delivered — ver memória `prisma-mongo-null-vs-unset`). Resposta paginada
     `{ items, total, page, limit }`, cada item com `id, name, apartment, block, condominium,
     hookRequestedAt, hookDeliveredAt`.
   - `PATCH /admin/hook-requests/:id/deliver` — seta `hookDeliveredAt = now()` e
     `hookDeliveredById = request.user.id` (idempotente; 404 se user inexistente, 409/422 se não
     solicitado). Retorna `{ ok: true }`. **Ao entregar, enviar push + notificação in-app ao cliente**
     (decisão do usuário) reusando `NotificationsService` + OneSignal — mesmo padrão de `grantCredits`
     em `admin-clients.service`. Enviar apenas na transição pendente→entregue (idempotência não re-notifica).
   - Arquivos `admin-hooks.route/.controller/.service/.schema.ts` + `__tests__/`, registrado em
     `server.ts` (rotas estáticas antes de dinâmicas). Checagem de role ADMIN inline em cada handler.

### Frontend cliente (`apps/web`)

5. **(Cancelado)** Nenhuma mudança no `AuthContext`/`AuthUser` — o gate usa `GET /client/hook-request`.

6. **Novo componente `GanchoConsentModal.tsx`** (clonar `CancelOrderDialog.tsx`, reusar `StepVisual
   kind="gancho"` de `onboardingSlides.tsx`):
   - Copy: explicar o gancho rapidamente; **discreto, transparente (acrílico), sem furar/danificar a
     porta — é só encaixar**; necessário para a melhor experiência de entrega, "seu pão fresquinho
     assim que acordar, sem ser incomodado e sem nenhum trabalho". Opcional: reaproveitar os 3 passos do
     tutorial (mini-resumo).
   - Botão primário único: **"Confirmar recebimento do gancho"** → `POST /client/hook-request` → em
     sucesso `updateUser({ hookRequestedAt })` e fecha. Estados `isLoading`/`error` como no molde.
   - **Sem botão de dispensar e sem fechar por backdrop/ESC** — confirmação obrigatória.

7. **`ClientLayout.tsx`**: buscar `GET /client/hook-request` no mount (CLIENT) + ouvir `cdp:refresh-hook`;
   renderizar `<GanchoConsentModal isOpen={phase==='done' && needsHookConsent}/>`. Obrigatório — sem descarte.

8. **Sucesso do pedido**: `PurchasedScreen` (chokepoint de `SingleScreen` e `finalizePendingOrder`)
   dispara `window` `cdp:refresh-hook` quando `kind==='order'` — o modal surge na hora.

### Frontend admin (`apps/web`)

9. **`AdminGestao.tsx`**: adicionar `'ganchos'` ao union `AdminGestaoSub`, um card em `HUB_ITEMS`
   (`titulo: 'Solicitação de Gancho'`, ícone válido de `Ic`) e o render condicional
   `if (sub === 'ganchos') return <AdminGanchos onBack={onBack} />`.

10. **Nova sub-página `apps/web/src/pages/admin/gestao/AdminGanchos.tsx`**: AppBar com `onBack`
    (molde `AdminEntregadores`) + corpo com busca + chips de status (Pendentes / Entregues / Todos) +
    lista paginada (molde `AdminClientes`: `buildUrl`, debounce 300ms, load-more). Cada item mostra
    nome, apto/bloco, condomínio, data da solicitação e, se pendente, botão **"Marcar gancho entregue"**
    → `PATCH /admin/hook-requests/:id/deliver` (confirmação via `ConfirmSheet`), atualizando a lista.

## Testes / verificação

- Backend: teste do `admin-hooks.service` (filtros pending/delivered, idempotência do deliver) e do
  `client-hook` (idempotência), no padrão `__tests__` de `admin-clients`.
- Manual: criar 1º pedido como cliente → modal aparece → confirmar → conferir que some e não reaparece
  em reload → conferir a solicitação em Gestão → Solicitação de Gancho (pendente) → marcar entregue →
  mover para "Entregues"; testar busca e filtros.

## Fora de escopo

- Múltiplos ganchos por cliente / histórico (o modelo atual é 1 gancho por cliente).
- Fluxo de "devolução"/troca de gancho.
