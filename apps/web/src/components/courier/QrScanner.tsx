import { useEffect, useRef, useState } from 'react'
import { Icon } from '../brand/Icon'

/**
 * Leitor de QR do cupom para confirmar entrega.
 *
 * Usa a API nativa BarcodeDetector (Chrome/Android) quando disponível; caso contrário
 * cai para um campo manual onde o entregador digita o código do cupom. O conteúdo do
 * QR é o orderId — o backend valida que o pedido pertence ao entregador (JWT).
 */
export function QrScanner({ onDetect, onClose }: { onDetect: (text: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onDetectRef = useRef(onDetect)
  onDetectRef.current = onDetect

  const [supported] = useState(() => typeof window !== 'undefined' && 'BarcodeDetector' in window)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supported) return
    let stream: MediaStream | null = null
    let interval: ReturnType<typeof setInterval> | null = null
    let stopped = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        interval = setInterval(async () => {
          if (stopped || !videoRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes && codes.length > 0 && codes[0].rawValue) {
              stopped = true
              if (interval) clearInterval(interval)
              onDetectRef.current(String(codes[0].rawValue))
            }
          } catch {
            /* erro de frame — ignora e tenta no próximo tick */
          }
        }, 350)
      } catch {
        setError('Não foi possível acessar a câmera. Verifique as permissões.')
      }
    }
    void start()

    return () => {
      stopped = true
      if (interval) clearInterval(interval)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [supported])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 300, display: 'flex', flexDirection: 'column' }}>
      {/* Topo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', color: '#fff' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700 }}>Escanear cupom</span>
        <button onClick={onClose} aria-label="Fechar" style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon name="x" size={20} color="#fff" stroke={2.2} />
        </button>
      </div>

      {supported && !error ? (
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {/* Moldura guia */}
          <div style={{ position: 'absolute', width: 220, height: 220, border: '3px solid rgba(255,255,255,0.85)', borderRadius: 20, boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)' }} />
          <p style={{ position: 'absolute', bottom: 40, color: '#fff', fontFamily: 'var(--font-body)', fontSize: 14, textAlign: 'center', padding: '0 30px', opacity: 0.9 }}>
            Aponte para o QR do cupom
          </p>
        </div>
      ) : (
        /* Sem leitura por câmera — orienta usar a confirmação da lista (caminho universal) */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 32px', color: '#fff', textAlign: 'center' }}>
          <Icon name="alert" size={36} color="#E3AC3F" stroke={2} />
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, lineHeight: 1.5, margin: '16px 0 20px', opacity: 0.9 }}>
            {error || 'A leitura por câmera não é suportada neste aparelho. Use o botão "Confirmar" direto na lista de entregas.'}
          </p>
          <button
            onClick={onClose}
            style={{ minHeight: 48, padding: '0 28px', borderRadius: 999, border: 'none', background: 'var(--color-gold)', color: 'var(--color-espresso)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
          >
            Entendi
          </button>
        </div>
      )}
    </div>
  )
}
