import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../../brand/Icon'
import { CRBig, CRIconBtn, CR_BODY, CR_DISPLAY } from '../kit'
import { getQrDetector } from '../../../lib/qrDetector'

/**
 * E2 · Scanner (câmera contínua do handoff). Tela cheia, contador da rota, lanterna (se o aparelho
 * suportar) e "Digitar código" sempre à mão.
 *
 * Um ÚNICO MediaStream vive enquanto a tela está aberta: entre um cupom e outro só a detecção
 * pausa (`paused`). Reabrir a câmera a cada leitura piorava o que já é ruim no PWA do iPhone,
 * que pode pedir a permissão de novo a cada abertura (R-4).
 *
 * A leitura é feita no RECORTE da moldura (canvas), não no quadro inteiro — mais rápido e com
 * menos leitura errada de outro cupom no canto da imagem.
 *
 * E5 · Foto da entrega: a MESMA câmera, em `mode="photo"` — escanear → confirmado → foto →
 * próximo, sem fechar e reabrir o stream. O quadro é capturado do vídeo num canvas (~1280 px,
 * JPEG). Sem câmera no app, cai na câmera nativa do celular (`<input capture>`).
 */

type Phase = 'checking' | 'perm' | 'denied' | 'unavailable' | 'reading' | 'read'

export interface ScanScreenProps {
  /** "7/12" — progresso da rota no topo. */
  counter?: string
  /** QR lido. A tela congela o quadro e espera `paused` voltar a false para ler o próximo. */
  onDetect: (text: string) => void
  onClose: () => void
  onTypeCode: () => void
  /** Pausa a detecção (pop-up de resultado aberto) sem fechar a câmera. */
  paused?: boolean
  /** Pop-up/sheet sobre a câmera. */
  overlay?: ReactNode
  /** `scan` (padrão) lê QR; `photo` tira a foto do comprovante. */
  mode?: 'scan' | 'photo'
  /** Obrigatório no modo foto. */
  photo?: PhotoModeProps
}

export interface PhotoModeProps {
  /** "Foto da entrega · Apto 101 · Bloco 2" */
  caption: string
  /** "Mostre o saquinho na porta ou no gancho" */
  hint: string
  /** Obrigatória: sem "Pular", só a exceção "Não consigo tirar a foto". */
  required: boolean
  onCapture: (photo: Blob) => void
  /** Opcional: pular a foto. */
  onSkip: () => void
  /** Obrigatória: seguir sem foto (abre os motivos). */
  onCantShoot: () => void
}

/** Lado maior da foto do comprovante — o bastante para ver a porta, leve para o 4G do prédio. */
const PHOTO_MAX_SIDE = 1280
const PHOTO_QUALITY = 0.82

/** Captura o quadro atual do vídeo como JPEG reduzido. */
function captureFrame(video: HTMLVideoElement): Promise<Blob | null> {
  const w = video.videoWidth
  const h = video.videoHeight
  if (!w || !h) return Promise.resolve(null)
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const g = canvas.getContext('2d')
  if (!g) return Promise.resolve(null)
  g.drawImage(video, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', PHOTO_QUALITY))
}

/** Foto da câmera nativa (plano B): reduz antes de subir — a do celular passa fácil de 4 MB. */
async function compressFile(file: File): Promise<Blob> {
  try {
    const { default: imageCompression } = await import('browser-image-compression')
    return await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: PHOTO_MAX_SIDE, fileType: 'image/jpeg', useWebWorker: true })
  } catch {
    return file
  }
}

const SCAN_INTERVAL_MS = 250
const FRAME = 240

