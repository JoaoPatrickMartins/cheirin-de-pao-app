import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../../components/brand/Icon'

// ------------------------------------------------------------------ tipos
type HookType = 'FREE' | 'PAID' | 'BONUS'
type HookStatus = 'PENDING_PAYMENT' | 'REQUESTED' | 'DELIVERED' | 'CANCELLED'

interface HookStatusResponse {
  hookPrice: number
  freeEligible: boolean
  hasHook: boolean
  needsConsent: boolean
  canRequestPaid: boolean
  current: {
    id: string
    type: HookType
    status: HookStatus
    reason: string | null
    requestedAt: string | null
    deliveredAt: string | null
    createdAt: string
  } | null
}

const REASONS: { id: string; label: string }[] = [
  { id: 'defeito', label: 'Veio com defeito' },
  { id: 'perda', label: 'Perdi / quebrou' },
]

// Suporte via WhatsApp — mesmo número do Perfil (VITE_SUPPORT_WHATSAPP). Gancho com defeito
// é resolvido pelo atendimento (troca sem custo), não pela cobrança.
const SUPPORT_WHATSAPP = ((import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined) ?? '5599999999999').replace(/\D/g, '')
const DEFECT_SUPPORT_URL = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent('Olá! Meu gancho do Cheirin de Pão veio com defeito e gostaria de solicitar a troca.')}`

// ------------------------------------------------------------------ helpers
function formatBRL(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
}

// ------------------------------------------------------------------ componente
export function HookScreen() {
  const navigate = useNavigate()
  const [data, setData] = useState<HookStatusResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fluxo de solicitação de gancho pago
  const [asking, setAsking] = useState(false)
  const [reasonId, setReasonId] = useState<string>('defeito')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/client/hook-request')
      if (res.ok) {
        const json = (await res.json()) as HookStatusResponse
        setData(json)
      }
    } catch {
      // falha silenciosa — a tela mostra o estado de carregamento/indisponível
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleRequestPaid = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const reasonLabel = REASONS.find((r) => r.id === reasonId)?.label ?? reasonId
      const res = await apiFetch('/client/hook-request/paid', {
        method: 'POST',
        body: JSON.stringify({ reason: reasonLabel }),
      })
      if (res.status === 201) {
        const pix = (await res.json()) as {
          paymentId: string
          pixCopyPaste: string
          pixQrCodeUrl: string
        }
        navigate('/client/creditos/pix', {
          state: {
            paymentId: pix.paymentId,
            pixQrCodeUrl: pix.pixQrCodeUrl,
            pixCopyPaste: pix.pixCopyPaste,
            comboQuantity: 0,
            hookPurpose: true,
          },
        })
        return
      }
      const err = (await res.json().catch(() => null)) as { error?: string } | null
      setError(err?.error ?? 'Não foi possível iniciar o pagamento. Tente novamente.')
    } catch {
      setError('Falha na conexão. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  // Confirmar: gancho com defeito vai pro suporte (troca sem custo); perda/quebra cobra via Pix.
  const handleConfirm = () => {
    if (reasonId === 'defeito') {
      window.open(DEFECT_SUPPORT_URL, '_blank', 'noopener,noreferrer')
      return
    }
    void handleRequestPaid()
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-app-bg)', display: 'flex', flexDirection: 'column' }}>
      {/* AppBar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '6px 20px 14px',
          paddingTop: 'calc(6px + env(safe-area-inset-top))',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            border: 'none',
            background: 'var(--color-surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon name="arrowL" size={20} color="var(--color-text)" />
        </button>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 21,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
            margin: 0,
          }}
        >
          Meu gancho
        </h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>Carregando...</span>
          </div>
        ) : !data ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-sec)', textAlign: 'center', paddingTop: 40 }}>
            Não foi possível carregar o status do gancho.
          </p>
        ) : (
          <>
            <StatusCard data={data} />

            {/* Ação: solicitar gancho pago (reposição) */}
            {data.canRequestPaid && !asking && (
              <button
                onClick={() => setAsking(true)}
                style={{
                  width: '100%',
                  minHeight: 52,
                  borderRadius: 'var(--radius-btn)',
                  border: 'none',
                  background: 'var(--color-espresso)',
                  color: 'var(--color-primary-btn-text)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 15.5,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Icon name="pin" size={20} color="var(--color-primary-btn-text)" />
                Solicitar novo gancho
              </button>
            )}

            {data.canRequestPaid && asking && (
              <RequestForm
                price={data.hookPrice}
                reasonId={reasonId}
                onReason={setReasonId}
                submitting={submitting}
                error={error}
                onCancel={() => {
                  setAsking(false)
                  setError(null)
                }}
                onConfirm={handleConfirm}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ StatusCard
function StatusCard({ data }: { data: HookStatusResponse }) {
  const c = data.current

  let icon: Parameters<typeof Icon>[0]['name'] = 'pin'
  let title: string
  let body: string
  let tint = 'var(--color-gold-soft)'
  let tintFg = 'var(--color-accent)'

  if (!data.hasHook) {
    if (data.freeEligible) {
      icon = 'gift'
      title = 'Você tem direito a um gancho grátis!'
      body = 'Confirme o recebimento pelo aviso do app para começarmos a pendurar seus pães na porta.'
    } else {
      icon = 'gift'
      title = 'Ganhe um gancho grátis'
      body = 'Ao comprar um combo — ou fazer um pedido único maior — você recebe, de graça, o gancho de porta onde deixamos seus pães fresquinhos toda manhã.'
      tint = 'var(--color-surface-2)'
      tintFg = 'var(--color-accent)'
    }
  } else if (c?.status === 'PENDING_PAYMENT') {
    icon = 'clock'
    title = 'Aguardando pagamento'
    body = 'Assim que o pagamento do seu gancho for confirmado, ele entra na fila de entrega.'
  } else if (c?.status === 'REQUESTED') {
    icon = 'clock'
    title = 'Seu gancho está a caminho'
    body =
      c.type === 'BONUS'
        ? 'Um gancho de cortesia foi liberado para você e será entregue na sua porta em breve.'
        : 'Já anotamos o pedido do seu gancho. Vamos deixá-lo na sua porta em breve.'
  } else if (c?.status === 'DELIVERED') {
    icon = 'check'
    title = 'Gancho entregue'
    body = c.deliveredAt
      ? `Entregamos seu gancho em ${formatDate(c.deliveredAt)}. Precisando repor por defeito ou perda, é só solicitar um novo.`
      : 'Seu gancho já foi entregue. Precisando repor por defeito ou perda, é só solicitar um novo.'
    tint = 'var(--color-good-soft)'
    tintFg = 'var(--color-good)'
  } else {
    icon = 'pin'
    title = 'Gancho de porta'
    body = 'Acompanhe aqui o status do seu gancho.'
  }

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 18,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: tint,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name={icon} size={24} color={tintFg} />
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 17,
            fontWeight: 700,
            color: 'var(--color-text)',
            letterSpacing: '-0.01em',
            margin: 0,
            lineHeight: 1.25,
          }}
        >
          {title}
        </h2>
      </div>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, lineHeight: 1.5, color: 'var(--color-text-sec)', margin: 0 }}>
        {body}
      </p>
    </div>
  )
}

// ------------------------------------------------------------------ RequestForm
interface RequestFormProps {
  price: number
  reasonId: string
  onReason: (id: string) => void
  submitting: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}

function RequestForm({ price, reasonId, onReason, submitting, error, onCancel, onConfirm }: RequestFormProps) {
  const isDefect = reasonId === 'defeito'
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 18,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
          Solicitar novo gancho
        </h3>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-sec)', margin: '4px 0 0', lineHeight: 1.5 }}>
          {isDefect ? (
            <>Gancho com defeito a gente troca <strong style={{ color: 'var(--color-text)' }}>sem custo</strong> — é só falar com o suporte. Conta pra gente o motivo:</>
          ) : (
            <>Um novo gancho custa <strong style={{ color: 'var(--color-text)' }}>{formatBRL(price)}</strong>, pago via Pix. Conta pra gente o motivo:</>
          )}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {REASONS.map((r) => {
          const active = reasonId === r.id
          return (
            <button
              key={r.id}
              onClick={() => onReason(r.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                minHeight: 46,
                padding: '0 14px',
                borderRadius: 12,
                cursor: 'pointer',
                textAlign: 'left',
                border: active ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border-2)',
                background: active ? 'var(--color-gold-soft)' : 'transparent',
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                fontWeight: 600,
                color: active ? 'var(--color-accent)' : 'var(--color-text)',
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: active ? '5px solid var(--color-accent)' : '2px solid var(--color-border)',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                }}
              />
              {r.label}
            </button>
          )
        })}
      </div>

      {error && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600, color: 'var(--color-destructive)', margin: 0 }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onCancel}
          disabled={submitting}
          style={{
            flex: 1,
            minHeight: 48,
            borderRadius: 'var(--radius-btn)',
            border: '1.5px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 14.5,
            cursor: submitting ? 'default' : 'pointer',
          }}
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          disabled={submitting}
          style={{
            flex: 1.4,
            minHeight: 48,
            borderRadius: 'var(--radius-btn)',
            border: 'none',
            background: 'var(--color-espresso)',
            color: 'var(--color-primary-btn-text)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 14.5,
            cursor: submitting ? 'wait' : 'pointer',
            opacity: submitting ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {isDefect ? (
            <>
              <Icon name="phone" size={18} color="var(--color-primary-btn-text)" />
              Falar com o suporte
            </>
          ) : submitting ? (
            'Gerando Pix...'
          ) : (
            `Pagar ${formatBRL(price)}`
          )}
        </button>
      </div>
    </div>
  )
}
