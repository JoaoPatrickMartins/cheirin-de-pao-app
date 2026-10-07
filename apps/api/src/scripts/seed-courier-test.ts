// seed-courier-test.ts — pedidos de HOJE (turno da manhã) para testar o app do entregador de ponta
// a ponta no BANCO DE TESTE: Separação (cupom com QR) → divisão → turno oferecido → scan/foto/não
// entrega/recados/gancho → lado do cliente.
//
//   npx tsx --env-file=.env src/scripts/seed-courier-test.ts            cria (e gera a folha de QR)
//   npx tsx --env-file=.env src/scripts/seed-courier-test.ts --sheet    só gera a folha de novo
//   npx tsx --env-file=.env src/scripts/seed-courier-test.ts --clean    apaga tudo o que criou
//   … --clean --reset-terms                                             e o aceite do termo do entregador
//
// Segurança: só roda com DATABASE_URL apontando para `cheirin-de-pao-teste`. Tudo o que é criado fica
// anotado no Setting `seedCourierTest` (é por ele que o --clean sabe o que apagar). Clientes e
// condomínios de teste têm o prefixo "TESTE · ".

import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { brtDateStr, brtDayRange, brtNoonFromStr } from '../lib/cutoff.js'

const prisma = new PrismaClient()
const MANIFEST_KEY = 'seedCourierTest'
const SLOT = 'manha'
const COURIER_EMAIL = 'entregador@gmail.com'
const OWN_CLIENT_EMAIL = 'joaopatrick27@gmail.com'
const SHEET = join(tmpdir(), 'cheirin-cupons-teste.html')

interface Manifest {
  createdAt: string
  date: string
  courierId: string
  ownClientId: string | null
  users: string[]
  condos: string[]
  orders: string[]
  pastOrders: string[]
  markets: string[]
  hooks: string[]
  purchaseOrders: string[]
  courier2: string | null
  stops: Array<{ label: string; qr: string; code: string; note: string }>
  extraQrs: Array<{ label: string; qr: string; note: string }>
}

function guard() {
  const url = process.env.DATABASE_URL ?? ''
  if (!/\/cheirin-de-pao-teste(\?|$)/.test(url)) {
    console.error('❌ Recusado: este script só roda no banco cheirin-de-pao-teste. Confira o DATABASE_URL do apps/api/.env.')
    process.exit(1)
  }
}

const code6 = (id: string) => id.slice(-6).toUpperCase()

async function readManifest(): Promise<Manifest | null> {
  const row = await prisma.setting.findUnique({ where: { key: MANIFEST_KEY } })
  return row ? (JSON.parse(row.value) as Manifest) : null
}

/** Slots do condomínio de teste: os globais, manhã às 06:30. */
const SLOTS = [
  { slotId: 'manha', name: 'manha', label: 'Manhã', emoji: '☀️', time: '06:30', cutoffTime: '22:00', isActive: true },
  { slotId: 'tarde', name: 'tarde', label: 'Tarde', emoji: '🌙', time: '15:30', cutoffTime: '10:00', isActive: false },
]