export function ScanScreen({ counter, onDetect, onClose, onTypeCode, paused = false, overlay, mode = 'scan', photo }: ScanScreenProps) {
  const photoMode = mode === 'photo' && !!photo
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const onDetectRef = useRef(onDetect)
  onDetectRef.current = onDetect
  const [phase, setPhase] = useState<Phase>('checking')
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  // Depois de uma leitura, só volta a ler quando o pai PAUSOU e depois soltou (pop-up abriu e
  // fechou). Sem isso, um pai que demora a pausar fazia o mesmo cupom ser lido duas vezes.
  const pauseSeenRef = useRef(false)
  // Prévia da foto ("Ficou boa?") antes de usar.
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null)
  const [shooting, setShooting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // A prévia é descartada ao sair do modo foto (e a URL do objeto liberada).
  useEffect(() => {
    if (!photoMode) setPreview(null)
  }, [photoMode])
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url)
  }, [preview])

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('unavailable')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      const track = stream.getVideoTracks()[0]
      const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean }
      setTorchAvailable(!!caps.torch)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setPhase('reading')
    } catch (err) {
      const name = (err as { name?: string })?.name
      setPhase(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable')
    }
  }, [])

  // Ao abrir: já liberada → liga direto; bloqueada → explica; sem resposta → pede (o toque em
  // "Permitir câmera" é o gesto que o iPhone exige).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPhase('unavailable')
        return
      }
      let state: PermissionState | null = null
      try {
        state = (await navigator.permissions?.query({ name: 'camera' as PermissionName }))?.state ?? null
      } catch {
        state = null
      }
      if (cancelled) return
      if (state === 'granted') void start()
      else if (state === 'denied') setPhase('denied')
      else setPhase('perm')
    })()
    return () => {
      cancelled = true
      stopStream()
    }
  }, [start, stopStream])

  // Volta a ler quando o pop-up fecha (paused: true → false).
  useEffect(() => {
    // Modo foto precisa do vídeo vivo (o quadro estava congelado na leitura do cupom).
    if (photoMode && phase === 'read' && !paused) {
      pauseSeenRef.current = false
      void videoRef.current?.play().catch(() => {})
      setPhase('reading')
      return
    }
    if (paused) {
      pauseSeenRef.current = true
      return
    }
    if (phase === 'read' && pauseSeenRef.current) {
      pauseSeenRef.current = false
      void videoRef.current?.play().catch(() => {})
      setPhase('reading')
    }
  }, [paused, phase, photoMode])

  // Laço de detecção sobre o recorte da moldura (não roda no modo foto).
  useEffect(() => {
    if (phase !== 'reading' || paused || photoMode) return
    let stopped = false
    let busy = false
    const timer = setInterval(async () => {
      const video = videoRef.current
      if (stopped || busy || !video || video.readyState < 2 || !video.videoWidth) return
      busy = true
      try {
        const detector = await getQrDetector()
        const side = Math.floor(Math.min(video.videoWidth, video.videoHeight) * 0.7)
        const canvas = canvasRef.current ?? (canvasRef.current = document.createElement('canvas'))
        canvas.width = side
        canvas.height = side
        const g = canvas.getContext('2d', { willReadFrequently: true })
        if (!g) return
        g.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, side, side)
        const text = await detector.detect(canvas)
        if (text && !stopped) {
          stopped = true
          pauseSeenRef.current = false
          video.pause()
          setPhase('read')
          onDetectRef.current(text)
        }
      } catch {
        // leitor indisponível (sem sinal no 1º uso): segue tentando; "Digitar código" está à mão
      } finally {
        busy = false
      }
    }, SCAN_INTERVAL_MS)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [phase, paused, photoMode])

  const shoot = async () => {
    const video = videoRef.current
    if (!video || shooting) return
    setShooting(true)
    const blob = await captureFrame(video)
    setShooting(false)
    if (blob) setPreview({ blob, url: URL.createObjectURL(blob) })
  }

  const usePhoto = () => {
    if (!preview || !photo) return
    const blob = preview.blob
    setPreview(null)
    photo.onCapture(blob)
  }

  const onNativeFile = async (file: File | undefined) => {
    if (!file || !photo) return
    photo.onCapture(await compressFile(file))
  }

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const next = !torchOn
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      setTorchOn(next)
    } catch {
      setTorchAvailable(false)
    }
  }

  const read = phase === 'read'
  const showVideo = phase === 'reading' || phase === 'read'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photoMode ? 'Foto do comprovante' : 'Escanear cupom'}
      style={{ position: 'fixed', inset: 0, zIndex: 120, background: '#070402', color: '#fff', overflow: 'hidden', fontFamily: CR_BODY }}
    >
      {/* Vídeo sempre montado (o srcObject precisa do elemento); visível só lendo. */}
      <video
        ref={videoRef}
        playsInline
        muted
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: showVideo ? 1 : 0 }}
      />

      {/* Topo: fechar · título · contador */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(10px + env(safe-area-inset-top, 0px))',
          left: 0,
          right: 0,
          zIndex: 5,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 16px',
        }}
      >
        <CRIconBtn icon="x" tone="dark" onClick={onClose} label="Fechar" />
        <div style={{ flex: 1, textAlign: 'center', fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>
          {photoMode ? (preview ? 'Ficou boa?' : 'Foto') : 'Escanear cupom'}
        </div>
        {counter && !photoMode ? (
          <span
            aria-label={`Progresso da rota: ${counter}`}
            style={{
              minWidth: 44,
              height: 44,
              padding: '0 10px',
              borderRadius: 14,
              background: 'rgba(255,255,255,0.14)',
              display: 'grid',
              placeItems: 'center',
              fontFamily: CR_DISPLAY,
              fontWeight: 800,
              fontSize: 15,
            }}
          >
            {counter}
          </span>
        ) : (
          <span style={{ width: 44 }} />
        )}
      </div>

      {(phase === 'perm' || phase === 'denied' || phase === 'unavailable') && (
        <ScanBlocked
          phase={phase}
          onAllow={() => void start()}
          onRetry={() => void start()}
          onTypeCode={onTypeCode}
          photo={photoMode ? { required: photo!.required, onNative: () => fileInputRef.current?.click(), onSkip: photo!.onSkip, onCantShoot: photo!.onCantShoot } : undefined}
        />
      )}

      {/* Plano B da foto: a câmera nativa do celular (abre direto na traseira). */}
      {photoMode && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Abrir a câmera do celular"
          style={{ display: 'none' }}
          onChange={(e) => void onNativeFile(e.target.files?.[0])}
        />
      )}

      {showVideo && photoMode && photo && (
        <PhotoControls
          caption={photo.caption}
          hint={photo.hint}
          required={photo.required}
          preview={preview?.url ?? null}
          shooting={shooting}
          torchAvailable={torchAvailable}
          torchOn={torchOn}
          onToggleTorch={() => void toggleTorch()}
          onShoot={() => void shoot()}
          onRetake={() => setPreview(null)}
          onUse={usePhoto}
          onSkip={photo.onSkip}
          onCantShoot={photo.onCantShoot}
        />
      )}

      {showVideo && !photoMode && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 22,
              paddingBottom: 40,
              pointerEvents: 'none',
            }}
          >
            <ScanFrame color={read ? '#7FC893' : '#fff'} dimmed>
              {!read && (
                <div
                  className="cdp-scanline"
                  style={{ position: 'absolute', left: 14, right: 14, height: 3, borderRadius: 3, background: 'var(--color-gold)', boxShadow: '0 0 12px var(--color-gold)' }}
                />
              )}
              {read && (
                <div style={{ position: 'absolute', inset: 0, borderRadius: 18, background: 'rgba(62,124,83,0.28)', display: 'grid', placeItems: 'center' }}>
                  <span style={{ width: 72, height: 72, borderRadius: 99, background: 'var(--color-good)', display: 'grid', placeItems: 'center', boxShadow: '0 0 0 10px rgba(62,124,83,0.35)' }}>
                    <Icon name="check" size={40} color="#fff" stroke={3.2} aria-hidden="true" />
                  </span>
                </div>
              )}
            </ScanFrame>
            <div role="status" style={{ padding: '9px 16px', borderRadius: 99, background: 'rgba(0,0,0,0.5)', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              {read ? (
                <>
                  <Icon name="check" size={17} color="#7FC893" stroke={2.8} aria-hidden="true" />
                  Lido · bip!
                </>
              ) : (
                'Aponte para o QR do cupom'
              )}
            </div>
          </div>

          {torchOn && (
            <div style={{ position: 'absolute', top: 'calc(64px + env(safe-area-inset-top, 0px))', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 5 }}>
              <span style={{ padding: '8px 14px', borderRadius: 99, background: 'var(--color-gold)', color: 'var(--color-espresso)', fontWeight: 800, fontSize: 13.5, display: 'flex', gap: 6, alignItems: 'center' }}>
                <Icon name="flash" size={15} stroke={2.4} aria-hidden="true" />
                Lanterna ligada
              </span>
            </div>
          )}

          {!read && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 5,
                padding: '0 20px calc(30px + env(safe-area-inset-bottom, 0px))',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              {torchAvailable && (
                <button
                  type="button"
                  onClick={() => void toggleTorch()}
                  aria-label={torchOn ? 'Desligar lanterna' : 'Ligar lanterna'}
                  aria-pressed={torchOn}
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: 99,
                    border: 'none',
                    background: torchOn ? 'var(--color-gold)' : 'rgba(255,255,255,0.16)',
                    color: torchOn ? 'var(--color-espresso)' : '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="flash" size={26} stroke={2.1} aria-hidden="true" />
                </button>
              )}
              <CRBig variant="light" icon="keyboard" h={62} onClick={onTypeCode} style={{ flex: 1 }}>
                Digitar código
              </CRBig>
            </div>
          )}
        </>
      )}

      {overlay}
    </div>
  )
}

