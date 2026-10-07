import { z } from 'zod'
import { PhoneSchema, VEHICLE_TYPES, FUEL_TYPES, PAY_MODES, WEEKDAYS, consumptionUnit } from '@cheirin-de-pao/shared'

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')

/**
 * Veículo (A3 · seção 2). Bicicleta/a pé não guardam combustível nem consumo. GNV só no carro, e nele
 * `kmPorLitro` vale km/m³ (Onda 11 · T-34/T-36).
 */
export const VehicleSchema = z
  .object({
    tipo: z.enum(VEHICLE_TYPES),
    modelo: z.string().trim().max(40).nullish(),
    placa: z.string().trim().toUpperCase().max(10).nullish(),
    combustivel: z.enum(FUEL_TYPES).nullish(),
    kmPorLitro: z.number().nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.combustivel === 'GNV' && v.tipo !== 'CARRO') ctx.addIssue({ code: 'custom', path: ['combustivel'], message: 'GNV só para carro' })
    if (v.kmPorLitro != null && (v.kmPorLitro < 1 || v.kmPorLitro > 100)) {
      ctx.addIssue({ code: 'custom', path: ['kmPorLitro'], message: `Consumo entre 1 e 100 ${consumptionUnit(v.combustivel)}` })
    }
  })

/** Permissões e regras (A3 · seção 3) — padrão V-17 quando ausente. */
export const RulesSchema = z.object({
  fotoEntrega: z.boolean(),
  fotoNaoEntrega: z.boolean(),
  podeReordenar: z.boolean(),
  podeRecados: z.boolean(),
})

/** Pagamento (A3 · seção 4). `modalidade: null` = sem modalidade (a proposta sai só com o combustível). */
export const PaySchema = z.object({
  modalidade: z.enum(PAY_MODES).nullable(),
  valor: z.number().min(0).max(100_000).nullable(),
  pagaCombustivel: z.boolean(),
})

/** Disponibilidade (A3 · seção 5). Ausente = todos os dias e turnos (comportamento de antes). */
export const AvailabilitySchema = z.object({
  dias: z.array(z.enum(WEEKDAYS)).max(7),
  turnos: z.array(z.string().min(1).max(40)).max(10),
})

/**
 * Schema de validação para criação de entregador.
 * T-07-03-02: CPF validado com 11 dígitos antes de chegar ao service.
 * CPF é imutável após criação — não incluso no UpdateCourierSchema.
 */
export const CreateCourierSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve ter 11 dígitos'),
  phone: PhoneSchema.optional(),
  email: z.string().email('E-mail inválido').optional(),
  /** Foto do crachá (pasta pública `couriers/`, T-6). null remove. */
  photoUrl: z.string().url().max(500).nullish(),
  vehicle: VehicleSchema.nullish(),
  rules: RulesSchema.optional(),
  pay: PaySchema.nullish(),
  availability: AvailabilitySchema.nullish(),
  /** Último dia válido do crachá (H-3). Padrão no cadastro: 31/12 do ano. */
  badgeValidUntil: Day.nullish(),
})

export type CreateCourierBody = z.infer<typeof CreateCourierSchema>

// CPF não está no UpdateCourierSchema pois é imutável
export const UpdateCourierSchema = CreateCourierSchema.omit({ cpf: true }).partial()
export type UpdateCourierBody = z.infer<typeof UpdateCourierSchema>

/** POST /admin/couriers/:id/time-offs */
export const TimeOffSchema = z
  .object({ startDate: Day, endDate: Day, reason: z.string().trim().max(80).optional() })
  .refine((d) => d.endDate >= d.startDate, { message: 'O fim da folga é antes do início' })