async function seed() {
  if (await readManifest()) {
    console.error('⚠️  Já existem dados de teste. Rode com --clean antes de criar de novo (ou --sheet para a folha).')
    process.exit(1)
  }
  const courier = await prisma.user.findUnique({ where: { email: COURIER_EMAIL }, select: { id: true, name: true } })
  if (!courier) throw new Error(`Entregador ${COURIER_EMAIL} não encontrado`)
  const own = await prisma.user.findUnique({ where: { email: OWN_CLIENT_EMAIL }, select: { id: true, name: true, condominiumId: true, block: true, apartment: true } })
  const curumim = own?.condominiumId ? await prisma.condominium.findUnique({ where: { id: own.condominiumId }, select: { id: true, name: true, deliverySlots: true } }) : null
  const products = await prisma.product.findMany({ where: { isActive: true }, select: { id: true, name: true, price: true } })
  const geleia = products.find((p) => /geleia/i.test(p.name)) ?? products[0]
  const extra = products.find((p) => p.id !== geleia?.id && !/p[ãa]o/i.test(p.name)) ?? geleia
  if (!geleia) throw new Error('Nenhum produto ativo para a Cestinha')

  const today = brtDateStr(new Date())
  const noon = brtNoonFromStr(today)
  const weekAgo = brtNoonFromStr(brtDateStr(new Date(), -7))
  const tomorrow = brtNoonFromStr(brtDateStr(new Date(), 1))
  const stamp = Date.now()
  const m: Manifest = {
    createdAt: new Date().toISOString(),
    date: today,
    courierId: courier.id,
    ownClientId: own?.id ?? null,
    users: [],
    condos: [],
    orders: [],
    pastOrders: [],
    markets: [],
    hooks: [],
    purchaseOrders: [],
    courier2: null,
    stops: [],
    extraQrs: [],
  }
  // Grava o manifesto a cada passo: se algo falhar no meio, o --clean ainda acha o que foi criado.
  const save = () => prisma.setting.upsert({ where: { key: MANIFEST_KEY }, create: { key: MANIFEST_KEY, value: JSON.stringify(m) }, update: { value: JSON.stringify(m) } })
  await save()

  // ── Condomínios de teste (com coordenadas para a rota e o mapa) ─────────────
  const aurora = await prisma.condominium.create({
    data: {
      name: 'TESTE · Residencial Aurora',
      address: { street: 'Rua de Teste', number: '100', city: 'Campos dos Goytacazes', state: 'RJ', zip: '28015000' },
      lat: -21.7598,
      lng: -41.2958,
      type: 'BLOCKS',
      numBlocks: 2,
      deliverySlots: SLOTS,
      courierAccess: { portaria: 'Portaria principal (Rua de Teste, 100)', temPorteiro: true, portao: 'Portão de pedestres à esquerda', parar: 'Vaga de visitante na frente', obs: 'Interfone 0 para a portaria' },
    },
  })
  const belaVista = await prisma.condominium.create({
    data: {
      name: 'TESTE · Edifício Bela Vista',
      address: { street: 'Avenida de Teste', number: '200', city: 'Campos dos Goytacazes', state: 'RJ', zip: '28015001' },
      lat: -21.7531,
      lng: -41.3196,
      type: 'SINGLE_ENTRANCE',
      deliverySlots: SLOTS,
    },
  })
  m.condos.push(aurora.id, belaVista.id)
  await save()

  // ── Clientes de teste ────────────────────────────────────────────────────────
  let n = 0
  const client = async (name: string, condoId: string, block: string | null, apartment: string, extraData: Record<string, unknown> = {}) => {
    n += 1
    const u = await prisma.user.create({
      data: {
        role: 'CLIENT',
        name: `TESTE · ${name}`,
        cpf: `9${String(stamp).slice(-8)}${String(n).padStart(2, '0')}`,
        email: `seed-entregador-${stamp}-${n}@exemplo.test`,
        phone: `2299${String(stamp).slice(-5)}${String(n).padStart(2, '0')}`,
        condominiumId: condoId,
        block,
        apartment,
        creditMilli: 0,
        ...extraData,
      },
    })
    m.users.push(u.id)
    await save()
    return u
  }
  const breadOrder = async (userId: string, condoId: string, quantity: number, time = '06:30') => {
    const o = await prisma.order.create({ data: { userId, type: 'SINGLE', quantity, scheduledDate: noon, status: 'SCHEDULED', condominiumId: condoId, slotId: SLOT, deliveryTime: time } })
    m.orders.push(o.id)
    await save()
    return o
  }
  /** Entrega antiga: o cliente não conta como "1ª entrega". */
  const pastDelivery = async (userId: string, condoId: string) => {
    const o = await prisma.order.create({ data: { userId, type: 'SINGLE', quantity: 2, scheduledDate: weekAgo, status: 'DELIVERED', deliveredAt: weekAgo, condominiumId: condoId, slotId: SLOT, deliveryTime: '06:30' } })
    m.pastOrders.push(o.id)
    await save()
  }
  const cestinha = async (userId: string, condoId: string, items: Array<{ p: { id: string; name: string; price: number }; qty: number }>, breadQty: number) => {
    const total = items.reduce((s, i) => s + i.qty * i.p.price, 0) + breadQty * 0.5
    const mo = await prisma.marketOrder.create({
      data: {
        userId,
        condominiumId: condoId,
        scheduledDate: noon,
        slotId: SLOT,
        deliveryTime: '06:30',
        status: 'SCHEDULED',
        breadQty,
        items: items.map((i) => ({ productId: i.p.id, name: i.p.name, qty: i.qty, unitPrice: i.p.price })),
        totalValue: Math.round(total * 100) / 100,
        creditsAppliedMilli: 0,
        moneyAmount: 0,
        idempotencyKey: `seed-courier-test-${randomUUID()}`,
      },
    })
    m.markets.push(mo.id)
    await save()
    return mo
  }
  const stop = (label: string, qr: string, note: string) => m.stops.push({ label, qr, code: code6(qr), note })

  // Residencial Aurora (bloco A/B, com as dicas de acesso)
  const ana = await client('Ana Souza', aurora.id, 'A', '101')
  await pastDelivery(ana.id, aurora.id)
  stop('Ana Souza · Aurora · Bloco A · 101', (await breadOrder(ana.id, aurora.id, 4)).id, '4 pães — entrega simples (scan → foto)')

  const bruno = await client('Bruno Lima', aurora.id, 'A', '202')
  await pastDelivery(bruno.id, aurora.id)
  const brunoOrder = await breadOrder(bruno.id, aurora.id, 6)
  await cestinha(bruno.id, aurora.id, [{ p: geleia, qty: 2 }, ...(extra && extra.id !== geleia.id ? [{ p: extra, qty: 1 }] : [])], 0)
  stop('Bruno Lima · Aurora · Bloco A · 202', brunoOrder.id, '6 pães + Cestinha na MESMA parada (pão e Cestinha juntos)')

  const carla = await client('Carla Dias', aurora.id, 'B', '103')
  await pastDelivery(carla.id, aurora.id)
  const carlaMarket = await cestinha(carla.id, aurora.id, [{ p: geleia, qty: 1 }], 2)
  stop('Carla Dias · Aurora · Bloco B · 103', carlaMarket.id, 'SÓ Cestinha (1 geleia + 2 pães) — o QR é o id da Cestinha')

  const diego = await client('Diego Rocha', aurora.id, 'B', '204')
  stop('Diego Rocha · Aurora · Bloco B · 204', (await breadOrder(diego.id, aurora.id, 3)).id, '3 pães — ✨ 1ª ENTREGA do cliente (selo no app e no cupom)')

  const elisa = await client('Elisa Melo', aurora.id, 'A', '303')
  await pastDelivery(elisa.id, aurora.id)
  const elisaOrder = await breadOrder(elisa.id, aurora.id, 4)
  const hook = await prisma.hookRequest.create({ data: { userId: elisa.id, type: 'FREE', status: 'REQUESTED', requestedAt: new Date(), routeDate: today, routeSlotId: SLOT } })
  m.hooks.push(hook.id)
  await save()
  stop('Elisa Melo · Aurora · Bloco A · 303', elisaOrder.id, '4 pães + 🪝 GANCHO NA ROTA (pergunta "Deixou o gancho também?")')

  // Edifício Bela Vista (sem dicas de acesso: "Nenhuma dica ainda · Sugerir")
  const fabio = await client('Fábio Nunes', belaVista.id, null, '11', { courierMessagesOff: true })
  await pastDelivery(fabio.id, belaVista.id)
  stop('Fábio Nunes · Bela Vista · 11', (await breadOrder(fabio.id, belaVista.id, 2)).id, '2 pães — RECADOS DESLIGADOS pelo cliente (o recado avisa)')

  const gabi = await client('Gabi Torres', belaVista.id, null, '22')
  await pastDelivery(gabi.id, belaVista.id)
  const gabiHook = await prisma.hookRequest.create({ data: { userId: gabi.id, type: 'FREE', status: 'DELIVERED', requestedAt: weekAgo, deliveredAt: weekAgo, deliveredVia: 'ADMIN' } })
  m.hooks.push(gabiHook.id)
  await save()
  stop('Gabi Torres · Bela Vista · 22', (await breadOrder(gabi.id, belaVista.id, 5)).id, '5 pães — cliente que já tem gancho (selo 🪝)')

  const hugo = await client('Hugo Reis', belaVista.id, null, '33')
  await pastDelivery(hugo.id, belaVista.id)
  stop('Hugo Reis · Bela Vista · 33', (await breadOrder(hugo.id, belaVista.id, 4)).id, '4 pães — use para "Não consegui entregar" (motivo + foto da porta)')

  // A sua conta de cliente (lado do cliente: "Saiu para entrega", entregador, foto, recados)
  if (own && curumim) {
    const time = (curumim.deliverySlots as Array<{ slotId?: string | null; time: string }>).find((s) => s.slotId === SLOT)?.time ?? '06:30'
    stop(`${own.name} (sua conta) · ${curumim.name} · ${own.block ?? ''} · ${own.apartment ?? ''}`, (await breadOrder(own.id, curumim.id, 4, time)).id, '4 pães — entre como cliente para ver o acompanhamento, a foto e os recados')
  }

  // Pedido de OUTRO entregador (para o "Não é da sua rota"): amanhã, com um entregador de teste desativado.
  const c2 = await prisma.user.create({
    data: { role: 'COURIER', name: 'TESTE · Entregador 2', cpf: `8${String(stamp).slice(-8)}99`, email: `seed-entregador-${stamp}-c2@exemplo.test`, phone: `2298${String(stamp).slice(-5)}99`, isBlocked: true, creditMilli: 0 },
  })
  m.courier2 = c2.id
  await save()
  const iara = await client('Iara Costa', belaVista.id, null, '44')
  const other = await prisma.order.create({ data: { userId: iara.id, type: 'SINGLE', quantity: 3, scheduledDate: tomorrow, status: 'SCHEDULED', condominiumId: belaVista.id, slotId: SLOT, deliveryTime: '06:30', courierId: c2.id } })
  m.orders.push(other.id)
  m.extraQrs.push({ label: 'Cupom de OUTRO entregador', qr: other.id, note: 'Escanear → "Não é da sua rota" (pedido de amanhã do Entregador 2)' })
  m.extraQrs.push({ label: 'QR que não é cupom', qr: 'https://cheirindepao.com.br/teste-qr', note: 'Escanear → "Não achamos esse cupom"' })
  await save()

  // Pedido ao fornecedor FINALIZADO de hoje/manhã: sem ele, a Separação não mostra o turno.
  const breads = 4 + 6 + 3 + 4 + 2 + 5 + 4 + (own ? 4 : 0) + 2
  const po = await prisma.purchaseOrder.create({
    data: { date: noon, slotId: SLOT, slotLabel: 'Manhã', totalQuantity: breads, totalItems: 4, cutoffTime: new Date(brtDayRange(new Date()).start.getTime() - 2 * 60 * 60 * 1000), status: 'FINALIZED', kind: 'DELIVERY_BATCH' },
  })
  m.purchaseOrders.push(po.id)
  await save()

  writeSheet(m)
  console.log(`✅ Dados de teste criados para ${today} (manhã) · entregador ${courier.name}`)
  console.log(`   ${m.stops.length} paradas · ${m.users.length} clientes de teste · 2 condomínios de teste`)
  console.log(`   Folha com os QR: ${SHEET}`)
  console.log('   Para apagar tudo depois: npx tsx --env-file=.env src/scripts/seed-courier-test.ts --clean')
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
}

