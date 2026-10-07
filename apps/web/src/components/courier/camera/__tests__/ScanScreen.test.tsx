// E2 — permissão pedida/bloqueada/indisponível e o laço de leitura sobre a câmera.
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

const detect = vi.hoisted(() => vi.fn())
vi.mock('../../../../lib/qrDetector', () => ({ getQrDetector: () => Promise.resolve({ detect }) }))
// Compressão da foto da câmera nativa: no teste, devolve o próprio arquivo.
vi.mock('browser-image-compression', () => ({ default: (f: File) => Promise.resolve(f) }))

import { ScanScreen } from '../ScanScreen'

const stopTrack = vi.fn()
function mockCamera(permission: PermissionState | 'throws', getUserMedia?: () => Promise<unknown>) {
  const stream = { getTracks: () => [{ stop: stopTrack }], getVideoTracks: () => [{ stop: stopTrack, getCapabilities: () => ({ torch: true }), applyConstraints: vi.fn().mockResolvedValue(undefined) }] }
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(getUserMedia ?? (() => Promise.resolve(stream))) },
  })
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query: permission === 'throws' ? vi.fn().mockRejectedValue(new Error('x')) : vi.fn().mockResolvedValue({ state: permission }) },
  })
}

beforeEach(() => {
  detect.mockReset()
  stopTrack.mockReset()
  // jsdom não tem vídeo nem canvas de verdade.
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: vi.fn().mockResolvedValue(undefined) })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: vi.fn() })
  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { configurable: true, get: () => 4 })
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 1280 })
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 720 })
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: () => ({ drawImage: vi.fn() }) })
  Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
    configurable: true,
    value: (cb: (b: Blob | null) => void, type?: string) => cb(new Blob(['jpeg'], { type })),
  })
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:preview') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
})
afterEach(() => vi.useRealTimers())

const props = { onDetect: vi.fn(), onClose: vi.fn(), onTypeCode: vi.fn() }

describe('ScanScreen', () => {
  it('sem resposta de permissão: explica e só liga a câmera no toque', async () => {
    mockCamera('prompt')
    render(<ScanScreen {...props} />)
    const allow = await screen.findByRole('button', { name: 'Permitir câmera' })
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled()
    fireEvent.click(allow)
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled())
    expect(await screen.findByText('Aponte para o QR do cupom')).toBeDefined()
  })

  it('bloqueada: passos para liberar + "Tentar de novo" e "Digitar código"', async () => {
    mockCamera('denied')
    render(<ScanScreen {...props} />)
    expect(await screen.findByText('A câmera está bloqueada')).toBeDefined()
    expect(screen.getByText('Ligue a Câmera e volte aqui')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Digitar código' }))
    expect(props.onTypeCode).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeDefined()
  })

  it('getUserMedia recusado vira "bloqueada"; outro erro vira "indisponível"', async () => {
    mockCamera('granted', () => Promise.reject(Object.assign(new Error('no'), { name: 'NotReadableError' })))
    render(<ScanScreen {...props} />)
    expect(await screen.findByText('Câmera indisponível')).toBeDefined()
  })

  it('liberada: lê o QR, congela, chama onDetect uma vez e desliga a câmera ao fechar', async () => {
    mockCamera('granted')
    detect.mockResolvedValueOnce(null).mockResolvedValue('66f1a2b3c4d5e6f7a8b9c0d1')
    const onDetect = vi.fn()
    const { unmount } = render(<ScanScreen {...props} onDetect={onDetect} counter="7/12" />)
    expect(await screen.findByLabelText('Progresso da rota: 7/12')).toBeDefined()
    await waitFor(() => expect(onDetect).toHaveBeenCalledWith('66f1a2b3c4d5e6f7a8b9c0d1'), { timeout: 2000 })
    expect(await screen.findByText('Lido · bip!')).toBeDefined()
    await act(() => new Promise((r) => setTimeout(r, 600)))
    expect(onDetect).toHaveBeenCalledTimes(1) // congelado: não lê de novo sozinho
    unmount()
    expect(stopTrack).toHaveBeenCalled()
  })

  it('volta a ler depois que o pop-up abre e fecha (pausa liga e desliga)', async () => {
    mockCamera('granted')
    detect.mockResolvedValue('66f1a2b3c4d5e6f7a8b9c0d1')
    const onDetect = vi.fn()
    const { rerender } = render(<ScanScreen {...props} onDetect={onDetect} />)
    await waitFor(() => expect(onDetect).toHaveBeenCalledTimes(1), { timeout: 2000 })
    rerender(<ScanScreen {...props} onDetect={onDetect} paused />)
    rerender(<ScanScreen {...props} onDetect={onDetect} paused={false} />)
    await waitFor(() => expect(onDetect).toHaveBeenCalledTimes(2), { timeout: 2000 })
  })

  it('lanterna aparece quando o aparelho suporta', async () => {
    mockCamera('granted')
    detect.mockResolvedValue(null)
    render(<ScanScreen {...props} />)
    const torch = await screen.findByRole('button', { name: 'Ligar lanterna' })
    fireEvent.click(torch)
    expect(await screen.findByText('Lanterna ligada')).toBeDefined()
  })
})

