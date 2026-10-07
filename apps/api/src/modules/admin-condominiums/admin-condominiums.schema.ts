import { z } from 'zod'

/** Acesso para o entregador (A6). Campos vazios viram null; tudo vazio = "nenhuma dica". */
export const CourierAccessSchema = z.object({
  portaria: z.string().trim().max(120).nullish(),
  temPorteiro: z.boolean().nullish(),
  portao: z.string().trim().max(200).nullish(),
  parar: z.string().trim().max(200).nullish(),
  obs: z.string().trim().max(500).nullish(),
  fotoUrl: z.string().url('Foto inválida').max(500).nullish(),
})

/**
 * CreateCondominiumSchema — valida criação de condomínio.
 * T-07-02-03: Zod parse do body antes de qualquer chamada ao banco.
 */
export const CreateCondominiumSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  address: z.object({
    street: z.string().min(1, 'Rua é obrigatória'),
    number: z.string().min(1, 'Número é obrigatório'),
    complement: z.string().optional(),
    city: z.string().min(1, 'Cidade é obrigatória'),
    state: z.string().min(1, 'Estado é obrigatório'),
    zip: z.string().min(1, 'CEP é obrigatório'),
  }),
  type: z.enum(['SINGLE_ENTRANCE', 'BLOCKS'], {
    message: 'Tipo inválido. Use SINGLE_ENTRANCE ou BLOCKS.',
  }),
  // Número de blocos/torres — relevante apenas quando type == BLOCKS.
  numBlocks: z.number().int().min(1, 'Número de blocos deve ser ao menos 1').optional(),
  // Coordenadas manuais (opcionais) — quando informadas, têm prioridade sobre a
  // geocodificação automática do endereço.
  lat: z.number().optional(),
  lng: z.number().optional(),
  // Acesso para o entregador (A6 · aba Acesso). null limpa.
  courierAccess: CourierAccessSchema.nullish(),
})

export type CreateCondominiumBody = z.infer<typeof CreateCondominiumSchema>

export const UpdateCondominiumSchema = CreateCondominiumSchema.partial().extend({
  // Ativar/desativar o condomínio (atendimento). Só editável via update.
  isActive: z.boolean().optional(),
})
export type UpdateCondominiumBody = z.infer<typeof UpdateCondominiumSchema>

export const SlotUpdateSchema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM esperado').optional(),
  cutoffTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM esperado').optional(),
  isActive: z.boolean().optional(),
})
export type SlotUpdateBody = z.infer<typeof SlotUpdateSchema>

export const AccessParams = z.object({
  id: z.string().regex(/^[0-9a-f]{24}$/i, 'Id inválido'),
  sid: z.string().regex(/^[0-9a-f]{24}$/i, 'Id inválido'),
})
