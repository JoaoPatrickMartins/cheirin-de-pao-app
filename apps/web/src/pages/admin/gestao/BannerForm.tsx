/**
 * BannerForm — cadastro de uma peça de comunicação.
 *
 * O FORMATO é a primeira pergunta porque define o resto do formulário: a faixa de aviso não tem
 * arte, o pop-up não tem corpo de texto, e só o pop-up tem frequência. Perguntar tudo a todos
 * produziria um formulário cheio de campos mortos.
 *
 * As mesmas regras do backend valem aqui (`CreateBannerSchema`), para a tela nunca deixar enviar
 * algo que o servidor vai recusar — mas quem manda continua sendo o servidor.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  BANNER_ASPECT,
  BANNER_PLACEMENT_LABEL,
  BANNER_PLACEMENTS,
  BANNER_SCREENS,
  type BannerActionType,
  type BannerFrequency,
  type BannerPlacement,
} from '@cheirin-de-pao/shared'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { ConfirmSheet } from '../../../components/admin/ConfirmSheet'
import { BannerImagePicker } from '../../../components/admin/BannerImagePicker'
import { BannerPreview } from '../../../components/admin/BannerPreview'
import type { AdminBanner } from './AdminBanners'

interface Opcao {
  id: string
  name: string
}

const ACOES: { value: BannerActionType; label: string }[] = [
  { value: 'NONE', label: 'Nenhuma — só aviso' },
  { value: 'SCREEN', label: 'Abrir uma tela do app' },
  { value: 'PRODUCT', label: 'Abrir um produto' },
  { value: 'COMBO', label: 'Abrir um combo' },
  { value: 'EXTERNAL', label: 'Abrir link externo' },
]

const FREQUENCIAS: { value: BannerFrequency; label: string; hint: string }[] = [
  { value: 'DAILY', label: 'Uma vez por dia', hint: 'O padrão. Volta no dia seguinte se não clicarem.' },
  { value: 'ONCE', label: 'Uma vez só', hint: 'Aparece uma única vez para cada cliente.' },
  { value: 'ALWAYS', label: 'Toda abertura', hint: 'Insistente — use por poucos dias.' },
]

/** "2026-09-20T10:00" (input datetime-local) ⇄ ISO. */
function paraInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function BannerForm({
  id,
  onBack,
  onSaved,
}: {
  id?: string
  onBack: () => void
  onSaved: () => void
}) {
  const [placement, setPlacement] = useState<BannerPlacement>('POPUP')
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [alt, setAlt] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [bgColor, setBgColor] = useState('')
  const [ctaLabel, setCtaLabel] = useState('')
  const [actionType, setActionType] = useState<BannerActionType>('NONE')
  const [actionScreen, setActionScreen] = useState('')
  const [actionProductId, setActionProductId] = useState('')
  const [actionComboId, setActionComboId] = useState('')
  const [actionUrl, setActionUrl] = useState('')
  const [frequency, setFrequency] = useState<BannerFrequency>('DAILY')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [priority, setPriority] = useState('0')
  const [segmentar, setSegmentar] = useState(false)
  const [condominiumIds, setCondominiumIds] = useState<string[]>([])

  const [condos, setCondos] = useState<Opcao[]>([])
  const [produtos, setProdutos] = useState<Opcao[]>([])
  const [combos, setCombos] = useState<Opcao[]>([])

  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Listas para os seletores de destino. Falha aqui não impede cadastrar um banner sem ação.
  useEffect(() => {
    const load = async () => {
      try {
        const [c, p, k] = await Promise.all([
          apiFetch('/admin/condominiums'),
          apiFetch('/admin/market/products'),
          apiFetch('/admin/combos'),
        ])
        if (c.ok) setCondos((await c.json()) as Opcao[])
        if (p.ok) setProdutos((await p.json()) as Opcao[])
        if (k.ok) setCombos((await k.json()) as Opcao[])
      } catch {
        /* silencioso — só afeta os seletores */
      }
    }
    void load()
  }, [])

  useEffect(() => {
    if (!id) return
    const load = async () => {
      try {
        const res = await apiFetch(`/admin/banners/${id}`)
        if (res.ok) {
          const b = (await res.json()) as AdminBanner
          setPlacement(b.placement)
          setName(b.name)
          setImageUrl(b.imageUrl ?? null)
          setAlt(b.alt ?? '')
          setTitle(b.title ?? '')
          setBody(b.body ?? '')
          setBgColor(b.bgColor ?? '')
          setCtaLabel(b.ctaLabel ?? '')
          setActionType(b.actionType)
          setActionScreen(b.actionScreen ?? '')
          setActionProductId(b.actionProductId ?? '')
          setActionComboId(b.actionComboId ?? '')
          setActionUrl(b.actionUrl ?? '')
          setFrequency(b.frequency)
          setStartsAt(paraInput(b.startsAt))
          setEndsAt(paraInput(b.endsAt))
          setIsActive(b.isActive)
          setPriority(String(b.priority))
          setCondominiumIds(b.condominiumIds ?? [])
          setSegmentar((b.condominiumIds ?? []).length > 0)
        }
      } catch {
        /* silencioso */
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [id])

  const isStrip = placement === 'STRIP'
  const aspect = isStrip ? 1 : BANNER_ASPECT[placement]

  // Espelha o superRefine do shared: o que o servidor recusaria, o botão nem deixa tentar.
  const valid = useMemo(() => {
    if (!name.trim()) return false
    if (isStrip ? !title.trim() : !imageUrl || !alt.trim()) return false
    if (actionType === 'SCREEN' && !actionScreen) return false
    if (actionType === 'PRODUCT' && !actionProductId) return false
    if (actionType === 'COMBO' && !actionComboId) return false
    if (actionType === 'EXTERNAL' && !/^https:\/\/\S+$/i.test(actionUrl)) return false
    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) return false
    if (segmentar && condominiumIds.length === 0) return false
    return true
  }, [name, isStrip, title, imageUrl, alt, actionType, actionScreen, actionProductId, actionComboId, actionUrl, startsAt, endsAt, segmentar, condominiumIds])

  const handleSave = async () => {
    setError(null)
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        placement,
        // Trocar de formato tem que LIMPAR o que o outro usava — senão a faixa vai embora com a
        // arte do pop-up gravada e o servidor recusa com uma mensagem que o admin não esperava.
        imageUrl: isStrip ? null : imageUrl,
        alt: isStrip ? null : alt.trim(),
        title: isStrip ? title.trim() : null,
        body: isStrip && body.trim() ? body.trim() : null,
        bgColor: isStrip && bgColor ? bgColor : null,
        ctaLabel: !isStrip && ctaLabel.trim() ? ctaLabel.trim() : null,
        actionType,
        actionScreen: actionType === 'SCREEN' ? actionScreen : null,
        actionProductId: actionType === 'PRODUCT' ? actionProductId : null,
        actionComboId: actionType === 'COMBO' ? actionComboId : null,
        actionUrl: actionType === 'EXTERNAL' ? actionUrl.trim() : null,
        frequency,
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        isActive,
        priority: Number(priority) || 0,
        condominiumIds: segmentar ? condominiumIds : [],
      }

      const res = await apiFetch(id ? `/admin/banners/${id}` : '/admin/banners', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        onSaved()
      } else {
        const e = (await res.json().catch(() => null)) as { error?: string } | null
        setError(e?.error ?? 'Não foi possível salvar. Tente novamente.')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setConfirmDelete(false)
    setSaving(true)
    try {
      const res = await apiFetch(`/admin/banners/${id}`, { method: 'DELETE' })
      if (res.ok) onSaved()
      else setError('Não foi possível excluir.')
    } catch {
      setError('Erro de conexão.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
        Carregando...
      </div>
    )
  }

  return (
    <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
        <button type="button" aria-label="Voltar" onClick={onBack} style={miniBack}>
          <Icon name="arrowL" size={18} color="var(--color-text)" />
        </button>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>
          {id ? 'Editar banner' : 'Novo banner'}
        </h3>
      </div>

      {/* 1. Formato — primeiro porque define o resto do formulário */}
      <div>
        <FieldLabel>Formato</FieldLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {BANNER_PLACEMENTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlacement(p)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                textAlign: 'left',
                minHeight: 52,
                padding: '10px 13px',
                borderRadius: 14,
                border: placement === p ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
                background: placement === p ? 'var(--color-surface)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <Icon
                name={p === 'POPUP' ? 'spark' : p === 'STRIP' ? 'alert' : 'bag'}
                size={18}
                color={placement === p ? 'var(--color-accent)' : 'var(--color-text-ter)'}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                  {BANNER_PLACEMENT_LABEL[p]}
                </span>
                <span style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', marginTop: 1 }}>
                  {p === 'POPUP'
                    ? 'Modal com arte ao abrir o app (4:5)'
                    : p === 'STRIP'
                      ? 'Tira de texto no topo da Home, sem imagem'
                      : 'Peça larga na vitrine do mercadinho (3:1)'}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <TextField label="Nome interno" value={name} onChange={setName} placeholder="Ex.: Promo de setembro" />
      <Hint>Só você vê — serve para achar a peça nesta lista.</Hint>

      {/* 2. Conteúdo */}
      {isStrip ? (
        <>
          <TextField label="Título" value={title} onChange={setTitle} placeholder="Ex.: Feriado dia 7" />
          <TextField label="Texto (opcional)" value={body} onChange={setBody} placeholder="Ex.: Não haverá entrega nesse dia." />
          <div>
            <FieldLabel>Cor de fundo (opcional)</FieldLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="color"
                value={bgColor || '#F3DDA6'}
                onChange={(e) => setBgColor(e.target.value)}
                aria-label="Cor de fundo da faixa"
                style={{ width: 46, height: 40, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
              />
              {bgColor && (
                <button type="button" onClick={() => setBgColor('')} style={linkBtn}>
                  Usar a cor padrão
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div>
            <FieldLabel>Arte ({placement === 'POPUP' ? '4:5, vertical' : '3:1, larga'})</FieldLabel>
            <BannerImagePicker value={imageUrl} aspect={aspect} onChange={setImageUrl} onError={setError} />
          </div>
          <TextField label="Descrição da imagem" value={alt} onChange={setAlt} placeholder="Ex.: Combo de pães com 20% de desconto" />
          <Hint>É o que o leitor de tela anuncia — e o que aparece se a imagem não carregar.</Hint>
          <TextField label="Texto do botão (opcional)" value={ctaLabel} onChange={setCtaLabel} placeholder="Ex.: Peça agora" />
        </>
      )}

      {/* 3. Ação */}
      <div>
        <FieldLabel>Ao tocar no banner</FieldLabel>
        <Select value={actionType} onChange={(v) => setActionType(v as BannerActionType)} options={ACOES} />
      </div>

      {actionType === 'SCREEN' && (
        <div>
          <FieldLabel>Tela de destino</FieldLabel>
          <Select
            value={actionScreen}
            onChange={setActionScreen}
            options={[
              { value: '', label: 'Escolha uma tela…' },
              ...Object.entries(BANNER_SCREENS).map(([key, s]) => ({ value: key, label: s.label })),
            ]}
          />
        </div>
      )}

      {actionType === 'PRODUCT' && (
        <div>
          <FieldLabel>Produto</FieldLabel>
          <Select
            value={actionProductId}
            onChange={setActionProductId}
            options={[{ value: '', label: 'Escolha um produto…' }, ...produtos.map((p) => ({ value: p.id, label: p.name }))]}
          />
        </div>
      )}

      {actionType === 'COMBO' && (
        <div>
          <FieldLabel>Combo</FieldLabel>
          <Select
            value={actionComboId}
            onChange={setActionComboId}
            options={[{ value: '', label: 'Escolha um combo…' }, ...combos.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </div>
      )}

      {actionType === 'EXTERNAL' && (
        <>
          <TextField label="Link" value={actionUrl} onChange={setActionUrl} placeholder="https://" />
          <Hint>Precisa começar com https:// — abre fora do app, em nova aba.</Hint>
        </>
      )}

      {/* 4. Quando aparece */}
      <div>
        <FieldLabel>Começa em (opcional)</FieldLabel>
        <DateTimeField value={startsAt} onChange={setStartsAt} />
      </div>
      <div>
        <FieldLabel>Termina em (opcional)</FieldLabel>
        <DateTimeField value={endsAt} onChange={setEndsAt} />
        <Hint>Sem data, fica no ar até você pausar. Com data, some sozinho na hora marcada.</Hint>
      </div>

      {placement === 'POPUP' && (
        <div>
          <FieldLabel>Frequência</FieldLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {FREQUENCIAS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFrequency(f.value)}
                style={{
                  textAlign: 'left',
                  padding: '9px 12px',
                  borderRadius: 12,
                  border: frequency === f.value ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
                  background: frequency === f.value ? 'var(--color-surface)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <span style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)' }}>
                  {f.label}
                </span>
                <span style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)' }}>
                  {f.hint}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 5. Para quem */}
      <div>
        <FieldLabel>Para quem</FieldLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          <Chip label="Todos os clientes" active={!segmentar} onClick={() => setSegmentar(false)} />
          <Chip label="Escolher condomínios" active={segmentar} onClick={() => setSegmentar(true)} />
        </div>
        {segmentar && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            {condos.map((c) => {
              const marcado = condominiumIds.includes(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    setCondominiumIds((prev) => (marcado ? prev.filter((x) => x !== c.id) : [...prev, c.id]))
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    minHeight: 42,
                    padding: '0 12px',
                    borderRadius: 12,
                    border: `1.5px solid ${marcado ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    background: marcado ? 'var(--color-surface)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 6,
                      display: 'grid',
                      placeItems: 'center',
                      background: marcado ? 'var(--color-accent)' : 'transparent',
                      border: marcado ? 'none' : '1.5px solid var(--color-border)',
                      flexShrink: 0,
                    }}
                  >
                    {marcado && <Icon name="check" size={12} color="#FFF" stroke={3} />}
                  </span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--color-text)' }}>{c.name}</span>
                </button>
              )
            })}
            {condominiumIds.length === 0 && <Hint>Escolha ao menos um condomínio.</Hint>}
          </div>
        )}
      </div>

      <TextField label="Prioridade" value={priority} onChange={setPriority} type="number" placeholder="0" />
      <Hint>Quando mais de uma peça concorre, a de maior número aparece.</Hint>

      {/* 6. Preview */}
      <BannerPreview
        placement={placement}
        banner={{
          id: 'preview',
          imageUrl: isStrip ? null : imageUrl,
          alt: alt || null,
          title: title || null,
          body: body || null,
          bgColor: bgColor || null,
          ctaLabel: ctaLabel || null,
          actionUrl: actionType === 'NONE' ? null : '#',
          external: false,
        }}
      />

      {error && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-accent)', margin: 0 }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={!valid || saving}
        style={{
          minHeight: 50,
          borderRadius: 14,
          border: 'none',
          background: 'var(--color-espresso)',
          color: '#FAF5EC',
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          fontWeight: 700,
          cursor: !valid || saving ? 'default' : 'pointer',
          opacity: !valid || saving ? 0.5 : 1,
        }}
      >
        {saving ? 'Salvando…' : id ? 'Salvar alterações' : 'Criar banner'}
      </button>

      {id && (
        <button type="button" onClick={() => setConfirmDelete(true)} disabled={saving} style={{ ...linkBtn, color: 'var(--color-warn, #B4462F)', minHeight: 44 }}>
          Excluir banner
        </button>
      )}

      <ConfirmSheet
        open={confirmDelete}
        title="Excluir banner?"
        description="A peça e o histórico de exibições dela serão apagados."
        confirmLabel="Excluir"
        tone="danger"
        busy={saving}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}

// ── peças de formulário (mesma gramática visual do MarketProductForm) ───────
const miniBack: React.CSSProperties = {
  background: 'var(--color-surface-2)',
  border: 'none',
  width: 34,
  height: 34,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-sec)', marginBottom: 7 }}>
      {children}
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: '-10px 2px 0', lineHeight: 1.4 }}>
      {children}
    </p>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <label style={{ display: 'block' }}>
      <FieldLabel>{label}</FieldLabel>
      <div
        style={{
          background: 'var(--color-surface-alt, #FBF6EC)',
          border: `1.5px solid ${focused ? 'var(--color-accent)' : 'var(--color-border)'}`,
          borderRadius: 14,
          padding: '12px 14px',
        }}
      >
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            color: 'var(--color-text)',
          }}
        />
      </div>
    </label>
  )
}

function DateTimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div
      style={{
        background: 'var(--color-surface-alt, #FBF6EC)',
        border: '1.5px solid var(--color-border)',
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          color: 'var(--color-text)',
        }}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Limpar data" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2 }}>
          <Icon name="x" size={15} color="var(--color-text-ter)" />
        </button>
      )}
    </div>
  )
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div
      style={{
        background: 'var(--color-surface-alt, #FBF6EC)',
        border: '1.5px solid var(--color-border)',
        borderRadius: 14,
        padding: '12px 14px',
      }}
    >
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          color: 'var(--color-text)',
cursor: 'pointer',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 38,
        padding: '0 14px',
        borderRadius: 999,
        border: active ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
        background: active ? 'var(--color-surface)' : 'transparent',
        color: active ? 'var(--color-accent)' : 'var(--color-text-sec)',
        fontFamily: 'var(--font-body)',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}