/** Folha para escanear da tela do computador: um QR grande por parada + os casos especiais. */
function writeSheet(m: Manifest) {
  const card = (title: string, qr: string, note: string, code?: string) => `
    <div class="card">
      <div class="qr" data-qr="${esc(qr)}"></div>
      <div class="info">
        <div class="t">${esc(title)}</div>
        ${code ? `<div class="code">#${esc(code)} <span>· antigo: #${esc(code.slice(-4))}</span></div>` : ''}
        <div class="n">${esc(note)}</div>
      </div>
    </div>`
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cupons de teste · entregador</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>
<style>
body{font-family:system-ui,sans-serif;background:#FAF5EC;color:#241608;margin:0;padding:24px}
h1{margin:0 0 4px;font-size:22px} p.sub{margin:0 0 20px;color:#7C6A50}
h2{font-size:15px;letter-spacing:.08em;color:#B0702A;margin:28px 0 10px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:14px}
.card{display:flex;gap:16px;align-items:center;background:#fff;border-radius:16px;padding:14px;border:1px solid #EADFCB}
.qr svg{width:180px;height:180px;display:block}
.t{font-weight:800;font-size:15px}.code{font-family:ui-monospace,monospace;font-size:18px;font-weight:700;margin-top:6px}
.code span{font-size:12px;color:#A89A82;font-weight:600}.n{color:#7C6A50;font-size:13px;margin-top:6px;line-height:1.4}
</style></head><body>
<h1>Cupons de teste · ${esc(m.date)} · manhã</h1>
<p class="sub">Escaneie da tela com o app do entregador. Também dá para digitar o código (6 caracteres, ou os 4 do cupom antigo). O cupom oficial sai na Separação.</p>
<h2>PARADAS DO TURNO</h2><div class="grid">${m.stops.map((s) => card(s.label, s.qr, s.note, s.code)).join('')}</div>
<h2>CASOS ESPECIAIS</h2><div class="grid">${m.extraQrs.map((s) => card(s.label, s.qr, s.note)).join('')}</div>
<script>
document.querySelectorAll('[data-qr]').forEach(function (el) {
  var q = qrcode(0, 'M'); q.addData(el.getAttribute('data-qr')); q.make();
  el.innerHTML = q.createSvgTag({ cellSize: 6, margin: 4, scalable: true });
});
</script></body></html>`
  writeFileSync(SHEET, html)
}

