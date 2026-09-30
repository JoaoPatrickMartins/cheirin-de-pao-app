import { useState, useRef } from 'react'
import { apiFetch } from '../../../../lib/apiFetch'
import { Icon } from '../../../../components/brand/Icon'
import { EXPENSE_GROUP_LABEL } from '@cheirin-de-pao/shared'
import {
  type Expense,
  type ExpenseCategory,
  fmtBRL,
  toDateInput,
  currentMonthBrt,
} from './expense-types'

/**
 * ExpenseForm — o formulário completo de despesa.
 *
 * Complementa o {@link QuickExpense}: aqui entram as coisas que o atalho de 3 toques
 * deliberadamente não pede — vencimento (o que faz a despesa virar conta a pagar), fornecedor,
 * centro de custo e mês de competência diferente do mês do pagamento.
 *
 * A distinção **competência × pagamento** é o campo mais importante da tela e o menos intuitivo,
 * então ela é explicada na própria interface: os dois regimes do DRE dependem de cada uma das
 * datas, e o admin precisa entender por que existem duas.
 */

interface ExpenseFormProps {
  categories: ExpenseCategory[]
  /** Despesa em edição; ausente = novo lançamento. */
  expense?: Expense | null
  /** Mês em foco na lista — usado como competência padrão do novo lançamento. */
  month?: string
  onCancel: () => void
  onSaved: () => void
}

/** Primeiro dia do mês, em "AAAA-MM-DD". */
const firstDayOf = (month: string) => `${month}-01`

