// AdminSettingsService — stub placeholder Wave 0
// Implementação real será feita na Wave 1 (07-02-PLAN.md)
// Este arquivo existe apenas para satisfazer o contrato de importação dos testes

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class AdminSettingsService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(_fastify: any) {}

  getCutoffTime(): Promise<string> {
    throw new Error('Not implemented — Wave 1')
  }

  setCutoffTime(_value: string): Promise<{ key: string; value: string }> {
    throw new Error('Not implemented — Wave 1')
  }
}
