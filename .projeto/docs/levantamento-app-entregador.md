# Levantamento — Melhorias no app do Entregador

> 📝 **Status:** LEVANTAMENTO em 30/09/2026 — nada implementado, nada commitado. Branch de referência
> `feat/add-complementocliente`.
>
> ✅ **Decisões confirmadas em 30/09/2026** (passo a passo com o usuário). Estão na **§10**, que
> **prevalece sobre a §7** onde as duas divergem.
>
> ✅ **Brief das telas pronto:** [`../brief-telas-app-entregador.md`](../brief-telas-app-entregador.md),
> já atualizado com a §10.
>
> ✅ **Handoff recebido em 01/10/2026** em
> [`../design_handoff_app_entregador/`](../design_handoff_app_entregador/README.md).
>
> ✅ **Plano escrito em 01/10/2026:** [`plano-app-entregador.md`](./plano-app-entregador.md), com a
> conferência do handoff e as decisões H-1 a H-4.
>
> **Origem:** tarefa "melhorar app do entregador" (5 subtarefas do print), mais uma varredura do
> código atual do perfil COURIER (web e api) para achar lacunas e oportunidades.

---

## 1. O que existe hoje

### 1.1 Telas (web)

| Arquivo | O que faz |
|---|---|
| `apps/web/src/pages/courier/CourierLayout.tsx` | Guarda de rota (role COURIER), força definir senha, registra OneSignal + deep link |
| `apps/web/src/pages/courier/CourierScreen.tsx` | Tela única: saudação, toggle de push, card "Rota de hoje" (data + turnos), abas **Lista / Rota / Realizadas**, botão **Escanear cupom**, progresso |
| `apps/web/src/pages/courier/CourierRouteView.tsx` | Aba Rota: mapa + "ordem de paradas" com hora estimada |
| `apps/web/src/components/courier/QrScanner.tsx` | Leitor de QR em tela cheia, **só com `BarcodeDetector`** |
| `apps/web/src/components/courier/ConfirmDeliveryDialog.tsx` | Diálogo Confirmar / Não consegui entregar (motivo em texto livre) |
| `apps/web/src/components/courier/CondoAccordion.tsx` + `StopRow.tsx` | Prédio → bloco → apartamento, chips da Cestinha |
| `apps/web/src/components/courier/CourierMap.tsx` | Leaflet + tiles OSM + polilinha tracejada + marcadores numerados |
| `apps/web/src/components/courier/CourierCompletedList.tsx` | Aba Realizadas (entregues e não entregues do dia) |
| `apps/web/src/components/courier/ProgressCard.tsx` / `SegmentedControl.tsx` | Progresso (paradas e pães) e abas |

### 1.2 API

| Rota | O que faz |
|---|---|
| `GET /courier/orders/today` | Pedidos `OUT_FOR_DELIVERY` do dia (pão + Cestinha) agrupados por condomínio, concluídas do dia, turnos, e **rota OSRM calculada a cada chamada** |
| `PATCH /courier/orders/:id/confirm` | Pão → `DELIVERED` (push ao cliente, aviso ao admin, Indique e Ganhe) — responde `{ ok: true }` |
| `PATCH /courier/orders/:id/not-delivered` | Pão → `NOT_DELIVERED` com motivo opcional |
| `PATCH /courier/market-orders/:id/confirm` e `/not-delivered` | Mesmo par para parada só-Cestinha |
| Cron `sendCourierPendingReminders` | Push no minuto do turno para quem ainda não começou |
| `admin-orders.notifyCourierNewOrders` | Push "Novas entregas" quando o admin aprova a divisão |

### 1.3 Como a entrega chega ao entregador

Separação (admin) → `SEPARATED` → divisão sugerida (greedy por condomínio) → admin aprova →
`OUT_FOR_DELIVERY` + `courierId` → aparece no app do entregador. O cupom impresso na separação
leva um QR com o `orderId` (`components/admin/coupon/OrderCoupon.tsx`, `QRCodeSVG level="M"`, 28 mm)
e o código curto `#code`.

### 1.4 Infra que já existe e ajuda nas melhorias

- **Upload de imagem para o S3**: `apps/api/src/lib/storage.ts` (pastas fechadas `products | banners | receipts`), `@fastify/multipart` já registrado e `browser-image-compression` já instalado no web.
- **Categorias de despesa** `Combustível` (OPERATION) e `Entregador` (PEOPLE) já semeadas em `bootstrap/defaults-seed.ts`, e o DRE já lê despesas.
- **`@dnd-kit`** já instalado (útil para ordenar a rota à mão).
- **Coordenadas persistidas** no `Condominium` (`lat`, `lng`, `approxLocation`).
- **Gancho de porta** (`HookRequest`) com status `DELIVERED`, que diz se o cliente tem gancho.

---

## 2. Diagnóstico: problemas e lacunas no código atual

Os itens em **negrito** afetam a operação hoje, sem depender de feature nova.

