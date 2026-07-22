import { useState, useEffect } from 'react'
import type { CSSProperties, ReactNode, ComponentProps } from 'react'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../brand/Icon'
import { ConfirmSheet } from './ConfirmSheet'

type IconName = ComponentProps<typeof Icon>['name']

const GRANT_MOTIVOS = ['Acerto', 'Bonificação', 'Compensação', 'Promoção'] as const
const REMOVE_MOTIVOS = ['Estorno', 'Ajuste/Correção', 'Cancelamento', 'Uso indevido'] as const

// ------------------------------------------------------------------ tipos
interface ClienteSchedule {
  weeklyQty?: Record<string, number> | null
  days?: Record<string, Record<string, number>> | null
  deliveryTime?: string
  isActive?: boolean
}

interface ClienteOrder {
  id?: string
  scheduledDate: string
  quantity: number
  status: string
}

interface ClienteMetrics {
  totalSpent: number
  paymentsCount: number
  breadsDelivered: number
  deliveredOrders: number
  ordersCount: number
  weeklyBreads: number
}

interface ClienteDetalhe {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  cpf?: string | null
  birthDate?: string | null
  condominiumId?: string | null
  condominiumName?: string | null
  apartment?: string | null
  block?: string | null
  creditBalance: number
  isBlocked: boolean
  blockReason?: string | null
  blockedAt?: string | null
  blockedByName?: string | null
  createdAt?: string | null
  schedule?: ClienteSchedule | null
  recentOrders?: ClienteOrder[]
  metrics?: ClienteMetrics | null
}

interface Condo {
  id: string
  name: string
}

interface ClientDetailViewProps {
  clienteId: string
  onBack: () => void
}

// ------------------------------------------------------------------ helpers
const DIA_LABEL: Record<string, string> = {
  MON: 'Seg', TUE: 'Ter', WED: 'Qua', THU: 'Qui', FRI: 'Sex', SAT: 'Sáb', SUN: 'Dom',
  seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb', dom: 'Dom',
}
const DIA_ORDER = ['MON', 'seg', 'TUE', 'ter', 'WED', 'qua', 'THU', 'qui', 'FRI', 'sex', 'SAT', 'sab', 'SUN', 'dom']

function onlyDigits(v?: string | null): string {
  return (v ?? '').replace(/\D/g, '')
}

function formatCpf(cpf?: string | null): string {
  const d = onlyDigits(cpf)
  if (d.length !== 11) return cpf || '—'
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function localPhone(phone?: string | null): string {
  let d = onlyDigits(phone)
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
  return d
}

function formatPhoneDisplay(phone?: string | null): string {
  if (!phone) return '—'
  const n = localPhone(phone)
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`
  return phone
}

function whatsappLink(phone?: string | null): string | null {
  const n = localPhone(phone)
  if (n.length !== 10 && n.length !== 11) return null
  return `https://wa.me/55${n}`
}

function formatDataLonga(iso?: string | null): string {
  if (!iso) return 'Sem compras'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}

function formatDataCurta(iso?: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}

function formatMemberSince(iso?: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}

function formatCurrency(v?: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)
}

function isoToDateInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Agendado',
  OUT_FOR_DELIVERY: 'Em rota',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
}

/** Entradas {dia,qtd} agregadas da agenda (suporta days multi-slot e weeklyQty). */
function agendaEntries(schedule?: ClienteSchedule | null): { dia: string; qty: number }[] {
  if (!schedule) return []
  const acc: Record<string, number> = {}
  if (schedule.days && Object.keys(schedule.days).length > 0) {
    for (const wq of Object.values(schedule.days)) {
      for (const [dia, qty] of Object.entries(wq ?? {})) acc[dia] = (acc[dia] ?? 0) + (Number(qty) || 0)
    }
  } else if (schedule.weeklyQty) {
    for (const [dia, qty] of Object.entries(schedule.weeklyQty)) acc[dia] = (Number(qty) || 0)
  }
  return Object.entries(acc)
    .filter(([, q]) => q > 0)
    .sort((a, b) => DIA_ORDER.indexOf(a[0]) - DIA_ORDER.indexOf(b[0]))
    .map(([dia, qty]) => ({ dia: DIA_LABEL[dia] ?? dia, qty }))
}

function iniciais(nome: string): string {
  return nome.split(' ').slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

// estilos reutilizados ------------------------------------------------------
const cardStyle: CSSProperties = {
  background: 'var(--color-surface)',
  borderRadius: 22,
  border: '1px solid var(--color-border-2)',
  overflow: 'hidden',
}
const rowLabelStyle: CSSProperties = {
  flex: 1,
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--color-text-sec)',
}
const rowValueStyle: CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--color-text)',
  textAlign: 'right',
}

