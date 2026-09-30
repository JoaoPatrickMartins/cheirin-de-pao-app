/**
 * Rota "home" de cada perfil após a autenticação. Fonte ÚNICA — importe daqui em
 * vez de redeclarar o mapa em cada tela (evita divergência entre login, cadastro,
 * definição de senha e a guarda de rotas públicas).
 */
export const roleRoutes: Record<string, string> = {
  ADMIN: '/admin',
  CLIENT: '/client',
  COURIER: '/courier',
}

/**
 * Precisa definir senha antes de usar o app? Só conta sem senha E sem login com Google — quem
 * entrou pelo Google não tem senha e mesmo assim entra (plano-login-social.md, T-7). A API manda
 * `mustSetPassword`; sessão antiga gravada no aparelho (de antes do campo) cai no `hasPassword`.
 */
export function needsPasswordSetup(user: { hasPassword?: boolean; mustSetPassword?: boolean }): boolean {
  return user.mustSetPassword ?? user.hasPassword === false
}

/**
 * Destino de um usuário já autenticado. Respeita o 1º acesso sem senha
 * (needsPasswordSetup força a tela de definir senha antes de entrar no app).
 */
export function authHome(user: {
  role: 'CLIENT' | 'COURIER' | 'ADMIN'
  hasPassword?: boolean
  mustSetPassword?: boolean
}): string {
  if (needsPasswordSetup(user)) return '/set-password'
  return roleRoutes[user.role] ?? '/client'
}