| # | Achado | Onde | Impacto |
|---|---|---|---|
| G-1 | **O leitor de QR não funciona no iPhone.** Só usa `BarcodeDetector`, que o Safari não tem (fica atrás de flag experimental). No iOS cai direto em "não suportada, use a lista" | `QrScanner.tsx` | Entregador com iPhone confirma tudo à mão |
| G-2 | O comentário do `QrScanner` fala de um "campo manual para digitar o código", mas esse campo não existe; o fallback só manda usar a lista | `QrScanner.tsx` | Sem plano B quando a câmera falha |
| G-3 | **O feedback do scan é uma faixa inline no topo** que some em 3,5 s. Se o entregador rolou a lista, não vê a faixa. Quando a parada não está na lista carregada, a mensagem é genérica ("Entrega confirmada"), sem dizer de quem | `CourierScreen.tsx` `handleScan` | Não dá para conferir se o saquinho certo foi para a porta certa |
| G-4 | `confirm` responde só `{ ok: true }`, mas o schema da rota documenta `{ id, status, deliveredAt }`. O front não recebe nenhum dado da parada | `courier.controller.ts` × `courier.route.ts` | Impede o pop-up com o resumo |
| G-5 | **A rota não é otimizada.** A ordem dos prédios é a ordem em que os pedidos saem do banco (inserção no `Map`). O OSRM `/route` só traça essa ordem, embora a doc da rota diga "rota otimizada" | `courier.service.ts` `getTodayOrders` | Km e tempo a mais todo dia |
| G-6 | A rota não tem ponto de partida (base, padaria ou posição do entregador). Começa no primeiro prédio da lista | idem | O km real e a ordem ficam errados |
| G-7 | **A rota mistura turnos.** Num dia com manhã e tarde, o OSRM recebe todos os prédios juntos e a aba Rota mostra um traçado só | idem + `CourierRouteView.tsx` | O mapa da manhã inclui prédios da tarde |
| G-8 | A rota usa o servidor **público de demonstração** `router.project-osrm.org` (sem SLA, com limite de uso), e o fallback de geocodificação usa o Nominatim público. É recalculada a cada abertura da tela | `courier.service.ts`, `lib/geocode.ts` | Pode ser bloqueado ou lento em produção |
| G-9 | A hora estimada por prédio é `duração total ÷ nº de prédios × índice`, contada a partir de "agora", sem o tempo gasto dentro de cada prédio | `CourierRouteView.tsx` | O horário mostrado não bate com o real |
| G-10 | **N+1 no `getTodayOrders`**: para cada pedido faz `findUnique` do usuário e do condomínio (2 queries por parada, repetidas nas concluídas). Com 150 paradas passa de 300 queries por abertura | `courier.service.ts` | Lentidão, que piora com sinal fraco |
| G-11 | **A tela carrega uma vez só** (`useEffect` sem dependências). Não tem atualizar, puxar para recarregar nem refetch ao voltar para o app. Entregas atribuídas depois (push "Novas entregas") não aparecem sem recarregar a página | `CourierScreen.tsx` | Entrega esquecida |
| G-12 | **Sem tolerância a sinal fraco.** Corredor, elevador e garagem de condomínio derrubam a conexão. A confirmação falha com "Falha na conexão" e não existe fila de reenvio | `ConfirmDeliveryDialog.tsx`, `handleScan` | Retrabalho; entrega feita e não registrada |
| G-13 | **O cliente vê "Saiu para entrega — o entregador está a caminho" assim que o admin aprova a divisão**, que pode ser horas antes de o entregador sair de fato | `approveDivision` → `OUT_FOR_DELIVERY`; `TrackingScreen.tsx` | Expectativa errada no cliente |
| G-14 | **O card "Seu entregador" do cliente mostra "A definir" fixo no código**, mesmo com entregador atribuído | `TrackingScreen.tsx` (~l. 714) | Informação errada na tela do cliente |
| G-15 | O motivo de não entrega é só texto livre. Sem motivos padronizados, o admin não consegue gerar relatório | `ConfirmDeliveryDialog.tsx` | Não dá para medir as causas |
| G-16 | Não há como desfazer ou reportar uma confirmação errada: a parada entregue fica travada na aba Realizadas | `StopRow.tsx`, `CourierCompletedList.tsx` | Erro só chega ao admin por fora do app |
| G-17 | O botão Escanear fica no topo da tela. Com a lista rolada, é preciso subir para escanear de novo | `CourierScreen.tsx` | Uso com uma mão, no escuro |
| G-18 | O botão **Sair** desloga com um toque, sem confirmação (decisão D-08), e fica ao lado da saudação | `CourierScreen.tsx` | Logout acidental no meio da rota |
| G-19 | Não há nenhum teste de front para as telas do entregador (`pages/courier`, `components/courier`). Na api há `courier.service.test.ts`, `courier-pending-reminders.test.ts` e `courier-referral.test.ts` | — | Regressões passam despercebidas |

---

## 3. Os 5 itens do print

### E-1 · Pop-up de confirmação ao escanear o QR

**Hoje:** o scanner fecha, faz o `PATCH` e mostra a faixa inline no topo (G-3). O entregador não vê
de quem era o cupom.

**Proposta:**

1. Com a leitura do QR, confirma na hora (como pedido no print) e abre um **pop-up em tela cheia**
   por cima de tudo, com:
   - ✅ ícone grande + "Entrega confirmada";
   - **nome do cliente**, **condomínio**, **bloco (+ complemento)** e **apto**, em fonte grande;
   - quantidade de pães + chips da Cestinha (quando houver);
   - selo "1ª entrega" quando for a estreia do cliente (o cupom já tem esse dado);
   - barra de contagem regressiva (~3 s) e fechamento automático; tocar fecha antes.
