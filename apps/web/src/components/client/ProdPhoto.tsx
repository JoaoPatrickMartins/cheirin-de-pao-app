import type { CSSProperties } from 'react'

// Fallback de foto por categoria: quando o produto não tem photoUrl (S3), desenha um
// gradiente suave + o emoji da categoria centralizado. Tons derivados do id da categoria
// (determinístico), dentro da paleta creme/dourada da marca. No app real a foto vem do S3.
const TINTS: Array<[string, string]> = [
  ['#F7E7C4', '#EFD49B'], // dourado suave
  ['#EFE3D2', '#E4D2B8'], // creme
  ['#E9E0CE', '#DCCBB0'], // areia
  ['#F1E3D0', '#E7CFAF'], // trigo
  ['#EDE6D6', '#DED0B6'], // aveia
  ['#F4E9D6', '#EAD6B4'], // mel claro
]

function hashIndex(seed: string, mod: number): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h % mod
}

interface ProdPhotoProps {
  photoUrl?: string | null
  emoji?: string | null
  /** Semente do gradiente de fallback (normalmente o categoryId). */
  tintSeed?: string
  alt: string
  /** border-radius em px. */
  radius?: number
  /** Altura fixa (px). Quando ausente, usa aspect-ratio 1:1. */
  height?: number
  /** Escala do emoji no fallback (px). */
  emojiSize?: number
  /** Esmaece a imagem (produto esgotado). */
  dimmed?: boolean
  style?: CSSProperties
}

export function ProdPhoto({
  photoUrl,
  emoji,
  tintSeed = '',
  alt,
  radius = 16,
  height,
  emojiSize = 40,
  dimmed = false,
  style,
}: ProdPhotoProps) {
  const box: CSSProperties = {
    width: '100%',
    height,
    aspectRatio: height ? undefined : '1 / 1',
    borderRadius: radius,
    overflow: 'hidden',
    display: 'grid',
    placeItems: 'center',
    opacity: dimmed ? 0.55 : 1,
    filter: dimmed ? 'grayscale(0.4)' : undefined,
    ...style,
  }

  if (photoUrl) {
    return (
      <div style={box}>
        <img
          src={photoUrl}
          alt={alt}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    )
  }

  const [a, b] = TINTS[hashIndex(tintSeed, TINTS.length)]
  return (
    <div
      role="img"
      aria-label={alt}
      style={{
        ...box,
        background: `linear-gradient(135deg, ${a}, ${b})`,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: emojiSize, lineHeight: 1 }}>
        {emoji || '🥐'}
      </span>
    </div>
  )
}
