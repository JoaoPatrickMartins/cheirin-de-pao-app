// Primeiro acesso do cliente — flags de onboarding por conta (localStorage).
//
// Duas fases sequenciais: telas explicativas (slides) → tour do app. A flag de
// conclusão (`SEEN`) só é gravada ao terminar/pular o tour; `SLIDES` permite
// retomar direto no tour após um reload no meio do fluxo.
//
// Regra crítica: se o localStorage lançar (Safari modo privado / storage
// desabilitado), os getters retornam `true` (= já visto) para NUNCA bloquear o
// app nem entrar em loop. Mesmo padrão try/catch usado em AuthContext.

const SEEN = (userId: string) => `cdp_onboarding_seen_${userId}` // primeiro acesso 100% concluído
const SLIDES = (userId: string) => `cdp_slides_done_${userId}` // telas explicativas já passaram (retomar no tour)
const STEP = (userId: string) => `cdp_tour_step_${userId}` // parada atual do tour (retomar exato)

export function hasSeenOnboarding(userId: string): boolean {
  try {
    return localStorage.getItem(SEEN(userId)) === '1'
  } catch {
    return true
  }
}

export function slidesDone(userId: string): boolean {
  try {
    return localStorage.getItem(SLIDES(userId)) === '1'
  } catch {
    return true
  }
}

export function markSlidesDone(userId: string): void {
  try {
    localStorage.setItem(SLIDES(userId), '1')
  } catch {
    // storage indisponível — segue em memória
  }
}

export function getTourStep(userId: string): number {
  try {
    return Number(localStorage.getItem(STEP(userId))) || 0
  } catch {
    return 0
  }
}

export function setTourStep(userId: string, index: number): void {
  try {
    localStorage.setItem(STEP(userId), String(index))
  } catch {
    // storage indisponível — segue em memória
  }
}

export function markOnboardingSeen(userId: string): void {
  try {
    localStorage.setItem(SEEN(userId), '1')
    localStorage.removeItem(SLIDES(userId))
    localStorage.removeItem(STEP(userId))
  } catch {
    // storage indisponível — segue em memória
  }
}

// Re-disparo manual (Perfil → Ajuda → Rever tutorial): limpa tudo para o fluxo recomeçar.
export function resetOnboarding(userId: string): void {
  try {
    localStorage.removeItem(SEEN(userId))
    localStorage.removeItem(SLIDES(userId))
    localStorage.removeItem(STEP(userId))
  } catch {
    // storage indisponível — segue em memória
  }
}
