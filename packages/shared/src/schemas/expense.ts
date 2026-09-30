import { z } from 'zod'
import { ObjectIdSchema } from './index'

/**
 * Schemas de despesa — fonte única para a API (valida com `.parse`) e para o front (reusa as
 * regras e as mensagens).
 *
 * Contexto: o módulo de despesas é o que destrava DRE, fluxo de caixa, contas a pagar e ponto de
 * equilíbrio. Antes dele o sistema só conhecia compra de mercadoria como saída de dinheiro.
 */

/** Grupo do DRE. É o grupo — não a categoria — que define a linha da demonstração. */
export const ExpenseGroupSchema = z.enum([
  'COGS',
  'PEOPLE',
  'OPERATION',
  'SALES',
  'ADMIN',
  'TAXES',
  'OTHER',
])
export type ExpenseGroup = z.infer<typeof ExpenseGroupSchema>

export const ExpenseStatusSchema = z.enum(['PENDING', 'PAID', 'CANCELLED'])
export type ExpenseStatus = z.infer<typeof ExpenseStatusSchema>

/** Rótulos pt-BR dos grupos — a mesma ordem em que aparecem no DRE. */
export const EXPENSE_GROUP_LABEL: Record<ExpenseGroup, string> = {
  COGS: 'Custo da mercadoria',
  PEOPLE: 'Pessoal e entrega',
  OPERATION: 'Operação',
  SALES: 'Comercial e marketing',
  ADMIN: 'Administrativas',
  TAXES: 'Impostos e taxas',
  OTHER: 'Outras',
}

/** Ordem de exibição dos grupos no DRE e no relatório de despesas. */
export const EXPENSE_GROUP_ORDER: ExpenseGroup[] = [
  'COGS',
  'PEOPLE',
  'OPERATION',
  'SALES',
  'ADMIN',
  'TAXES',
  'OTHER',
]

/** "YYYY-MM-DD" — data de calendário BRT, sem hora. */
export const DateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato AAAA-MM-DD')

/** "YYYY-MM" — mês de competência. */
export const MonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês deve estar no formato AAAA-MM')

/**
 * Valor em reais.
 *
 * Positivo e finito: despesa negativa seria uma receita disfarçada, e ela entraria no DRE pelo
 * lado errado, inflando o resultado sem deixar rastro. Estorno de despesa se registra como
 * `CANCELLED`, não como valor negativo.
 */
export const MoneySchema = z
  .number()
  .finite({ message: 'Valor inválido' })
  .positive({ message: 'O valor deve ser maior que zero' })
  .max(9_999_999, { message: 'Valor acima do limite' })

// ── Categoria ─────────────────────────────────────────────────────────────

export const ExpenseCategoryCreateSchema = z.object({
  name: z.string().trim().min(2, 'Nome muito curto').max(60, 'Nome muito longo'),
  group: ExpenseGroupSchema,
  isFixed: z.boolean().default(false),
  emoji: z.string().trim().max(8).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
})
export type ExpenseCategoryCreate = z.infer<typeof ExpenseCategoryCreateSchema>

export const ExpenseCategoryUpdateSchema = ExpenseCategoryCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
})
export type ExpenseCategoryUpdate = z.infer<typeof ExpenseCategoryUpdateSchema>

// ── Lançamento ────────────────────────────────────────────────────────────

/**
 * Criação de despesa.
 *
 * `competenceDate` é obrigatória e `paidAt` não: uma despesa pode ser lançada antes de ser paga
 * (é justamente o que alimenta contas a pagar). `status` é DERIVADO no serviço a partir de
 * `paidAt` — deixar o cliente mandar o status permitiria uma despesa `PAID` sem data de pagamento,
 * que sumiria do fluxo de caixa mas apareceria no DRE de competência.
 */
