import { useCallback, useRef, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import imageCompression from 'browser-image-compression'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../brand/Icon'
import { CRAvatar } from '../courier/kit'

/** Recorta a região escolhida (quadrada) e devolve um JPEG. */
async function recortar(src: string, area: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('imagem inválida'))
    el.src = src
  })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(area.width)
  canvas.height = Math.round(area.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas indisponível')
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height)
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('falha ao recortar'))), 'image/jpeg', 0.9))
}

const smallBtn: React.CSSProperties = {
  height: 34,
  padding: '0 12px',
  borderRadius: 11,
  border: 'none',
  background: 'var(--color-surface-2)',
  color: 'var(--color-text)',
  fontFamily: 'var(--font-body)',
  fontWeight: 800,
  fontSize: 12.5,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
}

/**
 * Foto do crachá (A3 · seção 1): câmera ou galeria → recorte REDONDO → envio para a pasta pública
 * `couriers/` (T-6). Aparece para o cliente quando o pão sai e no crachá.
 */
export function CourierPhotoPicker({
  name,
  value,
  onChange,
  onError,
}: {
  name: string
  value: string | null
  onChange: (url: string | null) => void
  onError: (msg: string | null) => void
}) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [origem, setOrigem] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [enviando, setEnviando] = useState(false)
  const onCropComplete = useCallback((_: Area, px: Area) => setArea(px), [])

  const escolher = (file: File | undefined) => {
    if (!file) return
    onError(null)
    const reader = new FileReader()
    reader.onload = () => setOrigem(String(reader.result))
    reader.readAsDataURL(file)
  }

  const confirmar = async () => {
    if (!origem || !area) return
    setEnviando(true)
    onError(null)
    try {
      const recortado = await recortar(origem, area)
      const comprimido = await imageCompression(new File([recortado], 'entregador.jpg', { type: 'image/jpeg' }), { maxSizeMB: 0.4, maxWidthOrHeight: 600, useWebWorker: true })
      const fd = new FormData()
      fd.append('file', comprimido)
      const res = await apiFetch('/admin/couriers/photo', { method: 'POST', body: fd })
      const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
      if (res.ok && body?.url) {
        onChange(body.url)
        setOrigem(null)
      } else onError(body?.error ?? 'Não foi possível enviar a foto.')
    } catch {
      onError('Não foi possível processar a imagem. Tente outra.')
    } finally {
      setEnviando(false)
    }
  }

  const input = (ref: React.RefObject<HTMLInputElement | null>, label: string, capture?: 'user') => (
    <input
      ref={ref}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      aria-label={label}
      {...(capture ? { capture } : {})}
      style={{ display: 'none' }}
      onChange={(e) => {
        escolher(e.target.files?.[0])
        e.target.value = ''
      }}
    />
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      {value ? (
        <CRAvatar name={name || 'Entregador'} photoUrl={value} size={72} />
      ) : (
        <div style={{ width: 72, height: 72, borderRadius: 99, border: '2px dashed var(--color-border)', display: 'grid', placeItems: 'center', color: 'var(--color-accent)', flexShrink: 0 }}>
          <Icon name="camera" size={24} aria-hidden="true" />
        </div>
      )}
      <div style={{ flex: 1, fontFamily: 'var(--font-body)' }}>
        <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--color-text)' }}>Foto do crachá</div>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-sec)', marginTop: 2 }}>Aparece para o cliente e no crachá. Recorte redondo.</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <button type="button" style={smallBtn} onClick={() => cameraRef.current?.click()}>
            <Icon name="camera" size={14} aria-hidden="true" />
            Câmera
          </button>
          <button type="button" style={smallBtn} onClick={() => galleryRef.current?.click()}>
            <Icon name="image" size={14} aria-hidden="true" />
            Galeria
          </button>
          {value && (
            <button type="button" style={{ ...smallBtn, background: 'none', color: 'var(--color-warn)' }} onClick={() => onChange(null)}>
              Remover
            </button>
          )}
        </div>
      </div>
      {input(cameraRef, 'Tirar foto do entregador', 'user')}
      {input(galleryRef, 'Escolher foto do entregador')}

      {origem && (
        <div role="dialog" aria-modal="true" aria-label="Enquadrar a foto" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Cropper image={origem} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
          </div>
          <div style={{ background: 'var(--color-app-bg)', padding: '14px 20px calc(14px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Aproximar" />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setOrigem(null)} disabled={enviando} style={{ ...smallBtn, flex: 1, height: 46, borderRadius: 999 }}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmar()}
                disabled={enviando}
                style={{ ...smallBtn, flex: 1, height: 46, borderRadius: 999, background: 'var(--color-espresso)', color: '#fff' }}
              >
                {enviando ? 'Enviando…' : 'Usar esta foto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
