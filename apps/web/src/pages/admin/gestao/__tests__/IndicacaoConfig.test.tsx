// A3 — Configuração do Indique e Ganhe: os estados do handoff (off, zeroErr, noGoals, msgErr,
// bonusWarn, saving, saved) saem do que o admin faz na tela e do GET/PATCH /admin/settings/indicacao.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const api = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('../../../../lib/apiFetch', () => ({ apiFetch: api.fetch }))

import { IndicacaoConfig } from '../IndicacaoConfig'

const MSG = 'Oi! Recebo pão fresquinho na porta com o Cheirin de Pão 🥖 Cadastra com o meu código {codigo} e ganha {bonus} pãezins no primeiro pedido: {link}'

const base = {
  ativa: true,
  recompensa: 5,
  bonusIndicado: 3,
  compraMinima: 0,
  limiteMensal: 10,
  prazoDias: 60,
  mensagem: MSG,
  campanha: null as null | { rotulo: string; multiplicador: number; inicio: string; fim: string },
  metas: [
    { quantidade: 5, bonus: 10 },
    { quantidade: 10, bonus: 25 },
  ],
  unitPrice: 1.2,
  today: '2026-09-29',
}

function respond(get: typeof base, patch?: { ok: boolean; status?: number; body: unknown }) {
  api.fetch.mockImplementation((_url: string, init?: { method?: string }) => {
    if (init?.method === 'PATCH') {
      const p: { ok: boolean; status?: number; body: unknown } = patch ?? {
        ok: true,
        body: JSON.parse((init as { body: string }).body),
      }
      return Promise.resolve({ ok: p.ok, status: p.status ?? (p.ok ? 200 : 422), json: () => Promise.resolve(p.body) })
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(get) })
  })
}

async function renderLoaded() {
  render(<IndicacaoConfig />)
  await waitFor(() => expect(screen.getByRole('switch', { name: 'Programa ativo' })).toBeDefined())
}

const saveBtn = () => screen.getByRole('button', { name: /^Salvar$/ }) as HTMLButtonElement

beforeEach(() => {
  vi.clearAllMocks()
})

