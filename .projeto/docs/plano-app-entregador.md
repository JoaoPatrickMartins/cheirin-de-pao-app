# Plano — Melhorias do app do Entregador

> 📝 **Status:** ✅ **CÓDIGO CONCLUÍDO (Ondas 0–11)** em 05/10/2026, **SEM COMMIT**. Falta o UAT em
> aparelho real e o deploy, pelo checklist. Planejado em 01/10/2026. Branch de referência
> `feat/add-complementocliente`. Execução direta, **sem GSD** (padrão das features anteriores).
>
> ✅ **Onda 0 (correções) CONCLUÍDA** em 01/10/2026 — **SEM COMMIT**. Detalhes na §10.
> Verificação: typecheck ✅ · api **1.745 + 3 todo** (+9) · web **435 + 17 todo** (+9) · shared
> **82 + 4 todo**.
>
> ✅ **Onda 1 (fundação) CONCLUÍDA** em 01/10/2026 — **SEM COMMIT**. Schema + `db push` no banco de
> teste, índices parciais, `shared/courier.ts`, config de rotas, storage privado, tipos de
> notificação, ícones, tokens e kit do entregador. Verificação: typecheck ✅ · api **1.763 + 3 todo**
> (+18) · web **446 + 17 todo** (+11) · shared **100 + 4 todo** (+18).
>
> ✅ **Onda 2 (câmera contínua + iPhone) CONCLUÍDA** em 01/10/2026 — **SEM COMMIT**. Scanner com
> polyfill, pop-up E4, digitar código, código de 6 caracteres, confirmação com resumo/409/
> idempotência, dock fixo e atualização da lista. Verificação: typecheck ✅ · api **1.789 + 3 todo**
> (+26) · web **472 + 17 todo** (+26) · shared **100 + 4 todo**. **Falta validar em iPhone e Android
> reais** (UAT da Onda 9).
>
> ✅ **Onda 3 (comprovante e não entrega) CONCLUÍDA** em 02/10/2026 — **SEM COMMIT**. Foto na mesma
> câmera (obrigatória/opcional por entregador, "sem foto" com motivo), `ConfirmSheet`/`FailSheet`
> com motivos padronizados, comprovante no detalhe do admin (A1), foto para o cliente (C2) e "Ver
> foto" no aviso (C3). Verificação: typecheck ✅ · `vite build` ✅ · api **1.820 + 3 todo** (+31) ·
> web **501 + 17 todo** (+29) · shared **100 + 4 todo**. **Antes do deploy:** S3 na VPS, regra de
> 90 dias e política do bucket (§8).
>
> ✅ **Onda 4 (fila offline) CONCLUÍDA** em 02/10/2026 — **SEM COMMIT**. Fila em IndexedDB
> (confirmação, não entrega, foto, pular), reenvio automático, "Confirmada · sem sinal", faixa de
> sincronização, rota guardada para abrir sem sinal e aviso ao sair com pendências. Verificação:
> typecheck ✅ · `vite build` ✅ · api **1.821 + 3 todo** (+1) · web **532 + 17 todo** (+31) · shared
> **100 + 4 todo**.
>
> ✅ **Onda 5 (rota) CONCLUÍDA** em 02/10/2026 — **SEM COMMIT**. Motor de rota (OSRM `/table` +
> ordem exata/2-opt), rota salva × sugestão ao admin (A4), iniciar/encerrar com "Saiu para
> entrega" (H-1), aba Rota com navegar/chegada/reordenar, Rotas e comprovante (A5), mapa ao vivo
> (A2) e o "a caminho" do cliente (C1). Verificação: typecheck ✅ · `vite build` ✅ · api **1.878 +
> 3 todo** (+57) · web **559 + 17 todo** (+27) · shared **100 + 4 todo**.
>
> ✅ **Onda 6 (pessoas) CONCLUÍDA** em 02/10/2026 — **SEM COMMIT**. Cadastro ampliado do entregador
> (A3: foto, veículo, regras, pagamento, escala e folgas), nº do crachá automático com backfill,
> divisão sem quem está de folga, perfil (E14), crachá digital (E15), meus números (E17), minha
> escala (E18) e a folga na tela principal. Verificação: typecheck ✅ · `vite build` ✅ · api
> **1.891 + 3 todo** (+13) · web **586 + 17 todo** (+27) · shared **103 + 4 todo** (+3).
>
> ✅ **Onda 7 (pagamentos e combustível) CONCLUÍDA** em 02/10/2026 — **SEM COMMIT**. Proposta semanal
> gerada de forma preguiçosa (A8: editar, aprovar → despesas no Financeiro, descartar, histórico),
> "Meus ganhos" do entregador (E13), relatório Combustível & rotas com a economia das rotas
> aceitas (A9) e o aviso "Pagamento a aprovar" às segundas. Campo novo `acceptLog` na rota salva
> (`db push` no banco de teste). Verificação: typecheck ✅ · `vite build` ✅ · api **1.911 + 3 todo**
> (+20) · web **601 + 17 todo** (+15) · shared **108 + 4 todo** (+5).
>
> ✅ **Onda 8 (operação e comunicação) CONCLUÍDA** em 02/10/2026 — **SEM COMMIT**. Acesso do
> condomínio (A6 + E7, com sugestões do entregador), gancho na rota (A7 + pergunta no E4), recados
> (E16 + switch do cliente), problema numa entrega (E11) e ocorrência com foto (E12), correção
> "Marcar não entregue" (H-2) no A1 e numa tela nova de problemas e ocorrências, motivos
> padronizados e "sem foto" no relatório (A10). Sem mudança de schema. Verificação: typecheck ✅ ·
> `vite build` ✅ · api **1.936 + 3 todo** (+25) · web **633 + 17 todo** (+32) · shared **110 + 4
> todo** (+2).
>
> ✅ **Onda 9 (fechamento) CONCLUÍDA** em 02/10/2026 — **SEM COMMIT**. Textos legais (foto da
> entrega, recados, seção do entregador e linha nos Termos), localização apagada ao encerrar a rota
> e na faxina da meia-noite, foto da ocorrência com 90 dias (`reports/`) e checklist pronto com os
> comandos de infra. Verificação: typecheck ✅ · `vite build` ✅ · api **1.940 + 3 todo** (+4) · web
> **638 + 17 todo** (+5) · shared **110 + 4 todo**. **Falta:** UAT em aparelho real e os passos
> manuais de infra (§8), no checklist.
>
> ✅ **Onda 10 (o que o entregador vê de km e combustível) CONCLUÍDA** em 05/10/2026 — **SEM
> COMMIT**. Três switches no A5 ("O que o entregador vê": Meus números e Fim da rota desligados, Meus
> ganhos também desligado — V-91), filtro no servidor e as quatro telas do entregador. Sem mudança de schema.
> Verificação: typecheck ✅ · `vite build` ✅ · api **1.949 + 3 todo** (+9) · web **644 + 17 todo**
> (+6) · shared **110 + 4 todo**.
>
> ✅ **Onda 11 (crachá v3 + GNV) CONCLUÍDA** em 05/10/2026 — **SEM COMMIT**. Crachá "Cordão" do
> handoff novo (frente/verso, QR e código de 30 s gerados no aparelho, abre sem sinal, vencido e
> desativado), segredo por entregador (`User.badgeSecret`, `db push` no banco de teste) e o GNV
> como combustível próprio em m³ (A5, A3, cálculo, telas e A9). Verificação: typecheck ✅ · `vite
> build` ✅ · api **1.959 + 3 todo** (+10) · web **658 + 17 todo** (+14) · shared **115 + 4 todo**
> (+5).
>
> ✅ **Termo do entregador + aceitar/recusar turno CONCLUÍDO** em 05/10/2026 (sem commit), num plano à
> parte: [`plano-termos-legais.md`](./plano-termos-legais.md). Entra no mesmo deploy. Contagem final:
> api **1.976 + 3 todo** · web **672 + 17 todo** · shared **117 + 4 todo**.
>
> 📋 **Testes e deploy:** tudo o que fazer antes e depois do deploy está em
> [`checklist-deploy-app-entregador.md`](./checklist-deploy-app-entregador.md), ✅ **pronto para
> executar**.
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

### Onda 10 — O que o entregador vê de km e combustível (planejada e concluída em 05/10/2026)

**Pedido do usuário:** o admin escolhe se o entregador vê o km e o combustível estimados. O padrão é
**desligado** nas três telas (Meus ganhos nascia ligado; mudou para desligado em 05/10/2026, V-91). Isso substitui a remoção fixa da V-86:
o resultado padrão em Meus números continua o mesmo (escondido), mas agora o admin pode ligar.

**Decisões do usuário (05/10/2026, passo a passo):**

| # | Decisão |
|---|---|
| H-5 ✅ | **Global**, na tela **Rotas e comprovante** (A5), num bloco novo "O que o entregador vê". Vale para todos os entregadores |
| H-6 ✅ | **Um switch por tela**, e cada um cuida do km e do combustível juntos: **Meus números**, **Fim da rota** e **Meus ganhos**, os três com padrão **desligado** (Meus ganhos era ligado até a V-91) |
| H-7 ✅ | **Meus ganhos desligado:** continua a linha "Combustível ≈ R$ 7,90" dentro do pagamento, para o total fechar. Somem o **km**, a **conta** (km ÷ km/l × preço) e os avisos de **consumo** e **preço** (`SEM_CONSUMO`, `SEM_PRECO`). Os avisos "a operação não paga combustível" (`NAO_PAGA`) e "veículo sem combustível" (`NAO_USA`) continuam, porque explicam por que não há a linha |
| H-8 ✅ | A **distância do trajeto** na rota ("~9,2 km · 70 min" em Iniciar rota, no card da rota e no mapa) **não entra**: é informação para navegar e continua sempre |

**Onde o entregador vê hoje** (levantamento):

| Tela | O que mostra | Switch |
|---|---|---|
| E17 Meus números | KPIs "Km estimado" e "Combustível estimado" (tirados na V-86) | Meus números |
| E10 Fim da rota | 3º número do topo "~9,6 km · estimado" + cartão "~9,6 km · ≈ R$ 1,54" com a conta, ou o aviso "sem consumo/preço/traçado" | Fim da rota |
| E13 Meus ganhos | Linha "Combustível estimado" com a conta, aviso do sem-modalidade com o km, avisos de consumo/preço | Meus ganhos (H-7) |
| E14 Perfil › Meu veículo | Frase "Usado no combustível estimado" sob o consumo | Some quando os 3 estão desligados |
| E8/E9 Rota | Distância do trajeto | Fora (H-8) |

**Fica igual para o admin:** A2, A4, A8 e A9 continuam mostrando tudo. O cálculo não muda: o
encerramento continua congelando o combustível na rota (é o que o A9 e o pagamento usam).

**Decisões técnicas (minhas):**

| # | Decisão | Motivo |
|---|---|---|
| T-18 | Três chaves em `Setting`, no `lib/route-config.ts` (mesmo leitor defensivo): `entregadorVeCombNumeros` (`false`), `entregadorVeCombFimRota` (`false`), `entregadorVeCombGanhos` (`false`, era `true` até a V-91). Entram no `ROUTE_SEED_DEFAULTS`. Chave ausente = padrão | Mesmo padrão do `fotoClienteVisivel` |
| T-19 | No `PATCH /admin/settings/rotas`, os três campos são **opcionais**: ausente mantém o valor gravado | Um A5 antigo em cache no navegador do admin não pode zerar os switches ao salvar a base |
| T-20 | **O servidor filtra** (como na V-86), na saída dos endpoints do entregador. O cálculo continua no serviço. Desligado, o dado **não vai** ao aparelho | O entregador não deve conseguir ler o dado na rede |
| T-21 | Cada resposta leva uma **flag** para o web saber se "escondido" ou "sem cálculo": `fuelVisible` em `/courier/stats` e no resumo/encerramento da rota; `fuelDetailVisible` em `/courier/earnings`; `showFuel` (algum dos 3 ligado) em `/courier/me` | Sem a flag, o web mostraria "sem consumo cadastrado" quando o certo é não mostrar nada |
| T-22 | **Fim da rota desligado:** o 3º número do topo vira a **duração do turno** ("1h 12 · na rua", já vem em `stats.durationMin`), e o cartão/aviso de combustível some | Não deixar um buraco no cabeçalho celebrativo |

**Passos**
1. **API — config:** `RouteConfig` + chaves + seed + `getRouteConfig`/`setRouteConfig` (T-18/T-19);
   zod (`UpdateRouteSettingsSchema`, opcionais) e JSON schema de resposta do `GET/PATCH
   /admin/settings/rotas` (fast-json-stringify).
2. **API — entregador** (T-20/T-21):
   - `/courier/stats`: volta `km`/`fuel` no serviço (desfaz a V-86) e o controller só os envia com
     `entregadorVeCombNumeros`; `fuelVisible` no schema;
   - `/courier/runs/:slotId/summary` e `/courier/runs/:id/end`: com `entregadorVeCombFimRota`
     desligado, `km`, `fuel` e `fuelReason` vão `null`, com `fuelVisible: false`. O
     `CourierRunService.end` continua gravando o snapshot;
   - `/courier/earnings`: com `entregadorVeCombGanhos` desligado, `current.km` vai `null` (schema
     passa a `nullable`), `fuelBasis.kmPorLitro/preco/combustivel` vão `null`, `SEM_CONSUMO`/
     `SEM_PRECO` viram `null`, e `fuel` continua; `fuelDetailVisible: false`;
   - `/courier/me`: `showFuel`.
3. **Web — A5** (`AdminRotasConfig`): seção **"O que o entregador vê"** com 3 switches:
   - "Km e combustível em **Meus números**": "Soma estimada dos últimos 7 e 30 dias.";
   - "Km e combustível no **Fim da rota**": "Estimado do turno, na tela de rota concluída.";
   - "Conta do combustível em **Meus ganhos**": "km ÷ km/l × preço. Desligado, mostra só o valor
     que entra no pagamento.".
4. **Web — entregador:**
   - `CourierNumbers`: KPIs de km/combustível de volta, só com `fuelVisible`;
   - `CourierEndRun`: cabeçalho com a duração (T-22) e sem o cartão/aviso quando `fuelVisible` é
     falso;
   - `CourierEarnings`: com `fuelDetailVisible` falso, linha "Combustível" sem a fórmula, nota do
     sem-modalidade sem o km, sem os avisos de consumo/preço;
   - `CourierProfile`: "Usado no combustível estimado" só com `showFuel`;
   - tipos em `lib/courierApi.ts`.
