import { useState, useRef } from 'react'
import { apiFetch } from '../../../../lib/apiFetch'
import { Icon } from '../../../../components/brand/Icon'
import { type ExpenseCategory, currentMonthBrt } from './expense-types'

/**
 * QuickExpense (E1) — lançar despesa em 3 toques: valor, categoria, salvar.
 *
 * É a funcionalidade que decide se o módulo de despesas vive ou morre. Um módulo de despesa não
 * falha por falta de relatório; falha por **atrito de lançamento**. Isto é um PWA no celular: o
 * dono lança o combustível **no posto**, não em casa à noite — quando ele não lança.
 *
 * Por isso, três escolhas deliberadas:
 *   - **Teclado numérico grande**, não `<input type="number">`: o valor é o que se digita sempre,
 *     e o teclado do sistema em campo numérico esconde metade da tela no celular.
 *   - **Data implícita = hoje, já paga.** É o caso real do lançamento rápido (dinheiro que acabou
 *     de sair). Quem precisa lançar conta a vencer usa o formulário completo.
 *   - **Foto opcional e não bloqueante.** Upload que falha (rede ruim na rua) não pode impedir o
 *     registro: a despesa é salva sem anexo e o admin anexa depois.
 */

interface QuickExpenseProps {
  categories: ExpenseCategory[]
  onClose: () => void
  onSaved: () => void
}

/** Categorias oferecidas primeiro no atalho — as que se lançam na rua. */
const FAVORITES = ['Combustível', 'Embalagem', 'Entregador', 'Manutenção', 'Outras']

