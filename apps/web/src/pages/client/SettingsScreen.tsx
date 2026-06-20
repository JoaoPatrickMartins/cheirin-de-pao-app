import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { apiFetch } from '../../lib/apiFetch'
import { CondoSearch } from '../../components/auth/CondoSearch'
import { Icon } from '../../components/brand/Icon'
import { SavedCardsList } from '../../components/client/SavedCardsList'
import type { SavedCard } from '../../components/client/SavedCardItem'

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

export function SettingsScreen() {
  const auth = useAuth()
  const navigate = useNavigate()
  const { user } = auth

  const [name, setName] = useState(user?.name ?? '')
  const [birthDate, setBirthDate] = useState(user?.birthDate?.split('T')[0] ?? '')
  const [condos, setCondos] = useState<Condo[]>([])
  const [selectedCondo, setSelectedCondo] = useState<SelectedCondo | null>(
    user?.condominiumId ? { id: user.condominiumId, name: user.condominiumName ?? '', type: '' } : null,
  )
  const [apartment, setApartment] = useState(user?.apartment ?? '')
  const [block, setBlock] = useState(user?.block ?? '')
  const [showCondoDialog, setShowCondoDialog] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null)

  // Cartões salvos
  const [savedCards, setSavedCards] = useState<SavedCard[]>([])
  const [loadingCards, setLoadingCards] = useState(true)
  const [cardError, setCardError] = useState<string | null>(null)
  const [removingCardId, setRemovingCardId] = useState<string | null>(null)
  const [cardToRemove, setCardToRemove] = useState<SavedCard | null>(null)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)

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

  useEffect(() => {
    apiFetch('/users/me/cards')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((cards: SavedCard[]) => setSavedCards(cards))
      .catch(() => setCardError('Não foi possível carregar seus cartões. Tente novamente.'))
      .finally(() => setLoadingCards(false))
  }, [])

  const handleCondoSelect = (id: string) => {
    const found = condos.find((c) => c.id === id)
    if (found) setSelectedCondo({ id: found.id, name: found.name, type: found.type })
  }

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
      } else {
        showToast('Não foi possível salvar. Tente novamente.', false)
      }
    } catch {
      showToast('Não foi possível salvar. Tente novamente.', false)
    } finally {
      setLoading(false)
    }
  }

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
      } else {
        showToast('Não foi possível salvar. Tente novamente.', false)
      }
    } catch {
      showToast('Não foi possível salvar. Tente novamente.', false)
    } finally {
      setLoading(false)
    }
  }

  const handleSetDefault = async (cardId: string) => {
    try {
      const res = await apiFetch(`/users/me/cards/${cardId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isDefault: true }),
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        setSavedCards((prev) =>
          prev.map((c) => ({ ...c, isDefault: c.id === cardId })),
        )
        showToast('Cartão padrão atualizado.', true)
      } else {
        showToast('Algo deu errado. Tente novamente.', false)
      }
    } catch {
      showToast('Algo deu errado. Tente novamente.', false)
    }
  }

  const handleRemovePress = (card: SavedCard) => {
    setCardToRemove(card)
    setShowRemoveDialog(true)
  }

  const handleRemoveConfirm = async () => {
    if (!cardToRemove) return
    setRemovingCardId(cardToRemove.id)
    try {
      const res = await apiFetch(`/users/me/cards/${cardToRemove.id}`, { method: 'DELETE' })
      if (res.ok || res.status === 204) {
        setSavedCards((prev) => prev.filter((c) => c.id !== cardToRemove.id))
        showToast('Cartão removido.', true)
        setShowRemoveDialog(false)
        setCardToRemove(null)
      } else {
        showToast('Algo deu errado. Tente novamente.', false)
      }
    } catch {
      showToast('Algo deu errado. Tente novamente.', false)
    } finally {
      setRemovingCardId(null)
    }
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

      {/* Header */}
      <div
        style={{
          paddingTop: 'calc(6px + env(safe-area-inset-top))',
          padding: '6px 20px 14px',
        }}
      >
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
          Perfil
        </h1>
      </div>

      {/* Scroll area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px', paddingBottom: 80 }}>

        {/* Seção: Dados Pessoais */}
        <SectionCard title="Dados Pessoais">
          <FieldLabel>Nome completo</FieldLabel>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
          <div style={{ height: 16 }} />

          <FieldLabel>Data de nascimento</FieldLabel>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            style={inputStyle}
          />
          <div style={{ height: 16 }} />

          <FieldLabel>CPF</FieldLabel>
          <input
            type="text"
            value={user?.cpf ?? ''}
            readOnly
            style={{
              ...inputStyle,
              opacity: 0.7,
              background: 'var(--color-surface-2)',
              cursor: 'not-allowed',
            }}
          />
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12.5,
              color: 'var(--color-text-ter)',
              margin: '6px 0 0',
            }}
          >
            O CPF não pode ser alterado.
          </p>
          <div style={{ height: 20 }} />

          <PrimaryButton onClick={handleSaveDados} loading={loading}>
            Salvar dados
          </PrimaryButton>
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

        {/* Seção: Cartões */}
        <SectionCard title="Cartões">
          <SavedCardsList
            cards={savedCards}
            loading={loadingCards}
            error={cardError}
            mode="manage"
            onSetDefault={handleSetDefault}
            onRemove={(id) => handleRemovePress(savedCards.find((c) => c.id === id)!)}
            removingId={removingCardId}
          />
          {!loadingCards && !cardError && savedCards.length > 0 && savedCards.length < 3 && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                color: 'var(--color-text-ter)',
                textAlign: 'center',
                marginTop: 16,
                marginBottom: 0,
              }}
            >
              Adicione cartões ao fazer uma compra na tela de Créditos.
            </p>
          )}
        </SectionCard>

        {/* Seção: Condomínio */}
        <SectionCard title="Condomínio">
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

          <PrimaryButton onClick={handleSaveEndereco} loading={loading} disabled={!selectedCondo || !apartment.trim()}>
            Salvar endereço
          </PrimaryButton>
        </SectionCard>

        {/* Seção: Conta */}
        <SectionCard title="Conta">
          <button
            onClick={() => auth.logout()}
            style={{
              color: '#C0392B',
              background: 'none',
              border: 'none',
              minHeight: 44,
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            Sair
          </button>
        </SectionCard>
      </div>

      {/* Dialog: confirmar remoção de cartão */}
      {showRemoveDialog && cardToRemove && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setShowRemoveDialog(false)
            setCardToRemove(null)
          }}
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
              Remover cartão
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
              Tem certeza que deseja remover o cartão •••• {cardToRemove.lastFour}? Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => {
                  setShowRemoveDialog(false)
                  setCardToRemove(null)
                }}
                style={{
                  width: '100%',
                  height: 52,
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
                Manter cartão
              </button>
              <button
                onClick={() => void handleRemoveConfirm()}
                disabled={removingCardId !== null}
                style={{
                  width: '100%',
                  height: 52,
                  background: '#C0392B',
                  color: '#FFFFFF',
                  borderRadius: 'var(--radius-btn)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  fontWeight: 700,
                  border: 'none',
                  cursor: removingCardId !== null ? 'not-allowed' : 'pointer',
                  opacity: removingCardId !== null ? 0.7 : 1,
                }}
              >
                {removingCardId !== null ? 'Removendo...' : 'Remover cartão'}
              </button>
            </div>
          </div>
        </div>
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

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-card)',
        padding: 24,
        boxShadow: 'var(--shadow-soft)',
        marginBottom: 24,
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--color-text)',
          margin: '0 0 16px',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h2>
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

function ContactRow({ label, value, onEdit }: { label: string; value?: string; onEdit: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <div>
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
        Editar contato
      </button>
    </div>
  )
}

interface PrimaryButtonProps {
  onClick: () => void
  loading?: boolean
  disabled?: boolean
  children: React.ReactNode
}

function PrimaryButton({ onClick, loading = false, disabled = false, children }: PrimaryButtonProps) {
  const isDisabled = disabled || loading
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      style={{
        background: 'var(--color-espresso)',
        color: 'var(--color-primary-btn-text)',
        borderRadius: 'var(--radius-btn)',
        height: 52,
        width: '100%',
        fontFamily: 'var(--font-body)',
        fontSize: 15,
        fontWeight: 600,
        border: 'none',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.6 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {loading ? 'Salvando...' : children}
    </button>
  )
}
