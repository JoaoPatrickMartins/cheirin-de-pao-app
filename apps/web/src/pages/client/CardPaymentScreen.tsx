import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { CardPayment } from '@mercadopago/sdk-react'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../../components/brand/Icon'
import { SavedCardsList } from '../../components/client/SavedCardsList'
import type { SavedCard } from '../../components/client/SavedCardItem'

interface CardState {
  comboId?: string
  customQuantity?: number
  amount: number
}

export function CardPaymentScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state as CardState | null) ?? { amount: 0 }
  const { comboId, customQuantity, amount } = state

  // Estado do Brick (preservado)
  const [brickLoading, setBrickLoading] = useState(true)
  const [brickError, setBrickError] = useState<string | null>(null)

  // Estado dos cartões salvos (novo — Modo A)
  const [savedCards, setSavedCards] = useState<SavedCard[]>([])
  const [loadingCards, setLoadingCards] = useState(true)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [addCardExpanded, setAddCardExpanded] = useState(false)
  // Modo A (Brick expandido): checked por padrão
  const [saveForLater, setSaveForLater] = useState(true)
  // Modo B (sem cartões salvos): unchecked por padrão (conforme spec)
  const [saveModeBCard, setSaveModeBCard] = useState(false)
  const [cvv, setCvv] = useState('')
  const [cvvError, setCvvError] = useState<string | null>(null)

  // Estado de pagamento
  const [isProcessing, setIsProcessing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 2500)
  }

  // Carregar cartões salvos na montagem
  useEffect(() => {
    const loadCards = async () => {
      try {
        const res = await apiFetch('/users/me/cards')
        if (res.ok) {
          const cards = (await res.json()) as SavedCard[]
          setSavedCards(cards)
          // Pré-selecionar: cartão padrão ou primeiro
          const defaultCard = cards.find((c) => c.isDefault)
          const firstCard = cards[0]
          const toSelect = defaultCard ?? firstCard
          if (toSelect) setSelectedCardId(toSelect.id)
        }
        // Se erro: permitir que o Brick apareça diretamente (Modo B degradado)
      } catch {
        // Falha silenciosa — Modo B
      } finally {
        setLoadingCards(false)
      }
    }
    void loadCards()
  }, [])

  const hasSavedCards = savedCards.length > 0

  // Pagamento com cartão salvo
  const handlePayWithSavedCard = async () => {
    if (isProcessing) return
    if (!selectedCardId) return

    // WR-02: validação do CVV considera o número de dígitos exigido pela bandeira.
    // Amex (brand === 'amex') exige 4 dígitos (CID); demais bandeiras exigem 3.
    const selectedCard = savedCards.find((c) => c.id === selectedCardId)
    const requiredCvvLength = selectedCard?.brand === 'amex' ? 4 : 3
    if (cvv.length < requiredCvvLength) {
      setCvvError(`Informe o código de segurança (${requiredCvvLength} dígitos)`)
      return
    }

    setIsProcessing(true)
    setBrickError(null)
    const cvvToSend = cvv
    setCvv('') // T-12-07: limpar CVV imediatamente após disparar o POST

    try {
      const res = await apiFetch('/payments/card', {
        method: 'POST',
        body: JSON.stringify({
          savedCardId: selectedCardId,
          securityCode: cvvToSend,
          comboId,
          customQuantity,
        }),
      })

      if (res.ok) {
        const comboQty = customQuantity ?? 1
        navigate('/client/creditos/sucesso', { state: { quantity: comboQty } })
      } else {
        const err = (await res.json()) as { error?: string }
        showToast(err.error ?? 'Erro no pagamento. Verifique os dados e tente novamente.')
      }
    } catch {
      showToast('Algo deu errado. Verifique sua conexão e tente novamente.')
    } finally {
      setIsProcessing(false)
    }
  }

  // Pagamento com novo cartão (Brick onSubmit)
  const handleBrickSubmit = async (formData: Record<string, unknown>) => {
    setBrickError(null)
    setIsProcessing(true)
    try {
      const payer = formData.payer as
        | { email?: string; identification?: { type: string; number: string } }
        | undefined
      const res = await apiFetch('/payments/card', {
        method: 'POST',
        body: JSON.stringify({
          token: formData.token,
          installments: formData.installments,
          issuerId: formData.issuer_id,
          paymentMethodId: formData.payment_method_id,
          payerEmail: payer?.email,
          payerIdentification: payer?.identification,
          comboId,
          customQuantity,
          saveCard: hasSavedCards ? saveForLater : saveModeBCard,
        }),
      })

      if (res.ok) {
        const comboQty = customQuantity ?? 1
        navigate('/client/creditos/sucesso', { state: { quantity: comboQty } })
      } else {
        const err = (await res.json()) as { error?: string }
        setBrickError(err.error ?? 'Erro no pagamento. Tente novamente.')
      }
    } catch {
      setBrickError('Algo deu errado. Verifique sua conexão e tente novamente.')
    } finally {
      setIsProcessing(false)
    }
  }

  // Determinar label e ação do CTA
  const ctaLabel = (() => {
    if (hasSavedCards && selectedCardId !== null && !addCardExpanded) return 'Pagar com este cartão'
    // CR-02: o label do Brick é controlado via customization.visual.buttonLabel — não há
    // botão externo. O Brick renderiza sempre seu próprio submit; este label não é usado aqui.
    if (!hasSavedCards) return 'Pagar com cartão' // Modo B com Brick
    return null
  })()

  const showPrimaryBtn =
    (!hasSavedCards) ||
    (hasSavedCards && selectedCardId !== null && !addCardExpanded)

  return (
    <div
      style={{
        minHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom))',
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
            color: '#FBF3E4',
            borderRadius: 12,
            padding: '12px 16px',
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 15,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
          }}
        >
          {toast}
        </div>
      )}

      {/* Scroll area */}
      <div style={{ flex: 1, padding: '20px', paddingBottom: 116, overflowY: 'auto' }}>
        {/* AppBar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => navigate('/client/creditos')}
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
              fontWeight: 600,
              fontSize: 21,
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Pagamento com cartão
          </h1>
        </div>

        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            color: 'var(--color-text-ter)',
            margin: '0 0 24px',
          }}
        >
          Pagamento processado com segurança pelo Mercado Pago
        </p>

        {/* ── MODO A: cliente tem cartões salvos ── */}
        {hasSavedCards && !loadingCards && (
          <>
            {/* Seção: Seus cartões */}
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                fontWeight: 600,
                letterSpacing: '0.04em',
                color: 'var(--color-text-sec)',
                margin: '0 0 12px',
              }}
            >
              SEUS CARTÕES
            </p>

            <SavedCardsList
              cards={savedCards}
              loading={false}
              mode="select"
              selectedCardId={selectedCardId}
              onSelect={(id) => {
                setSelectedCardId(id)
                setAddCardExpanded(false)
              }}
            />

            {/* CVV input — exibido abaixo da lista quando cartão salvo selecionado */}
            {selectedCardId !== null && !addCardExpanded && (
              <div style={{ marginTop: 16 }}>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: 'var(--color-text-sec)',
                    margin: '0 0 8px',
                  }}
                >
                  Código de segurança (CVV)
                </p>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={cvv}
                  placeholder="•••"
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '')
                    setCvv(val)
                    if (cvvError) setCvvError(null)
                  }}
                  style={{
                    width: 100,
                    border: cvvError
                      ? '1.5px solid #C0392B'
                      : '1.5px solid var(--color-border)',
                    borderRadius: 'var(--radius-field)',
                    padding: '12px 14px',
                    fontFamily: 'var(--font-body)',
                    fontSize: 15,
                    color: 'var(--color-text)',
                    background: 'var(--color-surface)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {cvvError && (
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 12.5,
                      color: '#C0392B',
                      margin: '6px 0 0',
                    }}
                  >
                    {cvvError}
                  </p>
                )}
              </div>
            )}

            {/* Separador "ou" */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                margin: '20px 0',
              }}
            >
              <div style={{ flex: 1, height: 1, background: 'var(--color-border-2)' }} />
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12.5,
                  color: 'var(--color-text-ter)',
                }}
              >
                ou
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border-2)' }} />
            </div>

            {/* Card: Adicionar novo cartão (colapsável) */}
            <div
              role="button"
              aria-expanded={addCardExpanded}
              tabIndex={0}
              onClick={() => {
                if (!addCardExpanded) {
                  setAddCardExpanded(true)
                  setSelectedCardId(null)
                  setCvv('')
                  setCvvError(null)
                }
              }}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !addCardExpanded) {
                  setAddCardExpanded(true)
                  setSelectedCardId(null)
                  setCvv('')
                  setCvvError(null)
                }
              }}
              style={{
                borderRadius: 22,
                background: 'var(--color-surface)',
                border: addCardExpanded
                  ? '2px solid var(--color-accent)'
                  : '2px solid var(--color-border)',
                boxShadow: 'var(--shadow-soft)',
                overflow: 'hidden',
                cursor: addCardExpanded ? 'default' : 'pointer',
                transition: 'border 150ms ease-out',
              }}
            >
              {/* Header do card — sempre visível */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 16,
                }}
              >
                <Icon name="plus" size={24} color="var(--color-accent)" />
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 15,
                    color: 'var(--color-text)',
                  }}
                >
                  Adicionar novo cartão
                </span>
              </div>

              {/* Conteúdo expandido: Brick + checkbox */}
              {addCardExpanded && (
                <div style={{ padding: '0 16px 16px' }}>
                  {brickError && (
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 14,
                        color: '#C0392B',
                        marginBottom: 12,
                      }}
                    >
                      {brickError}
                    </p>
                  )}
                  <div style={{ borderRadius: 16 }}>
                    {/*
                      CR-02: o Brick controla seu próprio submit via onSubmit.
                      Usamos customization.visual.buttonLabel para alterar o label do botão
                      interno do Brick de acordo com o estado do checkbox "Salvar para compras futuras".
                      Isso elimina a necessidade de um botão externo "Pagar sem salvar" — que não
                      conseguiria acionar programaticamente o submit do Brick.
                    */}
                    <CardPayment
                      initialization={{ amount }}
                      customization={{
                        visual: {
                          buttonLabel: saveForLater ? 'Salvar cartão e pagar' : 'Pagar sem salvar',
                        },
                      }}
                      onSubmit={handleBrickSubmit as unknown as Parameters<typeof CardPayment>[0]['onSubmit']}
                      onError={() =>
                        setBrickError(
                          'Erro ao carregar o formulário. Recarregue a página e tente novamente.',
                        )
                      }
                      onReady={() => setBrickLoading(false)}
                    />
                  </div>
                  {brickLoading && (
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 14,
                        color: 'var(--color-text-sec)',
                        marginTop: 8,
                      }}
                    >
                      Carregando formulário...
                    </p>
                  )}
                  {/* Checkbox salvar */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginTop: 16,
                      cursor: 'pointer',
                      minHeight: 44,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={saveForLater}
                      onChange={(e) => setSaveForLater(e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: 'var(--color-accent)', cursor: 'pointer' }}
                    />
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 14,
                        color: 'var(--color-text-sec)',
                      }}
                    >
                      Salvar para compras futuras
                    </span>
                  </label>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── MODO A: loading dos cartões ── */}
        {loadingCards && (
          <SavedCardsList
            cards={[]}
            loading={true}
            mode="select"
          />
        )}

        {/* ── MODO B: sem cartões salvos (Brick direto) ── */}
        {!loadingCards && !hasSavedCards && (
          <>
            {brickError && (
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  color: '#C0392B',
                  marginBottom: 12,
                }}
              >
                {brickError}
              </p>
            )}
            {brickLoading && (
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  color: 'var(--color-text-sec)',
                }}
              >
                Carregando formulário de pagamento...
              </p>
            )}
            <div style={{ borderRadius: 16 }}>
              <CardPayment
                initialization={{ amount }}
                onSubmit={handleBrickSubmit as unknown as Parameters<typeof CardPayment>[0]['onSubmit']}
                onError={() =>
                  setBrickError(
                    'Erro ao carregar o formulário. Recarregue a página e tente novamente.',
                  )
                }
                onReady={() => setBrickLoading(false)}
              />
            </div>
            {/* Checkbox salvar — Modo B, unchecked por padrão */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginTop: 16,
                cursor: 'pointer',
                minHeight: 44,
              }}
            >
              <input
                type="checkbox"
                checked={saveModeBCard}
                onChange={(e) => setSaveModeBCard(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--color-accent)', cursor: 'pointer' }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  color: 'var(--color-text-sec)',
                }}
              >
                Salvar este cartão para compras futuras
              </span>
            </label>
          </>
        )}
      </div>

      {/* ── CTA bar fixa — padrão CombosScreen.tsx ── */}
      {!loadingCards && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(56px + env(safe-area-inset-bottom))',
            left: 0,
            right: 0,
            padding: '10px 20px 12px',
            background: 'var(--color-app-bg)',
            borderTop: '1px solid var(--color-border-2)',
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
          }}
        >
          {/*
            CR-02: Quando addCardExpanded é true, o Brick possui seu próprio botão de submit
            (com label controlado via customization.visual.buttonLabel).
            O CTA externo só é renderizado para Modo B (sem cartões) e Modo A com cartão
            salvo selecionado — nunca quando o Brick está expandido.
          */}
          {showPrimaryBtn && (
            <button
              onClick={() => {
                if (!hasSavedCards) {
                  // Modo B — o Brick controla seu próprio submit; nada a fazer aqui
                  return
                }
                // Modo A com cartão salvo selecionado
                void handlePayWithSavedCard()
              }}
              disabled={isProcessing}
              style={{
                width: '100%',
                minHeight: 52,
                borderRadius: 'var(--radius-btn)',
                border: 'none',
                background: 'var(--color-accent)',
                color: 'var(--color-primary-btn-text)',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 15,
                cursor: isProcessing ? 'default' : 'pointer',
                opacity: isProcessing ? 0.7 : 1,
              }}
            >
              {isProcessing ? 'Processando...' : ctaLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