// ------------------------------------------------------------------ componente
export function ClientDetailView({ clienteId, onBack }: ClientDetailViewProps) {
  const [cliente, setCliente] = useState<ClienteDetalhe | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isBlocking, setIsBlocking] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [blockError, setBlockError] = useState<string | null>(null)
  const [showGrantModal, setShowGrantModal] = useState(false)
  const [grantQty, setGrantQty] = useState(1)
  const [grantMotivo, setGrantMotivo] = useState<string | null>(null)
  const [grantLoading, setGrantLoading] = useState(false)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [removeQty, setRemoveQty] = useState(1)
  const [removeMotivo, setRemoveMotivo] = useState<string | null>(null)
  const [removeLoading, setRemoveLoading] = useState(false)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [showHookModal, setShowHookModal] = useState(false)
  const [hookReason, setHookReason] = useState('')
  const [hookLoading, setHookLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null)

  // edição de cadastro
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [condominios, setCondominios] = useState<Condo[]>([])
  const [editForm, setEditForm] = useState({
    name: '', phone: '', email: '', cpf: '', birthDate: '', condominiumId: '', apartment: '', block: '',
  })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // segmento Geral / Pedidos / Financeiro / Atividade
  const [aba, setAba] = useState<'geral' | 'pedidos' | 'financeiro' | 'atividade'>('geral')
  const [scheduleToggling, setScheduleToggling] = useState(false)
  const [blockReasonInput, setBlockReasonInput] = useState('')

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

  function showToast(message: string, ok = true) {
    setToast({ message, ok })
    setTimeout(() => setToast(null), 2500)
  }

  async function copiar(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      showToast(`${label} copiado`)
    } catch {
      // alguns contextos bloqueiam clipboard — falha silenciosa
    }
  }

  async function handleGrant() {
    if (!grantMotivo || grantQty < 1 || !cliente) return
    setGrantLoading(true)
    try {
      const res = await apiFetch(`/admin/clients/${cliente.id}/grant-credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: grantQty, reason: grantMotivo }),
      })
      if (res.ok) {
        const updated = (await res.json()) as { creditBalance: number }
        setCliente((prev) => (prev ? { ...prev, creditBalance: updated.creditBalance } : prev))
        setShowGrantModal(false)
        setGrantQty(1)
        setGrantMotivo(null)
        showToast(`${grantQty} crédito(s) adicionado(s) a ${cliente.name}`)
      }
    } catch {
      // silencioso
    } finally {
      setGrantLoading(false)
    }
  }

  async function handleRemove() {
    if (!removeMotivo || removeQty < 1 || !cliente) return
    setRemoveLoading(true)
    try {
      const res = await apiFetch(`/admin/clients/${cliente.id}/remove-credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: removeQty, reason: removeMotivo }),
      })
      if (res.ok) {
        const updated = (await res.json()) as { creditBalance: number }
        setCliente((prev) => (prev ? { ...prev, creditBalance: updated.creditBalance } : prev))
        showToast(`${removeQty} crédito(s) removido(s) de ${cliente.name}`)
        setShowRemoveConfirm(false)
        setShowRemoveModal(false)
        setRemoveQty(1)
        setRemoveMotivo(null)
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        setShowRemoveConfirm(false)
        showToast(err?.error ?? 'Não foi possível remover os créditos', false)
      }
    } catch {
      setShowRemoveConfirm(false)
      showToast('Erro de conexão', false)
    } finally {
      setRemoveLoading(false)
    }
  }

  async function handleGrantHook() {
    if (!cliente || hookLoading) return
    setHookLoading(true)
    try {
      const res = await apiFetch('/admin/hook-requests/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: cliente.id, reason: hookReason.trim() || undefined }),
      })
      if (res.ok) {
        setShowHookModal(false)
        setHookReason('')
        showToast(`Gancho de bonificação liberado para ${cliente.name}`)
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        showToast(err?.error ?? 'Não foi possível conceder o gancho', false)
      }
    } catch {
      showToast('Erro de conexão', false)
    } finally {
      setHookLoading(false)
    }
  }

  async function handleConfirmarBloqueio() {
    if (!cliente || isBlocking) return
    setIsBlocking(true)
    setBlockError(null)
    try {
      const res = await apiFetch(`/admin/clients/${cliente.id}/block`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cliente.isBlocked ? {} : { reason: blockReasonInput.trim() || undefined }),
      })
      if (res.ok) {
        const updated = (await res.json()) as { id: string; isBlocked: boolean; blockReason?: string | null; blockedAt?: string | null }
        setCliente((prev) =>
          prev
            ? {
                ...prev,
                isBlocked: updated.isBlocked,
                blockReason: updated.blockReason ?? null,
                blockedAt: updated.blockedAt ?? null,
                blockedByName: updated.isBlocked ? prev.blockedByName : null,
              }
            : prev,
        )
        setShowDialog(false)
        setBlockReasonInput('')
      } else {
        setBlockError('Não foi possível alterar. Tente novamente.')
      }
    } catch {
      setBlockError('Não foi possível alterar. Tente novamente.')
    } finally {
      setIsBlocking(false)
    }
  }

  function openEdit() {
    if (!cliente) return
    setEditForm({
      name: cliente.name ?? '',
      phone: formatPhoneDisplay(cliente.phone) === '—' ? '' : (cliente.phone ?? ''),
      email: cliente.email ?? '',
      cpf: cliente.cpf ?? '',
      birthDate: isoToDateInput(cliente.birthDate),
      condominiumId: cliente.condominiumId ?? '',
      apartment: cliente.apartment ?? '',
      block: cliente.block ?? '',
    })
    setEditError(null)
    setShowEditSheet(true)
    // carrega condomínios sob demanda (uma vez)
    if (condominios.length === 0) {
      void (async () => {
        try {
          const res = await apiFetch('/admin/condominiums')
          if (res.ok) setCondominios((await res.json()) as Condo[])
        } catch {
          // silencioso
        }
      })()
    }
  }

  async function handleEdit() {
    if (!cliente || editLoading) return
    setEditLoading(true)
    setEditError(null)

    const payload: Record<string, string> = {}
    if (editForm.name.trim()) payload.name = editForm.name.trim()
    if (editForm.phone.trim()) payload.phone = editForm.phone.trim()
    if (editForm.email.trim()) payload.email = editForm.email.trim()
    if (editForm.cpf.trim()) payload.cpf = editForm.cpf.trim()
    if (editForm.condominiumId) payload.condominiumId = editForm.condominiumId
    if (editForm.apartment.trim()) payload.apartment = editForm.apartment.trim()
    if (editForm.block.trim()) payload.block = editForm.block.trim()
    payload.birthDate = editForm.birthDate ? `${editForm.birthDate}T00:00:00.000Z` : ''

    try {
      const res = await apiFetch(`/admin/clients/${cliente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const u = (await res.json()) as Partial<ClienteDetalhe>
        const novoCondoNome =
          u.condominiumId && condominios.length
            ? condominios.find((c) => c.id === u.condominiumId)?.name ?? cliente.condominiumName
            : cliente.condominiumName
        setCliente((prev) => (prev ? { ...prev, ...u, condominiumName: novoCondoNome ?? null } : prev))
        setShowEditSheet(false)
        showToast('Cadastro atualizado')
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        setEditError(err?.error ?? 'Não foi possível salvar. Verifique os dados.')
      }
    } catch {
      setEditError('Falha na conexão. Tente novamente.')
    } finally {
      setEditLoading(false)
    }
  }

  async function handleToggleSchedule() {
    if (!cliente?.schedule || scheduleToggling) return
    const next = !(cliente.schedule.isActive !== false)
    setScheduleToggling(true)
    try {
      const res = await apiFetch(`/admin/clients/${cliente.id}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      })
      if (res.ok) {
        const u = (await res.json()) as { isActive: boolean }
        setCliente((prev) => (prev && prev.schedule ? { ...prev, schedule: { ...prev.schedule, isActive: u.isActive } } : prev))
        showToast(u.isActive ? 'Agenda retomada' : 'Agenda pausada')
      } else {
        showToast('Falha ao atualizar agenda', false)
      }
    } catch {
      showToast('Falha na conexão', false)
    } finally {
      setScheduleToggling(false)
    }
  }

  useEffect(() => {
    if (!showGrantModal && !showEditSheet && !showRemoveModal) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowGrantModal(false)
        setShowEditSheet(false)
        setShowRemoveModal(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showGrantModal, showEditSheet, showRemoveModal])

  const entradas = agendaEntries(cliente?.schedule)
  const wa = whatsappLink(cliente?.phone)

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '14px 20px 10px', flexShrink: 0 }}>
        <button
          onClick={onBack}
          aria-label="Voltar"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '8px 8px 8px 0',
            display: 'flex', alignItems: 'center', color: 'var(--color-text)', minHeight: 44,
          }}
        >
          <Icon name="arrowL" size={22} stroke={2} color="var(--color-text)" />
        </button>
        <h1
          style={{
            fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700,
            letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0,
          }}
        >
          Cliente
        </h1>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 20px' }}>
          <div
            style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      ) : !cliente ? (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--color-text-sec)' }}>
            Falha na conexão. Tente novamente.
          </p>
        </div>
      ) : (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Card de avatar */}
          <div style={{ ...cardStyle, padding: '20px 16px', textAlign: 'center' }}>
            <div
              style={{
                width: 64, height: 64, borderRadius: '50%', background: 'var(--color-surface-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
              }}
            >
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--color-accent)' }}>
                {iniciais(cliente.name)}
              </span>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--color-text)',
                margin: '0 0 4px', letterSpacing: '-0.02em',
              }}
            >
              {cliente.name}
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-sec)', margin: '0 0 10px' }}>
              {cliente.condominiumName ? `${cliente.condominiumName} · ` : ''}
              {cliente.block ? `Bl ${cliente.block} · ` : ''}Ap {cliente.apartment ?? '—'}
            </p>
            {cliente.isBlocked && (
              <div
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--color-gold-soft)',
                  border: '1px solid var(--color-border-2)', borderRadius: 999, padding: '4px 10px',
                }}
              >
                <Icon name="ban" size={13} stroke={2} color="var(--color-accent)" aria-hidden="true" />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--color-accent)' }}>
                  Bloqueado
                </span>
              </div>
            )}
            {cliente.isBlocked && (cliente.blockReason || cliente.blockedAt || cliente.blockedByName) && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '8px 0 0', lineHeight: 1.4 }}>
                {cliente.blockReason ? `"${cliente.blockReason}"` : 'Sem motivo registrado'}
                {(cliente.blockedByName || cliente.blockedAt) && (
                  <>
                    <br />
                    {[cliente.blockedByName, cliente.blockedAt ? formatDataCurta(cliente.blockedAt) : null].filter(Boolean).join(' · ')}
                  </>
                )}
              </p>
            )}
          </div>

          {/* Segmento Visão geral / Financeiro */}
          <div
            style={{
              display: 'flex', gap: 4, padding: 4, borderRadius: 999,
              background: 'var(--color-surface-2)', border: '1px solid var(--color-border-2)',
            }}
          >
            {([['geral', 'Geral'], ['pedidos', 'Pedidos'], ['financeiro', 'Financeiro'], ['atividade', 'Atividade']] as const).map(([key, label]) => {
              const ativo = aba === key
              return (
                <button
                  key={key}
                  onClick={() => setAba(key)}
                  style={{
                    flex: 1, minHeight: 40, borderRadius: 999, border: 'none', cursor: 'pointer',
                    background: ativo ? 'var(--color-surface)' : 'transparent',
                    boxShadow: ativo ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700,
                    color: ativo ? 'var(--color-text)' : 'var(--color-text-ter)',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {aba === 'financeiro' ? (
            <FinanceiroPanel
              clienteId={cliente.id}
              showToast={showToast}
              onRefunded={(credits) =>
                setCliente((prev) => (prev ? { ...prev, creditBalance: Math.max(0, prev.creditBalance - credits) } : prev))
              }
            />
          ) : aba === 'pedidos' ? (
            <PedidosPanel
              clienteId={cliente.id}
              showToast={showToast}
              onCreditChange={(delta) =>
                setCliente((prev) => (prev ? { ...prev, creditBalance: Math.max(0, prev.creditBalance + delta) } : prev))
              }
            />
          ) : aba === 'atividade' ? (
            <TimelinePanel clienteId={cliente.id} />
          ) : (
          <>
          {/* Métricas */}
          {cliente.metrics && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <MetricCard icon="coin" label="Total gasto" value={formatCurrency(cliente.metrics.totalSpent)} />
              <MetricCard icon="bag" label="Pães entregues" value={String(cliente.metrics.breadsDelivered)} />
              <MetricCard icon="list" label="Pedidos" value={String(cliente.metrics.ordersCount)} />
              <MetricCard icon="repeat" label="Pães/semana" value={String(cliente.metrics.weeklyBreads)} />
            </div>
          )}

          {/* Contato + editar */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 8px' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                Cadastro
              </span>
              <button
                onClick={openEdit}
                aria-label="Editar cadastro"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, background: 'none',
                  border: '1.5px solid var(--color-border)', borderRadius: 999, padding: '6px 12px',
                  fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-text)',
                  cursor: 'pointer', minHeight: 36,
                }}
              >
                <Icon name="edit" size={15} stroke={2} color="var(--color-text)" />
                Editar
              </button>
            </div>

            {/* Telefone */}
            <ContactRow icon="phone" label="Telefone" value={formatPhoneDisplay(cliente.phone)}>
              {cliente.phone && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noreferrer"
                      style={{ ...miniBtnStyle, textDecoration: 'none', color: 'var(--color-accent)' }}
                    >
                      WhatsApp
                    </a>
                  )}
                  <button onClick={() => void copiar(localPhone(cliente.phone), 'Telefone')} style={miniBtnStyle}>
                    Copiar
                  </button>
                </div>
              )}
            </ContactRow>

            {/* E-mail */}
            <Separator />
            <ContactRow icon="mail" label="E-mail" value={cliente.email || '—'}>
              {cliente.email && (
                <button onClick={() => void copiar(cliente.email!, 'E-mail')} style={miniBtnStyle}>
                  Copiar
                </button>
              )}
            </ContactRow>

            {/* CPF */}
            <Separator />
            <ContactRow icon="user" label="CPF" value={formatCpf(cliente.cpf)}>
              {cliente.cpf && (
                <button onClick={() => void copiar(onlyDigits(cliente.cpf), 'CPF')} style={miniBtnStyle}>
                  Copiar
                </button>
              )}
            </ContactRow>

            {/* Nascimento */}
            <Separator />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
              <Icon name="calendar" size={20} stroke={1.9} color="var(--color-accent)" aria-hidden="true" />
              <span style={rowLabelStyle}>Nascimento</span>
              <span style={rowValueStyle}>{formatDataCurta(cliente.birthDate)}</span>
            </div>

            {/* Membro desde */}
            <Separator />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
              <Icon name="clock" size={20} stroke={1.9} color="var(--color-accent)" aria-hidden="true" />
              <span style={rowLabelStyle}>Membro desde</span>
              <span style={rowValueStyle}>{formatMemberSince(cliente.createdAt)}</span>
            </div>
          </div>

          {/* Saldo + créditos */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
              <Icon name="wallet" size={20} stroke={1.9} color="var(--color-accent)" aria-hidden="true" />
              <span style={rowLabelStyle}>Saldo de créditos</span>
              <span style={rowValueStyle}>{cliente.creditBalance} pães</span>
            </div>
            <div style={{ padding: '0 16px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                onClick={() => setShowGrantModal(true)}
                aria-label="Adicionar créditos"
                style={{
                  background: 'none', border: '1.5px solid var(--color-border)', borderRadius: 999,
                  padding: '6px 14px', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
                  color: 'var(--color-text)', cursor: 'pointer', minHeight: 36,
                }}
              >
                + Adicionar créditos
              </button>
              <button
                onClick={() => setShowHookModal(true)}
                aria-label="Conceder gancho de bonificação"
                style={{
                  background: 'none', border: '1.5px solid var(--color-border)', borderRadius: 999,
                  padding: '6px 14px', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
                  color: 'var(--color-text)', cursor: 'pointer', minHeight: 36,
                }}
              >
                + Conceder gancho
              </button>
              {cliente.creditBalance > 0 && (
                <button
                  onClick={() => { setRemoveQty(1); setRemoveMotivo(null); setShowRemoveModal(true) }}
                  aria-label="Remover créditos"
                  style={{
                    background: 'none', border: '1.5px solid var(--color-warn)', borderRadius: 999,
                    padding: '6px 14px', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
                    color: 'var(--color-warn)', cursor: 'pointer', minHeight: 36,
                  }}
                >
                  − Remover créditos
                </button>
              )}
            </div>
            <Separator />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
              <Icon name="clock" size={20} stroke={1.9} color="var(--color-accent)" aria-hidden="true" />
              <span style={rowLabelStyle}>Última compra</span>
              <span style={{ ...rowValueStyle, maxWidth: 140 }}>
                {formatDataLonga(
                  cliente.recentOrders && cliente.recentOrders.length > 0 ? cliente.recentOrders[0].scheduledDate : null,
                )}
              </span>
            </div>
          </div>

          {/* Agenda */}
          {(() => {
            const agendaAtiva = cliente.schedule ? cliente.schedule.isActive !== false : false
            return (
              <div style={{ ...cardStyle, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: entradas.length ? 12 : 0 }}>
                  <Icon name="calendar" size={20} stroke={1.9} color="var(--color-accent)" aria-hidden="true" />
                  <span style={rowLabelStyle}>Agendamento semanal</span>
                  {cliente.schedule ? (
                    <span
                      style={{
                        fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700,
                        color: agendaAtiva ? 'var(--color-accent)' : 'var(--color-text-ter)',
                        background: agendaAtiva ? 'var(--color-gold-soft)' : 'transparent',
                        border: agendaAtiva ? 'none' : '1px solid var(--color-border-2)',
                        borderRadius: 999, padding: '2px 8px',
                      }}
                    >
                      {agendaAtiva ? 'Ativa' : 'Pausada'}
                    </span>
                  ) : (
                    <span style={rowValueStyle}>Sem agendamento</span>
                  )}
                </div>
                {entradas.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, opacity: agendaAtiva ? 1 : 0.5 }}>
                    {entradas.map((e) => (
                      <div
                        key={e.dia}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-surface-2)',
                          borderRadius: 10, padding: '6px 10px',
                        }}
                      >
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-sec)' }}>
                          {e.dia}
                        </span>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 800, color: 'var(--color-text)' }}>
                          {e.qty}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {cliente.schedule && (
                  <button
                    onClick={() => { void handleToggleSchedule() }}
                    disabled={scheduleToggling}
                    style={{
                      marginTop: 12, width: '100%', minHeight: 40, borderRadius: 12,
                      border: '1.5px solid var(--color-border)', background: 'transparent',
                      fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700,
                      color: 'var(--color-text)', cursor: scheduleToggling ? 'wait' : 'pointer',
                      opacity: scheduleToggling ? 0.6 : 1,
                    }}
                  >
                    {agendaAtiva ? 'Pausar agenda' : 'Retomar agenda'}
                  </button>
                )}
              </div>
            )
          })()}

          {/* Pedidos recentes (30 dias) */}
          {cliente.recentOrders && cliente.recentOrders.length > 0 && (
            <div style={{ ...cardStyle, padding: '14px 16px' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                Pedidos recentes
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
                {cliente.recentOrders.slice(0, 8).map((o, i) => (
                  <div
                    key={o.id ?? i}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid var(--color-border-2)',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-sec)' }}>
                      {formatDataCurta(o.scheduledDate)}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-ter)' }}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, color: 'var(--color-text)' }}>
                        {o.quantity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notas internas */}
          <NotasCard clienteId={cliente.id} showToast={showToast} />

          {/* Sessões / dispositivos */}
          <SessoesCard clienteId={cliente.id} showToast={showToast} />

          {/* Botão bloquear / desbloquear */}
          <button
            onClick={() => setShowDialog(true)}
            disabled={isBlocking}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '14px 20px', borderRadius: 16,
              border: cliente.isBlocked ? 'none' : '1.5px solid var(--color-border)',
              background: cliente.isBlocked ? 'var(--color-gold)' : 'transparent',
              color: cliente.isBlocked ? '#1E1207' : 'var(--color-text)',
              fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700,
              cursor: isBlocking ? 'wait' : 'pointer', opacity: isBlocking ? 0.6 : 1, minHeight: 44,
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

          {blockError && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-warn)', margin: 0, textAlign: 'center' }}>
              {blockError}
            </p>
          )}
          </>
          )}
        </div>
      )}

      {/* Toast inline */}
      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
            background: toast.ok ? 'var(--color-espresso)' : 'var(--color-warn)', color: '#fff',
            borderRadius: 20, padding: '10px 20px', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap',
          }}
        >
          {toast.message}
        </div>
      )}

      {/* ---------- Bottom sheet: editar cadastro ---------- */}
      {showEditSheet && cliente && (
        <>
          <div onClick={() => setShowEditSheet(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--color-app-bg)',
              borderRadius: '20px 20px 0 0', padding: `24px 20px calc(32px + env(safe-area-inset-bottom, 0px))`,
              maxHeight: '88vh', overflowY: 'auto', zIndex: 51,
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--color-border)', margin: '0 auto 20px' }} />
            <h2 id="edit-title" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, color: 'var(--color-text)', margin: '0 0 20px' }}>
              Editar cadastro
            </h2>

            <EditField label="Nome" value={editForm.name} onChange={(v) => setEditForm((f) => ({ ...f, name: v }))} />
            <EditField label="Telefone" value={editForm.phone} onChange={(v) => setEditForm((f) => ({ ...f, phone: v }))} placeholder="(11) 99000-0000" type="tel" />
            <EditField label="E-mail" value={editForm.email} onChange={(v) => setEditForm((f) => ({ ...f, email: v }))} type="email" />
            <EditField label="CPF" value={editForm.cpf} onChange={(v) => setEditForm((f) => ({ ...f, cpf: v }))} placeholder="000.000.000-00" />
            <EditField label="Nascimento" value={editForm.birthDate} onChange={(v) => setEditForm((f) => ({ ...f, birthDate: v }))} type="date" />

            {/* Condomínio */}
            <label style={editLabelStyle}>Condomínio</label>
            <select
              value={editForm.condominiumId}
              onChange={(e) => setEditForm((f) => ({ ...f, condominiumId: e.target.value }))}
              style={{ ...editInputStyle, appearance: 'none' }}
            >
              <option value="">— Selecione —</option>
              {condominios.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <EditField label="Apartamento" value={editForm.apartment} onChange={(v) => setEditForm((f) => ({ ...f, apartment: v }))} />
              </div>
              <div style={{ flex: 1 }}>
                <EditField label="Bloco" value={editForm.block} onChange={(v) => setEditForm((f) => ({ ...f, block: v }))} />
              </div>
            </div>

            {editError && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-warn)', margin: '4px 0 0', textAlign: 'center' }}>
                {editError}
              </p>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={() => setShowEditSheet(false)} style={sheetCancelBtn}>Descartar</button>
              <button
                onClick={() => { void handleEdit() }}
                disabled={editLoading || !editForm.name.trim()}
                style={{ ...sheetConfirmBtn, opacity: editLoading || !editForm.name.trim() ? 0.45 : 1, cursor: editLoading ? 'wait' : 'pointer' }}
              >
                {editLoading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ---------- Modal: grant-credits ---------- */}
      {showGrantModal && (
        <>
          <div onClick={() => setShowGrantModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-grant-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--color-app-bg)',
              borderRadius: '20px 20px 0 0', padding: `24px 20px calc(32px + env(safe-area-inset-bottom, 0px))`,
              maxHeight: '80vh', overflowY: 'auto', zIndex: 51,
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--color-border)', margin: '0 auto 20px' }} />
            <h2 id="modal-grant-title" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, color: 'var(--color-text)', margin: '0 0 20px' }}>
              Adicionar Créditos
            </h2>
            <label style={editLabelStyle}>Quantidade</label>
            <input
              type="number"
              min="1"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              value={grantQty}
              onChange={(e) => setGrantQty(Number(e.target.value))}
              style={{ ...editInputStyle, marginBottom: 20 }}
            />
            <label style={editLabelStyle}>Motivo</label>
            <div style={{ display: 'flex', flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
              {GRANT_MOTIVOS.map((m) => (
                <button
                  key={m}
                  aria-pressed={grantMotivo === m}
                  onClick={() => setGrantMotivo(m)}
                  style={{
                    minHeight: 44, padding: '8px 16px', borderRadius: 999, fontWeight: 700, fontSize: 13,
                    cursor: 'pointer', fontFamily: 'var(--font-body)',
                    border: grantMotivo === m ? 'none' : '1.5px solid var(--color-border)',
                    background: grantMotivo === m ? 'var(--color-gold)' : 'transparent',
                    color: grantMotivo === m ? '#1E1207' : 'var(--color-text)',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={() => setShowGrantModal(false)} style={sheetCancelBtn}>Descartar</button>
              <button
                onClick={() => { void handleGrant() }}
                disabled={!grantMotivo || grantQty < 1 || grantLoading}
                style={{
                  ...sheetConfirmBtn,
                  cursor: !grantMotivo || grantQty < 1 || grantLoading ? 'not-allowed' : 'pointer',
                  opacity: !grantMotivo || grantQty < 1 ? 0.45 : 1,
                }}
              >
                {grantLoading ? 'Confirmando...' : 'Adicionar créditos'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ---------- Modal: remover créditos ---------- */}
      {showRemoveModal && cliente && (
        <>
          <div onClick={() => setShowRemoveModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-remove-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--color-app-bg)',
              borderRadius: '20px 20px 0 0', padding: `24px 20px calc(32px + env(safe-area-inset-bottom, 0px))`,
              maxHeight: '80vh', overflowY: 'auto', zIndex: 51,
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--color-border)', margin: '0 auto 20px' }} />
            <h2 id="modal-remove-title" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, color: 'var(--color-text)', margin: '0 0 8px' }}>
              Remover Créditos
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--color-text-sec)', lineHeight: 1.5, margin: '0 0 20px' }}>
              Saldo atual: <strong>{cliente.creditBalance} pães</strong>. A remoção é registrada no extrato para auditoria.
            </p>
            <label style={editLabelStyle}>Quantidade</label>
            <input
              type="number"
              min="1"
              max={cliente.creditBalance}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              value={removeQty}
              onChange={(e) => setRemoveQty(Number(e.target.value))}
              style={{ ...editInputStyle, marginBottom: removeQty > cliente.creditBalance ? 6 : 20 }}
            />
            {removeQty > cliente.creditBalance && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--color-warn)', margin: '0 0 20px' }}>
                Máximo disponível: {cliente.creditBalance} pães.
              </p>
            )}
            <label style={editLabelStyle}>Motivo</label>
            <div style={{ display: 'flex', flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
              {REMOVE_MOTIVOS.map((m) => (
                <button
                  key={m}
                  aria-pressed={removeMotivo === m}
                  onClick={() => setRemoveMotivo(m)}
                  style={{
                    minHeight: 44, padding: '8px 16px', borderRadius: 999, fontWeight: 700, fontSize: 13,
                    cursor: 'pointer', fontFamily: 'var(--font-body)',
                    border: removeMotivo === m ? 'none' : '1.5px solid var(--color-border)',
                    background: removeMotivo === m ? 'var(--color-gold)' : 'transparent',
                    color: removeMotivo === m ? '#1E1207' : 'var(--color-text)',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={() => setShowRemoveModal(false)} style={sheetCancelBtn}>Descartar</button>
              <button
                onClick={() => setShowRemoveConfirm(true)}
                disabled={!removeMotivo || removeQty < 1 || removeQty > cliente.creditBalance}
                style={{
                  ...sheetConfirmBtn,
                  cursor: !removeMotivo || removeQty < 1 || removeQty > cliente.creditBalance ? 'not-allowed' : 'pointer',
                  opacity: !removeMotivo || removeQty < 1 || removeQty > cliente.creditBalance ? 0.45 : 1,
                }}
              >
                Remover créditos
              </button>
            </div>
          </div>
        </>
      )}

      {/* Confirmação de remoção — ação sensível, exige confirmação explícita */}
      <ConfirmSheet
        open={showRemoveConfirm && !!cliente}
        tone="danger"
        title="Confirmar remoção"
        description={
          cliente
            ? `Remover ${removeQty} crédito(s) de ${cliente.name} — motivo: ${removeMotivo}. Novo saldo: ${cliente.creditBalance - removeQty} pães. Esta ação não pode ser desfeita.`
            : undefined
        }
        confirmLabel="Remover"
        cancelLabel="Voltar"
        busy={removeLoading}
        onConfirm={() => { void handleRemove() }}
        onCancel={() => setShowRemoveConfirm(false)}
      />

      {/* ---------- Modal: conceder gancho (bonificação) ---------- */}
      {showHookModal && (
        <>
          <div onClick={() => setShowHookModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-hook-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--color-app-bg)',
              borderRadius: '20px 20px 0 0', padding: `24px 20px calc(32px + env(safe-area-inset-bottom, 0px))`,
              maxHeight: '80vh', overflowY: 'auto', zIndex: 51,
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--color-border)', margin: '0 auto 20px' }} />
            <h2 id="modal-hook-title" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, color: 'var(--color-text)', margin: '0 0 8px' }}>
              Conceder gancho
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--color-text-sec)', lineHeight: 1.5, margin: '0 0 20px' }}>
              Libera um gancho de bonificação (sem custo) que entra na fila de entrega. Use em casos
              de cortesia ou reposição.
            </p>
            <label style={editLabelStyle}>Motivo (opcional)</label>
            <input
              type="text"
              value={hookReason}
              onChange={(e) => setHookReason(e.target.value)}
              placeholder="Ex.: cortesia, reposição por atraso..."
              style={{ ...editInputStyle, marginBottom: 20 }}
            />
            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <button onClick={() => setShowHookModal(false)} style={sheetCancelBtn}>Descartar</button>
              <button
                onClick={() => { void handleGrantHook() }}
                disabled={hookLoading}
                style={{ ...sheetConfirmBtn, opacity: hookLoading ? 0.45 : 1, cursor: hookLoading ? 'wait' : 'pointer' }}
              >
                {hookLoading ? 'Concedendo...' : 'Conceder gancho'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Dialog de confirmação bloqueio */}
      {showDialog && cliente && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
            alignItems: 'flex-end', justifyContent: 'center', zIndex: 100, padding: '0 0 env(safe-area-inset-bottom, 0px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowDialog(false) }}
        >
          <div style={{ background: 'var(--color-surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 32px', width: '100%', maxWidth: 480 }}>
            <h2 id="dialog-title" style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
              {cliente.isBlocked ? `Desbloquear ${cliente.name}?` : `Bloquear ${cliente.name}?`}
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-sec)', margin: '0 0 24px', lineHeight: 1.5 }}>
              {cliente.isBlocked
                ? 'O cliente voltará a poder fazer pedidos e acessar o app.'
                : 'O cliente não poderá fazer pedidos ou acessar o app.'}
            </p>
            {!cliente.isBlocked && (
              <textarea
                value={blockReasonInput}
                onChange={(e) => setBlockReasonInput(e.target.value)}
                placeholder="Motivo do bloqueio (opcional, p/ auditoria)"
                rows={2}
                maxLength={500}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 12,
                  border: '1.5px solid var(--color-border)', background: 'var(--color-surface)',
                  fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text)',
                  resize: 'none', marginBottom: 16,
                }}
              />
            )}
            {blockError && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-warn)', margin: '0 0 12px', textAlign: 'center' }}>
                {blockError}
              </p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setShowDialog(false); setBlockError(null) }}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: 14, border: '1.5px solid var(--color-border)',
                  background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700,
                  color: 'var(--color-text)', cursor: 'pointer', minHeight: 44,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { void handleConfirmarBloqueio() }}
                disabled={isBlocking}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: 14, border: 'none',
                  background: cliente.isBlocked ? 'var(--color-gold)' : 'var(--color-accent)',
                  fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700,
                  color: cliente.isBlocked ? '#1E1207' : '#FFFFFF',
                  cursor: isBlocking ? 'wait' : 'pointer', opacity: isBlocking ? 0.6 : 1, minHeight: 44,
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

