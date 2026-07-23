import { useState } from 'react'
import { Icon } from '../../../components/brand/Icon'
import { MarketProdutos } from './MarketProdutos'
import { MarketCategorias } from './MarketCategorias'
import { MarketConfig } from './MarketConfig'

// Hub do mini market "Além do Pãozin" (admin). Segue o padrão de sub-telas do AdminGestao:
// AppBar + chips de seção; cada seção é autossuficiente (faz o próprio fetch).
type Section = 'produtos' | 'categorias' | 'config'

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'produtos', label: 'Produtos' },
  { key: 'categorias', label: 'Categorias' },
  { key: 'config', label: 'Config' },
]

export function AdminMarket({ onBack }: { onBack: () => void }) {
  const [section, setSection] = useState<Section>('produtos')

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* AppBar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 10px' }}>
        <button
          type="button"
          aria-label="Voltar"
          onClick={onBack}
          style={{
            background: 'var(--color-surface-2)',
            border: 'none',
            width: 36,
            height: 36,
            borderRadius: 11,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon name="arrowL" size={18} color="var(--color-text)" />
        </button>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
            margin: 0,
          }}
        >
          Além do Pãozin
        </h2>
      </div>

      {/* Chips de seção */}
      <div style={{ display: 'flex', gap: 8, padding: '0 20px 12px', overflowX: 'auto' }}>
        {SECTIONS.map((s) => {
          const active = section === s.key
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSection(s.key)}
              style={{
                flexShrink: 0,
                minHeight: 36,
                padding: '0 16px',
                borderRadius: 999,
                border: active ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
                background: active ? 'var(--color-surface)' : 'transparent',
                color: active ? 'var(--color-accent)' : 'var(--color-text-sec)',
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: 13.5,
                cursor: 'pointer',
              }}
            >
              {s.label}
            </button>
          )
        })}
      </div>

      {/* Conteúdo da seção */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {section === 'produtos' && <MarketProdutos />}
        {section === 'categorias' && <MarketCategorias />}
        {section === 'config' && <MarketConfig />}
      </div>
    </div>
  )
}
