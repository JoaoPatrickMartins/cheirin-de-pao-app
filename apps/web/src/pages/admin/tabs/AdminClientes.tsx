import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { AdminHead } from '../../../components/admin/AdminHead'
import { Icon } from '../../../components/brand/Icon'
import { ClientDetailView } from '../../../components/admin/ClientDetailView'

// ------------------------------------------------------------------ tipos
interface Cliente {
  id: string
  name: string
  condominiumId: string
  apartment: string
  block?: string
  creditBalance: number
  isBlocked: boolean
  createdAt: string
  lastPurchaseAt?: string | null
}

interface Condo {
  id: string
  name: string
  type: string
  isActive: boolean
}

type AdminClientesSub = null | 'detalhe'

// ------------------------------------------------------------------ helpers
function formatDataCurta(iso?: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}

// ------------------------------------------------------------------ componente
export function AdminClientes() {
  const [sub, setSub] = useState<AdminClientesSub>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filtroCondominio, setFiltroCondominio] = useState<string | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [condominios, setCondominios] = useState<Condo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Buscar condomínios na montagem (apenas uma vez)
  useEffect(() => {
    const fetchCondos = async () => {
      try {
        const res = await apiFetch('/admin/condominiums')
        if (res.ok) {
          setCondominios((await res.json()) as Condo[])
        }
      } catch {
        // falha silenciosa
      }
    }
    void fetchCondos()
  }, [])

  // Buscar clientes sempre que filtroCondominio mudar
  useEffect(() => {
    setIsLoading(true)
    const fetchClientes = async () => {
      try {
        const url = filtroCondominio
          ? `/admin/clients?condominiumId=${filtroCondominio}`
          : '/admin/clients'
        const res = await apiFetch(url)
        if (res.ok) {
          setClientes((await res.json()) as Cliente[])
        }
      } catch {
        // falha silenciosa
      } finally {
        setIsLoading(false)
      }
    }
    void fetchClientes()
  }, [filtroCondominio])

  // Sub-tela: detalhe do cliente
  if (sub === 'detalhe' && selectedId) {
    return (
      <ClientDetailView
        clienteId={selectedId}
        onBack={() => {
          setSub(null)
          setSelectedId(null)
        }}
      />
    )
  }

  // Nome do condomínio a partir do id
  function nomeCondominio(condominiumId: string): string {
    const condo = condominios.find((c) => c.id === condominiumId)
    return condo?.name ?? '—'
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        paddingBottom: 24,
      }}
    >
      <AdminHead sub={`${clientes.length} cadastrados`} titulo="Clientes" />

      {/* ---- Chips de filtro ---- */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 4,
          padding: '0 20px 4px',
          scrollbarWidth: 'none',
        }}
      >
        {/* Chip "Todos" */}
        {[{ id: null, name: 'Todos' }, ...condominios].map((condo) => {
          const isAtivo = filtroCondominio === condo.id
          return (
            <button
              key={condo.id ?? '__todos__'}
              onClick={() => setFiltroCondominio(condo.id)}
              style={{
                padding: '8px 14px',
                borderRadius: 999,
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                flexShrink: 0,
                border: isAtivo
                  ? '1.5px solid var(--color-accent)'
                  : '1.5px solid var(--color-border)',
                background: isAtivo
                  ? 'var(--color-gold-soft)'
                  : 'var(--color-surface)',
                color: isAtivo
                  ? 'var(--color-accent)'
                  : 'var(--color-text-sec)',
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {condo.name}
            </button>
          )
        })}
      </div>

      {/* ---- Lista de clientes ---- */}
      <div
        style={{
          padding: '12px 20px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {isLoading ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '40px 0',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '3px solid var(--color-border)',
                borderTopColor: 'var(--color-accent)',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          </div>
        ) : clientes.length === 0 ? (
          /* Empty state */
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--color-text)',
                margin: '0 0 8px',
              }}
            >
              Nenhum cliente encontrado
            </p>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                color: 'var(--color-text-sec)',
                margin: 0,
              }}
            >
              Tente filtrar por outro condomínio.
            </p>
          </div>
        ) : (
          clientes.map((c) => {
            const condoNome = nomeCondominio(c.condominiumId)
            const ultimaCompra = c.lastPurchaseAt
              ? `últ. ${formatDataCurta(c.lastPurchaseAt)}`
              : 'sem compras'
            const linhaSecundaria = `${condoNome} · ${c.apartment}${c.block ? ` bl ${c.block}` : ''} · ${ultimaCompra}`

            return (
              <div
                key={c.id}
                onClick={() => {
                  setSelectedId(c.id)
                  setSub('detalhe')
                }}
                role="button"
                aria-label={`Ver detalhes de ${c.name}`}
                style={{
                  background: 'var(--color-surface)',
                  borderRadius: 18,
                  border: '1px solid var(--color-border-2)',
                  padding: 14,
                  cursor: 'pointer',
                  opacity: c.isBlocked ? 0.6 : 1,
                  transition: 'opacity 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: 'var(--color-surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: 'var(--color-accent)',
                  }}
                >
                  <Icon name="user" size={22} stroke={1.9} color="var(--color-accent)" />
                </div>

                {/* Textos */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 14.5,
                        fontWeight: 700,
                        color: 'var(--color-text)',
                      }}
                    >
                      {c.name}
                    </span>
                    {c.isBlocked && (
                      <Icon name="ban" size={14} stroke={1.9} color="var(--color-accent)" />
                    )}
                  </div>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 12,
                      color: 'var(--color-text-ter)',
                      margin: '2px 0 0',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {linhaSecundaria}
                  </p>
                </div>

                {/* Saldo */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 17,
                      fontWeight: 800,
                      color: c.creditBalance > 0
                        ? 'var(--color-text)'
                        : 'var(--color-text-ter)',
                      lineHeight: 1,
                    }}
                  >
                    {c.creditBalance}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 10.5,
                      color: 'var(--color-text-ter)',
                      marginTop: 2,
                    }}
                  >
                    créditos
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
