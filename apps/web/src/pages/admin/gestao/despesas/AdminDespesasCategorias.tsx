import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../../../lib/apiFetch'
import { Icon } from '../../../../components/brand/Icon'
import {
  EXPENSE_GROUP_LABEL,
  EXPENSE_GROUP_ORDER,
  type ExpenseGroup,
} from '@cheirin-de-pao/shared'
import { type ExpenseCategory } from './expense-types'

/**
 * AdminDespesasCategorias — cadastro de categorias de despesa (decisão 4).
 *
 * O que a tela precisa comunicar, e por isso está escrito nela: é o **grupo** que define a linha
 * do DRE, não a categoria. Assim o admin cria "Pedágio" dentro de Operação sem deploy e sem
 * quebrar a demonstração.
 *
 * `isFixed` também é explicado: é o que torna o ponto de equilíbrio calculável. Sem a marcação,
 * não há como separar o custo que existe com venda zero.
 */

interface Props {
  onBack: () => void
}

export function AdminDespesasCategorias({ onBack }: Props) {
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [name, setName] = useState('')
  const [group, setGroup] = useState<ExpenseGroup>('OPERATION')
  const [isFixed, setIsFixed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiFetch('/admin/expense-categories?includeInactive=true')
      setCategories(res.ok ? ((await res.json()) as ExpenseCategory[]) : [])
    } catch {
      setCategories([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const create = async () => {
    if (name.trim().length < 2) return
    setError(null)
    try {
      const res = await apiFetch('/admin/expense-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), group, isFixed }),
      })
      if (res.ok) {
        setName('')
        setIsFixed(false)
        setIsAdding(false)
        await load()
        return
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      setError(body?.error ?? 'Não foi possível criar.')
    } catch {
      setError('Falha de conexão.')
    }
  }

  const toggleActive = async (c: ExpenseCategory) => {
    await apiFetch(`/admin/expense-categories/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !c.isActive }),
    })
    void load()
  }

  const toggleFixed = async (c: ExpenseCategory) => {
    await apiFetch(`/admin/expense-categories/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFixed: !c.isFixed }),
    })
    void load()
  }

  const byGroup = EXPENSE_GROUP_ORDER.map((g) => ({
    group: g,
    items: categories.filter((c) => c.group === g),
  })).filter((g) => g.items.length > 0)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 14px' }}>
        <button type="button" aria-label="Voltar" onClick={onBack} style={iconBtn}>
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
          Categorias de despesa
        </h2>
        <button
          type="button"
          aria-label="Nova categoria"
          onClick={() => setIsAdding((v) => !v)}
          style={iconBtn}
        >
          <Icon name={isAdding ? 'x' : 'plus'} size={18} color="var(--color-text)" />
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '0 20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            color: 'var(--color-text-ter)',
            margin: 0,
            lineHeight: 1.45,
          }}
        >
          O <strong>grupo</strong> define em que linha do DRE a categoria entra — por isso você pode
          criar categorias novas sem que a demonstração mude de forma. <strong>Fixa</strong> marca o
          custo que existe mesmo com venda zero, e é o que permite calcular o ponto de equilíbrio.
        </p>

        {isAdding && (
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border-2)',
              borderRadius: 16,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome da categoria"
              maxLength={60}
              style={inputStyle}
            />
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value as ExpenseGroup)}
              style={inputStyle}
            >
              {EXPENSE_GROUP_ORDER.map((g) => (
                <option key={g} value={g}>
                  {EXPENSE_GROUP_LABEL[g]}
                </option>
              ))}
            </select>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-text-sec)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={isFixed}
                onChange={(e) => setIsFixed(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--color-accent)' }}
              />
              Despesa fixa (existe mesmo sem venda)
            </label>
            {error && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-bad, #C2410C)', margin: 0 }}>
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => void create()}
              disabled={name.trim().length < 2}
              style={{
                minHeight: 44,
                borderRadius: 12,
                border: 'none',
                background: name.trim().length >= 2 ? 'var(--color-espresso)' : 'var(--color-surface-2)',
                color: name.trim().length >= 2 ? '#FAF5EC' : 'var(--color-text-ter)',
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                fontWeight: 700,
                cursor: name.trim().length >= 2 ? 'pointer' : 'default',
              }}
            >
              Criar categoria
            </button>
          </div>
        )}

        {isLoading ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)', textAlign: 'center', paddingTop: 20 }}>
            Carregando…
          </p>
        ) : (
          byGroup.map(({ group: g, items }) => (
            <div key={g}>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-ter)',
                  margin: '4px 0 6px',
                }}
              >
                {EXPENSE_GROUP_LABEL[g]}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {items.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border-2)',
                      borderRadius: 14,
                      padding: '11px 13px',
                      opacity: c.isActive ? 1 : 0.55,
                    }}
                  >
                    <span style={{ fontSize: 16, width: 20, textAlign: 'center', flexShrink: 0 }}>
                      {c.emoji ?? '•'}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontFamily: 'var(--font-body)',
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: 'var(--color-text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.name}
                    </span>

                    <button
                      type="button"
                      onClick={() => void toggleFixed(c)}
                      aria-label={c.isFixed ? `${c.name}: marcar como variável` : `${c.name}: marcar como fixa`}
                      style={{
                        minHeight: 28,
                        padding: '0 9px',
                        borderRadius: 99,
                        border: `1px solid ${c.isFixed ? 'transparent' : 'var(--color-border-2)'}`,
                        background: c.isFixed ? 'var(--color-gold-soft)' : 'transparent',
                        color: c.isFixed ? '#8A6A00' : 'var(--color-text-ter)',
                        fontFamily: 'var(--font-body)',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {c.isFixed ? 'fixa' : 'variável'}
                    </button>

                    <button
                      type="button"
                      onClick={() => void toggleActive(c)}
                      aria-label={c.isActive ? `Desativar ${c.name}` : `Ativar ${c.name}`}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon
                        name={c.isActive ? 'check' : 'ban'}
                        size={17}
                        color={c.isActive ? 'var(--color-good, #227842)' : 'var(--color-text-ter)'}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

const iconBtn = {
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
} as const

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
