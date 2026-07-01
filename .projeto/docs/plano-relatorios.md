# Plano — Módulo "Relatórios" no menu de Gestão

> Levantamento e planejamento da feature de Relatórios/Analytics para o admin.
> Data: 2026-06-28 · Branch sugerida: `feat/admin-relatorios`

> **Status (2026-06-28):** ✅ **Fases 0, 1, 2, 3 e 4 implementadas e testadas (smoke E2E).**
> - Fase 0/1/2: item "Relatórios" no menu, instrumentação de acesso (`AnalyticsEvent` + beacon)
>   e os 3 obrigatórios (acessos, logins de cliente, conversão). Smoke test confirmou deltas exatos.
> - Fase 3 (Tier 1): `/admin/reports/retention` (recarga automática, churn por esgotamento,
>   recompra & autonomia, funil de ativação), `/credit-liability` (passivo) e `/condominiums` (ranking).
> - Fase 4 (Tier 2): `/admin/reports/delivery` (taxa de entrega + motivos), `/waste` (pedido×entregue),
>   `/schedule-profile` (pães/semana, dias da semana, único×recorrente) e `/payments` (aprovação,
>   estorno, mix Pix/cartão, recuperação). Todos retornaram dados reais corretos no dev.
> - Tela = hub com 2 grupos (Aquisição & clientes · Operação & financeiro) + 8 sub-relatórios;
>   "Em breve" agora só Tier 3 (custo OTP, concessões/suporte, cohort de receita, sessões/dispositivos).
> - **Refino: export CSV** ✅ — botão "Exportar" no cabeçalho de todos os 8 relatórios (`lib/csv.ts`,
>   delimitador `;` + BOM UTF-8 p/ Excel pt-BR). Gera no cliente a partir do dado já carregado.
> - **Rollup diário: adiado** (decisão de engenharia) — volume de eventos atual é baixo e os
>   relatórios cobrem no máximo "mês" (30d). Um TTL agressivo apagaria histórico; o rollup completo
>   (coleção agregada + cron + leitura híbrida) é infra que ainda não se paga. Gatilho p/ implementar:
>   quando `AnalyticsEvent` crescer o suficiente p/ pesar nas queries OU quando quiserem tendências > 90d.
> - Typecheck OK em api e web. Pendente: validar no PWA real e Tier 3 quando fizer sentido.
>
> #12 (efetividade de "crédito baixo") foi adiado: 0 notificações LOW_CREDIT no banco — sem dado p/ medir.
>
> Arquivos — backend: `lib/date-range.ts`, `modules/analytics/*`, `modules/admin-reports/*`
> (7 relatórios); frontend: `lib/analytics.ts`, `pages/admin/gestao/{AdminRelatorios,RelShared,
> RelAcesso,RelRetencao,RelPassivo,RelCondominios,RelEntregas,RelDesperdicio,RelAgenda,RelPagamentos}.tsx`.
> Schema: `AnalyticsEvent` (+ índices em `ensure-indexes.ts`).

---

## 1. Objetivo

Adicionar uma nova opção **"Relatórios"** no hub de Gestão do admin e construir um módulo
de análise de dados da operação.

Relatórios **obrigatórios** (pedidos explicitamente):

1. **Métricas de acesso** — quantos acessos o Cheirin de Pão recebe.
2. **Métricas de login** — quantos acessam e logam como **cliente**.
3. **Conversão acesso → login** — relação entre acessos e logins.

Mais o catálogo de relatórios recomendados (seção 6).

---

## 2. Achado mais importante (a "pegadinha" do projeto)

| Relatório | Dado existe hoje? |
|---|---|
| **Login de clientes** | ✅ **Sim** — derivável de `Session.createdAt` + `User.role = CLIENT`. |
| **Acessos (visitas)** | ❌ **Não** — não há rastreio de page-view / app-open / visitante anônimo em lugar nenhum. |
| **Conversão acesso→login** | ❌ Depende do item de acesso acima. |

**Conclusão:** login e quase todos os demais relatórios saem do dado já existente.
O **único bloco que exige construir infraestrutura nova é o rastreio de acessos**.
Esse é o coração deste plano.

> Não existe nenhum modelo `Analytics`/`Event`/`AccessLog`/`PageView` no backend, nem
> middleware de tracking, nem provedor externo (Google Analytics, Plausible, etc.).
> Confirmado varrendo o schema e o código.

