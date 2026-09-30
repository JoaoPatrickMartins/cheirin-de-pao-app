import { z } from 'zod'
import {
  DeviceIdSchema,
  ObjectIdSchema,
  SocialStartSchema,
  SocialClaimSchema,
  SocialLinkCodeSchema,
  SocialLinkCodeVerifySchema,
  SocialLinkPasswordSchema,
  SocialProviderSchema,
} from '@cheirin-de-pao/shared'
import { SignupProfileSchema } from '../auth/auth.schema.js'

// Reexporta do shared (fonte única) para uso no controller.
export {
  SocialStartSchema,
  SocialClaimSchema,
  SocialLinkCodeSchema,
  SocialLinkCodeVerifySchema,
  SocialLinkPasswordSchema,
  SocialProviderSchema,
}

// Conectar o Google a quem já está logado (Perfil) — o usuário vem do access token.
export const SocialConnectSchema = z.object({ deviceId: DeviceIdSchema })

// Fim do cadastro pelo Google ("Quase lá" → condomínio → endereço). Os mesmos dados do cadastro por
// e-mail, MENOS e-mail (vem verificado do Google) e senha (opcional — D-4). Nascimento obrigatório,
// como a rota de cadastro já exige.
export const SocialCompleteSchema = SignupProfileSchema.extend({
  flowId: ObjectIdSchema,
  secret: z.string().min(32).max(128),
  deviceId: DeviceIdSchema,
  birthDate: z.string().datetime(),
})

export type SocialCompleteBody = z.infer<typeof SocialCompleteSchema>
