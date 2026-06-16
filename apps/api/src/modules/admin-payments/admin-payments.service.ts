// AdminPaymentsService — stub placeholder Wave 0
// Implementação real será feita na Wave 1 (07-02-PLAN.md)
// Este arquivo existe apenas para satisfazer o contrato de importação dos testes

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class AdminPaymentsService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(_fastify: any) {}

  refund(_paymentId: string): Promise<{ refunded: boolean; paymentId: string }> {
    throw new Error('Not implemented — Wave 1')
  }

  list(): Promise<unknown[]> {
    throw new Error('Not implemented — Wave 1')
  }
}
