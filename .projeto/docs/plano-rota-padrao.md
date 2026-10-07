# Plano: rota padrão no admin (base inicial + "Sugerir rota")

> ✅ **Status:** **IMPLEMENTADO** em 06/10/2026, **SEM COMMIT**. Verificação: typecheck api e web ✅ ·
> `vite build` ✅ · api **2.045 + 3 todo** (+46) · web **696 + 17 todo** (+11). Telas conferidas em 360 e
> 390 px (headless). `db push` feito no `cheirin-de-pao-teste` (coleção `DefaultRoute` + índice único
> `key`). Execução direta, **sem GSD**. Branch de referência: `feat/add-complementocliente`.
> O que mudou em relação ao plano está na §10. **Sem Claude Design** (D-8): a tela nova usa o
> visual e os componentes da A4 (`CourierRouteScreen`): mapa, lista numerada, arrastar e km ao soltar.
> Tudo numa versão só.

---

## 0. Pedido

O usuário pediu, em 06/10/2026:

1. **Rota padrão predefinida no admin.** Uma rota montada antes, já deixada como base inicial das
   rotas.
2. **Botão "Sugerir rota".** Calcula a melhor rota para entregar em todos os condomínios cadastrados
   até o momento.
3. **Escolher e editar.** O admin pode usar a sugestão e editar a ordem se quiser.

---

## 1. O que já existe

| Peça | Onde | O que faz |
|---|---|---|
| Motor de rota | [`route-engine.ts`](../../apps/api/src/lib/route-engine.ts) | Matriz do OSRM `/table`, ordem exata até 8 prédios e vizinho mais próximo + 2-opt acima disso (`solveOrder`), `planRoute` (melhor ordem) e `routeMetrics` (km, tempo e traçado de uma ordem). Cache de 6 h. Nunca lança. |
| Rota por entregador e turno | [`courier-plan.ts`](../../apps/api/src/modules/courier/courier-plan.ts) + `CourierRouteTemplate` | Sugestão `FIRST` (1ª rota) ou `NEW_CONDO` (prédio novo), aviso `ADMIN_ROUTE_SUGGESTION`, ações Usar · Manter · Ajustar · Adotar, `acceptLog` (economia A9). |
| Ordem do dia | `resolveDayRoute` / `dayOrderFrom` | Prioridade: ordem do entregador no dia (`CourierRun`) → rota salva → sugestão pendente. |
| Quando a sugestão nasce | `suggestRoutesAfterDivision` em [`admin-orders.service.ts`](../../apps/api/src/modules/admin-orders/admin-orders.service.ts) e na própria `resolveDayRoute` | Só depois da 1ª divisão aprovada, entregador por entregador. |
| A5 · Rotas e comprovante | [`AdminRotasConfig.tsx`](../../apps/web/src/pages/admin/gestao/AdminRotasConfig.tsx) + `GET/PATCH /admin/settings/rotas` | Base de saída (com pino), volta à base, minutos por porta, combustível, comprovante. |
| A4 · Rota do entregador | [`CourierRouteScreen.tsx`](../../apps/web/src/components/admin/CourierRouteScreen.tsx) + [`admin-courier-routes`](../../apps/api/src/modules/admin-courier-routes/) | Mapa (`CourierMap`), lista numerada, arrastar (`@dnd-kit`), km recalculado ao soltar (`POST /admin/routes/preview`). |

**O que falta:** antes da 1ª divisão não existe rota nenhuma. Cada entregador e turno começa do zero,
com uma sugestão para aprovar, e não há uma visão de todos os prédios juntos.

---

## 2. Decisões (aprovadas em 06/10/2026)

