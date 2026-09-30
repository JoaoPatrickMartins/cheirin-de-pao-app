import { FastifyInstance } from 'fastify'
import type { Prisma, SocialProvider } from '@prisma/client'

// Mínimo para abrir sessão e decidir o fluxo. NUNCA devolver passwordHash em resposta.
const SESSION_USER_SELECT = {
  id: true,
  role: true,
  name: true,
  email: true,
  passwordHash: true,
  isBlocked: true,
} as const

export class SocialAuthRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  // ── Fluxo ────────────────────────────────────────────────────────────────
  createFlow(data: Prisma.SocialLoginFlowUncheckedCreateInput) {
    return this.prisma.socialLoginFlow.create({ data })
  }

  findFlowById(id: string) {
    return this.prisma.socialLoginFlow.findUnique({ where: { id } })
  }

  findFlowByStateHash(stateHash: string) {
    return this.prisma.socialLoginFlow.findUnique({ where: { stateHash } })
  }

  updateFlow(id: string, data: Prisma.SocialLoginFlowUncheckedUpdateInput) {
    return this.prisma.socialLoginFlow.update({ where: { id }, data })
  }

  // Troca de estado guardada: só vale se o fluxo ainda estiver em `from`. Devolve true para quem
  // ganhou — é o que impede entregar os tokens duas vezes (polling + volta do app ao mesmo tempo).
  async transitionFlow(id: string, from: string, data: Prisma.SocialLoginFlowUncheckedUpdateManyInput) {
    const { count } = await this.prisma.socialLoginFlow.updateMany({ where: { id, status: from }, data })
    return count === 1
  }

  // Tentativa errada de senha/código no vínculo. `attempts` nasce 0 no `start` (no Mongo um `$inc`
  // sobre chave inexistente não é confiável pelo Prisma) e o incremento é atômico.
  incrementAttempts(id: string) {
    return this.prisma.socialLoginFlow.update({
      where: { id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    })
  }

  // ── Contas sociais ───────────────────────────────────────────────────────
  findAccount(provider: SocialProvider, providerUserId: string) {
    return this.prisma.socialAccount.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } },
    })
  }

  findAccountOfUser(userId: string, provider: SocialProvider) {
    return this.prisma.socialAccount.findUnique({ where: { userId_provider: { userId, provider } } })
  }

  createAccount(data: { userId: string; provider: SocialProvider; providerUserId: string; email: string | null }) {
    return this.prisma.socialAccount.create({ data })
  }

  deleteAccountById(id: string) {
    return this.prisma.socialAccount.deleteMany({ where: { id } })
  }

  touchAccountLogin(provider: SocialProvider, providerUserId: string) {
    return this.prisma.socialAccount.updateMany({
      where: { provider, providerUserId },
      data: { lastLoginAt: new Date() },
    })
  }

  listAccounts(userId: string) {
    return this.prisma.socialAccount.findMany({
      where: { userId },
      select: { provider: true, email: true, linkedAt: true },
      orderBy: { linkedAt: 'asc' },
    })
  }

  deleteAccountOfUser(userId: string, provider: SocialProvider) {
    return this.prisma.socialAccount.deleteMany({ where: { userId, provider } })
  }

  // ── Usuários ─────────────────────────────────────────────────────────────
  findSessionUser(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: SESSION_USER_SELECT })
  }

  // Sem diferenciar maiúsculas: o Google devolve o e-mail em minúsculas, mas um cadastro antigo pode
  // ter "Joao@Gmail.com". Sem isso a mesma pessoa ganharia uma segunda conta.
  findUserByEmailInsensitive(email: string) {
    return this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: SESSION_USER_SELECT,
    })
  }

  findUserByPhone(phone: string) {
    return this.prisma.user.findUnique({ where: { phone }, select: { id: true } })
  }

  findUserByCpf(cpf: string) {
    return this.prisma.user.findUnique({ where: { cpf }, select: { id: true } })
  }

  // Cadastro pelo Google: o cliente e o vínculo nascem juntos ou não nascem. Se o índice único de
  // SocialAccount estourar (duas abas terminando ao mesmo tempo), o usuário também é desfeito.
  createClientWithAccount(
    user: Omit<Prisma.UserUncheckedCreateInput, 'role' | 'creditMilli'>,
    account: { provider: SocialProvider; providerUserId: string; email: string | null },
  ) {
    return this.prisma.$transaction(async (tx) => {
      // `creditMilli: 0` explícito: no Mongo o `@default` não cria a chave (ver AuthRepository.createUser).
      const created = await tx.user.create({
        data: { ...user, role: 'CLIENT', creditMilli: 0 },
        select: { id: true, name: true, role: true },
      })
      await tx.socialAccount.create({ data: { ...account, userId: created.id } })
      return created
    })
  }
}
