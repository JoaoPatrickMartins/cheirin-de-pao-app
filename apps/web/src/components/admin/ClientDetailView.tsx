import { useState, useEffect } from 'react'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../brand/Icon'

// ------------------------------------------------------------------ tipos
interface ClienteSchedule {
  weeklyQty: Record<string, number>
  deliveryTime?: string
  isActive?: boolean
}

interface ClienteOrder {
  scheduledDate: string
  quantity: number
  status: string
}

interface ClienteDetalhe {
  id: string
  name: string
  phone?: string
  email?: string
  condominiumId: string
  apartment: string
  block?: string
  creditBalance: number
  isBlocked: boolean
  schedule?: ClienteSchedule | null
  recentOrders?: ClienteOrder[]
}

interface ClientDetailViewProps {
  clienteId: string
  onBack: () => void
}

// ------------------------------------------------------------------ helpers
const DIAS_PT: Record<string, string> = {
  MON: 'Seg',
  TUE: 'Ter',
  WED: 'Qua',
  THU: 'Qui',
  FRI: 'Sex',
  SAT: 'Sáb',
  SUN: 'Dom',
}

function formatDataLonga(iso?: string | null): string {
  if (!iso) return 'Sem compras'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}

function resumoAgendamento(schedule?: ClienteSchedule | null): string {
  if (!schedule || !schedule.isActive) return 'Sem agendamento'
  const entries = Object.entries(schedule.weeklyQty).filter(([, qty]) => qty > 0)
  if (entries.length === 0) return 'Sem agendamento'
  const dias = entries.map(([dia]) => DIAS_PT[dia] ?? dia).join(', ')
  const qtdExemplo = entries[0][1]
  return `${dias} — ${qtdExemplo} pão${qtdExemplo !== 1 ? 's' : ''}`
}