| # | Decisão |
|---|---|
| **D-1** | **Uma rota padrão só**, para todos os turnos. A geografia é a mesma em qualquer turno; cada turno usa só os prédios que têm entrega nele. |
| **D-2** | **Base automática.** O entregador e turno **sem rota própria** segue a rota padrão, só com os prédios dele no dia, **sem aprovar a 1ª rota**. A rota própria (ajustada no A4) vale por cima. Quando a padrão muda, todos que a seguem mudam juntos. |
| **D-3** | **Prédio novo encaixa sozinho** na posição de menor desvio (menos km a mais). Fica com o selo **"novo · encaixado"** até o admin revisar, e o admin recebe um aviso. A rota sempre cobre todos os prédios. |
| **D-4** | **Local:** nova seção **"Rota padrão"** em Gestão › Rotas e comprovante (A5), com um card de resumo (prédios, km, tempo) que abre a tela de edição. |
| **D-5** | **"Sugerir rota" com a padrão já salva:** mostra a atual e a sugerida no mapa, com km, tempo e a diferença (−2,3 km). Botões **Usar sugestão** · **Editar antes de usar** · **Descartar**. Nada muda até o admin salvar. |
| **D-6** | **Entram os condomínios ativos com localização.** Os sem localização aparecem à parte ("fora do mapa"), com atalho para Condomínios. Os de localização aproximada entram com o selo **"aproximado"**. Desativar um condomínio tira ele da rota; reativar encaixa de novo (D-3). |
| **D-7** | **As rotas próprias continuam valendo.** O A4 ganha o selo **"Segue a rota padrão"** ou **"Rota própria"** e o botão **"Voltar à rota padrão"**, que apaga a rota própria daquele entregador e turno. |
| **D-8** | **Sem Claude Design.** A tela usa os componentes da A4. |
| **D-9** | **Entregador com rota própria que recebe prédio novo: fluxo atual.** Sai a sugestão `NEW_CONDO` para aprovar no A4; enquanto isso, o prédio entra na posição sugerida. |
| **D-10** | **1ª vez (ainda sem rota padrão):** a tela **já abre com a sugestão calculada** para todos os prédios, com **Usar sugestão** e **Editar antes de usar**. |
| **D-11** | **Prédio que muda de endereço ou de localização é reencaixado sozinho:** sai da posição antiga e entra na de menor desvio, com o selo **"reencaixado"** e o mesmo aviso do D-3. |

---

## 3. Regras

### 3.1 Modelo

Um modelo novo de registro único (`key = "global"`). Ele usa ObjectIds e tem campos tipados, por isso
não cabe bem numa `Setting` de texto.

