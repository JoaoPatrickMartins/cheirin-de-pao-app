// Operação do entregador (Onda 8): recado (E16), problema (E11), sugestão de acesso e bloco
// "Acesso" (E7), selos da parada e a pergunta do gancho no pop-up (A7), ocorrência (E12).
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'

vi.mock('browser-image-compression', () => ({ default: vi.fn(async (f: File) => f) }))

import { RecadoSheet, ReportSheet, AccessSuggestSheet } from '../OpsSheets'
import { CondoAccessBlock } from '../CondoAccess'
import { StopRow } from '../StopRow'
import { ResultPopup } from '../camera/ResultPopup'
import { CourierOps } from '../../../pages/courier/CourierOps'

const stop = { clientName: 'Maria Souza', apartment: '101', block: '1' }

beforeEach(() => vi.clearAllMocks())

describe('E16 · recado', () => {
  it('escolhe o modelo e envia; mostra "Recado enviado às"', async () => {
    const onSend = vi.fn(async () => ({ kind: 'sent' as const, at: '2026-10-02T08:41:00.000Z' }))
    render(<RecadoSheet stop={stop} onSend={onSend} onClose={vi.fn()} />)
    const sheet = screen.getByRole('dialog', { name: 'Mandar recado' })
    expect(within(sheet).getByText('Maria · Apto 101 · Bloco 1')).toBeDefined()
    fireEvent.click(within(sheet).getByRole('radio', { name: /Deixei com o porteiro/ }))
    fireEvent.click(within(sheet).getByRole('button', { name: /Enviar recado/ }))
    expect(await within(sheet).findByText('Recado enviado às 05:41')).toBeDefined()
    expect(onSend).toHaveBeenCalledWith('COM_PORTEIRO')
    expect(within(sheet).getByText('O cliente recebe como notificação. Seu telefone não aparece.')).toBeDefined()
  })

  it('cliente desligou (antes ou na resposta 409): aviso e envio travado; sem sinal: guardado; repetido: aviso', async () => {
    const { unmount } = render(<RecadoSheet stop={{ ...stop, messagesOff: true }} onSend={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText(/Maria desligou os recados do entregador/)).toBeDefined()
    expect((screen.getByRole('button', { name: /Enviar recado/ }) as HTMLButtonElement).disabled).toBe(true)
    unmount()

    const optOut = vi.fn(async () => ({ kind: 'error' as const, error: 'x', code: 'OPT_OUT' }))
    const r2 = render(<RecadoSheet stop={stop} onSend={optOut} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Enviar recado/ }))
    expect(await screen.findByText(/Maria desligou os recados/)).toBeDefined()
    r2.unmount()

    render(<RecadoSheet stop={stop} onSend={vi.fn(async () => ({ kind: 'saved' as const }))} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Enviar recado/ }))
    expect(await screen.findByText('Sem sinal agora. O recado sai assim que o sinal voltar.')).toBeDefined()
  })

  it('já enviado hoje vira aviso legível', async () => {
    render(<RecadoSheet stop={stop} onSend={vi.fn(async () => ({ kind: 'error' as const, error: 'x', code: 'ALREADY' }))} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Enviar recado/ }))
    expect(await screen.findByText('Este recado já foi enviado hoje para este cliente.')).toBeDefined()
  })
})

describe('E11 · reportar problema', () => {
  it('escolhe o problema; "Outro" exige texto; avisa que a entrega não é desfeita', async () => {
    const onSend = vi.fn(async () => ({ kind: 'sent' as const }))
    render(<ReportSheet stop={{ ...stop, time: '05:33' }} onSend={onSend} onClose={vi.fn()} />)
    expect(screen.getByText('A entrega não é desfeita. A operação recebe o aviso e resolve.')).toBeDefined()
    const send = screen.getByRole('button', { name: /Enviar para a operação/ }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: 'Outro' }))
    fireEvent.click(send)
    expect(await screen.findByText('Conte o que aconteceu')).toBeDefined()
    expect(onSend).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('radio', { name: 'Confirmei por engano' }))
    fireEvent.change(screen.getByLabelText('O que aconteceu'), { target: { value: 'O saquinho ainda está comigo' } })
    fireEvent.click(send)
    await waitFor(() => expect(onSend).toHaveBeenCalledWith('CONFIRMEI_POR_ENGANO', 'O saquinho ainda está comigo'))
  })
})

