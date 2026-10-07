// Leitor de QR: nativo quando existe (Chrome/Android); polyfill com o .wasm DO APP quando não
// existe (iPhone) — era por isso que o scanner não funcionava no iPhone.
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

const prepareZXingModule = vi.hoisted(() => vi.fn().mockResolvedValue({}))
const polyDetect = vi.hoisted(() => vi.fn().mockResolvedValue([{ rawValue: 'poly-qr' }]))
vi.mock('barcode-detector/ponyfill', () => ({
  prepareZXingModule,
  BarcodeDetector: vi.fn().mockImplementation(function () {
    return { detect: polyDetect }
  }),
}))

import { getQrDetector, hasNativeQrDetector, warmUpQrDetector, __resetQrDetectorForTests } from '../qrDetector'

const win = window as unknown as { BarcodeDetector?: unknown }

describe('qrDetector', () => {
  beforeEach(() => {
    __resetQrDetectorForTests()
    prepareZXingModule.mockClear()
    delete win.BarcodeDetector
  })
  afterEach(() => {
    delete win.BarcodeDetector
  })

  it('usa o BarcodeDetector nativo quando ele lê QR', async () => {
    const nativeDetect = vi.fn().mockResolvedValue([{ rawValue: 'native-qr' }])
    win.BarcodeDetector = Object.assign(
      vi.fn().mockImplementation(function () {
        return { detect: nativeDetect }
      }),
      { getSupportedFormats: vi.fn().mockResolvedValue(['qr_code']) },
    )
    expect(hasNativeQrDetector()).toBe(true)
    const d = await getQrDetector()
    expect(await d.detect(document.createElement('canvas'))).toBe('native-qr')
    expect(prepareZXingModule).not.toHaveBeenCalled()
  })

  it('sem nativo (iPhone): polyfill com o .wasm servido pelo app, nunca pelo CDN', async () => {
    expect(hasNativeQrDetector()).toBe(false)
    const d = await getQrDetector()
    expect(await d.detect(document.createElement('canvas'))).toBe('poly-qr')
    const { overrides } = prepareZXingModule.mock.calls[0][0]
    const url = overrides.locateFile('zxing_reader.wasm', 'https://fastly.jsdelivr.net/x/')
    expect(url).not.toContain('jsdelivr')
    expect(url).toMatch(/zxing_reader.*\.wasm/)
  })

  it('nativo sem suporte a QR cai no polyfill', async () => {
    win.BarcodeDetector = Object.assign(vi.fn(), { getSupportedFormats: vi.fn().mockResolvedValue(['ean_13']) })
    const d = await getQrDetector()
    expect(await d.detect(document.createElement('canvas'))).toBe('poly-qr')
  })

  it('quadro ruim não lança: devolve null', async () => {
    polyDetect.mockRejectedValueOnce(new Error('frame'))
    const d = await getQrDetector()
    expect(await d.detect(document.createElement('canvas'))).toBeNull()
  })

  it('aquecimento só baixa o leitor quando não há nativo', async () => {
    win.BarcodeDetector = Object.assign(vi.fn(), { getSupportedFormats: vi.fn().mockResolvedValue(['qr_code']) })
    warmUpQrDetector()
    await new Promise((r) => setTimeout(r, 0))
    expect(prepareZXingModule).not.toHaveBeenCalled()
  })
})