// ------------------------------------------------------------------ subcomponentes
const miniBtnStyle: CSSProperties = {
  background: 'none', border: '1px solid var(--color-border)', borderRadius: 999, padding: '4px 10px',
  fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--color-text-sec)', cursor: 'pointer',
}
const editLabelStyle: CSSProperties = {
  display: 'block', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
  color: 'var(--color-text-sec)', marginBottom: 8,
}
const editInputStyle: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12,
  border: '1.5px solid var(--color-border)', background: 'var(--color-surface)',
  fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 16,
}
const sheetCancelBtn: CSSProperties = {
  flex: 1, minHeight: 44, borderRadius: 999, border: '1.5px solid var(--color-border)', background: 'none',
  fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 15, color: 'var(--color-text)', cursor: 'pointer',
}
const sheetConfirmBtn: CSSProperties = {
  flex: 1, minHeight: 44, borderRadius: 999, border: 'none', background: 'var(--color-accent)',
  fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 15, color: '#1E1207',
}

function Separator() {
  return <div style={{ height: 1, background: 'var(--color-border-2)' }} />
}

function MetricCard({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div style={{ ...cardStyle, padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Icon name={icon} size={18} stroke={1.9} color="var(--color-accent)" aria-hidden="true" />
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>
        {value}
      </span>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)' }}>{label}</span>
    </div>
  )
}

function ContactRow({
  icon, label, value, children,
}: {
  icon: IconName
  label: string
  value: string
  children?: ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
      <Icon name={icon} size={20} stroke={1.9} color="var(--color-accent)" aria-hidden="true" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: 0 }}>{label}</p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
        </p>
      </div>
      {children}
    </div>
  )
}

