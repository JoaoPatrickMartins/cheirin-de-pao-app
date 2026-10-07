// URL do .wasm do leitor servido pelo PRÓPRIO app (asset com hash no build). O polyfill, por
// padrão, buscaria o arquivo num CDN — o que falharia no PWA sem sinal e quebraria a CSP.
import zxingReaderWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

/**
 * Leitor de QR do cupom (E2 do plano do entregador · T-2).
 *
 * Chrome/Android tem `BarcodeDetector` nativo. O Safari (e todo navegador no iPhone, que usa o
 * mesmo motor) NÃO tem — era por isso que o scanner não funcionava no iPhone. Sem o nativo, o
 * app carrega SOB DEMANDA o polyfill `barcode-detector` (zxing-cpp em WebAssembly, ~1,1 MB).
 *
 * O .wasm fica FORA do precache do PWA de propósito, como o `exceljs`: precachear faria todo
 * cliente baixar 1 MB que só o entregador de iPhone usa. Em troca, a tela do entregador chama
 * `warmUpQrDetector()` ao abrir — o arquivo é baixado e compilado enquanto há sinal, e fica no
 * cache HTTP para a porta do prédio.
 */

export interface QrDetector {
  /** Primeiro QR encontrado na imagem, ou null. Nunca lança (quadro ruim = null). */
  detect(source: HTMLCanvasElement | HTMLVideoElement | ImageBitmap): Promise<string | null>
}

type NativeBarcodeDetector = {
  detect(source: unknown): Promise<Array<{ rawValue?: string }>>
}
type NativeBarcodeDetectorCtor = {
  new (opts: { formats: string[] }): NativeBarcodeDetector
  getSupportedFormats?: () => Promise<string[]>
}

let detectorPromise: Promise<QrDetector> | null = null

function nativeCtor(): NativeBarcodeDetectorCtor | null {
  if (typeof window === 'undefined') return null
  return ((window as unknown as { BarcodeDetector?: NativeBarcodeDetectorCtor }).BarcodeDetector ?? null)
}

async function createNative(): Promise<QrDetector | null> {
  const Ctor = nativeCtor()
  if (!Ctor) return null
  try {
    // Alguns Chromes de desktop expõem a API sem suporte a QR.
    const formats = await Ctor.getSupportedFormats?.()
    if (formats && !formats.includes('qr_code')) return null
  } catch {
    return null
  }
  const native = new Ctor({ formats: ['qr_code'] })
  return {
    async detect(source) {
      try {
        const found = await native.detect(source)
        return found[0]?.rawValue || null
      } catch {
        return null
      }
    },
  }
}

async function createPolyfill(): Promise<QrDetector> {
  const mod = await import('barcode-detector/ponyfill')
  mod.prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? zxingReaderWasmUrl : prefix + path),
    },
  })
  const polyfill = new mod.BarcodeDetector({ formats: ['qr_code'] })
  return {
    async detect(source) {
      try {
        const found = await polyfill.detect(source)
        return found[0]?.rawValue || null
      } catch {
        return null
      }
    },
  }
}

/** Detector do aparelho: nativo quando existe, polyfill quando não. Criado uma vez só. */
export function getQrDetector(): Promise<QrDetector> {
  if (!detectorPromise) {
    detectorPromise = createNative().then((native) => native ?? createPolyfill())
    // Falha ao carregar (sem sinal no 1º uso) não pode travar as próximas tentativas.
    detectorPromise.catch(() => {
      detectorPromise = null
    })
  }
  return detectorPromise
}

/** O aparelho lê QR sem baixar nada? */
export function hasNativeQrDetector(): boolean {
  return nativeCtor() !== null
}

/**
 * Pré-carrega o leitor enquanto há sinal (chamado ao abrir a tela do entregador). No aparelho com
 * leitor nativo não faz nada. Nunca lança.
 */
export function warmUpQrDetector(): void {
  if (hasNativeQrDetector()) return
  getQrDetector()
    .then(async () => {
      const mod = await import('barcode-detector/ponyfill')
      await mod.prepareZXingModule({ fireImmediately: true })
    })
    .catch(() => {})
}

/** Só para testes: esquece o detector criado. */
export function __resetQrDetectorForTests(): void {
  detectorPromise = null
}
