import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { COMPLEMENT_MAX_LENGTH, apartmentFieldLabel, apartmentFieldPlaceholder } from '@cheirin-de-pao/shared'
import { useAuth } from '../../hooks/useAuth'
import { apiFetch } from '../../lib/apiFetch'
import { CondoSearch } from '../../components/auth/CondoSearch'
import { Icon } from '../../components/brand/Icon'
import { Btn, Card, ProviderTile, Row, SectionLabel, SocialKeyframes, Spinner } from '../../components/auth/SocialAuthUI'
import {
  disconnectSocial,
  fetchConnectedAccounts,
  fetchSocialProviders,
  startSocial,
  type ConnectedAccount,
} from '../../lib/socialAuth'

interface Condo {
  id: string
  name: string
  type: string
  neighborhood: string
}

interface SelectedCondo {
  id: string
  name: string
  type: string
}

// Formata "1998-10-27" / ISO para "27/10/1998"
function formatBirthDate(iso?: string): string {
  if (!iso) return 'Não informado'
  const d = iso.split('T')[0]
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return 'Não informado'
  return `${day}/${m}/${y}`
}

// CPF mascarado na leitura (handoff L7): "52998224725" → "•••.982.247-••".
function maskCpf(cpf?: string): string {
  const d = (cpf ?? '').replace(/\D/g, '')
  if (d.length !== 11) return cpf || '—'
  return `•••.${d.slice(3, 6)}.${d.slice(6, 9)}-••`
}

// Celular legível (handoff L7): "11987654321" → "(11) 9 8765-4321".
function formatPhoneDisplay(phone?: string): string {
  let d = (phone ?? '').replace(/\D/g, '')
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return phone || 'Não informado'
}