export function ExpenseForm({
  categories,
  expense,
  month,
  onCancel,
  onSaved,
}: ExpenseFormProps) {
  const isEdit = expense != null

  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? categories[0]?.id ?? '')
  const [description, setDescription] = useState(expense?.description ?? '')
  const [amount, setAmount] = useState(expense != null ? String(expense.amount) : '')
  const [competenceDate, setCompetenceDate] = useState(
    expense != null ? toDateInput(expense.competenceDate) : firstDayOf(month ?? currentMonthBrt()),
  )
  const [dueDate, setDueDate] = useState(toDateInput(expense?.dueDate))
  const [paidAt, setPaidAt] = useState(toDateInput(expense?.paidAt))
  const [payee, setPayee] = useState(expense?.payee ?? '')
  const [paymentMethod, setPaymentMethod] = useState(expense?.paymentMethod ?? '')
  const [notes, setNotes] = useState(expense?.notes ?? '')
  const [receiptUrl, setReceiptUrl] = useState<string | null>(expense?.receiptUrl ?? null)

  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const parsedAmount = Number(amount.replace(',', '.'))
  const canSave =
    categoryId !== '' &&
    description.trim().length >= 2 &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    competenceDate !== '' &&
    !isSaving

  const uploadReceipt = async (file: File) => {
    setIsUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await apiFetch('/admin/expenses/receipt', { method: 'POST', body })
      if (res.ok) setReceiptUrl(((await res.json()) as { url: string }).url)
      // Upload nunca bloqueia o lançamento — o aviso é informativo.
      else setError('Comprovante não subiu. Você pode salvar sem ele.')
    } catch {
      setError('Comprovante não subiu. Você pode salvar sem ele.')
    } finally {
      setIsUploading(false)
    }
  }

  const save = async () => {
    if (!canSave) return
    setIsSaving(true)
    setError(null)

    // Na edição, campo vazio é enviado como `null` para LIMPAR de fato (desmarcar pagamento,
    // remover vencimento). Na criação, campo vazio é simplesmente omitido.
    const payload: Record<string, unknown> = {
      categoryId,
      description: description.trim(),
      amount: parsedAmount,
      competenceDate,
    }
    const optional = (key: string, value: string) => {
      if (value !== '') payload[key] = value
      else if (isEdit) payload[key] = null
    }
    optional('dueDate', dueDate)
    optional('paidAt', paidAt)
    optional('payee', payee.trim())
    optional('paymentMethod', paymentMethod.trim())
    optional('notes', notes.trim())
    if (receiptUrl != null) payload.receiptUrl = receiptUrl
    else if (isEdit) payload.receiptUrl = null

    try {
      const res = await apiFetch(isEdit ? `/admin/expenses/${expense!.id}` : '/admin/expenses', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        onSaved()
        return
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      setError(body?.error ?? 'Não foi possível salvar.')
    } catch {
      setError('Falha de conexão. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  const grouped = categories.reduce<Record<string, ExpenseCategory[]>>((acc, c) => {
    ;(acc[c.group] ??= []).push(c)
    return acc
  }, {})

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 14px' }}>
        <button
          type="button"
          aria-label="Voltar"
          onClick={onCancel}
          style={{
            background: 'var(--color-surface-2)',
            border: 'none',
            width: 36,
            height: 36,
            borderRadius: 11,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon name="arrowL" size={18} color="var(--color-text)" />
        </button>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
            margin: 0,
            flex: 1,
          }}
        >
          {isEdit ? 'Editar despesa' : 'Nova despesa'}
        </h2>
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '0 20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <Card>
          <Field label="Categoria">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              style={inputStyle}
            >
              {Object.entries(grouped).map(([group, list]) => (
                <optgroup
                  key={group}
                  label={EXPENSE_GROUP_LABEL[group as keyof typeof EXPENSE_GROUP_LABEL] ?? group}
                >
                  {list.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji ? `${c.emoji} ` : ''}
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>

          <Field label="Descrição">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Aluguel do depósito · agosto"
              maxLength={140}
              style={inputStyle}
            />
          </Field>

          <Field label="Valor (R$)" hint={parsedAmount > 0 ? fmtBRL(parsedAmount) : undefined}>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
              inputMode="decimal"
              placeholder="0,00"
              style={inputStyle}
            />
          </Field>
        </Card>

        <Card title="Datas">
          {/* A distinção que o DRE exige, explicada onde ela é preenchida. */}
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11.5,
              color: 'var(--color-text-ter)',
              margin: '-4px 0 10px',
              lineHeight: 1.4,
            }}
          >
            <strong>Competência</strong> é o mês a que a despesa pertence — é o que o DRE usa.{' '}
            <strong>Pagamento</strong> é quando o dinheiro saiu — é o que o fluxo de caixa usa.
            Deixe o pagamento em branco para a despesa entrar em <strong>contas a pagar</strong>.
          </p>

          <Field label="Competência">
            <input
              type="date"
              value={competenceDate}
              onChange={(e) => setCompetenceDate(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Vencimento (opcional)" hint="Sem vencimento, a despesa não entra no alerta de atraso">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Pagamento (opcional)" hint={paidAt === '' ? 'Em branco = a pagar' : undefined}>
            <input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              style={inputStyle}
            />
          </Field>
        </Card>

        <Card title="Complementos">
          <Field label="Recebedor (opcional)">
            <input
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              placeholder="Ex.: João (entregador)"
              maxLength={80}
              style={inputStyle}
            />
          </Field>
          <Field label="Forma de pagamento (opcional)">
            <input
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              placeholder="Pix, dinheiro, boleto…"
              maxLength={40}
              style={inputStyle}
            />
          </Field>
          <Field label="Observações (opcional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={3}
              style={{ ...inputStyle, minHeight: 72, paddingTop: 10, resize: 'vertical' }}
            />
          </Field>

          <Field label="Comprovante (opcional)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={isUploading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  minHeight: 44,
                  padding: '0 14px',
                  borderRadius: 12,
                  border: '1px solid var(--color-border-2)',
                  background: 'var(--color-surface-2)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  cursor: isUploading ? 'default' : 'pointer',
                }}
              >
                <Icon name="camera" size={17} color="var(--color-text-sec)" />
                {isUploading ? 'Enviando…' : receiptUrl ? 'Trocar foto' : 'Anexar foto'}
              </button>
              {receiptUrl && (
                <button
                  type="button"
                  onClick={() => setReceiptUrl(null)}
                  aria-label="Remover comprovante"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Icon name="trash" size={17} color="var(--color-bad, #C2410C)" />
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void uploadReceipt(f)
              }}
              style={{ display: 'none' }}
            />
          </Field>
        </Card>

        {/* Auditoria (A4) — mudança de valor fica à vista de quem abrir a despesa depois. */}
        {isEdit && expense?.previousAmount != null && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11.5,
              color: 'var(--color-text-ter)',
              margin: 0,
            }}
          >
            Valor anterior: {fmtBRL(expense.previousAmount)}
          </p>
        )}

        {error && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12.5,
              color: 'var(--color-bad, #C2410C)',
              margin: 0,
            }}
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void save()}
          disabled={!canSave}
          style={{
            minHeight: 50,
            borderRadius: 999,
            border: 'none',
            background: canSave ? 'var(--color-espresso)' : 'var(--color-surface-2)',
            color: canSave ? '#FAF5EC' : 'var(--color-text-ter)',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 700,
            cursor: canSave ? 'pointer' : 'default',
          }}
        >
          {isSaving ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Lançar despesa'}
        </button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ primitivos

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box' as const,
  minHeight: 44,
  padding: '0 12px',
  borderRadius: 12,
  border: '1px solid var(--color-border-2)',
  background: 'var(--color-surface-2)',
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--color-text)',
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 18,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {title && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--color-text)',
            margin: 0,
          }}
        >
          {title}
        </p>
      )}
      {children}
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--color-text-sec)',
        }}
      >
        {label}
      </span>
      {children}
      {hint && (
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            color: 'var(--color-text-ter)',
          }}
        >
          {hint}
        </span>
      )}
    </label>
  )
}
