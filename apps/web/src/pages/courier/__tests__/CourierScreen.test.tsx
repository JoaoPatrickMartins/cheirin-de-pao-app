// Tela do entregador — dock fixo, câmera contínua (scan → pop-up), digitar código e entregas
// novas durante o dia (Onda 2 do plano do entregador).
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))
const mockLogout = vi.hoisted(() => vi.fn())
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'k1', name: 'Antônio Ribeiro' }, logout: mockLogout }) }))
vi.mock('../../../components/PushNotificationToggle', () => ({ PushNotificationToggle: () => null }))
vi.mock('../../../components/courier/CourierMap', () => ({ CourierMap: () => null }))
vi.mock('../../../lib/qrDetector', () => ({ warmUpQrDetector: vi.fn() }))
vi.mock('../../../lib/beep', () => ({ beep: vi.fn(), unlockBeep: vi.fn() }))
// A câmera real é coberta no teste do ScanScreen; aqui um dublê que "lê" um cupom e tira a foto.
interface PhotoProps { caption: string; hint: string; required: boolean; onCapture: (b: Blob) => void; onSkip: () => void; onCantShoot: () => void }
vi.mock('../../../components/courier/camera/ScanScreen', () => ({
  ScanScreen: ({ onDetect, onClose, overlay, counter, mode, photo }: { onDetect: (t: string) => void; onClose: () => void; overlay?: React.ReactNode; counter?: string; mode?: string; photo?: PhotoProps }) => (
    <div data-testid="scanner" data-mode={mode ?? 'scan'}>
      <span>scanner {counter}</span>
      <button type="button" onClick={onClose}>Fechar</button>
      {mode === 'photo' && photo ? (
        <div>
          <span>{photo.caption}</span>
          <span>{photo.hint}</span>
          <button type="button" onClick={() => photo.onCapture(new Blob(['x'], { type: 'image/jpeg' }))}>usar foto</button>
          {photo.required ? (
            <button type="button" onClick={photo.onCantShoot}>Não consigo tirar a foto</button>
          ) : (
            <button type="button" onClick={photo.onSkip}>Pular a foto</button>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => onDetect('66f1a2b3c4d5e6f7a8b9c0d1')}>simular leitura</button>
      )}
      {overlay}
    </div>
  ),
}))

import { CourierScreen } from '../CourierScreen'
import { resetCourierQueue } from '../../../lib/courierQueue'
import { meBody, scheduleBody, scheduleOffToday } from './peopleFixtures'
import { loadBadgeCache, saveBadgeCache } from '../../../lib/courierBadgeCache'

const stop = (orderId: string, apartment: string, clientName: string) => ({
  orderId,
  apartment,
  block: null,
  complement: null,
  clientName,
  quantity: 4,
  status: 'OUT_FOR_DELIVERY',
  sortKey: Number(apartment),
  slotId: 'manha',
  slotLabel: 'Manhã',
  marketOrderIds: [],
  marketItems: [],
  marketItemCount: 0,
})
const today = (extra: ReturnType<typeof stop>[] = []) => ({
  condos: [
    {
      condominiumId: 'c1',
      condominiumName: 'Residencial Jardins',
      address: '',
      lat: null,
      lng: null,
      stops: [stop('66f1a2b3c4d5e6f7a8b9c0d1', '101', 'Maria Souza'), stop('66f1a2b3c4d5e6f7a8b9aaaa', '102', 'Pedro Alves'), ...extra],
    },
  ],
  totalStops: 2 + extra.length,
  totalBreads: 8,
  totalItems: 0,
  routes: [],
  slots: [{ slotId: 'manha', label: 'Manhã', emoji: '☀️', time: '06:30' }],
  completed: [] as unknown[],
  completedTotal: 0,
  rules: { fotoEntrega: true, fotoNaoEntrega: false, podeReordenar: false, podeRecados: false },
})
const summary = {
  kind: 'BREAD',
  orderId: '66f1a2b3c4d5e6f7a8b9c0d1',
  marketOrderIds: [],
  clientName: 'Maria Souza',
  condominiumId: 'c1',
  condominiumName: 'Residencial Jardins',
  block: null,
  complement: null,
  apartment: '101',
  quantity: 4,
  marketItems: [],
  isFirstOrder: false,
  hasHook: false,
  hookToDeliver: null,
  status: 'DELIVERED',
  deliveredAt: '2026-10-01T09:42:00.000Z',
  failedAt: null,
  proofRequired: true,
}
const failedSummary = { ...summary, status: 'NOT_DELIVERED', deliveredAt: null, failedAt: '2026-10-01T09:50:00.000Z', proofRequired: false }
const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) })

let todayBody = today()
let scheduleRes = scheduleBody()
beforeEach(() => {
  vi.clearAllMocks()
  resetCourierQueue()
  localStorage.clear()
  todayBody = today()
  scheduleRes = scheduleBody()
  mockApiFetch.mockImplementation((url: string, opts?: { method?: string }) => {
    if (url === '/courier/orders/today') return json(todayBody)
    if (url === '/courier/me') return json(meBody())
    if (url === '/courier/schedule') return json(scheduleRes)
    if (opts?.method === 'PATCH' && url.endsWith('/confirm')) return json(summary)
    if (opts?.method === 'PATCH' && url.endsWith('/not-delivered')) return json(failedSummary)
    if (opts?.method === 'POST' && url.includes('/proof')) return json({ status: 'OK' })
    return json({})
  })
})

const calls = (part: string) => mockApiFetch.mock.calls.filter(([u]) => String(u).includes(part))

describe('CourierScreen — Onda 2', () => {
  it('dock fixo com o progresso do dia; o botão de escanear do topo saiu', async () => {
    render(<CourierScreen />)
    const scan = await screen.findByRole('button', { name: /Escanear cupom/ })
    expect(scan.textContent).toContain('0/2')
    expect(screen.getAllByRole('button', { name: /Escanear cupom/ })).toHaveLength(1)
  })

  it('escanear → confirma com via SCAN → pop-up com o apto', async () => {
    render(<CourierScreen />)
    fireEvent.click(await screen.findByRole('button', { name: /Escanear cupom/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'simular leitura' }))
    const popup = await screen.findByRole('alertdialog', { name: 'Entrega confirmada' })
    expect(within(popup).getByText('Apto 101')).toBeDefined()
    const [url, opts] = mockApiFetch.mock.calls.find(([u]) => String(u).endsWith('/confirm'))!
    expect(url).toBe('/courier/orders/66f1a2b3c4d5e6f7a8b9c0d1/confirm')
    expect(JSON.parse(opts.body)).toMatchObject({ via: 'SCAN', clientOpId: expect.any(String) })
  })

  it('cupom já confirmado → pop-up "Já confirmada" (409)', async () => {
    mockApiFetch.mockImplementation((url: string, opts?: { method?: string }) => {
      if (url === '/courier/orders/today') return json(todayBody)
      if (opts?.method === 'PATCH') return json({ error: 'Essa entrega já foi confirmada', summary }, 409)
      return json({})
    })
    render(<CourierScreen />)
    fireEvent.click(await screen.findByRole('button', { name: /Escanear cupom/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'simular leitura' }))
    expect(await screen.findByRole('alertdialog', { name: 'Já confirmada' })).toBeDefined()
    expect(screen.getByText('Essa entrega já foi confirmada às 06:42.')).toBeDefined()
  })

  it('digitar código acha a parada na lista e confirma com via CODE', async () => {
    render(<CourierScreen />)
    fireEvent.click(await screen.findByRole('button', { name: 'Digitar código' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'B9C0D1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
    expect(await screen.findByRole('alertdialog', { name: 'Entrega confirmada' })).toBeDefined()
    const [, opts] = mockApiFetch.mock.calls.find(([u]) => String(u).endsWith('/confirm'))!
    expect(JSON.parse(opts.body).via).toBe('CODE')
  })

  it('entrega nova atribuída durante o dia: banner + "Atualizar" coloca na lista', async () => {
    render(<CourierScreen />)
    await screen.findByRole('button', { name: /Escanear cupom/ })
    todayBody = today([stop('66f1a2b3c4d5e6f7a8b9bbbb', '201', 'Ana Lima')])
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(await screen.findByText('1 entrega nova na sua rota')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Escanear cupom/ }).textContent).toContain('0/3'))
  })
})

