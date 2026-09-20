/**
 * BannerImagePicker — escolher, ENQUADRAR e enviar a arte do banner.
 *
 * O crop não é luxo: cada formato tem uma proporção fixa (4:5 no pop-up, 3:1 no mercadinho) e,
 * sem enquadrar, uma foto de celular 3:4 entraria esticada ou com a parte importante cortada pelo
 * `object-fit`. Enquadrar aqui é a diferença entre o admin ver o que vai publicar e descobrir
 * depois, no celular do cliente.
 *
 * A compressão resolve o outro lado: foto de celular passa dos 5 MB e o upload recusaria. Reduzir
 * no navegador evita a recusa E deixa a Home mais leve — a arte chega ao cliente com o tamanho
 * que ele realmente precisa baixar.
 */
import { useCallback, useRef, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import imageCompression from 'browser-image-compression'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../brand/Icon'

/** Recorta a região escolhida e devolve um JPEG. */
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

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('falha ao recortar'))), 'image/jpeg', 0.9)
  })
}

export function BannerImagePicker({
  value,
  aspect,
  onChange,
  onError,
}: {
  value: string | null
  /** largura ÷ altura — vem de BANNER_ASPECT. */
  aspect: number
  onChange: (url: string | null) => void
  onError: (msg: string | null) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [origem, setOrigem] = useState<string | null>(null) // dataURL do arquivo escolhido
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [enviando, setEnviando] = useState(false)

  const onCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), [])

  const escolher = (file: File) => {
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
      // 1 MB e 1600px de lado maior: mais que suficiente para a maior peça (3:1 em tela retina)
      // e bem abaixo do teto de 5 MB do servidor.
      const comprimido = await imageCompression(
        new File([recortado], 'banner.jpg', { type: 'image/jpeg' }),
        { maxSizeMB: 1, maxWidthOrHeight: 1600, useWebWorker: true },
      )

      const fd = new FormData()
      fd.append('file', comprimido)
      const res = await apiFetch('/admin/banners/upload', { method: 'POST', body: fd })
      if (res.ok) {
        onChange(((await res.json()) as { url: string }).url)
        setOrigem(null)
      } else {
        const e = (await res.json().catch(() => null)) as { error?: string } | null
        onError(e?.error ?? 'Não foi possível enviar a arte.')
      }
    } catch {
      onError('Não foi possível processar a imagem. Tente outra.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) escolher(f)
          // Permite reescolher o MESMO arquivo depois de cancelar o enquadramento.
          e.target.value = ''
        }}
      />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        style={{
          width: '100%',
          borderRadius: 14,
          border: '1.5px dashed var(--color-border)',
          background: 'var(--color-surface-alt, #FBF6EC)',
          cursor: 'pointer',
          overflow: 'hidden',
          padding: 0,
          display: 'block',
        }}
      >
        {value ? (
          <img src={value} alt="Prévia da arte" style={{ display: 'block', width: '100%', aspectRatio: String(aspect), objectFit: 'cover' }} />
        ) : (
          <span
            style={{
              display: 'grid',
              placeItems: 'center',
              minHeight: 120,
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--color-text-ter)',
            }}
          >
            Toque para enviar (JPG/PNG/WebP)
          </span>
        )}
      </button>

      {value && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" onClick={() => fileRef.current?.click()} style={linkBtn}>
            Trocar arte
          </button>
          <button type="button" onClick={() => onChange(null)} style={{ ...linkBtn, color: 'var(--color-warn, #B4462F)' }}>
            Remover
          </button>
        </div>
      )}

      {/* Enquadramento — modal sobre tudo, porque arrastar a imagem exige a tela inteira */}
      {origem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Enquadrar a arte"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            zIndex: 300,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ position: 'relative', flex: 1 }}>
            <Cropper
              image={origem}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          <div
            style={{
              background: 'var(--color-app-bg)',
              padding: '14px 20px calc(14px + env(safe-area-inset-bottom))',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="search" size={16} color="var(--color-text-ter)" aria-hidden="true" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                aria-label="Aproximar"
                style={{ flex: 1 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setOrigem(null)} disabled={enviando} style={secondaryBtn}>
                Cancelar
              </button>
              <button type="button" onClick={() => void confirmar()} disabled={enviando} style={primaryBtn(enviando)}>
                {enviando ? 'Enviando…' : 'Usar esta arte'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const linkBtn: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: '4px 2px',
  fontFamily: 'var(--font-body)',
  fontSize: 12.5,
  fontWeight: 700,
  color: 'var(--color-accent)',
  cursor: 'pointer',
}

const secondaryBtn: React.CSSProperties = {
  flex: 1,
  minHeight: 46,
  borderRadius: 14,
  border: '1.5px solid var(--color-border)',
  background: 'transparent',
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--color-text)',
  cursor: 'pointer',
}

const primaryBtn = (busy: boolean): React.CSSProperties => ({
  flex: 2,
  minHeight: 46,
  borderRadius: 14,
  border: 'none',
  background: 'var(--color-espresso)',
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  fontWeight: 700,
  color: '#FAF5EC',
  cursor: busy ? 'default' : 'pointer',
  opacity: busy ? 0.6 : 1,
})