function iniciais(nome: string): string {
  return nome
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

// ------------------------------------------------------------------ componente
export function ClientDetailView({ clienteId, onBack }: ClientDetailViewProps) {
  const [cliente, setCliente] = useState<ClienteDetalhe | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isBlocking, setIsBlocking] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [blockError, setBlockError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCliente = async () => {
      try {
        const res = await apiFetch(`/admin/clients/${clienteId}`)
        if (res.ok) {
          setCliente((await res.json()) as ClienteDetalhe)
        }
      } catch {
        // falha silenciosa
      } finally {
        setIsLoading(false)
      }
    }
    void fetchCliente()
  }, [clienteId])

  async function handleConfirmarBloqueio() {
    if (!cliente || isBlocking) return
    setIsBlocking(true)
    setBlockError(null)
    try {
      const res = await apiFetch(`/admin/clients/${cliente.id}/block`, {
        method: 'PATCH',
      })
      if (res.ok) {
        const updated = (await res.json()) as { id: string; isBlocked: boolean }
        setCliente((prev) => prev ? { ...prev, isBlocked: updated.isBlocked } : prev)
        setShowDialog(false)
      } else {
        setBlockError('Não foi possível alterar. Tente novamente.')
      }
    } catch {
      setBlockError('Não foi possível alterar. Tente novamente.')
    } finally {
      setIsBlocking(false)
    }
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        paddingBottom: 32,
        background: 'var(--color-app-bg)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
      }}
    >
      {/* AppBar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '14px 20px 10px',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          aria-label="Voltar"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px 8px 8px 0',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--color-text)',
            minHeight: 44,
          }}
        >
          <Icon name="arrowL" size={22} stroke={2} color="var(--color-text)" />
        </button>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
            margin: 0,
          }}
        >
          Cliente
        </h1>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '60px 20px',
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
      ) : !cliente ? (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              color: 'var(--color-text-sec)',
            }}
          >
            Falha na conexão. Tente novamente.
          </p>
        </div>
      ) : (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Card de avatar */}
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: 22,
              border: '1px solid var(--color-border-2)',
              padding: '20px 16px',
              textAlign: 'center',
            }}
          >
            {/* Avatar circular */}
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'var(--color-surface-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                color: 'var(--color-accent)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 20,
                  fontWeight: 700,
                  color: 'var(--color-accent)',
                }}
              >
                {iniciais(cliente.name)}
              </span>
            </div>

            {/* Nome */}
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--color-text)',
                margin: '0 0 4px',
                letterSpacing: '-0.02em',
              }}
            >
              {cliente.name}
            </p>

            {/* Condomínio + apto */}
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                color: 'var(--color-text-sec)',
                margin: '0 0 10px',
              }}
            >
              {cliente.block ? `Bl ${cliente.block} · ` : ''}Ap {cliente.apartment}
            </p>

            {/* Pill bloqueado */}
            {cliente.isBlocked && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'var(--color-gold-soft)',
                  border: '1px solid var(--color-border-2)',
                  borderRadius: 999,
                  padding: '4px 10px',
                }}
              >
                <Icon name="ban" size={13} stroke={2} color="var(--color-accent)" aria-hidden="true" />
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--color-accent)',
                  }}
                >
                  Bloqueado
                </span>
              </div>
            )}
          </div>

          {/* Card de dados (Rows) */}
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: 22,
              border: '1px solid var(--color-border-2)',
              overflow: 'hidden',
            }}
          >
            {/* Row saldo */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
              }}
            >
              <Icon name="wallet" size={20} stroke={1.9} color="var(--color-accent)" aria-hidden="true" />
              <span
                style={{
                  flex: 1,
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--color-text-sec)',
                }}
              >
                Saldo de créditos
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--color-text)',
                }}
              >
                {cliente.creditBalance} pães
              </span>
            </div>

            {/* Separador */}
            <div style={{ height: 1, background: 'var(--color-border-2)' }} />

            {/* Row última compra */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
              }}
            >
              <Icon name="clock" size={20} stroke={1.9} color="var(--color-accent)" aria-hidden="true" />
              <span
                style={{
                  flex: 1,
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--color-text-sec)',
                }}
              >
                Última compra
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  textAlign: 'right',
                  maxWidth: 140,
                }}
              >
                {formatDataLonga(
                  cliente.recentOrders && cliente.recentOrders.length > 0
                    ? cliente.recentOrders[0].scheduledDate
                    : null,
                )}
              </span>
            </div>

            {/* Separador */}
            <div style={{ height: 1, background: 'var(--color-border-2)' }} />

            {/* Row agendamento */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
              }}
            >
              <Icon name="calendar" size={20} stroke={1.9} color="var(--color-accent)" aria-hidden="true" />
              <span
                style={{
                  flex: 1,
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--color-text-sec)',
                }}
              >
                Agendamento
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  textAlign: 'right',
                  maxWidth: 160,
                }}
              >
                {resumoAgendamento(cliente.schedule)}
              </span>
            </div>
          </div>

          {/* Nota somente leitura */}
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              color: 'var(--color-text-ter)',
              lineHeight: 1.5,
              margin: 0,
              marginBottom: 14,
            }}
          >
            O admin apenas visualiza os dados do cliente — não edita o cadastro.
          </p>

          {/* Botão bloquear / desbloquear */}
          <button
            onClick={() => setShowDialog(true)}
            disabled={isBlocking}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '14px 20px',
              borderRadius: 16,
              border: cliente.isBlocked
                ? 'none'
                : '1.5px solid var(--color-border)',
              background: cliente.isBlocked ? 'var(--color-gold)' : 'transparent',
              color: cliente.isBlocked ? '#1E1207' : 'var(--color-text)',
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              fontWeight: 700,
              cursor: isBlocking ? 'wait' : 'pointer',
              opacity: isBlocking ? 0.6 : 1,
              minHeight: 44,
            }}
          >
            <Icon
              name={cliente.isBlocked ? 'check' : 'ban'}
              size={18}
              stroke={2}
              color={cliente.isBlocked ? '#1E1207' : 'var(--color-text)'}
              aria-hidden="true"
            />
            {cliente.isBlocked ? 'Desbloquear cliente' : 'Bloquear cliente'}
          </button>

          {/* Erro de bloqueio */}
          {blockError && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                color: 'var(--color-warn)',
                margin: 0,
                textAlign: 'center',
              }}
            >
              {blockError}
            </p>
          )}
        </div>
      )}

      {/* Dialog de confirmação */}
      {showDialog && cliente && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 100,
            padding: '0 0 env(safe-area-inset-bottom, 0px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDialog(false)
          }}
        >
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: '20px 20px 0 0',
              padding: '24px 20px 32px',
              width: '100%',
              maxWidth: 480,
            }}
          >
            <h2
              id="dialog-title"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--color-text)',
                margin: '0 0 8px',
                letterSpacing: '-0.02em',
              }}
            >
              {cliente.isBlocked
                ? `Desbloquear ${cliente.name}?`
                : `Bloquear ${cliente.name}?`}
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                color: 'var(--color-text-sec)',
                margin: '0 0 24px',
                lineHeight: 1.5,
              }}
            >
              {cliente.isBlocked
                ? 'O cliente voltará a poder fazer pedidos e acessar o app.'
                : 'O cliente não poderá fazer pedidos ou acessar o app.'}
            </p>

            {/* Erro dentro do dialog */}
            {blockError && (
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  color: 'var(--color-warn)',
                  margin: '0 0 12px',
                  textAlign: 'center',
                }}
              >
                {blockError}
              </p>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              {/* Cancelar */}
              <button
                onClick={() => { setShowDialog(false); setBlockError(null) }}
                style={{
                  flex: 1,
                  padding: '13px 0',
                  borderRadius: 14,
                  border: '1.5px solid var(--color-border)',
                  background: 'transparent',
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                  minHeight: 44,
                }}
              >
                Cancelar
              </button>

              {/* Confirmar */}
              <button
                onClick={() => { void handleConfirmarBloqueio() }}
                disabled={isBlocking}
                style={{
                  flex: 1,
                  padding: '13px 0',
                  borderRadius: 14,
                  border: 'none',
                  background: cliente.isBlocked
                    ? 'var(--color-gold)'
                    : 'var(--color-accent)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  fontWeight: 700,
                  color: cliente.isBlocked ? '#1E1207' : '#FFFFFF',
                  cursor: isBlocking ? 'wait' : 'pointer',
                  opacity: isBlocking ? 0.6 : 1,
                  minHeight: 44,
                }}
              >
                {isBlocking ? '...' : cliente.isBlocked ? 'Confirmar' : 'Confirmar bloqueio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