2. **Botão "Escanear próximo"** no pop-up, que reabre a câmera direto (modo contínuo). Em prédio
   com muitas portas no mesmo andar, isso economiza um toque por entrega.
3. **Variantes de erro** (pop-up vermelho, sem fechar sozinho, pede "Entendi"):
   - *já confirmado*: "Esta entrega já foi confirmada às 06:42", com o resumo da parada;
   - *não é da sua rota*: mostra só "Este cupom não pertence à sua rota" (sem expor dados de outro entregador);
   - *não encontrado* / *falha de conexão*: nesse caso a confirmação vai para a fila offline (M-2).
4. **Retorno sensorial**: um bipe curto via Web Audio, liberado pelo toque em "Escanear". Vibração
   (`navigator.vibrate`) só no Android, porque o iPhone não suporta a API. Por isso o pop-up
   precisa funcionar só com o visual.
5. O mesmo pop-up de sucesso serve para a confirmação manual pela lista (`ConfirmDeliveryDialog`),
   para as duas formas de confirmar terem a mesma resposta.

**Backend:**

- `PATCH /courier/orders/:id/confirm` e `/market-orders/:id/confirm` passam a responder o **resumo
  da parada**: `{ clientName, condominiumName, block, complement, apartment, quantity, marketItems,
  deliveredAt, isFirstOrder }`. Isso também corrige G-4 e faz o pop-up funcionar mesmo quando a
  lista local está desatualizada.
- No 422 (já confirmado) da **parada do próprio entregador**, devolver o mesmo resumo + `deliveredAt`
  original. No 403, nada.

**Telas:** pop-up novo (sucesso, erro, "escanear próximo"). Precisa de brief para o Claude Design.

**Esforço:** P–M.

### E-2 · Foto para confirmar a entrega

**Hoje:** não há foto. A infra de upload para o S3 existe (§1.4).

**Proposta de fluxo:**

1. Depois do scan (ou do "Confirmar" na lista), o app pede a **foto do saquinho na porta ou no
   gancho**. A câmera abre com `<input type="file" accept="image/*" capture="environment">`, que
   abre a câmera traseira direto no iPhone e no Android, sem biblioteca.
2. A foto é comprimida no aparelho (`browser-image-compression`: ~1280 px, ~300 KB) e aparece em
   prévia com "Usar foto" ou "Tirar outra".
3. Envio: `POST /courier/orders/:id/photo` (multipart), gravando em `Order.deliveryPhotoUrl` (e em
   `MarketOrder.deliveryPhotoUrl` na parada só-Cestinha). A pasta nova `deliveries` entra no
   conjunto fechado de `UploadFolder`.
4. **Recomendado: foto também na não entrega** (portão fechado, portaria sem ninguém). É a prova
   que evita discussão sobre estorno.

**Quem vê a foto:**

- **Admin**: no detalhe do pedido (`OrderDetailSheet`) e no acompanhamento de entregas, com filtro
  "sem foto".
- **Cliente** (recomendado): "Ver foto da entrega" no acompanhamento e no histórico. Esse é o
  maior ganho de confiança da feature, e é o padrão de iFood e Loggi.

**Cuidados:**

- **Privacidade (LGPD):** a foto mostra a porta de uma residência. Hoje `uploadImage` devolve URL
  **pública**. Para essas fotos, recomendo bucket ou pasta **privada com URL assinada** (expira em
  minutos) e servida só ao dono do pedido e ao admin.
- **Retenção:** regra de ciclo de vida no S3 (ex.: apagar após 90 dias).
- **Sinal fraco:** a foto é o que mais sofre com conexão ruim. Ver D-2 (bloquear até subir ou
  confirmar e enviar a foto em segundo plano).
- **S3 não configurado:** hoje `isStorageConfigured()` pode ser `false`. Definir se a foto
  obrigatória desliga sozinha nesse caso ou se impede a confirmação.
- **Custo:** 100 entregas/dia × 300 KB ≈ 0,9 GB/mês. Desprezível.

**Esforço:** M (schema + upload + fluxo de câmera + telas admin/cliente + URL assinada).

### E-3 · Estabelecer rotas e iniciar rota pelo app

**Hoje:** ordem não otimizada, sem ponto de partida, turnos misturados, servidor público do OSRM,
sem navegação, sem "iniciar" (G-5 a G-9, G-13).

**Proposta em três partes:**

**a) Estabelecer a rota (ordem dos prédios)**

- **Ponto de partida configurável**: Setting "Base de saída" (endereço + lat/lng de onde o pão é
  retirado), com opção de usar o GPS do entregador ao iniciar.
- **Ordem automática**: usar o OSRM `/table` (matriz de tempo entre base e prédios) e ordenar no
  código (exato até ~8 prédios, heurística acima disso). O `/trip` do OSRM só aceita trajeto aberto
  com início **e** fim fixos, por isso a matriz dá mais controle. **Uma rota por turno** (corrige G-7).
- **Ordem manual salva ("rota padrão")**: o admin arrasta os prédios (`@dnd-kit`) por entregador e
  turno, e a ordem vale para os dias seguintes. Prédio novo entra na posição sugerida pela
  otimização. É a opção de quem conhece a região (atalho, portaria que abre mais cedo).
- **Persistir a rota calculada** no início (ou no despacho) em vez de recalcular a cada abertura
  (corrige parte de G-8).

**b) Iniciar a rota**