function EditField({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <>
      <label style={editLabelStyle}>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={editInputStyle}
      />
    </>
  )
}

// ------------------------------------------------------------------ Financeiro
interface CreditTx {
  id: string
  type: string
  quantity: number
  description: string | null
  reason: string | null
  referenceId: string | null
  adminName: string | null
  createdAt: string
}
interface PaymentItem {
  id: string
  amount: number
  method: string
  status: string
  label: string
  quantity: number
  refundable: boolean
  createdAt: string
}
interface SavedCardItem {
  id: string
  brand: string
  lastFour: string
  expiresAt: string
  isDefault: boolean
}
interface AutoRechargeInfo {
  active: boolean
  mode: string | null
  weekday: string | null
  comboName: string | null
}
interface MethodsInfo {
  cards: SavedCardItem[]
  autoRecharge: AutoRechargeInfo | null
}

const TX_LABEL: Record<string, string> = {
  PURCHASE: 'Compra', DELIVERY: 'Entrega', REFUND: 'Estorno', EXPIRY: 'Expiração', ADMIN_GRANT: 'Concessão',
  ADMIN_DEBIT: 'Remoção',
}
const PAY_STATUS: Record<string, string> = {
  PENDING: 'Pendente', PAID: 'Pago', FAILED: 'Falhou', REFUNDED: 'Estornado',
}
const METHOD_LABEL: Record<string, string> = {
  PIX: 'Pix', CREDIT_CARD: 'Cartão de crédito', DEBIT_CARD: 'Cartão de débito',
}

