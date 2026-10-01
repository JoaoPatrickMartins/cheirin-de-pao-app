# Plano — Melhorias do app do Entregador

> 📝 **Status:** PLANEJADO em 01/10/2026 — nada implementado, nada commitado. Branch de referência
> `feat/add-complementocliente`. Execução direta, **sem GSD** (padrão das features anteriores).
>
> **Entradas:**
> - [`levantamento-app-entregador.md`](./levantamento-app-entregador.md) — diagnóstico (G-1…G-19)
>   e **decisões confirmadas na §10**;
> - [`../brief-telas-app-entregador.md`](../brief-telas-app-entregador.md) — brief do Claude Design;
> - [`../design_handoff_app_entregador/`](../design_handoff_app_entregador/README.md) — handoff
>   (jsx + 28 prints). O `.md` do designer não veio na exportação; o README foi montado a partir do
>   código.
>
> **Regra do handoff** (usuário, 28/09/2026): o que é novo da feature segue o handoff por inteiro.
> Mudança que o handoff faz em tela **existente** só entra se for **só de front**, sem alterar
> funcionalidade. As exceções estão listadas na §2.

---

## 0. Escopo

**Uma versão só**, executada em ondas (§7). Entra tudo o que a §10 do levantamento aprovou:

| Frente | Itens |
|---|---|
| Scanner | iPhone (polyfill), pop-up de ~3 s, digitar código, escanear próximo, lanterna, bipe/vibração |
| Comprovante | foto na entrega e na não entrega (obrigatoriedade **por entregador**), cliente vê (toggle global), 90 dias |
| Não entrega | motivos padronizados, reportar problema, correção pelo admin |
| Sinal fraco | fila offline (confirmação, não entrega, foto, recado, ocorrência) |
| Rota | base de saída, rota por turno, sugestão → aceite do admin → rota salva, reordenar no dia (se liberado), iniciar/encerrar, navegar, você está aqui, hora prevista, mapa ao vivo no admin, tela acesa |
| Cliente | "Saiu para entrega" só após iniciar rota (**com push**), entregador com foto + primeiro nome, foto da entrega, recados (com opt-out) |
| Pessoas | perfil (só leitura), crachá digital, minha escala, meus números, meus ganhos |
| Admin | cadastro ampliado (foto, veículo, regras, pagamento, disponibilidade, crachá), rota do entregador, Rotas e comprovante, acesso do condomínio, gancho na rota, pagamentos, relatório de combustível, notificações novas |
| Correções | G-4, G-5, G-7, G-8, G-10, G-11, G-13, G-14, G-17, G-18, G-19 (M-1, M-3, M-6, M-7, M-8, M-9, M-12, M-13) |

**Fora:** conferência de carga (F-2), instruções do cliente (F-4), tema escuro (F-12), hodômetro,
abastecimentos, GPS para km, navegação curva a curva dentro do app, desfazer confirmação pelo
entregador.

---

## 1. Decisões

### 1.1 Confirmadas antes do design

Ver a **§10 do levantamento** (D-1 … D-14, F-1 … F-13, M-2/M-4/M-5/M-10). Resumo do que muda a
implementação:

- **Foto:** obrigatória + sobe depois. Dois toggles **por entregador** ("na entrega", "na não
  entrega"). Sem obrigatoriedade, o entregador vê "Pular". O cliente vê a foto se o toggle global
  estiver ligado. Retenção de 90 dias.
- **Rota:**
  - o sistema sugere a melhor rota ao admin, que aceita, e ela fica salva por entregador/turno;
  - prédio novo gera uma nova sugestão;
  - o admin libera por entregador o "reordenar", que vale só no dia;
  - partida da base, com opção de GPS;
  - o cliente só vê "a caminho" depois de "Iniciar rota".
- **Combustível:** km **só estimado** pela rota, preço **só global**. Proposta passa por revisão do
  admin (aprovar / editar / descartar).
- **Pagamento:** modalidade no cadastro (**por entrega · por rota · semanal fixo**), mais o
  combustível pago ao entregador, com valor final definido pelo admin.
- **Definido pelo admin:** foto, veículo, consumo, disponibilidade/folgas, permissões (reordenar,
  recados). O entregador só vê.
- **Gancho na rota:** o admin decide gancho a gancho. Sem decisão, o gancho fica na fila.

### 1.2 Confirmadas na conferência do handoff (01/10/2026)

| # | Decisão |
|---|---|
| H-1 ✅ | **"Saiu para entrega" com push.** Ao iniciar a rota, cada cliente da rota recebe push + item na central + a timeline acende. Depois vem o push de "Entregue" de sempre |
| H-2 ✅ | **"Marcar não entregue" só corrige o status** (entregue → não entregue) de uma entrega reportada. **Não avisa o cliente, não mexe em pãezins** e não desfaz Indique e Ganhe. O admin trata o resto por fora |
| H-3 ✅ | **Crachá:** número **sequencial automático** + **validade** definida pelo admin no cadastro. Vencido, o crachá aparece como inativo |
| H-4 ✅ | **"Falar com a operação"** usa o **mesmo WhatsApp do suporte** (`VITE_SUPPORT_WHATSAPP`, `lib/support.ts`). Sem tela de configuração |

### 1.3 Decisões técnicas (minhas, sem impacto de produto)

| # | Decisão | Motivo |
|---|---|---|
| T-1 | **Código curto do cupom passa de 4 para 6 caracteres** (6 últimos hex do id, maiúsculos), como no design. A busca aceita **4 ou 6**, para valer o cupom já impresso no dia da virada, e procura **só entre as paradas de hoje do próprio entregador**. Se o código casar com mais de uma parada, devolve a lista para o entregador escolher | Com 4 hex há ~7,5% de chance de colisão numa rota de 100 paradas. Com 6, a chance some |
| T-2 | **Leitor:** polyfill `barcode-detector` (zxing-cpp em WASM), carregado **só quando não há `BarcodeDetector` nativo**. O `.wasm` é servido pelo próprio app e entra no precache do PWA | O iPhone não tem `BarcodeDetector`. O código atual fica igual |
| T-3 | **Foto pela mesma câmera:** captura do quadro do `MediaStream` do scanner num `<canvas>` → JPEG ~1280 px, compressão com `browser-image-compression` (já instalado). Sem `getUserMedia`, cai em `<input type="file" accept="image/*" capture="environment">` | Mantém o fluxo contínuo; o `input` exige toque e quebraria o auto-avanço |
| T-4 | **Fotos de entrega privadas:** pasta `deliveries/` sem URL pública. Leitura por **URL assinada** de 10 min (`@aws-sdk/s3-request-presigner`, dependência nova), gerada só para o cliente dono do pedido e para o admin | A foto mostra a porta de uma residência (LGPD) |
| T-5 | **Retenção de 90 dias:** regra de ciclo de vida no bucket para o prefixo `deliveries/` (passo manual de infra, §8). Além disso, o app trata como **expirada** qualquer foto com mais de 90 dias, mesmo que o objeto ainda exista | Não depender só da infra |
| T-6 | **Foto do entregador** (avatar/crachá): pasta pública `couriers/`, com chave aleatória como as de produto | É feita para ser mostrada ao cliente |
| T-7 | **Fila offline** em IndexedDB (wrapper próprio, sem dependência). Cada operação leva um `clientOpId` (uuid) e um `occurredAt`. O reenvio roda ao voltar o sinal, ao reabrir o app e a cada 30 s com o app aberto (o iPhone não tem Background Sync). O servidor é **idempotente**: repetir confirmação/não entrega do **mesmo entregador** para o mesmo desfecho devolve sucesso, e a foto substitui a anterior. `deliveredAt`/`failedAt` passam a ser o `occurredAt`, limitado a [início do dia BRT, agora] | O corredor sem sinal é o cenário normal |
| T-8 | **Motor de rota:** OSRM `/table` (matriz de duração/distância entre base e prédios) + ordenação no servidor: permutação exata até 8 prédios, vizinho mais próximo + 2-opt acima disso. Uma rota por turno. Geometria por `/route` na ordem escolhida. Cache por (conjunto de prédios, ordem). Continua no OSRM público (D-8); com a rota salva, as chamadas caem para poucas por dia | `/trip` não aceita início e fim livres |
| T-9 | **Posição ao vivo:** com a rota iniciada e o app aberto, o app manda a posição a cada 60 s (`watchPosition` com throttle). O servidor guarda **só a última** (sem trilha). O admin consulta a cada 30 s na aba Entregas | Privacidade + custo |
| T-10 | **Chegada ao prédio:** calculada no aparelho (≤ 80 m do lat/lng do condomínio) | Sem servidor |
| T-11 | **App de mapas preferido** guardado em `localStorage` (é por aparelho) | Não precisa de backend |
| T-12 | **Semana de pagamento:** segunda a domingo (BRT). A proposta da semana fechada é **materializada de forma preguiçosa** ao abrir a tela de Pagamentos (mesma filosofia de `ExpenseRecurrence`), e o cron avisa o admin na segunda de manhã ("Pagamento a aprovar"). A semana em andamento é só estimativa, não gravada | Evita cron crítico que falha em silêncio |
| T-13 | **Unidade de pagamento:** "por entrega" conta **paradas entregues** (pão + Cestinha do mesmo cliente/turno = 1). "Por rota" conta **turnos encerrados** (`CourierRun` ENDED). "Semanal fixo" = valor fixo | Igual ao que o entregador vê e à unidade de parada da operação (D-5 da Cestinha) |
| T-14 | **Combustível estimado** = Σ km estimado das rotas encerradas ÷ km/l × preço do litro. Para **flex**, usa o preço da gasolina | Conservador |
| T-15 | **Despesas do pagamento:** ao aprovar, cria até 2 `Expense` (categorias `Entregador` e `Combustível`, `payee` = nome do entregador, competência = mês do último dia da semana, `PAID` com `paidAt` + forma, ou `PENDING` com `dueDate`). Mês com `FinancialClose` fechado bloqueia com mensagem para reabrir | Reaproveita o financeiro existente |
| T-16 | **Recados:** modelos fixos no `packages/shared`, sem texto livre. No máximo 1 envio por modelo por parada por dia | Evita spam de madrugada |
| T-17 | **Método da confirmação** (`SCAN` · `CODE` · `LIST`) gravado no pedido. O A1 mostra "pelo scan" | Auditoria |

---

## 2. Conferência do handoff × decisões

O handoff cobre **todas** as telas pedidas (E1–E18, A1–A10, C1–C3) com os estados do brief, e
segue as decisões da §10. Divergências e acréscimos:

| # | Onde | O que o handoff faz | Tratamento |
|---|---|---|---|
| V-1 | E3, cupom | Código de **6** caracteres (`#A7K2QX`); o app hoje imprime 4 hex | Segue o handoff (T-1) |
| V-2 | Hub Gestão (A5) | Redesenha o hub como **grade 2×3 com 6 cards** | ❌ O redesenho do hub não entra (é uma tela existente com 17 itens). Entra só o **card novo "Rotas e comprovante"**, no estilo atual, e a descrição do card Entregadores passa a "Cadastro, regras, escala e pagamentos" com badge de propostas pendentes |
| V-3 | C3 Perfil › Notificações | 5 toggles por categoria (saiu/entregue, recados, créditos, lembretes, novidades) | ❌ Os toggles por categoria são funcionalidade nova numa tela existente. Entra **só "Recados do entregador"**, ao lado do toggle de push que já existe |
| V-4 | A6 Condomínio | O formulário ganha abas **Dados · Blocos · Acesso** | ✅ É só front: entra |
| V-5 | A2 Entregas | Card "Divisão de amanhã" com entregador **de folga** fora da sugestão | ✅ A exclusão da folga é decisão (F-8). No front, só o selo "de folga" e "fora da sugestão" no card de divisão que já existe |
| V-6 | E12 | Mostra horário da operação ("04:30–20:00") | ❌ Sem configuração nova (H-4): mostra só "WhatsApp da operação" |
| V-7 | Ícones | `box` é usado (motivo "Sem lugar para deixar", "Pedido faltando", aba Separação) mas não foi desenhado | Desenhar `box` no mesmo traço (caixa 24×24) junto dos 21 novos |
| V-8 | E2 negada | Botão "Abrir ajustes" | Um PWA não abre os ajustes do sistema. Vira **"Tentar de novo"**, mantendo os 3 passos escritos |
| V-9 | A1 reportado | Botões "Marcar não entregue" / "Manter entregue" | Comportamento de H-2 |
| V-10 | E15 crachá | "Nº 0427", "Válido até", veículo, "Hoje · Manhã · Jardins e mais 3" | Nº/validade conforme H-3. **Campo novo de validade no A3** (seção Dados), que o handoff não desenhou: data com padrão 31/12 do ano |
| V-11 | C1/C3 | Notificação "Saiu para entrega · Acompanhar" | Comportamento de H-1 (tipo novo `DELIVERY_OUT`) |
| V-12 | E8 | "saída {hora do turno}" no card do turno | O horário mostrado é o **horário de entrega do turno** (é o que existe). O texto vira "entrega {hora}" |
| V-13 | E1/E9 | ETA dos prédios antes da hora de entrega do turno no mock (05:25 × 06:30) | Só mock. A hora prevista real segue T-8 + tempo por porta, a partir do início da rota (ou de agora, se não iniciada) |
| V-14 | Mapas | Tiles Esri no protótipo | Tiles do OSM, como hoje (`CourierMap`) |
| V-15 | A3 | Switch de ativo direto na lista | Já existe (`/admin/couriers/:id/toggle`): mantém |
| V-16 | C1 | Hero "4 pãezinhos · Residencial Jardins · Bloco 1 · Apto 101" | Ajustes visuais no hero existente entram (só front). Card do entregador e comprovante são novos |
| V-17 | A3 novo entregador | No mock, os 4 toggles de regras nascem desligados | Padrão do cadastro novo **e** de quem não tem a chave: **foto obrigatória ligada** (entrega e não entrega), **reordenar e recados desligados**. Comprovante por padrão; o resto é liberado caso a caso |
| V-18 | C3 / §6 | A central mostra um "Seu pãozin chegou!" por entrega | Hoje, parada com pão + Cestinha gera **dois** `DELIVERY_DONE`. Passa a gerar **um** (o do pão, citando a Cestinha). Muda comportamento existente; dá para vetar e manter os dois |

**Pontas soltas do design resolvidas aqui:** E4 "gancho" não avança sozinho até a resposta · os
erros da E4 nunca avançam · na E5 a lanterna também aparece no modo foto · "Puxe para atualizar"
é gesto + botão no fim da lista · no E10 o "Encerrar" fica desabilitado até resolver as pendências
(sem "justificar") · no A4 o "Ajustar" recalcula km/tempo ao soltar.

---

## 3. Modelo de dados

> **Armadilhas do Mongo que valem para tudo abaixo** (já documentadas no schema):
> - todo campo novo em modelo existente é **opcional**: documento antigo não tem a chave. Ler
>   sempre com `select` + `?? padrão` e **nunca** filtrar por `null`;
> - único só em campo que **sempre** é gravado. Único em campo opcional vai como **índice parcial**
>   em `lib/ensure-indexes.ts`, nunca como `@@unique` (o `db push` criaria um único comum e os
>   documentos sem a chave colidiriam);
> - o `fast-json-stringify` **descarta** propriedade de resposta não declarada no JSON schema da
>   rota. Todo campo novo de resposta precisa entrar no schema.

### 3.1 Campos novos em modelos existentes

| Modelo | Campo | Tipo | Para quê |
|---|---|---|---|
| `User` (COURIER) | `courierPhotoUrl` | `String?` | Foto do crachá / avatar (pasta pública `couriers/`, T-6) |
| | `courierVehicle` | `Json?` | `{ tipo: 'MOTO'\|'CARRO'\|'BIKE'\|'A_PE', modelo?, placa?, combustivel?: 'GASOLINA'\|'ETANOL'\|'FLEX', kmPorLitro? }` |
| | `courierRules` | `Json?` | `{ fotoEntrega, fotoNaoEntrega, podeReordenar, podeRecados }`. **Ausente** = `{ true, true, false, false }` (V-17) |
| | `courierPay` | `Json?` | `{ modalidade: 'PER_DELIVERY'\|'PER_ROUTE'\|'WEEKLY_FIXED', valor, pagaCombustivel }`. Ausente = "sem modalidade" |
| | `courierAvailability` | `Json?` | `{ dias: ['seg'…'dom'], turnos: [slotId] }`. **Ausente = todos os dias e turnos** (comportamento de hoje) |
| | `badgeNumber` | `Int?` | Nº do crachá, sequencial (H-3). **Único parcial** em `ensure-indexes` (`$type: 'int'`) |
| | `badgeValidUntil` | `DateTime?` | Validade do crachá (H-3) |
| `User` (CLIENT) | `courierMessagesOff` | `Boolean?` | Opt-out dos recados (ausente = recebe) |
| `Order` e `MarketOrder` | `failureCode` | `String?` | Motivo padronizado (lista no `shared`). `failureReason` continua para o texto livre |
| | `confirmedVia` | `String?` | `'SCAN'\|'CODE'\|'LIST'` (T-17) |
| | `correctedAt`, `correctedById`, `correctionNote` | `DateTime?`, `String? @db.ObjectId`, `String?` | Correção entregue → não entregue (H-2) |
| `Condominium` | `courierAccess` | `Json?` | `{ portaria?, temPorteiro?, portao?, parar?, obs?, fotoUrl? }` (foto em pasta pública `condos/`) |
| `HookRequest` | `routeDate`, `routeSlotId`, `routeCourierId` | `String?` ×2, `String? @db.ObjectId` | Gancho enviado na rota (F-5). O `routeCourierId` é preenchido no despacho |
| | `routeFailedAt`, `deliveredVia` | `DateTime?`, `String?` | "Ficou para outro dia" (volta para a fila); `'ADMIN'\|'COURIER'` |

### 3.2 Modelos novos

```prisma
// Comprovante de UMA parada (cliente + condomínio + turno + dia) num desfecho.
// Uma parada combinada (pão + Cestinha) tem um comprovante só.
model DeliveryProof {
  id            String    @id @default(auto()) @map("_id") @db.ObjectId
  courierId     String    @db.ObjectId
  userId        String    @db.ObjectId
  condominiumId String    @db.ObjectId
  slotId        String
  date          String    // "YYYY-MM-DD" BRT
  orderId       String?   @db.ObjectId   // pão da parada (quando há)
  marketOrderIds String[] @db.ObjectId
  outcome       String    // 'DELIVERED' | 'NOT_DELIVERED'
  required      Boolean   // snapshot da regra do entregador no desfecho
  status        String    // 'PENDING' | 'OK' | 'NONE' (exceção, com motivo) | 'SKIPPED' (opcional, pulou)
  photoKey      String?   // chave S3 privada (T-4)
  photoAt       DateTime?
  note          String?   // motivo da exceção "sem foto"
  confirmedVia  String?
  lastClientOpId String?  // idempotência da fila offline (T-7)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([courierId, userId, slotId, date, outcome])
  @@index([orderId])
  @@index([date, status])
}

// Uma rota de um turno num dia. Nasce ao reordenar (PLANNED) ou ao iniciar (STARTED).
model CourierRun {
  id             String    @id @default(auto()) @map("_id") @db.ObjectId
  courierId      String    @db.ObjectId
  date           String    // "YYYY-MM-DD" BRT
  slotId         String
  status         String    // 'PLANNED' | 'STARTED' | 'ENDED'
  condominiumIds String[]  @db.ObjectId   // ordem usada no dia
  reordered      Boolean   @default(false) // o entregador mudou a ordem hoje
  startedAt      DateTime?
  endedAt        DateTime?
  startMode      String?   // 'BASE' | 'GPS'
  startLat       Float?
  startLng       Float?
  plannedKm      Float?
  plannedMin     Int?
  lastLat        Float?    // só a última posição (T-9)
  lastLng        Float?
  lastPosAt      DateTime?
  kmPerLiter     Float?    // snapshot no encerramento
  fuelPrice      Float?
  fuelEstimate   Float?
  summary        Json?     // { entregues, naoEntregues, paes, cestinhas, ganchos } no encerramento
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@unique([courierId, date, slotId])
  @@index([date, status])
}

// Rota salva de um entregador num turno + a sugestão pendente (D-5).
model CourierRouteTemplate {
  id             String    @id @default(auto()) @map("_id") @db.ObjectId
  courierId      String    @db.ObjectId
  slotId         String
  condominiumIds String[]  @db.ObjectId
  km             Float?
  durationMin    Int?
  acceptedAt     DateTime?
  acceptedById   String?   @db.ObjectId
  suggestion     Json?     // { condominiumIds, km, durationMin, reason, newIds, removedIds, createdAt } | null
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@unique([courierId, slotId])
}

model CourierTimeOff {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  courierId   String   @db.ObjectId
  startDate   String   // "YYYY-MM-DD"
  endDate     String
  reason      String?
  createdById String   @db.ObjectId
  createdAt   DateTime @default(now())

  @@index([courierId, startDate])
}

// Proposta de pagamento semanal (T-12 … T-15).
model CourierPayout {
  id                String    @id @default(auto()) @map("_id") @db.ObjectId
  courierId         String    @db.ObjectId
  weekStart         String    // "YYYY-MM-DD" (segunda, BRT)
  weekEnd           String
  payMode           String?   // snapshot da modalidade (null = sem modalidade)
  payAmount         Float?
  units             Int       // entregas ou rotas contadas
  remunerationEst   Float
  kmEst             Float
  fuelEst           Float     // 0 sem consumo ou sem preço
  fuelBasis         Json?     // { kmPorLitro, preco, combustivel }
  remunerationFinal Float?
  fuelFinal         Float?
  adjustReason      String?
  status            String    // 'PENDING' | 'EDITED' | 'APPROVED' | 'DISCARDED'
  discardReason     String?
  approvedAt        DateTime?
  approvedById      String?   @db.ObjectId
  paidAt            DateTime?
  dueDate           DateTime?
  paymentMethod     String?
  expenseIds        String[]  @db.ObjectId
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@unique([courierId, weekStart])
  @@index([weekStart, status])
}

// Problema numa entrega realizada (E11) ou ocorrência geral (E12).
model CourierReport {
  id            String    @id @default(auto()) @map("_id") @db.ObjectId
  kind          String    // 'STOP_ISSUE' | 'INCIDENT'
  courierId     String    @db.ObjectId
  orderId       String?   @db.ObjectId
  marketOrderId String?   @db.ObjectId
  type          String    // lista do shared (por kind)
  text          String?
  photoUrl      String?
  status        String    // 'OPEN' | 'RESOLVED'
  resolution    String?   // 'KEPT' | 'CORRECTED' | texto
  resolvedAt    DateTime?
  resolvedById  String?   @db.ObjectId
  clientOpId    String?   // único PARCIAL em ensure-indexes (fila offline)
  createdAt     DateTime  @default(now())

  @@index([status, createdAt])
  @@index([orderId])
}

model CondoAccessSuggestion {
  id            String    @id @default(auto()) @map("_id") @db.ObjectId
  condominiumId String    @db.ObjectId
  courierId     String    @db.ObjectId
  field         String    // 'PORTARIA' | 'PORTAO' | 'PARAR' | 'OUTRO'
  text          String
  status        String    // 'PENDING' | 'APPLIED' | 'DISCARDED'
  reviewedAt    DateTime?
  reviewedById  String?   @db.ObjectId
  createdAt     DateTime  @default(now())

  @@index([condominiumId, status])
}

model CourierMessage {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  courierId  String   @db.ObjectId
  userId     String   @db.ObjectId
  date       String   // "YYYY-MM-DD"
  template   String   // chave do modelo (shared)
  sentAt     DateTime @default(now())

  @@unique([courierId, userId, date, template]) // T-16: 1 por modelo/parada/dia
}
```

### 3.3 Enums e configurações

- **`NotificationType`** ganha:
  - cliente: `DELIVERY_OUT` (H-1) e `COURIER_MESSAGE`;
  - admin: `ADMIN_COURIER_ISSUE`, `ADMIN_COURIER_INCIDENT`, `ADMIN_CONDO_ACCESS_SUGGESTION`,
    `ADMIN_ROUTE_SUGGESTION` e `ADMIN_PAYOUT_PENDING`.

  Os tipos de admin entram em `ADMIN_NOTIFICATION_TYPES` (api), `NOTIF_ITEMS` (web) e
  `AdminNotificationsScreen` (`getIcon`/`getTone`). Nenhum nasce desligado (o design desenha
  "Sugestão de acesso" desligado só como exemplo de toggle).
- **`Setting`** (strings, padrão `referral-config`: mapa de chaves + defaults + leitor com
  `findMany` + seed `upsert … update:{}`), em `lib/route-config.ts`:

  | Chave | Padrão | Uso |
  |---|---|---|
  | `rotaBaseEndereco`, `rotaBaseLat`, `rotaBaseLng` | vazio | Base de saída (A5) |
  | `rotaVoltaBase` | `true` | Volta à base conta no km |
  | `rotaMinPorPorta` | `1` | Hora prevista |
  | `combustivelGasolina`, `combustivelEtanol`, `combustivelAtualizadoEm` | vazio | Preço do litro (sem preço = sem cálculo) |
  | `fotoClienteVisivel` | `true` | Cliente vê a foto (D-4) |
  | `courierBadgeSeq` | `0` | Sequência do nº do crachá (incremento atômico) |

- **`packages/shared/src/courier.ts`** (novo, com testes), com tudo o que é listado nos dois
  lados:
  - `FAILURE_CODES` com rótulo do entregador e texto para o cliente (`MOTIVOS_CLIENTE` do
    design);
  - `NO_PHOTO_REASONS`, `STOP_ISSUE_TYPES`, `INCIDENT_TYPES`, `RECADO_TEMPLATES`, `PAY_MODES`,
    `VEHICLE_TYPES`;
  - `PROOF_RETENTION_DAYS = 90`;
  - `stopShortCode(id, len = 6)`, `matchesStopCode(code, id)` (aceita 4 ou 6);
  - `estimateFuel(km, kmPorLitro, preco)`;
  - funções puras do pagamento (`payoutUnits`, `payoutRemuneration`).

---

## 4. API

### 4.1 Entregador (`modules/courier`, todas com `authenticate` + `requireCourier`)

| Método · rota | O que muda / faz |
|---|---|
| `GET /courier/orders/today` | **Reescrito por dentro:** consultas em lote (M-3) e **uma rota por turno** (G-7).<br>• Por parada: `shortCode`, `isFirstOrder`, `hasHook`, `hookToDeliver { id }`, `proof { status }`, `completedAt`, `failureCode`.<br>• Por prédio: `access`, `eta`.<br>• Por turno, `routes[]`: `{ slotId, label, emoji, time, state, run { id, startedAt, endedAt }, condominiumIds, plannedKm, plannedMin, geometry, reorderedToday }`.<br>• Também `rules` (do entregador) e `base`.<br>A rota sai da rota salva (T-8); sem rota salva, da sugestão |
| `PATCH /courier/orders/:id/confirm` · `/courier/market-orders/:id/confirm` | Body `{ via, occurredAt?, clientOpId? }`. Responde o **resumo da parada** `{ clientName, condominiumName, block, complement, apartment, quantity, marketItems, isFirstOrder, hasHook, hookToDeliver, deliveredAt, proofRequired }` (corrige G-4).<br>• Repetição com o **mesmo** `clientOpId` → 200, silencioso.<br>• Parada já entregue numa leitura **nova** → **409 com o resumo + `deliveredAt`** (E4 "Já confirmada").<br>• Cria o `DeliveryProof` (PENDING) |
| `PATCH …/not-delivered` | Body `{ failureCode, reason?, occurredAt?, clientOpId? }`. `failureCode` obrigatório; `reason` obrigatório quando `OUTRO` |
| `GET /courier/stops/lookup?code=` | E3: casa 4 ou 6 caracteres **só nas paradas de hoje do entregador** (T-1). Responde `{ matches: [resumo + ids] }`; 0 → 404, mais de 1 → lista |
| `POST /courier/stops/:key/proof` | Multipart (`file`, `outcome`). `key` = `orderId` ou `marketOrderId` da parada. Sobe em `deliveries/` (privado) → `status OK`. Repetir substitui (idempotente). 503 se o storage não estiver configurado (§8) |
| `POST /courier/stops/:key/proof/skip` | `{ outcome, mode: 'NONE'\|'SKIPPED', reason? }`. `SKIPPED` só é aceito quando a regra do entregador não exige foto |
| `POST /courier/hooks/:id/outcome` | `{ delivered: boolean }` → `DELIVERED` (`deliveredVia COURIER`, push `HOOK_DELIVERED` de hoje) ou volta para a fila (`routeFailedAt`) |
| `POST /courier/runs/start` | `{ slotId, startMode, lat?, lng? }` → cria/atualiza o `CourierRun` STARTED. **Dispara `DELIVERY_OUT`** para cada cliente das paradas do turno (H-1, `dedupeKey` usuário+dia+turno) |
| `PUT /courier/runs/order` · `DELETE /courier/runs/order?slotId=` | Reordenar no dia (só com `podeReordenar`, senão 403) / voltar à rota salva |
| `POST /courier/runs/:id/position` | `{ lat, lng }` → guarda só a última (T-9). Só com a rota STARTED |
| `GET /courier/runs/:slotId/summary` | E10: pendências (sem desfecho, sem foto PENDING) + resumo + km/combustível estimados |
| `POST /courier/runs/:id/end` | 422 com a lista de pendências se houver parada sem desfecho ou foto PENDING obrigatória. Senão ENDED com snapshot de combustível |
| `POST /courier/reports` (+ `POST /courier/reports/photo`) | E11 / E12. `clientOpId` idempotente. Notifica `ADMIN_COURIER_ISSUE` / `ADMIN_COURIER_INCIDENT` |
| `POST /courier/condos/:id/access-suggestions` | E7 "Sugerir correção" → `ADMIN_CONDO_ACCESS_SUGGESTION` |
| `POST /courier/messages` | E16: `{ stopKey, template, clientOpId }`. 403 sem `podeRecados`; 409 se o cliente desligou ou se o modelo já foi enviado hoje. Push `COURIER_MESSAGE` ("Antônio: Estou na portaria 🥖") |
| `GET /courier/me` | E14/E15: nome, telefone, foto, desde, veículo, regras, crachá `{ number, validUntil, active }`, resumo do dia |
| `GET /courier/earnings` | E13: modalidade, semana atual estimada (não gravada) + extrato de `CourierPayout` |
| `GET /courier/stats?days=7\|30` | E17 |
| `GET /courier/schedule` | E18: dias/turnos + folgas futuras |

### 4.2 Admin

| Módulo · rota | O que faz |
|---|---|
| `admin-couriers` `GET/POST/PATCH` | Schemas ganham foto, veículo, regras, pagamento, disponibilidade e validade do crachá. O `POST` gera `badgeNumber` (sequência atômica); o boot faz backfill dos entregadores sem número. A lista ganha resumo do veículo/modalidade, "de folga hoje" e "sugestão de rota nova". O toggle passa a checar `res.ok` no web |
| `POST /admin/couriers/photo` | Upload da foto (pasta `couriers/`) |
| `GET/POST/DELETE /admin/couriers/:id/time-offs` | Folgas. Avisa (sem bloquear) quando a folga cai num dia com divisão aprovada (A3 "overlap") |
| `GET /admin/couriers/:id/routes/:slotId` | A4: rota salva + sugestão pendente + alterações do entregador (`CourierRun.reordered`) |
| `POST …/routes/:slotId/accept` · `/keep` · `PUT …/routes/:slotId` · `POST …/routes/:slotId/adopt/:runId` | Usar sugestão · manter a atual (descarta a sugestão) · salvar ordem ajustada · adotar a ordem de um dia |
| `POST /admin/routes/preview` | `{ condominiumIds, slotId }` → km/tempo (o "Ajustar" recalcula ao soltar) |
| `GET /admin/couriers/live` | A2: rotas de hoje com estado, progresso, última posição, previsão de término, "sem foto", "ordem alterada" |
| `GET/PATCH /admin/settings/rotas` | A5 (padrão do `indicacao`: JSON schema + Zod + `$transaction` de upserts) |
| `admin-orders` `getDivisionSuggestion` | Exclui quem está de folga (dia/turno fora da disponibilidade ou com `CourierTimeOff`) e devolve `offCouriers` (V-5) |
| `admin-orders` `approveDivision` | Ao aprovar, compara o conjunto de prédios do dia com a rota salva de cada entregador/turno. Mudou → calcula a sugestão (best-effort, fora da transação) → `ADMIN_ROUTE_SUGGESTION`. Também despacha os ganchos com `routeDate`/`routeSlotId` do dia (`routeCourierId`) |
| `GET /admin/orders/:id` | Ganha `proof { status, url (assinada), at, via, note, outcome, required }`, `issues[]` e `correction`. Atualizar o JSON schema da resposta |
| `POST /admin/orders/:id/correct-not-delivered` | H-2: `DELIVERED → NOT_DELIVERED` só por esta rota, na parada inteira (pão + Cestinha).<br>• Grava `correctedAt/ById/Note`, `failureCode` = `CORRIGIDO_ADMIN`, e fecha o `CourierReport` como `CORRECTED`.<br>• **Sem push, sem crédito, sem mexer em Indique e Ganhe**.<br>• Fica fora do `VALID_TRANSITIONS` geral |
| `POST /admin/courier-reports/:id/resolve` | `{ resolution: 'KEPT' }` ("Manter entregue") |
| `GET /admin/orders/delivery-status` | Ganha contagem de "sem foto". Lista de paradas com filtro `semFoto` para o A2 |
| `admin-condominiums` | `courierAccess` no PATCH, `POST /:id/access-photo`, `GET /:id/access-suggestions`, `POST …/:sid/apply` · `/discard`. **Corrige o bug do `approxLocation`**: o form só manda lat/lng quando o campo foi editado |
| `admin-hooks` | `POST /admin/hook-requests/:id/route { date, slotId }` · `DELETE …/route`. A lista ganha o estado (fila · na rota · entregue pelo entregador · voltou para a fila) |
| Pagamentos | `GET /admin/courier-payouts?week=` (materializa preguiçosamente a semana fechada; a semana corrente vem só estimada) · `PATCH /:id` (editar) · `POST /:id/approve { paid, paidAt?, paymentMethod?, dueDate? }` (cria as `Expense`, T-15) · `POST /:id/discard { reason }` · `GET /admin/courier-payouts/history` |
| Relatórios | `GET /admin/reports/fuel?…` (A9: KPIs, por entregador, economia das rotas aceitas) · `GET /admin/reports/delivery` ganha distribuição por `failureCode` e "sem foto" |

### 4.3 Cliente

| Rota | O que muda |
|---|---|
| `GET /orders/today` · `/orders/next` | Ganham `onTheWayAt` (= `startedAt` da rota do turno, D-7) e `courier { firstName, photoUrl }` **só com a rota iniciada**. Preenche o `courierName`, que hoje é declarado e nunca preenchido. Ganham também `failedAt`, `failureCode` (texto do cliente) e `proof { available, expired }` |
| `GET /orders/history` · `/market/orders/history` | Ganham `failedAt`, texto do motivo e `proof { available, expired }` |
| `GET /orders/:id/proof` · `/market/orders/:id/proof` | URL assinada (10 min), só para o dono, com `fotoClienteVisivel` ligado e até 90 dias |
| `PATCH /client/profile/courier-messages` | `{ off: boolean }` → `courierMessagesOff` |

---

## 5. Front

### 5.1 Entregador (`apps/web/src/pages/courier`, `components/courier`)

| Peça | Arquivo(s) | Tela |
|---|---|---|
| Kit do entregador | `components/courier/kit.tsx` — `CRBig`, `CRIconBtn`, `CRTag`, `CRProof`, `CRCesta`, `CRNote`, `CRToast`, `CRSheet` (com focus trap, como o `RaSheet`), `CRChoice`, `CRTextarea`, `CRSkel`, `CRAvatar`, `CRSync`, `CRDock`, `CRLabel` | Kit |
| Rotas novas | `router.tsx`, filhos de `/courier`: `perfil`, `cracha`, `ganhos`, `numeros`, `escala`, `operacao`, `encerrar/:slotId` | — |
| Tela principal | `CourierScreen.tsx` (refeita):<br>• cabeçalho com avatar → Perfil + botão Crachá; `CRRouteCard` por turno;<br>• dock fixo (scan · start · end · none);<br>• faixas de sincronização e de "entregas novas";<br>• puxar para atualizar + refetch em `visibilitychange` e no deep link (M-1);<br>• folga, vazio e carregando | E1 |
| Prédio e parada | `CondoAccordion.tsx` (bloco **Acesso** + Navegar + Sugerir), `StopRow.tsx` (selos, comprovante, recado, "+ entregar gancho") | E7 |
| Câmera contínua | `components/courier/camera/`:<br>• `CameraSession.tsx`: **um** `MediaStream`, modos scan/foto, lanterna via `applyConstraints({advanced:[{torch}]})` quando `getCapabilities().torch`;<br>• `useQrDetector.ts`: nativo ou polyfill lazy (T-2), lendo só o recorte da moldura;<br>• `ScanOverlay.tsx`, `ResultPopup.tsx`, `PhotoCapture.tsx`, `NoPhotoSheet.tsx`, `CodeSheet.tsx`;<br>• `lib/beep.ts` (Web Audio liberado no toque em "Escanear" + `navigator.vibrate` quando existir) | E2–E5 |
| Confirmar / não entrega | `ConfirmSheet.tsx`, `FailSheet.tsx` (chips do `FAILURE_CODES`). Substituem o `ConfirmDeliveryDialog` (sai do `KNOWN_BROKEN` do teste de tokens) | E6 |
| Rota | `CourierRouteView.tsx` (refeito):<br>• seletor de turno, `NextStopCard`, `StopOrderList` (arrastar com `@dnd-kit` no modo reordenar), centralizar em mim;<br>• `CourierMap.tsx` ganha base, "você está aqui", prédios feitos e "só pontos";<br>• `StartRunSheet.tsx`, `NavAppSheet.tsx`, `lib/navLinks.ts` (Google/Waze/Apple), `hooks/useCourierPosition.ts` (watch + envio a cada 60 s + chegada a 80 m), `hooks/useWakeLock.ts` | E8, E9 |
| Encerrar | `pages/courier/CourierEndRun.tsx` (pendências → resumo → tela celebrativa) | E10 |
| Realizadas | `CourierCompletedList.tsx` (miniatura, selos, Reportar) + `ReportSheet.tsx` | E11 |
| Fila offline | `lib/courierQueue.ts` (IndexedDB, T-7), `hooks/useCourierSync.ts` (reenvio + contagem). Todas as escritas do entregador passam pela fila | Kit · E1 · E4 · E6 · E12 · E16 |
| Perfil e extras | `CourierProfile.tsx` (E14, Sair com confirmação + aviso de pendências), `CourierBadge.tsx` (E15: selo + relógio ao vivo, brilho no máximo não é controlável pelo web → só o aviso), `CourierEarnings.tsx` (E13), `CourierNumbers.tsx` (E17), `CourierSchedule.tsx` (E18), `CourierOps.tsx` (E12, WhatsApp de `lib/support.ts`), `RecadoSheet.tsx` (E16) | E12–E18 |
| Ícones | `components/brand/Icon.tsx`: os 21 novos + `box` (V-7). Aproveitar e aceitar `aria-hidden` no `Icon` (hoje é descartado) | Kit |
| Tokens | `globals.css`: `--color-amber` `#B07A1E`, `--color-amber-soft` `#FBE7C2`, `--color-amber-ink` `#8A5616` (estados "sem sinal"/"já confirmada"). O perigo usa `--color-warn` (= `#B23A2E`). Nada de token novo só com fallback (o teste de tokens barra) | — |

### 5.2 Admin

| Tela | Arquivo(s) |
|---|---|
| A1 Comprovante + reportado + correção (H-2) | `components/admin/OrderDetailSheet.tsx` (seção "Comprovante", visualizador em tela cheia, ações do reportado) |
| A2 Entregas | `pages/admin/tabs/AdminEntregas.tsx` (card Mapa ao vivo com polling de 30 s em `/admin/couriers/live`, cards por rota, chips Todas · Pendentes · Sem foto) + `DeliveryDivisionCard.tsx` (selo "de folga" / "fora da sugestão") |
| A3 Entregadores | `AdminEntregadores.tsx` (lista com modalidade, folga, sugestão, atalho Pagamentos) + `EntregadorForm.tsx` (seções 1–6, foto com `react-easy-crop` redondo, como no `BannerImagePicker`, validade do crachá) |
| A4 Rota do entregador | `pages/admin/gestao/CourierRouteScreen.tsx` (novo, aberto do form e do A2) |
| A5 Rotas e comprovante | `pages/admin/gestao/AdminRotasConfig.tsx` (novo) + item novo no `HUB_ITEMS` do `AdminGestao.tsx` (V-2) |
| A6 Acesso do condomínio | `CondoForm.tsx` (abas Dados · Blocos · Acesso, sugestões) |
| A7 Gancho na rota | `AdminGanchos.tsx` ("Enviar na rota" / "Tirar da rota", estados novos) |
| A8 Pagamentos | `pages/admin/gestao/CourierPayouts.tsx` (novo, aberto de Entregadores; atalho no Financeiro) |
| A9 Combustível & rotas | `pages/admin/gestao/RelCombustivel.tsx` (novo, grupo "Operação & financeiro" do `AdminRelatorios`) |
| A10 Avisos e falhas | `AdminNotificacoes.tsx` (`NOTIF_ITEMS`), `AdminNotificationsScreen.tsx` (ícones/tons), `RelEntregas.tsx` (motivos padronizados + sem foto) |

### 5.3 Cliente

| Tela | Arquivo(s) |
|---|---|
| C1 Acompanhamento | `TrackingScreen.tsx` + `hooks/useOrderTracking.ts`:<br>• timeline acende "Saiu" por `onTheWayAt`;<br>• estado **Não entregue** (hoje cai em "Agendado");<br>• card do entregador com foto + primeiro nome;<br>• hero com ajustes visuais (V-16) |
| C2 Comprovante | Bloco "Comprovante" + `PhotoViewer` (tela cheia, "Fale com o suporte") + botão `camera` no histórico + "foto expirada" |
| C3 Notificações | `NotificationsScreen.tsx`:<br>• `DELIVERY_OUT` ("Acompanhar") e `COURIER_MESSAGE`;<br>• `DELIVERY_DONE` com "Ver foto" quando o `actionRoute` traz o comprovante;<br>• remove o ramo morto `'OUT_FOR_DELIVERY'`.<br>`SettingsScreen.tsx`: toggle **"Recados do entregador"** (V-3) |

---

## 6. Jobs e notificações

- **`daily-jobs`** (um bloco try/catch novo, padrão do arquivo): às segundas, para cada entregador
  com rota encerrada na semana anterior, `notifyAdmins(ADMIN_PAYOUT_PENDING)` com `dedupeKey` da
  semana (T-12).
- **`sendCourierPendingReminders`**: o critério de "já começou" passa a ser **ter rota STARTED
  naquele turno**, além de ter algum desfecho, como hoje.
- **`DELIVERY_OUT`** (H-1): no `POST /courier/runs/start`, um por cliente/turno/dia, só no
  primeiro início. Texto: "Saiu para entrega · {Nome} está a caminho com seus {N} pãezinhos".
- **`DELIVERY_DONE`**: parada combinada passa a gerar **um** aviso só, o de pão. Hoje saem dois
  (pão + Cestinha). O aviso leva `actionRoute` `/client/pedidos?comprovante=<id>` quando a foto é
  visível ao cliente.
- **Sugestão de rota**: calculada ao aprovar a divisão (§4.2). Não tem cron.

---

## 7. Ondas de execução

> **Base de testes** (último registro, `plano-login-social.md`): api **1.719 + 3 todo**, web
> **396 + 17 todo**, shared **82 + 4 todo**. Conferir no início da Onda 0.
> **Toda onda fecha com:** typecheck (api + web + shared) + testes verdes + registro na §10.
> **Nunca commitar sem pedido explícito.**

### Onda 0 — Correções que já valem hoje

1. **M-3:** `getTodayOrders` com consultas em lote (`user.findMany`/`condominium.findMany` por
   `in`). Teste: mesmo retorno com 1 consulta por coleção.
2. **G-7:** rota por turno (provisório até a Onda 5): um OSRM por turno, e a aba Rota escolhe o
   turno.
3. **Cliente:** `SEPARATED` mostra "Agendado" (correto) e **`NOT_DELIVERED` mostra "Não
   entregue"** com o motivo. Pill e timeline.
4. **`CondoForm`:** só mandar lat/lng quando o campo foi editado (bug do `approxLocation`).
5. **`AdminEntregadores`:** o toggle checa `res.ok` e reverte em erro.
6. **M-13:** schema de resposta do `confirm` e a descrição "rota otimizada" corrigidos.
7. **Legado:** remover `CourierRegisterScreen` + rota `/admin/couriers/new` (inalcançáveis; o
   `AdminLayout` não tem `<Outlet/>`). Confirmar antes que `POST /auth/couriers` não tem outro
   uso.

### Onda 1 — Fundação

1. Schema da §3 → `prisma generate` → `db push` no **banco de teste** (liberado; conferir o alvo
   em `apps/api/.env` antes).
2. `ensure-indexes`: únicos parciais de `User.badgeNumber` e `CourierReport.clientOpId`.
3. `packages/shared/src/courier.ts` + testes (códigos, motivos, combustível, pagamento).
4. `lib/route-config.ts` + seed + `GET/PATCH /admin/settings/rotas` + testes de rota.
5. `lib/storage.ts`:
   - pastas `deliveries` (privada, sem `CacheControl` público), `couriers` e `condos`;
   - `getSignedReadUrl(key, 600)` com `@aws-sdk/s3-request-presigner` (dependência nova).
6. `NotificationType` novos + listas de prefs (api/web).
7. Front: ícones, tokens e kit do entregador (`kit.tsx`) com testes de render.

### Onda 2 — Câmera contínua (E2–E4) e conserto do iPhone

1. Dependência `barcode-detector`. O `.wasm` é servido pelo app: configurar o `locateFile` do
   zxing-wasm para o arquivo local e incluir `*.wasm` no precache (`globPatterns`). Conferir no
   build que o arquivo vai para `dist`.
2. `CameraSession` + `useQrDetector` + `ScanOverlay` (permissão, negada → "Tentar de novo" (V-8),
   lendo, lanterna, lido, indisponível).
3. API:
   - confirm com resumo, 409 "já confirmada", `via`, `clientOpId` e `occurredAt` (T-7, T-17);
   - `GET /courier/stops/lookup`;
   - código de **6** caracteres no cupom (`AdminSeparacao.shortCode`, `shortOrderCode`), usando
     `stopShortCode` do shared (T-1).
4. `ResultPopup` (todas as variantes da E4, contagem de 3 s, tocar adianta) + `CodeSheet` (E3) +
   bipe/vibração.
5. E1: dock fixo (modo scan), refetch (M-1), "entregas novas".
6. Testes:
   - api: resumo, 409, idempotência, lookup 4/6/ambíguo;
   - web: `ResultPopup` (avança/não avança), `CodeSheet`, `useQrDetector` com detector mockado.

### Onda 3 — Comprovante e não entrega (E5, E6, A1, C2)

1. `DeliveryProof`:
   - criado no confirm/not-delivered;
   - `POST …/proof` (multipart, 5 MB, jpeg/png/webp) e `…/proof/skip`;
   - regra do entregador (`courierRules`, padrão da §3.1).
2. `PhotoCapture` (canvas do stream + compressão, fallback `input capture`; variantes obrigatória
   e opcional) + `NoPhotoSheet`.
3. `ConfirmSheet` + `FailSheet` (motivos padronizados, "Outro" exige texto, foto em seguida). A API
   grava `failureCode` (M-4).
4. A1: seção "Comprovante" (foto, sem foto, pulada, subindo, não entrega com foto) + visualizador
   com URL assinada.
5. C2: `GET /orders/:id/proof` + bloco "Comprovante" + visualizador + câmera no histórico +
   expirada. Respeita `fotoClienteVisivel`.
6. `DELIVERY_DONE`: um aviso por parada + `actionRoute` do comprovante. "Ver foto" na central do
   cliente.
7. Testes: permissões da foto (dono, admin, outro cliente → 404), regra obrigatória × `SKIPPED`,
   90 dias → expirada, motivo "Outro" sem texto → 400.

### Onda 4 — Fila offline

1. `lib/courierQueue.ts` + `useCourierSync`: operações `confirm`, `notDelivered`, `proof` (blob no
   IndexedDB), `proofSkip`, `hook`, `report`, `message`, `suggestion`. Reenvio em `online`,
   `visibilitychange` e a cada 30 s.
2. Estados de UI: faixa "Sem sinal — N guardadas", "Enviando N…", selos "pendente de envio",
   E4/E6 em modo "guardado".
3. Servidor: `occurredAt` limitado a [início do dia BRT, agora]; respostas idempotentes (T-7).
4. Sair com envios pendentes: aviso forte (E14).
5. Testes: fila (ordem, reenvio, descarte em 4xx definitivo, manutenção em 5xx/rede),
   idempotência no servidor.

### Onda 5 — Rota (E8–E10, A2, A4, A5, C1)

1. `lib/route-engine.ts`: `/table` + ordenação exata (≤ 8) ou vizinho mais próximo + 2-opt; base
   como origem; volta à base opcional; geometria por `/route`; cache. Testes com matriz mockada
   (ordem ótima, 2-opt melhora, sem base, OSRM fora → ordem salva, só pontos).
2. `CourierRouteTemplate`:
   - 1ª sugestão;
   - nova sugestão na aprovação da divisão (`ADMIN_ROUTE_SUGGESTION`, `dedupeKey`);
   - aceitar / manter / ajustar / adotar;
   - enquanto pendente, o dia usa a rota salva + prédio novo na posição sugerida (D-5c).
3. `CourierRun`:
   - iniciar (base/GPS) + `DELIVERY_OUT` (H-1);
   - posição;
   - reordenar no dia (`podeReordenar`);
   - resumo e encerrar com pendências (422);
   - snapshot de combustível (T-14).
4. Front entregador: `StartRunSheet`, rota ativa (próxima parada, navegar + escolha do app,
   você está aqui, chegada, reordenar, só pontos, sem mapa), `CourierEndRun`, wake lock (M-10),
   hora prevista (trajeto + `rotaMinPorPorta`).
5. Admin:
   - A5 (`AdminRotasConfig`: base com busca + pino arrastável, volta à base, tempo por porta,
     preços, cliente vê foto; aviso de storage não configurado);
   - A4 (`CourierRouteScreen`);
   - A2 (mapa ao vivo + cards de rota + "sem foto").
6. Cliente C1: `onTheWayAt`, card do entregador (`courierPhotoUrl` + primeiro nome) e
   "a caminho desde".
7. Lembrete do turno com o critério novo (§6).
8. Testes:
   - api: início dispara `DELIVERY_OUT` uma vez, reordenar sem permissão → 403, encerrar com
     pendência → 422, sugestão só quando o conjunto muda, cliente não vê entregador antes do
     início;
   - web: rota ativa, reordenar, sheet de navegação.

### Onda 6 — Pessoas (A3, E14, E15, E17, E18, F-8)

1. A3: form ampliado (foto, veículo, regras, pagamento, disponibilidade + folgas com aviso de
   sobreposição, validade do crachá) + lista ampliada. API de `admin-couriers` e `time-offs`.
2. `badgeNumber`: sequência atômica + backfill no boot (idempotente).
3. Divisão de entregas sem quem está de folga (`getDivisionSuggestion`) + selos no
   `DeliveryDivisionCard`.
4. Entregador:
   - `GET /courier/me`, `/stats`, `/schedule`;
   - telas E14 (só leitura), E15 (ativo · sem foto · inativo por desativação **ou validade
     vencida**), E17, E18;
   - folga na E1.
5. Testes: folga exclui da sugestão, crachá vencido = inativo, backfill não duplica número.

### Onda 7 — Pagamentos e combustível (A8, A9, E13)

1. Cálculo (funções puras do shared, T-13/T-14), materialização preguiçosa da semana fechada (T-12)
   e endpoints de editar / aprovar (cria `Expense`, respeita `FinancialClose`, T-15) / descartar /
   histórico.
2. A8 (`CourierPayouts`: semana anterior/próxima, propostas, editar, aprovar "pago agora"/"a
   pagar", histórico estimado × pago, "ver despesa") + badge no card de Entregadores.
3. E13 (`CourierEarnings`: as 3 modalidades, sem consumo, sem modalidade).
4. A9 (`RelCombustivel`: KPIs estimados, por entregador, economia das rotas aceitas) — a economia
   compara o km da rota salva antes/depois de cada aceite.
5. Aviso `ADMIN_PAYOUT_PENDING` às segundas.
6. Testes:
   - as três modalidades, flex = gasolina e sem preço = 0;
   - materialização idempotente (não duplica a semana);
   - aprovar cria 2 despesas com competência certa;
   - mês fechado → 409;
   - descartar não cria despesa.

### Onda 8 — Operação e comunicação (E7, E11, E12, E16, A6, A7, A10, C3)

1. Acesso do condomínio:
   - `courierAccess` + foto da entrada;
   - abas no `CondoForm` (V-4);
   - bloco Acesso na E7;
   - sugestões do entregador → A6 aplicar/descartar.
2. Gancho na rota:
   - A7 enviar/tirar da rota;
   - despacho junto da divisão;
   - selo e pergunta na E4/E6;
   - `POST /courier/hooks/:id/outcome`;
   - volta para a fila.
3. Recados: E16 + `COURIER_MESSAGE` + toggle do cliente (`courierMessagesOff`) + regra 1 por
   modelo/dia.
4. Reportar problema (E11) e ocorrência (E12, com foto opcional) → `CourierReport` + avisos ao
   admin.
5. A1 reportado: "Marcar não entregue" (H-2) / "Manter entregue".
6. A10: tipos novos na central e nas preferências; `RelEntregas` com motivos padronizados e
   "sem foto".
7. Testes: recado bloqueado sem permissão, com opt-out ou repetido; correção H-2 não gera push
   nem crédito; gancho "ficou para outro dia" volta para a fila; aplicar sugestão altera
   `courierAccess`.

### Onda 9 — Fechamento

1. **UAT em aparelho real** (roteiro da §9).
2. Textos legais (`content/legal.ts`): foto da entrega (90 dias), localização do entregador só
   durante a rota, recados.
3. Passos de infra da §8.
4. Registro final na §10 (contagem de testes, divergências que surgirem como V-n).

---

## 8. Riscos, infra e pontos de atenção

| # | Risco / passo | Tratamento |
|---|---|---|
| R-1 | **S3 não configurado em produção** (`isStorageConfigured()` falso) quebraria a foto obrigatória | O upload responde 503 e o app marca a parada como "sem foto · armazenamento indisponível" sem travar a entrega. O A5 mostra o aviso "Armazenamento de fotos não configurado". **Conferir as variáveis `S3_*` na VPS antes do deploy** |
| R-2 | **Retenção de 90 dias** depende de uma regra no bucket | **Passo manual:** criar a regra de ciclo de vida para o prefixo `deliveries/` (expirar em 90 dias). O app já trata como expirada (T-5) |
| R-3 | Dependências novas | `@aws-sdk/s3-request-presigner` (api) e `barcode-detector` (web). O `.wasm` (~1 MB) entra no precache, o que aumenta o 1º download do PWA |
| R-4 | iPhone | Precisa de validação em aparelho, porque o comportamento varia por versão:<br>• no PWA instalado, a permissão da câmera pode ser pedida a cada abertura (manter o stream aberto no modo contínuo);<br>• lanterna e wake lock dependem da versão;<br>• sem `vibrate`;<br>• o áudio precisa de toque;<br>• a geolocalização pausa com a tela bloqueada (a posição ao vivo fica "há N min", e o wake lock ajuda) |
| R-5 | OSRM e Nominatim públicos | A rota salva reduz as chamadas a poucas por dia. Falha → ordem salva + "só pontos". OSRM próprio fica para depois (D-8) |
| R-6 | Corrida no confirm offline × admin | `occurredAt` limitado ao dia; desfecho já tomado por outro caminho → 409/422 e a fila descarta com aviso "já resolvida pela operação" |
| R-7 | Privacidade | A posição só é gravada com a rota STARTED e só a última; a foto é privada e assinada; o telefone nunca vai ao entregador. Textos legais na Onda 9 |
| R-8 | Resposta descartada pelo `fast-json-stringify` | Todo campo novo de resposta entra no JSON schema (§3) |
| R-9 | Teste de tokens do web | Tokens novos ficam definidos em `globals.css`, nunca só com fallback |

---

## 9. Roteiro de UAT (aparelho real)

**iPhone:** Safari em aba e PWA instalado. **Android:** Chrome, aba e PWA.

1. Escanear 3 cupons seguidos, sem fechar a câmera, com foto em cada um.
2. Lanterna no corredor escuro.
3. Digitar código de 6 caracteres e de 4 (cupom antigo).
4. Escanear de novo um cupom já confirmado: aparece "já confirmada às HH:MM".
5. Modo avião: confirmar 2 + 1 não entrega com foto. A faixa "guardadas" aparece. Ao tirar do
   modo avião, tudo sobe e aparece no A1.
6. Entregador **sem** foto obrigatória: aparece "Pular"; o A1 mostra "foto pulada".
7. Iniciar rota pela base e por GPS. O cliente recebe o push "Saiu para entrega" e vê o
   entregador. O admin vê a posição no mapa ao vivo.
8. Navegar com Google Maps, Waze e Apple Maps. Voltar ao app e ver a chegada ao prédio.
9. Reordenar no dia: liberado e não liberado.
10. Encerrar com pendência (bloqueia) e sem pendência (tela celebrativa + combustível estimado).
11. Crachá: ativo, sem foto, entregador desativado, validade vencida.
12. Recado: cliente com e sem opt-out.
13. Gancho na rota: "Sim" e "Ficou para outro dia".
14. Pagamento: aprovar "pago agora" e "a pagar" e conferir as 2 despesas no Financeiro. Editar e
    descartar.
15. Tela acesa durante a rota: a tela não apaga em 5 min parada.

---

## 10. Registro de execução

_(vazio — preencher a cada onda: data, o que entrou, contagem de testes, divergências V-n)_
