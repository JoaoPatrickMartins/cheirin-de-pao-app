import { formatCredits, toMilli } from '@cheirin-de-pao/shared'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { useCreditBalanceSync } from '../../hooks/useCreditBalanceSync'
import { useReferralSummary } from '../../hooks/useReferralSummary'
import { apiFetch } from '../../lib/apiFetch'
import { Icon, type Ic } from '../../components/brand/Icon'

interface CreditTransaction {
  id: string
  type: string
  quantity: number // com sinal: positivo = entrada, negativo = saída
  description?: string | null
  createdAt: string
}

// Rótulo amigável por tipo, usado quando a transação não tem `description`
const TYPE_LABEL: Record<string, string> = {
  PURCHASE: 'Compra de pãezins',
  DELIVERY: 'Entrega',
  REFUND: 'Estorno',
  EXPIRY: 'Expiração',
  ADMIN_GRANT: 'Pãezins concedidos',
  ADMIN_DEBIT: 'Ajuste de saldo',
  DELIVERY_DONE: 'Entrega realizada',
  // Cestinha (Além do Pãozin): o débito ao pagar em pãezins e a devolução no cancelamento.
  MARKET_PURCHASE: 'Cestinha — Além do Pãozin',
  MARKET_REFUND: 'Cestinha cancelada — pãezins devolvidos',
}

/**
 * Visual do extrato conforme o handoff do Indique e Ganhe (C7) — SÓ front (D-17): a API
 * `/credits/history` é a mesma de antes. Ícone e título saem do tipo; a `description` gravada no
 * lançamento vai para a 2ª linha. O detalhe do pagamento na compra ("Combo 30 · Pix") ficou de
 * fora: exigiria mudar a API.
 */
const TYPE_ROW: Record<string, { icon: keyof typeof Ic; title: string; bonus?: boolean }> = {
  PURCHASE: { icon: 'coin', title: 'Compra de pãezins' },
  DELIVERY: { icon: 'truck', title: 'Entrega' },
  DELIVERY_DONE: { icon: 'truck', title: 'Entrega realizada' },
  REFUND: { icon: 'refresh', title: 'Estorno' },
  EXPIRY: { icon: 'clock', title: 'Expiração' },
  ADMIN_GRANT: { icon: 'coin', title: 'Pãezins concedidos' },
  ADMIN_DEBIT: { icon: 'edit', title: 'Ajuste de saldo' },
  MARKET_PURCHASE: { icon: 'basket', title: 'Cestinha' },
  MARKET_REFUND: { icon: 'basket', title: 'Cestinha cancelada' },
  REFERRAL_BONUS: { icon: 'gift', title: 'Indique e ganhe', bonus: true },
  REFERRAL_WELCOME: { icon: 'gift', title: 'Boas-vindas por indicação', bonus: true },
  REFERRAL_GOAL: { icon: 'star', title: 'Meta de indicações', bonus: true },
}

const BRT = 'America/Sao_Paulo'

