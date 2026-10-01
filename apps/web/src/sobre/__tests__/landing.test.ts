// Página "Sobre" — o que o script troca por cima do HTML estático (plano-pagina-sobre.md §4.2).
// O HTML cru (o que o robô do Google lê), pelo `?raw` do Vite.
import HTML from '../../../sobre/index.html?raw'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  NEUTRAL_TURNO,
  applyLanding,
  backToAppHref,
  fetchLanding,
  hasSavedSession,
  indiqueAnswer,
  pz,
  turnoFrase,
  turnoMock,
} from '../landing'


function loadPage() {
  document.documentElement.innerHTML = HTML.replace(/^<!doctype html>\s*<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '')
}

describe('frase do turno (D-5)', () => {
  it('manhã + tarde · só manhã · só tarde · nenhum/sem dado → neutro', () => {
    expect(turnoFrase({ manha: true, tarde: true })).toBe('de manhã ou à tarde, no turno que você escolher')
    expect(turnoFrase({ manha: true, tarde: false })).toBe('pela manhã')
    expect(turnoFrase({ manha: false, tarde: true })).toBe('à tarde')
    expect(turnoFrase({ manha: false, tarde: false })).toBe(NEUTRAL_TURNO)
    expect(turnoFrase(undefined)).toBe(NEUTRAL_TURNO)
  })

  it('o card de corte do celular acompanha os turnos', () => {
    expect(turnoMock({ manha: true, tarde: true })).toBe('Manhã · Tarde')
    expect(turnoMock({ manha: true, tarde: false })).toBe('Manhã')
    expect(turnoMock({ manha: false, tarde: true })).toBe('Tarde')
    expect(turnoMock(undefined)).toBeNull()
  })
})

describe('Indique e Ganhe (D-6)', () => {
  it('ligado com bônus do amigo → as duas partes, com plural', () => {
    expect(indiqueAnswer({ active: true, reward: 5, friendBonus: 2 })).toBe(
      'Indique um vizinho com o seu link: você ganha 5 pãezins quando o pão chegar na porta dele, e ele ganha 2 pãezins no primeiro pedido.',
    )
  })

  it('ligado sem bônus do amigo → só a parte de quem indica', () => {
    expect(indiqueAnswer({ active: true, reward: 5, friendBonus: 0 })).toBe(
      'Indique um vizinho com o seu link: você ganha 5 pãezins quando o pão chegar na porta dele.',
    )
  })

  it('singular: 1 pãozin', () => {
    expect(pz(1)).toBe('1 pãozin')
    expect(indiqueAnswer({ active: true, reward: 1, friendBonus: 1 })).toContain('ganha 1 pãozin quando')
    expect(indiqueAnswer({ active: true, reward: 1, friendBonus: 1 })).toContain('ele ganha 1 pãozin no primeiro')
  })

  it('desligado, sem dado ou recompensa inválida → sem item', () => {
    expect(indiqueAnswer({ active: false })).toBeNull()
    expect(indiqueAnswer(undefined)).toBeNull()
    expect(indiqueAnswer({ active: true, reward: 0 })).toBeNull()
    expect(indiqueAnswer({ active: true })).toBeNull()
  })
})

describe('sessão salva (D-10)', () => {
  it('token + usuário → true; faltando um → false; storage que lança → false', () => {
    const store = (o: Record<string, string>) => ({ getItem: (k: string) => o[k] ?? null })
    expect(hasSavedSession(store({ auth_access: 'a', auth_user: '{}' }))).toBe(true)
    expect(hasSavedSession(store({ auth_access: 'a' }))).toBe(false)
    expect(hasSavedSession(undefined)).toBe(false)
    expect(
      hasSavedSession({
        getItem: () => {
          throw new Error('SecurityError')
        },
      }),
    ).toBe(false)
  })
})

describe('"Voltar ao app" (D-10)', () => {
  const origin = 'https://app.cheirindepao.com.br'

  it('volta para a tela do app de onde a pessoa veio (mesma origem)', () => {
    expect(backToAppHref(`${origin}/client/perfil`, origin)).toBe('/client/perfil')
    expect(backToAppHref(`${origin}/client/home?x=1#y`, origin)).toBe('/client/home?x=1#y')
  })

  it('sem referrer, de outro site ou da própria /sobre/ → início do app', () => {
    expect(backToAppHref('', origin)).toBe('/')
    expect(backToAppHref('https://www.google.com/search?q=cheirin', origin)).toBe('/')
    expect(backToAppHref(`${origin}/sobre/`, origin)).toBe('/')
    expect(backToAppHref('não é url', origin)).toBe('/')
  })
})

