// AdminClientsService — stub placeholder Wave 0
// Implementação real será feita na Wave 1 (07-05-PLAN.md)
// Este arquivo existe apenas para satisfazer o contrato de importação dos testes

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class AdminClientsService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(_fastify: any) {}

  blockClient(_userId: string): Promise<{ id: string; isBlocked: boolean }> {
    throw new Error('Not implemented — Wave 1')
  }

  unblockClient(_userId: string): Promise<{ id: string; isBlocked: boolean }> {
    throw new Error('Not implemented — Wave 1')
  }

  list(_params?: { condominiumId?: string }): Promise<unknown[]> {
    throw new Error('Not implemented — Wave 1')
  }
}