- Botão **"Iniciar rota"** no topo da aba Lista/Rota, por turno. Grava um registro de percurso
  (`CourierRun`: entregador, data, turno, `startedAt`, ponto de partida, km/tempo planejados,
  hodômetro inicial opcional; ver E-4).
- **Efeito no cliente (corrige G-13):** o "a caminho" do acompanhamento passa a depender do
  `startedAt`, não da aprovação da divisão. O status `OUT_FOR_DELIVERY` fica como está, para não
  mexer no gate da lista do entregador. Muda só o que o cliente vê.
- Durante a rota: card "**Próxima parada**" com prédio, nº de portas e pães, e o botão **Navegar**.
- **Encerrar rota**: resumo do turno (entregues, não entregues, km, duração). Se sobrar parada sem
  desfecho, o app pede para resolver antes de encerrar.

**c) Navegação e mapa**

- **"Navegar até aqui"** por prédio, abrindo o app de mapas do aparelho:
  - Google Maps: `https://www.google.com/maps/dir/?api=1&destination=LAT,LNG&travelmode=driving`
  - Waze: `https://waze.com/ul?ll=LAT,LNG&navigate=yes`
  - Apple Maps (iPhone): `maps://?daddr=LAT,LNG`
  - O entregador escolhe o app preferido uma vez e o app lembra (`localStorage`).
- Rota completa no Google Maps via `waypoints`: aceita poucos pontos (menos ainda no app mobile)
  e o Waze não aceita multi-parada. Por isso "navegar até o próximo" é o caminho principal.
  Navegação curva a curva dentro do app não vale o custo com Leaflet + OSRM grátis.
- **"Você está aqui"** no mapa (`geolocation.watchPosition`) e, opcionalmente, ao chegar a ~80 m
  de um prédio, abrir o acordeão dele sozinho.
- Seletor de turno na aba Rota quando o dia tiver manhã e tarde.
- Hora estimada por prédio com o tempo de trajeto entre paradas (da matriz) + tempo médio por
  porta (Setting, ex.: 1 min).

**Infra (decisão D-8):** subir um **OSRM próprio** na VPS (container `osrm-backend` com o recorte
OSM do estado) tira a dependência do servidor de demonstração. Alternativa: manter o público, mas
só com rota persistida e cacheada (poucas chamadas por dia).

**Esforço:** G (é o maior item). Otimização + base + rota por turno: M. Iniciar/encerrar +
efeito no cliente: M. Navegação externa: P. GPS/geofence: M.

### E-4 · Calculadora de consumo de combustível

**Dados que já temos:** km planejado da rota (OSRM) e as categorias de despesa `Combustível` e
`Entregador`.

**Proposta:**

1. **Veículo do entregador** (cadastro no admin e no perfil do entregador): tipo (moto, carro,
   bike, a pé), consumo médio **km/l**, combustível (gasolina/etanol) e placa (opcional).
2. **Preço do litro**: Setting global que o admin atualiza. O entregador pode informar o preço no
   abastecimento (item 5).
3. **Fonte do km** (decisão D-6), da mais barata à mais precisa:
   - *planejado*: km da rota otimizada, incluindo a volta à base se configurado;
   - *hodômetro*: km inicial ao "Iniciar rota" e final ao "Encerrar" (com foto opcional do painel).
     **É o recomendado**: preciso, barato e não depende de GPS;
   - *GPS*: somar o trajeto do `watchPosition`. **Pouco confiável num PWA**, porque o iPhone
     suspende a geolocalização com a tela bloqueada.
4. **Cálculo por rota**: litros = km ÷ km/l, custo = litros × preço. O `CourierRun` guarda o
   resultado. Métricas derivadas: **custo por entrega** e **custo por pão**, que alimentam margem e
   ponto de equilíbrio.
5. **Abastecimentos** (opcional, recomendado): o entregador registra valor, litros e foto do cupom
   fiscal (pasta `receipts`). Isso dá o **consumo real** (km entre abastecimentos ÷ litros) e serve
   de base para reembolso.
6. **Integração com o financeiro**: botão no admin "Lançar combustível do mês", que cria uma
   `Expense` na categoria `Combustível` (competência = mês, `payee` = entregador) a partir das
   rotas ou dos abastecimentos. Nada vira despesa automaticamente sem o admin ver.
7. **Simulador avulso**: calculadora simples (km, km/l, R$/l) para o entregador fazer contas fora
   da rota.

**Telas:** entregador (card no resumo da rota + tela "Combustível" com semana/mês + registro de
abastecimento); admin (veículo no `EntregadorForm`, preço no Settings, relatório por entregador,
botão de lançar despesa).

**Esforço:** M (cálculo + telas), G com abastecimentos e integração financeira.

### E-5 · Melhorar o leitor de QR no iPhone

**Causa (G-1):** o `QrScanner` só funciona com `BarcodeDetector`. No iPhone (Safari, e também
Chrome/Edge no iOS, que usam o mesmo motor WebKit) a API não existe, então o app mostra "não é
suportada".

**Proposta:**

1. **Decodificador em JS/WASM como fallback**, carregado sob demanda (só baixa quando o nativo não
   existe):
   - **`barcode-detector`** (polyfill da mesma API sobre zxing-cpp em WASM): mantém o código atual
     quase igual. É a **recomendação**. O `.wasm` deve ser **servido pelo próprio app** (precache
     do PWA), não pelo CDN padrão da lib;
   - alternativas: `qr-scanner` (nimiq, leve, usa web worker, mas com manutenção parada desde
     2022) e `jsQR` (JS puro, mais lento).