---

## 3. Onde "Relatórios" se encaixa (mudança trivial de menu)

O hub de Gestão é navegação por estado (não por rotas aninhadas).
Arquivo: [AdminGestao.tsx](apps/web/src/pages/admin/tabs/AdminGestao.tsx)

Adicionar Relatórios = 3 pequenas mudanças + 1 arquivo novo:

```tsx
// 1) tipo (linha ~15)
type AdminGestaoSub = null | 'combos' | ... | 'financeiro' | 'relatorios'

// 2) HUB_ITEMS (linha ~33) — ícone sugerido: 'doc' (livre; 'trend' já é do Financeiro)
{ key: 'relatorios', icon: 'doc', titulo: 'Relatórios', descricao: 'Acessos, conversão e métricas' }

// 3) render condicional (linha ~52)
if (sub === 'relatorios') return <AdminRelatorios onBack={onBack} />
```

E criar `apps/web/src/pages/admin/gestao/AdminRelatorios.tsx` seguindo o padrão de
[AdminFinanceiro.tsx](apps/web/src/pages/admin/gestao/AdminFinanceiro.tsx) — que já usa
`SegmentedControl` (dia/semana/mês) + `BarChart` + `KpiCard`. **Sem lib de gráfico nova**:
o projeto tem um `BarChart` SVG próprio e barras proporcionais em CSS.

---

## 4. Infraestrutura nova: rastreio de acesso (o que precisa ser construído)

### 4.1 Definições (alinhar antes de codar)

- **Acesso (visita):** uma abertura do app / carga da PWA por um **visitante**.
- **Visitante único:** identificado por um ID anônimo gerado no cliente e salvo em
  `localStorage` (ex.: chave `cdp_vid`, um UUID). Sem PII.
- **Login (cliente):** verificação de OTP bem-sucedida que cria uma `Session` de um
  usuário com `role = CLIENT`.
- **Conversão:** `visitantes únicos que logaram / visitantes únicos que acessaram` no período.

### 4.2 Modelo de dados — `AnalyticsEvent` (recomendado)

Um único stream de eventos cobre acesso **e** login, permitindo a conversão como funil real
(mesmo `visitorId` aparece no acesso e no login).

```prisma
model AnalyticsEvent {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  type       String   // 'access' | 'login'  (enum AnalyticsEventType)
  visitorId  String   // ID anônimo do dispositivo (localStorage)
  userId     String?  @db.ObjectId   // preenchido só no login
  role       String?  // 'CLIENT' | 'COURIER' | 'ADMIN' (no login)
  path       String?  // rota inicial / tela
  referrer   String?
  platform   String?  // 'pwa' | 'browser' (display-mode)
  userAgent  String?  // p/ breakdown SO/dispositivo (LGPD: dado mínimo)
  createdAt  DateTime @default(now())

  @@index([type, createdAt])
  @@index([visitorId, createdAt])
}
```

> Mongo: usar `prisma db push` (padrão do projeto). Considerar **TTL index** nos eventos
> brutos (ex.: expurgar após 90–180 dias) + rollup diário agregado para histórico longo.

**Alternativa mais simples (se quiser menos esforço):** medir acesso por `AnalyticsEvent`
e login direto da tabela `Session` (sem evento de login). Conversão vira razão agregada
(logins/acessos), não funil por visitante. Funciona para o pedido do usuário, mas perde o
funil real. **Recomendo o stream único** — custo marginal pequeno.

### 4.3 Backend — módulo `analytics/`

Seguir o padrão de módulos existentes (`controller` / `service` / `route`).

- `POST /analytics/event` — **público** (sem `authenticate`). Recebe `{ type:'access', visitorId, path, referrer, platform }`. Rate-limit / validação Zod. Idempotência leve por (visitorId, dia) se quiser contar 1 acesso/dia por visitante além do bruto.
- Emissão do evento `login`: duas opções —
  - (a) frontend dispara `POST /analytics/event {type:'login', visitorId, role}` após login OK (mais simples, desacoplado), **ou**
  - (b) `AuthService.verifyOtpAndCreateSession` grava o evento server-side (precisa receber `visitorId` no `/auth/otp/verify`). Mais robusto contra adulteração.
  - **Recomendo (a)** para a 1ª versão.
