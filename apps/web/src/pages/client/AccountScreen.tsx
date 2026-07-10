import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { apiFetch } from '../../lib/apiFetch'
import { CondoSearch } from '../../components/auth/CondoSearch'
import { Icon } from '../../components/brand/Icon'

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
  const [showCondoDialog, setShowCondoDialog] = useState(false)

  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null)

  const showToast = (message: string, ok: boolean) => {
    setToast({ message, ok })
    setTimeout(() => setToast(null), 2500)
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
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as { scheduleDeactivated?: boolean }
        const update = {
          condominiumId: selectedCondo.id,
          condominiumName: selectedCondo.name,
          apartment: apartment.trim(),
          block: block.trim() || undefined,
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
    setEditingEndereco(false)
  }

  const isBlocksCondo = selectedCondo?.type === 'BLOCKS'

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--color-app-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: 'var(--color-espresso)',
            color: 'var(--color-primary-btn-text)',
            borderRadius: 12,
            padding: '12px 16px',
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 14,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
          }}
        >
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px', paddingBottom: 80 }}>
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
              <ReadRow label="Nome completo" value={user?.name} />
              <ReadRow label="Data de nascimento" value={formatBirthDate(user?.birthDate)} />
              <ReadRow label="CPF" value={user?.cpf} last />
            </>
          )}
        </SectionCard>

        {/* Seção: Contato */}
        <SectionCard title="Contato">
          <ContactRow
            label="Telefone"
            value={user?.phone ?? undefined}
            onEdit={() => navigate('/client/perfil/editar-contato')}
          />
          <div style={{ height: 12 }} />
          <ContactRow
            label="E-mail"
            value={user?.email ?? undefined}
            onEdit={() => navigate('/client/perfil/editar-contato')}
          />
        </SectionCard>

        {/* Seção: Segurança */}
        <SectionCard title="Segurança">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--color-text-sec)',
                  margin: '0 0 2px',
                }}
              >
                Senha
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--color-text)', margin: 0 }}>
                ••••••••
              </p>
            </div>
            <button
              onClick={() => navigate('/change-password')}
              style={{
                background: 'var(--color-surface-2)',
                border: 'none',
                borderRadius: 10,
                padding: '8px 14px',
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-accent)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              Trocar
            </button>
          </div>
        </SectionCard>

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

              <FieldLabel>Apartamento</FieldLabel>
              <input
                type="text"
                value={apartment}
                onChange={(e) => setApartment(e.target.value)}
                placeholder="Ex: 101"
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
              <ReadRow label="Condomínio" value={user?.condominiumName} />
              <ReadRow label="Apartamento" value={user?.apartment} />
              <ReadRow label="Bloco / Torre" value={user?.block} last />
            </>
          )}
        </SectionCard>
      </div>

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
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-card)',
        padding: 24,
        boxShadow: 'var(--shadow-soft)',
        marginBottom: 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--color-text)',
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h2>
        {onEdit && !editing && (
          <button
            onClick={onEdit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--color-surface-2)',
              border: 'none',
              borderRadius: 10,
              padding: '7px 12px',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--color-accent)',
              cursor: 'pointer',
            }}
          >
            <Icon name="edit" size={15} color="var(--color-accent)" />
            Editar
          </button>
        )}
      </div>
      {children}
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

function ReadRow({ label, value, last = false }: { label: string; value?: string; last?: boolean }) {
  return (
    <div
      style={{
        paddingBottom: last ? 0 : 14,
        marginBottom: last ? 0 : 14,
        borderBottom: last ? 'none' : '1px solid var(--color-border-2)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12.5,
          fontWeight: 600,
          color: 'var(--color-text-sec)',
          margin: '0 0 2px',
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          color: value ? 'var(--color-text)' : 'var(--color-text-ter)',
          margin: 0,
        }}
      >
        {value || 'Não informado'}
      </p>
    </div>
  )
}

function ContactRow({ label, value, onEdit }: { label: string; value?: string; onEdit: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--color-text-sec)',
            margin: '0 0 2px',
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            color: value ? 'var(--color-text)' : 'var(--color-text-ter)',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {value ?? 'Não informado'}
        </p>
      </div>
      <button
        onClick={onEdit}
        style={{
          background: 'var(--color-surface-2)',
          border: 'none',
          borderRadius: 10,
          padding: '8px 14px',
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-accent)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Editar
      </button>
    </div>
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
