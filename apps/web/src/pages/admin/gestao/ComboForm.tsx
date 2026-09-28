import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'

// ------------------------------------------------------------------ tipos
interface ComboFormProps {
  id?: string
  onBack: () => void
  onSaved: () => void
}

/** Insumos da precificação assistida (D1) — `GET /admin/combos/pricing`. */
interface Pricing {
  avulsoUnit: number
  /** `null` quando o pão não tem fornecedor ativo. Nunca zero — ver o aviso na tela. */
  breadUnitCost: number | null
  costSuppliers: number
}

const fmtBRL = (v: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)

/**
 * Piso de margem abaixo do qual o formulário passa a avisar.
 *
 * É um AVISO, não um bloqueio: vender no prejuízo pode ser isca deliberada (mesma régua do
 * `belowCost` do produto da Cestinha, P-13). O admin decide; o formulário só não deixa acontecer
 * por distração.
 */
const MARGIN_FLOOR_PCT = 20

// ------------------------------------------------------------------ componente
export function ComboForm({ id, onBack, onSaved }: ComboFormProps) {
  const [nome, setNome] = useState('')
  const [subtitulo, setSubtitulo] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [preco, setPreco] = useState('')
  const [tag, setTag] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(!!id)
  const [error, setError] = useState<string | null>(null)
  const [pricing, setPricing] = useState<Pricing | null>(null)

  useEffect(() => {
    if (!id) return
    const fetchCombo = async () => {
      try {
        const res = await apiFetch(`/admin/combos/${id}`)
        if (res.ok) {
          const data = (await res.json()) as {
            name: string
            quantity: number
            price: number
            tag?: string | null
            description?: string | null
          }
          setNome(data.name)
          setSubtitulo(data.description ?? '')
          setQuantidade(String(data.quantity))
          setPreco(String(data.price))
          setTag(data.tag ?? '')
        }
      } catch {
        // falha silenciosa
      } finally {
        setIsLoading(false)
      }
    }
    void fetchCombo()
  }, [id])

  // Precificação assistida (D1): o custo do pão chega em paralelo ao combo e falha em silêncio —
  // não ver a margem é ruim, mas não poder cadastrar um combo porque a matriz de fornecimento
  // está incompleta seria pior.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch('/admin/combos/pricing')
        if (res.ok && !cancelled) setPricing((await res.json()) as Pricing)
      } catch {
        /* silencioso — só a prévia de margem deixa de aparecer */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSalvar = async () => {
    setError(null)
    setIsSaving(true)
    try {
      const body = {
        name: nome.trim(),
        quantity: Number(quantidade),
        price: Number(preco),
        ...(subtitulo.trim() ? { description: subtitulo.trim() } : {}),
        ...(tag.trim() ? { tag: tag.trim() } : {}),
      }
      const res = await apiFetch(id ? `/admin/combos/${id}` : '/admin/combos', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      })
      if (res.ok) {
        onSaved()
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        setError(err?.error ?? 'Não foi possível salvar. Tente novamente.')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  const isValid =
    nome.trim() !== '' && Number(quantidade) > 0 && Number(preco) > 0

  // ── Margem ao vivo (D1) ──────────────────────────────────────────────────
  // A mesma conta que `lib/combo-pricing.ts` faz no servidor. Aqui ela roda a cada tecla, que é o
  // ponto: margem se perde no CADASTRO, não no relatório.
  const qtdNum = Number(quantidade)
  const precoNum = Number(preco)
  const margem =
    pricing?.breadUnitCost != null && qtdNum > 0 && precoNum > 0
      ? (() => {
          const custo = Math.round(qtdNum * pricing.breadUnitCost! * 100) / 100
          const lucro = Math.round((precoNum - custo) * 100) / 100
          return {
            custo,
            lucro,
            pct: Math.round((lucro / precoNum) * 1000) / 10,
            porPao: Math.round((precoNum / qtdNum) * 100) / 100,
            abaixoDoCusto: precoNum < custo,
          }
        })()
      : null

  // Economia vs. avulso — o mesmo número que o cliente vê no card, exibido aqui para o admin não
  // precificar um combo que sai MAIS CARO que comprar avulso.
  const economia =
    pricing && pricing.avulsoUnit > 0 && qtdNum > 0 && precoNum > 0
      ? Math.round((pricing.avulsoUnit * qtdNum - precoNum) * 100) / 100
      : null

  if (isLoading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
          Carregando...
        </span>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* AppBar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 20px 14px',
        }}
      >
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
          {id ? 'Editar combo' : 'Novo combo'}
        </h2>
      </div>

      {/* Campos */}
      <div
        style={{
          overflow: 'auto',
          flex: 1,
          padding: '0 20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <FormField
          label="Nome do combo"
          icon="bag"
          value={nome}
          onChange={setNome}
          placeholder="Ex.: Combo da semana"
        />

        <FormField
          label="Subtítulo (opcional)"
          icon="bag"
          value={subtitulo}
          onChange={setSubtitulo}
          placeholder="Ex.: O equilíbrio da casa"
        />

        <FormField
          label="Quantidade de pães"
          icon="bag"
          type="number"
          value={quantidade}
          onChange={setQuantidade}
          placeholder="Ex.: 10"
        />

        <FormField
          label="Preço (R$)"
          icon="coin"
          type="number"
          value={preco}
          onChange={setPreco}
          placeholder="Ex.: 25.90"
          step="0.01"
        />

        {/* Precificação assistida (D1) — logo abaixo do preço, porque é ali que a decisão é
            tomada. Um painel no fim da tela seria lido depois de o preço já estar escolhido. */}
        {margem && (
          <div
            style={{
              background: margem.abaixoDoCusto
                ? 'var(--color-gold-soft)'
                : 'var(--color-surface-alt, #FBF6EC)',
              border: `1.5px solid ${margem.abaixoDoCusto ? 'var(--color-warn)' : 'var(--color-border)'}`,
              borderRadius: 14,
              padding: '13px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 9,
              marginTop: -4,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-sec)' }}>
                Margem deste combo
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 17,
                  fontWeight: 800,
                  color: margem.abaixoDoCusto
                    ? 'var(--color-warn)'
                    : margem.pct < MARGIN_FLOOR_PCT
                      ? '#8A6A00'
                      : 'var(--color-good)',
                }}
              >
                {fmtBRL(margem.lucro)} · {margem.pct.toFixed(1).replace('.', ',')}%
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
              <PricingHint label="Custo dos pães" value={fmtBRL(margem.custo)} />
              <PricingHint label="Preço por pãozinho" value={fmtBRL(margem.porPao)} />
              {economia != null && (
                <PricingHint
                  label={economia > 0 ? 'Economia vs. avulso' : 'Mais caro que o avulso'}
                  value={fmtBRL(Math.abs(economia))}
                />
              )}
            </div>

            {margem.abaixoDoCusto ? (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 700, color: 'var(--color-warn)', margin: 0, lineHeight: 1.4 }}>
                ⚠ O preço não cobre nem o custo do pão ({fmtBRL(margem.custo)}). Dá para salvar — só
                não passe despercebido.
              </p>
            ) : margem.pct < MARGIN_FLOOR_PCT ? (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 700, color: '#8A6A00', margin: 0, lineHeight: 1.4 }}>
                Margem abaixo de {MARGIN_FLOOR_PCT}%. Ainda não entram aqui entrega, embalagem nem
                taxa de gateway.
              </p>
            ) : (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: 0, lineHeight: 1.4 }}>
                Margem de contribuição: preço − custo do pão. Entrega, embalagem e taxa de gateway
                ainda saem daqui.
              </p>
            )}

            {economia != null && economia <= 0 && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 700, color: 'var(--color-warn)', margin: 0, lineHeight: 1.4 }}>
                ⚠ Este combo custa mais que comprar {quantidade} pães no avulso. O cliente não tem
                motivo para escolhê-lo.
              </p>
            )}
          </div>
        )}

        {pricing && pricing.breadUnitCost == null && Number(preco) > 0 && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-ter)', margin: '-6px 2px 0', lineHeight: 1.4 }}>
            Sem custo de pão cadastrado na matriz de fornecimento — a margem não pode ser calculada.
            Cadastre um fornecedor ativo para o pão em Gestão › Fornecedores.
          </p>
        )}

        <FormField
          label="Tag (opcional)"
          icon="percent"
          value={tag}
          onChange={setTag}
          placeholder="ex: Mais popular"
        />

        {/* Espaço flexível */}
        <div style={{ flex: 1 }} />

        {/* Erro */}
        {error && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-accent)',
              margin: 0,
            }}
          >
            {error}
          </p>
        )}

        {/* Botão salvar */}
        <button
          type="button"
          onClick={() => void handleSalvar()}
          disabled={!isValid || isSaving}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            minHeight: 52,
            background: 'var(--color-espresso)',
            color: '#FAF5EC',
            border: 'none',
            borderRadius: 16,
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            fontWeight: 700,
            cursor: !isValid || isSaving ? 'default' : 'pointer',
            opacity: !isValid || isSaving ? 0.5 : 1,
            letterSpacing: '-0.01em',
          }}
        >
          {isSaving ? 'Salvando...' : 'Salvar combo'}
        </button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ PricingHint
/** Par "rótulo · valor" da faixa de precificação assistida. */
function PricingHint({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', fontWeight: 600 }}>
      {label}{' '}
      <strong style={{ color: 'var(--color-text-sec)', fontWeight: 700 }}>{value}</strong>
    </span>
  )
}

// ------------------------------------------------------------------ FormField
interface FormFieldProps {
  label: string
  icon: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  step?: string
}

function FormField({ label, icon, value, onChange, placeholder, type = 'text', step }: FormFieldProps) {
  const [focused, setFocused] = useState(false)

  return (
    <label style={{ display: 'block' }}>
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12.5,
          fontWeight: 700,
          color: 'var(--color-text-sec)',
          letterSpacing: '0.01em',
          marginBottom: 7,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--color-surface-alt, #FBF6EC)',
          border: `1.5px solid ${focused ? 'var(--color-accent)' : 'var(--color-border)'}`,
          borderRadius: 14,
          padding: '12px 14px',
          transition: 'border-color 0.15s ease',
        }}
      >
        <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={18} color="var(--color-text-ter)" />
        <input
          type={type}
          value={value}
          step={step}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 500,
            color: 'var(--color-text)',
            minWidth: 0,
          }}
        />
      </div>
    </label>
  )
}