- `GET /admin/reports/access?period=` — agrega acessos, visitantes únicos, logins de cliente e conversão. `preHandler: [fastify.authenticate]` + check `role === 'ADMIN'`.

### 4.4 Frontend — emissão do beacon

- **Acesso:** disparar 1x por sessão de app na carga. Bom lugar: um hook chamado no
  [main.tsx](apps/web/src/main.tsx) ou no `AuthProvider`. Gerar/ler `cdp_vid` no `localStorage`;
  detectar `platform` via `window.matchMedia('(display-mode: standalone)')`.
  Usar `navigator.sendBeacon` (não bloqueia, sobrevive ao unload).
- **Login:** após sucesso no fluxo de OTP, disparar evento `login` com `visitorId` + `role`
  (o role vem na resposta de auth).

### 4.5 LGPD / privacidade

ID anônimo, sem nome/CPF/telefone no stream; métricas agregadas. `userAgent` é o dado mais
sensível — manter só para breakdown de plataforma e considerar TTL curto. Documentar na
política de privacidade.

---

## 5. Relatórios obrigatórios — especificação

### R1 · Métricas de acesso
- **KPIs:** acessos totais, visitantes únicos, acessos/visitante. Série temporal por dia.
- **Quebras:** plataforma (PWA instalado vs browser), por SO/dispositivo (via userAgent).
- **Fonte:** `AnalyticsEvent type='access'`. ⚙️ Requer instrumentação.

### R2 · Métricas de login (clientes)
- **KPIs:** logins de cliente no período, clientes únicos que logaram, logins/cliente.
- **Quebras:** canal de OTP (SMS vs e-mail) via `OtpCode.channel`; novos vs recorrentes.
- **Fonte:** `Session` (createdAt, join `User.role='CLIENT'`) + `OtpCode`. ✅ Disponível agora.

### R3 · Conversão acesso → login
- **KPI principal:** `% visitantes que logaram = logins únicos / visitantes únicos`.
- **Funil:** Acessos → Cadastros (`User.createdAt`) → Logins → 1ª compra (`Payment PAID`).
- **Fonte:** `AnalyticsEvent` (visitorId compartilhado) + `Session`/`User`/`Payment`.
  ⚙️ Requer instrumentação (acesso).

---

## 6. Escopo selecionado de relatórios (decidido)

> **Decisão (2026-06-28):** Tier 1 e Tier 2 **entram no plano** (Fases 3 e 4).
> Tier 3 fica como **backlog**: os cards aparecem na tela, porém **desabilitados com selo
> "Em breve"** — implementados somente futuramente.
>
> Legenda: ✅ dado existe hoje · ⚙️ requer instrumentação · 〰️ derivável/aproximado

### 🥇 Tier 1 — implementar logo (alto valor, dado já existe) → Fase 3

| # | Relatório | O que responde · fonte | Status |
|---|---|---|---|
| 1 | **Adoção de recarga automática** | % de clientes com auto-recarga ligada (maior alavanca de retenção do modelo pré-pago) · `User.autoRecharge` | ✅ |
| 2 | **Churn por esgotamento de crédito** | zeraram o saldo e **não** recarregaram em X dias — o sinal de churn pré-pago · `creditBalance` + `CreditTransaction` | ✅ |
| 3 | **Intervalo de recompra & autonomia do combo** | cadência de recompra / quantos dias um combo dura (prevê caixa) · `Payment` + `CreditTransaction` | ✅ |
| 4 | **Funil de ativação** | cadastro → montou agenda → 1ª compra → 1ª entrega (onde o cliente novo trava) · `User`/`Schedule`/`Payment`/`Order` | ✅〰️ |
| 5 | **Passivo de crédito (receita diferida)** | quanto a empresa "deve em pão" ao longo do tempo (contábil) · soma `creditBalance` / `CreditTransaction` acumulado | ✅〰️ |
| 6 | **Ranking de condomínios** | receita / volume / clientes ativos por condomínio (expandir ou cortar) · `Payment`/`Order` por `condominiumId` | ✅ |

### 🥈 Tier 2 — a seguir (esforço médio) → Fase 4