describe('ScanScreen — modo foto (E5)', () => {
  const photo = (over: Partial<{ required: boolean }> = {}) => ({
    caption: 'Foto da entrega · Apto 101',
    hint: 'Mostre o saquinho na porta ou no gancho',
    required: true,
    onCapture: vi.fn(),
    onSkip: vi.fn(),
    onCantShoot: vi.fn(),
    ...over,
  })

  it('obrigatória: tira, mostra a prévia e só envia no "Usar foto"; sem "Pular"', async () => {
    mockCamera('granted')
    const p = photo()
    render(<ScanScreen {...props} mode="photo" photo={p} />)
    expect(await screen.findByText('Foto da entrega · Apto 101')).toBeDefined()
    expect(screen.getByRole('dialog', { name: 'Foto do comprovante' })).toBeDefined()
    expect(screen.queryByRole('button', { name: /Pular/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Tirar foto' }))
    expect(await screen.findByText('Ficou boa?')).toBeDefined()
    expect(p.onCapture).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Usar foto/ }))
    expect(p.onCapture).toHaveBeenCalledTimes(1)
    expect((p.onCapture.mock.calls[0][0] as Blob).type).toBe('image/jpeg')
    fireEvent.click(screen.getByRole('button', { name: /Não consigo tirar a foto/ }))
    expect(p.onCantShoot).toHaveBeenCalled()
  })

  it('"Tirar outra" descarta a prévia', async () => {
    mockCamera('granted')
    render(<ScanScreen {...props} mode="photo" photo={photo()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Tirar foto' }))
    fireEvent.click(await screen.findByRole('button', { name: /Tirar outra/ }))
    expect(await screen.findByRole('button', { name: 'Tirar foto' })).toBeDefined()
  })

  it('opcional: "Pular" segue sem foto', async () => {
    mockCamera('granted')
    const p = photo({ required: false })
    render(<ScanScreen {...props} mode="photo" photo={p} />)
    fireEvent.click(await screen.findByRole('button', { name: /Pular/ }))
    expect(p.onSkip).toHaveBeenCalled()
    expect(screen.getByText('A foto é opcional para você')).toBeDefined()
  })

  it('não lê QR no modo foto', async () => {
    mockCamera('granted')
    detect.mockResolvedValue('66f1a2b3c4d5e6f7a8b9c0d1')
    const onDetect = vi.fn()
    render(<ScanScreen {...props} onDetect={onDetect} mode="photo" photo={photo()} />)
    await screen.findByRole('button', { name: 'Tirar foto' })
    await act(() => new Promise((r) => setTimeout(r, 600)))
    expect(onDetect).not.toHaveBeenCalled()
  })

  it('câmera bloqueada: plano B com a câmera nativa do celular', async () => {
    mockCamera('denied')
    const p = photo()
    render(<ScanScreen {...props} mode="photo" photo={p} />)
    expect(await screen.findByRole('button', { name: /Usar a câmera do celular/ })).toBeDefined()
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText('Abrir a câmera do celular'), { target: { files: [file] } })
    await waitFor(() => expect(p.onCapture).toHaveBeenCalledWith(file))
  })
})
