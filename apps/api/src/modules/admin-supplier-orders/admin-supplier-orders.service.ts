// AdminSupplierOrdersService — stub placeholder Wave 0
// Implementação real será feita na Wave 1 (07-03-PLAN.md)
// Este arquivo existe apenas para satisfazer o contrato de importação dos testes

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class AdminSupplierOrdersService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(_fastify: any) {}

  create(_input: {
    date: string
    items: Array<{ supplierId: string; quantity: number; unitPrice: number }>
  }): Promise<{ id: string; date: string; totalQuantity: number; status: string; items: unknown[] }> {
    throw new Error('Not implemented — Wave 1')
  }

  list(): Promise<unknown[]> {
    throw new Error('Not implemented — Wave 1')
  }
}
