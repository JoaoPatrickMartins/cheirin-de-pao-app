// financial-alerts.service.test.ts — coleta, dedupe e disparo dos alertas financeiros (⭐C1).
//
// As regras já são testadas puras em `lib/__tests__/financial-alerts.test.ts`. Aqui o alvo é o que
// só existe no serviço:
//   - a DEDUPLICAÇÃO, que é o que faz o canal sobreviver (o job roda todo dia);
//   - a chave viajar em campo PRÓPRIO, nunca dentro do corpo que o admin lê e recebe no push;
//   - o dia BRT das contas a pagar (vencer hoje ≠ vencido);
//   - falha de envio não derrubar o restante.
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { FinancialAlertsService } from '../financial-alerts.service.js'
import { NotificationsService } from '../../notifications/notifications.service.js'
import { DreService } from '../dre.service.js'

/** 10 de setembro de 2026, meio-dia BRT — 30% do mês decorrido. */
const NOW = new Date('2026-09-10T15:00:00.000Z')

const dreStub = (o: { netProfit?: number; grossMarginPct?: number; grossRevenue?: number } = {}) =>
  ({
    dre: {
      netProfit: o.netProfit ?? 1000,
      grossMarginPct: o.grossMarginPct ?? 60,
      grossRevenue: o.grossRevenue ?? 10000,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any

function makePrisma(
  opts: {
    pending?: Array<{ amount: number; dueDate: Date | null }>
    alreadySent?: Record<string, unknown> | null
  } = {},
) {
  const { pending = [], alreadySent = null } = opts
  return {
    expense: { findMany: vi.fn().mockResolvedValue(pending) },
    expenseCategory: { findMany: vi.fn().mockResolvedValue([]) },
    budget: { findMany: vi.fn().mockResolvedValue([]) },
    payment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
    notification: { findFirst: vi.fn().mockResolvedValue(alreadySent) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

function makeService(prisma: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new FinancialAlertsService({ prisma, log: { warn: vi.fn(), info: vi.fn() } } as any)
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(DreService.prototype, 'getDre').mockResolvedValue(dreStub())
})

describe('FinancialAlertsService.run', () => {
  it('não envia nada quando está tudo bem', async () => {
    const notify = vi.spyOn(NotificationsService.prototype, 'notifyAdmins').mockResolvedValue()
    const sent = await makeService(makePrisma()).run(NOW)

    expect(sent).toEqual([])
    expect(notify).not.toHaveBeenCalled()
  })

  it('envia a chave de dedupe em CAMPO PRÓPRIO, fora do corpo', async () => {
    // O corpo é lido na tela e enviado no push: uma chave escondida nele vazaria para os dois.
    const notify = vi.spyOn(NotificationsService.prototype, 'notifyAdmins').mockResolvedValue()
    await makeService(
      makePrisma({ pending: [{ amount: 200, dueDate: new Date('2026-09-01T15:00:00Z') }] }),
    ).run(NOW)

    const payload = notify.mock.calls[0][0]
    expect(payload.dedupeKey).toBe('expense-due')
    expect(payload.body).not.toContain('expense-due')
    expect(payload.body).not.toContain('#')
    expect(payload.actionRoute).toContain('contas-pagar')
  })

  it('CALA o alerta que já saiu dentro da janela de silêncio', async () => {
    const notify = vi.spyOn(NotificationsService.prototype, 'notifyAdmins').mockResolvedValue()
    const sent = await makeService(
      makePrisma({
        pending: [{ amount: 200, dueDate: new Date('2026-09-01T15:00:00Z') }],
        alreadySent: { id: 'n1' },
      }),
    ).run(NOW)

    // Sem isto, uma conta atrasada notificaria o dono 30 vezes e o toggle seria desligado.
    expect(sent).toEqual([])
    expect(notify).not.toHaveBeenCalled()
  })

  it('consulta o silêncio por tipo E por chave', async () => {
    vi.spyOn(NotificationsService.prototype, 'notifyAdmins').mockResolvedValue()
    const prisma = makePrisma({
      pending: [{ amount: 200, dueDate: new Date('2026-09-01T15:00:00Z') }],
    })
    await makeService(prisma).run(NOW)

    const where = prisma.notification.findFirst.mock.calls[0][0].where
    expect(where.type).toBe('ADMIN_EXPENSE_DUE')
    expect(where.dedupeKey).toBe('expense-due')
    expect(where.createdAt.gte).toBeInstanceOf(Date)
  })

  it('separa vencida de vence-amanhã pelo dia BRT', async () => {
    vi.spyOn(NotificationsService.prototype, 'notifyAdmins').mockResolvedValue()
    const notify = vi.spyOn(NotificationsService.prototype, 'notifyAdmins').mockResolvedValue()
    await makeService(
      makePrisma({
        pending: [
          { amount: 100, dueDate: new Date('2026-09-01T15:00:00Z') }, // vencida
          { amount: 50, dueDate: new Date('2026-09-11T15:00:00Z') }, // vence amanhã
          { amount: 70, dueDate: new Date('2026-09-10T15:00:00Z') }, // vence HOJE — não conta
          { amount: 30, dueDate: new Date('2026-09-25T15:00:00Z') }, // longe — não conta
          { amount: 20, dueDate: null }, // sem vencimento — nunca conta
        ],
      }),
    ).run(NOW)

    const body = notify.mock.calls[0][0].body
    expect(body).toMatch(/1 vencida/)
    expect(body).toMatch(/1 vence/)
    // Só os R$ 100 vencidos e os R$ 50 de amanhã entram.
    expect(body).toContain('100,00')
    expect(body).toContain('50,00')
    expect(body).not.toContain('70,00')
  })

  it('falha de envio não derruba os demais alertas', async () => {
    vi.spyOn(DreService.prototype, 'getDre').mockResolvedValue(dreStub({ netProfit: -500 }))
    const notify = vi
      .spyOn(NotificationsService.prototype, 'notifyAdmins')
      .mockRejectedValueOnce(new Error('push fora do ar'))
      .mockResolvedValue()

    const sent = await makeService(
      makePrisma({ pending: [{ amount: 200, dueDate: new Date('2026-09-01T15:00:00Z') }] }),
    ).run(NOW)

    // O primeiro falhou; o segundo (resultado negativo) saiu mesmo assim.
    expect(notify).toHaveBeenCalledTimes(2)
    expect(sent.map((a) => a.type)).toEqual(['ADMIN_RESULT_NEGATIVE'])
  })

  it('dispara o alerta de resultado negativo com a rota do DRE', async () => {
    vi.spyOn(DreService.prototype, 'getDre').mockResolvedValue(dreStub({ netProfit: -800 }))
    const notify = vi.spyOn(NotificationsService.prototype, 'notifyAdmins').mockResolvedValue()
    await makeService(makePrisma()).run(NOW)

    expect(notify.mock.calls[0][0].type).toBe('ADMIN_RESULT_NEGATIVE')
    expect(notify.mock.calls[0][0].dedupeKey).toBe('result:2026-09')
    expect(notify.mock.calls[0][0].actionRoute).toContain('dre')
  })

  it('não usa o mês anterior como base de margem quando ele não teve receita', async () => {
    // Mês anterior zerado não é queda de margem — é mês que não existiu.
    vi.spyOn(DreService.prototype, 'getDre').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (input: any) =>
        Promise.resolve(
          input.spec.month === '2026-08'
            ? dreStub({ grossRevenue: 0, grossMarginPct: 90 })
            : dreStub({ grossMarginPct: 10 }),
        ),
    )
    const notify = vi.spyOn(NotificationsService.prototype, 'notifyAdmins').mockResolvedValue()
    await makeService(makePrisma()).run(NOW)

    expect(notify).not.toHaveBeenCalled()
  })
})
