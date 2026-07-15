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
 * Destino de um usuário já autenticado. Respeita o 1º acesso sem senha
 * (hasPassword === false força a tela de definir senha antes de entrar no app).
 */
export function authHome(user: {
  role: 'CLIENT' | 'COURIER' | 'ADMIN'
  hasPassword?: boolean
}): string {
  if (user.hasPassword === false) return '/set-password'
  return roleRoutes[user.role] ?? '/client'
}