/** Controles do modo foto (E5): legenda fixa, área-guia, disparo, lanterna, Pular / exceção, prévia. */
function PhotoControls({
  caption,
  hint,
  required,
  preview,
  shooting,
  torchAvailable,
  torchOn,
  onToggleTorch,
  onShoot,
  onRetake,
  onUse,
  onSkip,
  onCantShoot,
}: {
  caption: string
  hint: string
  required: boolean
  preview: string | null
  shooting: boolean
  torchAvailable: boolean
  torchOn: boolean
  onToggleTorch: () => void
  onShoot: () => void
  onRetake: () => void
  onUse: () => void
  onSkip: () => void
  onCantShoot: () => void
}) {
  return (
    <>
      {preview && (
        <img src={preview} alt="Prévia da foto da entrega" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 2 }} />
      )}
      <div style={{ position: 'absolute', top: 'calc(66px + env(safe-area-inset-top, 0px))', left: 16, right: 16, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ padding: '10px 16px', borderRadius: 14, background: 'rgba(0,0,0,0.6)', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8, textAlign: 'center' }}>
          <Icon name="camera" size={18} color="var(--color-gold)" aria-hidden="true" />
          {caption}
        </div>
        {!preview && <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: 600, textAlign: 'center' }}>{hint}</div>}
      </div>
      {!preview && (
        <div
          aria-hidden="true"
          style={{ position: 'absolute', inset: 'calc(170px + env(safe-area-inset-top, 0px)) 36px calc(210px + env(safe-area-inset-bottom, 0px))', border: '2px dashed rgba(255,255,255,0.28)', borderRadius: 22, zIndex: 3 }}
        />
      )}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 5, padding: '0 20px calc(28px + env(safe-area-inset-bottom, 0px))' }}>
        {preview ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <CRBig variant="light" icon="refresh" onClick={onRetake} style={{ flex: 1 }}>Tirar outra</CRBig>
            <CRBig variant="gold" icon="check" onClick={onUse} style={{ flex: 1.3 }}>Usar foto</CRBig>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', height: 92 }}>
              {torchAvailable && (
                <button
                  type="button"
                  onClick={onToggleTorch}
                  aria-label={torchOn ? 'Desligar lanterna' : 'Ligar lanterna'}
                  aria-pressed={torchOn}
                  style={{ position: 'absolute', left: 0, width: 56, height: 56, borderRadius: 99, border: 'none', background: torchOn ? 'var(--color-gold)' : 'rgba(255,255,255,0.16)', color: torchOn ? 'var(--color-espresso)' : '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                >
                  <Icon name="flash" size={24} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={onShoot}
                disabled={shooting}
                aria-label="Tirar foto"
                style={{ width: 88, height: 88, borderRadius: 99, border: '5px solid #fff', background: 'transparent', padding: 5, cursor: 'pointer', opacity: shooting ? 0.6 : 1 }}
              >
                <span style={{ display: 'block', width: '100%', height: '100%', borderRadius: 99, background: '#fff' }} />
              </button>
              {!required && (
                <button
                  type="button"
                  onClick={onSkip}
                  style={{ position: 'absolute', right: 0, height: 56, padding: '0 20px', borderRadius: 18, border: '1.5px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.14)', color: '#fff', fontWeight: 800, fontSize: 16, fontFamily: CR_BODY, cursor: 'pointer' }}
                >
                  Pular
                </button>
              )}
            </div>
            {required ? (
              <button
                type="button"
                onClick={onCantShoot}
                style={{ display: 'block', margin: '14px auto 0', minHeight: 44, background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)', fontSize: 14.5, fontWeight: 700, fontFamily: CR_BODY, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}
              >
                Não consigo tirar a foto
              </button>
            ) : (
              <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>A foto é opcional para você</div>
            )}
          </>
        )}
      </div>
    </>
  )
}

/** Moldura com cantos (o "quadro-guia" do handoff). */
function ScanFrame({ children, color, dimmed }: { children?: ReactNode; color: string; dimmed?: boolean }) {
  const corner = (pos: 'tl' | 'tr' | 'bl' | 'br') => {
    const style: React.CSSProperties = { position: 'absolute', width: 38, height: 38, borderColor: color, borderStyle: 'solid', borderWidth: 0 }
    if (pos[0] === 't') {
      style.top = 0
      style.borderTopWidth = 5
    } else {
      style.bottom = 0
      style.borderBottomWidth = 5
    }
    if (pos[1] === 'l') {
      style.left = 0
      style.borderLeftWidth = 5
    } else {
      style.right = 0
      style.borderRightWidth = 5
    }
    style.borderRadius = { tl: '18px 0 0 0', tr: '0 18px 0 0', bl: '0 0 0 18px', br: '0 0 18px 0' }[pos]
    return <span key={pos} style={style} />
  }
  return (
    <div
      style={{
        position: 'relative',
        width: FRAME,
        height: FRAME,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 18,
        // Escurece o resto do quadro para o olho ir para a moldura.
        boxShadow: dimmed ? '0 0 0 9999px rgba(0,0,0,0.35)' : undefined,
      }}
    >
      {(['tl', 'tr', 'bl', 'br'] as const).map(corner)}
      {children}
    </div>
  )
}

/** Permissão pendente, bloqueada ou câmera indisponível (E2). */
function ScanBlocked({
  phase,
  onAllow,
  onRetry,
  onTypeCode,
  photo,
}: {
  phase: 'perm' | 'denied' | 'unavailable'
  onAllow: () => void
  onRetry: () => void
  onTypeCode: () => void
  /** Modo foto: o plano B é a câmera nativa do celular (e pular / seguir sem foto). */
  photo?: { required: boolean; onNative: () => void; onSkip: () => void; onCantShoot: () => void }
}) {
  const d = {
    perm: {
      icon: 'camera' as const,
      title: 'Permitir a câmera',
      body: 'O app usa a câmera para ler o QR do cupom e tirar a foto da entrega. Nada é gravado além dessa foto.',
    },
    denied: {
      icon: 'lock' as const,
      title: 'A câmera está bloqueada',
      body: 'Para escanear, libere a câmera para o app:',
      steps: ['Abra os Ajustes do celular', 'Toque em Cheirin de Pão (ou no navegador)', 'Ligue a Câmera e volte aqui'],
    },
    unavailable: {
      icon: 'alert' as const,
      title: 'Câmera indisponível',
      body: 'Não conseguimos abrir a câmera agora. Digite o código que fica embaixo do QR do cupom.',
    },
  }[phase]
  return (
    <div style={{ position: 'absolute', inset: 'calc(110px + env(safe-area-inset-top, 0px)) 22px calc(30px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: 24, background: 'rgba(227,172,63,0.16)', color: 'var(--color-gold)', display: 'grid', placeItems: 'center' }}>
          <Icon name={d.icon} size={34} stroke={2} aria-hidden="true" />
        </div>
        <h2 style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em', margin: '20px 0 0', lineHeight: 1.1 }}>{d.title}</h2>
        <p style={{ fontSize: 15.5, color: '#C7B595', margin: '10px 0 0', lineHeight: 1.5 }}>{d.body}</p>
        {'steps' in d && d.steps && (
          <ol style={{ listStyle: 'none', padding: 0, margin: '16px 0 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {d.steps.map((s, i) => (
              <li key={s} style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 15, fontWeight: 600 }}>
                <span style={{ width: 30, height: 30, borderRadius: 99, background: 'var(--color-gold)', color: 'var(--color-espresso)', display: 'grid', placeItems: 'center', fontFamily: CR_DISPLAY, fontWeight: 800, flexShrink: 0 }}>
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {photo && (
          <>
            {phase === 'perm' && <CRBig variant="gold" icon="camera" onClick={onAllow}>Permitir câmera</CRBig>}
            <CRBig variant={phase === 'perm' ? 'light' : 'gold'} icon="camera" onClick={photo.onNative}>Usar a câmera do celular</CRBig>
            {photo.required ? (
              <CRBig variant="light" icon="ban" onClick={photo.onCantShoot}>Não consigo tirar a foto</CRBig>
            ) : (
              <CRBig variant="light" onClick={photo.onSkip}>Pular a foto</CRBig>
            )}
          </>
        )}
        {!photo && phase === 'perm' && (
          <>
            <CRBig variant="gold" icon="camera" onClick={onAllow}>Permitir câmera</CRBig>
            <CRBig variant="light" onClick={onTypeCode}>Agora não, digitar código</CRBig>
          </>
        )}
        {!photo && phase === 'denied' && (
          <>
            {/* Um PWA não abre os Ajustes do sistema (V-8): depois de liberar, tenta de novo. */}
            <CRBig variant="gold" icon="refresh" onClick={onRetry}>Tentar de novo</CRBig>
            <CRBig variant="light" icon="keyboard" onClick={onTypeCode}>Digitar código</CRBig>
          </>
        )}
        {!photo && phase === 'unavailable' && (
          <>
            <CRBig variant="gold" icon="keyboard" onClick={onTypeCode}>Digitar código</CRBig>
            <CRBig variant="light" icon="refresh" onClick={onRetry}>Tentar de novo</CRBig>
          </>
        )}
      </div>
    </div>
  )
}