5. **Testes:**
   - api: leitura com chave ausente (padrões false/false/true); PATCH sem os campos mantém o
     gravado; stats com e sem o switch (dado ausente); resumo/encerrar desligado sem km/fuel, mas o
     snapshot gravado; earnings desligado (sem km nem conta, `fuel` presente, `NAO_PAGA` mantido);
     `showFuel`;
   - web: A5 (3 switches, padrões, salvar); `CourierNumbers` com e sem; `CourierEndRun` desligado
     (duração no lugar do km, sem cartão); `CourierEarnings` desligado (valor sem a fórmula);
     Perfil sem a frase.
6. **Checklist:** padrões na 2.7, roteiro da Onda 10 na §5, contagem na §1.2. **Sem mudança de
   schema do Prisma** (só `Setting`).

### Onda 11 — Crachá digital v3 e GNV (planejada e concluída em 05/10/2026)

**Pedido do usuário:** trocar o design do crachá (E15) pelo handoff novo e incluir o **GNV** no
cálculo do combustível, além de gasolina e etanol.

**Entradas:** handoff `~/Downloads/Identidade visual padaria artesanal (1)/handoff-cracha-v3/`
(`HANDOFF.md`, 6 prints, protótipo `referencia/Crachá Digital v3.html` + `cracha-kit.jsx`). Ao
executar, copiar para `.projeto/design_handoff_cracha_v3/`, junto dos outros handoffs.

**Decisões do usuário (05/10/2026, passo a passo):**

| # | Decisão |
|---|---|
| H-9 ✅ | **QR real agora; a validação vem depois.** O segredo é por entregador, guardado no servidor. QR e código ("0427 · K3WD") são gerados **no aparelho** a cada 30 s (HMAC, funciona sem sinal), no formato do handoff (§5 dele). A leitura pela portaria e o estado **"Validado"** entram com o futuro perfil Portaria. Até lá, o código que muda é a prova de que não é print |
| H-10 ✅ | **Validade na linha do "desde":** "Entregador parceiro · desde mar/2026 · válido até 31/12/2026". **Vencido** usa o visual do Inativo do handoff, com "Seu crachá venceu em 30/09/2026" no lugar do QR (H-3 continua: vencido = inativo) |
| H-11 ✅ | **O crachá abre sem sinal:** os dados do crachá e o segredo ficam no aparelho, são atualizados sempre que há sinal e são apagados ao sair do app. Sem sinal, vale o status da última vez |
| H-12 ✅ | **GNV é um combustível próprio, em m³:** opção "GNV" no veículo, **só para carro**; preço próprio em **R$/m³** no A5; consumo em **km/m³**. O cálculo usa o preço do GNV. Carro com kit que também roda a gasolina é cadastrado como GNV |

#### Parte A — Crachá v3 (E15)

**O que muda em relação ao crachá atual** (a Onda 6 fez o design anterior):

| Hoje | v3 |
|---|---|
| Tela escura, cartão com faixa espresso, foto 150×176 com moldura dourada, selo girando, brilho passando | Tela clara com o **cordão** dourado, presilha e cartão branco que **balança ao abrir**, e **foto grande** (272 px) |
| "ATIVO" grande + "verificado agora" | Selo de vidro na foto: ponto verde que "respira" + "Ativo" |
| Relógio grande no rodapé (prova de que não é print) | Relógio pequeno no topo e **QR + código que mudam a cada 30 s** (a nova prova) |
| Dados: CPF, desde, veículo, válido até | CPF e veículo; "desde" e "válido até" na linha abaixo do nome (H-10) |
| "Hoje · Manhã · Jardins e mais 3" | Sai (o handoff não traz) |
| "Mostre na portaria · aumente o brilho da tela" | Sai. A web não controla o brilho (V-54); fica a tela acesa (wake lock) |
| Carimbo "INATIVO" girado | Foto em cinza, selo "Inativo", cordão apagado, "QR indisponível" e "Falar com a operação" |

