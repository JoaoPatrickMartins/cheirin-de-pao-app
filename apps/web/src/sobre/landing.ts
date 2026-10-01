/**
 * Página "Sobre" — o que o script troca por cima do HTML estático (plano-pagina-sobre.md §4.2).
 * O HTML já vem completo com o texto NEUTRO; daqui só saem a frase do turno, o item 8 do FAQ
 * (Indique e Ganhe) e o "Voltar ao app" de quem já tem sessão. Se a API falhar, nada muda.
 */

/** Resposta de GET /public/landing (apps/api — public-landing.route.ts). */
export interface LandingInfo {
  shifts?: { manha?: boolean; tarde?: boolean }
  referral?: { active?: boolean; reward?: number; friendBonus?: number }
}

/** O texto que vem no HTML — robô sem JavaScript ou API fora do ar. */
export const NEUTRAL_TURNO = 'nos dias que você escolher'

export const pz = (n: number): string => (n === 1 ? '1 pãozin' : `${n} pãezins`)

export function turnoFrase(shifts: LandingInfo['shifts']): string {
  if (!shifts || (!shifts.manha && !shifts.tarde)) return NEUTRAL_TURNO
  if (shifts.manha && shifts.tarde) return 'de manhã ou à tarde, no turno que você escolher'
  return shifts.manha ? 'pela manhã' : 'à tarde'
}

/** O "Manhã · Tarde" do card de corte no celular do hero, com os mesmos turnos. */
export function turnoMock(shifts: LandingInfo['shifts']): string | null {
  if (!shifts || (!shifts.manha && !shifts.tarde)) return null
  if (shifts.manha && shifts.tarde) return 'Manhã · Tarde'
  return shifts.manha ? 'Manhã' : 'Tarde'
}

export const INDIQUE_Q = 'Como funciona o Indique e Ganhe?'

/** Resposta do item 8 — só com o programa ligado e recompensa válida (D-6). */
export function indiqueAnswer(referral: LandingInfo['referral']): string | null {
  if (!referral?.active) return null
  const reward = Math.trunc(Number(referral.reward))
  if (!Number.isFinite(reward) || reward < 1) return null
  const bonus = Math.trunc(Number(referral.friendBonus))
  const friend = Number.isFinite(bonus) && bonus > 0 ? `, e ele ganha ${pz(bonus)} no primeiro pedido` : ''
  return `Indique um vizinho com o seu link: você ganha ${pz(reward)} quando o pão chegar na porta dele${friend}.`
}

// As mesmas chaves do AuthContext (contexts/AuthContext.tsx) — importar de lá traria o React.
const ACCESS_KEY = 'auth_access'
const USER_KEY = 'auth_user'

/** Há sessão salva neste aparelho? (D-10 — o topo mostra só o "Voltar ao app"). */
export function hasSavedSession(storage: Pick<Storage, 'getItem'> | undefined): boolean {
  try {
    return !!storage?.getItem(ACCESS_KEY) && !!storage.getItem(USER_KEY)
  } catch {
    return false // Safari privado lança
  }
}

/**
 * Para onde o "Voltar ao app" leva (D-10): a tela do app de onde a pessoa veio — o Perfil, a Home
 * depois do tutorial… —, lida do `document.referrer`. Só vale outra página da MESMA origem que não
 * seja a própria /sobre/; qualquer outra coisa (link externo, sem referrer) → `/`, que o app manda
 * para a home de quem está logado.
 */
export function backToAppHref(referrer: string, origin: string): string {
  try {
    const ref = new URL(referrer)
    if (ref.origin !== origin || ref.pathname.startsWith('/sobre')) return '/'
    return `${ref.pathname}${ref.search}${ref.hash}`
  } catch {
    return '/'
  }
}

/** Busca os dados da página; qualquer falha (rede, status, JSON, 2 s sem resposta) → null. */
export async function fetchLanding(
  apiBase: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 2000,
): Promise<LandingInfo | null> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = setTimeout(() => ctrl?.abort(), timeoutMs)
  try {
    const res = await fetchImpl(`${apiBase.replace(/\/+$/, '')}/public/landing`, {
      signal: ctrl?.signal,
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as LandingInfo
    return data && typeof data === 'object' ? data : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Monta um item do FAQ igual aos do HTML (`<details>` + `<summary>` com o ícone +/–). */
export function buildFaqItem(doc: Document, question: string, answer: string): HTMLDetailsElement {
  const details = doc.createElement('details')
  details.className = 'sb-faq-item'
  details.dataset.sbIndique = ''
  const summary = doc.createElement('summary')
  const h3 = doc.createElement('h3')
  h3.className = 'sb-faq-q'
  h3.textContent = question
  const icon = doc.createElement('span')
  icon.className = 'sb-faq-ic'
  icon.setAttribute('aria-hidden', 'true')
  icon.appendChild(doc.createElement('span'))
  summary.append(h3, icon)
  const body = doc.createElement('div')
  body.className = 'sb-faq-a'
  const p = doc.createElement('p')
  p.textContent = answer
  body.appendChild(p)
  details.append(summary, body)
  return details
}

/** Aplica a resposta da API na página. Sem resposta, a página fica como veio no HTML. */
export function applyLanding(doc: Document, info: LandingInfo | null, opts: { animate?: boolean } = {}): void {
  if (!info) return

  const frase = turnoFrase(info.shifts)
  const turno = doc.querySelector<HTMLElement>('[data-sb-turno]')
  if (turno && turno.textContent !== frase) {
    turno.textContent = frase
    if (opts.animate) {
      turno.classList.remove('sb-fade')
      void turno.offsetWidth // reinicia a animação
      turno.classList.add('sb-fade')
    }
  }

  const mock = turnoMock(info.shifts)
  const mockEl = doc.querySelector<HTMLElement>('[data-sb-turno-mock]')
  if (mock && mockEl) mockEl.textContent = mock

  const answer = indiqueAnswer(info.referral)
  const faq = doc.querySelector<HTMLElement>('[data-sb-faq]')
  if (answer && faq && !faq.querySelector('[data-sb-indique]')) {
    faq.appendChild(buildFaqItem(doc, INDIQUE_Q, answer))
  }
}
