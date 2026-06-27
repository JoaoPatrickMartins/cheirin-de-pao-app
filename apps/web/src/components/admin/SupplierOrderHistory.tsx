import { useState, useEffect } from 'react'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../brand/Icon'

interface SupplierOrder {
  id: string
  date: string
  slotLabel?: string
  totalQuantity: number
  status: string
  cutoffTime?: string
  createdAt?: string
}

function formatDateLong(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch {
    return dateStr
  }
}

/**
 * Histórico de pedidos de compra ao fornecedor (PurchaseOrder FINALIZED).
 * Mora na aba Compra — antes ficava (indevidamente) na aba Entregas.
 */
export function SupplierOrderHistory({ onBack }: { onBack: () => void }) {
  const [orders, setOrders] = useState<SupplierOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch('/admin/supplier-orders')
        if (res.ok) setOrders((await res.json()) as SupplierOrder[])
      } catch {
        /* silencioso */
      } finally {
        setIsLoading(false)
      }
    })()
  }, [])

  async function download(id: string, kind: 'pdf' | 'excel') {
    setDownloading(`${id}:${kind}`)
    try {
      const res = await apiFetch(`/admin/supplier-orders/${id}/${kind}`)
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pedido-compra-${id}.${kind === 'pdf' ? 'pdf' : 'xlsx'}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 24 }}>
      {/* Header com voltar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px 8px' }}>
        <button
          onClick={onBack}
          aria-label="Voltar"
          style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <Icon name="chevL" size={20} color="var(--color-text)" stroke={2} />
        </button>
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>Histórico de compras</p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-ter)', margin: '2px 0 0' }}>Pedidos ao fornecedor finalizados</p>
        </div>
      </div>

      <div style={{ padding: '8px 20px 0' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : orders.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--color-text-sec)', textAlign: 'center', padding: '40px 0' }}>
            Nenhum pedido de compra finalizado ainda.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {orders.map((o) => (
              <div key={o.id} style={{ background: 'var(--color-surface)', borderRadius: 18, padding: 15, border: '1px solid var(--color-border-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name="factory" size={20} color="var(--color-accent)" stroke={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                      {formatDateLong(o.date)}{o.slotLabel ? ` · ${o.slotLabel}` : ''}
                    </p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '3px 0 0' }}>{o.totalQuantity} pães</p>
                  </div>
                  <span style={{ padding: '3px 8px', borderRadius: 99, background: 'var(--color-good-soft)', color: 'var(--color-good)', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700 }}>
                    Finalizado
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <DownloadBtn label={downloading === `${o.id}:pdf` ? '...' : 'PDF'} onClick={() => download(o.id, 'pdf')} />
                  <DownloadBtn label={downloading === `${o.id}:excel` ? '...' : 'Excel'} onClick={() => download(o.id, 'excel')} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function DownloadBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '7px 14px',
        borderRadius: 999,
        border: '1.5px solid var(--color-border)',
        background: 'none',
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        fontSize: 13,
        color: 'var(--color-text)',
        cursor: 'pointer',
      }}
    >
      <Icon name="download" size={15} color="var(--color-text-sec)" stroke={2} />
      {label}
    </button>
  )
}
