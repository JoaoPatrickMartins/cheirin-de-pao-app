import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'

/**
 * MarketPreparo — o que já está comprometido de cada produto, por dia (Onda G1).
 *
 * A Separação (Onda B1) responde "o que pegar da prateleira HOJE"; esta tela olha para frente, que é
 * a pergunta de quem PREPARA e COMPRA. Dois números por produto, de propósito:
 * `confirmado` (pedidos que existem de verdade — é por ele que se prepara) e `vagas` (capacidade do
 * dia, que inclui reservas aguardando pagamento — é por ele que se sabe se ainda dá para vender).
 */

interface OutlookProduct {
  productId: string
  productName: string
  stockType: string
  confirmed: number
  reserved: number | null
  capacity: number | null
  available: number | null
  stock: number | null
}

interface OutlookDay {
  date: string
  products: OutlookProduct[]
  totalItems: number
}

const DAY_OPTIONS = [3, 7, 14]

function fmtDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  // Meio-dia UTC evita o dia "voltar" um por causa do fuso na formatação.
  const date = new Date(Date.UTC(y, m - 1, d, 12))
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).format(date)
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-2)',
  borderRadius: 16,
  padding: 14,
}

export function MarketPreparo() {
  const [days, setDays] = useState(7)
  const [data, setData] = useState<OutlookDay[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const res = await apiFetch(`/admin/market/stock-outlook?days=${days}`)
        if (res.ok && !cancelled) {
          const json = (await res.json()) as { days: OutlookDay[] }
          setData(json.days)
        }
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [days])

  const comMovimento = (data ?? []).filter((d) => d.products.length > 0)

  return (
    <div style={{ padding: '0 20px 24px' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {DAY_OPTIONS.map((d) => {
          const active = d === days
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              style={{
                flex: 1,
                minHeight: 36,
                borderRadius: 11,
                border: active ? 'none' : '1px solid var(--color-border)',
                background: active ? 'var(--color-espresso)' : 'transparent',
                color: active ? '#FAF5EC' : 'var(--color-text-sec)',
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {d} dias
            </button>
          )
        })}
      </div>

      {loading && <div style={{ height: 80, borderRadius: 16, background: 'var(--color-surface-2)' }} />}

      {!loading && comMovimento.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '22px 14px' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--color-text-ter)', margin: 0 }}>
            Nenhum item do mercadinho comprometido nos próximos {days} dias.
          </p>
        </div>
      )}

      {!loading &&
        comMovimento.map((d) => (
          <div key={d.date} style={{ ...cardStyle, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 9 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                {fmtDay(d.date)}
              </p>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-ter)' }}>
                {d.totalItems} {d.totalItems === 1 ? 'item' : 'itens'} a preparar
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {d.products.map((p) => {
                const semVaga = p.available != null && p.available <= 0
                // `reserved − confirmed` é o que está preso em carrinho não pago: informação, não
                // inconsistência. Só aparece quando existe.
                const naoPago = p.reserved != null ? Math.max(0, p.reserved - p.confirmed) : 0
                return (
                  <div key={p.productId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-sec)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.productName}
                      </p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: semVaga ? 'var(--color-accent)' : 'var(--color-text-ter)', margin: 0 }}>
                        {p.stockType === 'FIXED'
                          ? `estoque ${p.stock ?? 0}`
                          : semVaga
                            ? `sem vagas (capacidade ${p.capacity})`
                            : `${p.available} vaga${p.available === 1 ? '' : 's'} de ${p.capacity}`}
                        {naoPago > 0 ? ` · ${naoPago} aguardando pagamento` : ''}
                      </p>
                    </div>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                      {p.confirmed}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

      {!loading && comMovimento.length > 0 && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: '4px 0 0', lineHeight: 1.45 }}>
          O número grande é o <strong>confirmado</strong> — prepare por ele. Cestinha aguardando
          pagamento ocupa vaga, mas pode cair no prazo de 30 min.
        </p>
      )}
    </div>
  )
}