describe('IndicacaoConfig (A3)', () => {
  it('carrega a config: programa ligado, "≈ R$" pelo preço médio e as metas', async () => {
    respond(base)
    await renderLoaded()
    expect(screen.getByRole('switch', { name: 'Programa ativo' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('Clientes veem e compartilham o código.')).toBeDefined()
    expect(screen.getByText(/R\$\s?6,00 por indicação que valer/)).toBeDefined()
    expect((screen.getByLabelText('Meta 1: número da indicação') as HTMLInputElement).value).toBe('5')
    expect((screen.getByLabelText('Meta 2: bônus em pãezins') as HTMLInputElement).value).toBe('25')
  })

  it('off: desligado explica o que acontece com quem já indicou', async () => {
    respond({ ...base, ativa: false })
    await renderLoaded()
    expect(screen.getByText('Desligado: as entradas somem do app. Quem já indicou ainda vê o histórico.')).toBeDefined()
  })

  it('zeroErr: ligar com recompensa 0 não liga e avisa', async () => {
    respond({ ...base, ativa: false, recompensa: 0 })
    await renderLoaded()
    const sw = screen.getByRole('switch', { name: 'Programa ativo' })
    fireEvent.click(sw)
    expect(sw.getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText('Para ligar o programa, defina uma recompensa maior que 0 para quem indica.')).toBeDefined()
    expect(saveBtn().disabled).toBe(true)
  })

  it('noGoals: sem metas mostra o vazio; "Adicionar meta" trava em 5', async () => {
    respond({ ...base, metas: [] })
    await renderLoaded()
    expect(screen.getByText('Nenhuma meta. O app não mostra a barra de progresso.')).toBeDefined()
    const add = screen.getByRole('button', { name: /Adicionar meta/ }) as HTMLButtonElement
    for (let i = 0; i < 5; i++) fireEvent.click(add)
    expect(screen.getAllByRole('button', { name: /Remover meta/ })).toHaveLength(5)
    expect(add.disabled).toBe(true)
  })

  it('msgErr: mensagem sem {codigo} nem {link} fica vermelha e trava o Salvar', async () => {
    respond(base)
    await renderLoaded()
    fireEvent.change(screen.getByLabelText('Mensagem de compartilhamento'), {
      target: { value: 'Oi! Recebo pão fresquinho na porta. Cadastra e ganha {bonus} pãezins!' },
    })
    expect(screen.getByText(/precisa de \{codigo\} ou \{link\}/)).toBeDefined()
    expect(saveBtn().disabled).toBe(true)
  })

  it('bonusWarn: bônus 0 com mensagem própria que usa {bonus} avisa "ganha 0 pãezins"', async () => {
    respond({ ...base, bonusIndicado: 0, mensagem: 'Use meu código {codigo} e ganhe {bonus} pãezins de presente!' })
    await renderLoaded()
    expect(screen.getByText(/Vai aparecer "ganha 0 pãezins"/)).toBeDefined()
    // É aviso, não erro: o Salvar continua livre.
    expect(saveBtn().disabled).toBe(false)
  })

  it('prévia usa a mesma montagem do app: código, link e sem o trecho do bônus quando Y = 0', async () => {
    respond({ ...base, bonusIndicado: 0 })
    await renderLoaded()
    const preview = screen.getByTestId('ref-msg-preview').textContent ?? ''
    expect(preview).toContain('JOAO7K2F')
    expect(preview).toContain('/?ref=JOAO7K2F')
    expect(preview).not.toContain('ganha')
  })

  it('chip de variável insere na mensagem', async () => {
    respond(base)
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: '+ {nome}' }))
    expect((screen.getByLabelText('Mensagem de compartilhamento') as HTMLTextAreaElement).value.endsWith(' {nome}')).toBe(true)
  })

  it('campanha: multiplicador muda a frase ao vivo; campanha nova terminando ontem é barrada', async () => {
    respond(base)
    await renderLoaded()
    fireEvent.click(screen.getByRole('switch', { name: 'Campanha por período' }))
    fireEvent.click(screen.getByRole('button', { name: '3×' }))
    expect(screen.getByText('15 pãezins')).toBeDefined()
    fireEvent.change(screen.getByLabelText('Início da campanha'), { target: { value: '2026-09-20' } })
    fireEvent.change(screen.getByLabelText('Fim da campanha'), { target: { value: '2026-09-28' } })
    expect(screen.getByText('A campanha precisa terminar hoje ou depois.')).toBeDefined()
    expect(saveBtn().disabled).toBe(true)
  })

  it('campanha já gravada e vencida não trava salvar o resto', async () => {
    respond({ ...base, campanha: { rotulo: 'Semana em dobro', multiplicador: 2, inicio: '2026-09-20', fim: '2026-09-28' } })
    await renderLoaded()
    expect(screen.queryByText('A campanha precisa terminar hoje ou depois.')).toBeNull()
    expect(saveBtn().disabled).toBe(false)
  })

  it('saved: salva a config inteira e mostra que vale para novas indicações', async () => {
    respond(base)
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar recompensa de quem indica' }))
    fireEvent.click(saveBtn())
    await waitFor(() => expect(screen.getByText(/Alterações salvas\. Valem para novas indicações/)).toBeDefined())
    const patch = api.fetch.mock.calls.find(([, init]) => init?.method === 'PATCH')!
    expect(patch[0]).toBe('/admin/settings/indicacao')
    expect(JSON.parse(patch[1].body)).toEqual({
      ativa: true,
      recompensa: 6,
      bonusIndicado: 3,
      compraMinima: 0,
      limiteMensal: 10,
      prazoDias: 60,
      mensagem: MSG,
      campanha: null,
      metas: base.metas,
    })
  })

  it('erro do servidor (422) aparece com o texto dele', async () => {
    respond(base, { ok: false, status: 422, body: { error: 'A campanha precisa terminar hoje ou depois.' } })
    await renderLoaded()
    fireEvent.click(saveBtn())
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('A campanha precisa terminar hoje ou depois.'))
  })
})
