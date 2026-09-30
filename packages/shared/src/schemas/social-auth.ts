import { z } from 'zod'
import { DeviceIdSchema, ObjectIdSchema } from './index'

/**
 * Login social (Google) — fonte única dos contratos entre o app e a API.
 * Plano: .projeto/docs/plano-login-social.md (§7.3).
 *
 * O fluxo roda no servidor: o app chama `start`, o navegador vai ao Google e volta para a API, e o
 * app busca o resultado com `claim`, provando com `flowId` + `secret` que foi ele quem iniciou.
 */

/**
 * Provedores aceitos na rota (`/auth/social/:provider/...`), em minúsculas. No banco o enum
 * `SocialProvider` usa maiúsculas (`GOOGLE`). Outro provedor (ex.: `facebook` — plano guardado em
 * plano-login-social-facebook.md) entra somando um valor aqui.
 */
export const SOCIAL_PROVIDERS = ['google'] as const
export const SocialProviderSchema = z.enum(SOCIAL_PROVIDERS)
export type SocialProviderSlug = z.infer<typeof SocialProviderSchema>

/** `login` = entrar ou criar conta; `link` = conectar o provedor a quem já está logado (Perfil). */
export const SocialIntentSchema = z.enum(['login', 'link'])
export type SocialIntent = z.infer<typeof SocialIntentSchema>

export const SocialStartSchema = z.object({
  intent: SocialIntentSchema.default('login'),
  deviceId: DeviceIdSchema,
})

// Identifica o fluxo e prova que quem chama é o app que o iniciou (o segredo só existe nele).
const flowAuth = {
  flowId: ObjectIdSchema,
  secret: z.string().min(32).max(128),
}

export const SocialClaimSchema = z.object({ ...flowAuth, deviceId: DeviceIdSchema })

// Vínculo com uma conta que já existe (mesmo e-mail) — confirmação por código ou por senha.
export const SocialLinkCodeSchema = z.object(flowAuth)

export const SocialLinkCodeVerifySchema = z.object({
  ...flowAuth,
  deviceId: DeviceIdSchema,
  code: z.string().length(4, { message: 'Código deve ter 4 dígitos' }),
})

export const SocialLinkPasswordSchema = z.object({
  ...flowAuth,
  deviceId: DeviceIdSchema,
  password: z.string().min(1, { message: 'Senha obrigatória' }),
})

/** Desfecho devolvido pelo `claim` e pelos passos seguintes (vínculo, cadastro). */
export const SOCIAL_CLAIM_STATUSES = [
  'PENDING', // o Google ainda não devolveu (o app tenta de novo)
  'LOGGED_IN', // tokens na resposta — mesmo formato do /auth/login
  'NEEDS_SIGNUP', // primeiro acesso: completar o cadastro ("Quase lá")
  'NEEDS_LINK', // já existe conta com esse e-mail: confirmar com senha ou código
  'LINKED', // intent=link: provedor conectado à conta logada
  'ERROR',
] as const
export type SocialClaimStatus = (typeof SOCIAL_CLAIM_STATUSES)[number]

export const SOCIAL_ERROR_CODES = [
  'cancelled', // a pessoa cancelou no Google
  'not_client', // e-mail de entregador/admin — entram com e-mail e senha
  'blocked', // conta bloqueada pelo admin
  'email_unverified', // o Google não confirmou o e-mail
  'expired', // fluxo expirou ou estourou as tentativas
  'already_linked', // esse Google já está em outro cadastro
  'provider_taken', // a conta logada já tem outro Google conectado
  'provider_error', // falha ao falar com o Google
] as const
export type SocialErrorCode = (typeof SOCIAL_ERROR_CODES)[number]