export function AccountScreen() {
  const auth = useAuth()
  const navigate = useNavigate()
  const { user } = auth

  // ── Dados pessoais ──
  const [editingDados, setEditingDados] = useState(false)
  const [name, setName] = useState(user?.name ?? '')
  const [birthDate, setBirthDate] = useState(user?.birthDate?.split('T')[0] ?? '')

  // ── Condomínio ──
  const [editingEndereco, setEditingEndereco] = useState(false)
  const [condos, setCondos] = useState<Condo[]>([])
  const [selectedCondo, setSelectedCondo] = useState<SelectedCondo | null>(
    user?.condominiumId ? { id: user.condominiumId, name: user.condominiumName ?? '', type: '' } : null,
  )
  const [apartment, setApartment] = useState(user?.apartment ?? '')
  const [block, setBlock] = useState(user?.block ?? '')
  const [complement, setComplement] = useState(user?.complement ?? '')
  const [showCondoDialog, setShowCondoDialog] = useState(false)

  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null)

  const showToast = (message: string, ok: boolean) => {
    setToast({ message, ok })
    setTimeout(() => setToast(null), 2500)
  }

  // ── Contas conectadas (login com Google — handoff L7) ──
  const [googleOn, setGoogleOn] = useState(false)
  const [accounts, setAccounts] = useState<ConnectedAccount[] | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const google = accounts?.find((a) => a.provider === 'google') ?? null
  // Sessão antiga sem o campo: trata como "tem senha" (mostra Trocar, como antes).
  const hasPassword = user?.hasPassword !== false

  useEffect(() => {
    let alive = true
    void fetchSocialProviders().then((p) => alive && setGoogleOn(p.google))
    void fetchConnectedAccounts().then((list) => alive && setAccounts(list ?? []))
    return () => {
      alive = false
    }
  }, [])

  const connectGoogle = async () => {
    setConnecting(true)
    const started = await startSocial('google', 'account')
    if (!started.ok) {
      setConnecting(false)
      showToast('Não foi possível falar com o Google. Tente de novo.', false)
      return
    }
    navigate('/entrar/social')
  }

  const doDisconnect = async () => {
    setDisconnecting(true)
    const ok = await disconnectSocial('google')
    setDisconnecting(false)
    setConfirmDisconnect(false)
    if (!ok) {
      showToast('Não foi possível desconectar. Tente de novo.', false)
      return
    }
    setAccounts((list) => (list ?? []).filter((a) => a.provider !== 'google'))
    showToast('Google desconectado. O código no e-mail continua valendo.', true)
  }

  useEffect(() => {
    apiFetch('/condominiums')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: Condo[]) => {
        setCondos(data)
        if (user?.condominiumId) {
          const found = data.find((c) => c.id === user.condominiumId)
          if (found) setSelectedCondo({ id: found.id, name: found.name, type: found.type })
        }
      })
      .catch(() => {})
  }, [])

  const handleCondoSelect = (id: string) => {
    const found = condos.find((c) => c.id === id)
    if (found) setSelectedCondo({ id: found.id, name: found.name, type: found.type })
  }

  // ── Salvar dados pessoais ──
  const handleSaveDados = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/client/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim(), birthDate: birthDate || undefined }),
      })
      if (res.ok) {
        auth.updateUser({ name: name.trim(), birthDate: birthDate || undefined })
        showToast('Dados salvos!', true)
        setEditingDados(false)
      } else {
        showToast('Não foi possível salvar. Tente novamente.', false)
      }
    } catch {
      showToast('Não foi possível salvar. Tente novamente.', false)
    } finally {
      setLoading(false)
    }
  }

  const cancelDados = () => {
    setName(user?.name ?? '')
    setBirthDate(user?.birthDate?.split('T')[0] ?? '')
    setEditingDados(false)
  }

  // ── Salvar endereço ──
  const handleSaveEndereco = () => {
    if (!selectedCondo) return
    if (selectedCondo.id !== user?.condominiumId) {
      setShowCondoDialog(true)
    } else {
      void doSaveEndereco()
    }
  }

  const doSaveEndereco = async () => {
    if (!selectedCondo) return
    setLoading(true)
    try {
      const res = await apiFetch('/client/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          condominiumId: selectedCondo.id,
          apartment: apartment.trim(),
          block: block.trim() || undefined,
          // String vazia (e não `undefined`) para APAGAR: `undefined` some do JSON e o
          // backend leria como "não mexer", deixando um "Lado A" órfão no endereço novo.
          complement: isBlocksCondo ? complement.trim() : '',
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as { scheduleDeactivated?: boolean }
        const update = {
          condominiumId: selectedCondo.id,
          condominiumName: selectedCondo.name,
          apartment: apartment.trim(),
          block: block.trim() || undefined,
          complement: isBlocksCondo ? complement.trim() : '',
          ...(data.scheduleDeactivated ? { condominiumJustChanged: true } : {}),
        }
        auth.updateUser(update)
        showToast('Endereço atualizado!', true)
        setEditingEndereco(false)
      } else {
        showToast('Não foi possível salvar. Tente novamente.', false)
      }
    } catch {
      showToast('Não foi possível salvar. Tente novamente.', false)
    } finally {
      setLoading(false)
    }
  }

  const cancelEndereco = () => {
    setSelectedCondo(
      user?.condominiumId ? { id: user.condominiumId, name: user.condominiumName ?? '', type: '' } : null,
    )
    if (user?.condominiumId) {
      const found = condos.find((c) => c.id === user.condominiumId)
      if (found) setSelectedCondo({ id: found.id, name: found.name, type: found.type })
    }
    setApartment(user?.apartment ?? '')
    setBlock(user?.block ?? '')
    setComplement(user?.complement ?? '')
    setEditingEndereco(false)
  }

  const isBlocksCondo = selectedCondo?.type === 'BLOCKS'
  // `selectedCondo` nasce com type '' (vem do user, antes de /condominiums responder); o
  // helper trata o desconhecido como "Apartamento" para o rótulo não piscar.
  const aptLabel = apartmentFieldLabel(selectedCondo?.type)

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--color-app-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <SocialKeyframes />
      {/* Toast — o do handoff (embaixo, espresso, check dourado); erro em vermelho. */}
      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: 20,
            right: 20,
            bottom: 'calc(76px + env(safe-area-inset-bottom))',
            zIndex: 9999,
            background: toast.ok ? 'var(--color-espresso)' : 'var(--color-warn)',
            color: '#FAF5EC',
            borderRadius: 14,
            padding: '13px 16px',
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 13.5,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            boxShadow: 'var(--shadow-strong)',
            animation: 'saRise .25s ease',
          }}
        >
          <span style={{ display: 'inline-flex', flexShrink: 0 }}>
            <Icon name={toast.ok ? 'check' : 'alert'} size={17} color={toast.ok ? 'var(--color-gold)' : '#FAF5EC'} stroke={2.4} />
          </span>
          {toast.message}
        </div>
      )}

      {/* AppBar */}
      <div
        style={{
          paddingTop: 'calc(6px + env(safe-area-inset-top))',
          padding: '6px 20px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={() => navigate('/client/perfil')}
          aria-label="Voltar"
          style={{
            minHeight: 44,
            width: 38,
            height: 38,
            borderRadius: 12,
            border: '1.5px solid var(--color-border)',
            background: 'var(--color-surface-2)',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="arrowL" size={20} color="var(--color-text)" />
        </button>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 21,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
            margin: 0,
          }}
        >
          Minha conta
        </h1>
      </div>

      {/* Scroll area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', paddingBottom: 80, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Seção: Dados Pessoais */}
        <SectionCard
          title="Dados pessoais"
          editing={editingDados}
          onEdit={() => setEditingDados(true)}
        >
          {editingDados ? (
            <>
              <FieldLabel>Nome completo</FieldLabel>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
              <div style={{ height: 16 }} />

              <FieldLabel>Data de nascimento</FieldLabel>
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} style={inputStyle} />
              <div style={{ height: 16 }} />

              <FieldLabel>CPF</FieldLabel>
              <input
                type="text"
                value={user?.cpf ?? ''}
                readOnly
                style={{ ...inputStyle, opacity: 0.7, background: 'var(--color-surface-2)', cursor: 'not-allowed' }}
              />
              <p style={hintStyle}>O CPF não pode ser alterado.</p>
              <div style={{ height: 20 }} />

              <EditActions
                onCancel={cancelDados}
                onSave={handleSaveDados}
                loading={loading}
                saveDisabled={name.trim().length < 2}
              />
            </>
          ) : (
            <>
              <Row label="Nome" value={user?.name || '—'} />
              <Row label="Nascimento" value={formatBirthDate(user?.birthDate)} />
              <Row label="CPF" value={maskCpf(user?.cpf)} />
            </>
          )}
        </SectionCard>

        {/* Seção: Contato */}
        <SectionCard title="Contato" onEdit={() => navigate('/client/perfil/editar-contato')}>
          <Row label="Celular" value={formatPhoneDisplay(user?.phone)} />
          <Row label="E-mail" value={user?.email || 'Não informado'} />
        </SectionCard>

        {/* Seção: Contas conectadas (L7) — só com o Google ligado no servidor. */}
        {googleOn && (
          <div>
            <SectionLabel>Contas conectadas</SectionLabel>
            <Card pad={0}>
              <ConnectedRow
                state={connecting ? 'connecting' : google ? 'on' : accounts === null ? 'loading' : 'off'}
                email={google?.email ?? null}
                onConnect={() => void connectGoogle()}
                onDisconnect={() => setConfirmDisconnect(true)}
              />
            </Card>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', lineHeight: 1.5, margin: '8px 4px 0' }}>
              Entre com um toque. Desconectar não tranca sua conta: o código no e-mail sempre funciona.
            </div>
          </div>
        )}

        {/* Seção: Segurança (L8 quando não há senha) */}
        <div>
          <SectionLabel>Segurança</SectionLabel>
          <Card pad={14} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: 'var(--color-surface-2)',
                color: 'var(--color-text-sec)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <Icon name={hasPassword ? 'lock' : 'shield'} size={19} />
            </div>
            {hasPassword ? (
              <>
                <div style={{ flex: 1, fontFamily: 'var(--font-body)' }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--color-text)' }}>Senha</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-sec)', marginTop: 2, letterSpacing: '0.1em' }}>••••••••</div>
                </div>
                <Btn size="sm" variant="soft" onClick={() => navigate('/change-password')}>
                  Trocar
                </Btn>
              </>
            ) : (
              <>
                <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-body)' }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--color-text)' }}>
                    {google ? 'Você entra com o Google' : 'Você entra com código no e-mail'}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--color-text-sec)', marginTop: 2, lineHeight: 1.4 }}>
                    {google ? 'Ou com código no e-mail. Quer uma senha também?' : 'Quer uma senha também?'}
                  </div>
                </div>
                <Btn size="sm" onClick={() => navigate('/create-password')}>
                  Criar senha
                </Btn>
              </>
            )}
          </Card>
        </div>

        {/* Seção: Condomínio */}
        <SectionCard
          title="Endereço"
          editing={editingEndereco}
          onEdit={() => setEditingEndereco(true)}
        >
          {editingEndereco ? (
            <>
              <CondoSearch
                condos={condos}
                selectedId={selectedCondo?.id ?? null}
                onSelect={handleCondoSelect}
              />
              <div style={{ height: 16 }} />

              <FieldLabel>{aptLabel}</FieldLabel>
              <input
                type="text"
                value={apartment}
                onChange={(e) => setApartment(e.target.value)}
                placeholder={apartmentFieldPlaceholder(selectedCondo?.type)}
                style={inputStyle}
              />

              {isBlocksCondo && (
                <>
                  <div style={{ height: 16 }} />
                  <FieldLabel>Bloco / Torre</FieldLabel>
                  <input
                    type="text"
                    value={block}
                    onChange={(e) => setBlock(e.target.value)}
                    placeholder="Ex: A"
                    style={inputStyle}
                  />

                  <div style={{ height: 16 }} />
                  <FieldLabel>Complemento (opcional)</FieldLabel>
                  <input
                    type="text"
                    value={complement}
                    maxLength={COMPLEMENT_MAX_LENGTH}
                    onChange={(e) => setComplement(e.target.value.slice(0, COMPLEMENT_MAX_LENGTH))}
                    placeholder="Ex: Lado A"
                    style={inputStyle}
                  />
                </>
              )}
              <div style={{ height: 20 }} />

              <EditActions
                onCancel={cancelEndereco}
                onSave={handleSaveEndereco}
                loading={loading}
                saveDisabled={!selectedCondo || !apartment.trim()}
              />
            </>
          ) : (
            <>
              <Row label="Condomínio" value={user?.condominiumName || '—'} />
              <Row label={aptLabel} value={user?.apartment || '—'} />
              {user?.block && <Row label="Bloco / Torre" value={user.block} />}
              {user?.complement && <Row label="Complemento" value={user.complement} />}
            </>
          )}
        </SectionCard>
      </div>

      {/* Sheet: desconectar o Google (L7) */}
      {confirmDisconnect && (
        <DisconnectSheet
          hasPassword={hasPassword}
          busy={disconnecting}
          onCancel={() => setConfirmDisconnect(false)}
          onConfirm={() => void doDisconnect()}
        />
      )}

      {/* Dialog: confirmar mudança de condomínio */}
      {showCondoDialog && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowCondoDialog(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-surface)',
              borderRadius: 22,
              padding: 24,
              width: 'calc(100vw - 48px)',
              maxWidth: 320,
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--color-text)',
                margin: '0 0 8px',
              }}
            >
              Mudar de condomínio
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                color: 'var(--color-text-sec)',
                margin: '0 0 20px',
                lineHeight: 1.5,
              }}
            >
              Mudar de condomínio vai desativar sua agenda semanal ativa. Você precisará reconfigurar
              a agenda no novo endereço.
            </p>
            <button
              onClick={() => setShowCondoDialog(false)}
              style={{
                width: '100%',
                minHeight: 44,
                background: 'transparent',
                color: 'var(--color-text)',
                borderRadius: 'var(--radius-btn)',
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                fontWeight: 700,
                border: '1.5px solid var(--color-border)',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                setShowCondoDialog(false)
                void doSaveEndereco()
              }}
              style={{
                width: '100%',
                minHeight: 44,
                background: 'var(--color-espresso)',
                color: 'var(--color-primary-btn-text)',
                borderRadius: 'var(--radius-btn)',
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                marginTop: 8,
              }}
            >
              Confirmar mudança
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--color-surface)',
  border: '1.5px solid var(--color-border)',
  borderRadius: 'var(--radius-field)',
  padding: '12px 14px',
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  color: 'var(--color-text)',
  outline: 'none',
  boxSizing: 'border-box',
}

const hintStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 12.5,
  color: 'var(--color-text-ter)',
  margin: '6px 0 0',
}

// ── Sub-components ─────────────────────────────────────────────────────────────

// Seção do handoff (L7): rótulo fora do card, "Editar" à direita do rótulo, card com as linhas.
function SectionCard({
  title,
  editing,
  onEdit,
  children,
}: {
  title: string
  editing?: boolean
  onEdit?: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, marginBottom: -4 }}>
        <SectionLabel>{title}</SectionLabel>
        {onEdit && !editing && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Editar ${title.toLowerCase()}`}
            style={{
              minHeight: 44,
              padding: '0 4px',
              background: 'none',
              border: 'none',
              color: 'var(--color-accent)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              marginTop: -8,
            }}
          >
            <Icon name="edit" size={15} color="var(--color-accent)" />
            Editar
          </button>
        )}
      </div>
      <Card pad={16} style={editing ? undefined : { paddingTop: 8, paddingBottom: 8 }}>
        {children}
      </Card>
    </div>
  )
}

// Linha de provedor em "Contas conectadas" (handoff ConnectedRow).
function ConnectedRow({
  state,
  email,
  onConnect,
  onDisconnect,
}: {
  state: 'off' | 'on' | 'connecting' | 'loading'
  email: string | null
  onConnect: () => void
  onDisconnect: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', minHeight: 64 }}>
      <ProviderTile size={40} />
      <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-body)' }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 7 }}>
          Google
          {state === 'on' && <Icon name="check" size={15} color="var(--color-good)" stroke={2.6} />}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: state === 'on' ? 'var(--color-text-sec)' : 'var(--color-text-ter)',
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {state === 'on' ? email || 'Conectado' : state === 'connecting' ? 'Conectando…' : state === 'loading' ? '…' : 'Não conectado'}
        </div>
      </div>
      {state === 'on' && (
        <button
          type="button"
          onClick={onDisconnect}
          style={{ minHeight: 44, padding: '0 6px', background: 'none', border: 'none', color: 'var(--color-text-sec)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
        >
          Desconectar
        </button>
      )}
      {state === 'off' && (
        <Btn size="sm" variant="soft" onClick={onConnect}>
          Conectar
        </Btn>
      )}
      {state === 'connecting' && (
        <div style={{ width: 44, height: 44, display: 'grid', placeItems: 'center' }}>
          <Spinner size={18} color="var(--color-accent)" track="var(--color-gold-soft)" />
        </div>
      )}
    </div>
  )
}

// Confirmação de desconectar (handoff SADisconnectSheet).
function DisconnectSheet({
  hasPassword,
  busy,
  onCancel,
  onConfirm,
}: {
  hasPassword: boolean
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])
  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(30,18,7,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Desconectar o Google?"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          background: 'var(--color-app-bg)',
          borderRadius: '26px 26px 0 0',
          padding: '10px 20px calc(22px + env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ width: 40, height: 5, borderRadius: 9, background: 'var(--color-border)', margin: '0 auto 8px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ProviderTile size={44} />
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 21, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
            Desconectar o Google?
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-sec)', lineHeight: 1.5 }}>
          Você continua entrando com código no e-mail{hasPassword ? ' ou com sua senha' : ''}. Dá pra conectar de novo quando quiser.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
          <Btn full size="lg" icon="unlink" loading={busy} onClick={onConfirm}>
            Desconectar
          </Btn>
          <Btn full variant="soft" size="lg" disabled={busy} onClick={onCancel}>
            Manter conectado
          </Btn>
        </div>
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 12.5,
        fontWeight: 600,
        color: 'var(--color-text-sec)',
        margin: '0 0 8px',
      }}
    >
      {children}
    </p>
  )
}

function EditActions({
  onCancel,
  onSave,
  loading,
  saveDisabled,
}: {
  onCancel: () => void
  onSave: () => void
  loading: boolean
  saveDisabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <button
        onClick={onCancel}
        disabled={loading}
        style={{
          flex: 1,
          height: 50,
          background: 'transparent',
          color: 'var(--color-text)',
          borderRadius: 'var(--radius-btn)',
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          fontWeight: 600,
          border: '1.5px solid var(--color-border)',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        Cancelar
      </button>
      <button
        onClick={onSave}
        disabled={loading || saveDisabled}
        style={{
          flex: 1,
          height: 50,
          background: 'var(--color-espresso)',
          color: 'var(--color-primary-btn-text)',
          borderRadius: 'var(--radius-btn)',
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          fontWeight: 600,
          border: 'none',
          cursor: loading || saveDisabled ? 'not-allowed' : 'pointer',
          opacity: loading || saveDisabled ? 0.6 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        {loading ? 'Salvando...' : 'Salvar'}
      </button>
    </div>
  )
}