2. **Ajustes de câmera para iOS**:
   - pedir `facingMode: { ideal: 'environment' }` + `width/height ideal 1280×720`;
   - ler só o recorte do quadro-guia (canvas) em vez do frame inteiro. É mais rápido e erra menos;
   - no modo contínuo (E-1) **manter o stream aberto** entre leituras. No PWA instalado o iOS pode
     pedir a permissão da câmera de novo a cada abertura, e reabrir o stream piora isso;
   - `playsInline` e `muted` já estão certos.
3. **Lanterna** (botão), onde o aparelho suportar `torch`. Madrugada em corredor escuro é o cenário
   comum.
4. **Plano B de verdade (corrige G-2):** campo "Digitar código" com o `#code` curto impresso no
   cupom. O backend procura o código **só entre as paradas de hoje do próprio entregador**, o que
   evita colisão e vazamento.
5. **Cupom**: avaliar subir a correção de erro do QR de `M` para `Q` e/ou o tamanho de 28 mm, se a
   impressão térmica sair fraca. Testar com cupons reais.
6. **Validação obrigatória em aparelho real**: iPhone no Safari (aba) **e** PWA instalado; Android
   Chrome. Não dá para validar isso só com teste automatizado.

**Esforço:** P–M.

---

## 4. Melhorias recomendadas no que já existe

| # | Melhoria | Resolve | Esforço |
|---|---|---|---|
| M-1 | **Atualizar a lista**: refetch ao voltar para o app (`visibilitychange`), ao abrir pelo push e com botão/"puxar para atualizar". Aviso "3 entregas novas" quando o admin atribui mais | G-11 | P |
| M-2 | **Modo offline**: guardar a rota do dia (IndexedDB) e pôr confirmações, não entregas e fotos numa **fila com reenvio** (ao voltar o sinal, ao reabrir o app). O iPhone não tem Background Sync, então o reenvio precisa rodar com o app aberto. Selo "2 pendentes de envio". O backend aceita o horário real (`occurredAt`) e é idempotente | G-12 | M–G |
| M-3 | **Otimizar o `getTodayOrders`**: buscar usuários e condomínios em lote (`findMany` com `in`), sem N+1 | G-10 | P |
| M-4 | **Motivos padronizados de não entrega**: chips (Cliente ausente · Portaria não liberou · Endereço/apto não encontrado · Sem lugar para deixar · Pedido danificado · Outro + texto). Campo `failureCode` no pedido + relatório no admin | G-15 | P |
| M-5 | **Reportar problema numa entrega realizada** ("confirmei errado", "deixei no apto errado"): notifica o admin (tipo novo `ADMIN_COURIER_ISSUE`), que resolve pelos fluxos que já existem. Sem "desfazer" automático, porque o push de entregue já saiu para o cliente | G-16 | P |
| M-6 | **Botão Escanear fixo no rodapé** (área do polegar), sempre visível | G-17 | P |
| M-7 | **Sair dentro do Perfil** (F-1), com confirmação | G-18 | P |
| M-8 | **Indicadores na parada**: 🪝 "tem gancho" (`HookRequest DELIVERED`), 🆕 "1ª entrega" e itens da Cestinha em destaque, para o entregador saber onde e como deixar | — | P |
| M-9 | **Corrigir o "Seu entregador: A definir"** no acompanhamento do cliente: mostrar o primeiro nome (e a foto, com F-1) do entregador atribuído | G-14 | P |
| M-10 | **Tela sempre acesa durante a rota** (Screen Wake Lock), com retomada ao voltar para o app. Validar no PWA instalado do iPhone | — | P |
| M-11 | **Resumo do turno** ao concluir a última parada: entregues, não entregues, pães, tempo. Encaixa com o "Encerrar rota" de E-3 | — | P |
| M-12 | **Testes de front** para scanner (mock do detector), pop-up, fila offline e confirmação | G-19 | M |
| M-13 | **Doc da rota corrigida**: tirar "rota otimizada" até que ela seja otimizada e alinhar o schema de resposta do `confirm` | G-4, G-5 | P |

---

## 5. Features novas sugeridas

