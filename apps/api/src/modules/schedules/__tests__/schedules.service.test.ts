// SchedulesService unit tests — Wave 0 stub (Fase 4)
// Requirements: SCHED-01, SCHED-02, SCHED-03, SCHED-04, SCHED-05, SCHED-06
import { describe, it } from 'vitest'

describe('SchedulesService', () => {
  it.todo('upsertSchedule cria novo Schedule se não existir')
  it.todo('upsertSchedule atualiza Schedule existente')
  it.todo('createDailyOrders cria Order para cada Schedule ativo com saldo suficiente')
  it.todo('createDailyOrders pula dias com quantidade 0')
  it.todo('createDailyOrders não cria Order quando saldo insuficiente')
  it.todo('sendReconfigureReminders chama OneSignal para usuários com notifyReconfigure true')
  it.todo('processAutoBuy detecta modo acabar e gera push quando saldo menor que consumo semanal')
  it.todo('processAutoBuy modo semanal dispara no dia correto da semana')
})