describe('fetchLanding', () => {
  it('200 → dados; chama /public/landing sem barra dupla', async () => {
    const body = { shifts: { manha: true, tarde: false }, referral: { active: false } }
    const f = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) })
    expect(await fetchLanding('https://api.cheirindepao.com.br/', f)).toEqual(body)
    expect(f.mock.calls[0][0]).toBe('https://api.cheirindepao.com.br/public/landing')
  })

  it('status de erro, rede fora ou JSON quebrado → null', async () => {
    expect(await fetchLanding('/api', vi.fn().mockResolvedValue({ ok: false }))).toBeNull()
    expect(await fetchLanding('/api', vi.fn().mockRejectedValue(new Error('offline')))).toBeNull()
    expect(await fetchLanding('/api', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.reject(new Error('x')) }))).toBeNull()
  })

  it('sem resposta em 2 s → aborta e devolve null', async () => {
    vi.useFakeTimers()
    const f = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted')))),
    )
    const p = fetchLanding('/api', f)
    await vi.advanceTimersByTimeAsync(2000)
    expect(await p).toBeNull()
    vi.useRealTimers()
  })
})

describe('HTML estático — o que o robô do Google lê sem JavaScript', () => {
  it('diz o que o app faz já no h1/hero, com o nome igual ao do consentimento', () => {
    expect(HTML).toContain('<title>Cheirin de Pão — Pão fresquinho na sua porta</title>')
    expect(HTML).toMatch(/<h1[^>]*>Pão fresquinho na sua porta\.<\/h1>/)
    expect(HTML).toContain('O Cheirin de Pão entrega pão fresco na porta do seu apartamento, em condomínios parceiros.')
  })

  it('vem com o texto NEUTRO do turno e sem o item do Indique e Ganhe', () => {
    expect(HTML).toContain(`<span data-sb-turno>${NEUTRAL_TURNO}</span>`)
    expect(HTML).not.toContain('Indique e Ganhe')
    expect(HTML.match(/<details class="sb-faq-item"/g)).toHaveLength(7)
  })

  it('explica o login com Google e linka Privacidade e Termos', () => {
    expect(HTML).toContain('Entrar com o Google')
    expect(HTML).toContain('O identificador da sua conta')
    expect(HTML.match(/href="\/privacidade"/g)?.length).toBeGreaterThanOrEqual(2)
    expect(HTML.match(/href="\/termos"/g)?.length).toBeGreaterThanOrEqual(2)
    expect(HTML).toContain('mailto:cheirindepao.contato@gmail.com')
  })

  it('o "Voltar ao app" vem escondido; o robô e quem não tem sessão veem Entrar e Criar conta', () => {
    expect(HTML).toMatch(/<a [^>]*data-sb-voltar hidden>/)
    expect(HTML).toMatch(/<a [^>]*href="\/login" data-sb-entrar>Entrar<\/a>/)
    expect(HTML).toMatch(/<a [^>]*href="\/register" data-sb-criar>Criar conta<\/a>/)
  })

  it('não usa noindex', () => {
    expect(HTML).not.toMatch(/noindex/i)
  })
})

describe('applyLanding na página real', () => {
  beforeEach(loadPage)

  it('troca a frase do turno e o card do celular', () => {
    applyLanding(document, { shifts: { manha: true, tarde: false } })
    expect(document.querySelector('[data-sb-turno]')?.textContent).toBe('pela manhã')
    expect(document.querySelector('[data-sb-turno-mock]')?.textContent).toBe('Manhã')
  })

  it('Indique ligado → item 8 no fim do FAQ, fechado e uma vez só', () => {
    const info = { shifts: { manha: true, tarde: true }, referral: { active: true, reward: 5, friendBonus: 2 } }
    applyLanding(document, info)
    applyLanding(document, info)
    const items = document.querySelectorAll('[data-sb-faq] details')
    expect(items).toHaveLength(8)
    const last = items[7] as HTMLDetailsElement
    expect(last.open).toBe(false)
    expect(last.querySelector('h3')?.textContent).toBe('Como funciona o Indique e Ganhe?')
    expect(last.querySelector('.sb-faq-a p')?.textContent).toContain('ganha 5 pãezins')
  })

  it('Indique desligado → FAQ continua com 7', () => {
    applyLanding(document, { shifts: { manha: true, tarde: true }, referral: { active: false } })
    expect(document.querySelectorAll('[data-sb-faq] details')).toHaveLength(7)
  })

  it('sem resposta da API → página como veio (neutro, 7 itens, "Manhã · Tarde")', () => {
    applyLanding(document, null)
    expect(document.querySelector('[data-sb-turno]')?.textContent).toBe(NEUTRAL_TURNO)
    expect(document.querySelector('[data-sb-turno-mock]')?.textContent).toBe('Manhã · Tarde')
    expect(document.querySelectorAll('[data-sb-faq] details')).toHaveLength(7)
  })
})