async function clean() {
  const m = await readManifest()
  if (!m) {
    console.log('Nada a limpar (sem o manifesto seedCourierTest).')
    return
  }
  const users = m.users
  const orderIds = [...m.orders, ...m.pastOrders]
  const del = async (label: string, run: () => Promise<{ count: number }>) => {
    const { count } = await run()
    if (count) console.log(`   ${label}: ${count}`)
  }
  console.log(`🧹 Limpando os dados de teste de ${m.date}…`)
  // O que os fluxos criaram durante o teste
  await del('comprovantes (clientes de teste)', () => prisma.deliveryProof.deleteMany({ where: { userId: { in: users } } }))
  if (m.ownClientId) await del('comprovante (sua conta, hoje)', () => prisma.deliveryProof.deleteMany({ where: { userId: m.ownClientId!, date: m.date } }))
  await del('rotas do entregador no dia', () => prisma.courierRun.deleteMany({ where: { courierId: m.courierId, date: m.date } }))
  await del('ofertas de turno no dia', () => prisma.courierShiftOffer.deleteMany({ where: { courierId: { in: [m.courierId, ...(m.courier2 ? [m.courier2] : [])] }, date: m.date } }))
  await del('reportes do entregador', () => prisma.courierReport.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { marketOrderId: { in: m.markets } }, { courierId: m.courierId, createdAt: { gte: new Date(m.createdAt) } }] } }))
  await del('recados', () => prisma.courierMessage.deleteMany({ where: { OR: [{ userId: { in: users } }, ...(m.ownClientId ? [{ userId: m.ownClientId, date: m.date }] : [])] } }))
  await del('sugestões de acesso', () => prisma.condoAccessSuggestion.deleteMany({ where: { condominiumId: { in: m.condos } } }))
  await del('notificações dos clientes de teste', () => prisma.notification.deleteMany({ where: { userId: { in: users } } }))
  await del('movimentos de crédito dos clientes de teste', () => prisma.creditTransaction.deleteMany({ where: { userId: { in: users } } }))
  // O que o seed criou
  await del('ganchos', () => prisma.hookRequest.deleteMany({ where: { id: { in: m.hooks } } }))
  await del('Cestinhas', () => prisma.marketOrder.deleteMany({ where: { id: { in: m.markets } } }))
  await del('pedidos', () => prisma.order.deleteMany({ where: { id: { in: orderIds } } }))
  await del('pedido ao fornecedor', () => prisma.purchaseOrder.deleteMany({ where: { id: { in: m.purchaseOrders } } }))
  await del('clientes de teste', () => prisma.user.deleteMany({ where: { id: { in: users } } }))
  if (m.courier2) await del('entregador de teste', () => prisma.user.deleteMany({ where: { id: m.courier2! } }))
  await del('condomínios de teste', () => prisma.condominium.deleteMany({ where: { id: { in: m.condos } } }))
  if (process.argv.includes('--reset-terms')) {
    await del('aceites do termo do entregador', () => prisma.legalAcceptance.deleteMany({ where: { userId: m.courierId, doc: 'COURIER_TERMS' } }))
  }
  await prisma.setting.delete({ where: { key: MANIFEST_KEY } })
  console.log('✅ Limpo.')
}

async function main() {
  guard()
  if (process.argv.includes('--clean')) return clean()
  if (process.argv.includes('--sheet')) {
    const m = await readManifest()
    if (!m) throw new Error('Sem dados de teste: rode sem --sheet para criar.')
    writeSheet(m)
    console.log(`Folha: ${SHEET}`)
    return
  }
  return seed()
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