| # | Relatório | O que responde · fonte | Status |
|---|---|---|---|
| 7 | **Acurácia pedido × entregue (desperdício)** | pães comprados do fornecedor × entregues — sobra/falta, ataca margem · `PurchaseOrder` × `Order` DELIVERED | ✅〰️ |
| 8 | **Pontualidade de entrega (on-time)** | entregas no horário do turno × atrasadas + tendência de motivos de falha · `Order.deliveredAt` × slot | ✅〰️ |
| 9 | **Perfil da agenda** | pães/semana médios, distribuição e dias da semana mais pedidos (planejar demanda) · `Schedule.weeklyQty` | ✅ |
| 10 | **Pedido único × recorrente** | mix entre compra avulsa e agenda (insight de produto) · `Order.type` | ✅ |
| 11 | **Recuperação de pagamento falho + mix Pix/cartão no tempo** | quantos FAILED viram PAID; evolução do mix (afeta taxas) · `Payment` | ✅〰️ |
| 12 | **Efetividade da notificação "crédito baixo"** | LOW_CREDIT gerou recompra em N dias? · `Notification` + `Payment` | ✅〰️ |

### 🥉 Tier 3 — backlog / **somente futuramente** (exibir como "Em breve", não implementar agora)

| # | Relatório | Fonte | Status |
|---|---|---|---|
| 13 | **Custo de OTP por canal** (SMS Zenvia × e-mail — SMS custa) | `OtpCode.channel` | ✅ |
| 14 | **Carga de suporte + concessões de crédito por admin** (load operacional / vazamento de cortesias) | `AdminNote` / `ADMIN_GRANT` | ✅ |
| 15 | **Cohort de receita por mês de cadastro** (profundidade analítica) | `User` + `Payment` | ✅〰️ |
| 16 | **Sessões/dispositivos ativos agora** (fácil, valor baixo) | `Session` | ✅ |

---

## 6.2 Catálogo amplo por domínio (referência)

Legenda: ✅ dado existe hoje · ⚙️ requer instrumentação · 〰️ derivável/aproximado

### A. Aquisição & Acesso  *(P0 — os obrigatórios + reforços)*
- ⚙️ R1 Acessos / visitantes únicos
- ✅ R2 Logins de cliente
- ⚙️ R3 Conversão acesso→login
- ✅〰️ **Funil de ativação:** acesso → cadastro → 1º login → 1ª compra → 1ª entrega
- ✅ Novos cadastros por período (`User.createdAt`)

### B. Clientes & Retenção  *(P1 — alto valor, dado já existe)*
- ✅ Clientes ativos vs inativos (com agenda ativa / pedido nos últimos 7–30 dias)
- ✅〰️ **Churn:** agendas desativadas (`Schedule.isActive`), clientes sem pedido há X dias
- ✅〰️ **Cohort de retenção** (recompra ao longo dos meses, via `Payment`/`Order`)
- ✅ **LTV por cliente** (soma `Payment PAID`)
- ✅ Clientes por condomínio · clientes bloqueados

### C. Receita & Financeiro  *(P1 — parte JÁ EXISTE, consolidar)*
- ✅ Receita por período/tipo/condomínio — **já implementado** em [AdminFinancialService](apps/api/src/modules/admin-financial/admin-financial.service.ts) → reaproveitar, não duplicar.
- ✅ Ticket médio · receita por combo
- ✅ Receita por método (Pix vs cartão)
- ✅ **Taxa de aprovação/falha** de pagamento (`Payment.status` PAID/FAILED)
- ✅ **Taxa de estorno** (`Payment REFUNDED`)
- ✅〰️ Receita recorrente estimada (a partir das agendas + consumo)

### D. Créditos  *(P1)*
- ✅ Créditos vendidos vs consumidos (`CreditTransaction` PURCHASE/DELIVERY)
- ✅ **Saldo em circulação / passivo** (soma `User.creditBalance`) — métrica financeira importante
- ✅ Concessões admin (`ADMIN_GRANT`) · expirações (`EXPIRY`) · reembolsos (`REFUND`)

### E. Operação & Entregas  *(P1/P2)*
- ✅ **Taxa de entrega** (DELIVERED / total) · não entregues + motivos (`failureReason`)
- ✅ Cancelamentos + motivos (`cancelReason`)
- ✅ Tempo de separação e de entrega (`separatedAt`, `deliveredAt`)
- ✅ Volume de pães por dia / condomínio / turno (`slotId`)
- ✅ Carga por entregador (`DeliveryList.courierId`)

