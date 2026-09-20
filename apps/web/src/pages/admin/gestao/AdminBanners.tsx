/**
 * AdminBanners — a lista das peças de comunicação (banners, avisos e promoções).
 *
 * Cada linha responde as três perguntas que o admin faz ao abrir esta tela: o que é, está no ar
 * agora, e está funcionando. Por isso a miniatura, o chip de status e o par alcance/CTR ficam na
 * MESMA linha — obrigar a abrir o cadastro para descobrir se a peça rendeu transformaria a
 * métrica em algo que ninguém consulta.
 */
import { useCallback, useEffect, useState } from 'react'
import { BANNER_PLACEMENT_LABEL, type BannerActionType, type BannerFrequency, type BannerPlacement } from '@cheirin-de-pao/shared'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { BannerForm } from './BannerForm'

export type BannerStatus = 'live' | 'scheduled' | 'expired' | 'paused'

export interface AdminBanner {
  id: string
  name: string
  placement: BannerPlacement
  imageUrl: string | null
  alt: string | null
  title: string | null
  body: string | null
  bgColor: string | null
  ctaLabel: string | null
  actionType: BannerActionType
  actionScreen: string | null
  actionProductId: string | null
  actionComboId: string | null
  actionUrl: string | null
  frequency: BannerFrequency
  startsAt: string | null
  endsAt: string | null
  isActive: boolean
  priority: number
  condominiumIds: string[]
  status: BannerStatus
  metrics: { reach: number; impressions: number; clicks: number; dismissals: number; ctr: number }
}

const STATUS_META: Record<BannerStatus, { label: string; color: string; bg: string }> = {
  live: { label: 'No ar', color: '#1E7A46', bg: 'rgba(30,122,70,0.12)' },
  scheduled: { label: 'Agendado', color: 'var(--color-accent)', bg: 'var(--color-gold-soft)' },
  paused: { label: 'Pausado', color: 'var(--color-text-ter)', bg: 'var(--color-surface-2)' },
  expired: { label: 'Expirado', color: 'var(--color-text-ter)', bg: 'var(--color-surface-2)' },
}

const FILTROS: { key: 'all' | BannerPlacement; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'POPUP', label: 'Pop-up' },
  { key: 'STRIP', label: 'Faixa' },
  { key: 'MARKET', label: 'Mercadinho' },
]

export function AdminBanners({ onBack }: { onBack: () => void }) {
  const [banners, setBanners] = useState<AdminBanner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<'all' | BannerPlacement>('all')
  const [form, setForm] = useState<{ id?: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/banners')
      if (res.ok) setBanners((await res.json()) as AdminBanner[])
      else setError('Não foi possível carregar os banners.')
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const togglePausa = async (b: AdminBanner) => {
    setBusyId(b.id)
    try {
      await apiFetch(`/admin/banners/${b.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !b.isActive }),
      })
      await load()
    } catch {
      setError('Não foi possível alterar o banner.')
    } finally {
      setBusyId(null)
    }
  }

  if (form) {
    return (
      <BannerForm
        id={form.id}
        onBack={() => setForm(null)}
        onSaved={() => {
          setForm(null)
          void load()
        }}
      />
    )
  }

  const shown = filtro === 'all' ? banners : banners.filter((b) => b.placement === filtro)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* AppBar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 10px' }}>
        <button type="button" aria-label="Voltar" onClick={onBack} style={backBtn}>
          <Icon name="arrowL" size={18} color="var(--color-text)" />
        </button>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>
          Banners e avisos
        </h2>
      </div>

      <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button
          type="button"
          onClick={() => setForm({})}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            minHeight: 46,
            background: 'var(--color-espresso)',
            color: '#FAF5EC',
            border: 'none',
            borderRadius: 14,
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Icon name="plus" size={18} color="#FAF5EC" />
          Novo banner
        </button>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FILTROS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFiltro(f.key)}
              style={{
                minHeight: 34,
                padding: '0 13px',
                borderRadius: 999,
                border: filtro === f.key ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
                background: filtro === f.key ? 'var(--color-surface)' : 'transparent',
                color: filtro === f.key ? 'var(--color-accent)' : 'var(--color-text-sec)',
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-accent)', margin: 0 }}>
            {error}
          </p>
        )}

        {loading ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)', textAlign: 'center', padding: 30 }}>
            Carregando...
          </p>
        ) : shown.length === 0 ? (
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              gap: 6,
              padding: '34px 20px',
              borderRadius: 16,
              background: 'var(--color-surface-2)',
              textAlign: 'center',
            }}
          >
            <Icon name="spark" size={22} color="var(--color-text-ter)" />
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              Nenhum banner {filtro === 'all' ? 'criado' : 'nesse formato'}
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: 0, lineHeight: 1.45 }}>
              Crie um pop-up, uma faixa de aviso ou uma peça para a vitrine do mercadinho.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {shown.map((b) => (
              <BannerRow
                key={b.id}
                banner={b}
                busy={busyId === b.id}
                onEdit={() => setForm({ id: b.id })}
                onToggle={() => void togglePausa(b)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BannerRow({
  banner,
  busy,
  onEdit,
  onToggle,
}: {
  banner: AdminBanner
  busy: boolean
  onEdit: () => void
  onToggle: () => void
}) {
  const st = STATUS_META[banner.status]
  const { reach, clicks, ctr } = banner.metrics

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 14,
        padding: '10px 12px',
        boxShadow: 'var(--shadow-soft)',
        opacity: busy ? 0.6 : 1,
      }}
    >
      <button
        type="button"
        onClick={onEdit}
        style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0, border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}
      >
        {/* Miniatura — a faixa não tem arte, então mostra a cor que ela usa */}
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: banner.placement === 'STRIP' ? banner.bgColor || 'var(--color-gold-soft)' : 'var(--color-surface-2)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {banner.imageUrl ? (
            <img src={banner.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Icon name={banner.placement === 'STRIP' ? 'alert' : 'spark'} size={17} color="var(--color-accent)" />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--color-text)',
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {banner.name}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: st.color,
                background: st.bg,
                padding: '2px 7px',
                borderRadius: 999,
              }}
            >
              {st.label}
            </span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)' }}>
              {BANNER_PLACEMENT_LABEL[banner.placement]}
            </span>
            {reach > 0 && (
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)' }}>
                · {reach} {reach === 1 ? 'pessoa' : 'pessoas'} · {clicks} {clicks === 1 ? 'clique' : 'cliques'} ({Math.round(ctr * 100)}%)
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Pausar/religar direto da lista — é a ação urgente (aviso errado no ar) */}
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        aria-label={banner.isActive ? 'Pausar banner' : 'Religar banner'}
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: 11,
          border: 'none',
          background: 'var(--color-surface-2)',
          display: 'grid',
          placeItems: 'center',
          cursor: busy ? 'default' : 'pointer',
        }}
      >
        <Icon name={banner.isActive ? 'ban' : 'power'} size={16} color="var(--color-text-sec)" />
      </button>
    </div>
  )
}

const backBtn: React.CSSProperties = {
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
}