```prisma
// Rota padrão (plano-rota-padrao): ordem única dos condomínios ativos com localização, base inicial
// das rotas dos entregadores (D-1/D-2). Registro único: key = "global".
model DefaultRoute {
  id             String   @id @default(auto()) @map("_id") @db.ObjectId
  key            String   @unique
  condominiumIds String[] @db.ObjectId
  km             Float?
  durationMin    Int?
  // Encaixes automáticos que o admin ainda não revisou (D-3/D-11):
  // [{ id, kind: 'NOVO'|'REENCAIXADO', at, kmAdded }]. Some ao salvar a rota ou em "Está bom assim".
  autoPlaced     Json?
  // Último "Salvar" do admin ("salva em 06/10 por …"). O `updatedAt` muda também nos encaixes.
  savedAt        DateTime?
  savedById      String?  @db.ObjectId
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

- Precisa de `prisma db push`, por causa do índice único em `key`. No banco de teste pode rodar
  (conferir o alvo antes); no deploy, o Ansible já roda.
- Lib nova: `apps/api/src/lib/default-route.ts`, com `getDefaultRoute`, `saveDefaultRoute`,
  `syncDefaultRoute`, `suggestDefaultRoute` e `readAutoPlaced` (leitor defensivo, como o
  `readSuggestion`).

### 3.2 Ordem do dia (`resolveDayRoute`)

A prioridade passa a ser:

**ordem do entregador no dia (`CourierRun`) → rota própria (template aceito) → rota padrão → sugestão pendente → ordem recebida.**

- Na prática: `dayOrderFrom(present, saved ?? padrao, suggestion)`. O `DayRoute.source` ganha o valor
  `'DEFAULT'`.
- Um prédio do dia que está fora da padrão vai para o fim da lista, como já acontece hoje. Isso
  acontece com prédio sem localização, prédio inativo que ainda tem pedido, ou encaixe que falhou com o
  OSRM fora do ar.
  - Antes disso, se o prédio tem localização, a função tenta encaixá-lo (`syncDefaultRoute`,
    best-effort).
- O prédio que só tem gancho no turno entra no traçado do dia, como hoje.
- O "Voltar à rota padrão" do **app do entregador** não muda. Ele descarta a ordem do dia e volta para
  a rota do turno, seja ela própria ou a padrão.

### 3.3 Sugestão por entregador (`ensureSuggestion`)

| Situação | Comportamento |
|---|---|
| Há rota padrão e o entregador **não** tem rota própria | **Não gera sugestão** (nem `FIRST` nem aviso). Devolve o template como está (D-2). |
| O entregador tem rota própria | Igual a hoje: `NEW_CONDO` quando entra prédio novo (D-9). |
| **Não** há rota padrão | Igual a hoje: `FIRST`. A padrão é opcional e o sistema funciona sem ela. |

- **Ao salvar a padrão**, as sugestões `FIRST` pendentes (templates sem `acceptedAt`) são limpas, e
  esses entregadores passam a seguir a padrão.
  - O selo "sugestão de rota nova" da lista de entregadores some junto.

### 3.4 "Sugerir rota"

- **Prédios:** `isActive` e com `lat`/`lng` (D-6).
- **Cálculo:** `planRoute({ base, stops, returnToBase: voltaBase })`, o mesmo motor da rota do
  entregador.
- **É efêmera:** nada é gravado. A resposta traz `deltaKm` contra a padrão salva, com o km da salva
  recalculado na mesma config (base e volta), para comparar igual com igual.
- **OSRM fora do ar:** a resposta vem com `computed: false`. A tela mostra "Não deu para calcular agora"
  e um botão "Tentar de novo", e a padrão salva não muda.
- **Sem base de saída:** calcula com o 1º prédio livre e mostra a nota "Sem base de saída: a rota
  começa no primeiro prédio".

### 3.5 Encaixe automático (`syncDefaultRoute`)

É uma função só, idempotente: `syncDefaultRoute(fastify, { moved?: string[] })`. Nunca lança.

1. Sem rota padrão salva, não faz nada.
2. **Tira da ordem** os ids apagados, inativos ou sem localização, junto com os selos deles.
3. **`moved`** (a localização mudou): o id sai da posição atual e vai para o encaixe com o selo
   `REENCAIXADO` (D-11).
4. **Faltando**, ou seja, ativos com localização que estão fora da ordem: vão para o encaixe com o selo
   `NOVO` (D-3).
5. **Menor desvio** (`cheapestInsertion`, função pura nova no `route-engine.ts`):
   - matriz OSRM `/table` com a base, a ordem atual e os prédios a encaixar;
   - um prédio por vez, em cada vão (base→1º, i→i+1 e último→base, se a volta estiver ligada):
     `custo = d(a,k) + d(k,b) − d(a,b)`;
   - sem base, os vãos são "antes do 1º", entre os prédios e "depois do último".
6. Recalcula km e tempo, grava, acumula `autoPlaced` com `kmAdded` e **avisa o admin**:
   - tipo `ADMIN_ROUTE_SUGGESTION`, `dedupeKey` `default-route:<id>:<kind>:<dia>`;
   - exemplo: "Rota padrão: Cond. Aurora entrou na posição 4 (+0,8 km). Revise em Rotas e
     comprovante."
7. **OSRM fora do ar:** grava só as remoções. O prédio fica fora (no dia, vai para o fim), e a próxima
   chamada tenta de novo.
8. **Concorrência:** grava com `updateMany where { key, updatedAt: <lido> }`. Se nenhuma linha mudar,
   relê e refaz uma vez.

**Quem chama:**

- criar, editar e remover condomínio, só quando muda o que importa (criação, remoção, `isActive`,
  `lat`/`lng`). Roda **em segundo plano** depois de gravar, para não segurar o "Salvar" do condomínio
  (o OSRM tem timeout de 8 s);
- o `GET` da tela da rota padrão;
- a `resolveDayRoute`, quando falta na padrão um prédio do dia que tem localização (best-effort);
- o `PATCH /admin/settings/rotas`, quando a base ou a volta mudam: só recalcula o km e o tempo
  guardados.

**Revisar:** os selos `NOVO` e `REENCAIXADO` somem quando o admin salva a rota (qualquer salvamento)
ou toca em **"Está bom assim"** no aviso da tela.

### 3.6 Salvar a rota padrão

- `PUT` com `{ condominiumIds }`. Dá **400** se a lista estiver vazia ou tiver repetidos.
- Ids que não entram mais (inativo, sem localização ou apagado no meio do caminho) são **ignorados**,
  sem erro.
- Prédios que faltam (cadastrados enquanto o admin editava) são encaixados logo depois pelo
  `syncDefaultRoute` e ganham o selo `NOVO`.
- Grava `km`, `durationMin`, `savedAt` e `savedById` e limpa o `autoPlaced`. Todo salvamento limpa as
  `FIRST` pendentes (§3.3); na prática, elas só existem antes do 1º.

### 3.7 A4 com a rota padrão

- **`followsDefault`** = existe padrão salva **e** o entregador não tem rota própria aceita naquele
  turno.
- **Prédios do entregador no turno:** os condomínios distintos de `Order`/`MarketOrder` com
  `courierId` e `slotId` dele, dos últimos 30 dias até amanhã.
  - Vêm na ordem da padrão; os que estão fora dela vão para o fim.
  - Sem nenhum prédio: "Ainda sem entregas neste turno. Segue a rota padrão."
- **Selo:** "Segue a rota padrão" (ordem filtrada, km, tempo e mapa) ou **"Rota própria"** (o bloco
  que hoje se chama "Rota salva").
- **Ajustar (quem segue a padrão):** começa da ordem filtrada. Ao salvar, vira rota própria (`ADJUST`,
  que já existe).
- **"Voltar à rota padrão"** (só para quem tem rota própria e só com padrão salva):
  - pede confirmação;
  - limpa `condominiumIds`, `acceptedAt`, `acceptedById` e `suggestion`;
  - **mantém o `acceptLog`**, para a economia A9 não perder histórico;
  - dá **400** sem padrão salva.
- **Adotar a ordem de um dia** continua igual e vira rota própria.
- **Usar · Manter** só aparecem quando há sugestão: `NEW_CONDO` de quem tem rota própria, ou `FIRST`
  quando não há padrão.

### 3.8 Impactos conhecidos (ficam como estão)

- **Gancho, D-6 do `plano-gancho-sozinho-na-rota`:** o passo 2 ("rota salva do turno que contém o
  condomínio") só enxerga rota própria. Quem segue a padrão é coberto pelo passo 1 (divisão aprovada);
  fora dele, fica sem sugestão de entregador e o admin escolhe.
- **Economia das rotas (A9 e relatório de combustível):** só contam as mudanças de rota própria.
  Mudanças da padrão não entram.
- **Divisão de entregas:** o algoritmo guloso por carga não muda e não olha a rota padrão.

---

## 4. API

| Rota | O que faz |
|---|---|
| `GET /admin/default-route` | Roda o `syncDefaultRoute` e devolve:<br>• `base` e `voltaBase`;<br>• `saved { condominiumIds, km, durationMin, geometry, updatedAt, updatedByName } \| null`;<br>• `condos[] { id, name, lat, lng, approxLocation, flag: 'NOVO'\|'REENCAIXADO'\|null, kmAdded }`;<br>• `outside[] { id, name }` (ativos sem localização);<br>• `autoPlaced` (para o aviso). |
| `POST /admin/default-route/suggest` | Sugestão efêmera (§3.4): `{ condominiumIds, km, durationMin, geometry, computed, deltaKm }`. |
| `PUT /admin/default-route` | Salva a ordem (§3.6). Devolve a mesma visão do `GET`. |
| `POST /admin/default-route/review` | "Está bom assim": limpa o `autoPlaced` sem mexer na ordem. |
| `POST /admin/routes/preview` | **Já existe** e é reaproveitada no arrastar. Usa base e volta da config e aceita até 100 ids. |
| `GET /admin/couriers/:id/routes/:slotId` | Ganha `followsDefault` e `defaultOrder { condominiumIds, km, durationMin, geometry } \| null` (§3.7). |
| `POST /admin/couriers/:id/routes/:slotId/reset` | "Voltar à rota padrão" (§3.7). Dá 400 sem padrão. |
| `GET /admin/settings/rotas` | Ganha o resumo `rotaPadrao { count, km, durationMin, updatedAt, toReview, outside } \| null` para o card da A5. |

- Todas exigem JWT + ADMIN, com o mesmo padrão do `admin-courier-routes`.
- **Declarar todos os campos novos nos schemas de resposta**, porque o fast-json-stringify descarta o
  que não estiver declarado.
- As rotas ficam no módulo `admin-courier-routes`, que já reúne as rotas do admin (§10.1).

---

## 5. Web

### 5.1 Componentes compartilhados

`Num`, `OrderList`, `SortRow`, `btn` e o formatador de km saem do `CourierRouteScreen` para
`components/admin/route-kit.tsx`, e as duas telas importam de lá. A A4 não muda de visual.

### 5.2 A5 · seção "Rota padrão"

Fica logo depois de "Base de saída", em [`AdminRotasConfig.tsx`](../../apps/web/src/pages/admin/gestao/AdminRotasConfig.tsx).

- **Com rota:** um card com "12 prédios · 18,4 km · 52 min · salva em 06/10" e os selos "2 para
  revisar" e "1 fora do mapa". O card abre a tela.
- **Sem rota:** "Sem rota padrão ainda. Monte a base das rotas dos entregadores." e o botão
  **"Montar rota padrão"**.
- A tela abre por um estado interno da A5. Assim o formulário da A5 não perde o que foi digitado e
  não ainda salvo.

### 5.3 Tela `DefaultRouteScreen` (nova, em `components/admin/`)

| Estado | O que mostra |
|---|---|
| **1ª vez** (D-10) | Já chama o `suggest`: mapa, lista, km e tempo, com **Usar sugestão** e **Editar antes de usar**. |
| **Salva** | Mapa, lista (selos "novo · encaixado", "reencaixado" e "aproximado"), km, tempo e "salva em", com **Sugerir rota** e **Ajustar**. |
| **Aviso de encaixe** | Nota dourada: "Aurora entrou sozinho na posição 4 (+0,8 km)", com **Está bom assim** e **Ajustar**. |
| **Comparação** (D-5) | "Atual 18,4 km · Sugerida 16,1 km (−2,3 km)", alternância do mapa Atual/Sugerida e lista sugerida com "subiu/desceu", como no A4. Botões **Usar sugestão** · **Editar antes de usar** · **Descartar**. |
| **Editar** | Lista arrastável com km e tempo recalculados ao soltar (`preview`), com **Salvar rota padrão** e **Cancelar**. |
| **Fora do mapa** (D-6) | Lista dos sem localização e o atalho **"Corrigir em Condomínios"** (prop `onOpenCondos` vinda da `AdminGestao`). |
| **Sem base** | `CRNote`: "Sem base de saída: a rota começa no primeiro prédio. Defina a base em Rotas e comprovante." |
| **OSRM fora** | `CRNote` com `cloudOff`: lista sem traçado; na sugestão, "Não deu para calcular agora" e "Tentar de novo". |

### 5.4 A4 · `CourierRouteScreen`

- Selo **"Segue a rota padrão"** ou **"Rota própria"**.
- Para quem segue a padrão: o bloco com a ordem filtrada e o **Ajustar** a partir dela.
- Para quem tem rota própria (com padrão salva): o botão **"Voltar à rota padrão"**, com confirmação.

### 5.5 Notificações

Em `AdminNotificacoes`, a descrição de `ADMIN_ROUTE_SUGGESTION` passa a ser: "Quando a rota de um
entregador muda ou um prédio entra sozinho na rota padrão".

---

## 6. Execução

1. **Back · base:**
   - modelo `DefaultRoute` e `db push` no `cheirin-de-pao-teste`;
   - `cheapestInsertion` no `route-engine.ts`;
   - `lib/default-route.ts` (get, save, sync, suggest).
2. **Back · integração:**
   - `resolveDayRoute` e `ensureSuggestion` (§3.2, §3.3);
   - limpeza das `FIRST` ao salvar;
   - gatilhos no `admin-condominiums.service` (create, update, remove);
   - recálculo no `PATCH` da A5;
   - módulo `admin-default-route`;
   - A4 com `followsDefault`, `defaultOrder` e `reset`;
   - resumo no `GET /admin/settings/rotas`.
3. **Web:** `route-kit.tsx`, `DefaultRouteScreen`, seção da A5, selo e botão no A4, texto da
   notificação.
4. **Verificação:**
   - typecheck da api e do web, testes e `vite build`;
   - telas conferidas em 360 e 390 px (headless);
   - roteiro manual no banco de teste: 1ª vez → usar sugestão → cadastrar prédio (encaixe + aviso) →
     mudar endereço (reencaixe) → desativar → A4 seguindo a padrão → ajustar → voltar à padrão.
5. **Docs:**
   - atualizar o [`checklist-deploy-app-entregador.md`](checklist-deploy-app-entregador.md): contagem de
     testes (§1.2), `db push` do `DefaultRoute` e os passos de UAT da rota padrão (§5);
   - marcar o status deste plano.

---

## 7. Testes

**API**

- `cheapestInsertion`:
  - menor desvio com e sem base, com e sem volta;
  - vão no começo e no fim;
  - par sem caminho (1e9) evitado.
- `syncDefaultRoute`:
  - sem padrão, não faz nada;
  - tira inativo, apagado e sem localização;
  - encaixa novo (`NOVO`) e reencaixa o `moved` (`REENCAIXADO`), com `kmAdded`;
  - OSRM fora: só as remoções e nenhum aviso;
  - aviso com `dedupeKey`;
  - idempotente (2ª chamada não muda nada);
  - conflito de `updatedAt` refaz uma vez.
- `suggestDefaultRoute`: só ativos com localização; `deltaKm`; `computed: false` com OSRM fora; sem
  base.
- `saveDefaultRoute`:
  - 400 com vazio ou repetido;
  - ignora id inválido;
  - limpa `autoPlaced`;
  - salvar limpa as `FIRST` pendentes e **não** mexe nas aceitas.
- `resolveDayRoute`:
  - prioridade run → própria → padrão → sugestão;
  - `source: 'DEFAULT'`;
  - prédio fora da padrão vai para o fim.
- `ensureSuggestion`:
  - com padrão e sem rota própria, não sugere nem avisa;
  - com rota própria, `NEW_CONDO` como hoje;
  - sem padrão, `FIRST` como hoje.
- A4:
  - `followsDefault` e `defaultOrder` (prédios dos últimos 30 dias, na ordem da padrão);
  - `reset` mantém o `acceptLog` e dá 400 sem padrão.
- Condomínio:
  - o gatilho só dispara quando mudam `isActive`, `lat`/`lng`, criação ou remoção;
  - falha no sync não derruba o salvar.
- Rotas: os schemas de resposta mantêm os campos novos.

**Web**

- `DefaultRouteScreen`:
  - 1ª vez já sugere;
  - usar e salvar;
  - comparação com −km;
  - editar e preview ao soltar;
  - "Está bom assim";
  - fora do mapa;
  - sem base;
  - OSRM fora.
- A5: card com e sem rota, e os selos.
- A4: selos, "Voltar à rota padrão" com confirmação, e Ajustar de quem segue a padrão.

---

## 8. Riscos

| # | Risco | Mitigação |
|---|---|---|
| R-1 | O OSRM público limita o `/table` a 100 pontos, ou seja, a base + 99 prédios. | Hoje sobra muita margem. Passando disso: OSRM próprio (D-8 do plano do entregador) ou `/table` com `sources`/`destinations`. O `suggest` devolve `computed: false` em vez de quebrar. |
| R-2 | Acima de 8 prédios a ordem é heurística (vizinho mais próximo + 2-opt): boa, mas não garantidamente ótima. | O admin edita (D-5). Or-opt fica para depois, se precisar. |
| R-3 | A padrão filtrada para um subconjunto de prédios é boa, mas não necessariamente ótima para aquele subconjunto. | Aceito no D-2. O A4 mostra o km, e o admin pode criar rota própria. |
| R-4 | Encaixes seguidos degradam a rota aos poucos. | O aviso e o selo convidam a "Sugerir rota" de novo, e a comparação mostra o ganho. |
| R-5 | Dois cadastros de condomínio ao mesmo tempo disputam a rota. | Gravação condicionada ao `updatedAt` + 1 nova tentativa; o `GET` e a `resolveDayRoute` sincronizam de novo. |

---

## 9. Fora do escopo

- Dividir os entregadores pela rota padrão (um trecho contínuo para cada um).
- Rota padrão por turno (D-1).
- Trânsito e horário no cálculo (o OSRM não considera).

---

## 10. Registro da execução (06/10/2026)

### 10.1 Ajustes em relação ao plano

- **Campos do modelo:** em vez de `updatedById`, o modelo tem `savedAt` e `savedById`, gravados só no
  "Salvar" do admin. Os encaixes também mudam o `updatedAt`, e o "salva em 06/10 por …" não pode mudar
  sozinho.
- **Sem módulo novo:** as rotas da rota padrão entraram no `admin-courier-routes`, que já reúne as
  rotas do admin (A2, A4, a busca da base). Assim o controller reaproveita o mesmo tratamento de erro e
  os mesmos schemas (`geometry`, `condo`, `base`).
- **1ª vez com o mapa fora do ar:** a tela oferece **Tentar de novo** e **Montar à mão** (lista em ordem
  alfabética para arrastar). Sem isso, não haveria como criar a rota com o OSRM fora.
- **A5:** quando a base ou a volta foram mexidas e não salvas, o card mostra "Salve antes de mexer na
  rota padrão: ela usa a base e a volta já salvas". Ao voltar da tela, só o resumo do card é
  atualizado; o que foi digitado na A5 fica.
- **A4 com rota padrão salva:** o bloco "ROTA SALVA" passa a se chamar "ROTA PRÓPRIA", e o botão
  "Adotar como rota padrão" das alterações do entregador vira "Adotar como rota própria", para não
  confundir com a rota padrão nova. Sem rota padrão, os textos ficam como estavam.
- **A4 de quem segue a padrão:** as alterações do entregador ("Trocou X ↔ Y") são comparadas com a
  ordem da padrão, porque não há rota salva para comparar.
- **Layout em 360 px:** na comparação, os botões ficam empilhados (Usar · Editar antes de usar ·
  Descartar), e na confirmação do "Voltar à rota padrão" também. Lado a lado, o texto quebrava.

### 10.2 Arquivos

**API**

- `prisma/schema.prisma`: modelo `DefaultRoute`.
- `lib/route-engine.ts`: `cheapestInsertion` (pura) e `insertStops`.
- `lib/default-route.ts` (novo): sugerir, salvar, revisar, `syncDefaultRoute`,
  `refreshDefaultRouteMetrics`, `defaultRouteView` e `defaultRouteSummary`.
- `modules/courier/courier-plan.ts`:
  - `resolveDayRoute` com a prioridade nova e `source: 'DEFAULT'`;
  - `ensureSuggestion` não sugere para quem segue a padrão;
  - `resetToDefault`.
- `modules/admin-courier-routes/*`:
  - A4 com `followsDefault` e `defaultOrder`;
  - `POST …/routes/:slotId/reset`;
  - `GET`/`PUT /admin/default-route`, `POST /admin/default-route/suggest` e `POST /admin/default-route/review`.
- `modules/admin-condominiums/admin-condominiums.service.ts`: o sync em segundo plano ao criar, editar
  (`isActive` e coordenadas) e remover.
- `modules/admin-settings/*`: `rotaPadrao` no `GET`/`PATCH /admin/settings/rotas` e o recálculo quando
  a base ou a volta mudam.

**Web**

- `components/admin/route-kit.tsx` (novo): peças tiradas da A4.
- `components/admin/DefaultRouteScreen.tsx` (novo).
- `components/admin/CourierRouteScreen.tsx`: selo, bloco de quem segue a padrão e "Voltar à rota
  padrão".
- `pages/admin/gestao/AdminRotasConfig.tsx`: seção "Rota padrão".
- `pages/admin/tabs/AdminGestao.tsx`: descrição do card e atalho para Condomínios.
- `pages/admin/gestao/AdminNotificacoes.tsx`: texto do `ADMIN_ROUTE_SUGGESTION`.

**Testes**

- api:
  - `lib/__tests__/default-route.test.ts` (novo);
  - `route-engine.test.ts`, `courier-plan.test.ts`, `admin-courier-routes.test.ts`,
    `admin-condominiums.service.test.ts` e `admin-settings.rotas-route.test.ts` (ampliados);
  - `admin-settings.rotas-service.test.ts` (novo).
- web: `components/admin/__tests__/DefaultRouteAdmin.test.tsx` (novo).

**Docs:** [`checklist-deploy-app-entregador.md`](checklist-deploy-app-entregador.md), com os números da
§1.2, a coleção nova na 2.3, a configuração inicial na 4.2, o roteiro "Rota padrão" na §5 e duas
pendências na §7.
