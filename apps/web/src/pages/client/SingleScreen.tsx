/**
 * SingleScreen — tela de pedido único do cliente
 *
 * Permite agendar uma entrega avulsa para uma data específica.
 * Os créditos são reservados na hora via POST /orders.
 *
 * Requirements: SCHED-01
 * Source: screens-order.jsx linhas 255–324, 04-UI-SPEC.md seções 7–12
 */
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { useSchedule } from '../../hooks/useSchedule'
import { Icon } from '../../components/brand/Icon'
import QuantityStepper from '../../components/client/QuantityStepper'
import BannerInsuficiente from '../../components/client/BannerInsuficiente'
import DateChips from '../../components/client/DateChips'
import { apiFetch } from '../../lib/apiFetch'

export function SingleScreen() {
  const navigate = useNavigate()
  const { user, updateCreditBalance } = useAuth()
  const creditBalance = user?.creditBalance ?? 0

  const { deliveryTime } = useSchedule(creditBalance)

  const [qtd, setQtd] = useState(1)
  const [quando, setQuando] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const semCredito = qtd > creditBalance
  const isDisabled = semCredito || !quando || isSubmitting

  const handleSubmit = async () => {
    if (isDisabled) return

    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      const res = await apiFetch('/orders', {
        method: 'POST',
        body: JSON.stringify({ quantity: qtd, scheduledDate: quando }),
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.status === 201) {
        const data = await res.json() as { creditBalance?: number }
        if (data.creditBalance !== undefined) {
          updateCreditBalance(data.creditBalance)
        }
        setToast({ message: 'Pedido agendado!', ok: true })
        setTimeout(() => {
          navigate('/client/agenda')
        }, 1500)
      } else if (res.status === 400) {
        setErrorMsg('Créditos insuficientes para este pedido.')
      } else {
        setErrorMsg('Não conseguimos criar o pedido. Tente novamente.')
      }
    } catch {
      setErrorMsg('Não conseguimos criar o pedido. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--color-app-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Toast de feedback */}
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
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '6px 20px 14px',
          paddingTop: 'calc(6px + env(safe-area-inset-top))',
          background: 'var(--color-app-bg)',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          aria-label="voltar"
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            border: 'none',
            background: 'var(--color-surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon name="arrowL" size={20} color="var(--color-text)" />
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
          Pedido único
        </h1>
      </div>

      {/* Área scrollável */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 20px',
          paddingBottom: 90,
        }}
      >
        {/* Subtexto introdutório */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: 'var(--color-text-sec)',
            lineHeight: 1.5,
            marginBottom: 18,
            marginTop: 0,
          }}
        >
          Agende uma entrega avulsa para uma data. Os créditos são reservados na hora.
        </p>

        {/* Card QuantityStepper */}
        <div
          style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--color-border-2)',
            padding: 22,
            marginBottom: 16,
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12.5,
              fontWeight: 700,
              color: 'var(--color-text-sec)',
              letterSpacing: '0.04em',
              margin: 0,
              marginBottom: 16,
              textTransform: 'uppercase',
            }}
          >
            QUANTOS PÃES?
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {/* warn === accent no tema claro (#B0702A) — cor mantida pelo componente em ambos os estados */}
            <QuantityStepper
              min={1}
              max={20}
              value={qtd}
              onChange={setQtd}
            />
          </div>
        </div>

        {/* DateChips */}
        <DateChips
          value={quando}
          onChange={setQuando}
          deliveryTime={deliveryTime ?? '07:00'}
        />

        {/* Banner de erro backend */}
        {errorMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              background: 'var(--color-surface)',
              border: '1.5px solid var(--color-border)',
              borderRadius: 16,
              padding: '13px 14px',
              marginBottom: 12,
            }}
          >
            <Icon name="alert" size={18} color="var(--color-accent)" />
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13.5,
                color: 'var(--color-text)',
                margin: 0,
                lineHeight: 1.45,
              }}
            >
              {errorMsg}
            </p>
          </div>
        )}

        {/* Condicional: BannerInsuficiente ou CreditCard */}
        {semCredito ? (
          <BannerInsuficiente
            saldo={creditBalance}
            requerido={qtd}
            onComprar={() => navigate('/client/creditos')}
            onAjustar={(novaQtd) => setQtd(novaQtd)}
          />
        ) : (
          /* CreditCard — estado suficiente */
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--color-border-2)',
              padding: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {/* Lado esquerdo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <Icon name="wallet" size={20} color="var(--color-accent)" />
              <div>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 700,
                    fontSize: 14,
                    color: 'var(--color-text)',
                    margin: 0,
                  }}
                >
                  Usar créditos
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 12,
                    color: 'var(--color-text-ter)',
                    margin: '2px 0 0 0',
                  }}
                >
                  Sobram {creditBalance - qtd} de {creditBalance} créditos
                </p>
              </div>
            </div>

            {/* Lado direito */}
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 18,
                color: 'var(--color-text)',
                margin: 0,
                flexShrink: 0,
              }}
            >
              {qtd} 🥖
            </p>
          </div>
        )}
      </div>

      {/* Footer fixo */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          padding: '14px 20px',
          paddingBottom: 'calc(14px + env(safe-area-inset-bottom))',
          borderTop: '1px solid var(--color-border-2)',
          background: 'var(--color-app-bg)',
        }}
      >
        <button
          onClick={handleSubmit}
          disabled={isDisabled}
          style={{
            width: '100%',
            minHeight: 52,
            borderRadius: 'var(--radius-btn)',
            border: 'none',
            background: 'var(--color-espresso)',
            color: 'var(--color-primary-btn-text)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 16,
            cursor: isDisabled ? 'default' : 'pointer',
            opacity: isDisabled ? 0.45 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'opacity .15s',
          }}
        >
          {isSubmitting ? (
            <>
              <svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ animation: 'spin 1s linear infinite' }}
              >
                <path d="M21 12a9 9 0 1 1-3-6.7" />
              </svg>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              Reservando...
            </>
          ) : (
            <>
              <Icon name="check" size={18} color="var(--color-primary-btn-text)" />
              Reservar e confirmar
            </>
          )}
        </button>
      </div>
    </div>
  )
}
