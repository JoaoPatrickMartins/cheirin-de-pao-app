import type { PrismaClient } from '@prisma/client'
import { brtDateStr } from './cutoff.js'

/**
 * Localização do entregador (T-9 · Política de Privacidade): só durante a rota e só a última
 * posição. Ao encerrar a rota, `CourierRunService.end` apaga a posição e o ponto de partida por GPS;
 * esta faxina apaga das rotas de dias anteriores que ficaram sem encerrar (e das encerradas antes
 * dessa regra). Roda no cron diário (plugins/cron.ts).
 */
export const RUN_POSITION_CLEARED = { startLat: null, startLng: null, lastLat: null, lastLng: null, lastPosAt: null }

export async function clearStaleCourierPositions(
  prisma: Pick<PrismaClient, 'courierRun'>,
  now: Date = new Date(),
): Promise<number> {
  const { count } = await prisma.courierRun.updateMany({
    where: { date: { lt: brtDateStr(now) }, OR: [{ lastPosAt: { not: null } }, { startLat: { not: null } }] },
    data: RUN_POSITION_CLEARED,
  })
  return count
}