| # | Feature | Por quê | Esforço |
|---|---|---|---|
| F-1 | **Perfil do entregador**: nome, telefone, foto (que o cliente vê), veículo e consumo (E-4), app de mapas preferido, notificações, trocar senha, sair | Hoje não existe perfil; E-4 e M-7 dependem dele | M |
| F-2 | **Conferência de carregamento** antes de sair: checklist por prédio (nº de saquinhos, pães, Cestinhas), ou bipar cada saquinho na saída. Diferenças avisam o admin na hora | Evita descobrir na última porta que faltou um saquinho | M |
| F-3 | **Instruções de acesso do condomínio**: portaria, código ou horário do portão, onde estacionar, contato do zelador, foto da entrada. O admin edita no `CondoForm`, aparece no cabeçalho do prédio, e o entregador pode sugerir correções | Conhecimento que hoje fica na cabeça de quem entrega; essencial quando entrar entregador externo (requisito "estrutura futura") | M |
| F-4 | **Instruções do cliente para a entrega** ("deixar no gancho", "não tocar a campainha", "deixar com o porteiro"): campo no perfil do cliente, exibido na parada | Menos não entregas e reclamações | M (cliente + entregador) |
| F-5 | **Entregar gancho na rota**: pedidos de gancho `REQUESTED` do cliente aparecem como item extra na parada, e o entregador confirma "gancho entregue" (hoje só o admin registra) | O gancho vai junto com o pão, sem viagem extra | M |
| F-6 | **Histórico e desempenho** ("Meus números"): últimos 30 dias, entregas/dia, taxa de sucesso, tempo médio por rota, km e combustível | Motivação e base de pagamento; mesmo padrão do histórico do cliente | M |
| F-7 | **Ganhos / pagamento do entregador**: valor por entrega ou por rota, extrato, fechamento semanal que vira `Expense` na categoria `Entregador` | Pré-requisito para entregador externo | G |
| F-8 | **Disponibilidade**: o entregador marca folgas e dias disponíveis, e a sugestão de divisão (`getDivisionSuggestion`, que hoje pega todo COURIER não bloqueado) respeita isso | Evita atribuir rota a quem não vem | M |
| F-9 | **Mensagens rápidas para o cliente** por push, sem expor telefone (o acompanhamento já decidiu não mostrar telefone): "Estou na portaria", "Deixei na portaria", "Não consegui entregar, veja o app". **Opt-in**, por causa do horário da madrugada | Resolve na hora o que viraria não entrega | M |
| F-10 | **Falar com a operação**: botão para o WhatsApp do admin e para registrar ocorrência (pneu furado, atraso, acidente), com aviso ao admin | Hoje não há canal dentro do app | P |
| F-11 | **Acompanhamento em tempo real no admin**: progresso por entregador e posição no mapa (com E-3c), ETA do fim da rota | O admin sabe na hora se a rota vai atrasar | M–G |
| F-12 | **Tema escuro / alto contraste** para a madrugada (o app não tem tema escuro hoje) | Menos ofuscamento e bateria às 5 h da manhã | M (precisa de design) |

---

## 6. Priorização sugerida (ordem de execução dentro de uma versão só)

A regra é fazer primeiro o que corrige a operação de hoje e desbloqueia o resto. Tudo entra na
mesma versão, só em ondas.

| Onda | Itens | Motivo |
|---|---|---|
| 0 · Correções | M-3, M-9, M-13, G-7 (rota por turno), M-1, M-6 | Baratos, corrigem o que está errado hoje |
| 1 · Design | Brief + handoff das telas novas (§8) | Fidelidade de design é obrigatória |
| 2 · Scanner | E-5 (iPhone + digitar código) + E-1 (pop-up + resposta da API) | As duas subtarefas mais pedidas e mais baratas |
| 3 · Foto | E-2 + M-4 (motivos) + M-5 (reportar) | Prova de entrega completa |
| 4 · Offline | M-2 (fila para confirmação e foto) | A foto depende disso para não travar no corredor |
| 5 · Rota | E-3 (base, otimização, rota padrão, iniciar/encerrar, navegação, efeito no cliente) + M-10 + M-11 | Maior item; muda o que o cliente vê |
| 6 · Perfil + combustível | F-1 + E-4 | O combustível depende de veículo (perfil) e do km da rota (onda 5) |
| 7 · Extras escolhidos | F-2 … F-12 conforme a §7 | — |
| 8 · Testes e UAT | M-12 + teste em iPhone e Android reais | — |

---

## 7. Decisões a confirmar

| # | Decisão | Opções | Recomendação |
|---|---|---|---|
| D-1 | Pop-up do scan | (a) confirma na hora e mostra o resumo (como no print) · (b) mostra o resumo e pede "Confirmar" | **(a)**, com "Escanear próximo". Duração ~3 s |
| D-2 | Foto: quando e quão obrigatória | (a) obrigatória em toda entrega e bloqueia até subir · (b) obrigatória, mas confirma na hora e a foto sobe em segundo plano (fila) · (c) opcional | **(b)**: o cliente recebe o push na hora e a foto não trava no corredor sem sinal. Admin filtra "sem foto" |
| D-3 | Foto na **não entrega** | sim / não | **Sim** |
| D-4 | Cliente vê a foto? | sim / só admin | **Sim**, com URL assinada e retenção de 90 dias |
| D-5 | Ordem da rota | (a) só automática · (b) só manual salva · (c) automática como sugestão + manual salva por entregador/turno | **(c)** |
| D-6 | Ponto de partida | base fixa (Setting) / GPS ao iniciar / ambos | **Base fixa**, com GPS como alternativa |
| D-7 | "A caminho" para o cliente | (a) continua na aprovação da divisão · (b) só depois de "Iniciar rota" | **(b)** |
| D-8 | OSRM | público com cache · próprio na VPS | **Próprio na VPS** se a operação crescer. Por ora, público com rota persistida |
| D-9 | Fonte do km do combustível | planejado · hodômetro · GPS | **Hodômetro** (planejado como estimativa até ter os dados) |
| D-10 | Preço do combustível | global (admin) · informado no abastecimento | **Global**, com abastecimento opcional |
| D-11 | Combustível vira despesa? | automático · botão do admin · não integra | **Botão do admin** ("lançar do mês") |
| D-12 | Leitor iPhone | `barcode-detector` (polyfill WASM) · `qr-scanner` · `jsQR` | **`barcode-detector`**, com wasm servido pelo app |
| D-13 | Quais features da §5 entram nesta versão | F-1 … F-12 | **F-1 obrigatória** (E-4 depende). Sugiro também F-2, F-3, F-5, F-6 e F-10. F-7, F-8 e F-11 fazem mais sentido quando houver entregador externo |
| D-14 | Desfazer confirmação | desfazer em 5 s · só "reportar problema" | **Só reportar** (M-5): o push ao cliente e o Indique e Ganhe já rodaram |