### F. Suprimentos & Margem  *(P2)*
- ✅ Pedidos a fornecedores: quantidade e custo (`PurchaseOrder`/`PurchaseOrderItem`)
- ✅ Custo por fornecedor · custo unitário médio
- ✅〰️ **Margem** (receita − custo de pães) — cruzamento aproximado

### G. Engajamento  *(P3 — secundário)*
- ✅ Notificações enviadas por tipo · taxa de leitura (`Notification.isRead`)

---

## 7. Arquitetura proposta (backend)

```
apps/api/src/modules/
├── analytics/                 # NOVO — ingestão de eventos (público)
│   ├── analytics.controller.ts
│   ├── analytics.service.ts
│   └── analytics.route.ts     # POST /analytics/event
└── admin-reports/             # NOVO — agregações para o admin
    ├── admin-reports.controller.ts
    ├── admin-reports.service.ts   # reaproveita getDateRange (BRT) do financial
    └── admin-reports.route.ts     # GET /admin/reports/{access|customers|credits|delivery}
```

- **Reaproveitar** o tratamento de timezone BRT (`getDateRange`) de `AdminFinancialService`
  — recomendo extrair para um util compartilhado (`lib/date-range.ts`).
- **Reaproveitar** o padrão `$runCommandRaw` + `$lookup` já usado para quebras por condomínio.
- **Reaproveitar** `AdminFinancialService.getRevenue()` dentro de admin-reports (não reescrever financeiro).

## 8. Arquitetura proposta (frontend)

- `AdminRelatorios.tsx` como **hub** de seções (ou sub-páginas no mesmo padrão de Gestão):
  Aquisição · Clientes · Financeiro · Operação.
- Reusar `SegmentedControl` (dia/semana/mês), `KpiCard`, `BarChart`, `Toast`, `apiFetch`.
- Hook `useAccessBeacon()` montado no topo da árvore para emitir o evento de acesso.
- **Tier 3 ("Em breve"):** renderizar os cards (#13–#16) em estado **desabilitado** com selo
  "Em breve" (ex.: opacidade reduzida + pill `var(--color-gold)`), sem rota/ação — sinaliza o
  roadmap ao admin sem implementar o backend ainda.

---

## 9. Roadmap por fases

| Fase | Entrega | Esforço |
|---|---|---|
| **0** | Item "Relatórios" no menu + tela placeholder | XS |
| **1** | Instrumentação de acesso: modelo `AnalyticsEvent`, `POST /analytics/event`, beacon no frontend, evento de login | M |
| **2** | Endpoint `GET /admin/reports/access` + tela R1/R2/R3 (acessos, logins, conversão) — **entrega os 3 obrigatórios** | M |
| **3** | **Tier 1** (#1–#6: recarga automática, churn por esgotamento, recompra/autonomia, funil de ativação, passivo de crédito, ranking de condomínios) — só dado existente | M/L |
| **4** | **Tier 2** (#7–#12: acurácia pedido×entregue, pontualidade, perfil da agenda, único×recorrente, recuperação de pagamento, efetividade LOW_CREDIT) + export CSV e rollup diário (`plugins/cron.ts`) | L |
| **Futuro** | **Tier 3** (#13–#16) — cards visíveis na tela com selo **"Em breve"** (desabilitados), implementados depois | — |

> Fases 0–2 satisfazem o pedido obrigatório. Fases 3–4 entregam o maior valor com dado que
> **já existe** (sem nova instrumentação). Tier 3 permanece no backlog, visível como "Em breve".

---

## 10. Decisões em aberto (recomendações)

1. **Conversão como funil real (visitorId) ou razão agregada?** → **Recomendo funil real**
   (stream único `AnalyticsEvent`), custo marginal baixo.
2. **Evento de login: frontend ou server-side?** → **Frontend** na v1 (simples); migrar para
   server-side se precisar de robustez antifraude.
3. **Provedor externo (Plausible/Umami) vs custom?** → **Custom**, alinhado às constraints
   do projeto (stack própria, self-hosted, sem custo) e porque os demais relatórios já vivem no banco.
4. **Retenção de eventos brutos:** TTL 90–180 dias + rollup diário. Confirmar volume aceitável.
5. **Ícone do menu:** `doc` (sugerido) — confirmar preferência visual.