function FinanceiroPanel({
  clienteId, showToast, onRefunded,
}: {
  clienteId: string
  showToast: (message: string, ok?: boolean) => void
  onRefunded: (credits: number) => void
}) {
  const [history, setHistory] = useState<CreditTx[]>([])
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [methods, setMethods] = useState<MethodsInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [refundTarget, setRefundTarget] = useState<PaymentItem | null>(null)
  const [refunding, setRefunding] = useState(false)

  async function fetchHistory() {
    try {
      const res = await apiFetch(`/admin/clients/${clienteId}/credit-history`)
      if (res.ok) setHistory((await res.json()) as CreditTx[])
    } catch {
      // silencioso
    }
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const [h, p, m] = await Promise.all([
          apiFetch(`/admin/clients/${clienteId}/credit-history`),
          apiFetch(`/admin/clients/${clienteId}/payments`),
          apiFetch(`/admin/clients/${clienteId}/payment-methods`),
        ])
        if (cancelled) return
        if (h.ok) setHistory((await h.json()) as CreditTx[])
        if (p.ok) setPayments((await p.json()) as PaymentItem[])
        if (m.ok) setMethods((await m.json()) as MethodsInfo)
      } catch {
        // silencioso
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [clienteId])

  async function confirmRefund() {
    if (!refundTarget || refunding) return
    setRefunding(true)
    try {
      const res = await apiFetch(`/admin/payments/${refundTarget.id}/refund`, { method: 'POST' })
      if (res.ok) {
        const data = (await res.json()) as { creditsDebited?: number }
        const alvo = refundTarget.id
        setPayments((prev) => prev.map((p) => (p.id === alvo ? { ...p, status: 'REFUNDED', refundable: false } : p)))
        onRefunded(data.creditsDebited ?? 0)
        showToast('Pagamento estornado')
        void fetchHistory()
        setRefundTarget(null)
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        showToast(err?.error ?? 'Falha ao estornar', false)
      }
    } catch {
      showToast('Falha na conexão', false)
    } finally {
      setRefunding(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
        <div
          style={{
            width: 26, height: 26, borderRadius: '50%',
            border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      </div>
    )
  }

  return (
    <>
      {/* Pagamentos */}
      <div style={{ ...cardStyle, padding: '14px 16px' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
          Pagamentos
        </span>
        {payments.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)', margin: '8px 0 0' }}>
            Nenhum pagamento.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
            {payments.map((p, i) => (
              <div
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                  borderTop: i === 0 ? 'none' : '1px solid var(--color-border-2)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                    {p.label} · {p.quantity} pães
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '2px 0 0' }}>
                    {METHOD_LABEL[p.method] ?? p.method} · {formatDataCurta(p.createdAt)}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, color: 'var(--color-text)' }}>
                    {formatCurrency(p.amount)}
                  </span>
                  <StatusBadge status={p.status} />
                </div>
                {p.refundable && (
                  <button onClick={() => setRefundTarget(p)} style={{ ...miniBtnStyle, color: 'var(--color-warn)', borderColor: 'var(--color-warn)' }}>
                    Estornar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Extrato de créditos */}
      <div style={{ ...cardStyle, padding: '14px 16px' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
          Extrato de créditos
        </span>
        {history.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)', margin: '8px 0 0' }}>
            Nenhuma movimentação.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
            {history.map((t, i) => {
              const positivo = t.quantity >= 0
              const sub = t.reason || t.description || (t.adminName ? `por ${t.adminName}` : '')
              return (
                <div
                  key={t.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                    borderTop: i === 0 ? 'none' : '1px solid var(--color-border-2)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                      {TX_LABEL[t.type] ?? t.type}
                      {t.adminName ? ` · ${t.adminName}` : ''}
                    </p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sub ? `${sub} · ` : ''}{formatDataCurta(t.createdAt)}
                    </p>
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800,
                      color: positivo ? 'var(--color-text)' : 'var(--color-warn)',
                    }}
                  >
                    {positivo ? '+' : ''}{t.quantity}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Cartões + auto-recarga */}
      <div style={{ ...cardStyle, padding: '14px 16px' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
          Métodos de pagamento
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {methods && methods.cards.length > 0 ? (
            methods.cards.map((c) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="card" size={18} stroke={1.9} color="var(--color-accent)" aria-hidden="true" />
                <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)' }}>
                  {c.brand} •••• {c.lastFour}
                </span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)' }}>{c.expiresAt}</span>
                {c.isDefault && (
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, color: 'var(--color-accent)', background: 'var(--color-gold-soft)', borderRadius: 999, padding: '2px 8px' }}>
                    padrão
                  </span>
                )}
              </div>
            ))
          ) : (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)', margin: 0 }}>
              Nenhum cartão salvo.
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
            <Icon name="repeat" size={18} stroke={1.9} color="var(--color-accent)" aria-hidden="true" />
            <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-sec)' }}>
              Auto-recarga
            </span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: methods?.autoRecharge?.active ? 'var(--color-accent)' : 'var(--color-text-ter)' }}>
              {methods?.autoRecharge?.active
                ? `Ativa${methods.autoRecharge.comboName ? ` · ${methods.autoRecharge.comboName}` : ''}`
                : 'Inativa'}
            </span>
          </div>
        </div>
      </div>

      {/* Dialog de confirmação de estorno */}
      {refundTarget && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
            alignItems: 'flex-end', justifyContent: 'center', zIndex: 100,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setRefundTarget(null) }}
        >
          <div style={{ background: 'var(--color-surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 32px', width: '100%', maxWidth: 480 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>
              Estornar pagamento?
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-sec)', margin: '0 0 24px', lineHeight: 1.5 }}>
              {formatCurrency(refundTarget.amount)} ({refundTarget.label}) serão estornados via Stripe e os créditos correspondentes debitados do cliente. Operação irreversível.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setRefundTarget(null)}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: 14, border: '1.5px solid var(--color-border)',
                  background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700,
                  color: 'var(--color-text)', cursor: 'pointer', minHeight: 44,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { void confirmRefund() }}
                disabled={refunding}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: 14, border: 'none', background: 'var(--color-warn)',
                  fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, color: '#fff',
                  cursor: refunding ? 'wait' : 'pointer', opacity: refunding ? 0.6 : 1, minHeight: 44,
                }}
              >
                {refunding ? '...' : 'Confirmar estorno'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function StatusBadge({ status }: { status: string }) {
  const isPaid = status === 'PAID'
  const isRefunded = status === 'REFUNDED'
  const color = isPaid ? 'var(--color-accent)' : isRefunded ? 'var(--color-warn)' : 'var(--color-text-ter)'
  return (
    <span
      style={{
        fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, color,
        background: isPaid ? 'var(--color-gold-soft)' : 'transparent',
        border: isPaid ? 'none' : '1px solid var(--color-border-2)',
        borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap',
      }}
    >
      {PAY_STATUS[status] ?? status}
    </span>
  )
}

// ------------------------------------------------------------------ Pedidos
interface OrderRow {
  id: string
  type: string
  quantity: number
  status: string
  scheduledDate: string
  slotId: string | null
  deliveryTime: string | null
  courierName: string | null
  deliveredAt: string | null
  confirmedAt: string | null
  deliveryStatus: string | null
}

function orderStatusColor(status: string): string {
  if (status === 'DELIVERED') return 'var(--color-accent)'
  if (status === 'CANCELLED') return 'var(--color-warn)'
  if (status === 'OUT_FOR_DELIVERY') return 'var(--color-text-sec)'
  return 'var(--color-text-ter)'
}

function PedidosPanel({
  clienteId, showToast, onCreditChange,
}: {
  clienteId: string
  showToast: (message: string, ok?: boolean) => void
  onCreditChange: (delta: number) => void
}) {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelTarget, setCancelTarget] = useState<OrderRow | null>(null)
  const [refundOnCancel, setRefundOnCancel] = useState(true)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const res = await apiFetch(`/admin/clients/${clienteId}/orders`)
        if (res.ok && !cancelled) setOrders((await res.json()) as OrderRow[])
      } catch {
        // silencioso
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [clienteId])

  function openCancel(o: OrderRow) {
    setRefundOnCancel(true)
    setCancelTarget(o)
  }

  async function confirmCancel() {
    if (!cancelTarget || cancelling) return
    setCancelling(true)
    try {
      const res = await apiFetch(`/admin/clients/${clienteId}/orders/${cancelTarget.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refundCredits: refundOnCancel }),
      })
      if (res.ok) {
        const data = (await res.json()) as { refundedCredits?: number }
        const alvo = cancelTarget.id
        setOrders((prev) => prev.map((o) => (o.id === alvo ? { ...o, status: 'CANCELLED' } : o)))
        if (data.refundedCredits) onCreditChange(data.refundedCredits)
        showToast(data.refundedCredits ? `Pedido cancelado · ${data.refundedCredits} crédito(s) devolvido(s)` : 'Pedido cancelado')
        setCancelTarget(null)
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        showToast(err?.error ?? 'Falha ao cancelar', false)
      }
    } catch {
      showToast('Falha na conexão', false)
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
        <div
          style={{
            width: 26, height: 26, borderRadius: '50%',
            border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div style={{ ...cardStyle, padding: '24px 16px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-ter)', margin: 0 }}>
          Nenhum pedido encontrado.
        </p>
      </div>
    )
  }

  return (
    <>
      <div style={{ ...cardStyle, padding: '14px 16px' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
          Pedidos ({orders.length})
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
          {orders.map((o, i) => {
            const horario = o.deliveryTime || (o.slotId === 'manha' ? 'Manhã' : o.slotId === 'tarde' ? 'Tarde' : '')
            const entregue = o.deliveredAt ? `entregue ${formatDataCurta(o.deliveredAt)}` : ''
            const sub = [horario, o.courierName, entregue].filter(Boolean).join(' · ')
            return (
              <div
                key={o.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                  borderTop: i === 0 ? 'none' : '1px solid var(--color-border-2)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                    {formatDataCurta(o.scheduledDate)} · {o.quantity} pães
                  </p>
                  {sub && (
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sub}
                    </p>
                  )}
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700,
                    color: orderStatusColor(o.status),
                    background: o.status === 'DELIVERED' ? 'var(--color-gold-soft)' : 'transparent',
                    border: o.status === 'DELIVERED' ? 'none' : '1px solid var(--color-border-2)',
                    borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap',
                  }}
                >
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
                {o.status === 'SCHEDULED' && (
                  <button onClick={() => openCancel(o)} style={{ ...miniBtnStyle, color: 'var(--color-warn)', borderColor: 'var(--color-warn)' }}>
                    Cancelar
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Dialog de cancelamento de pedido */}
      {cancelTarget && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
            alignItems: 'flex-end', justifyContent: 'center', zIndex: 100,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setCancelTarget(null) }}
        >
          <div style={{ background: 'var(--color-surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 32px', width: '100%', maxWidth: 480 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>
              Cancelar pedido?
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-sec)', margin: '0 0 16px', lineHeight: 1.5 }}>
              Pedido de {formatDataCurta(cancelTarget.scheduledDate)} · {cancelTarget.quantity} pães será marcado como cancelado.
            </p>

            {/* Toggle devolver créditos */}
            <button
              onClick={() => setRefundOnCancel((v) => !v)}
              aria-pressed={refundOnCancel}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--color-border)',
                background: 'transparent', cursor: 'pointer', marginBottom: 24,
              }}
            >
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                Devolver {cancelTarget.quantity} crédito(s) ao cliente
              </span>
              <span
                style={{
                  width: 44, height: 26, borderRadius: 999, flexShrink: 0, position: 'relative',
                  background: refundOnCancel ? 'var(--color-accent)' : 'var(--color-border)', transition: 'background 0.15s',
                }}
              >
                <span
                  style={{
                    position: 'absolute', top: 3, left: refundOnCancel ? 21 : 3, width: 20, height: 20,
                    borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
                  }}
                />
              </span>
            </button>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setCancelTarget(null)}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: 14, border: '1.5px solid var(--color-border)',
                  background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700,
                  color: 'var(--color-text)', cursor: 'pointer', minHeight: 44,
                }}
              >
                Voltar
              </button>
              <button
                onClick={() => { void confirmCancel() }}
                disabled={cancelling}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: 14, border: 'none', background: 'var(--color-warn)',
                  fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, color: '#fff',
                  cursor: cancelling ? 'wait' : 'pointer', opacity: cancelling ? 0.6 : 1, minHeight: 44,
                }}
              >
                {cancelling ? '...' : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ------------------------------------------------------------------ Notas internas
interface NoteItem { id: string; body: string; adminName: string | null; createdAt: string }

function NotasCard({ clienteId, showToast }: { clienteId: string; showToast: (m: string, ok?: boolean) => void }) {
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const res = await apiFetch(`/admin/clients/${clienteId}/notes`)
      if (res.ok) setNotes((await res.json()) as NoteItem[])
    } catch { /* silencioso */ }
  }
  useEffect(() => { void load() }, [clienteId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function add() {
    const body = draft.trim()
    if (!body || saving) return
    setSaving(true)
    try {
      const res = await apiFetch(`/admin/clients/${clienteId}/notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }),
      })
      if (res.ok) { setDraft(''); showToast('Nota adicionada'); void load() }
      else showToast('Falha ao salvar nota', false)
    } catch { showToast('Falha na conexão', false) } finally { setSaving(false) }
  }

  async function remove(id: string) {
    try {
      const res = await apiFetch(`/admin/clients/${clienteId}/notes/${id}`, { method: 'DELETE' })
      if (res.ok) { setNotes((p) => p.filter((n) => n.id !== id)); showToast('Nota excluída') }
    } catch { showToast('Falha na conexão', false) }
  }

  return (
    <div style={{ ...cardStyle, padding: '14px 16px' }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
        Notas internas
      </span>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void add() }}
          placeholder="Adicionar nota…"
          maxLength={2000}
          style={{
            flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 12, border: '1.5px solid var(--color-border)',
            background: 'var(--color-surface)', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text)',
          }}
        />
        <button
          onClick={() => { void add() }}
          disabled={!draft.trim() || saving}
          style={{
            flexShrink: 0, padding: '0 14px', minHeight: 40, borderRadius: 12, border: 'none',
            background: 'var(--color-espresso)', color: '#FAF5EC', fontFamily: 'var(--font-body)', fontSize: 14,
            fontWeight: 700, cursor: !draft.trim() || saving ? 'not-allowed' : 'pointer', opacity: !draft.trim() ? 0.45 : 1,
          }}
        >
          Salvar
        </button>
      </div>
      {notes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
          {notes.map((n, i) => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid var(--color-border-2)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--color-text)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{n.body}</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: '2px 0 0' }}>
                  {[n.adminName, formatDataCurta(n.createdAt)].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button onClick={() => { void remove(n.id) }} aria-label="Excluir nota" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-text-ter)', flexShrink: 0 }}>
                <Icon name="x" size={16} stroke={2} color="var(--color-text-ter)" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ Sessões