---

## 8. Telas novas (vão para o Claude Design)

Seguindo o fluxo das features anteriores, depois das decisões sai o brief em
`.projeto/brief-telas-app-entregador.md` e o handoff em `.projeto/handoff-app-entregador.md`.
Redesenho de tela que já existe só entra se for só de front.

**Entregador**
1. Pop-up de resultado do scan: sucesso, já confirmado, não é da rota, erro de conexão (E-1)
2. Scanner redesenhado: lanterna, "digitar código", modo contínuo (E-5)
3. Captura e prévia da foto + estado "enviando / pendente de envio" (E-2, M-2)
4. Não entrega com chips de motivo + foto (M-4, E-2)
5. Barra "Iniciar rota", card "Próxima parada" com Navegar, seletor de turno no mapa (E-3)
6. Encerrar rota / resumo do turno (E-3, M-11)
7. Perfil do entregador + veículo (F-1, E-4)
8. Combustível: resumo, histórico, abastecimento, simulador (E-4)
9. Extras escolhidos na D-13 (conferência de carregamento, instruções do condomínio, meus números…)

**Admin**
10. Foto no detalhe do pedido + filtro "sem foto" (E-2)
11. Base de saída, tempo por porta e preço do combustível nas configurações (E-3, E-4)
12. Ordenar a rota padrão por entregador/turno (E-3)
13. Relatório de combustível por entregador + "lançar despesa" (E-4)

**Cliente**
14. "Ver foto da entrega" no acompanhamento e no histórico (E-2)
15. Card "Seu entregador" com nome e foto, e "a caminho" ligado ao início da rota (M-9, E-3)

---

## 9. Mudanças de schema previstas (sem `db push` até o plano aprovar)

| Modelo | Campo / modelo novo | Para |
|---|---|---|
| `Order`, `MarketOrder` | `deliveryPhotoKey?`, `failureCode?`, `occurredAt?` | E-2, M-4, M-2 |
| `User` (COURIER) | `vehicle?` (Json: tipo, kmPorLitro, combustível, placa), `avatarKey?`, `mapsApp?` | E-4, F-1 |
| novo `CourierRun` | courierId, date, slotId, startedAt, endedAt, start lat/lng, plannedKm, plannedMin, odometerStart/End, fuelLiters, fuelCost, orderSequence | E-3, E-4 |
| novo `CourierRouteTemplate` | courierId, slotId, condominiumIds[] (ordem) | E-3 (rota padrão) |
| novo `FuelLog` (opcional) | courierId, date, liters, amount, pricePerLiter, odometer, receiptKey | E-4 |
| `Setting` | `rotaBase` (endereço + lat/lng), `rotaMinPorPorta`, `combustivelPrecoLitro` | E-3, E-4 |
| `NotificationType` | `ADMIN_COURIER_ISSUE` (e outros de F-2/F-10, se entrarem) | M-5 |
| `UploadFolder` | `deliveries` (privada) | E-2 |

Todos os campos novos são opcionais, então valem as regras do Mongo que já estão no schema (ler com
`select` + `?? null`, nunca filtrar por `null`).

---

## 10. Decisões confirmadas (30/09/2026)

Passo a passo feito com o usuário em 4 etapas. Onde divergir da §7, **vale esta seção**.

### 10.1 Scanner e foto

| # | Decisão |
|---|---|
| D-1 ✅ | **O scan confirma na hora.** Pop-up de ~3 s com cliente, condomínio, bloco/complemento e apto em destaque, que fecha sozinho. Erros (já confirmada, outra rota, não encontrado) ficam na tela até "Entendi" |
| D-2 ✅ | **Foto obrigatória e sobe depois:** a confirmação vale na hora, e a foto é tirada em seguida na mesma câmera do scanner e sobe em segundo plano (fila offline). A saída de exceção "Não consigo tirar a foto" marca a parada como "sem foto". **A obrigatoriedade é definida pelo admin POR ENTREGADOR** (um pode ser obrigado e outro não). Para quem não é obrigado, a foto é oferecida com "Pular" |
| D-3 ✅ | **Foto também na não entrega.** A obrigatoriedade também é por entregador, com um toggle próprio |
| D-4 ✅ | **O cliente vê a foto** (acompanhamento, histórico, "Ver foto" na notificação), **se o admin ligar** nas configurações (toggle global). URL privada assinada |
| D-4b ✅ | **Retenção de 90 dias** (regra de ciclo de vida no S3) |
| D-12 ✅ | Leitor no iPhone: polyfill `barcode-detector` (decisão técnica, seguindo a recomendação). Extras aprovados: **digitar código**, **escanear próximo (modo contínuo)**, **lanterna**, **bipe + vibração** |

### 10.2 Rota