**Estados:** Ativo (frente) · QR ampliado (verso, ao tocar no QR) · Sem foto (iniciais em fundo
gold soft + "Peça sua foto à operação") · Desativado · **Vencido** (H-10: selo "Vencido", "Seu crachá
venceu em DD/MM/AAAA"). O **Validado pela portaria** fica para o perfil Portaria.

**Decisões técnicas (minhas):**

| # | Decisão | Motivo |
|---|---|---|
| T-23 | Campo novo opcional **`User.badgeSecret`** (32 bytes aleatórios, base64url), gerado na 1ª chamada. **Nunca** sai nas rotas do admin. `db push` no banco de teste; em produção o deploy já roda | Revogar um aparelho vira só trocar o segredo de um entregador (futuro) |
| T-24 | **`GET /courier/badge-key`** → `{ secret, serverTime }`, com `Cache-Control: no-store`. Inativo ou vencido → `secret: null`, e o app apaga o que guardou | O app não gera QR para cadastro inativo (handoff §5) |
| T-25 | O gerador fica no **`packages/shared`** (`badgeWindow`, `badgeToken`): `w = floor(t/30)`, payload `cdp:b1:{courierId}:{w}:{tag}`, `tag` = base32 do HMAC-SHA256(segredo, `courierId:w`)[0..10], e o código curto = matrícula + 4 caracteres do mesmo HMAC num alfabeto **sem 0/O/1/I/L** (`23456789ABCDEFGHJKMNPQRSTUVWXYZ`). Usa **Web Crypto** (`crypto.subtle`), que roda no navegador e no Node 22 | A validação futura do perfil Portaria usa exatamente a mesma função |
| T-26 | **Relógio do aparelho:** guarda a diferença para a hora do servidor (`serverTime`) e calcula a janela com a hora corrigida | Celular com hora errada geraria código fora da janela de ±30 s |
| T-27 | **Cache local** (`lib/courierBadgeCache.ts`, `localStorage` por entregador): o recorte do `/courier/me` que o crachá usa + segredo + diferença de relógio + quando salvou. O `CourierScreen` grava a cada `fetchMe` com sucesso e usa o cache quando falha. O **Sair** apaga | H-11. Um PWA não tem Keychain: o segredo só gera o código do próprio entregador, e o servidor (no futuro) confere se ele está ativo |
| T-28 | **QR:** dependência nova **`qrcode-generator`** (MIT, sem dependências) só para a matriz, com correção **H**. O SVG é desenhado no app com módulos arredondados e os três "olhos" do kit, com a marca no centro (~20%). O `qrcode.react` que já existe não deixa estilizar os módulos | Fidelidade ao handoff (§5: módulos arredondados, alto contraste) |
| T-29 | **Tokens:** `--color-badge-card` (`#FFFDF9`, o único que falta). Bordas pelos tokens `--color-border`/`--color-border-2`, que são os equivalentes do app. Animações novas `cdp-badge-swing`, `cdp-badge-breath`, `cdp-badge-tick` e `cdp-badge-qr` no `globals.css`, que já desliga tudo com `prefers-reduced-motion` | Sem hex solto |
| T-30 | **Tela acesa** com o `useWakeLock` (já existe) enquanto o crachá está aberto | O handoff pede brilho máximo e tela ligada; o brilho a web não controla (V-54) |
| T-31 | **Nome longo:** mede a largura e reduz de 28 até 24 px; se ainda não couber, quebra em 2 linhas (handoff §7) | — |
| T-32 | **Sem `crypto.subtle`** (página fora de HTTPS, por exemplo um teste por IP local): o rodapé mostra "QR indisponível neste aparelho". Em produção não acontece | Não quebrar a tela |

**Passos**
1. Copiar o handoff para `.projeto/design_handoff_cracha_v3/`.
2. **Shared:** `badgeWindow`, `badgeToken` e `BADGE_CODE_ALPHABET` + testes com vetores fixos.
3. **API:** campo `badgeSecret` (schema + `db push` no banco de teste, conferindo o alvo), `GET
   /courier/badge-key` (JSON schema de resposta, só o próprio entregador, inativo → `null`) e o
   segredo fora das respostas do admin.
4. **Web:**
   - `lib/courierBadgeCache.ts` (ler, gravar, apagar) e a ligação no `CourierScreen` (grava no
     `fetchMe`, usa no erro, apaga no Sair);
   - `components/courier/BadgeQR.tsx` (matriz do `qrcode-generator` + SVG arredondado + marca) e
     `useBadgeCode` (janela de 30 s com a hora corrigida, contagem e troca);
   - `CourierBadge.tsx` reescrito: cordão, presilha, balanço, frente/verso com a virada 3D, selo de
     vidro, relógio, dados, rodapé de validação, dica, estados Sem foto, Desativado e Vencido, e as
     legendas de acessibilidade do handoff (§9);
   - tokens e animações no `globals.css`; `package.json` com `qrcode-generator`.
5. **Testes:**
   - shared: a mesma entrada dá o mesmo código; janelas e entregadores diferentes dão códigos
     diferentes; o código não tem caracteres ambíguos;
   - api: cria o segredo uma vez e devolve o mesmo; inativo/vencido → `null`; outro perfil → 403; o
     admin não recebe o segredo;
   - web: frente ativa (nome, linha com "desde" e validade, CPF, veículo, código), virar e voltar,
     o código troca ao passar a janela (relógio falso), sem foto, desativado e vencido (sem QR, com o
     motivo e "Falar com a operação"), bicicleta sem placa, sem veículo esconde a coluna, abre pelo
     cache sem sinal, Sair apaga o cache.

#### Parte B — GNV no combustível

**Onde muda** (levantamento): `shared/courier.ts` (tipos, rótulos e preço por combustível), `route-config`
+ A5 (preço), cadastro do entregador (A3), rota do dia e encerramento, proposta de pagamento (A8),
Meus ganhos (E13), Fim da rota (E10), Perfil (E14) e o relatório Combustível & rotas (A9).

**Decisões técnicas (minhas):**

| # | Decisão | Motivo |
|---|---|---|
| T-33 | `FUEL_TYPES` ganha `'GNV'` (rótulo "GNV"). `fuelPriceFor` recebe `{ gasolina, etanol, gnv }` e devolve o preço do GNV para `GNV`. Funções novas `fuelUnit(combustivel)` (`'l'` ou `'m³'`) e `consumptionUnit` (`'km/l'` ou `'km/m³'`) | Uma regra só para api e web |
| T-34 | Os campos continuam com os nomes de hoje (`kmPorLitro`, `litros`, `kmPerLiter`, `fuelPrice`), mas no GNV passam a significar **km/m³** e **m³**. A tela escolhe a unidade pelo `combustivel` | Evita mudar schema e snapshots já gravados. O nome fica documentado no código |
| T-35 | Preço novo na `Setting` **`combustivelGnv`** (sem padrão, como os outros), no `RouteConfig` (`precoGnv`), no zod e no JSON schema do `/admin/settings/rotas`. Mudar o preço do GNV também atualiza "preço atualizado em" | Mesmo padrão da gasolina e do etanol |
| T-36 | **A3:** "GNV" aparece só com **Carro**. Trocar para moto com GNV marcado volta para Gasolina. O rótulo do consumo vira "Consumo (km/m³)". A API recusa GNV com outro veículo (400) | H-12 |
| T-37 | **A9:** o relatório separa **litros** (gasolina/etanol) de **m³** (GNV), por entregador e no total. O KPI "Litros" vira "~X L · ~Y m³" quando há GNV, e a planilha ganha a coluna "m³" | Somar litro com m³ daria um número sem sentido |
| T-38 | Telas com a conta passam a usar a unidade do veículo: E10 ("12 km/m³ · GNV R$ 4,99"), E13 e A8 (`fuelFormula` com a unidade), E14 ("GNV · 12 km/m³") e a mensagem de validação do consumo ("entre 1 e 100 km/l" ou "km/m³") | — |

**Passos**
1. **Shared:** tipos, `fuelPriceFor`, `fuelUnit`, `consumptionUnit` e `payoutProposal` com o preço do
   GNV + testes.
2. **API:** `route-config` (`precoGnv` + chave + data do preço), `admin-settings` (zod + schema), os
   três lugares que calculam (`courier-runs`, `payouts.core`, `fuel-report`), validação "GNV só com
   carro" em `admin-couriers` e o relatório com `m3`.
3. **Web:**
   - A5: campo **GNV · R$/m³** (Gasolina e Etanol na 1ª linha, GNV na 2ª);
   - A3: opção GNV só no carro, com o rótulo de consumo;
   - E10, E13, A8, E14 e A9 com a unidade certa.
4. **Testes:**
   - shared: preço do GNV, unidades, proposta com GNV;
   - api: config com `precoGnv`, encerramento e proposta com GNV, GNV na moto → 400, relatório
     separando L e m³;
   - web: A5 salva o GNV; A3 mostra o GNV só no carro e troca o rótulo; E10/E13 com "km/m³".
5. **Checklist:** padrões (2.7: preço do GNV vazio), configuração inicial (4.2), roteiro da Onda 11
   (§5) e contagem (§1.2). **Schema do Prisma:** só o `User.badgeSecret` (parte A).

---

## 8. Riscos, infra e pontos de atenção

| # | Risco / passo | Tratamento |
|---|---|---|
| R-1 | **S3 não configurado em produção** (`isStorageConfigured()` falso) quebraria a foto obrigatória | O upload responde 503 e o app marca a parada como "sem foto · armazenamento indisponível" sem travar a entrega. O A5 mostra o aviso "Armazenamento de fotos não configurado". **Conferir as variáveis `S3_*` na VPS antes do deploy** |
| R-2 | **Retenção de 90 dias** depende de uma regra no bucket | **Passo manual:** criar a regra de ciclo de vida para os prefixos `deliveries/` **e `reports/`** (V-79), expirando em 90 dias. O app já trata como expirada (T-5). Comandos na 2.4 do checklist |
| R-2b | **Política do bucket** | Se a política dá leitura pública ao bucket inteiro (como os produtos e banners precisam), **ela não pode incluir `deliveries/*`**: restrinja a leitura pública aos prefixos `products/`, `banners/`, `receipts/`, `couriers/` e `condos/`. A chave é um UUID e nunca sai em URL pública, mas a garantia de privacidade é a política |
| R-3 | Dependências novas | `@aws-sdk/s3-request-presigner` (api), `barcode-detector` e `qrcode-generator` (web, Onda 11). O `.wasm` (~1 MB) entra no precache, o que aumenta o 1º download do PWA |
| R-4 | iPhone | Precisa de validação em aparelho, porque o comportamento varia por versão:<br>• no PWA instalado, a permissão da câmera pode ser pedida a cada abertura (manter o stream aberto no modo contínuo);<br>• lanterna e wake lock dependem da versão;<br>• sem `vibrate`;<br>• o áudio precisa de toque;<br>• a geolocalização pausa com a tela bloqueada (a posição ao vivo fica "há N min", e o wake lock ajuda) |
| R-5 | OSRM e Nominatim públicos | A rota salva reduz as chamadas a poucas por dia. Falha → ordem salva + "só pontos". OSRM próprio fica para depois (D-8) |
| R-6 | Corrida no confirm offline × admin | `occurredAt` limitado ao dia; desfecho já tomado por outro caminho → 409/422 e a fila descarta com aviso "já resolvida pela operação" |
| R-7 | Privacidade | A posição só é gravada com a rota STARTED, só a última, e é **apagada ao encerrar** (V-78); a foto é privada e assinada; o telefone nunca vai ao entregador. Textos legais ✅ na Onda 9 |
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

**Base antes da Onda 0 (01/10/2026):** api **1.736 + 3 todo**, web **426 + 17 todo**, shared
**82 + 4 todo** (todos verdes).

### Onda 0 — concluída em 01/10/2026 · **sem commit**

**API**
- `courier.service.ts` `getTodayOrders` (M-3, G-10):
  - clientes e condomínios de **todas** as paradas (ativas, concluídas, pão e Cestinha) carregados
    com **um `findMany` por coleção**, via `placeOf(userId)`. Antes eram 2 `findUnique` por
    parada;
  - nenhum comportamento mudou.
- **Rota por turno** (G-7):
  - a resposta troca `route` por `routes: [{ slotId, condominiumIds, route }]`, uma por turno na
    ordem de `slots`; paradas sem turno ficam com slotId `''`;
  - o OSRM foi isolado em `osrmRoute()`, com try/catch por turno.
- `courier.route.ts`:
  - JSON schema de `routes` declarado;
  - "rota otimizada" sai das descrições (M-13);
  - a resposta do `confirm` passa a declarar `{ ok }`, o que de fato é enviado.
- `admin-condominiums.service.ts`:
  - `update` só re-geocodifica quando o **endereço mudou** (`sameAddress`, exportada) ou quando o
    condomínio está sem coordenadas;
  - antes, todo salvamento re-geocodificava e sobrescrevia coordenadas manuais.
- **Removido** o `POST /auth/couriers` (rota, controller, service, `RegisterCourierSchema`). Só a
  tela legada usava; o cadastro é em `/admin/couriers`.

**Web**
- `CourierScreen` + `CourierRouteView`:
  - a aba Rota usa `routes`;
  - num dia com 2+ turnos, um seletor (`role="tablist"`) escolhe o turno;
  - o mapa e a "ordem de paradas" mostram só os prédios e as paradas do turno escolhido.
- `TrackingScreen`:
  - `SEPARATED` fica em "Agendado · agora";
  - **`NOT_DELIVERED` mostra "Não entregue"**, com o último passo em vermelho e X, a frase
    "Não conseguimos entregar desta vez…" e a pill "Não entregue" no histórico;
  - antes, os dois caíam fora da timeline e o histórico mostrava "Agendado".
- `CondoForm`: só manda lat/lng quando o campo foi editado nesta sessão (`coordsTouched`).
- `AdminEntregadores`: o toggle reverte também quando o servidor responde erro (`res.ok`).
- **Removidos** `CourierRegisterScreen.tsx` e a rota `/admin/couriers/new` (inalcançáveis).

**Testes novos**
- api (+9):
  - `courier.service.test.ts`: lote com uma consulta por coleção; uma rota por turno com os
    prédios certos na URL; falha do OSRM num turno não derruba o outro. O mock ganhou `findMany`;
  - `admin-condominiums.service.test.ts` (novo): mesmo endereço não re-geocodifica, endereço
    novo re-geocodifica, sem coordenadas geocodifica, manual tem prioridade, `sameAddress`.
- web (+9):
  - `CourierRouteView.test.tsx` (novo, 2);
  - `CondoForm.test.tsx` (novo, 2);
  - `AdminEntregadores.test.tsx` (novo, 2);
  - `TrackingScreen.test.tsx` (+3: separado, não entregue, histórico).

**Verificação:** typecheck (api + web + shared) ✅ · api **1.745 + 3 todo** · web **435 + 17
todo** · shared **82 + 4 todo**.

**Divergência**
- **V-19:** o "Não entregue" do cliente aparece **sem o motivo**. O motivo de hoje é o texto livre
  do entregador, que não é para o cliente ler. O motivo em linguagem do cliente chega com o
  `failureCode` na Onda 3 (C2).

### Onda 1 — concluída em 01/10/2026 · **sem commit**

**Banco**
- `schema.prisma` com a §3 inteira:
  - campos novos em `User`, `Order`, `MarketOrder`, `Condominium` e `HookRequest`;
  - 8 coleções novas: `DeliveryProof`, `CourierRun`, `CourierRouteTemplate`, `CourierTimeOff`,
    `CourierPayout`, `CourierReport`, `CondoAccessSuggestion`, `CourierMessage`;
  - 7 valores novos em `NotificationType`.
- `prisma generate` + **`db push` no banco de teste** (`cheirin-de-pao-teste`, conferido no `.env`):
  só criação de coleções e índices, sem perda de dados.
- `ensure-indexes`: únicos parciais `User.badgeNumber_1` (`$type: 'int'`) e
  `CourierReport.clientOpId_1` (`$type: 'string'`). Rodado contra o banco de teste: o Atlas
  aceitou (log "garantidos").

**Shared**
- `packages/shared/src/courier.ts`, exportado no `index`, com:
  - motivos (código, rótulo, texto do cliente; "Outro" e a correção do admin nunca vazam texto
    livre);
  - exceções da foto e `isProofExpired` (90 dias);
  - tipos de problema/ocorrência/acesso;
  - recados;
  - código curto (`stopShortCode`, `matchesStopCode` com 4 ou 6 hex);
  - veículo/combustível (flex = gasolina; `estimateFuel` null sem consumo ou preço);
  - pagamento (`payoutRemuneration`, `payWeekOf` segunda a domingo);
  - disponibilidade (`isAvailableOn`, `isOnTimeOff`).

**API**
- `lib/route-config.ts` (padrão `referral-config`): base, volta à base, minutos por porta, preços,
  data do preço (só muda quando o preço muda) e `fotoClienteVisivel`. Base e preços sem padrão
  (ausência = não configurado).
- Seed `seedRouteDefaults` no boot.
- `GET/PATCH /admin/settings/rotas` com JSON schema declarado e `storageConfigured` na resposta
  (aviso do A5, R-1).
- `lib/storage.ts`:
  - pastas públicas `couriers` e `condos`;
  - `uploadPrivateImage` (devolve a **chave**, `Cache-Control: private, no-store`);
  - `getSignedReadUrl` (10 min; só assina chave de `deliveries/`);
  - dependência nova `@aws-sdk/s3-request-presigner@~3.1093.0`, fixada na versão do
    `client-s3`. O lockfile ganhou só a entrada nova.
- Prefs de notificação do admin com os 5 tipos novos (nascem ligados).

**Web**
- `Icon.tsx`: 21 ícones do handoff + `box` (V-7); o `aria-hidden` passado pelos chamadores agora
  chega ao `<svg>`.
- `globals.css`: tokens âmbar (`--color-amber`, `-soft`, `-ink`, `-line`, `-text`) e
  `--color-note-gold`/`-ink`.
- `components/courier/kit.tsx`: `CRLabel`, `CRBig`, `CRIconBtn`, `CRSpin`, `CRSkel`, `CRTag`,
  `CRProof`, `CRCesta`, `CRAvatar`, `CRSheet` (dialog + trap de foco + Esc + `busy`), `CRToast`,
  `CRNote`, `CRSync`, `CRChoice` (`role="radio"`), `CRTextarea` e formatadores. O `CRDock` e os
  componentes de tela entram com as telas.
- Centrais de notificação:
  - admin: tons/ícones dos 5 tipos novos + tom `danger`;
  - cliente: `DELIVERY_OUT` ("Acompanhar") e `COURIER_MESSAGE` (dourado, balão). Sai o ramo morto
    `OUT_FOR_DELIVERY`.
- Preferências do admin: 5 toggles novos com selo "novo".

**Testes novos**
- shared: `courier.test.ts` (+18).
- api (+18): `route-config.test.ts` (6), `admin-settings.rotas-route.test.ts` (6),
  `storage.test.ts` (6).
- web (+11):
  - `kit.test.tsx` (9);
  - `NotificationsScreen` (+1, e o teste do `OUT_FOR_DELIVERY` virou `DELIVERY_OUT`);
  - `AdminNotificacoes` (+1, e a contagem de "novo" foi de 3 para 8).

**Verificação:** typecheck (api + web + shared) ✅ · api **1.763 + 3 todo** · web **446 + 17 todo**
· shared **100 + 4 todo**.

**Divergências**
- **V-20:** `CRSync` usa um tom de texto do design (`#5E3B0C`) que não estava na paleta. Entrou como
  token `--color-amber-text`.
- **V-21:** `@aws-sdk/s3-request-presigner` fixado em `~3.1093.0`, alinhado ao `client-s3`. A 1ª
  instalação puxou a 3.1145 e mexia em dependências internas do SDK no lockfile; foi refeita.

### Onda 2 — concluída em 01/10/2026 · **sem commit**

**API**
- **`confirm` do pão e da Cestinha** passa a devolver o **resumo da parada** (`StopSummary`):
  - cliente, condomínio, bloco, complemento, apto;
  - pães (pão + Cestinha) e itens da Cestinha;
  - `isFirstOrder` (via `first-delivery`), `hasHook`, `hookToDeliver` (já lê os campos de rota do
    gancho da Onda 8);
  - status, horários e `proofRequired`.
- **Body opcional** `{ via, clientOpId, occurredAt }` (Zod `ConfirmBody`):
  - grava `confirmedVia`;
  - `occurredAt` é limitado a [início do dia BRT, agora] (`clampOccurredAt`).
- **Parada já resolvida:**
  - leitura nova → **409 com o resumo** (texto diferente para entregue e para não entregue);
  - reenvio da **mesma** operação (mesmo `clientOpId`, guardado no `DeliveryProof`) → 200
    silencioso;
  - a Cestinha já resolvida, que antes dava 422, também vira 409.
- **`DeliveryProof`** criado no confirm (status `PENDING`, `required` pela regra do entregador,
  `confirmedVia`, `lastClientOpId`). O upload da foto é da Onda 3.
- **`GET /courier/stops/lookup?code=`**:
  - 4 ou 6 hex, só nas paradas de hoje do entregador;
  - o cupom da Cestinha de uma parada combinada aponta para o pão (uma entrada por parada);
  - 404 sem resultado, 400 com formato inválido.
- `lib/courier-profile.ts` (`resolveCourierRules`, padrão V-17) e
  `modules/courier/courier-stop.ts` (resumo, comprovante, `clampOccurredAt`).
- **Código curto de 6 caracteres** (`stopShortCode`) no cupom da Separação e no
  `GET /admin/orders/:id`.

**Web**
- **Leitor de QR** (`lib/qrDetector.ts`): `BarcodeDetector` nativo quando lê QR. Sem ele (iPhone),
  o polyfill `barcode-detector` (pacote `ponyfill`) é carregado sob demanda, com o `.wasm`
  **servido pelo app** (`?url`, nunca o CDN padrão). `warmUpQrDetector()` roda ao abrir a tela do
  entregador.
- `lib/beep.ts`: bipe pelo Web Audio, liberado no toque em Escanear, mais `navigator.vibrate`
  onde existe.
- `lib/courierApi.ts`: `confirmStop`, `lookupStopCode`, `newClientOpId` e `brtTime`.
- **E2 `ScanScreen`:**
  - estados permissão, bloqueada (com "Tentar de novo", V-8), indisponível, lendo, lido;
  - lanterna via `applyConstraints({ torch })` quando `getCapabilities().torch` existe;
  - leitura do **recorte** da moldura num canvas a cada 250 ms;
  - **um só stream** enquanto a tela está aberta;
  - depois de uma leitura, só volta a ler quando a pausa liga e desliga (evita ler o mesmo cupom
    duas vezes).
- **E4 `ResultPopup`:** sucesso, já confirmada/já resolvida (com horário BRT), outra rota, não
  encontrado e falha. O sucesso segue em 3 s ou no toque; o erro pede "Entendi". Vale sobre a
  câmera e sobre a lista.
- **E3 `CodeSheet`:**
  - seis caixas sobre um input real (só 0-9/A-F, O vira 0);
  - aceita 4 ou 6 caracteres;
  - estados não encontrado, já confirmada, falha e escolha entre paradas;
  - busca primeiro na lista do aparelho, depois na API.
- `CourierDock`: dock fixo "Escanear cupom · N/M" + teclado. Sai o botão do topo (G-17).
- **`CourierScreen`:**
  - fluxo escanear → confirmar → pop-up → próximo;
  - a confirmação pela lista (`ConfirmDeliveryDialog` com `via: LIST`) também abre o pop-up;
  - **atualização (M-1)**: ao voltar ao app, a cada 60 s, puxando para baixo e pelo botão no fim
    da lista. Entregas novas esperam o banner "N entregas novas · Atualizar";
  - toast no lugar da faixa inline.
- Removido o `QrScanner.tsx` antigo.
- `globals.css`: animações `cdp-scanline`, `cdp-count`, `cdp-pop` e `cdp-up` (zeradas com
  `prefers-reduced-motion`; o avanço do pop-up é por timer).
- Dependências: `barcode-detector@3.2.2` e `zxing-wasm@3.1.3`, **exatas**, para o JS do polyfill e
  o `.wasm` nunca ficarem em versões diferentes.

**Testes novos**
- api (+26):
  - `courier.service.test.ts`: resumo, comprovante, modo/horário, 409, reenvio, não entregue,
    Cestinha 409, busca 6/4/combinada/só-Cestinha/vazia/inválida;
  - `courier.route.test.ts` (8): serialização do resumo inclusive nulos, PATCH sem corpo, 409 com
    resumo, 400, busca 200/404/400;
  - `courier-stop.test.ts` (6);
  - o mock ganhou `deliveryProof`, `hookRequest` e `groupBy`, e o teste de referral simula o módulo
    da parada.
- web (+26): `ResultPopup` (5), `CodeSheet` (5), `qrDetector` (5), `ScanScreen` (6),
  `CourierScreen` (5).

**Build:** `vite build` emite `assets/zxing_reader-*.wasm` (1,1 MB) e `ponyfill-*.js` (44 KB),
**fora do precache**. O precache caiu de 95 para 93 entradas (−1,1 MB).

**Verificação:** typecheck (api + web + shared) ✅ · api **1.789 + 3 todo** · web **472 + 17 todo**
· shared **100 + 4 todo**.

**Divergências**
- **V-22:** E3 aceita **4 ou 6** caracteres. O design só desenhou 6; os 4 valem para o cupom
  impresso antes da virada, com a dica "Cupom antigo tem 4 caracteres — também vale".
- **V-23:** o `.wasm` e o chunk do polyfill ficam **fora do precache** (o T-2 dizia o contrário),
  pelo mesmo critério do `exceljs`: o `vite-plugin-pwa` incluía `.wasm` por padrão e todo cliente
  baixaria 1,1 MB. No lugar, há o pré-carregamento ao abrir a tela do entregador. Risco: o
  entregador de iPhone que abrir o app pela primeira vez já sem sinal só tem o "Digitar código".
- **V-24:** até a Onda 3, o pop-up diz "Próximo cupom em 3 s" (a foto ainda não existe). Até a
  Onda 4, a falha de rede mostra "Não conseguimos confirmar" (a fila offline ainda não existe).
- **V-25:** o `DeliveryProof` (PENDING) já nasce na confirmação desta onda, porque é ele que guarda
  o `clientOpId` da idempotência. O upload e o "sem foto" ficam na Onda 3.
- **V-26:** a rota do `confirm` **não declara `body` no JSON schema**. Com ele, o Fastify recusava
  (400) o PATCH sem corpo que o app atual manda. A forma é validada pelo Zod no controller (o teste
  de rota cobre).

### Onda 3 — concluída em 02/10/2026 · **sem commit**

**API**
- **Foto do comprovante:**
  - `POST /courier/stops/:key/proof?outcome=&clientOpId=` (multipart `file`, até 5 MB,
    jpeg/png/webp) → `deliveries/<uuid>` **privado**; `DeliveryProof` vira `OK` com `photoKey`,
    `photoAt` e `lastClientOpId`. Sem S3 configurado → **503**; arquivo grande → 400;
  - `POST /courier/stops/:key/proof/skip` `{ outcome, mode, reasonCode?, text? }`:
    - `NONE` (exceção da obrigatória) exige o motivo; "Outro" exige o texto;
    - `SKIPPED` em parada com foto obrigatória → 422;
    - nunca sobrescreve uma foto já `OK`.
  - `:key` aceita o id do pão ou de qualquer Cestinha da parada (`resolveStopByKey`, 404/403).
- **Não entrega (E6):** `PATCH …/not-delivered` aceita `{ failureCode, reason, via, clientOpId,
  occurredAt }` (Zod `NotDeliveredBody`):
  - "Outro" sem texto → 400 "Escreva o motivo para seguir";
  - grava `failureCode` no pão **e** nas Cestinhas da parada; o texto vira "Rótulo — texto";
  - o app antigo, que manda só `{ reason }`, cai em "Outro";
  - devolve o `StopSummary` (como a confirmação) e 409 com o resumo quando já resolvida.
- **A1:** `GET /admin/orders/:id` traz `failureCode` e `proof` (`status`, `outcome`, `required`,
  `photoUrl` assinada de 10 min, `photoAt`, `note`, `confirmedVia`, `expired`, `clientVisible`).
- **C2:** `lib/client-proof.ts`:
  - `proofFlags` (uma consulta) põe `proof: { available, expired }` em `/orders/today`,
    `/orders/history` e nas Cestinhas (`/market/orders/history`);
  - `clientProofPhoto` atende `GET /orders/:id/proof` e `GET /market/orders/:id/proof`: só o dono,
    só com `fotoClienteVisivel`, só foto `OK` e dentro dos 90 dias. Qualquer outro caso → **404**
    (o cliente não descobre se um pedido alheio existe);
  - `failureText` (motivo na linguagem do cliente, `failureClientText`) no pão e na Cestinha. O
    texto livre do entregador nunca vai para o cliente.
- **`DELIVERY_DONE`:** **um** aviso por parada (V-18). Com a foto visível ao cliente, o aviso leva
  `actionRoute` `/client/pedidos?comprovante=<id>`.

**Web**
- **E5 · foto na mesma câmera** (`ScanScreen` `mode="photo"`):
  - captura do quadro do vídeo num canvas (lado maior 1.280 px, JPEG 0,82) → prévia "Ficou boa?" →
    "Tirar outra" / "Usar foto";
  - obrigatória: sem "Pular", só "Não consigo tirar a foto" → `NoPhotoSheet` (câmera com defeito,
    local sem luz, outro + texto). Só segue quando o servidor registrou o motivo;
  - opcional: "Pular" + "A foto é opcional para você";
  - câmera bloqueada/indisponível → plano B com a câmera nativa (`<input capture>` +
    `browser-image-compression`);
  - lanterna também no modo foto; nada de leitura de QR enquanto fotografa.
- **`CourierScreen`:**
  - scan → pop-up E4 "**Foto da entrega** em 3 s" → foto → toast "Foto salva · escaneie o próximo"
    → volta a ler, sem fechar o stream;
  - pela lista: **`ConfirmSheet`** (apto em 50 px, "+ entregar gancho", Cestinha) → pop-up claro →
    a câmera abre direto na foto → fecha ao terminar;
  - **`FailSheet`**: seis motivos, "Outro" com texto obrigatório, "Em seguida: foto da porta ou
    portaria" com o selo obrigatória/opcional (regra `fotoNaoEntrega`) → foto "Foto da não
    entrega · Mostre a porta ou a portaria";
  - envio da foto em **segundo plano**; selo da parada (lista e Realizadas): enviando → foto ok,
    tentando de novo → pendente de envio, sem foto, sem foto · pulada. As Realizadas que vêm do
    servidor mostram o `proofStatus`;
  - regra de obrigatoriedade pelo `proofRequired` do resumo (vem da regra do entregador).
- **Saiu o `ConfirmDeliveryDialog`** (e a entrada dele no `KNOWN_BROKEN` do teste de tokens, que
  encolheu para 5).
- **A1 · `OrderProof`** no `OrderDetailSheet`: foto (miniatura, "Entregue 05:31", "por Antônio R. ·
  pelo scan", "Ver em tela cheia"), sem foto (motivo + "tem foto obrigatória"), pulada, subindo,
  não entrega com a foto da porta (motivo padronizado em destaque + o texto do entregador entre
  aspas), foto apagada (90 dias). Rótulo "cliente vê" / "só admin". Com comprovante, o motivo sai
  da lista de dados e fica só na seção.
- **`PhotoViewer`** (compartilhado A1/C2): tela cheia escura, título + contexto, "Baixar", rodapé
  livre. Se a URL assinada vencer, "Tentar de novo" busca outra.
- **C2 · cliente:**
  - não entrega com motivo: "Tentamos entregar às 05:52 — não conseguimos acesso pela portaria.";
  - bloco **Comprovante** (miniatura + "Entregue às 06:12 · Foto da porta · toque para ver") →
    visualizador "Seu pãozin chegou · Hoje, 06:12 · Residencial Jardins · Apto 101" com "Algo
    errado? Fale com o suporte" (WhatsApp do suporte);
  - histórico: botão de câmera "Ver foto" no pão e na Cestinha; "foto expirada" depois de 90 dias;
    aviso "O comprovante fica disponível por 90 dias.";
  - `/client/pedidos?comprovante=<id>` abre a foto direto (e limpa o parâmetro ao fechar).
- **C3:** `DELIVERY_DONE` com o `actionRoute` do comprovante → botão escuro **"Ver foto"** com a
  câmera. Sem foto, segue "Ver pedido".

**Testes novos**
- api (+31):
  - `courier-proof.test.ts` (11):
    - não entrega: código + rótulo, "motivo — detalhe", regra `fotoNaoEntrega`, já entregue → 409;
    - foto: sobe privada e marca `OK`, 503 sem S3, outro entregador → 403 / sem desfecho → 404;
    - pular: obrigatória → 422, opcional → `SKIPPED`, exceção `NONE` com o motivo, não sobrescreve
      uma foto `OK`;
  - `courier.route.test.ts`: "Outro" sem texto → 400 "Escreva o motivo para seguir";
  - `client-proof.test.ts` (5): selos (recente × 90 dias, função desligada) e a foto (dono, outro
    cliente → null, expirada/desligada/sem S3 → null);
  - `admin-orders-delivered-notice.test.ts` (3): um aviso por parada e o `actionRoute` do
    comprovante;
  - ledger: comprovante no detalhe (foto assinada, sem foto, expirada, `clientVisible`); orders:
    `failureText` e `proof` no pedido do dia.
- web (+29):
  - `CourierScreen` (+6): scan → foto → envio; obrigatória → sem foto (`NONE`); lista → pular
    (`SKIPPED`); não entrega → `failureCode` → foto `NOT_DELIVERED`; "Outro" sem texto; Realizadas
    com o comprovante do servidor;
  - `ScanScreen` (+5): prévia/usar, tirar outra, pular, sem QR no modo foto, plano B nativo;
  - `OrderProof` (10): todos os estados, visualizador, URL vencida e a integração no detalhe;
  - `TrackingScreen.proof` (7) e `NotificationsScreen` (+1).

**Verificação:** typecheck (api + web + shared) ✅ · `vite build` ✅ · api **1.820 + 3 todo**
(+31) · web **501 + 17 todo** (+29) · shared **100 + 4 todo**.

**Pendências de infra (§8, antes do deploy):** variáveis `S3_*` na VPS (R-1), regra de 90 dias no
prefixo `deliveries/` (R-2) e política do bucket **sem** leitura pública em `deliveries/*` (R-2b).

**Divergências**
- **V-27:** até a fila offline (Onda 4), a foto fica **só na memória**: duas novas tentativas (3 s e
  10 s) e depois "pendente de envio". Fechar o app nesse meio perde a foto (a parada continua
  `PENDING` para a operação). "Pular" também é enviado sem nova tentativa.
- **V-28:** upload com S3 fora (503) mostra "sem foto" no aparelho, mas o servidor mantém `PENDING`
  (não há motivo de exceção para isso). O A1 mostra "subindo"/"não chegou". O aviso de
  configuração é do A5 (Onda 5).
- **V-29:** A1 com foto `PENDING` há mais de 2 h diz "A foto não chegou do celular do entregador."
  em vez de "ainda está subindo" (estado que o design não desenhou). Enquanto está subindo, o
  detalhe se atualiza sozinho a cada 20 s por até 3 min.
- **V-30:** o comprovante do A1 ganhou `clientVisible` para o rótulo "cliente vê / só admin" do
  design (uma leitura de configuração a mais por detalhe com comprovante).
- **V-31:** no visualizador do cliente, o condomínio/apto vem do **cadastro atual** do cliente, não
  de um retrato do pedido. O bloco Comprovante busca a URL assinada ao abrir o acompanhamento para
  mostrar a miniatura (uma requisição a mais, só quando há foto).
- **V-32:** no histórico, o botão de câmera fica **ao lado** do selo de status (o design trocou o
  selo por texto; mudar isso alteraria a lista existente).
- **V-33:** fica para a Onda 8: o estado **"reportado"** do A1 (com "Marcar não entregue / Manter
  entregue") e o "Deixou o gancho também?" da E4 com gancho na rota.

### Onda 4 — concluída em 02/10/2026 · **sem commit**

**API**
- **Idempotência da fila (T-7):** a foto **não troca mais o `lastClientOpId`** do comprovante. Antes,
  depois da foto, o reenvio atrasado da confirmação/não entrega (mesmo `clientOpId`) virava 409 em
  vez de sucesso. O `clientOpId` da query da foto continua aceito e é ignorado (a foto é
  idempotente por substituição).
- O resto do T-7 já estava pronto desde a Onda 2: `occurredAt` limitado a [início do dia BRT,
  agora] e reenvio da mesma operação → 200.

**Web**
- **`lib/courierQueue.ts`** (IndexedDB com wrapper próprio, banco `cdp-courier`):
  - operações `confirm`, `notDelivered`, `proof` e `proofSkip`, cada uma com `clientOpId`,
    `occurredAt`, dono (`courierId`) e ordem de criação;
  - foto guardada como **bytes** (`ArrayBuffer` + tipo), não `Blob`;
  - sem IndexedDB (ou erro dele) → fila em memória;
  - `flushOps`: em ordem; **sem sinal** para tudo; **5xx/401/408/429** só a parada espera;
    **4xx** descarta; desfecho descartado leva junto a foto/"pular" da mesma parada; 409 do
    **mesmo** desfecho conta como feito, de outro → "já resolvida";
  - **rota do dia guardada** (`saveRoute`/`loadRoute`, por entregador e dia BRT) para abrir o app
    sem sinal.
- **`hooks/useCourierSync.ts`**: reenvio em `online`, `visibilitychange` e a cada 30 s; estado
  `ops`, `sending`, `offline`; `enqueue`, `flush` e `clear`.
- **`courierApi`**:
  - escritas com prazo (8 s na confirmação/não entrega, 45 s na foto) e `navigator.onLine`;
  - o erro diz se foi **sem sinal** ou o **status** do servidor;
  - `confirmStop`/`markStopNotDelivered` aceitam `{ clientOpId, occurredAt }`;
  - `sendQueuedOp` traduz cada resposta em feito / tentar de novo / descartar.
- **`CourierScreen`:**
  - confirmação (scan, código, lista) e não entrega tentam o servidor; **sem sinal ou erro do
    servidor → guardam na fila com o mesmo `clientOpId` e o horário da ação**;
  - pop-up **"Confirmada · sem sinal"** (âmbar, "Guardamos a entrega e enviamos sozinhos", segue
    para a foto como o sucesso);
  - não entrega sem sinal: o `FailSheet` mostra a nota e o botão **"Guardado · seguir para a
    foto"**; os motivos ficam travados;
  - **a foto e o "pular"/"sem foto" sempre passam pela fila** (fechar o app não perde mais a foto);
  - selos: enviando · tentando de novo · pendente de envio · foto ok · sem foto;
  - faixa **`CRSync`**: "Sem sinal — N entregas guardadas, sobem quando o sinal voltar" / "Enviando
    N…" (conta paradas, não operações);
  - entregas guardadas contam no "N/M" e aparecem resolvidas, inclusive depois de reabrir o app;
  - escanear de novo uma parada já guardada → "Já confirmada" (não guarda duas vezes);
  - sem sinal ao abrir → rota guardada + nota "Sem sinal. Mostrando a rota guardada neste
    aparelho às HH:MM"; sem rota guardada de hoje → "Abra o app com sinal uma vez para baixar a
    rota de hoje";
  - entrega guardada que a operação já resolveu ou que foi recusada → aviso e a lista recarrega;
  - **Sair com entregas guardadas** → sheet "Sair do app?" com "N entregas ainda não subiram. Se
    sair sem sinal, elas se perdem…", "Sair mesmo assim" (tenta enviar, descarta o resto e sai) e
    "Esperar o envio".
- Saiu o reenvio em memória da Onda 3 (V-27 resolvida).
- Dependência de teste: `fake-indexeddb@6.2.5` (dev, exata) — o lockfile ganhou só a entrada dela.

**Testes novos**
- api (+1): reenvio atrasado da mesma não entrega depois da foto → sucesso, outra operação → 409; a
  foto não grava `lastClientOpId` (teste do upload e da rota ajustados).
- web (+31):
  - `courierQueue.test.ts` (13, IndexedDB real via `fake-indexeddb`): sobrevive a reabrir o app,
    bytes da foto, dono, ordem, sem sinal, 5xx por parada, descarte em cascata, rota guardada (dia
    e entregador), sem IndexedDB;
  - `courierApi.queue.test.ts` (7): mesmo `clientOpId` e horário, 409 mesmo × outro desfecho,
    Cestinha, 4xx/5xx/401, sem sinal sem tentar, foto 503/404, pular 422/502;
  - `useCourierSync.test.ts` (4): `online`, `visibilitychange`, intervalo, `clear`;
  - `CourierScreen` (+6): scan sem sinal → foto → sobe com o mesmo id; não entrega guardada; sair
    com e sem pendência; abrir sem sinal com a rota guardada e sem rota guardada;
  - `ResultPopup` (+1): "Confirmada · sem sinal".

**Verificação:** typecheck (api + web + shared) ✅ · `vite build` ✅ · api **1.821 + 3 todo** (+1) ·
web **532 + 17 todo** (+31) · shared **100 + 4 todo**.

**Divergências**
- **V-34:** a fila nasce com `confirm`, `notDelivered`, `proof` e `proofSkip`. `hook`, `report`,
  `message` e `suggestion` entram junto com as rotas deles (Ondas 5 e 8); a fila já é genérica.
- **V-35:** confirmação e não entrega **tentam o servidor primeiro** (o pop-up precisa do 409 "já
  confirmada" e do "outra rota") e só vão para a fila quando falham, com o mesmo `clientOpId`. A
  foto e o "pular" vão **sempre** pela fila.
- **V-36:** **rota do dia guardada** no aparelho (não estava no plano) para abrir o app sem sinal.
  Limite: o que foi confirmado com sinal **depois** do último download aparece como pendente na
  rota guardada até o sinal voltar; escanear de novo não faz mal (409 do mesmo desfecho conta como
  feito).
- **V-37:** sem nada guardado, "Sair" continua direto (D-08). O sheet completo de sair do design
  (sempre, com "Cancelar") vem com o Perfil (E14, Onda 6).
- **V-38:** o pop-up e a não entrega dizem "Sem sinal agora" também quando o servidor deu erro
  (5xx) — o comportamento é o mesmo (guarda e reenvia).

### Onda 5 — concluída em 02/10/2026 · **sem commit**

**API**
- **`lib/route-engine.ts` (T-8):**
  - matriz OSRM `/table` (duração) entre a base e os prédios; ordem **exata até 8** prédios,
    acima disso vizinho mais próximo + 2-opt; sem base, o 1º prédio é livre;
  - volta à base no custo e no traçado quando ligada;
  - métricas/traçado por `/route` (km, minutos, pernas em segundos);
  - cache em memória de 6 h por conjunto de pontos; prazo de 8 s; nunca lança (OSRM fora → a
    ordem recebida, sem métricas, e a sugestão não é gravada);
  - prédio sem coordenada vai para o fim e fora do traçado;
  - `computeEtas`: hora prevista = trajeto + tempo por porta, a partir do início da rota (ou de
    agora); atrasou → as pendentes são empurradas para depois de agora;
  - `OSRM_URL` opcional no `.env` (padrão: OSRM público, D-8).
- **`modules/courier/courier-plan.ts` (D-5):**
  - `ensureSuggestion`: sem rota salva → **1ª sugestão**; com rota salva → **sugestão nova só
    quando entra prédio que ela não tem**; não recalcula se a pendente já cobre o conjunto; avisa
    o admin (`ADMIN_ROUTE_SUGGESTION`, `dedupeKey` por entregador/turno/conjunto);
  - `dayOrderFrom` (D-5c): rota salva com o prédio novo logo depois do vizinho que o precede na
    sugestão; prédio sem entrega no dia é pulado;
  - `resolveDayRoute`: rota salva → sugestão → ordem do entregador no dia (`CourierRun`);
  - ações do admin: usar · manter (a ordem salva + os novos na posição sugerida) · ajustar ·
    adotar a ordem de um dia.
- **`modules/courier/courier-runs.ts` (E8–E10):**
  - `POST /courier/runs/start` (base ou GPS): grava a ordem/km do dia e avisa cada cliente com
    parada pendente — **"Saiu para entrega · {Nome} está a caminho com seus N pãezinhos"**
    (H-1); repetir não avisa de novo; encerrada → 409; sem entregas → 404;
  - **a 1ª confirmação/não entrega de um turno não iniciado inicia a rota sozinha** (`AUTO`);
  - `POST /courier/runs/:id/position`: só a última, só com a rota iniciada (T-9);
  - `PUT/DELETE /courier/runs/order`: reordenar só com `podeReordenar` (403), vale só no dia;
  - `GET /courier/runs/:slotId/summary` e `POST /courier/runs/:id/end`: pendências (sem desfecho,
    foto obrigatória pendente) → **422**; encerrar grava o snapshot do combustível (T-14) e o
    resumo; resumo traz o próximo turno.
- `GET /courier/orders/today`: por turno, `label/emoji/time`, ordem do dia, `state` (pronta · em
  rota · encerrada), `run`, `reorderedToday`, `eta` por prédio; também `base` e `routeCondos` (os
  prédios já feitos entram no mapa). Saiu o traçado na ordem de chegada.
- **Divisão aprovada** (`approveDivision`) → sugestão de rota por entregador/turno (best-effort).
- **Lembrete do turno**: rota iniciada também conta como "já começou" (§6).
- **Cliente (C1)**: `/orders/today` ganha `onTheWayAt` e `courier { firstName, photoUrl }` **só
  com a rota do turno iniciada**; preenche o `courierName` (antes nunca preenchido).
- **Admin**, módulo novo `admin-courier-routes`:
  - A4: `GET /admin/couriers/:id/routes/:slotId` (rota salva + sugestão com a diferença de km +
    alterações do entregador em 30 dias) · `POST …/accept` · `POST …/keep` · `PUT …` ·
    `POST …/adopt/:runId` · `POST /admin/routes/preview`;
  - A2: `GET /admin/couriers/live` (estado, progresso, término previsto, "sem foto", ordem
    alterada, última posição esmaecida após 10 min, paradas e prédios do mapa);
  - A5: `GET /admin/geocode?q=` (busca do endereço da base no Nominatim).

**Web**
- **E1**: card "Rota de hoje" por turno (Pronta · N paradas · ~km + **Iniciar** / Em rota desde
  HH:MM · feitas/total / Encerrada às HH:MM, "ordem alterada hoje"); lista na ordem da rota;
  **dock** com os modos `start` (Iniciar rota · turno), `scan`, `end` (Encerrar rota da manhã) e
  `none`.
- **E8 `StartRunSheet`**: turno, paradas, ~km, duração e "entrega HH:MM" (V-12); base ou minha
  localização (desligada → só base, com o aviso); avisos do cliente e da localização.
- **E9 `CourierRouteView`** (refeito): seletor de turno; mapa novo (`CourierMap`: numerados,
  feitos ✓, próximo em dourado, base, "você está aqui" com halo, só pontos sem traçado); próxima
  parada com hora prevista, portas/pães/Cestinhas, **Navegar** (Google Maps · Waze · Apple Maps no
  iPhone, escolha lembrada, `lib/navLinks.ts`) e **Lista do prédio**; **chegada a 80 m** ("Você
  chegou"); ordem de paradas com "feito"/hora/"sem mapa"; **reordenar** (arrastar, `@dnd-kit`, só
  com a permissão) com "Salvar ordem de hoje" / "Voltar à rota padrão"; "Tudo entregue!" →
  Encerrar.
- `hooks/useCourierPosition.ts` (watch só com a rota iniciada, envio a cada 60 s) e
  `hooks/useWakeLock.ts` (tela acesa durante a rota, M-10).
- **E10 `CourierEndRun`**: pendências (sem desfecho → Resolver; foto obrigatória → **Tirar foto**
  na mesma câmera; envios guardados → Tentar agora), resumo (entregues, não entregues, pães,
  Cestinhas, ganchos, duração), km e combustível estimados (ou o motivo de não ter), Encerrar
  travado com pendência e a tela "Rota da manhã concluída 🥖" com o próximo turno.
- **A5 `AdminRotasConfig`** (card novo no hub de Gestão, V-2): base com busca e pino arrastável,
  remover base, volta à base, tempo por porta, preços (vírgula, faixa R$ 0,01–20), cliente vê a
  foto, aviso de S3 não configurado, "Salvo às HH:MM".
- **A4 `CourierRouteScreen`**: rota salva (mapa, km, "desde"), sugestão (1ª/nova, −km, motivo,
  "novo", "subiu/desceu"), Usar · Manter · Ajustar (arrastar com o km recalculado ao soltar),
  alterações do entregador (Ver ordem · Adotar). Abre pelo card da rota no A2 e pelo botão de rota
  na lista de Entregadores.
- **A2 `LiveRoutesCard`** na aba Entregas (Hoje): mapa ao vivo com os entregadores, cards por
  rota e paradas com os filtros Todas · Pendentes · Sem foto; consulta a cada 30 s.
- **C1**: timeline acende "Saiu" só com a rota iniciada ("Acende quando o entregador sair…"),
  "{Nome} está a caminho" + "a caminho desde HH:MM", card do entregador (foto + primeiro nome,
  "a caminho"), cabeçalho com condomínio · bloco · apto (V-16).

**Testes novos**
- api (+57): `route-engine.test.ts` (14), `courier-plan.test.ts` (13), `courier-runs.test.ts`
  (12), `admin-courier-routes.test.ts` (9), `courier.route.test.ts` (+5), `courier.service`
  (rota por turno refeita + rota iniciada), lembrete (+1), orders (+2).
- web (+27): `CourierRouteView` (9, refeito), `CourierScreen` (+4: iniciar, em rota, encerrar →
  concluída, pendências + Tirar foto), `CourierRoutesAdmin` (11: A5, A4, A2),
  `TrackingScreen.onway` (5).

**Verificação:** typecheck (api + web + shared) ✅ · `vite build` ✅ · api **1.878 + 3 todo** (+57)
· web **559 + 17 todo** (+27) · shared **100 + 4 todo**.

**Divergências**
- **V-39:** o **E10 é uma tela sobreposta** dentro do `CourierScreen`, não a rota
  `/courier/encerrar/:slotId` do plano: assim usa a mesma fila de envios e a mesma câmera de foto.
- **V-40:** a **1ª confirmação de um turno não iniciado inicia a rota sozinha** (`AUTO`). Com
  isso, o cliente recebe o "Saiu para entrega" nesse momento, e o E10 funciona mesmo se o
  entregador esqueceu o botão.
- **V-41:** prédio que **saiu** da rota não gera sugestão (é só pulado no dia); só prédio
  **novo** gera — senão cada dia sem pedido num prédio viraria uma sugestão.
- **V-42:** a A4 abre pelo card da rota (A2) e por um botão na lista de Entregadores; o cadastro
  ampliado (A3) é da Onda 6. O aviso da sugestão leva para `/admin` (a navegação do admin é por
  estado, sem rota por tela).
- **V-43:** o rodapé da escolha do app de mapas diz "Dá para trocar depois na aba Rota" (e há o
  "Abre no X · trocar" na próxima parada); "Perfil › Preferências" chega com o Perfil (Onda 6).
- **V-44:** sem base cadastrada, o E8 oferece "Primeiro prédio da rota" no lugar de "Base".
- **V-45:** no A2, "sem foto" = exceção (`NONE`) + foto obrigatória que não chegou de parada já
  resolvida.
- **V-46:** o cabeçalho do acompanhamento mantém o "previsto HH:MM" junto do endereço (o design
  só mostra o endereço).
- **V-47:** ganchos no resumo do turno ficam em 0 até a Onda 8 (gancho na rota).
- **V-48:** enquanto a rota não começa, o dock mostra só "Iniciar rota" (como no design); a
  confirmação pela lista continua disponível (e inicia a rota, V-40).

### Onda 6 — concluída em 02/10/2026 · **sem commit**

**Shared** (`courier.ts`)
- `weekdayOf`, `offReasonFor` (folga marcada → `FOLGA`; dia ou turno fora da escala →
  `FORA_DA_ESCALA`), `maskCpf` ("***.456.789-**"), `badgeNumberLabel` ("0427") e `badgeStatus`
  (ativo · desativado · vencido).

**API**
- **`lib/courier-badge.ts` (H-3):** `assignBadgeNumber` (maior número + 1, com nova tentativa
  quando o índice único parcial `User.badgeNumber_1` recusa) e `backfillBadgeNumbers` no boot
  (entregadores sem número, do mais antigo ao mais novo, idempotente; falha só gera log). Validade
  padrão **31/12 do ano** (V-10).
- **`lib/courier-availability.ts`:** `courierOffMap` (quem está de folga ou fora da escala numa
  data/turno).
- **`admin-couriers` (A3)** refeito:
  - cadastro/edição com foto, veículo (bicicleta/a pé sem combustível), regras, pagamento,
    escala (dias + turnos) e validade do crachá; CPF imutável na edição;
  - `POST /admin/couriers/photo` (pasta pública `couriers/`; S3 ausente → 503);
  - folgas: `GET/POST /admin/couriers/:id/time-offs` e `DELETE …/:timeOffId`; ao marcar, devolve
    as **rotas já aprovadas** que caem no período (turno + nº de paradas);
  - a lista traz "de folga hoje" e "sugestão de rota nova".
- **Divisão de entregas (F-8):** `getDivisionSuggestion` só distribui entre quem trabalha no dia/
  turno; quem está de folga aparece no fim, com `offReason`. Se todos estão de folga, distribui
  entre todos (não trava a operação).
- **Entregador** (`courier-me.ts`): `GET /courier/me` (perfil, crachá, rota de hoje, entregas em
  30 dias, escala), `GET /courier/stats?days=7|30` (entregas, não entregues, taxa de sucesso, pães,
  tempo médio por rota, km e combustível estimados, por dia e últimos dias) e `GET
  /courier/schedule` (semana seg–dom, folgas futuras, próximo turno em até 21 dias).

**Web**
- **A3 `EntregadorForm`** (refeito, 6 seções do design): foto com câmera/galeria e recorte redondo
  (`CourierPhotoPicker`), CPF travado na edição, nº e validade do crachá; veículo (tocar de novo
  limpa); 4 regras; pagamento (modalidade, valor, combustível estimado); escala com dias e turnos
  e as **folgas** (adicionar/remover, aviso "A folga de DD/MM cai numa rota já aprovada…"); rota
  por turno (abre a A4).
- **Lista de entregadores:** foto, resumo do veículo/pagamento, "de folga hoje", "sugestão de rota
  nova".
- **`DeliveryDivisionCard`:** selos "de folga" / "fora da escala" e "fora da sugestão".
- **E14 `CourierProfile`** (só leitura, F-1): dados, Meu trabalho (Crachá · Meus números · Minha
  escala), Meu veículo, Preferências (app de mapas, notificações), Conta e ajuda (trocar senha,
  falar com a operação, **Sair**).
- **E15 `CourierBadge`:** credencial com nº, foto (ou iniciais + aviso "Sem foto no crachá"), selo
  girando, nome, CPF mascarado, desde, veículo, validade, **ATIVO** com halo, rota de hoje,
  **relógio ao vivo** (BRT, anel dos segundos) e brilho passando; **INATIVO** (desativado ou
  vencido) com carimbo, explicação e "Falar com a operação". O status é buscado de novo ao abrir.
- **E17 `CourierNumbers`:** 7/30 dias, taxa de sucesso com frase motivadora (sem ranking), KPIs,
  gráfico por dia (folgas em cinza), últimos dias; sem histórico → boas-vindas com o próximo
  turno.
- **E18 `CourierSchedule`:** aviso "Hoje é sua folga 🌿", semana com turnos/folga, legenda,
  próximas folgas (ou nenhuma), "Fale com a operação".
- **E1:** cabeçalho com foto + primeiro nome (abre o Perfil) e botão **Crachá**; o "Sair" do topo
  saiu; **"Sair do app?" sempre confirma** (sem pendência: Sair/Cancelar; com pendência: o aviso
  da Onda 4); **sem entregas hoje** → "Hoje é sua folga 🌿" (com a semana) ou "Nenhuma entrega
  hoje", próximo turno e "Ver minha escala" — no lugar das abas e do dock.
- `NavAppSheet` ganhou o modo "escolher e salvar" do Perfil; o rodapé agora diz "Dá para trocar
  depois em Perfil › Preferências".

**Testes novos**
- api (+13): `admin-couriers.service.test.ts` (refeito, 10, inclui o backfill sem duplicar),
  `courier-me.test.ts` (7: crachá vencido = inativo, CPF mascarado, números, escala com folga),
  `courier.route.test.ts` (+2), divisão sem quem está de folga (+1).
- web (+27): `EntregadorForm` (refeito, 7), `AdminEntregadores` (+1), `CourierPeople.test.tsx`
  (18: perfil, crachá ativo/sem foto/vencido/desativado, números 30/7 dias e vazio, escala com
  folga/sem folga/hoje é folga, E1 sem entregas), `CourierScreen` (+5 e os 2 testes de sair
  refeitos).
- shared (+3): pessoas (`weekdayOf`, `offReasonFor` e o crachá: CPF mascarado, nº com 4 dígitos, ativo × desativado × vencido).

**Verificação:** typecheck (api + web + shared) ✅ · `vite build` ✅ · api **1.891 + 3 todo** (+13)
· web **586 + 17 todo** (+27) · shared **103 + 4 todo** (+3).

**Divergências**
- **V-49:** o nº do crachá usa **maior número + 1 com nova tentativa no índice único**, não uma
  sequência em `Setting`. Com poucos entregadores e o índice parcial, o resultado é o mesmo
  (sequencial, sem repetir) com menos uma peça.
- **V-50:** Perfil, Crachá, Meus números e Minha escala são **telas sobrepostas** no
  `CourierScreen` (como o E10, V-39), não rotas — usam a mesma fila de envios.
- **V-51:** a linha **"Meus ganhos"** do Perfil fica de fora até a Onda 7 (E13).
- **V-52:** "Falar com a operação" (Perfil, Crachá inativo, Escala) abre o **WhatsApp de suporte**
  até a Onda 8 (E12, conversa com a operação).
- **V-53:** entregador **novo** começa com escala **seg a sáb, todos os turnos**; entregador antigo
  sem escala cadastrada conta como **todos os dias** (ninguém some da divisão no deploy).
- **V-54:** o brilho da tela não é controlável pela web: o crachá só pede "aumente o brilho da
  tela".
- **V-55:** sem sinal ao abrir o crachá pela 1ª vez, aparece o aviso "o crachá precisa de conexão
  para conferir o status" (com os dados já baixados, abre e atualiza por trás).
- **V-37 e V-43 resolvidas:** sair sempre confirma (E14) e o rodapé do app de mapas aponta para
  Perfil › Preferências.

### Onda 7 — concluída em 02/10/2026 · **sem commit**

**Shared** (`courier.ts`)
- `payoutProposal` (T-13/T-14): remuneração pela modalidade + combustível = Σ km das rotas
  encerradas ÷ km/l × preço (flex = gasolina), com o motivo quando o combustível fica fora
  (`NAO_PAGA` · `NAO_USA` · `SEM_KM` · `SEM_CONSUMO` · `SEM_PRECO`); `payoutTotals` (estimado ×
  final), `payoutCompetenceMonth`, `PAYOUT_STATUSES`.

**API**
- **`lib/courier-stops.ts`:** paradas resolvidas de um ou vários entregadores (pão + Cestinha do
  mesmo cliente/turno/dia = 1). O E17 passou a usar a mesma função.
- **`admin-courier-payouts/payouts.core.ts` (T-12):**
  - `computeWeek`: por entregador, entregas, rotas encerradas, rotas abertas, km e a proposta.
    Entra quem teve movimento ou recebe semanal fixo e está ativo;
  - `materializeWeek`: grava a semana FECHADA (idempotente pelo índice único `courierId +
    weekStart`; corrida → P2002 ignorado); a pendente é recalculada a cada abertura;
  - início das propostas em `Setting.courierPayoutsSince`, gravado na 1ª abertura (= semana
    anterior).
- **A8 `admin-courier-payouts`:**
  - `GET /admin/courier-payouts?week=` (sem `week`: última semana fechada; em andamento: só
    estimativa) · `GET …/history` · `GET …/summary` (selo);
  - `PATCH /:id` (valores finais + motivo → `EDITED`);
  - `POST /:id/approve` (T-15): reserva a proposta (`updateMany` condicional), cria pela
    `AdminExpensesService` a despesa "Entregador" e a de "Combustível" (o que for > 0),
    competência = último dia da semana, favorecido = entregador, pago (data + forma) ou a pagar
    (vencimento); mês fechado → 409; falha no meio desfaz tudo;
  - `POST /:id/discard { reason }` (não cria despesa).
- **E13 `GET /courier/earnings`:** modalidade, semana em andamento estimada, extrato (em análise ·
  pago · a pagar, pelo status das despesas).
- **A9 `GET /admin/reports/fuel`:** km, litros, gasto, por entrega, por pão, por entregador
  (snapshot do encerramento ou cadastro de hoje), quem está sem consumo/preço e a economia das
  rotas aceitas.
- **Rota salva:** campo `CourierRouteTemplate.acceptLog` (últimas 50 mudanças: `ACCEPT` · `KEEP` ·
  `ADJUST` · `ADOPT`, com `km` e, no aceite, `kmAlt` = a alternativa evitada).
- **Cron das 8h:** às segundas, gera a semana que fechou e avisa `ADMIN_PAYOUT_PENDING` ("N
  propostas da semana DD/MM–DD/MM · total estimado R$ X"), uma vez por semana.

**Web**
- **A8 `CourierPayouts`:** semana anterior/próxima (a próxima trava na semana em andamento),
  Propostas · N / Histórico, cartão do design (modalidade, remuneração com a base, combustível
  com a conta ou o motivo, "N rota não foi encerrada", estimado → final, ajuste), sheets
  Editar · Aprovar (pago agora / a pagar, "Vira despesa no Financeiro") · Descartar (motivo) ·
  Despesas lançadas ("ver despesa"). Abre por Entregadores (atalho com "N propostas a aprovar"),
  pelo selo no card de Entregadores do hub, por Financeiro › Caixa e obrigações e pelo A9.
- **E13 `CourierEarnings`:** "Você recebe por entrega · R$ 1,50", semana em andamento, a receber
  (estimado), remuneração com a base, combustível com a conta, avisos (valor final, combustível
  fora, rota não encerrada), extrato; sem modalidade → "Forma de pagamento não definida" +
  "Falar com a operação" + combustível. Linha "Meus ganhos" no Perfil (V-51 resolvida).
- **A9 `RelCombustivel`** (Relatórios › Operação & financeiro): 7 dias · 30 dias · Mês · Período,
  KPIs, "−N km rotas sugeridas", economia em R$, aviso de quem está sem consumo, tabela por
  entregador, exportar planilha e "Ir para pagamentos".
- **A3:** o pagamento vai sempre como objeto (ver V-65).

**Testes novos**
- api (+20): `admin-courier-payouts.service.test.ts` (13: três modalidades, geração idempotente e
  recálculo só da pendente, semana em andamento, início das propostas, pago agora com 2 despesas
  e competência, a pagar com vencimento e valores editados, mês fechado → 409, falha desfaz,
  descartar sem despesa, nada a pagar → 400, histórico pago × a pagar, aviso de segunda, rotas
  HTTP), `fuel-report.test.ts` (3), `courier-earnings.test.ts` (2), `courier-plan` (+1:
  histórico do aceite), `courier.route.test.ts` (+1).
- web (+15): `CourierPayouts` (7), `CourierEarnings` (4), `RelCombustivel` (3),
  `AdminEntregadores` (+1); `CourierPeople` ganhou a linha "Meus ganhos".
- shared (+5): proposta (por entrega + flex, por rota/semanal/etanol, combustível fora, cadastro
  sem pagamento), totais e competência.

**Verificação:** typecheck (api + web + shared) ✅ · `vite build` ✅ · api **1.911 + 3 todo** (+20)
· web **601 + 17 todo** (+15) · shared **108 + 4 todo** (+5). `prisma db push` no banco de teste
(campo `acceptLog`).

**Divergências**
- **V-56:** as propostas começam na **semana anterior à 1ª abertura** (`courierPayoutsSince`):
  semanas mais antigas nunca são geradas — senão, ao navegar para trás, o sistema criaria
  propostas de semanas já pagas por fora.
- **V-57:** proposta **pendente** é recalculada a cada abertura (status corrigido, consumo
  cadastrado depois). Editada, aprovada ou descartada fica congelada.
- **V-58:** a proposta usa o **consumo e o preço atuais** sobre o Σ km (T-14 ao pé da letra, e a
  conta mostrada fecha). O A9 usa o que foi **congelado no encerramento** de cada rota (é um
  relatório histórico). Com troca de preço no meio da semana, os dois diferem por centavos.
- **V-59:** o aviso de segunda sai no **cron das 8h** (o dos alertas financeiros), não no
  `daily-jobs` da meia-noite — push à meia-noite não é acionável. A geração também acontece ao
  abrir Pagamentos, o hub de Gestão ou "Meus ganhos".
- **V-60:** "Meus ganhos" mostra a semana fechada como **"em análise"** enquanto a operação
  revisa (o design só tinha pago / a pagar).
- **V-61:** pago × a pagar vem das **despesas**: marcar como paga em Financeiro › Contas a pagar
  vira "pago" no histórico do A8 e no extrato do entregador.
- **V-62:** descartar **pede o motivo** (sheet que não estava no design; o plano já previa
  `{ reason }`).
- **V-63:** só **rota encerrada** conta (T-13); a iniciada e não encerrada aparece como aviso no
  A8 e no E13.
- **V-64:** economia das rotas aceitas = **km da alternativa evitada** (a rota salva com os
  prédios novos, calculada no aceite) − km da rota aceita, **por turno encerrado** até a próxima
  mudança da rota salva. A 1ª rota (sem anterior) não conta economia. Campo novo `acceptLog`.
- **V-65:** correção do A3: o pagamento é salvo **sempre como objeto**; `null` fica só para o
  cadastro antigo (= sem modalidade, combustível pago). Antes, desligar o combustível sem
  modalidade gravava `null` e o switch voltava ligado.
- **V-66:** as categorias "Entregador" e "Combustível" são achadas pelo nome; se o admin apagou,
  são recriadas com o padrão do seed.
- **V-67:** proposta com total 0 não aprova (400 "Descarte-a"); semanal fixo ativo gera proposta
  mesmo sem movimento (o admin descarta se o entregador esteve de folga).

### Onda 8 — concluída em 02/10/2026 · **sem commit**

**Shared** (`courier.ts`): `readCondoAccess` (vazios → null; nada preenchido = sem dicas) e
`ACCESS_FIELD_KEY` (campo que cada sugestão corrige).

**API**
- **Rota do dia** (`GET /courier/orders/today`): por parada, `isFirstOrder`, `hasHook`,
  `hookToDeliver`, `messagesOff`; por prédio, `access`; nas realizadas, `reported`.
- **`courier-ops.ts`** (entregador):
  - `POST /courier/messages` (E16): modelos fixos, só paradas de hoje, 403 sem `podeRecados`, 409
    com `code` `OPT_OUT` · `ALREADY` · `NOT_TODAY` (trava T-16 pelo único de `CourierMessage`);
    push `COURIER_MESSAGE` "Antônio: Estou na portaria 🥖";
  - `POST /courier/reports` (E11/E12): problema só em entrega realizada; ocorrência com
    `photoKey`; idempotente pelo `clientOpId` (índice parcial); avisa `ADMIN_COURIER_ISSUE` /
    `ADMIN_COURIER_INCIDENT` com apto e condomínio;
  - `POST /courier/reports/photo`: foto da ocorrência na pasta **privada** `reports/`;
  - `POST /courier/condos/:id/access-suggestions` (E7): não duplica a mesma pendente; avisa
    `ADMIN_CONDO_ACCESS_SUGGESTION`;
  - `POST /courier/hooks/:id/outcome` (A7): sim → `markDelivered(…, 'COURIER')` (push "Seu gancho
    chegou!"); não → volta para a fila (`routeFailedAt`). A não entrega da parada também devolve o
    gancho.
- **Cliente:** `GET /client/profile` traz `courierMessagesOff`; `PATCH
  /client/profile/courier-messages { off }`.
- **A1/H-2:** `GET /admin/orders/:id` ganha `issues[]` e `correction`; `POST
  /admin/orders/:id/correct-not-delivered` corrige a parada inteira (pão + Cestinhas) para não
  entregue com `CORRIGIDO_ADMIN`, quem/quando/nota — **sem push, sem crédito, sem Indique e Ganhe**
  — e fecha os reportes como `CORRECTED`.
- **`admin-courier-reports`** (novo): `GET /admin/courier-reports?status=` (com a parada e a foto
  assinada), `GET …/summary`, `POST …/:id/resolve` (problema → `KEPT`; ocorrência → `DONE`).
- **A6 `admin-condominiums`:** `courierAccess` no POST/PATCH/GET (vazio = sem dicas),
  `pendingSuggestions` na lista, `POST /admin/condominiums/access-photo` (pasta `condos/`), `GET
  /:id/access-suggestions`, `POST …/:sid/apply` (troca o campo; Outro soma às observações) e
  `…/discard`.
- **A7 `admin-hooks`:** `GET /:id/route-options` (dias/turnos com entrega do cliente nos próximos 7
  dias + entregador da rota), `POST /:id/route` (400 sem entrega no dia/turno) e `DELETE
  /:id/route`; a lista ganha `route`, `routeFailedAt`, `deliveredVia`, `deliveredByName` e
  `routeState` (fila · rota · entregue · volta). **Despacho:** aprovar a divisão grava o
  entregador da parada nos ganchos daquele dia/turno.
- **A10:** `GET /admin/reports/delivery` ganha `failureCodes` (pão + Cestinha por código, com
  "Corrigido pelo admin" e "Sem motivo padronizado") e `noPhoto` (paradas `NONE` por motivo).
- `lib/storage.ts`: pasta privada `reports/` (URL assinada também para ela).

**Web**
- **Fila offline:** operações `message`, `report` (com a foto) e `hookOutcome`; a faixa "N entregas
  guardadas" só conta entrega; desfecho recusado leva junto só a foto/"pular" da parada.
- **E7:** bloco **Acesso** no acordeão do prédio (portaria + porteiro, portão, onde parar, obs., foto
  em tela cheia, "Sugerir correção", "Navegar até aqui"); selos da parada (✨ 1ª entrega · 🪝 tem
  gancho · 🪝 + entregar gancho) e botão de recado (o `StopRow` virou contêiner com dois botões).
- **E16 `RecadoSheet`** (pela parada e por "Avisar o cliente" na não entrega): enviado às HH:MM,
  sem sinal (guardado), cliente desligou, já enviado hoje.
- **E4:** com gancho na rota, o pop-up pergunta **"🪝 Deixou o gancho também?"** (Sim / Ficou para
  outro dia) e não avança sozinho até a resposta.
- **E11:** "Reportar problema" nas Realizadas (`ReportSheet`) → selo "reportado".
- **E12 `CourierOps`** (Perfil › Falar com a operação): WhatsApp + ocorrência (tipo, texto, foto
  comprimida) — enviada, guardada sem sinal.
- **E7 `AccessSuggestSheet`.**
- **A1 `OrderIssues`** no detalhe do pedido: o que o entregador disse, **Marcar não entregue** (com
  confirmação e nota) / **Manter entregue**, e a correção registrada.
- **`CourierReports`** (novo): Gestão › Entregadores › "Problemas e ocorrências" (abertos/todos,
  foto, corrigir/manter/resolver). O selo do card de Entregadores soma pagamentos + reportes.
- **A6 `CondoForm`** com abas **Dados · Blocos · Acesso** (`CondoAccessTab`: campos, "tem porteiro"
  que desmarca, foto com upload, sugestões Aplicar/Descartar); selo "N sugestões de acesso" na
  lista de Condomínios.
- **A7 `AdminGanchos`:** estado do gancho ("Na rota de 03/10 · ☀️ Manhã · Antônio", "Ficou para
  outro dia · voltou para a fila", "Entregue por …", rota vencida), **Enviar na rota**
  (`HookRouteSheet`: data, turno, entregador da rota) / **Tirar da rota**.
- **A10 `RelEntregas`:** motivos padronizados com barras e %, cartão "N entregas sem foto · M
  'local sem luz'", exportação com os dois.
- **C3 `SettingsScreen`:** switch **"Recados do entregador"** (V-3).

**Testes novos**
- api (+25): `courier-ops.test.ts` (10: recado com permissão/opt-out/repetido/parada de outro,
  problema e idempotência, ocorrência com foto privada, sugestão sem duplicar, gancho sim/não/de
  outro, devolução na não entrega), `admin-orders-correction.test.ts` (2: H-2 sem push nem
  crédito, fecha o reporte), `admin-condominiums-access.test.ts` (3: salvar, aplicar troca o campo,
  Outro soma, descartar, revisada → 409), `admin-hooks-route.test.ts` (4), `admin-courier-reports`
  (2), `courier.service` (+1 selos/acesso), relatório de entregas (+1), `courier.route.test.ts`
  (+2: 409 com `code`, reporte e gancho).
- web (+32): fila (+5), `OpsSheets.test.tsx` (12: recado, problema, acesso, selos, pergunta do
  gancho, ocorrência), `CourierScreen` (+5: acesso + recado + sugestão, recado sem sinal, gancho no
  scan, reportar nas Realizadas, ocorrência pelo Perfil), `CourierOpsAdmin.test.tsx` (7: A1 H-2,
  manter, problemas e ocorrências, enviar na rota, sem entrega, aba Acesso, A10),
  `AdminGanchos` (+1), `SettingsScreen.recados` (2).
- shared (+2): `readCondoAccess` e `ACCESS_FIELD_KEY`.

**Verificação:** typecheck (api + web + shared) ✅ · `vite build` ✅ · api **1.936 + 3 todo** (+25)
· web **633 + 17 todo** (+32) · shared **110 + 4 todo** (+2). Sem mudança no schema (os campos e
modelos vieram na Onda 1).

**Divergências**
- **V-68:** a foto da ocorrência (E12) vai para a pasta **privada** `reports/` (URL assinada no
  admin), como a do comprovante — o plano só dizia `photoUrl`. Política do bucket na 2.4 do
  checklist.
- **V-69:** tela nova **"Problemas e ocorrências"** (Gestão › Entregadores), fora do design: é onde
  a foto da ocorrência aparece e onde dá para resolver sem achar o pedido. O A1 continua com as
  mesmas ações. O selo do card de Entregadores soma pagamentos e reportes em aberto.
- **V-70:** a foto da entrada do prédio sobe em `POST /admin/condominiums/access-photo` (sem `:id`),
  para valer também no cadastro de um condomínio novo.
- **V-71:** o bug do `approxLocation` (§4.2) já estava corrigido no formulário (só manda a
  coordenada que o admin editou); nada a fazer.
- **V-72:** a **não entrega** da parada devolve sozinha o gancho da rota para a fila — sem
  entrega, o gancho não foi deixado.
- **V-73:** o gancho só vai num dia/turno em que o cliente **tem entrega** (próximos 7 dias); o
  entregador é gravado no envio quando já atribuído e, senão, no despacho da divisão.
- **V-74:** "Sugerir correção" do acesso **precisa de sinal** (não entra na fila offline); recado,
  reporte, ocorrência e gancho entram.
- **V-75:** o cartão antigo de motivos em texto livre do `RelEntregas` só aparece para período sem
  motivo padronizado (dados antigos).
- **V-76:** recado só para paradas **de hoje** (409 `NOT_TODAY`).
- **V-77:** os avisos novos ao admin abrem `/admin` (a navegação do admin é por estado, sem rota por
  tela), como os das ondas anteriores.
- **V-52 resolvida:** "Falar com a operação" no Perfil abre o E12 (WhatsApp + ocorrência).

### Onda 9 — concluída em 02/10/2026 · **sem commit**

**Decisões do usuário (02/10/2026, passo a passo):** apagar a posição ao encerrar · foto da
ocorrência também com 90 dias · seção própria do entregador na Política · uma linha nos Termos.

**Textos legais** (`apps/web/src/content/legal.ts`, `LEGAL_UPDATED_AT` → 02/10/2026)
- **Política de Privacidade:**
  - "Quais dados guardamos": linha da **entrega** (horário, situação e a foto);
  - "Com quem compartilhamos": o entregador **nunca vê telefone nem e-mail**;
  - seção nova **Foto da entrega**: na entrega e na não entrega (porta/portaria), privada, sem
    endereço público, só o cliente e a equipe veem por link de poucos minutos, apagada em 90 dias
    ("foto expirada");
  - seção nova **Recados do entregador**: modelos prontos, sem texto livre, 1 por dia; chega como
    notificação; nenhum dos dois vê o telefone do outro; desligar em Perfil › Notificações ›
    Recados do entregador;
  - seção nova **Se você é entregador**: dados do cadastro e para quê; o cliente vê só o primeiro
    nome e a foto; o crachá na portaria; **localização só depois de "Iniciar rota" e com o app
    aberto, só a última posição (e o ponto de partida por GPS), nunca a trilha, apagada quando a
    rota termina; os clientes não veem**; "Navegar" abre o app de mapas escolhido; fotos enviadas
    apagadas em 90 dias;
  - "Por quanto tempo": fotos de entrega e de ocorrências, 90 dias; localização, só durante a rota.
- **Termos de Uso** ("Pedidos e pãezins"): o entregador pode fotografar o pedido deixado na porta.

**API**
- **Localização só durante a rota:** `CourierRunService.end` apaga `lastLat`/`lastLng`/`lastPosAt` e
  `startLat`/`startLng` (`RUN_POSITION_CLEARED`). `lib/courier-position-cleanup.ts`
  (`clearStaleCourierPositions`) apaga das rotas de **dias anteriores** que ainda têm posição (as
  que ficaram sem encerrar e as encerradas antes desta regra). Roda no `daily-jobs` da meia-noite,
  num try/catch próprio.
- **Foto da ocorrência com 90 dias:** `GET /admin/courier-reports` ganha `photoExpired` (no schema
  de resposta). Com mais de 90 dias desde o reporte (`isProofExpired`), não assina a URL.
- `lib/storage.ts`: o cabeçalho cita `reports/` na política e na regra de 90 dias.

**Web**
- **`CourierReports`** (Problemas e ocorrências): selo **"foto expirada (90 dias)"** no lugar da
  miniatura.

**Infra (§8) → checklist** (`checklist-deploy-app-entregador.md`, pronto para executar)
- 2.4: regra de ciclo de vida (`deliveries/` + `reports/`) com o JSON, o aviso de que o `put`
  substitui as regras e o caso do versionamento; política do bucket com a lista de prefixos públicos
  (incluindo os novos `couriers/` e `condos/`) e o aviso de CDN; permissão IAM das pastas privadas.
- 2.5: `SUPPORT_WHATSAPP_PROD` (só dígitos, entra no build: criar antes do deploy do front).
- 2.5b: OSRM e Nominatim públicos, nada a criar; saída HTTPS do container conferida na 4.1.
- 2.5c (novo): textos legais publicados sem revisão jurídica.
- 4.1/4.3: log da faxina de posições, traçado do OSRM na VPS, WhatsApp real, `/privacidade`,
  `reports/` negado, `products/` ainda aberto, posição nula depois de encerrar.
- §5 Onda 9: roteiro dos textos, da posição e da foto expirada. §6 e §7 atualizados.

**Testes novos**
- api (+4): `courier-position-cleanup.test.ts` (2: filtro por dia BRT + só quem tem posição; campos
  apagados), `courier-runs` (+1: encerrar apaga posição e partida), `admin-courier-reports` (+1: >
  90 dias → expirada, sem URL).
- web (+5): `content/__tests__/legal.test.ts` (4: o texto acompanha `PROOF_RETENTION_DAYS`, recados
  com opt-out e sem telefone, localização só na rota e apagada, Termos), `CourierOpsAdmin` (+1:
  selo "foto expirada").

**Verificação:** typecheck (api + web + shared) ✅ · `vite build` ✅ · api **1.940 + 3 todo** (+4)
· web **638 + 17 todo** (+5) · shared **110 + 4 todo**. Sem mudança no schema.

**Final das Ondas 0–9 (base → hoje):** api 1.736 → **1.940** (+204) · web 426 → **638** (+212) ·
shared 82 → **110** (+28). Todos verdes.

**Divergências**
- **V-78:** **encerrar a rota apaga a posição** (a última e o ponto de partida por GPS), e a faxina
  da meia-noite apaga das rotas de dias anteriores. T-9 só dizia "só a última"; o texto legal pede
  "só durante a rota". Efeito visível: o card de rota **encerrada** do A2 deixa de mostrar "posição
  há N min". Rota que ninguém encerra guarda a posição até a meia-noite (checklist §7).
- **V-79:** a foto da **ocorrência** (`reports/`) também vale **90 dias**: regra de ciclo de vida
  para os dois prefixos, e o admin vê "foto expirada (90 dias)" (contado da criação do reporte, pelo
  mesmo `isProofExpired`). Antes, ela não tinha prazo.
- **V-80:** a Política ganhou a seção **"Se você é entregador"** (cadastro, o que o cliente e a
  portaria veem, localização, navegação e fotos), além das seções **"Foto da entrega"** e **"Recados
  do entregador"**. A Onda 9 só pedia os três pontos.
- **V-81:** os **Termos de Uso** ganharam uma linha sobre a foto da entrega ("Pedidos e pãezins").
- **V-82:** o **UAT em aparelho real** (item 1 desta onda) fica com o usuário, no roteiro do
  checklist (2.2 + §5). Não entra neste registro.
- **V-83:** os **passos de infra** (item 3) são manuais e ficam no deploy acompanhado: o checklist
  ganhou os comandos prontos (AWS CLI/console). Achado novo: se houver **CDN** na frente do bucket, a
  permissão dela também não pode cobrir as pastas privadas (2.4).
- **V-84:** os textos legais continuam **sem revisão jurídica** (decisão de 30/09). As seções novas
  estão listadas na 2.5c do checklist para quando o jurídico revisar.
- **V-85 (correção pós-onda, 05/10/2026):** no Perfil (E14), o cartão do topo (foto, nome, telefone)
  aparecia **cortado**. A coluna do `CourierPage` tinha altura fixa e rolagem, e quando o conteúdo
  passava da tela os `CRCard` (`overflow: hidden`) encolhiam. A coluna passou para um filho sem
  altura fixa dentro do contêiner que rola. Isso vale para todas as telas sobrepostas (Perfil,
  Crachá, Ganhos, Números, Escala, Operação).
- **V-86 (pedido do usuário, 05/10/2026):** o E17 **Meus números** não mostra mais **Km estimado** nem
  **Combustível estimado**, que ficam só para o admin (A9). O `GET /courier/stats` também deixou de
  devolver `km`/`fuel` (sai do schema, da consulta e do tipo do web). Na tela vazia, "Entregas"
  ocupa a linha inteira.

### Onda 10 — concluída em 05/10/2026 · **sem commit**

**API**
- **`lib/route-config.ts`** (T-18): `entregadorVeCombNumeros` (padrão `false`), `entregadorVeCombFimRota`
  (`false`), `entregadorVeCombGanhos` (`true`) no `RouteConfig`, nas chaves de `Setting` e no
  `ROUTE_SEED_DEFAULTS` (o boot cria se faltar). `setRouteConfig` mantém o gravado quando o campo não
  vem (T-19).
- **`PATCH/GET /admin/settings/rotas`:** os três no zod (opcionais) e no JSON schema.
- **Entregador** (T-20/T-21, o servidor filtra):
  - `GET /courier/stats`: `fuelVisible`; com o switch, `km` e `fuel` voltam (desfaz a V-86); sem
    ele, as chaves nem vêm;
  - `GET /courier/runs/:slotId/summary` e `POST /courier/runs/:id/end`: `RunSummary.fuelVisible` +
    `courierRunSummary()` no controller (desligado → `km`/`fuel`/`fuelReason` null). O encerramento
    continua congelando km e combustível na rota (A9 e pagamento);
  - `GET /courier/earnings`: `fuelDetailVisible`; desligado → `current.km` null, base da conta
    null, `SEM_CONSUMO`/`SEM_PRECO`/`SEM_KM` viram null, `NAO_PAGA`/`NAO_USA` ficam, `fuel` fica;
  - `GET /courier/me`: `showFuel` (algum dos três ligado).

**Web**
- **A5 `AdminRotasConfig`:** seção **"O que o entregador vê"** com os três switches e a nota "Vale
  para todos os entregadores. Você continua vendo tudo nos relatórios e nos pagamentos. A distância
  da rota aparece sempre." Os três vão no salvar.
- **E17 `CourierNumbers`:** "Km estimado" e "Combustível estimado" só com `fuelVisible`.
- **E10 `CourierEndRun`:** sem `fuelVisible`, nem o cartão nem o aviso de combustível no resumo, e a
  rota concluída mostra **"1h28 · na rua"** no lugar do km (T-22).
- **E13 `CourierEarnings`:** sem `fuelDetailVisible`, "Combustível estimado ≈ R$ X" sem a fórmula, e
  o aviso do sem-modalidade sem o km.
- **E14 `CourierProfile`:** "Usado no combustível estimado" só com `showFuel`.

**Testes novos**
- api (+9): `route-config` (padrões + leitura + PATCH sem os campos mantém), `admin-settings.rotas-route`
  (+1: switches repassados e serializados), `courier-me` (+2: `showFuel`; stats com o switch),
  `courier-runs` (+1: escondido por padrão, encerramento congela; ligado mostra),
  `courier-earnings` (+2: desligado sem km/conta com o valor; `NAO_PAGA` mantido),
  `courier.route` (+2: serialização de `fuelVisible`/`km`/`fuel` e do resumo escondido; `showFuel` e
  `fuelDetailVisible` nos existentes).
- web (+6): A5 (+1: padrões e salvar), `CourierScreen` (+1: Fim da rota escondido com "na rua"),
  `CourierEarnings` (+2), `CourierPeople` (+2: Meus números ligado; Perfil sem a frase).

**Verificação:** typecheck (api + web + shared) ✅ · `vite build` ✅ · api **1.949 + 3 todo** (+9)
· web **644 + 17 todo** (+6) · shared **110 + 4 todo**. Sem mudança no schema do Prisma (só
`Setting`).

**Divergências**
- **V-86 substituída:** o km e o combustível de Meus números voltam atrás do switch (padrão
  desligado = o mesmo resultado da V-86).
- **V-87:** o app trata **flag ausente** (API antiga) pelo padrão: Meus números e Fim da rota
  escondem; Meus ganhos e o Perfil mostram.
- **V-88:** Meus ganhos desligado e combustível **R$ 0** (sem motivo a mostrar): a linha some, em vez
  de "≈ R$ 0,00".
- **V-89:** com o Fim da rota desligado, o **resumo antes de encerrar** também não mostra nada de
  combustível (nem o aviso "sem consumo/preço/traçado"). A duração já estava no resumo.
- **V-90:** a nota do A5 avisa que o admin continua vendo tudo e que a distância da rota aparece
  sempre (H-8).
- **V-91 (pedido do usuário, 05/10/2026):** **Meus ganhos também nasce desligado.** Os três switches
  começam desligados: o entregador vê o valor do combustível no pagamento, mas não o km nem a conta,
  e o Perfil não cita o consumo. No app, flag ausente também esconde. O banco de teste já tinha
  `entregadorVeCombGanhos = 'true'` gravado pelo seed (o seed não sobrescreve) e foi corrigido à mão
  para `'false'`. Em produção a chave ainda não existe e nasce `'false'` no boot.

### Onda 11 — concluída em 05/10/2026 · **sem commit**

**Handoff** copiado para `.projeto/design_handoff_cracha_v3/` (`HANDOFF.md`, 6 prints, protótipo).

**Shared**
- **`badge.ts`** (T-25): `badgeWindow` (janela de 30 s + segundos que faltam), `badgeToken` (payload
  `cdp:b1:{id}:{w}:{tag}`, tag base32 de 10 e código de 4 no alfabeto sem 0/O/1/I/L) e
  `badgeCryptoAvailable`. Web Crypto por uma interface mínima (o pacote compila só com `lib:
  ES2022`).
- **`courier.ts`** (T-33): `FUEL_TYPES` com `GNV`, `fuelUnit`, `consumptionUnit`, `fuelsFor` (GNV só
  no carro), `FuelPrices` com `gnv` e `fuelPriceFor`/`payoutProposal` com o preço do GNV.

**API**
- **Schema:** `User.badgeSecret String?` (T-23) — `db push` no `cheirin-de-pao-teste` (campo opcional
  sem índice: "already in sync"); o comentário do `courierVehicle` cita o GNV.
- **`GET /courier/badge-key`** (T-24): `{ secret, serverTime }`, `Cache-Control: no-store`, segredo de
  32 bytes base64url criado na 1ª chamada; desativado/vencido → `secret: null` sem gravar. As rotas do
  admin não expõem o segredo (respostas com JSON schema, sem o campo).
- **GNV:** `combustivelGnv` no `route-config` (`precoGnv`; ausente no PATCH mantém, null limpa; mudar
  o preço do GNV atualiza a data), zod com a mensagem "Preço do m³ do GNV…", JSON schema; os três
  cálculos (`courier-runs`, `payouts.core`, `fuel-report`) com o preço do GNV; `VehicleSchema` recusa
  GNV fora do carro e a mensagem do consumo usa a unidade.
- **Encerrar a rota** grava `summary.combustivel` (V-92); o **A9** soma **litros** e **m³** à parte, pelo
  combustível gravado (rota antiga: o cadastro de hoje).

**Web**
- **`CourierBadge` v3** reescrito: cordão, presilha, balanço ao abrir, frente/verso com a virada 3D,
  selo de vidro (Ativo · Inativo · Vencido), relógio corrigido pela hora do servidor, nome que se
  ajusta (28 → 24 → 2 linhas), "desde · válido até" (H-10), CPF, veículo (bicicleta/a pé sem placa;
  sem veículo, sem a coluna), rodapé com o QR e "0427 · XXXX" + contagem, verso com o anel de 30 s,
  estados sem foto / desativado / vencido / sem segredo / sem Web Crypto, "Falar com a operação",
  wake lock e as legendas de acessibilidade do handoff.
- **`BadgeQR`** (T-28): matriz do `qrcode-generator` (correção H) desenhada com módulos arredondados,
  olhos em anel e a marca no centro. **`useBadgeCode`**: relógio por segundo, janela e token.
- **`courierBadgeCache`** (T-27) + `fetchBadgeKey`; o `CourierScreen` grava perfil e segredo a cada
  sucesso, abre o crachá pelo cache sem sinal e apaga no Sair.
- **Tokens:** `--color-badge-card`; animações `cdp-badge-swing/breath/tick/qr` (zeradas pelo
  `prefers-reduced-motion`).
- **GNV:** A5 com o campo **GNV · R$/m³** (seção renomeada "Preço do combustível"); A3 com "GNV" só no
  carro e "Consumo (km/m³)"; `fuelFormula`, E10, A8 e E14 com a unidade; A9 com "Litros · m³" e a
  coluna "m³ (GNV)" na planilha.

**Testes novos**
- shared (+5): `badge.test.ts` (3: janela, vetor de referência calculado em Python, alfabeto e entradas
  diferentes) e GNV em `courier.test.ts` (+2: preço/unidades/carro e proposta com GNV).
- api (+10): `courier-me` (+2: segredo criado uma vez e reutilizado; inativo/vencido → null),
  `courier.route` (+2: `badge-key` sem cache e `null` serializado), `route-config` (+1: GNV mantido,
  data e limpar), `courier-runs` (+1: GNV no resumo e no encerramento), `fuel-report` (+1: m³ × litros
  pelo gravado), `admin-couriers.schema` (2: GNV só no carro; consumo com a unidade),
  `admin-settings.rotas-route` (+1: `precoGnv` e a mensagem do m³). O perfil errado → 403 é o
  `requireCourier` de sempre.
- web (+14): `CourierBadge.test.tsx` (10: frente, virar, troca do código na janela, relógio corrigido,
  sem foto, desativado, vencido, veículo/validade, sem segredo, fechar), `courierBadgeCache` (3),
  `CourierScreen` (+2: abre com QR e grava o cache; abre sem sinal pelo cache; o Sair apaga — no teste
  existente), A5 (+1: GNV), A3 (+1: GNV só no carro), `CourierEarnings` (+1: km/m³), A9 (+1: L · m³),
  Fim da rota com GNV (+1). Os 5 testes do crachá antigo saíram do `CourierPeople.test.tsx`.

**Verificação:** typecheck (api + web + shared) ✅ · `vite build` ✅ · api **1.959 + 3 todo** (+10)
· web **658 + 17 todo** (+14) · shared **115 + 4 todo** (+5). `prisma db push` no banco de teste
(`User.badgeSecret`).

**Divergências**
- **V-92:** a rota encerrada grava o **combustível** no `summary` (JSON que já existia), sem mudar o
  schema: o A9 precisa dele para separar litros de m³ mesmo se o cadastro mudar depois. Rotas antigas
  usam o cadastro de hoje.
- **V-93:** crachá ativo **sem o segredo** no aparelho (nunca abriu com sinal) mostra "Abra o app com
  sinal uma vez para gerar o QR"; sem Web Crypto (fora de HTTPS), "Este aparelho não gera o QR". O
  handoff não tinha esses dois estados.
- **V-94:** a foto tem **272 px** em tela de 844 e encolhe em tela baixa (`clamp(200px, 34vh, 272px)`);
  a tela rola se ainda faltar espaço — o handoff é só de 390 × 844.
- **V-95:** selo **"Vencido"** (o handoff só tinha "Inativo"); o relógio mostra "Sem validade" nos
  dois estados, como no handoff.
- **V-96:** o `package-lock.json` ganhou também as dependências das ondas anteriores que estavam no
  `package.json` e faltavam no lock (`@aws-sdk/s3-request-presigner`, `barcode-detector`,
  `fake-indexeddb`). O CI já resolvia pelo `npm install`; agora o lock bate.
- **V-97:** sem sinal, vale o **status da última vez** (H-11): um entregador desativado com o celular
  sem sinal ainda vê "Ativo" até o app ter sinal. A validação futura confere no servidor.
- **V-98:** o segredo fica no `localStorage` (PWA não tem Keychain — T-27) e **não há tela para trocá-lo**;
  revogar um aparelho entra junto do perfil Portaria.
- **V-99:** o preço do GNV **ausente** no PATCH mantém o gravado (A5 antigo em cache não apaga), como
  os switches da Onda 10 (T-19).
- **V-100:** a seção do A5 virou **"Preço do combustível"** (era "Preço do litro"), com o GNV na 2ª
  linha.