export function QuickExpense({ categories, onClose, onSaved }: QuickExpenseProps) {
  // Valor em CENTAVOS como string de dígitos: evita o estado intermediário inválido de um campo
  // decimal ("1,", "1,5,5") e torna a formatação trivial.
  const [cents, setCents] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const amount = Number(cents || '0') / 100
  const canSave = amount > 0 && categoryId != null && !isSaving

  // Favoritas primeiro, na ordem de FAVORITES; o resto depois, na ordem do cadastro.
  const ordered = [
    ...FAVORITES.map((n) => categories.find((c) => c.name === n)).filter(
      (c): c is ExpenseCategory => c != null,
    ),
    ...categories.filter((c) => !FAVORITES.includes(c.name)),
  ]

  const press = (digit: string) => {
    setError(null)
    // Teto de R$ 99.999,99 — evita o dedo escorregado que vira uma despesa de milhões.
    setCents((c) => (c.length >= 7 ? c : c === '' && digit === '0' ? '' : c + digit))
  }

  const backspace = () => setCents((c) => c.slice(0, -1))

  const pickPhoto = async (file: File) => {
    setIsUploading(true)
    setError(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await apiFetch('/admin/expenses/receipt', { method: 'POST', body })
      if (res.ok) {
        setReceiptUrl(((await res.json()) as { url: string }).url)
      } else {
        // Falha de upload NÃO bloqueia: o aviso é informativo e o lançamento segue possível.
        setError('Comprovante não subiu — você pode salvar sem ele e anexar depois.')
      }
    } catch {
      setError('Comprovante não subiu — você pode salvar sem ele e anexar depois.')
    } finally {
      setIsUploading(false)
    }
  }

  const save = async () => {
    if (!canSave) return
    setIsSaving(true)
    setError(null)

    const today = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date())

    const category = categories.find((c) => c.id === categoryId)
    try {
      const res = await apiFetch('/admin/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId,
          // Descrição em branco usa o nome da categoria: obrigar a digitar texto anularia o ganho
          // do atalho, e a API exige ao menos 2 caracteres.
          description: description.trim() !== '' ? description.trim() : (category?.name ?? 'Despesa'),
          amount,
          competenceDate: today,
          paidAt: today,
          ...(receiptUrl ? { receiptUrl } : {}),
        }),
      })
      if (res.ok) {
        onSaved()
        onClose()
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Lançamento rápido de despesa"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--color-app-bg)',
        zIndex: 300,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* AppBar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 8px' }}>
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
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
          }}
        >
          <Icon name="x" size={18} color="var(--color-text)" />
        </button>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 19,
            fontWeight: 700,
            color: 'var(--color-text)',
            margin: 0,
            flex: 1,
          }}
        >
          Lançamento rápido
        </h2>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 12px' }}>
        {/* Valor */}
        <div style={{ textAlign: 'center', padding: '14px 0 6px' }}>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 42,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: amount > 0 ? 'var(--color-text)' : 'var(--color-text-ter)',
              margin: 0,
            }}
          >
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11.5,
              color: 'var(--color-text-ter)',
              margin: '2px 0 0',
            }}
          >
            Hoje · já paga
          </p>
        </div>

        {/* Categoria */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--color-text-ter)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            margin: '10px 0 8px',
          }}
        >
          Categoria
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {ordered.map((c) => {
            const active = c.id === categoryId
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCategoryId(c.id)
                  setError(null)
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  minHeight: 38,
                  padding: '0 13px',
                  borderRadius: 99,
                  border: `1px solid ${active ? 'transparent' : 'var(--color-border-2)'}`,
                  background: active ? 'var(--color-espresso)' : 'var(--color-surface)',
                  color: active ? '#FAF5EC' : 'var(--color-text-sec)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {c.emoji && <span>{c.emoji}</span>}
                {c.name}
              </button>
            )
          })}
        </div>

        {/* Descrição opcional + comprovante */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Observação (opcional)"
            maxLength={140}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 44,
              padding: '0 12px',
              borderRadius: 12,
              border: '1px solid var(--color-border-2)',
              background: 'var(--color-surface)',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--color-text)',
            }}
          />
          <button
            type="button"
            aria-label="Anexar comprovante"
            onClick={() => fileRef.current?.click()}
            disabled={isUploading}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              border: `1px solid ${receiptUrl ? 'transparent' : 'var(--color-border-2)'}`,
              background: receiptUrl ? 'var(--color-gold-soft)' : 'var(--color-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isUploading ? 'default' : 'pointer',
              flexShrink: 0,
            }}
          >
            <Icon
              name={receiptUrl ? 'check' : 'camera'}
              size={19}
              color={receiptUrl ? '#8A6A00' : 'var(--color-text-ter)'}
            />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            // `capture` abre a câmera direto no celular — é o gesto do lançamento na rua.
            capture="environment"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void pickPhoto(f)
            }}
            style={{ display: 'none' }}
          />
        </div>

        {error && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              color: 'var(--color-bad, #C2410C)',
              margin: '10px 0 0',
            }}
          >
            {error}
          </p>
        )}
      </div>

      {/* Teclado + salvar */}
      <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--color-border-2)', paddingTop: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0'].map((k) => (
            <Key key={k} label={k} onPress={() => press(k)} />
          ))}
          <Key label="⌫" onPress={backspace} ariaLabel="Apagar dígito" />
        </div>

        <button
          type="button"
          onClick={() => void save()}
          disabled={!canSave}
          style={{
            width: '100%',
            minHeight: 50,
            marginTop: 10,
            borderRadius: 14,
            border: 'none',
            background: canSave ? 'var(--color-espresso)' : 'var(--color-surface-2)',
            color: canSave ? '#FAF5EC' : 'var(--color-text-ter)',
            fontFamily: 'var(--font-body)',
            fontSize: 15.5,
            fontWeight: 800,
            cursor: canSave ? 'pointer' : 'default',
          }}
        >
          {isSaving ? 'Salvando…' : 'Salvar despesa'}
        </button>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            color: 'var(--color-text-ter)',
            textAlign: 'center',
            margin: '8px 0 0',
          }}
        >
          Conta a vencer, fornecedor ou centro de custo? Use o formulário completo.
        </p>
      </div>
    </div>
  )
}

function Key({
  label,
  onPress,
  ariaLabel,
}: {
  label: string
  onPress: () => void
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? label}
      onClick={onPress}
      style={{
        minHeight: 52,
        borderRadius: 13,
        border: '1px solid var(--color-border-2)',
        background: 'var(--color-surface)',
        fontFamily: 'var(--font-display)',
        fontSize: 20,
        fontWeight: 700,
        color: 'var(--color-text)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

/** Exportado para teste: o mês de competência do atalho é sempre o corrente. */
export { currentMonthBrt as quickExpenseMonth }