describe('E7 · acesso do prédio', () => {
  const access = { portaria: '24 h', temPorteiro: true, portao: 'Interfone 0', parar: 'Vaga de visitante', obs: null, fotoUrl: 'https://cdn/condos/x.jpg' }

  it('mostra as dicas, abre a foto, sugere correção e navega', () => {
    const onSuggest = vi.fn()
    const onNavigate = vi.fn()
    render(<CondoAccessBlock access={access} onSuggest={onSuggest} onNavigate={onNavigate} />)
    expect(screen.getByText('24 h · com porteiro')).toBeDefined()
    expect(screen.getByText('Interfone 0')).toBeDefined()
    expect(screen.getByText('Vaga de visitante')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Ver a foto da entrada' }))
    expect(screen.getByRole('dialog', { name: 'Foto da entrada' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sugerir correção' }))
    fireEvent.click(screen.getByRole('button', { name: /Navegar até aqui/ }))
    expect(onSuggest).toHaveBeenCalled()
    expect(onNavigate).toHaveBeenCalled()
  })

  it('sem dicas: "Nenhuma dica ainda" e "Sugerir"', () => {
    render(<CondoAccessBlock access={null} onSuggest={vi.fn()} />)
    expect(screen.getByText(/Nenhuma dica ainda/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Sugerir' })).toBeDefined()
  })

  it('sugestão: campo + texto; enviado avisa que a operação revisa', async () => {
    const onSend = vi.fn(async () => ({ kind: 'sent' as const }))
    render(<AccessSuggestSheet condoName="Residencial Jardins" onSend={onSend} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Enviar sugestão/ }))
    expect(await screen.findByText('Escreva a sugestão')).toBeDefined()
    fireEvent.click(screen.getByRole('radio', { name: 'Onde parar' }))
    fireEvent.change(screen.getByLabelText('Sugestão'), { target: { value: 'A vaga de visitante mudou para a esquerda' } })
    fireEvent.click(screen.getByRole('button', { name: /Enviar sugestão/ }))
    expect(await screen.findByText(/Sugestão enviada/)).toBeDefined()
    expect(onSend).toHaveBeenCalledWith('PARAR', 'A vaga de visitante mudou para a esquerda')
  })
})

describe('E7 · selos da parada e recado', () => {
  const s = { orderId: 'o1', apartment: '101', block: null, clientName: 'Maria', quantity: 4, status: 'OUT_FOR_DELIVERY', sortKey: 101 }

  it('1ª entrega, gancho na rota e botão de recado', () => {
    const onRecado = vi.fn()
    render(<StopRow stop={{ ...s, isFirstOrder: true, hasHook: true, hookToDeliver: { id: 'h1' } }} order={1} isConfirmed={false} onPress={vi.fn()} onRecado={onRecado} />)
    expect(screen.getByText('1ª entrega')).toBeDefined()
    expect(screen.getByText('+ entregar gancho')).toBeDefined()
    expect(screen.queryByText('tem gancho')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Mandar recado para Maria' }))
    expect(onRecado).toHaveBeenCalled()
  })

  it('só gancho: selo "Só gancho", 🪝 no lugar dos pães e sem recado', () => {
    render(<StopRow stop={{ ...s, orderId: '', quantity: 0, hookId: 'h1', hasHook: false }} order={1} isConfirmed={false} onPress={vi.fn()} onRecado={vi.fn()} />)
    expect(screen.getByText('Só gancho')).toBeDefined()
    // 🪝 no selo e no lugar da quantidade (em vez da cestinha da parada só-Cestinha).
    expect(screen.getAllByText('🪝')).toHaveLength(2)
    expect(screen.queryByText('🧺')).toBeNull()
    expect(screen.queryByText('+ entregar gancho')).toBeNull()
    expect(screen.queryByRole('button', { name: /Mandar recado/ })).toBeNull()
  })

  it('já tem gancho; resolvida não mostra recado', () => {
    render(<StopRow stop={{ ...s, hasHook: true }} order={1} isConfirmed onPress={vi.fn()} onRecado={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Mandar recado/ })).toBeNull()
    expect(screen.queryByText('tem gancho')).toBeNull()
  })
})

describe('A7 · pergunta do gancho no pop-up', () => {
  const summary = {
    kind: 'BREAD',
    orderId: 'o1',
    marketOrderIds: [],
    clientName: 'Ana Lima',
    condominiumId: 'c1',
    condominiumName: 'Residencial Jardins',
    block: '2',
    complement: null,
    apartment: '12',
    quantity: 4,
    marketItems: [],
    isFirstOrder: false,
    hasHook: false,
    hookToDeliver: { id: 'h1' },
    status: 'DELIVERED',
    deliveredAt: '2026-10-02T08:31:00.000Z',
    failedAt: null,
    proofRequired: true,
  }

  it('segura o pop-up (não avança sozinho) até a resposta', () => {
    vi.useFakeTimers()
    try {
      const onNext = vi.fn()
      const onHook = vi.fn()
      render(<ResultPopup kind="ok" summary={summary as never} onNext={onNext} onClose={vi.fn()} onHook={onHook} />)
      expect(screen.getByText('🪝 Deixou o gancho também?')).toBeDefined()
      vi.advanceTimersByTime(5000)
      expect(onNext).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: /Ficou para outro dia/ }))
      expect(onHook).toHaveBeenCalledWith(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('E12 · falar com a operação', () => {
  it('WhatsApp + ocorrência com foto; enviada avisa o horário', async () => {
    const onSend = vi.fn(async () => ({ kind: 'sent' as const, at: '2026-10-02T08:52:00.000Z' }))
    render(<CourierOps onClose={vi.fn()} onSend={onSend} />)
    expect(screen.getByRole('link', { name: /Chamar no WhatsApp/ }).getAttribute('href')).toMatch(/^https:\/\/wa\.me\//)
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByText('Escolha o tipo da ocorrência')).toBeDefined()
    fireEvent.click(screen.getByRole('radio', { name: /Problema no veículo/ }))
    fireEvent.change(screen.getByLabelText('O que aconteceu'), { target: { value: 'Pneu furou' } })
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })
    URL.createObjectURL = vi.fn(() => 'blob:foto')
    URL.revokeObjectURL = vi.fn()
    fireEvent.change(screen.getByLabelText('Foto da ocorrência'), { target: { files: [file] } })
    expect(await screen.findByRole('img', { name: 'Foto da ocorrência' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByText('Ocorrência enviada às 05:52. A operação já recebeu.')).toBeDefined()
    expect(onSend).toHaveBeenCalledWith('VEICULO', 'Pneu furou', file)
  })

  it('sem sinal: guardada', async () => {
    render(<CourierOps onClose={vi.fn()} onSend={vi.fn(async () => ({ kind: 'saved' as const }))} />)
    fireEvent.click(screen.getByRole('radio', { name: /Atraso/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByText('Sem sinal agora. Guardamos a ocorrência e enviamos sozinhos.')).toBeDefined()
  })
})
