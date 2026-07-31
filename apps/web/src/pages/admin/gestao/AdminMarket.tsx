import { useState } from 'react'
import { Icon } from '../../../components/brand/Icon'
import { SectionTabs } from '../../../components/admin/SectionTabs'
import { MarketProdutos } from './MarketProdutos'
import { MarketCategorias } from './MarketCategorias'
import { MarketConfig } from './MarketConfig'
import { MarketCestinhas } from './MarketCestinhas'
import { MarketReposicao } from './MarketReposicao'
import { MarketPreparo } from './MarketPreparo'

// Hub do mini market "Além do Pãozin" (admin). Segue o padrão de sub-telas do AdminGestao:
// AppBar + chips de seção; cada seção é autossuficiente (faz o próprio fetch).
type Section = 'cestinhas' | 'preparo' | 'produtos' | 'reposicao' | 'categorias' | 'config'

const SECTIONS: { key: Section; label: string }[] = [
  // Pedidos primeiro: é o que o admin abre no dia a dia (produtos/config são cadastro).
  { key: 'cestinhas', label: 'Cestinhas' },
  // Preparo (G1) vem logo depois porque é a pergunta da manhã: o que separar/produzir por dia.
  { key: 'preparo', label: 'Preparo' },
  { key: 'produtos', label: 'Produtos' },
  // Reposição fica ao lado de Produtos porque é a ação que o alerta de estoque baixo pede (F5).
  { key: 'reposicao', label: 'Reposição' },
  { key: 'categorias', label: 'Categorias' },
  { key: 'config', label: 'Config' },
]

export function AdminMarket({ onBack }: { onBack: () => void }) {
  const [section, setSection] = useState<Section>('cestinhas')

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

      {/* Navegação de seção — abas com sublinhado. Nível 1: outra espécie visual que os chips de
          filtro de dentro de cada seção (ver SectionTabs). */}
      <SectionTabs tabs={SECTIONS} value={section} onChange={setSection} ariaLabel="Seções do Além do Pãozin" />

      {/* Conteúdo da seção */}
      <div style={{ flex: 1, overflow: 'auto', paddingTop: 12 }}>
        {section === 'cestinhas' && <MarketCestinhas />}
        {section === 'preparo' && <MarketPreparo />}
        {section === 'produtos' && <MarketProdutos />}
        {section === 'reposicao' && <MarketReposicao />}
        {section === 'categorias' && <MarketCategorias />}
        {section === 'config' && <MarketConfig />}
      </div>
    </div>
  )
}
