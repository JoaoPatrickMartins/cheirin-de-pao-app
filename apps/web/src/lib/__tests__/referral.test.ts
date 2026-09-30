import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  REFERRAL_STORAGE_KEY,
  buildReferralLink,
  buildReferralMessage,
  captureReferralFromUrl,
  clearStoredReferral,
  getStoredReferral,
  shareReferral,
  shortDay,
  whatsappShareUrl,
} from '../referral'

const DAY = 86_400_000

function setUrl(path: string) {
  window.history.replaceState(null, '', path)
}

beforeEach(() => {
  localStorage.clear()
  setUrl('/')
})

describe('captureReferralFromUrl', () => {
  it('guarda o ?ref= normalizado (30 dias) e tira o parâmetro da URL', () => {
    setUrl('/?ref=joao-7k2f&utm=x#top')
    expect(captureReferralFromUrl()).toBe('JOAO7K2F')
    expect(window.location.search).toBe('?utm=x')
    expect(window.location.hash).toBe('#top')
    const stored = JSON.parse(localStorage.getItem(REFERRAL_STORAGE_KEY)!)
    expect(stored).toMatchObject({ code: 'JOAO7K2F', source: 'LINK' })
  })

  it('sem ?ref= não mexe em nada', () => {
    setUrl('/client/home?x=1')
    expect(captureReferralFromUrl()).toBeNull()
    expect(window.location.search).toBe('?x=1')
    expect(localStorage.getItem(REFERRAL_STORAGE_KEY)).toBeNull()
  })

  it('lixo no ?ref= é descartado (mas sai da URL)', () => {
    setUrl('/?ref=<script>')
    expect(captureReferralFromUrl()).toBeNull()
    expect(window.location.search).toBe('')
    expect(localStorage.getItem(REFERRAL_STORAGE_KEY)).toBeNull()
  })
})

describe('getStoredReferral', () => {
  it('devolve o código dentro dos 30 dias', () => {
    localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify({ code: 'JOAO7K2F', source: 'LINK', at: Date.now() - 29 * DAY }))
    expect(getStoredReferral()).toMatchObject({ code: 'JOAO7K2F', source: 'LINK' })
  })

  it('vencido ou corrompido → null e limpa', () => {
    localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify({ code: 'JOAO7K2F', at: Date.now() - 31 * DAY }))
    expect(getStoredReferral()).toBeNull()
    expect(localStorage.getItem(REFERRAL_STORAGE_KEY)).toBeNull()

    localStorage.setItem(REFERRAL_STORAGE_KEY, '{quebrado')
    expect(getStoredReferral()).toBeNull()
  })

  it('clearStoredReferral apaga', () => {
    localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify({ code: 'JOAO7K2F', at: Date.now() }))
    clearStoredReferral()
    expect(getStoredReferral()).toBeNull()
  })
})

describe('link e mensagem', () => {
  it('link com a origem do app', () => {
    expect(buildReferralLink('JOAO7K2F', 'https://app.cheirindepao.com.br')).toBe('https://app.cheirindepao.com.br/?ref=JOAO7K2F')
  })

  it('mensagem = renderReferralMessage do shared (Y = 0 tira o trecho do bônus)', () => {
    const template = 'Cadastra com o meu código {codigo} e ganha {bonus} pãezins no primeiro pedido: {link}'
    expect(buildReferralMessage({ template, code: 'JOAO7K2F', name: 'João', welcomeBreads: 3, origin: 'https://x.app' })).toBe(
      'Cadastra com o meu código JOAO7K2F e ganha 3 pãezins no primeiro pedido: https://x.app/?ref=JOAO7K2F',
    )
    expect(buildReferralMessage({ template, code: 'JOAO7K2F', name: 'João', welcomeBreads: 0, origin: 'https://x.app' })).toBe(
      'Cadastra com o meu código JOAO7K2F: https://x.app/?ref=JOAO7K2F',
    )
  })

  it('WhatsApp com a mensagem codificada; dia curto da campanha', () => {
    expect(whatsappShareUrl('Oi & tchau')).toBe('https://wa.me/?text=Oi%20%26%20tchau')
    expect(shortDay('2026-10-11')).toBe('11/10')
  })
})

describe('shareReferral', () => {
  const nav = navigator as Navigator & { share?: unknown; clipboard?: unknown }
  const original = { share: nav.share, clipboard: nav.clipboard }
  afterEach(() => {
    Object.defineProperty(navigator, 'share', { value: original.share, configurable: true })
    Object.defineProperty(navigator, 'clipboard', { value: original.clipboard, configurable: true })
  })

  it('com Web Share → abre o menu do celular', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    await expect(shareReferral('msg')).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith({ text: 'msg' })
  })

  it('fechar o menu não copia por cima', async () => {
    const abort = Object.assign(new Error('x'), { name: 'AbortError' })
    Object.defineProperty(navigator, 'share', { value: vi.fn().mockRejectedValue(abort), configurable: true })
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await expect(shareReferral('msg')).resolves.toBe('cancelled')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('sem Web Share → copia a mensagem', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await expect(shareReferral('msg')).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledWith('msg')
  })
})