export const ExpenseCreateSchema = z
  .object({
    categoryId: ObjectIdSchema,
    description: z.string().trim().min(2, 'Descreva a despesa').max(140, 'Descrição muito longa'),
    amount: MoneySchema,
    competenceDate: DateOnlySchema,
    dueDate: DateOnlySchema.optional(),
    paidAt: DateOnlySchema.optional(),
    supplierId: ObjectIdSchema.optional(),
    payee: z.string().trim().max(80).optional(),
    paymentMethod: z.string().trim().max(40).optional(),
    condominiumId: ObjectIdSchema.optional(),
    receiptUrl: z.string().url('URL do comprovante inválida').optional(),
    notes: z.string().trim().max(500).optional(),
  })
  // Fornecedor cadastrado OU nome livre, nunca os dois: com ambos preenchidos, o relatório por
  // fornecedor teria duas verdades para a mesma linha.
  .refine((e) => !(e.supplierId != null && e.payee != null && e.payee !== ''), {
    message: 'Informe o fornecedor cadastrado ou o nome do recebedor, não os dois',
    path: ['payee'],
  })
export type ExpenseCreate = z.infer<typeof ExpenseCreateSchema>

export const ExpenseUpdateSchema = z.object({
  categoryId: ObjectIdSchema.optional(),
  description: z.string().trim().min(2).max(140).optional(),
  amount: MoneySchema.optional(),
  competenceDate: DateOnlySchema.optional(),
  dueDate: DateOnlySchema.nullable().optional(),
  paidAt: DateOnlySchema.nullable().optional(),
  supplierId: ObjectIdSchema.nullable().optional(),
  payee: z.string().trim().max(80).nullable().optional(),
  paymentMethod: z.string().trim().max(40).nullable().optional(),
  condominiumId: ObjectIdSchema.nullable().optional(),
  receiptUrl: z.string().url().nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  /** Só `CANCELLED` é aceito aqui — PENDING/PAID vêm de `paidAt` (ver ExpenseCreateSchema). */
  status: z.literal('CANCELLED').optional(),
})
export type ExpenseUpdate = z.infer<typeof ExpenseUpdateSchema>

// ── Recorrência ───────────────────────────────────────────────────────────

export const ExpenseRecurrenceCreateSchema = z.object({
  categoryId: ObjectIdSchema,
  description: z.string().trim().min(2, 'Descreva a despesa').max(140),
  amount: MoneySchema,
  // 1..28: 29/30/31 não existem em todo mês, e clampar em silêncio faria o aluguel "dia 31"
  // vencer dia 28 em fevereiro sem ninguém ter pedido.
  dayOfMonth: z
    .number()
    .int()
    .min(1, 'Dia entre 1 e 28')
    .max(28, 'Use um dia entre 1 e 28 — 29, 30 e 31 não existem em todos os meses'),
  supplierId: ObjectIdSchema.optional(),
  payee: z.string().trim().max(80).optional(),
  condominiumId: ObjectIdSchema.optional(),
  startsAt: MonthSchema,
  endsAt: MonthSchema.optional(),
})
export type ExpenseRecurrenceCreate = z.infer<typeof ExpenseRecurrenceCreateSchema>

export const ExpenseRecurrenceUpdateSchema = ExpenseRecurrenceCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
})
export type ExpenseRecurrenceUpdate = z.infer<typeof ExpenseRecurrenceUpdateSchema>

// ── Importação em massa (E2) ──────────────────────────────────────────────

/**
 * Uma linha da importação de CSV.
 *
 * A categoria vem por NOME, não por id: quem monta a planilha (ou exporta do banco) não conhece
 * ObjectId. O serviço resolve o nome contra as categorias cadastradas e devolve a linha com erro
 * quando não encontra — nunca cria categoria silenciosamente.
 */
export const ExpenseImportRowSchema = z.object({
  categoryName: z.string().trim().min(1, 'Categoria obrigatória'),
  description: z.string().trim().min(2, 'Descrição obrigatória').max(140),
  amount: MoneySchema,
  competenceDate: DateOnlySchema,
  dueDate: DateOnlySchema.optional(),
  paidAt: DateOnlySchema.optional(),
  payee: z.string().trim().max(80).optional(),
  paymentMethod: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(500).optional(),
})
export type ExpenseImportRow = z.infer<typeof ExpenseImportRowSchema>

export const ExpenseImportSchema = z.object({
  rows: z.array(ExpenseImportRowSchema).min(1, 'Nada para importar').max(500, 'Máximo de 500 linhas por importação'),
})
export type ExpenseImport = z.infer<typeof ExpenseImportSchema>
