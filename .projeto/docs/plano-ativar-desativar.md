# Plano — Ativar/Desativar: Combos, Fornecedores e Condomínios

> Status: aprovado (decisões abaixo). Pronto para execução.

## Contexto

Adicionar a ação **ativar/desativar** para os três cadastros de gestão do admin.
Os três modelos Prisma **já possuem `isActive Boolean @default(true)`** — o trabalho é
(a) deixar o PATCH realmente persistir `isActive`, (b) expor um switch no card da lista e
(c) tratar o raio de impacto de cada desativação.

### Bug comum encontrado (Zod strip)
Em combos e condomínios, `UpdateSchema = CreateSchema.partial()` **não inclui `isActive`**,
então `Schema.parse(request.body)` descarta o campo antes de chegar ao banco — mesmo padrão
do bug do `numBlocks`. Fornecedores idem (nem no body schema está). Precisa entrar no schema Zod.

## Decisões (confirmadas pelo usuário)

1. **Combos + compra automática:** ao desativar um combo, **desativar automaticamente** o
   `autoRecharge` dos clientes que o usam (`autoRecharge.active = false`). Notificação é desejável.
2. **Fornecedor principal:** **bloquear (409)** a desativação do fornecedor `isPrincipal` enquanto
   ele for o principal — admin precisa marcar outro ativo como principal antes.
3. **Condomínio com clientes:** **avisar e permitir** — confirmação mostrando a contagem de
   clientes ativos; pedidos novos já param (corte filtra `isActive`), clientes existentes mantêm dados.
4. **UX:** **switch no card da lista** (gestão), com diálogo de confirmação quando houver impacto.

---

## Fase 0 — Padrão comum de toggle

Para cada módulo: aceitar `isActive` no PATCH e garantir que aparece no response.

- **Combos** — `admin-combos.schema.ts`: `UpdateComboSchema = CreateComboSchema.partial().extend({ isActive: z.boolean().optional() })`.
  Route `admin-combos.route.ts`: confirmar `isActive` no body do PATCH (já documentado) e no response do PATCH.
- **Fornecedores** — `admin-suppliers.schema.ts`: adicionar `isActive` ao update schema.
  Route: adicionar `isActive` ao body do PATCH (response já tem).
- **Condomínios** — `admin-condominiums.schema.ts`: `UpdateCondominiumSchema = CreateCondominiumSchema.partial().extend({ isActive: z.boolean().optional() })`.
  Route: adicionar `isActive` ao body do PATCH (response já tem).

## Fase 1 — Blindagem por módulo

### 🥖 Combos (decisão 1)
- `admin-combos.service.update`: ao detectar transição `isActive: true → false`, executar cascata:
  - Buscar usuários com `autoRecharge != null`, filtrar em JS por `autoRecharge.comboId === id && active`,
    e setar `autoRecharge.active = false` em cada um (Prisma+Mongo não filtra JSON aninhado de forma confiável).
  - Retornar `affectedCount` no response para o front exibir no toast.
  - (Opcional) disparar push/e-mail via OneSignal avisando que a compra automática foi desligada.
- Defensivo (cinto e suspensório): em `payments.service.chargeAutoRecharge`, pular se o combo estiver inativo.

### 🚚 Fornecedores (decisão 2)
- `admin-suppliers.service.update`: se `isActive` indo p/ `false` **e** o fornecedor é `isPrincipal` →
  `throw { statusCode: 409, message: 'Defina outro fornecedor como principal antes de desativar este.' }`.
- Harden pedido ao fornecedor:
  - `admin-supplier-orders.service.createQuick` ([~L634]): `supplier.findMany({ where: { isActive: true } })`.
  - `admin-supplier-orders.service.create` ([~L407]): validar `supplier.isActive` (erro se inativo).

### 🏢 Condomínios (decisão 3)
- `condominiums.route.ts` `GET /condominiums` (signup público): adicionar `where: { isActive: true }`
  (bug atual — condomínio desativado ainda aparece p/ novos clientes).
- Pedidos novos já param no corte (schedules filtra `isActive: true`) — sem mudança extra.
- Sem bloqueio: a confirmação no front usa a contagem de clientes já exibida no card.

## Fase 2 — Frontend (switch no card)

- **AdminCombos.tsx / ComboCard:** switch Ativo/Inativo + estado visual "Inativo".
  Ao desativar, confirmar ("clientes com compra automática neste combo terão a recarga desligada");
  após sucesso, toast com `affectedCount`.
- **AdminFornecedores.tsx / FornecedorCard:** switch + estado "Inativo".
  Principal: desabilitar o switch (ou tratar 409 do backend com a mensagem).
- **AdminCondos.tsx / CondoCard:** switch + estado "Inativo".
  Ao desativar com clientes > 0, confirmar mostrando a contagem.

## Fase 3 — Verificação

- `tsc --noEmit` em `apps/api` e `apps/web`.
- `npm test` em `apps/api` (cobre `admin-suppliers`); adicionar teste da regra do principal.
- Teste manual: desativar/reativar cada um e checar listas pública/cliente, geração de pedido e compra automática.
- **Sem `prisma generate`** — nenhum campo novo no schema (`isActive` já existe nos três modelos).

## Arquivos afetados (resumo)

| Camada | Combos | Fornecedores | Condomínios |
|---|---|---|---|
| Zod schema | admin-combos.schema.ts | admin-suppliers.schema.ts | admin-condominiums.schema.ts |
| Route (body PATCH) | admin-combos.route.ts | admin-suppliers.route.ts | admin-condominiums.route.ts |
| Service (regra) | admin-combos.service.ts (cascata) | admin-suppliers.service.ts (409 principal) | — |
| Dependências | payments.service.ts (guard) | admin-supplier-orders.service.ts (filtrar ativos) | condominiums.route.ts (filtro público) |
| Frontend | AdminCombos.tsx | AdminFornecedores.tsx | AdminCondos.tsx |