| # | Decisão |
|---|---|
| D-5 ✅ | **O sistema sugere a melhor rota ao admin, e o admin aceita.** A escolhida fica **salva** como rota padrão do entregador/turno para os próximos dias. Quando a rota muda (prédio novo, prédio que saiu), **aparece uma nova sugestão para o admin**. Ao escolher, a nova fica salva. As sugestões sempre buscam a melhor rota |
| D-5b ✅ | **O admin define por entregador se ele pode reordenar** a rota no app. A reordenação do entregador **vale só naquele dia/turno**. O admin vê a alteração e pode adotá-la como rota padrão |
| D-5c (assumido) | Enquanto o admin não decide uma sugestão nova, o dia usa a rota salva com o prédio novo inserido na posição sugerida |
| D-6 ✅ | **Partida da base** cadastrada pelo admin, com a opção "Minha localização" ao iniciar |
| D-7 ✅ | **O cliente só vê "Saiu para entrega — a caminho" depois de "Iniciar rota"** |
| D-8 (técnico) | OSRM público por ora. Com a rota salva, o cálculo só roda para gerar sugestões |
| Extras ✅ | **Navegar** (Google Maps / Waze / Apple Maps) · **Você está aqui** + chegada automática ao prédio · **Encerrar rota** com resumo e pendências · **Hora prevista real** (trajeto + tempo por porta) |

### 10.3 Combustível e pagamento

| # | Decisão |
|---|---|
| D-9 ✅ | **Km só pela estimativa da rota** (sem hodômetro nem GPS). A volta à base entra no km se o admin ligar |
| D-10 ✅ | **Preço do litro só global** (admin, gasolina/etanol). **Sem registro de abastecimento** |
| D-11 ✅ | **Lançamento pelo botão do admin**, que antes pode **aprovar, editar/corrigir ou descartar**. Nada vira despesa sozinho |
| F-7 ✅ | **Ganhos/pagamento do entregador**, com modalidade definida **no cadastro do entregador pelo admin**: **por entrega**, **por rota** ou **semanal com valor fixo**. O **combustível também é pago ao entregador**: o app calcula o valor estimado, e o admin edita e define o valor final pago. Os dois viram despesa (categorias `Entregador` e `Combustível`, favorecido = entregador) só após a aprovação do admin |

### 10.4 Features e melhorias

| # | Decisão |
|---|---|
| F-1 ✅ | **Perfil do entregador.** **Foto, veículo e consumo (opcional) são definidos pelo admin no cadastro**, não pelo entregador, que só vê. O entregador escolhe app de mapas, notificações e senha. Sair vai para o perfil, com confirmação |
| F-6 ✅ | **Meus números** (7/30 dias: entregas, sucesso, pães, tempo, km e combustível estimado) |
| F-8 ✅ | **Disponibilidade/folgas cadastradas pelo admin** (não pelo entregador). A sugestão de divisão respeita as folgas, e o entregador vê a própria escala só para leitura |
| F-3 ✅ | **Acesso do condomínio** (portaria, portão, onde parar, observações, foto da entrada), com sugestão de correção pelo entregador |
| F-5 ✅ | **Gancho na rota, por decisão do admin:** o admin marca, gancho a gancho, se ele vai na rota. Marcado, entra na parada do cliente. Não marcado, **permanece na fila de separação** como hoje |
| F-13 ✅ (novo) | **Crachá digital** no app do entregador para mostrar na portaria (foto, nome, função, status ativo, com selo animado + hora ao vivo contra print de tela) |
| F-10 ✅ | **Falar com a operação** (WhatsApp + registrar ocorrência) |
| F-9 ✅ | **Recados ao cliente** por push, com modelos prontos e sem telefone. **O admin libera ou bloqueia a função por entregador** |
| F-11 ✅ | **Mapa ao vivo no admin**: posição e progresso dos entregadores durante a rota. A localização só é compartilhada com a rota iniciada, e o entregador é avisado |
| M-2 ✅ | Modo offline (fila) |
| M-4 ✅ | Motivos padronizados de não entrega |
| M-5 ✅ | Reportar problema em entrega realizada (sem desfazer — D-14) |
| M-10 ✅ | Tela sempre acesa durante a rota |
| Sempre entram | M-1, M-3, M-6, M-7, M-8, M-9, M-12, M-13 e G-7 (correções baratas) |
| ❌ Fora | F-2 (conferência de carga) · F-4 (instruções do cliente) · F-12 (tema escuro) · hodômetro · abastecimentos |

### 10.5 Impacto no schema (atualiza a §9)

- Sai do plano: `odometerStart/End`, o modelo `FuelLog` e o km por GPS.
- Entram no `User` (COURIER), definidos pelo admin:
  - `photoRequiredOnDelivery`, `photoRequiredOnFailure`;
  - `canReorderRoute`, `canMessageClients`;
  - `payMode` (`PER_DELIVERY | PER_ROUTE | WEEKLY_FIXED`) + `payAmount`;
  - disponibilidade (dias da semana) + folgas por data (modelo próprio, ex.: `CourierTimeOff`).
- `CourierRouteTemplate` ganha o ciclo de sugestão: sugestão pendente × rota aceita, com
  `acceptedAt`/`acceptedById`.
- `CourierRun` guarda a ordem do dia quando o entregador reordena.
- Novo `CourierPayout` (proposta → aprovada/editada/descartada; valor estimado × valor final;
  vínculo às `Expense` criadas).
- `HookRequest` ganha `routeScheduledFor` (data/turno) e `courierId` quando vai na rota.
- `Setting`: `fotoClienteVisivel`, além dos que já estavam na §9.
- Posição ao vivo: guardar só a última posição por rota ativa (sem trilha histórica).
