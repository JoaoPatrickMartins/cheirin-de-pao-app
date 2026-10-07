import { FastifyPluginAsync } from 'fastify'
import { CourierController } from './courier.controller.js'

/**
 * courierRoute — registra rotas do entregador.
 *
 * T-06-02: preHandler [fastify.authenticate, fastify.requireCourier] em AMBAS as rotas:
 * - fastify.authenticate: valida JWT e popula request.user
 * - fastify.requireCourier: bloqueia roles != COURIER com 403
 *
 * D-12: Rotas do modulo courier.
 */
// Resumo da parada (pop-up do scan, E4). O fast-json-stringify DESCARTA o que não estiver aqui.
const stopSummarySchema = {
  type: 'object',
  description: 'Resumo da parada (cliente + condomínio + turno + dia), montado no servidor.',
  properties: {
    kind: { type: 'string', description: "'BREAD' (parada com pão) | 'MARKET' (só Cestinha) | 'HOOK' (só gancho)." },
    orderId: { type: 'string', nullable: true },
    hookId: { type: 'string', description: 'O gancho da parada só de gancho.' },
    marketOrderIds: { type: 'array', items: { type: 'string' } },
    clientName: { type: 'string' },
    condominiumId: { type: 'string', nullable: true },
    condominiumName: { type: 'string' },
    block: { type: 'string', nullable: true },
    complement: { type: 'string', nullable: true },
    apartment: { type: 'string' },
    quantity: { type: 'integer', description: 'Pães da parada (pão + pães das Cestinhas).' },
    marketItems: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, qty: { type: 'integer' } } } },
    isFirstOrder: { type: 'boolean', description: 'Primeira entrega do cliente (selo "1ª entrega").' },
    hasHook: { type: 'boolean', description: 'O cliente já tem gancho de porta.' },
    hookToDeliver: { type: 'object', nullable: true, properties: { id: { type: 'string' } }, description: 'Gancho enviado nesta rota.' },
    status: { type: 'string' },
    deliveredAt: { type: 'string', nullable: true },
    failedAt: { type: 'string', nullable: true },
    proofRequired: { type: 'boolean', description: 'A regra do entregador exige foto neste desfecho.' },
  },
}

// O body da confirmação é OPCIONAL e por isso NÃO vai no schema da rota: com `body` declarado o
// Fastify recusa (400) o PATCH sem corpo que o app antigo manda. A forma é validada no controller
// (Zod `ConfirmBody`): { via?: 'SCAN'|'CODE'|'LIST', clientOpId?: string, occurredAt?: ISO }.

// Body da não entrega (E6). Ao contrário do confirm, o app sempre manda corpo aqui.
const notDeliveredBodySchema = {
  type: 'object',
  description: '`failureCode` = motivo padronizado (lista do shared); `reason` = texto, obrigatório em "OUTRO". O app antigo manda só `reason` (vira "OUTRO").',
  properties: {
    failureCode: { type: 'string', enum: ['CLIENTE_AUSENTE', 'PORTARIA_NAO_LIBEROU', 'ENDERECO_NAO_ENCONTRADO', 'SEM_LUGAR', 'PEDIDO_DANIFICADO', 'OUTRO'] },
    reason: { type: 'string', description: 'Motivo em texto (até 500).' },
    via: { type: 'string', enum: ['SCAN', 'CODE', 'LIST'] },
    clientOpId: { type: 'string' },
    occurredAt: { type: 'string' },
  },
}

// Estado do comprovante (DeliveryProof) devolvido pelo upload/skip da foto.
const proofViewSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', description: "'PENDING' | 'OK' | 'NONE' (sem foto, exceção) | 'SKIPPED' (opcional, pulou)." },
    required: { type: 'boolean' },
    outcome: { type: 'string' },
    photoAt: { type: 'string', nullable: true },
    note: { type: 'string', nullable: true, description: 'Motivo da exceção "sem foto".' },
  },
}

const alreadyResolvedSchema = {
  type: 'object',
  description: 'A parada já tem desfecho (entregue ou não entregue). Vai junto o resumo, com o horário.',
  properties: { error: { type: 'string' }, summary: stopSummarySchema },
}