interface SessionItem { id: string; deviceId: string; lastUsedAt: string; expiresAt: string; createdAt: string }

function SessoesCard({ clienteId, showToast }: { clienteId: string; showToast: (m: string, ok?: boolean) => void }) {
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [loaded, setLoaded] = useState(false)

  async function load() {
    try {
      const res = await apiFetch(`/admin/clients/${clienteId}/sessions`)
      if (res.ok) setSessions((await res.json()) as SessionItem[])
    } catch { /* silencioso */ } finally { setLoaded(true) }
  }
  useEffect(() => { void load() }, [clienteId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function revoke(id: string) {
    try {
      const res = await apiFetch(`/admin/clients/${clienteId}/sessions/${id}`, { method: 'DELETE' })
      if (res.ok) { setSessions((p) => p.filter((s) => s.id !== id)); showToast('Sessão revogada') }
    } catch { showToast('Falha na conexão', false) }
  }

  if (loaded && sessions.length === 0) return null

  return (
    <div style={{ ...cardStyle, padding: '14px 16px' }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
        Dispositivos conectados
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
        {sessions.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid var(--color-border-2)' }}>
            <Icon name="phone" size={18} stroke={1.9} color="var(--color-accent)" aria-hidden="true" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.deviceId}
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: '2px 0 0' }}>
                último uso {formatDataCurta(s.lastUsedAt)}
              </p>
            </div>
            <button onClick={() => { void revoke(s.id) }} style={{ ...miniBtnStyle, color: 'var(--color-warn)', borderColor: 'var(--color-warn)' }}>
              Revogar
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ Timeline unificada
interface TimelineEvent { date: string; kind: 'credit' | 'payment' | 'order'; icon: IconName; title: string; sub: string; value: string | null; valueColor: string }

function TimelinePanel({ clienteId }: { clienteId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const [h, p, o] = await Promise.all([
          apiFetch(`/admin/clients/${clienteId}/credit-history`),
          apiFetch(`/admin/clients/${clienteId}/payments`),
          apiFetch(`/admin/clients/${clienteId}/orders`),
        ])
        if (cancelled) return
        const evs: TimelineEvent[] = []
        if (h.ok) {
          for (const t of (await h.json()) as CreditTx[]) {
            const pos = t.quantity >= 0
            evs.push({
              date: t.createdAt, kind: 'credit', icon: 'wallet',
              title: TX_LABEL[t.type] ?? t.type,
              sub: [t.reason || t.description, t.adminName].filter(Boolean).join(' · '),
              value: `${pos ? '+' : ''}${t.quantity}`, valueColor: pos ? 'var(--color-text)' : 'var(--color-warn)',
            })
          }
        }
        if (p.ok) {
          for (const pay of (await p.json()) as PaymentItem[]) {
            evs.push({
              date: pay.createdAt, kind: 'payment', icon: 'coin',
              title: `Pagamento · ${pay.label}`, sub: PAY_STATUS[pay.status] ?? pay.status,
              value: formatCurrency(pay.amount), valueColor: 'var(--color-text)',
            })
          }
        }
        if (o.ok) {
          for (const ord of (await o.json()) as OrderRow[]) {
            evs.push({
              date: ord.scheduledDate, kind: 'order', icon: 'bag',
              title: `Pedido · ${ord.quantity} pães`, sub: STATUS_LABEL[ord.status] ?? ord.status,
              value: null, valueColor: 'var(--color-text)',
            })
          }
        }
        evs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        setEvents(evs)
      } catch { /* silencioso */ } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [clienteId])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }
  if (events.length === 0) {
    return (
      <div style={{ ...cardStyle, padding: '24px 16px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-ter)', margin: 0 }}>Sem atividade.</p>
      </div>
    )
  }
  return (
    <div style={{ ...cardStyle, padding: '14px 16px' }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
        Atividade ({events.length})
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
        {events.map((e, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid var(--color-border-2)' }}>
            <Icon name={e.icon} size={18} stroke={1.9} color="var(--color-accent)" aria-hidden="true" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {[e.sub, formatDataCurta(e.date)].filter(Boolean).join(' · ')}
              </p>
            </div>
            {e.value && (
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, color: e.valueColor }}>{e.value}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
