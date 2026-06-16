// AdminFinancialService — stub placeholder Wave 0
// Implementação real será feita na Wave 1 (07-04-PLAN.md)
// Este arquivo existe apenas para satisfazer o contrato de importação dos testes

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class AdminFinancialService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(_fastify: any) {}

  getRevenue(_params: { from: string; to: string }): Promise<{ total: number; period: unknown }> {
    throw new Error('Not implemented — Wave 1')
  }

  list(): Promise<unknown[]> {
    throw new Error('Not implemented — Wave 1')
  }
}