export const courierRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new CourierController(fastify)

  // GET /courier/orders/today — lista ordens do dia para o entregador logado
  fastify.get(
    '/courier/orders/today',
    {
      preHandler: [fastify.authenticate, fastify.requireCourier],
      schema: {
        tags: ['courier'],
        summary: 'Pedidos do dia para o entregador',
        description: 'Retorna todos os pedidos do dia atual atribuídos ao entregador autenticado, agrupados por condomínio, com o traçado de cada turno calculado pelo OSRM (OpenStreetMap) na ordem em que os condomínios aparecem — a ordem ainda não é otimizada. Apenas entregadores com role=COURIER podem acessar.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            description: 'Pedidos do dia agrupados por condomínio (condos) + uma rota por turno (routes).',
            properties: {
              condos: {
                type: 'array',
                description: 'Condomínios da rota, cada um com seus stops (pedidos) ordenados por apartamento.',
                items: {
                  type: 'object',
                  properties: {
                    condominiumId: { type: 'string', description: 'ID do condomínio.' },
                    condominiumName: { type: 'string', description: 'Nome do condomínio.' },
                    address: { type: 'string', description: 'Endereço completo para navegação.' },
                    lat: { type: 'number', nullable: true, description: 'Latitude (null se não geocodificado).' },
                    lng: { type: 'number', nullable: true, description: 'Longitude (null se não geocodificado).' },
                    access: {
                      type: 'object',
                      nullable: true,
                      description: 'Acesso para o entregador (A6/E7). null = nenhuma dica ainda.',
                      properties: {
                        portaria: { type: 'string', nullable: true },
                        temPorteiro: { type: 'boolean', nullable: true },
                        portao: { type: 'string', nullable: true },
                        parar: { type: 'string', nullable: true },
                        obs: { type: 'string', nullable: true },
                        fotoUrl: { type: 'string', nullable: true },
                      },
                    },
                    stops: {
                      type: 'array',
                      description: 'Pedidos a entregar neste condomínio.',
                      items: {
                        type: 'object',
                        properties: {
                          orderId: { type: 'string', description: 'ID do pedido.' },
                          apartment: { type: 'string', description: 'Apartamento.' },
                          block: { type: 'string', nullable: true, description: 'Bloco (se aplicável).' },
                          complement: { type: 'string', nullable: true, description: 'Complemento do bloco (ex.: "Lado A").' },
                          clientName: { type: 'string', description: 'Nome do cliente.' },
                          quantity: { type: 'integer', description: 'Quantidade de pãezinhos.' },
                          status: { type: 'string', description: 'Status atual do pedido.' },
                          sortKey: { type: 'integer', description: 'Chave de ordenação (apartamento numérico).' },
                          slotId: { type: 'string', description: 'Turno (manha/tarde) da entrega.' },
                          slotLabel: { type: 'string', description: 'Rótulo do turno (ex.: Manhã, Tarde).' },
                          marketOrderId: { type: 'string', description: 'ID do MarketOrder (só em parada só-market — confirma por rota própria).' },
                          marketOrderIds: { type: 'array', items: { type: 'string' }, description: 'Todas as Cestinhas desta parada (cliente + turno); vazio em parada só de pão.' },
                          marketItems: { type: 'array', description: 'Itens da Cestinha nesta parada.', items: { type: 'object', properties: { name: { type: 'string' }, qty: { type: 'integer' } } } },
                          marketItemCount: { type: 'integer', description: 'Total de itens de produto da Cestinha nesta parada.' },
                          isFirstOrder: { type: 'boolean', description: '1ª entrega do cliente.' },
                          hasHook: { type: 'boolean', description: 'O cliente já tem gancho de porta.' },
                          hookToDeliver: { type: 'object', nullable: true, properties: { id: { type: 'string' } }, description: 'Gancho enviado nesta rota (A7).' },
                          hookId: { type: 'string', description: 'Parada SÓ de gancho (sem pão nem Cestinha): o gancho é a entrega; `orderId` vem vazio.' },
                          messagesOff: { type: 'boolean', description: 'O cliente desligou os recados do entregador.' },
                        },
                      },
                    },
                  },
                },
              },
              totalStops: { type: 'integer', description: 'Total de pedidos/paradas a entregar hoje.' },
              totalBreads: { type: 'integer', description: 'Total de pãezinhos a entregar hoje.' },
              totalItems: { type: 'integer', description: 'Total de itens do mini market a entregar hoje.' },
              completed: {
                type: 'array',
                description: 'Entregas já concluídas hoje (entregues ou não entregues), agrupadas por condomínio.',
                items: {
                  type: 'object',
                  properties: {
                    condominiumId: { type: 'string', description: 'ID do condomínio.' },
                    condominiumName: { type: 'string', description: 'Nome do condomínio.' },
                    stops: {
                      type: 'array',
                      description: 'Entregas concluídas neste condomínio (ordenadas por bloco/apartamento).',
                      items: {
                        type: 'object',
                        properties: {
                          orderId: { type: 'string', description: 'ID do pedido.' },
                          apartment: { type: 'string', description: 'Apartamento.' },
                          block: { type: 'string', nullable: true, description: 'Bloco (se aplicável).' },
                          complement: { type: 'string', nullable: true, description: 'Complemento do bloco (ex.: "Lado A").' },
                          clientName: { type: 'string', description: 'Nome do cliente.' },
                          quantity: { type: 'integer', description: 'Quantidade de pãezinhos.' },
                          status: { type: 'string', description: 'DELIVERED ou NOT_DELIVERED.' },
                          slotId: { type: 'string', description: 'Turno (manha/tarde) da entrega.' },
                          slotLabel: { type: 'string', description: 'Rótulo do turno.' },
                          completedAt: { type: 'string', nullable: true, description: 'Instante da conclusão (ISO 8601).' },
                          marketOrderId: { type: 'string', description: 'ID do MarketOrder (só em parada só-market).' },
                          marketOrderIds: { type: 'array', items: { type: 'string' }, description: 'Todas as Cestinhas desta linha (cliente + turno + desfecho).' },
                          marketItems: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, qty: { type: 'integer' } } } },
                          marketItemCount: { type: 'integer' },
                          hookId: { type: 'string', description: 'Parada só de gancho.' },
                          proofStatus: { type: 'string', nullable: true, description: 'Comprovante: PENDING | OK | NONE | SKIPPED (null sem registro).' },
                          reported: { type: 'boolean', description: 'O entregador já reportou problema nesta parada (E11).' },
                        },
                      },
                    },
                  },
                },
              },
              completedTotal: { type: 'integer', description: 'Total de entregas concluídas hoje.' },
              base: {
                type: 'object',
                nullable: true,
                description: 'Base de saída (null = não definida).',
                properties: { endereco: { type: 'string' }, lat: { type: 'number' }, lng: { type: 'number' } },
              },
              routeCondos: {
                type: 'array',
                description: 'Prédios de todas as rotas (inclusive os só concluídos), para o mapa.',
                items: {
                  type: 'object',
                  properties: {
                    condominiumId: { type: 'string' },
                    condominiumName: { type: 'string' },
                    lat: { type: 'number', nullable: true },
                    lng: { type: 'number', nullable: true },
                  },
                },
              },
              rules: {
                type: 'object',
                description: 'Regras do entregador definidas pelo admin.',
                properties: {
                  fotoEntrega: { type: 'boolean' },
                  fotoNaoEntrega: { type: 'boolean' },
                  podeReordenar: { type: 'boolean' },
                  podeRecados: { type: 'boolean' },
                },
              },
              slots: {
                type: 'array',
                description: 'Turnos distintos presentes na rota de hoje (ordenados por horário).',
                items: {
                  type: 'object',
                  properties: {
                    slotId: { type: 'string', description: 'ID do turno (manha/tarde).' },
                    label: { type: 'string', description: 'Rótulo do turno (ex.: Manhã).' },
                    emoji: { type: 'string', description: 'Emoji do turno (ex.: ☀️).' },
                    time: { type: 'string', description: 'Horário de entrega do turno (HH:mm).' },
                  },
                },
              },
              routes: {
                type: 'array',
                description: 'Uma rota por turno, na ordem dos turnos do dia (manhã e tarde não se misturam). Paradas sem turno (legado) entram com slotId vazio.',
                items: {
                  type: 'object',
                  properties: {
                    slotId: { type: 'string', description: 'Turno da rota (vazio = paradas sem turno).' },
                    label: { type: 'string' },
                    emoji: { type: 'string' },
                    time: { type: 'string', description: 'Horário de entrega do turno (HH:mm).' },
                    condominiumIds: { type: 'array', items: { type: 'string' }, description: 'Condomínios do turno na ordem do dia (rota salva → sugestão → ordem do entregador), inclusive os já feitos.' },
                    state: { type: 'string', description: 'pronta (não iniciada) | em_rota | encerrada.' },
                    run: {
                      type: 'object',
                      nullable: true,
                      properties: {
                        id: { type: 'string' },
                        startedAt: { type: 'string', nullable: true },
                        endedAt: { type: 'string', nullable: true },
                        startMode: { type: 'string', nullable: true, description: 'BASE | GPS | AUTO (iniciada pela 1ª confirmação).' },
                      },
                    },
                    reorderedToday: { type: 'boolean', description: 'O entregador mudou a ordem hoje (vale só hoje).' },
                    eta: {
                      type: 'array',
                      description: 'Hora prevista (HH:MM, BRT) de cada prédio: trajeto + tempo por porta. null = sem mapa.',
                      items: { type: 'object', properties: { condominiumId: { type: 'string' }, time: { type: 'string', nullable: true } } },
                    },
                    route: {
                      type: 'object',
                      nullable: true,
                      description: 'Traçado OSRM na ordem dos condomínios (null quando o OSRM falha ou há menos de 2 condomínios localizados no turno).',
                      properties: {
                        distanceKm: { type: 'string', description: 'Distância total em km (1 casa decimal).' },
                        durationMin: { type: 'integer', description: 'Duração estimada em minutos.' },
                        geometry: {
                          type: 'array',
                          description: 'Polilinha [lat, lng] para o Leaflet.',
                          items: { type: 'array', items: { type: 'number' } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    ctrl.getTodayOrders.bind(ctrl),
  )

  // PATCH /courier/orders/:id/confirm — confirma entrega de um pedido
  fastify.patch(
    '/courier/orders/:id/confirm',
    {
      preHandler: [fastify.authenticate, fastify.requireCourier],
      schema: {
        tags: ['courier'],
        summary: 'Confirmar entrega de pedido',
        description: 'Confirma a entrega de um pedido específico pelo entregador. Transiciona o status para DELIVERED, registra o timestamp de entrega e dispara uma notificação push para o cliente via OneSignal informando que o pão chegou. O entregador só pode confirmar pedidos atribuídos a ele. Responde o resumo da parada; parada que já tem desfecho responde 409 com o resumo (reenvio da mesma operação offline, com o mesmo `clientOpId`, responde 200).',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do pedido a confirmar (MongoDB ObjectId).' },
          },
        },
        response: {
          200: stopSummarySchema,
          409: alreadyResolvedSchema,
        },
      },
    },
    ctrl.confirmDelivery.bind(ctrl),
  )

  // PATCH /courier/orders/:id/not-delivered — marca a entrega como não realizada
  fastify.patch(
    '/courier/orders/:id/not-delivered',
    {
      preHandler: [fastify.authenticate, fastify.requireCourier],
      schema: {
        tags: ['courier'],
        summary: 'Marcar entrega como não realizada',
        description:
          'Registra que um pedido não pôde ser entregue, transicionando o status para NOT_DELIVERED com o motivo padronizado (`failureCode`) e o texto. O entregador só pode marcar pedidos atribuídos a ele. O crédito do cliente permanece debitado (estorno é decisão manual do admin). Responde o resumo da parada (a foto da não entrega vem em seguida); 409 com o resumo quando a parada já tem desfecho.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', description: 'ID do pedido (MongoDB ObjectId).' } },
        },
        body: notDeliveredBodySchema,
        response: {
          200: stopSummarySchema,
          409: alreadyResolvedSchema,
        },
      },
    },
    ctrl.markNotDelivered.bind(ctrl),
  )

  // ── Cestinha: confirmar/negar parada SÓ-market (sem pedido de pão) ──
  const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string', description: 'ID do MarketOrder.' } } }

  fastify.patch(
    '/courier/market-orders/:id/confirm',
    {
      preHandler: [fastify.authenticate, fastify.requireCourier],
      schema: {
        tags: ['courier'],
        summary: 'Confirmar entrega de parada só-market',
        description: 'Confirma a entrega de uma Cestinha em parada sem pedido de pão (MarketOrder → DELIVERED). Paradas combinadas pão+Cestinha são confirmadas pelo pedido de pão. Restrito ao entregador dono da entrega. Responde o resumo da parada; 409 com o resumo quando ela já tem desfecho.',
        security: [{ bearerAuth: [] }],
        params: idParam,
        response: { 200: stopSummarySchema, 409: alreadyResolvedSchema },
      },
    },
    ctrl.confirmMarketDelivery.bind(ctrl),
  )

  fastify.patch(
    '/courier/market-orders/:id/not-delivered',
    {
      preHandler: [fastify.authenticate, fastify.requireCourier],
      schema: {
        tags: ['courier'],
        summary: 'Marcar parada só-market como não realizada',
        description: 'Registra que uma Cestinha em parada só-market não pôde ser entregue (MarketOrder → NOT_DELIVERED), com o motivo padronizado. Responde o resumo; 409 quando a parada já tem desfecho.',
        security: [{ bearerAuth: [] }],
        params: idParam,
        body: notDeliveredBodySchema,
        response: { 200: stopSummarySchema, 409: alreadyResolvedSchema },
      },
    },
    ctrl.markMarketNotDelivered.bind(ctrl),
  )

  // Parada SÓ de gancho (plano-gancho-sozinho-na-rota): mesmas regras e respostas da parada de pão.
  fastify.patch(
    '/courier/hooks/:id/confirm',
    {
      preHandler: [fastify.authenticate, fastify.requireCourier],
      schema: {
        tags: ['courier'],
        summary: 'Confirmar parada só de gancho',
        description:
          'Gancho na rota do entregador hoje, sem pão nem Cestinha do cliente no turno: fica entregue pelo entregador (push "Seu gancho chegou!") e o desfecho entra no comprovante. ' +
          '403 gancho de outro entregador · 404 fora da rota de hoje · 409 com o resumo quando já tem desfecho · 422 o cliente passou a ter pão no turno.',
        security: [{ bearerAuth: [] }],
        params: idParam,
        response: { 200: stopSummarySchema, 409: alreadyResolvedSchema },
      },
    },
    ctrl.confirmHookStop.bind(ctrl),
  )

  fastify.patch(
    '/courier/hooks/:id/not-delivered',
    {
      preHandler: [fastify.authenticate, fastify.requireCourier],
      schema: {
        tags: ['courier'],
        summary: 'Parada só de gancho não realizada',
        description: 'O gancho volta para a fila com o motivo padronizado (o card do admin mostra). Responde o resumo; 409 quando a parada já tem desfecho.',
        security: [{ bearerAuth: [] }],
        params: idParam,
        body: notDeliveredBodySchema,
        response: { 200: stopSummarySchema, 409: alreadyResolvedSchema },
      },
    },
    ctrl.markHookNotDelivered.bind(ctrl),
  )

  // GET /courier/stops/lookup?code= — E3 "Digitar código"
  fastify.get(
    '/courier/stops/lookup',
    {
      preHandler: [fastify.authenticate, fastify.requireCourier],
      schema: {
        tags: ['courier'],
        summary: 'Buscar parada pelo código do cupom',
        description: 'Procura, SÓ entre as paradas de hoje do entregador, a(s) parada(s) cujo cupom termina com o código (6 caracteres; 4 para cupom impresso antes da virada). `id` é o que vai em PATCH .../confirm (pedido de pão, ou a Cestinha em parada só-Cestinha). 404 = nenhuma parada; mais de uma = o app pede para escolher. 400 = formato inválido.',
        security: [{ bearerAuth: [] }],
        querystring: { type: 'object', required: ['code'], properties: { code: { type: 'string' } } },
        response: {
          200: {
            type: 'object',
            properties: {
              matches: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    kind: { type: 'string' },
                    id: { type: 'string' },
                    summary: stopSummarySchema,
                  },
                },
              },
            },
          },
        },
      },
    },
    ctrl.lookupStops.bind(ctrl),
  )

  // POST /courier/stops/:key/proof?outcome= — foto da entrega/não entrega (E5)
  fastify.post(
    '/courier/stops/:key/proof',
    {
      preHandler: [fastify.authenticate, fastify.requireCourier],
      schema: {
        tags: ['courier'],
        summary: 'Enviar a foto do comprovante',
        description: 'Multipart com o campo `file` (JPG/PNG/WebP até 5 MB). `key` = id do pedido de pão ou de uma Cestinha da parada; `outcome` = desfecho a que a foto pertence. A foto fica PRIVADA (lida só por URL assinada). Repetir substitui a anterior. 503 = armazenamento não configurado; 404 = a parada ainda não teve esse desfecho.',
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
        params: { type: 'object', required: ['key'], properties: { key: { type: 'string' } } },
        querystring: {
          type: 'object',
          required: ['outcome'],
          properties: { outcome: { type: 'string', enum: ['DELIVERED', 'NOT_DELIVERED'] }, clientOpId: { type: 'string' } },
        },
        response: { 201: proofViewSchema },
      },
    },
    ctrl.uploadProof.bind(ctrl),
  )

  // POST /courier/stops/:key/proof/skip — seguir sem foto
  fastify.post(
    '/courier/stops/:key/proof/skip',
    {
      preHandler: [fastify.authenticate, fastify.requireCourier],
      schema: {
        tags: ['courier'],
        summary: 'Seguir sem foto',
        description: '`NONE` = exceção da foto obrigatória ("Não consigo tirar a foto"), com `reasonCode` (CAMERA_DEFEITO | SEM_LUZ | OUTRO + `text`). `SKIPPED` = o entregador não é obrigado e pulou (422 se for obrigado). Uma foto já recebida não é sobrescrita.',
        security: [{ bearerAuth: [] }],
        params: { type: 'object', required: ['key'], properties: { key: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['outcome', 'mode'],
          properties: {
            outcome: { type: 'string', enum: ['DELIVERED', 'NOT_DELIVERED'] },
            mode: { type: 'string', enum: ['NONE', 'SKIPPED'] },
            reasonCode: { type: 'string', enum: ['CAMERA_DEFEITO', 'SEM_LUZ', 'OUTRO'] },
            text: { type: 'string' },
          },
        },
        response: { 200: proofViewSchema },
      },
    },
    ctrl.skipProof.bind(ctrl),
  )

  // ── Rota do dia (Onda 5: E8–E10) ──────────────────────────────────────────
  const runSchema = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      slotId: { type: 'string' },
      status: { type: 'string', description: 'PLANNED | STARTED | ENDED.' },
      condominiumIds: { type: 'array', items: { type: 'string' } },
      reordered: { type: 'boolean' },
      startedAt: { type: 'string', nullable: true },
      endedAt: { type: 'string', nullable: true },
      startMode: { type: 'string', nullable: true },
      plannedKm: { type: 'number', nullable: true },
      plannedMin: { type: 'integer', nullable: true },
    },
  }
  const stopRefSchema = {
    type: 'object',
    properties: {
      key: { type: 'string' },
      refId: { type: 'string', description: 'Id da parada (pão; sem pão, a 1ª Cestinha) — para a foto pendente.' },
      condominiumName: { type: 'string' },
      clientName: { type: 'string' },
      apartment: { type: 'string' },
      block: { type: 'string', nullable: true },
      outcome: { type: 'string' },
    },
  }
  const pendingSchema = {
    type: 'object',
    properties: {
      stops: { type: 'array', items: stopRefSchema, description: 'Paradas sem desfecho.' },
      noPhoto: { type: 'array', items: stopRefSchema, description: 'Paradas com foto obrigatória pendente.' },
    },
  }
  const summarySchema = {
    type: 'object',
    properties: {
      slotId: { type: 'string' },
      label: { type: 'string' },
      emoji: { type: 'string' },
      time: { type: 'string' },
      run: {
        type: 'object',
        nullable: true,
        properties: { id: { type: 'string' }, status: { type: 'string' }, startedAt: { type: 'string', nullable: true }, endedAt: { type: 'string', nullable: true } },
      },
      pending: pendingSchema,
      stats: {
        type: 'object',
        properties: {
          delivered: { type: 'integer' },
          notDelivered: { type: 'integer' },
          breads: { type: 'integer' },
          cestinhas: { type: 'integer' },
          ganchos: { type: 'integer' },
          durationMin: { type: 'integer', nullable: true },
        },
      },
      km: { type: 'number', nullable: true, description: 'Km estimado pela rota planejada (com a volta à base, se ligada). null também quando o admin esconde (fuelVisible false).' },
      fuelVisible: { type: 'boolean', description: 'O admin deixa o entregador ver km e combustível no Fim da rota (padrão false). Falso: km, fuel e fuelReason vão null.' },
      voltaBase: { type: 'boolean' },
      fuel: {
        type: 'object',
        nullable: true,
        properties: { litros: { type: 'number' }, custo: { type: 'number' }, kmPorLitro: { type: 'number' }, preco: { type: 'number' }, combustivel: { type: 'string' } },
      },
      fuelReason: { type: 'string', nullable: true, description: 'SEM_CONSUMO | SEM_PRECO | SEM_KM.' },
      next: {
        type: 'object',
        nullable: true,
        properties: { slotId: { type: 'string' }, label: { type: 'string' }, emoji: { type: 'string' }, time: { type: 'string' }, stops: { type: 'integer' } },
      },
    },
  }
  const errorSchema = { type: 'object', properties: { error: { type: 'string' } } }
  const runPre = [fastify.authenticate, fastify.requireCourier]

  fastify.post(
    '/courier/runs/start',
    {
      preHandler: runPre,
      schema: {
        tags: ['courier'],
        summary: 'Iniciar a rota do turno (E8)',
        description:
          'Inicia a rota do turno (ponto de partida: base ou a posição do GPS). Avisa cada cliente com parada pendente: "Saiu para entrega" (H-1), uma vez só — repetir devolve a mesma rota sem novo aviso. 404 sem entregas no turno; 409 rota já encerrada.',
        security: [{ bearerAuth: [] }],
        response: { 200: { type: 'object', properties: { run: runSchema, notified: { type: 'integer' } } }, 404: errorSchema, 409: errorSchema },
      },
    },
    ctrl.startRun.bind(ctrl),
  )

  fastify.post(
    '/courier/runs/:id/position',
    {
      preHandler: runPre,
      schema: {
        tags: ['courier'],
        summary: 'Posição atual durante a rota',
        description: 'Guarda só a ÚLTIMA posição (sem trilha, T-9), e só com a rota iniciada (409 caso contrário).',
        security: [{ bearerAuth: [] }],
        response: { 204: { type: 'null' }, 404: errorSchema, 409: errorSchema },
      },
    },
    ctrl.position.bind(ctrl),
  )

  fastify.put(
    '/courier/runs/order',
    {
      preHandler: runPre,
      schema: {
        tags: ['courier'],
        summary: 'Reordenar a rota do dia (D-5b)',
        description: 'A ordem vale só hoje. 403 sem a permissão "reordenar" dada pelo admin; 400 prédio fora da rota; 409 rota encerrada.',
        security: [{ bearerAuth: [] }],
        response: { 200: runSchema, 400: errorSchema, 403: errorSchema, 409: errorSchema },
      },
    },
    ctrl.reorder.bind(ctrl),
  )

  fastify.delete(
    '/courier/runs/order',
    {
      preHandler: runPre,
      schema: {
        tags: ['courier'],
        summary: 'Voltar à rota padrão',
        security: [{ bearerAuth: [] }],
        querystring: { type: 'object', required: ['slotId'], properties: { slotId: { type: 'string' } } },
        response: { 200: { type: 'object', properties: { run: { ...runSchema, nullable: true } } }, 409: errorSchema },
      },
    },
    ctrl.resetOrder.bind(ctrl),
  )

  fastify.get(
    '/courier/runs/:slotId/summary',
    {
      preHandler: runPre,
      schema: {
        tags: ['courier'],
        summary: 'Resumo do turno (E10)',
        description: 'Pendências (paradas sem desfecho, foto obrigatória pendente), números do turno, km e combustível estimados e o próximo turno.',
        security: [{ bearerAuth: [] }],
        response: { 200: summarySchema },
      },
    },
    ctrl.runSummary.bind(ctrl),
  )

  fastify.post(
    '/courier/runs/:id/end',
    {
      preHandler: runPre,
      schema: {
        tags: ['courier'],
        summary: 'Encerrar a rota (E10)',
        description: '422 com as pendências quando há parada sem desfecho ou foto obrigatória pendente. Encerrar de novo devolve a mesma rota.',
        security: [{ bearerAuth: [] }],
        response: {
          200: { type: 'object', properties: { run: runSchema, summary: summarySchema } },
          404: errorSchema,
          409: errorSchema,
          422: { type: 'object', properties: { error: { type: 'string' }, pending: pendingSchema } },
        },
      },
    },
    ctrl.endRun.bind(ctrl),
  )

  // ── Pessoas (Onda 6: E14, E15, E17, E18) — tudo só leitura ─────────────────
  const slotRef = { type: 'object', properties: { slotId: { type: 'string' }, label: { type: 'string' }, emoji: { type: 'string' }, time: { type: 'string' } } }

  fastify.get(
    '/courier/me',
    {
      preHandler: runPre,
      schema: {
        tags: ['courier'],
        summary: 'Meu perfil e crachá (E14/E15)',
        description: 'Dados definidos pelo admin (só leitura): foto, veículo, regras, crachá (nº, validade e se está ativo — inativo quando desativado ou vencido), o resumo de hoje, entregas em 30 dias, a escala e a próxima folga.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              firstName: { type: 'string' },
              phone: { type: 'string', nullable: true },
              since: { type: 'string' },
              photoUrl: { type: 'string', nullable: true },
              cpfMasked: { type: 'string', nullable: true },
              vehicle: {
                type: 'object',
                nullable: true,
                properties: { tipo: { type: 'string' }, modelo: { type: 'string', nullable: true }, placa: { type: 'string', nullable: true }, combustivel: { type: 'string', nullable: true }, kmPorLitro: { type: 'number', nullable: true } },
              },
              rules: { type: 'object', properties: { fotoEntrega: { type: 'boolean' }, fotoNaoEntrega: { type: 'boolean' }, podeReordenar: { type: 'boolean' }, podeRecados: { type: 'boolean' } } },
              badge: {
                type: 'object',
                properties: { number: { type: 'string', nullable: true }, validUntil: { type: 'string', nullable: true }, active: { type: 'boolean' }, reason: { type: 'string', description: 'ATIVO | DESATIVADO | VENCIDO.' } },
              },
              today: { type: 'object', properties: { slots: { type: 'array', items: slotRef }, condos: { type: 'array', items: { type: 'string' } } } },
              deliveries30: { type: 'integer' },
              scheduleLabel: { type: 'string', description: '"Seg a sáb", "Todos os dias"…' },
              nextTimeOff: { type: 'object', nullable: true, properties: { startDate: { type: 'string' }, endDate: { type: 'string' } } },
              terms: {
                type: 'object',
                description: 'Termo do Entregador Parceiro: versão vigente × a última aceita (o app bloqueia até aceitar a vigente).',
                properties: { version: { type: 'string' }, acceptedVersion: { type: 'string', nullable: true }, acceptedAt: { type: 'string', nullable: true } },
              },
              showFuel: { type: 'boolean', description: 'Alguma tela mostra combustível ao entregador (switches do A5). O Perfil cita o consumo só com true.' },
            },
          },
          404: errorSchema,
        },
      },
    },
    ctrl.me.bind(ctrl),
  )

  fastify.get(
    '/courier/badge-key',
    {
      preHandler: runPre,
      schema: {
        tags: ['courier'],
        summary: 'Segredo do QR do crachá (E15 v3)',
        description:
          'Segredo do entregador com que o aparelho gera o QR e o código de validação a cada 30 s (HMAC, `badgeToken` do shared) e a hora do servidor para corrigir o relógio do celular. Gerado na 1ª chamada. Crachá inativo ou vencido → `secret: null`. Sem cache.',
        security: [{ bearerAuth: [] }],
        response: {
          200: { type: 'object', properties: { secret: { type: 'string', nullable: true }, serverTime: { type: 'string' } } },
          404: errorSchema,
        },
      },
    },
    ctrl.badgeKey.bind(ctrl),
  )

  fastify.get(
    '/courier/stats',
    {
      preHandler: runPre,
      schema: {
        tags: ['courier'],
        summary: 'Meus números (E17)',
        description: 'Entregas (paradas), sucesso, pães, tempo médio por rota (rotas encerradas) e entregas por dia. 7 ou 30 dias (padrão 30). Km e combustível estimados só vêm com o switch "Meus números" do admin (fuelVisible).',
        security: [{ bearerAuth: [] }],
        querystring: { type: 'object', properties: { days: { type: 'integer', enum: [7, 30] } } },
        response: {
          200: {
            type: 'object',
            properties: {
              days: { type: 'integer' },
              deliveries: { type: 'integer' },
              failed: { type: 'integer' },
              successRate: { type: 'number', nullable: true, description: '0–1; null sem entregas.' },
              breads: { type: 'integer' },
              avgRouteMin: { type: 'integer', nullable: true },
              fuelVisible: { type: 'boolean', description: 'O admin deixa ver km e combustível em Meus números (padrão false). Falso: km e fuel não vêm.' },
              km: { type: 'number', nullable: true },
              fuel: { type: 'number', nullable: true },
              perDay: { type: 'array', items: { type: 'object', properties: { date: { type: 'string' }, delivered: { type: 'integer' }, failed: { type: 'integer' } } } },
              recent: {
                type: 'array',
                items: { type: 'object', properties: { date: { type: 'string' }, delivered: { type: 'integer' }, failed: { type: 'integer' }, slots: { type: 'array', items: { type: 'string' } } } },
              },
            },
          },
        },
      },
    },
    ctrl.stats.bind(ctrl),
  )

  fastify.get(
    '/courier/schedule',
    {
      preHandler: runPre,
      schema: {
        tags: ['courier'],
        summary: 'Minha escala (E18)',
        description: 'A semana (segunda a domingo) com os turnos de cada dia, folgas futuras, se hoje é folga e o próximo turno. Definida pelo admin.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              weekStart: { type: 'string' },
              weekEnd: { type: 'string' },
              slots: { type: 'array', items: slotRef },
              week: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { date: { type: 'string' }, weekday: { type: 'string' }, today: { type: 'boolean' }, off: { type: 'string', nullable: true }, slots: { type: 'array', items: slotRef } },
                },
              },
              todayOff: { type: 'string', nullable: true, description: 'FOLGA | FORA_DA_ESCALA; null = trabalha hoje.' },
              timeOffs: { type: 'array', items: { type: 'object', properties: { startDate: { type: 'string' }, endDate: { type: 'string' }, reason: { type: 'string', nullable: true } } } },
              nextShift: { type: 'object', nullable: true, properties: { date: { type: 'string' }, slotId: { type: 'string' }, label: { type: 'string' }, emoji: { type: 'string' }, time: { type: 'string' } } },
              scheduleLabel: { type: 'string' },
            },
          },
        },
      },
    },
    ctrl.schedule.bind(ctrl),
  )

  fastify.get(
    '/courier/earnings',
    {
      preHandler: runPre,
      schema: {
        tags: ['courier'],
        summary: 'Meus ganhos (E13)',
        description: 'Modalidade, semana em andamento estimada (não gravada) e o extrato: em análise · pago · a pagar. O valor final é o que a operação aprovar.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              pay: {
                type: 'object',
                nullable: true,
                properties: { modalidade: { type: 'string', nullable: true }, valor: { type: 'number', nullable: true }, pagaCombustivel: { type: 'boolean' } },
              },
              fuelDetailVisible: { type: 'boolean', description: 'O admin deixa ver a conta do combustível (padrão false). Falso: km e a base da conta vão null; o valor fica.' },
              current: {
                type: 'object',
                properties: {
                  weekStart: { type: 'string' },
                  weekEnd: { type: 'string' },
                  entregas: { type: 'integer' },
                  rotas: { type: 'integer' },
                  units: { type: 'integer' },
                  remuneration: { type: 'number' },
                  km: { type: 'number', nullable: true, description: 'null quando o admin esconde a conta do combustível (fuelDetailVisible false).' },
                  fuel: { type: 'number' },
                  fuelBasis: { type: 'object', properties: { kmPorLitro: { type: 'number', nullable: true }, preco: { type: 'number', nullable: true }, combustivel: { type: 'string', nullable: true }, reason: { type: 'string', nullable: true, description: 'NAO_PAGA · NAO_USA · SEM_KM · SEM_CONSUMO · SEM_PRECO' } } },
                  total: { type: 'number' },
                  openRuns: { type: 'integer' },
                },
              },
              extrato: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    weekStart: { type: 'string' },
                    weekEnd: { type: 'string' },
                    status: { type: 'string', description: 'EM_ANALISE · PAGO · A_PAGAR' },
                    remuneration: { type: 'number' },
                    fuel: { type: 'number' },
                    estimated: { type: 'number' },
                    final: { type: 'number' },
                    paidAt: { type: 'string', nullable: true },
                    dueDate: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    ctrl.earnings.bind(ctrl),
  )

  // ── Operação (Onda 8): recado, problema, ocorrência, acesso, gancho ─────────
  const opsErr = { type: 'object', properties: { error: { type: 'string' }, code: { type: 'string' } } }
  const opsResp = (ok: object, okStatus = 200) => ({ [okStatus]: ok, 400: opsErr, 403: opsErr, 404: opsErr, 409: opsErr, 503: opsErr })

  fastify.post('/courier/messages', {
    preHandler: runPre,
    schema: {
      tags: ['courier'],
      summary: 'Mandar recado ao cliente (E16)',
      description: 'Modelos fixos (T-16), 1 por modelo/cliente/dia. 403 sem a permissão "recados"; 409 `OPT_OUT` (o cliente desligou), `ALREADY` (já enviado hoje) ou `NOT_TODAY`. Push `COURIER_MESSAGE` ao cliente; o telefone do entregador não aparece.',
      security: [{ bearerAuth: [] }],
      body: { type: 'object', required: ['stopKey', 'template'], properties: { stopKey: { type: 'string' }, template: { type: 'string' }, clientOpId: { type: 'string' } } },
      response: opsResp({ type: 'object', properties: { sentAt: { type: 'string' } } }),
    },
  }, ctrl.sendMessage.bind(ctrl))

  fastify.post('/courier/reports', {
    preHandler: runPre,
    schema: {
      tags: ['courier'],
      summary: 'Reportar problema (E11) ou ocorrência (E12)',
      description: '`STOP_ISSUE` exige `stopKey` de uma entrega realizada (a entrega não é desfeita — a operação resolve no A1). `INCIDENT` aceita foto (`photoKey` de /courier/reports/photo). Idempotente pelo `clientOpId`. Avisa os admins.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['kind', 'type'],
        properties: { kind: { type: 'string' }, stopKey: { type: 'string' }, type: { type: 'string' }, text: { type: 'string', nullable: true }, photoKey: { type: 'string', nullable: true }, clientOpId: { type: 'string' } },
      },
      response: opsResp({ type: 'object', properties: { id: { type: 'string' }, createdAt: { type: 'string' } } }, 201),
    },
  }, ctrl.report.bind(ctrl))

  fastify.post('/courier/reports/photo', {
    preHandler: runPre,
    schema: {
      tags: ['courier'],
      summary: 'Foto da ocorrência (E12)',
      description: 'Multipart `file`. Pasta PRIVADA `reports/`; devolve a chave para o POST /courier/reports. 503 sem armazenamento.',
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
      response: opsResp({ type: 'object', properties: { photoKey: { type: 'string' } } }, 201),
    },
  }, ctrl.reportPhoto.bind(ctrl))

  fastify.post('/courier/condos/:id/access-suggestions', {
    preHandler: runPre,
    schema: {
      tags: ['courier'],
      summary: 'Sugerir correção no acesso do condomínio (E7)',
      description: 'Vai para a revisão do admin (A6: aplicar ou descartar). Repetir a mesma sugestão pendente não duplica.',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object', required: ['field', 'text'], properties: { field: { type: 'string' }, text: { type: 'string' } } },
      response: opsResp({ type: 'object', properties: { id: { type: 'string' } } }, 201),
    },
  }, ctrl.suggestAccess.bind(ctrl))

  fastify.post('/courier/hooks/:id/outcome', {
    preHandler: runPre,
    schema: {
      tags: ['courier'],
      summary: 'Desfecho do gancho enviado na rota (A7)',
      description: '`delivered: true` → entregue pelo entregador (push "Seu gancho chegou!"); `false` → volta para a fila ("ficou para outro dia"). Idempotente.',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object', required: ['delivered'], properties: { delivered: { type: 'boolean' } } },
      response: opsResp({ type: 'object', properties: { status: { type: 'string', description: 'DELIVERED · QUEUE' } } }),
    },
  }, ctrl.hookOutcome.bind(ctrl))

  // ── Termo do entregador e turnos (plano-termos-legais) ─────────────────────
  fastify.post('/courier/terms/accept', {
    preHandler: runPre,
    schema: {
      tags: ['courier'],
      summary: 'Aceitar o Termo do Entregador Parceiro',
      description: 'Grava o aceite (versão, quando, IP, navegador e aparelho). Só a versão vigente (`shared/legal.ts`); outra → 409 `OUTDATED`. Aceitar de novo a mesma versão não duplica.',
      security: [{ bearerAuth: [] }],
      body: { type: 'object', required: ['version'], properties: { version: { type: 'string' } } },
      response: opsResp({ type: 'object', properties: { version: { type: 'string' }, acceptedAt: { type: 'string' } } }),
    },
  }, ctrl.acceptTerms.bind(ctrl))

  const shiftView = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      slotId: { type: 'string' },
      label: { type: 'string' },
      emoji: { type: 'string' },
      time: { type: 'string' },
      status: { type: 'string', description: 'OFFERED (sem resposta: segue com o entregador) · ACCEPTED' },
      stops: { type: 'integer' },
      offeredAt: { type: 'string' },
    },
  }
  fastify.get('/courier/shifts', {
    preHandler: runPre,
    schema: {
      tags: ['courier'],
      summary: 'Turnos de hoje (aceitar ou recusar)',
      description: 'Turnos oferecidos na aprovação da divisão e ainda com o entregador (OFFERED ou ACCEPTED).',
      security: [{ bearerAuth: [] }],
      response: opsResp({ type: 'array', items: shiftView }),
    },
  }, ctrl.shiftsToday.bind(ctrl))

  const shiftIdParam = { type: 'object', required: ['id'], properties: { id: { type: 'string', description: 'ID da oferta do turno.' } } }
  fastify.post('/courier/shifts/:id/accept', {
    preHandler: runPre,
    schema: {
      tags: ['courier'],
      summary: 'Aceitar o turno',
      description: 'Idempotente. 409 `DECLINED` (já recusou) ou `WITHDRAWN` (a operação passou o turno a outra pessoa).',
      security: [{ bearerAuth: [] }],
      params: shiftIdParam,
      response: opsResp({ type: 'object', properties: { id: { type: 'string' }, status: { type: 'string' } } }),
    },
  }, ctrl.acceptShift.bind(ctrl))

  fastify.post('/courier/shifts/:id/decline', {
    preHandler: runPre,
    schema: {
      tags: ['courier'],
      summary: 'Recusar o turno (sem penalidade)',
      description:
        'Motivo opcional (IMPREVISTO · VEICULO · SAUDE · OUTRO). As paradas do turno voltam para a divisão sem entregador (pão, Cestinha e o gancho na rota) e os admins recebem `ADMIN_SHIFT_DECLINED`. 409 `STARTED` (a rota já começou), `PAST`, `DECLINED` ou `WITHDRAWN`.',
      security: [{ bearerAuth: [] }],
      params: shiftIdParam,
      body: { type: 'object', properties: { reason: { type: 'string', nullable: true } } },
      response: opsResp({ type: 'object', properties: { id: { type: 'string' }, status: { type: 'string' }, released: { type: 'integer' } } }),
    },
  }, ctrl.declineShift.bind(ctrl))
}