describe('CourierScreen — Onda 3 (comprovante e não entrega)', () => {
  it('scan → pop-up → foto na mesma câmera → envia em segundo plano e volta a ler', async () => {
    render(<CourierScreen />)
    fireEvent.click(await screen.findByRole('button', { name: /Escanear cupom/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'simular leitura' }))
    const popup = await screen.findByRole('alertdialog', { name: 'Entrega confirmada' })
    expect(within(popup).getByText(/Foto da entrega em 3 s/)).toBeDefined()
    fireEvent.click(popup)
    expect(screen.getByTestId('scanner').dataset.mode).toBe('photo')
    expect(screen.getByText('Foto da entrega · Apto 101')).toBeDefined()
    expect(screen.getByText('Mostre o saquinho na porta ou no gancho')).toBeDefined()
    // Obrigatória (regra do entregador): sem "Pular".
    expect(screen.queryByRole('button', { name: 'Pular a foto' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'usar foto' }))
    expect(await screen.findByText('Foto salva · escaneie o próximo')).toBeDefined()
    expect(screen.getByTestId('scanner').dataset.mode).toBe('scan')
    await waitFor(() => expect(calls('/proof')).toHaveLength(1))
    const [url, opts] = calls('/proof')[0]
    expect(url).toMatch(/^\/courier\/stops\/66f1a2b3c4d5e6f7a8b9c0d1\/proof\?outcome=DELIVERED&clientOpId=/)
    expect(opts.method).toBe('POST')
    expect(opts.body).toBeInstanceOf(FormData)
  })

  it('foto obrigatória: "Não consigo tirar a foto" → motivo → registra NONE e segue', async () => {
    render(<CourierScreen />)
    fireEvent.click(await screen.findByRole('button', { name: /Escanear cupom/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'simular leitura' }))
    fireEvent.click(await screen.findByRole('alertdialog', { name: 'Entrega confirmada' }))
    fireEvent.click(screen.getByRole('button', { name: 'Não consigo tirar a foto' }))
    fireEvent.click(await screen.findByRole('radio', { name: /Local sem luz/ }))
    fireEvent.click(screen.getByRole('button', { name: /Seguir sem foto/ }))
    await waitFor(() => expect(screen.getByTestId('scanner').dataset.mode).toBe('scan'))
    const [url, opts] = calls('/proof/skip')[0]
    expect(url).toBe('/courier/stops/66f1a2b3c4d5e6f7a8b9c0d1/proof/skip')
    expect(JSON.parse(opts.body)).toMatchObject({ outcome: 'DELIVERED', mode: 'NONE', reasonCode: 'SEM_LUZ' })
  })

  it('pela lista: sheet grande → confirma (LIST) → pop-up claro → foto opcional "Pular" → fecha a câmera', async () => {
    mockApiFetch.mockImplementation((url: string, opts?: { method?: string }) => {
      if (url === '/courier/orders/today') return json(todayBody)
      if (opts?.method === 'PATCH' && url.endsWith('/confirm')) return json({ ...summary, proofRequired: false })
      return json({})
    })
    render(<CourierScreen />)
    fireEvent.click(await screen.findByText('Maria Souza'))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByText('Apto 101')).toBeDefined()
    fireEvent.click(within(sheet).getByRole('button', { name: /Confirmar entrega/ }))
    const popup = await screen.findByRole('alertdialog', { name: 'Entrega confirmada' })
    expect(JSON.parse(calls('/confirm')[0][1].body).via).toBe('LIST')
    fireEvent.click(popup)
    expect(screen.getByTestId('scanner').dataset.mode).toBe('photo')
    fireEvent.click(screen.getByRole('button', { name: 'Pular a foto' }))
    await waitFor(() => expect(screen.queryByTestId('scanner')).toBeNull())
    expect(JSON.parse(calls('/proof/skip')[0][1].body)).toMatchObject({ outcome: 'DELIVERED', mode: 'SKIPPED' })
  })

  it('não consegui entregar: motivo padronizado → PATCH com failureCode → foto da porta', async () => {
    render(<CourierScreen />)
    fireEvent.click(await screen.findByText('Maria Souza'))
    fireEvent.click(await screen.findByRole('button', { name: /Não consegui entregar/ }))
    expect(screen.getByText('opcional')).toBeDefined()
    fireEvent.click(screen.getByRole('radio', { name: /Portaria não liberou/ }))
    fireEvent.click(screen.getByRole('button', { name: /Confirmar não entrega/ }))
    expect(await screen.findByText('Foto da não entrega · Apto 101')).toBeDefined()
    expect(screen.getByText('Mostre a porta ou a portaria')).toBeDefined()
    const [url, opts] = calls('/not-delivered')[0]
    expect(url).toBe('/courier/orders/66f1a2b3c4d5e6f7a8b9c0d1/not-delivered')
    expect(JSON.parse(opts.body)).toMatchObject({ failureCode: 'PORTARIA_NAO_LIBEROU', via: 'LIST' })
    fireEvent.click(screen.getByRole('button', { name: 'usar foto' }))
    await waitFor(() => expect(calls('/proof')).toHaveLength(1))
    expect(calls('/proof')[0][0]).toContain('outcome=NOT_DELIVERED')
    expect(screen.queryByTestId('scanner')).toBeNull()
  })

  it('"Outro" sem texto não envia', async () => {
    render(<CourierScreen />)
    fireEvent.click(await screen.findByText('Maria Souza'))
    fireEvent.click(await screen.findByRole('button', { name: /Não consegui entregar/ }))
    fireEvent.click(screen.getByRole('radio', { name: /Outro/ }))
    expect((screen.getByRole('button', { name: /Confirmar não entrega/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(calls('/not-delivered')).toHaveLength(0)
  })

  it('Realizadas mostram o comprovante vindo do servidor', async () => {
    todayBody = {
      ...today(),
      completed: [
        {
          condominiumId: 'c1',
          condominiumName: 'Residencial Jardins',
          stops: [
            { ...stop('66f1a2b3c4d5e6f7a8b9dddd', '301', 'Rita Dias'), status: 'DELIVERED', completedAt: '2026-10-01T09:10:00.000Z', proofStatus: 'OK' },
            { ...stop('66f1a2b3c4d5e6f7a8b9eeee', '302', 'Caio Reis'), status: 'DELIVERED', completedAt: '2026-10-01T09:12:00.000Z', proofStatus: 'SKIPPED' },
          ],
        },
      ],
      completedTotal: 2,
    }
    render(<CourierScreen />)
    fireEvent.click(await screen.findByRole('button', { name: /Realizadas/ }))
    expect(await screen.findByText('foto ok')).toBeDefined()
    expect(screen.getByText('sem foto · pulada')).toBeDefined()
  })
})

describe('CourierScreen — parada só de gancho (plano-gancho-sozinho-na-rota)', () => {
  const hookStop = { ...stop('', '204', 'Ana Lima'), quantity: 0, hookId: '66f1a2b3c4d5e6f7a8b9h00k', hookToDeliver: null }
  const hookSummary = { ...summary, kind: 'HOOK', orderId: null, hookId: hookStop.hookId, apartment: '204', clientName: 'Ana Lima', quantity: 0 }
  beforeEach(() => {
    todayBody = today([hookStop as never])
    mockApiFetch.mockImplementation((url: string, opts?: { method?: string }) => {
      if (url === '/courier/orders/today') return json(todayBody)
      if (url === '/courier/me') return json(meBody())
      if (url === '/courier/schedule') return json(scheduleRes)
      if (opts?.method === 'PATCH' && url.endsWith('/confirm')) return json(hookSummary)
      if (opts?.method === 'PATCH' && url.endsWith('/not-delivered')) return json({ ...hookSummary, status: 'NOT_DELIVERED', deliveredAt: null, failedAt: '2026-10-01T09:50:00.000Z', proofRequired: false })
      if (opts?.method === 'POST' && url.includes('/proof')) return json({ status: 'OK' })
      return json({})
    })
  })

  it('na lista: selo "Só gancho" → "Gancho entregue" → PATCH do gancho → pop-up → foto pela chave do gancho', async () => {
    render(<CourierScreen />)
    expect(await screen.findByText('Só gancho')).toBeDefined()
    fireEvent.click(screen.getByText('Ana Lima'))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByText('Gancho de porta')).toBeDefined()
    fireEvent.click(within(sheet).getByRole('button', { name: /Gancho entregue/ }))
    const popup = await screen.findByRole('alertdialog', { name: 'Gancho entregue' })
    const [url, opts] = calls('/confirm')[0]
    expect(url).toBe(`/courier/hooks/${hookStop.hookId}/confirm`)
    expect(JSON.parse(opts.body).via).toBe('LIST')
    // O próprio gancho é a entrega: não pergunta "Deixou o gancho também?".
    expect(within(popup).queryByText(/Deixou o gancho também/)).toBeNull()
    fireEvent.click(popup)
    fireEvent.click(screen.getByRole('button', { name: 'usar foto' }))
    await waitFor(() => expect(calls('/proof')).toHaveLength(1))
    expect(calls('/proof')[0][0]).toMatch(new RegExp(`^/courier/stops/${hookStop.hookId}/proof\\?outcome=DELIVERED`))
  })

  it('não consegui entregar vai para a rota do gancho', async () => {
    render(<CourierScreen />)
    fireEvent.click(await screen.findByText('Ana Lima'))
    fireEvent.click(await screen.findByRole('button', { name: /Não consegui entregar/ }))
    fireEvent.click(screen.getByRole('radio', { name: /Cliente ausente/ }))
    fireEvent.click(screen.getByRole('button', { name: /Confirmar não entrega/ }))
    await waitFor(() => expect(calls('/not-delivered')).toHaveLength(1))
    expect(calls('/not-delivered')[0][0]).toBe(`/courier/hooks/${hookStop.hookId}/not-delivered`)
  })
})

describe('CourierScreen — Onda 4 (fila offline)', () => {
  // Sem sinal: toda escrita falha na conexão; a leitura da rota já veio antes.
  let online = true
  beforeEach(() => {
    online = true
    mockApiFetch.mockImplementation((url: string, opts?: { method?: string }) => {
      if (!online) return Promise.reject(new TypeError('Failed to fetch'))
      if (url === '/courier/orders/today') return json(todayBody)
      if (url === '/courier/me') return json(meBody())
      if (opts?.method === 'PATCH' && url.endsWith('/confirm')) return json(summary)
      if (opts?.method === 'PATCH' && url.endsWith('/not-delivered')) return json(failedSummary)
      if (opts?.method === 'POST' && url.includes('/proof')) return json({ status: 'OK' })
      return json({})
    })
  })

  it('scan sem sinal: "Confirmada · sem sinal", fica guardada e sobe com o mesmo id quando o sinal volta', async () => {
    render(<CourierScreen />)
    fireEvent.click(await screen.findByRole('button', { name: /Escanear cupom/ }))
    online = false
    fireEvent.click(await screen.findByRole('button', { name: 'simular leitura' }))
    const popup = await screen.findByRole('alertdialog', { name: 'Confirmada · sem sinal' })
    expect(within(popup).getByText('Apto 101')).toBeDefined()
    expect(within(popup).getByText('Sem sinal agora. Guardamos a entrega e enviamos sozinhos.')).toBeDefined()
    // Foto em seguida, também guardada.
    fireEvent.click(popup)
    fireEvent.click(screen.getByRole('button', { name: 'usar foto' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(await screen.findByText(/1 entrega guardada, sobe/)).toBeDefined()
    expect(screen.getByRole('button', { name: /Escanear cupom/ }).textContent).toContain('1/2')

    online = true
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    await waitFor(() => expect(calls('/proof').filter(([, o]) => o?.method === 'POST').length).toBeGreaterThan(0))
    await waitFor(() => expect(screen.queryByText(/entrega guardada/)).toBeNull())
    // Todas as tentativas da confirmação com o MESMO clientOpId e o horário da leitura.
    const bodies = calls('/confirm').map(([, o]) => JSON.parse(o.body))
    expect(bodies.length).toBeGreaterThanOrEqual(2)
    expect(new Set(bodies.map((b) => b.clientOpId)).size).toBe(1)
    expect(new Set(bodies.map((b) => b.occurredAt)).size).toBe(1)
    expect(bodies[0].occurredAt).toEqual(expect.any(String))
    expect(screen.getByRole('button', { name: /Escanear cupom/ }).textContent).toContain('1/2')
  })

  it('não entrega sem sinal: "Guardado · seguir para a foto" leva à foto da porta', async () => {
    render(<CourierScreen />)
    fireEvent.click(await screen.findByText('Maria Souza'))
    fireEvent.click(await screen.findByRole('button', { name: /Não consegui entregar/ }))
    fireEvent.click(screen.getByRole('radio', { name: /Cliente ausente/ }))
    online = false
    fireEvent.click(screen.getByRole('button', { name: /Confirmar não entrega/ }))
    expect(await screen.findByText('Sem sinal agora. Guardamos a não entrega e enviamos sozinhos.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Guardado · seguir para a foto/ }))
    expect(screen.getByText('Foto da não entrega · Apto 101')).toBeDefined()
    expect(screen.getByTestId('scanner').dataset.mode).toBe('photo')
  })

  it('sair com entrega guardada pede confirmação; "Sair mesmo assim" descarta e sai', async () => {
    render(<CourierScreen />)
    fireEvent.click(await screen.findByRole('button', { name: /Escanear cupom/ }))
    online = false
    fireEvent.click(await screen.findByRole('button', { name: 'simular leitura' }))
    await screen.findByRole('alertdialog', { name: 'Confirmada · sem sinal' })
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir perfil' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Perfil' })).getByRole('button', { name: 'Sair' }))
    const sheet = await screen.findByRole('dialog', { name: 'Sair do app?' })
    expect(within(sheet).getByText('1 entrega ainda não subiu.')).toBeDefined()
    expect(mockLogout).not.toHaveBeenCalled()
    fireEvent.click(within(sheet).getByRole('button', { name: /Sair mesmo assim/ }))
    await waitFor(() => expect(mockLogout).toHaveBeenCalled())
  })

  it('sem nada guardado, "Sair" confirma e sai (Cancelar fica)', async () => {
    render(<CourierScreen />)
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir perfil' }))
    const perfil = screen.getByRole('dialog', { name: 'Perfil' })
    fireEvent.click(within(perfil).getByRole('button', { name: 'Sair' }))
    let sheet = screen.getByRole('dialog', { name: 'Sair do app?' })
    expect(within(sheet).getByText('As entregas guardadas sem sinal são enviadas antes.')).toBeDefined()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog', { name: 'Sair do app?' })).toBeNull()
    expect(mockLogout).not.toHaveBeenCalled()
    fireEvent.click(within(perfil).getByRole('button', { name: 'Sair' }))
    sheet = screen.getByRole('dialog', { name: 'Sair do app?' })
    fireEvent.click(within(sheet).getByRole('button', { name: /^Sair$/ }))
    await waitFor(() => expect(mockLogout).toHaveBeenCalled())
    // o crachá guardado no aparelho (Onda 11 · T-27) sai junto
    expect(loadBadgeCache('k1')).toBeNull()
  })

  it('sem sinal e sem rota guardada: explica que precisa abrir com sinal uma vez', async () => {
    online = false
    render(<CourierScreen />)
    expect(await screen.findByText(/Abra o app com sinal uma vez para baixar a rota de hoje/)).toBeDefined()
  })

  it('abrir o app sem sinal mostra a rota guardada de hoje', async () => {
    const first = render(<CourierScreen />)
    await screen.findByText('Maria Souza')
    first.unmount()
    online = false
    render(<CourierScreen />)
    expect(await screen.findByText('Maria Souza')).toBeDefined()
    expect(screen.getByText(/Sem sinal\. Mostrando a rota guardada neste aparelho/)).toBeDefined()
  })
})

describe('CourierScreen — Onda 5 (rota do dia)', () => {
  const route = (state: 'pronta' | 'em_rota' | 'encerrada') => ({
    slotId: 'manha',
    label: 'Manhã',
    emoji: '☀️',
    time: '06:30',
    condominiumIds: ['c1'],
    route: { distanceKm: '9.2', durationMin: 40, geometry: [] },
    state,
    run: state === 'pronta' ? null : { id: '66f1a2b3c4d5e6f7a8b9ffff', startedAt: '2026-10-02T08:12:00.000Z', endedAt: null, startMode: 'BASE' },
    reorderedToday: false,
    eta: [{ condominiumId: 'c1', time: '06:41' }],
  })
  const withRoute = (state: 'pronta' | 'em_rota' | 'encerrada') => ({ ...today(), routes: [route(state)], base: { endereco: 'Rua das Flores, 120', lat: -23.4, lng: -46.5 }, routeCondos: [] })
  const summaryBody = (over: Record<string, unknown> = {}) => ({
    slotId: 'manha',
    label: 'Manhã',
    emoji: '☀️',
    time: '06:30',
    run: { id: '66f1a2b3c4d5e6f7a8b9ffff', status: 'STARTED', startedAt: '2026-10-02T08:12:00.000Z', endedAt: null },
    pending: { stops: [], noPhoto: [] },
    stats: { delivered: 2, notDelivered: 0, breads: 8, cestinhas: 0, ganchos: 0, durationMin: 88 },
    km: 9.6,
    voltaBase: true,
    fuel: { litros: 0.25, custo: 1.54, kmPorLitro: 38, preco: 6.09, combustivel: 'GASOLINA' },
    fuelReason: null,
    fuelVisible: true, // switch "Fim da rota" do A5 ligado
    next: null,
    ...over,
  })

  it('rota pronta: card com "Pronta" e Iniciar; o dock é "Iniciar rota" e inicia pela base avisando os clientes', async () => {
    todayBody = withRoute('pronta') as never
    mockApiFetch.mockImplementation((url: string, opts?: { method?: string }) => {
      if (url === '/courier/orders/today') return json(todayBody)
      if (url === '/courier/runs/start') return json({ run: { id: 'r1' }, notified: 2 })
      return json({})
    })
    render(<CourierScreen />)
    expect(await screen.findByText('Pronta · 2 paradas · ~9,2 km')).toBeDefined()
    expect(screen.queryByRole('button', { name: /Escanear cupom/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Iniciar rota · ☀️ Manhã/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Iniciar rota' })
    expect(within(sheet).getByText('Rua das Flores, 120')).toBeDefined()
    expect(within(sheet).getByText('Ao iniciar, seus clientes veem que o pão saiu para entrega.')).toBeDefined()
    fireEvent.click(within(sheet).getByRole('button', { name: /^Iniciar rota$/ }))
    expect(await screen.findByText('Rota iniciada · 2 clientes avisados')).toBeDefined()
    const [, opts] = mockApiFetch.mock.calls.find(([u]) => u === '/courier/runs/start')!
    expect(JSON.parse(opts.body)).toEqual({ slotId: 'manha', startMode: 'BASE' })
  })

  it('em rota: o card diz desde quando e o dock volta a ser Escanear', async () => {
    todayBody = withRoute('em_rota') as never
    render(<CourierScreen />)
    expect(await screen.findByText(/Em rota desde 05:12 · 0\/2/)).toBeDefined()
    expect(screen.getByRole('button', { name: /Escanear cupom/ })).toBeDefined()
  })

  it('tudo resolvido: "Encerrar rota da manhã" → resumo com combustível → encerra → rota concluída', async () => {
    todayBody = { ...withRoute('em_rota'), condos: [], totalStops: 0, completed: [{ condominiumId: 'c1', condominiumName: 'Residencial Jardins', stops: [{ ...stop('66f1a2b3c4d5e6f7a8b9c0d1', '101', 'Maria Souza'), status: 'DELIVERED', completedAt: null, proofStatus: 'OK' }] }], completedTotal: 1 } as never
    mockApiFetch.mockImplementation((url: string, opts?: { method?: string }) => {
      if (url === '/courier/orders/today') return json(todayBody)
      if (url === '/courier/runs/manha/summary') return json(summaryBody())
      if (opts?.method === 'POST' && url.endsWith('/end')) return json({ run: { id: 'r1', endedAt: '2026-10-02T09:40:00.000Z' }, summary: summaryBody({ run: { id: 'r1', status: 'ENDED', startedAt: '2026-10-02T08:12:00.000Z', endedAt: '2026-10-02T09:40:00.000Z' }, next: { slotId: 'tarde', label: 'Tarde', emoji: '🌙', time: '15:30', stops: 5 } }) })
      return json({})
    })
    render(<CourierScreen />)
    fireEvent.click(await screen.findByRole('button', { name: /Encerrar rota da manhã/ }))
    const end = await screen.findByRole('dialog', { name: 'Encerrar rota' })
    expect(await within(end).findByText('~9,6 km · ≈ R$ 1,54')).toBeDefined()
    expect(within(end).getByText('1h28')).toBeDefined()
    fireEvent.click(within(end).getByRole('button', { name: /^Encerrar rota$/ }))
    const done = await screen.findByRole('dialog', { name: 'Rota concluída' })
    expect(within(done).getByText('Rota da manhã concluída 🥖')).toBeDefined()
    expect(within(done).getByText(/Encerrada às 06:40/)).toBeDefined()
    expect(within(done).getByText(/Próxima: Tarde · 15:30 · 5 paradas/)).toBeDefined()
    fireEvent.click(within(done).getByRole('button', { name: 'Voltar ao início' }))
    expect(screen.queryByRole('dialog', { name: 'Rota concluída' })).toBeNull()
  })

  it('Fim da rota com o switch desligado (padrão): sem km nem combustível; a rota concluída mostra a duração', async () => {
    todayBody = { ...withRoute('em_rota'), condos: [], totalStops: 0, completed: [{ condominiumId: 'c1', condominiumName: 'Residencial Jardins', stops: [{ ...stop('66f1a2b3c4d5e6f7a8b9c0d1', '101', 'Maria Souza'), status: 'DELIVERED', completedAt: null, proofStatus: 'OK' }] }], completedTotal: 1 } as never
    const hidden = { km: null, fuel: null, fuelReason: null, fuelVisible: false }
    mockApiFetch.mockImplementation((url: string, opts?: { method?: string }) => {
      if (url === '/courier/orders/today') return json(todayBody)
      if (url === '/courier/runs/manha/summary') return json(summaryBody(hidden))
      if (opts?.method === 'POST' && url.endsWith('/end')) return json({ run: { id: 'r1', endedAt: '2026-10-02T09:40:00.000Z' }, summary: summaryBody({ ...hidden, run: { id: 'r1', status: 'ENDED', startedAt: '2026-10-02T08:12:00.000Z', endedAt: '2026-10-02T09:40:00.000Z' } }) })
      return json({})
    })
    render(<CourierScreen />)
    fireEvent.click(await screen.findByRole('button', { name: /Encerrar rota da manhã/ }))
    const end = await screen.findByRole('dialog', { name: 'Encerrar rota' })
    expect(await within(end).findByText('1h28')).toBeDefined()
    expect(within(end).queryByText(/km/)).toBeNull()
    expect(within(end).queryByText(/combustível/i)).toBeNull()
    fireEvent.click(within(end).getByRole('button', { name: /^Encerrar rota$/ }))
    const done = await screen.findByRole('dialog', { name: 'Rota concluída' })
    expect(within(done).getByText('na rua')).toBeDefined()
    expect(within(done).queryByText('estimado')).toBeNull()
  })

  it('Fim da rota com GNV (Onda 11): a conta sai em km/m³ e "GNV"', async () => {
    todayBody = { ...withRoute('em_rota'), condos: [], totalStops: 0, completed: [{ condominiumId: 'c1', condominiumName: 'Residencial Jardins', stops: [{ ...stop('66f1a2b3c4d5e6f7a8b9c0d1', '101', 'Maria Souza'), status: 'DELIVERED', completedAt: null, proofStatus: 'OK' }] }], completedTotal: 1 } as never
    mockApiFetch.mockImplementation((url: string) => {
      if (url === '/courier/orders/today') return json(todayBody)
      if (url === '/courier/runs/manha/summary') return json(summaryBody({ fuel: { litros: 0.8, custo: 3.99, kmPorLitro: 12, preco: 4.99, combustivel: 'GNV' } }))
      return json({})
    })
    render(<CourierScreen />)
    fireEvent.click(await screen.findByRole('button', { name: /Encerrar rota da manhã/ }))
    const end = await screen.findByRole('dialog', { name: 'Encerrar rota' })
    expect(await within(end).findByText(/12 km\/m³ · GNV R\$ 4,99/)).toBeDefined()
  })

  it('pendências bloqueiam o encerrar: parada sem desfecho e foto obrigatória ("Tirar foto" abre a câmera)', async () => {
    todayBody = { ...withRoute('em_rota'), condos: [], totalStops: 0, completedTotal: 1, completed: [{ condominiumId: 'c1', condominiumName: 'Residencial Jardins', stops: [{ ...stop('66f1a2b3c4d5e6f7a8b9c0d1', '101', 'Maria Souza'), status: 'DELIVERED', completedAt: null, proofStatus: 'PENDING' }] }] } as never
    const pendingBody = {
      stops: [{ key: 'u9|manha', refId: 'o9', condominiumName: 'Edifício Aurora', clientName: 'Ana', apartment: '63', block: null }],
      noPhoto: [{ key: 'u1|manha', refId: '66f1a2b3c4d5e6f7a8b9c0d1', condominiumName: 'Residencial Jardins', clientName: 'Maria Souza', apartment: '101', block: null, outcome: 'DELIVERED' }],
    }
    mockApiFetch.mockImplementation((url: string) => {
      if (url === '/courier/orders/today') return json(todayBody)
      if (url === '/courier/runs/manha/summary') return json(summaryBody({ pending: pendingBody, fuel: null, fuelReason: 'SEM_CONSUMO' }))
      return json({})
    })
    render(<CourierScreen />)
    fireEvent.click(await screen.findByRole('button', { name: /Encerrar rota da manhã/ }))
    const end = await screen.findByRole('dialog', { name: 'Encerrar rota' })
    expect(await within(end).findByText('Resolva antes de encerrar')).toBeDefined()
    expect(within(end).getByText('1 parada sem desfecho')).toBeDefined()
    expect(within(end).getByText('Sem consumo do veículo cadastrado, não calculamos combustível.', { exact: false })).toBeDefined()
    expect((within(end).getByRole('button', { name: /^Encerrar rota$/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(within(end).getByRole('button', { name: 'Tirar foto' }))
    expect(screen.getByTestId('scanner').dataset.mode).toBe('photo')
    expect(screen.getByText('Foto da entrega · Apto 101')).toBeDefined()
  })
})

describe('CourierScreen — Onda 6 (pessoas)', () => {
  it('cabeçalho: avatar + primeiro nome abre o perfil; o "Sair" do topo saiu', async () => {
    render(<CourierScreen />)
    const abrir = await screen.findByRole('button', { name: 'Abrir perfil' })
    await waitFor(() => expect(abrir.textContent).toContain('Antônio'))
    expect(abrir.textContent).not.toContain('Ribeiro')
    expect(screen.queryByRole('button', { name: 'Sair' })).toBeNull()
    fireEvent.click(abrir)
    const perfil = screen.getByRole('dialog', { name: 'Perfil' })
    expect(within(perfil).getByText('312 entregas em 30 dias')).toBeDefined()
    fireEvent.click(within(perfil).getByRole('button', { name: 'Voltar' }))
    expect(screen.queryByRole('dialog', { name: 'Perfil' })).toBeNull()
  })

  it('"Crachá" no topo abre o crachá Ativo com o QR (status e segredo buscados de novo e guardados)', async () => {
    const base = mockApiFetch.getMockImplementation()!
    mockApiFetch.mockImplementation((url: string, opts?: { method?: string }) =>
      url === '/courier/badge-key' ? json({ secret: 'segredo', serverTime: new Date().toISOString() }) : base(url, opts),
    )
    render(<CourierScreen />)
    await screen.findByText('Maria Souza')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir perfil' }).textContent).toContain('Antônio'))
    const before = calls('/courier/me').length
    fireEvent.click(screen.getByRole('button', { name: /Crachá/ }))
    const badge = await screen.findByRole('dialog', { name: 'Crachá digital' })
    expect(within(badge).getByTestId('badge-status').textContent).toBe('Ativo')
    expect(await within(badge).findByRole('button', { name: 'Virar o crachá e ampliar o QR' })).toBeDefined()
    await waitFor(() => expect(calls('/courier/me').length).toBe(before + 1))
    expect(loadBadgeCache('k1')).toMatchObject({ secret: 'segredo', me: { name: 'Antônio Ribeiro' } })
  })

  it('sem sinal: o crachá abre com o que ficou guardado no aparelho (H-11)', async () => {
    saveBadgeCache('k1', { me: meBody({ name: 'Antônio Guardado' }), secret: 'segredo', offsetMs: 0 })
    const base = mockApiFetch.getMockImplementation()!
    mockApiFetch.mockImplementation((url: string, opts?: { method?: string }) =>
      url === '/courier/me' || url === '/courier/badge-key' ? Promise.reject(new TypeError('Failed to fetch')) : base(url, opts),
    )
    render(<CourierScreen />)
    await screen.findByText('Maria Souza')
    fireEvent.click(screen.getByRole('button', { name: /Crachá/ }))
    const badge = await screen.findByRole('dialog', { name: 'Crachá digital' })
    expect(within(badge).getAllByText('Antônio Guardado').length).toBeGreaterThan(0)
    expect(await within(badge).findByRole('button', { name: 'Virar o crachá e ampliar o QR' })).toBeDefined()
  })

  it('perfil → Minha escala → voltar ao perfil', async () => {
    render(<CourierScreen />)
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir perfil' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Perfil' })).getByRole('button', { name: /Minha escala/ }))
    const escala = screen.getByRole('dialog', { name: 'Minha escala' })
    expect(await within(escala).findByText('Esta semana · 28/09–04/10')).toBeDefined()
    fireEvent.click(within(escala).getByRole('button', { name: 'Voltar' }))
    expect(screen.getByRole('dialog', { name: 'Perfil' })).toBeDefined()
  })

  const vazio = () => ({ ...today(), condos: [], totalStops: 0, totalBreads: 0, completedTotal: 0 })

  it('dia de folga sem entregas: "Hoje é sua folga", próximo turno e a escala; sem abas nem dock', async () => {
    todayBody = vazio() as never
    scheduleRes = scheduleOffToday()
    render(<CourierScreen />)
    expect(await screen.findByText('Hoje é sua folga')).toBeDefined()
    expect(screen.getByText('Amanhã · ☀️ Manhã · 06:30')).toBeDefined()
    expect(screen.getByText('ESTA SEMANA')).toBeDefined()
    expect(screen.queryByRole('button', { name: /Escanear cupom/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Lista/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Ver minha escala/ }))
    const escala = screen.getByRole('dialog', { name: 'Minha escala' })
    expect(await within(escala).findByText('Hoje é sua folga 🌿')).toBeDefined()
    fireEvent.click(within(escala).getByRole('button', { name: 'Voltar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('dia de trabalho sem entregas: "Nenhuma entrega hoje"', async () => {
    todayBody = vazio() as never
    render(<CourierScreen />)
    expect(await screen.findByText('Nenhuma entrega hoje')).toBeDefined()
    expect(await screen.findByText('Amanhã · ☀️ Manhã · 06:30')).toBeDefined()
  })
})

describe('CourierScreen — Onda 8 (operação)', () => {
  const withOps = () => {
    const t = today()
    t.rules = { ...t.rules, podeRecados: true }
    ;(t.condos[0] as Record<string, unknown>).access = { portaria: '24 h', temPorteiro: true, portao: 'Interfone 0', parar: null, obs: null, fotoUrl: null }
    t.condos[0].stops = t.condos[0].stops.map((s, i) => ({ ...s, hookToDeliver: i === 0 ? { id: 'h1' } : null, isFirstOrder: false, hasHook: false, messagesOff: false })) as never
    return t
  }
  let online = true
  beforeEach(() => {
    online = true
    todayBody = withOps() as never
    mockApiFetch.mockImplementation((url: string, opts?: { method?: string }) => {
      if (!online && opts?.method) return Promise.reject(new TypeError('Failed to fetch'))
      if (url === '/courier/orders/today') return json(todayBody)
      if (url === '/courier/me') return json(meBody())
      if (url === '/courier/schedule') return json(scheduleBody())
      if (opts?.method === 'PATCH' && url.endsWith('/confirm')) return json({ ...summary, hookToDeliver: { id: 'h1' } })
      if (url === '/courier/messages') return json({ sentAt: '2026-10-02T08:41:00.000Z' })
      if (url === '/courier/hooks/h1/outcome') return json({ status: 'DELIVERED' })
      if (url === '/courier/reports') return json({ id: 'r1', createdAt: '2026-10-02T08:52:00.000Z' }, 201)
      if (url.includes('/access-suggestions')) return json({ id: 's1' }, 201)
      return json({})
    })
  })

  it('prédio aberto: bloco Acesso, recado enviado e sugestão de acesso', async () => {
    render(<CourierScreen />)
    expect(await screen.findByText('24 h · com porteiro')).toBeDefined()
    expect(screen.getByText('+ entregar gancho')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Mandar recado para Maria Souza' }))
    const sheet = screen.getByRole('dialog', { name: 'Mandar recado' })
    fireEvent.click(within(sheet).getByRole('button', { name: /Enviar recado/ }))
    expect(await within(sheet).findByText('Recado enviado às 05:41')).toBeDefined()
    const msg = calls('/courier/messages')[0]
    expect(JSON.parse(msg[1].body)).toMatchObject({ stopKey: '66f1a2b3c4d5e6f7a8b9c0d1', template: 'NA_PORTARIA' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Pronto' }))

    fireEvent.click(screen.getByRole('button', { name: 'Sugerir correção' }))
    const sug = screen.getByRole('dialog', { name: 'Sugerir correção' })
    fireEvent.change(within(sug).getByLabelText('Sugestão'), { target: { value: 'Interfone agora é 9' } })
    fireEvent.click(within(sug).getByRole('button', { name: /Enviar sugestão/ }))
    expect(await within(sug).findByText(/Sugestão enviada/)).toBeDefined()
    expect(JSON.parse(calls('/access-suggestions')[0][1].body)).toEqual({ field: 'PORTAO', text: 'Interfone agora é 9' })
  })

  it('recado sem sinal fica guardado e sai quando o sinal volta', async () => {
    render(<CourierScreen />)
    fireEvent.click(await screen.findByRole('button', { name: 'Mandar recado para Maria Souza' }))
    online = false
    fireEvent.click(screen.getByRole('button', { name: /Enviar recado/ }))
    expect(await screen.findByText('Sem sinal agora. O recado sai assim que o sinal voltar.')).toBeDefined()
    online = true
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    await waitFor(() => expect(calls('/courier/messages').length).toBeGreaterThanOrEqual(2))
  })

  it('scan com gancho na rota: pergunta, responde "Sim" e segue para a foto', async () => {
    render(<CourierScreen />)
    fireEvent.click(await screen.findByRole('button', { name: /Escanear cupom/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'simular leitura' }))
    expect(await screen.findByText('🪝 Deixou o gancho também?')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /^Sim$/ }))
    await waitFor(() => expect(calls('/courier/hooks/h1/outcome')).toHaveLength(1))
    expect(JSON.parse(calls('/courier/hooks/h1/outcome')[0][1].body)).toEqual({ delivered: true })
    expect(await screen.findByText('Foto da entrega · Apto 101')).toBeDefined()
  })

  it('Realizadas: "Reportar problema" manda para a operação e vira "reportado"', async () => {
    todayBody = {
      ...withOps(),
      completedTotal: 1,
      completed: [{ condominiumId: 'c1', condominiumName: 'Residencial Jardins', stops: [{ ...stop('66f1a2b3c4d5e6f7a8b9c0d1', '101', 'Maria Souza'), status: 'DELIVERED', completedAt: '2026-10-02T08:31:00.000Z', proofStatus: 'OK', reported: false }] }],
    } as never
    render(<CourierScreen />)
    await screen.findByText('Maria Souza')
    fireEvent.click(screen.getByRole('button', { name: /Realizadas/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Reportar problema/ }))
    const sheet = screen.getByRole('dialog', { name: 'Reportar problema' })
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Confirmei por engano' }))
    fireEvent.click(within(sheet).getByRole('button', { name: /Enviar para a operação/ }))
    expect(await screen.findByText('reportado')).toBeDefined()
    expect(JSON.parse(calls('/courier/reports')[0][1].body)).toMatchObject({ kind: 'STOP_ISSUE', stopKey: '66f1a2b3c4d5e6f7a8b9c0d1', type: 'CONFIRMEI_POR_ENGANO' })
    expect(screen.queryByRole('button', { name: /Reportar problema/ })).toBeNull()
  })

  it('Perfil → Falar com a operação abre a ocorrência', async () => {
    render(<CourierScreen />)
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir perfil' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Perfil' })).getByRole('button', { name: /Falar com a operação/ }))
    const ops = screen.getByRole('dialog', { name: 'Falar com a operação' })
    fireEvent.click(within(ops).getByRole('radio', { name: /Atraso/ }))
    fireEvent.click(within(ops).getByRole('button', { name: 'Enviar' }))
    expect(await within(ops).findByText(/Ocorrência enviada às 05:52/)).toBeDefined()
    expect(JSON.parse(calls('/courier/reports')[0][1].body)).toMatchObject({ kind: 'INCIDENT', type: 'ATRASO' })
  })
})

describe('CourierScreen — termo do entregador e turnos (plano-termos-legais)', () => {
  const withBase = (extra: (url: string, opts?: { method?: string; body?: string }) => Promise<unknown> | null) => {
    const base = mockApiFetch.getMockImplementation()!
    mockApiFetch.mockImplementation((url: string, opts?: { method?: string; body?: string }) => extra(url, opts) ?? base(url, opts))
  }

  it('termo pendente: bloqueia em tela cheia até aceitar; aceita a versão vigente e libera', async () => {
    withBase((url) => {
      if (url === '/courier/me') return json(meBody({ terms: { version: '1.0', acceptedVersion: null, acceptedAt: null } }))
      if (url === '/courier/terms/accept') return json({ version: '1.0', acceptedAt: '2026-10-05T09:00:00.000Z' })
      return null
    })
    render(<CourierScreen />)
    const gate = await screen.findByRole('dialog', { name: 'Termo do Entregador Parceiro' })
    fireEvent.click(within(gate).getByRole('checkbox', { name: 'Li e aceito o Termo do Entregador Parceiro' }))
    fireEvent.click(within(gate).getByRole('button', { name: /Aceitar e continuar/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Termo do Entregador Parceiro' })).toBeNull())
    const [, opts] = mockApiFetch.mock.calls.find(([u]) => u === '/courier/terms/accept')!
    expect(JSON.parse(opts.body)).toEqual({ version: '1.0' })
    expect(loadBadgeCache('k1')?.me?.terms).toMatchObject({ acceptedVersion: '1.0' })
  })

  it('termo já aceito: sem bloqueio; Perfil › "Termo do entregador" mostra quando aceitou', async () => {
    withBase((url) => (url === '/courier/me' ? json(meBody({ terms: { version: '1.0', acceptedVersion: '1.0', acceptedAt: '2026-10-05T09:00:00.000Z' } })) : null))
    render(<CourierScreen />)
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir perfil' }))
    const perfil = screen.getByRole('dialog', { name: 'Perfil' })
    fireEvent.click(await within(perfil).findByRole('button', { name: /Termo do entregador/ }))
    const termo = screen.getByRole('dialog', { name: 'Termo do entregador' })
    expect(within(termo).getByText('Você aceitou a versão 1.0 em 05/10/2026.')).toBeDefined()
    expect(within(termo).getByText('2. Não há vínculo de emprego')).toBeDefined()
    expect(screen.queryByRole('dialog', { name: 'Termo do Entregador Parceiro' })).toBeNull()
  })

  const offered = { id: '66f1a2b3c4d5e6f7a8b9aaaa', slotId: 'manha', label: 'Manhã', emoji: '☀️', time: '06:30', status: 'OFFERED', stops: 2, offeredAt: '2026-10-02T08:00:00.000Z' }

  it('turno oferecido: Aceitar grava e vira "aceito"', async () => {
    withBase((url) => {
      if (url === '/courier/shifts') return json([offered])
      if (url === `/courier/shifts/${offered.id}/accept`) return json({ id: offered.id, status: 'ACCEPTED' })
      return null
    })
    render(<CourierScreen />)
    const card = await screen.findByRole('group', { name: '☀️ Turno da manhã' })
    fireEvent.click(within(card).getByRole('button', { name: /Aceitar/ }))
    expect(await screen.findByText('☀️ Turno da manhã aceito · 2 paradas')).toBeDefined()
  })

  it('recusar: motivo, aviso de sem penalidade, devolve e some; o app avisa que a operação foi avisada', async () => {
    let shifts: unknown[] = [offered]
    withBase((url, opts) => {
      if (url === '/courier/shifts') return json(shifts)
      if (url === `/courier/shifts/${offered.id}/decline` && opts?.method === 'POST') {
        shifts = []
        return json({ id: offered.id, status: 'DECLINED', released: 2 })
      }
      return null
    })
    render(<CourierScreen />)
    const card = await screen.findByRole('group', { name: '☀️ Turno da manhã' })
    fireEvent.click(within(card).getByRole('button', { name: /Recusar/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Recusar o turno da manhã?' })
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Imprevisto' }))
    fireEvent.click(within(sheet).getByRole('button', { name: /Recusar turno/ }))
    expect(await screen.findByText('Turno recusado. A operação foi avisada.')).toBeDefined()
    expect(screen.queryByRole('group', { name: '☀️ Turno da manhã' })).toBeNull()
    const [, opts] = mockApiFetch.mock.calls.find(([u]) => u === `/courier/shifts/${offered.id}/decline`)!
    expect(JSON.parse(opts.body)).toEqual({ reason: 'IMPREVISTO' })
  })

  // Rota do turno em /courier/orders/today: a trava do cartão olha o estado e as paradas resolvidas.
  const SLOT = { manha: { label: 'Manhã', emoji: '☀️', time: '06:30' }, tarde: { label: 'Tarde', emoji: '🌤️', time: '15:30' } }
  const turnRoute = (state: 'pronta' | 'em_rota', slotId: 'manha' | 'tarde' = 'manha') => ({
    slotId,
    ...SLOT[slotId],
    condominiumIds: ['c1'],
    route: { distanceKm: '9.2', durationMin: 40, geometry: [] },
    state,
    run: state === 'pronta' ? null : { id: '66f1a2b3c4d5e6f7a8b9ffff', startedAt: '2026-10-02T08:12:00.000Z', endedAt: null, startMode: 'BASE' },
    reorderedToday: false,
    eta: [{ condominiumId: 'c1', time: '06:41' }],
  })
  const withRoutes = (...routes: ReturnType<typeof turnRoute>[]) => ({ ...today(), routes, base: { endereco: 'Rua das Flores, 120', lat: -23.4, lng: -46.5 }, routeCondos: [] })
  const accepted = { ...offered, status: 'ACCEPTED' }
  /** Deixa as respostas já servidas (turnos, fila) chegarem à tela antes de olhar o que NÃO aparece. */
  const settle = () => act(() => new Promise((r) => setTimeout(r, 0)))

  it('com a rota do turno iniciada, o cartão do turno some (não dá mais para recusar)', async () => {
    todayBody = withRoutes(turnRoute('em_rota')) as never
    withBase((url) => (url === '/courier/shifts' ? json([accepted]) : null))
    render(<CourierScreen />)
    expect(await screen.findByText(/Em rota desde/)).toBeDefined()
    await waitFor(() => expect(calls('/courier/shifts').length).toBeGreaterThan(0))
    await settle()
    expect(screen.queryByText(/Turno da manhã aceito/)).toBeNull()
  })

  it('rota pronta com parada do turno já concluída no servidor: o cartão daquele turno some; o da tarde fica', async () => {
    const tardeStop = { ...stop('66f1a2b3c4d5e6f7a8b9dddd', '301', 'Rita Dias'), slotId: 'tarde', slotLabel: 'Tarde' }
    todayBody = {
      ...withRoutes(turnRoute('pronta'), turnRoute('pronta', 'tarde')),
      condos: [{ ...today().condos[0], stops: [...today().condos[0].stops, tardeStop] }],
      totalStops: 3,
      slots: [{ slotId: 'manha', ...SLOT.manha }, { slotId: 'tarde', ...SLOT.tarde }],
      completed: [{ condominiumId: 'c1', condominiumName: 'Residencial Jardins', stops: [{ ...stop('66f1a2b3c4d5e6f7a8b9cccc', '103', 'Ana Lima'), status: 'DELIVERED', completedAt: null, proofStatus: 'OK' }] }],
      completedTotal: 1,
    } as never
    const tarde = { ...accepted, id: '66f1a2b3c4d5e6f7a8b9eeee', slotId: 'tarde', ...SLOT.tarde, stops: 1 }
    withBase((url) => (url === '/courier/shifts' ? json([accepted, tarde]) : null))
    render(<CourierScreen />)
    expect(await screen.findByText('🌤️ Turno da tarde aceito · 1 parada')).toBeDefined()
    expect(screen.queryByText(/Turno da manhã aceito/)).toBeNull()
  })

  it('rota pronta: confirmar a 1ª parada pela lista tira o cartão na hora, sem recarregar a rota', async () => {
    todayBody = withRoutes(turnRoute('pronta')) as never
    withBase((url) => (url === '/courier/shifts' ? json([accepted]) : null))
    render(<CourierScreen />)
    const card = await screen.findByText('☀️ Turno da manhã aceito · 2 paradas')
    expect(within(card.parentElement!).getByRole('button', { name: 'Recusar' })).toBeDefined()
    const loads = calls('/courier/orders/today').length
    fireEvent.click(screen.getByText('Maria Souza'))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Confirmar entrega/ }))
    await screen.findByRole('alertdialog', { name: 'Entrega confirmada' })
    expect(screen.queryByText(/Turno da manhã aceito/)).toBeNull()
    expect(calls('/courier/orders/today')).toHaveLength(loads)
  })

  it('entrega guardada sem sinal também trava: o cartão some e continua sumido ao abrir o app de novo', async () => {
    // Leitura com sinal, escrita sem: a confirmação fica na fila e o servidor ainda vê a rota "pronta".
    let writesOnline = true
    todayBody = withRoutes(turnRoute('pronta')) as never
    withBase((url, opts) => {
      if (!writesOnline && opts?.method && opts.method !== 'GET') return Promise.reject(new TypeError('Failed to fetch'))
      return url === '/courier/shifts' ? json([accepted]) : null
    })
    const first = render(<CourierScreen />)
    await screen.findByText('☀️ Turno da manhã aceito · 2 paradas')
    writesOnline = false
    fireEvent.click(screen.getByText('Maria Souza'))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Confirmar entrega/ }))
    await screen.findByRole('alertdialog', { name: 'Confirmada · sem sinal' })
    expect(screen.queryByText(/Turno da manhã aceito/)).toBeNull()
    first.unmount()

    const shiftLoads = calls('/courier/shifts').length
    render(<CourierScreen />)
    expect(await screen.findByText(/1 entrega guardada/)).toBeDefined()
    await waitFor(() => expect(calls('/courier/shifts').length).toBeGreaterThan(shiftLoads))
    await settle()
    expect(screen.queryByText(/Turno da manhã aceito/)).toBeNull()
  })

  it('recusa barrada pelo servidor (409): o sheet fecha, avisa, o cartão sai e a tela atualiza', async () => {
    withBase((url, opts) => {
      if (url === '/courier/shifts') return json([offered])
      if (url === `/courier/shifts/${offered.id}/decline` && opts?.method === 'POST') {
        // Entregou em outro aparelho: no servidor a rota já começou.
        todayBody = withRoutes(turnRoute('em_rota')) as never
        return json({ error: 'A rota já começou. Para sair dela, fale com a operação.', code: 'STARTED' }, 409)
      }
      return null
    })
    render(<CourierScreen />)
    const card = await screen.findByRole('group', { name: '☀️ Turno da manhã' })
    fireEvent.click(within(card).getByRole('button', { name: /Recusar/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Recusar o turno da manhã?' })
    const loads = calls('/courier/orders/today').length
    fireEvent.click(within(sheet).getByRole('button', { name: /Recusar turno/ }))
    expect(await screen.findByText('A rota já começou. Para sair dela, fale com a operação.')).toBeDefined()
    expect(screen.queryByRole('dialog', { name: 'Recusar o turno da manhã?' })).toBeNull()
    expect(screen.queryByRole('group', { name: '☀️ Turno da manhã' })).toBeNull()
    await waitFor(() => expect(calls('/courier/orders/today').length).toBeGreaterThan(loads))
    expect(await screen.findByText(/Em rota desde/)).toBeDefined()
    expect(screen.queryByRole('group', { name: '☀️ Turno da manhã' })).toBeNull()
  })
})