/** Chave do dia BRT ("2026-09-27") — o agrupamento é pelo dia de quem lê, não pelo UTC. */
function brtDayKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BRT, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** "Hoje" ou "Sáb, 27/09". */
function dayLabel(d: Date, todayKey: string): string {
  if (brtDayKey(d) === todayKey) return 'Hoje'
  const weekday = new Intl.DateTimeFormat('pt-BR', { timeZone: BRT, weekday: 'short' }).format(d).replace('.', '')
  const dm = new Intl.DateTimeFormat('pt-BR', { timeZone: BRT, day: '2-digit', month: '2-digit' }).format(d)
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${dm}`
}

/** Título da linha. A meta ganha o número dela ("Meta de 5 indicações"), lido da descrição. */
function rowTitle(tx: CreditTransaction): string {
  if (tx.type === 'REFERRAL_GOAL') {
    const n = tx.description?.match(/(\d+)ª/)?.[1]
    return n ? `Meta de ${n} indicações` : TYPE_ROW.REFERRAL_GOAL.title
  }
  return TYPE_ROW[tx.type]?.title ?? TYPE_LABEL[tx.type] ?? 'Movimentação'
}

export function CreditHistoryScreen() {
  const navigate = useNavigate()
  const { token, user } = useAuth()
  // Saldo do cabeçalho: o que o app já sincroniza (sem API nova — D-17).
  useCreditBalanceSync()
  const { summary: referral } = useReferralSummary()
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    const fetchHistory = async () => {
      try {
        const res = await apiFetch('/credits/history')
        if (res.ok) {
          const data = (await res.json()) as CreditTransaction[]
          setTransactions(data)
        } else {
          setError('Não foi possível carregar o extrato.')
        }
      } catch {
        setError('Erro de conexão. Tente novamente.')
      } finally {
        setIsLoading(false)
      }
    }
    void fetchHistory()
  }, [token])

  const formatTime = (d: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: BRT, hour: '2-digit', minute: '2-digit' }).format(d)

  // Grupos por dia BRT, na ordem que a API já manda (mais recente primeiro).
  const todayKey = brtDayKey(new Date())
  const groups: Array<{ key: string; label: string; items: CreditTransaction[] }> = []
  for (const tx of transactions) {
    const d = new Date(tx.createdAt)
    const key = brtDayKey(d)
    const last = groups[groups.length - 1]
    if (last?.key === key) last.items.push(tx)
    else groups.push({ key, label: dayLabel(d, todayKey), items: [tx] })
  }
  const bonusThisMonth = referral?.bonusThisMonth ?? 0

  return (
    <div
      style={{
        minHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom))',
        background: 'var(--color-app-bg)',
      }}
    >
      {/* AppBar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 20px 14px',
          gap: 12,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: 'var(--color-surface-2)',
            border: 'none',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon name="arrowL" size={20} />
        </button>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 21,
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          Extrato de pãezins
        </h1>
      </div>

      {/* Content */}
      <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Cabeçalho espresso com o saldo (C7) */}
        <div
          style={{
            background: 'var(--color-espresso)',
            borderRadius: 22,
            padding: '16px 18px',
            color: 'var(--color-app-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: 'var(--color-gold)' }}>
              SALDO
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, letterSpacing: '-0.03em', marginTop: 4 }}>
              {formatCredits(toMilli(user?.creditBalance ?? 0))}{' '}
              <span style={{ fontSize: 16, fontWeight: 700, color: 'rgba(250,245,236,0.7)' }}>
                {toMilli(user?.creditBalance ?? 0) === 1000 ? 'pãozin' : 'pãezins'}
              </span>
            </div>
          </div>
          {bonusThisMonth > 0 && (
            <div style={{ textAlign: 'right', fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(250,245,236,0.7)', lineHeight: 1.4 }}>
              Bônus de indicação
              <br />
              <b style={{ color: 'var(--color-gold)', fontSize: 15 }}>+{formatCredits(toMilli(bonusThisMonth))} este mês</b>
            </div>
          )}
        </div>

        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                style={{
                  height: 64,
                  borderRadius: 'var(--radius-card)',
                  background: 'var(--color-surface-2)',
                }}
              />
            ))}
          </div>
        )}

        {error && (
          <p
            role="alert"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--color-accent)',
              textAlign: 'center',
            }}
          >
            {error}
          </p>
        )}

        {!isLoading && !error && transactions.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 10,
              marginTop: 40,
              padding: '0 24px',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--color-surface-2)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Icon name="coin" size={26} color="var(--color-accent)" />
            </div>
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 17,
                color: 'var(--color-text)',
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              Nada por aqui ainda
            </p>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13.5,
                color: 'var(--color-text-sec)',
                margin: 0,
                lineHeight: 1.45,
              }}
            >
              Suas compras e entregas de pãezins vão aparecer aqui assim que rolar a primeira. 🥖
            </p>
          </div>
        )}

        {!isLoading && !error && transactions.length > 0 && (
          <>
            {groups.map((g) => (
              <section key={g.key}>
                <h2
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    color: 'var(--color-text-ter)',
                    textTransform: 'uppercase',
                    margin: '0 4px 8px',
                  }}
                >
                  {g.label}
                </h2>
                <div
                  style={{
                    background: 'var(--color-surface)',
                    borderRadius: 22,
                    border: '1px solid var(--color-border-2)',
                    boxShadow: 'var(--shadow-soft)',
                    padding: '2px 14px',
                  }}
                >
                  {g.items.map((tx, i) => {
                    const isCredit = tx.quantity >= 0
                    const meta = TYPE_ROW[tx.type]
                    const bonus = !!meta?.bonus
                    const created = new Date(tx.createdAt)
                    return (
                      <div
                        key={tx.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px 0',
                          borderBottom: i < g.items.length - 1 ? '1px solid var(--color-border-2)' : 'none',
                        }}
                      >
                        <div
                          aria-hidden="true"
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 999,
                            background: bonus ? 'var(--color-gold-soft)' : 'var(--color-surface-2)',
                            color: bonus ? 'var(--color-accent)' : 'var(--color-text-sec)',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Icon name={meta?.icon ?? 'repeat'} size={19} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>
                              {rowTitle(tx)}
                            </span>
                            {bonus && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '2px 8px',
                                  borderRadius: 999,
                                  background: 'var(--color-gold-soft)',
                                  color: 'var(--color-accent)',
                                  fontFamily: 'var(--font-body)',
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                }}
                              >
                                Bônus
                              </span>
                            )}
                          </div>
                          <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-sec)', marginTop: 2 }}>
                            {tx.description || formatTime(created)}
                          </div>
                        </div>
                        <span
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontWeight: 800,
                            fontSize: 17,
                            flexShrink: 0,
                            color: !isCredit
                              ? 'var(--color-text-sec)'
                              : bonus
                                ? 'var(--color-accent)'
                                : 'var(--color-good)',
                          }}
                        >
                          {`${isCredit ? '+' : '−'}${formatCredits(toMilli(Math.abs(tx.quantity)))}`}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                color: 'var(--color-text-ter)',
                textAlign: 'center',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Pãezins de bônus não viram dinheiro e não expiram.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
