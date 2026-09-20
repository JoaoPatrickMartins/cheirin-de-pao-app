import { useState, useEffect, useRef } from 'react'
import { CREDIT_SCALE, creditsForPrice, custoComPaezinhos, formatCredits } from '@cheirin-de-pao/shared'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { SwitchToggle } from '../../../components/admin/SwitchToggle'
import { ConfirmSheet } from '../../../components/admin/ConfirmSheet'
import { storeHoursSummary } from '../../../lib/product-availability'
import type { MarketCategory, MarketProduct } from './MarketProdutos'

const WEEKDAYS: { key: string; label: string }[] = [
  { key: 'seg', label: 'Seg' },
  { key: 'ter', label: 'Ter' },
  { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' },
  { key: 'sex', label: 'Sex' },
  { key: 'sab', label: 'Sáb' },
  { key: 'dom', label: 'Dom' },
]

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

interface Combo {
  name: string
  quantity: number
  price: number
}

interface MarketProductFormProps {
  id?: string
  categories: MarketCategory[]
  onBack: () => void
  onSaved: () => void
}

export function MarketProductForm({ id, categories, onBack, onSaved }: MarketProductFormProps) {
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [preco, setPreco] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [stockType, setStockType] = useState<'DAILY' | 'FIXED'>('FIXED')
  const [stockValue, setStockValue] = useState('')
  const [dias, setDias] = useState<string[]>([]) // vazio = sempre
  const [restrito, setRestrito] = useState(false)
  // Horário de VENDA — relógio de loja. `horaFecha` = availableUntil, `horaReabre` = availableFrom.
  const [janela, setJanela] = useState(false)
  const [horaFecha, setHoraFecha] = useState('')
  const [horaReabre, setHoraReabre] = useState('')
  // Novidade: o prazo é parte da marcação — selo sem prazo vira novidade eterna.
  const [novidade, setNovidade] = useState(false)
  const [novidadeDias, setNovidadeDias] = useState<number | null>(14)
  // Sem isto, salvar uma edição de nome reiniciaria a contagem do selo — o prazo só é reenviado
  // quando o admin realmente mexeu nos controles de novidade.
  const [novidadeDirty, setNovidadeDirty] = useState(false)
  // Promoção — é PREÇO, não enfeite: desconto real, com prazo que vence sozinho.
  const [promo, setPromo] = useState(false)
  const [promoTipo, setPromoTipo] = useState<'PERCENT' | 'FIXED'>('PERCENT')
  const [promoValor, setPromoValor] = useState('')
  const [promoDias, setPromoDias] = useState<number | null>(7)
  const [promoDirty, setPromoDirty] = useState(false)
  const [unitCost, setUnitCost] = useState<number | null>(null)
  const [ativo, setAtivo] = useState(true)
  // Pão Francês (produto fixo): só apresentação é editável — preço/estoque/ativo/exclusão travados.
  const [isBread, setIsBread] = useState(false)

  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Precificação ao vivo
  const [avulsoUnit, setAvulsoUnit] = useState(0)
  const [combos, setCombos] = useState<Combo[]>([])

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const loadPricing = async () => {
      try {
        const [aRes, cRes] = await Promise.all([apiFetch('/admin/settings/avulso'), apiFetch('/admin/combos')])
        if (aRes.ok) setAvulsoUnit(((await aRes.json()) as { unitPrice: number }).unitPrice)
        if (cRes.ok) setCombos((await cRes.json()) as Combo[])
      } catch {
        /* silencioso — só afeta a prévia */
      }
    }
    void loadPricing()
  }, [])

  useEffect(() => {
    if (!id) return
    const load = async () => {
      try {
        const res = await apiFetch(`/admin/market/products/${id}`)
        if (res.ok) {
          const p = (await res.json()) as MarketProduct
          setNome(p.name)
          setDescricao(p.description ?? '')
          setCategoryId(p.categoryId)
          setPreco(String(p.price))
          setPhotoUrl(p.photoUrl ?? null)
          setStockType(p.stockType)
          setStockValue(String(p.stockType === 'FIXED' ? (p.stock ?? 0) : (p.dailyCapacity ?? 0)))
          const d = p.availableDays ?? []
          setDias(d)
          setRestrito(d.length > 0)
          setHoraReabre(p.availableFrom ?? '')
          setHoraFecha(p.availableUntil ?? '')
          setJanela(!!(p.availableFrom || p.availableUntil))
          setNovidade(!!p.isNew)
          // Um prazo já gravado é preservado no PATCH (mandamos `newUntil: undefined`); só
          // "até eu remover" precisa ser reenviado explicitamente como null.
          setNovidadeDias(p.isNew && !p.newUntil ? null : 14)
          setPromo(!!p.isPromo)
          setPromoTipo(p.promoType ?? 'PERCENT')
          setPromoValor(p.promoValue != null ? String(p.promoValue) : '')
          setPromoDias(p.isPromo && !p.promoUntil ? null : 7)
          setUnitCost(p.unitCost ?? null)
          setAtivo(p.isActive)
          setIsBread(!!p.isBread)
        }
      } catch {
        /* silencioso */
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [id])

  const precoNum = Number(preco)
  // Preço em pãezinhos (milésimos) — a mesma conta do checkout. O crédito é fracionado, então
  // cobre 100% do preço e o custo com saldo é SEMPRE menor que o preço em dinheiro. Antes o
  // aviso arredondava para cima e mostrava um custo MAIOR (R$ 1,80 saía como "2 pãezinhos =
  // R$ 2,00 a R$ 2,30"), sugerindo que pagar com saldo era pior — era o bug que originou tudo.
  const milli = creditsForPrice(precoNum, avulsoUnit)
  const comboCosts = combos
    .filter((c) => c.quantity > 0)
    .map((c) => ({ name: c.name, cost: custoComPaezinhos(precoNum, avulsoUnit, c.price / c.quantity) }))
  const minCombo = comboCosts.length ? comboCosts.reduce((a, b) => (b.cost < a.cost ? b : a)) : null
  const maxCombo = comboCosts.length ? comboCosts.reduce((a, b) => (b.cost > a.cost ? b : a)) : null

  const handleUpload = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await apiFetch('/admin/market/upload', { method: 'POST', body: fd })
      if (res.ok) {
        setPhotoUrl(((await res.json()) as { url: string }).url)
      } else {
        const e = (await res.json().catch(() => null)) as { error?: string } | null
        setError(e?.error ?? 'Não foi possível enviar a foto.')
      }
    } catch {
      setError('Erro de conexão ao enviar a foto.')
    } finally {
      setUploading(false)
    }
  }

  const toggleDia = (key: string) =>
    setDias((prev) => (prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]))

  // Horário de venda: se ligado, exige ao menos uma ponta. Cruzar a meia-noite é legítimo
  // (fecha 20:00, reabre 22:00); só fechar e reabrir na MESMA hora não faz sentido.
  const janelaOk =
    !janela || ((!!horaFecha || !!horaReabre) && !(horaFecha && horaReabre && horaFecha === horaReabre))

  // Promoção — mesma régua do backend (lib/product-pricing.ts), para a tela nunca deixar enviar
  // algo que o servidor vai recusar: teto de 90%, desconto fixo menor que o preço, e o preço
  // resultante nunca em zero.
  const promoValorNum = Number(promoValor)
  const promoPreco =
    promo && promoValorNum > 0
      ? Math.round(
          (promoTipo === 'PERCENT' ? precoNum * (1 - promoValorNum / 100) : precoNum - promoValorNum) * 100,
        ) / 100
      : null
  const promoOk =
    !promo ||
    (promoValorNum > 0 &&
      (promoTipo === 'PERCENT' ? promoValorNum <= 90 : promoValorNum < precoNum) &&
      (promoPreco ?? 0) >= 0.01)
  const promoAbaixoDoCusto = promoPreco != null && unitCost != null && promoPreco < unitCost

  const isValid = isBread
    ? nome.trim() !== '' && categoryId !== '' && (!restrito || dias.length > 0)
    : nome.trim() !== '' && categoryId !== '' && precoNum > 0 && Number(stockValue) >= 0 &&
      (!restrito || dias.length > 0) && janelaOk && promoOk

  const handleSave = async () => {
    setError(null)
    setSaving(true)
    try {
      const stockNum = Number(stockValue)
      const daysPayload = restrito ? dias : id ? null : undefined
      const janelaPayload = {
        availableFrom: janela && horaReabre ? horaReabre : null,
        availableUntil: janela && horaFecha ? horaFecha : null,
      }
      // `newUntil` omitido = o backend preserva o prazo que já estava lá (e aplica o padrão de
      // 14 dias ao marcar pela primeira vez). Só "até eu remover" precisa do null explícito.
      const novidadePayload =
        id && !novidadeDirty
          ? {}
          : novidade
            ? {
                isNew: true,
                newUntil:
                  novidadeDias == null
                    ? null
                    : new Date(Date.now() + novidadeDias * 86_400_000).toISOString(),
              }
            : { isNew: false }
      // Mesma lógica do prazo da novidade: `promoUntil` omitido preserva o que já está gravado.
      const promoPayload =
        id && !promoDirty
          ? {}
          : promo
            ? {
                isPromo: true,
                promoType: promoTipo,
                promoValue: promoValorNum,
                promoUntil:
                  promoDias == null ? null : new Date(Date.now() + promoDias * 86_400_000).toISOString(),
              }
            : { isPromo: false }
      // Pão Francês: só apresentação (o backend ignora preço/estoque/ativo e força os valores fixos).
      const body = isBread
        ? {
            name: nome.trim(),
            description: descricao.trim() ? descricao.trim() : null,
            categoryId,
            photoUrl: photoUrl ?? null,
            availableDays: daysPayload,
          }
        : {
            name: nome.trim(),
            description: descricao.trim() ? descricao.trim() : id ? null : undefined,
            categoryId,
            price: precoNum,
            photoUrl: photoUrl ?? (id ? null : undefined),
            stockType,
            ...(stockType === 'FIXED' ? { stock: stockNum } : { dailyCapacity: stockNum }),
            availableDays: daysPayload,
            ...janelaPayload,
            ...novidadePayload,
            ...promoPayload,
            isActive: ativo,
          }
      const res = await apiFetch(id ? `/admin/market/products/${id}` : '/admin/market/products', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      })
      if (res.ok) {
        onSaved()
      } else {
        const e = (await res.json().catch(() => null)) as { error?: string } | null
        setError(e?.error ?? 'Não foi possível salvar. Tente novamente.')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setConfirmDelete(false)
    setSaving(true)
    try {
      const res = await apiFetch(`/admin/market/products/${id}`, { method: 'DELETE' })
      if (res.ok) onSaved()
      else setError('Não foi possível excluir.')
    } catch {
      setError('Erro de conexão.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
        Carregando...
      </div>
    )
  }

  return (
    <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Sub-AppBar do form */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0 4px' }}>
        <button type="button" aria-label="Voltar" onClick={onBack} style={miniBackStyle}>
          <Icon name="arrowL" size={18} color="var(--color-text)" />
        </button>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>
          {id ? 'Editar produto' : 'Novo produto'}
        </h3>
      </div>

      {isBread && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--color-gold-soft)', borderRadius: 14, padding: '12px 14px' }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>🥖</span>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text)', margin: 0, lineHeight: 1.45 }}>
            Item fixo da Cestinha. Você configura só a apresentação (foto, nome, descrição e dias).
            O <strong>preço</strong> e o <strong>mínimo</strong> vêm da <strong>Compra personalizada</strong> (pedido único) — é o mesmo pão, em outro fluxo.
          </p>
        </div>
      )}

      {/* Foto */}
      <div>
        <FieldLabel>Foto do produto</FieldLabel>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleUpload(f)
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{
            width: '100%',
            minHeight: 120,
            borderRadius: 14,
            border: '1.5px dashed var(--color-border)',
            background: 'var(--color-surface-alt, #FBF6EC)',
            cursor: uploading ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            padding: 0,
          }}
        >
          {photoUrl ? (
            <img src={photoUrl} alt="Prévia" style={{ width: '100%', height: 160, objectFit: 'cover' }} />
          ) : (
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
              {uploading ? 'Enviando…' : 'Toque para enviar (JPG/PNG/WebP ≤ 5 MB)'}
            </span>
          )}
        </button>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: '6px 2px 0' }}>
          Sem foto, usamos o ícone da categoria.
        </p>
      </div>

      <TextField label="Nome" value={nome} onChange={setNome} placeholder="Ex.: Geleia de Morango" />
      <TextField label="Descrição (opcional)" value={descricao} onChange={setDescricao} placeholder="Ex.: Feita com morangos da estação" />

      {/* Categoria */}
      <div>
        <FieldLabel>Categoria</FieldLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {categories.map((c) => {
            const active = categoryId === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                style={{
                  minHeight: 36,
                  padding: '0 13px',
                  borderRadius: 999,
                  border: active ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
                  background: active ? 'var(--color-surface)' : 'transparent',
                  color: active ? 'var(--color-accent)' : 'var(--color-text-sec)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {c.emoji ? `${c.emoji} ` : ''}{c.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Preço — travado no avulso para o Pão Francês */}
      {isBread ? (
        <div>
          <FieldLabel>Preço (R$)</FieldLabel>
          <div style={{ background: 'var(--color-surface-2)', borderRadius: 14, padding: '12px 14px' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              {formatBRL(avulsoUnit)} <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--color-text-ter)' }}>a unidade</span>
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: '4px 0 0' }}>
              Definido em Gestão → Compra personalizada (avulso).
            </p>
          </div>
        </div>
      ) : (
      <div>
        <TextField label="Preço (R$)" value={preco} onChange={setPreco} placeholder="Ex.: 12.00" type="number" step="0.01" />
        {milli > 0 && (
          <div style={{ background: 'var(--color-espresso)', borderRadius: 12, padding: '11px 13px', marginTop: 8 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-gold, #E3AC3F)', margin: 0 }}>
              🥖 = {formatCredits(milli)} {milli === CREDIT_SCALE ? 'pãozinho' : 'pãezinhos'}{' '}
              <span style={{ color: '#C9B79A', fontWeight: 600 }}>({formatBRL(avulsoUnit)}/pão)</span>
            </p>
            {minCombo && maxCombo && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#C9B79A', margin: '4px 0 0', lineHeight: 1.4 }}>
                Com saldo, o cliente gasta o equivalente a <strong style={{ color: '#F4E8D2' }}>{formatBRL(minCombo.cost)}</strong> ({minCombo.name})
                {maxCombo.name !== minCombo.name ? <> a <strong style={{ color: '#F4E8D2' }}>{formatBRL(maxCombo.cost)}</strong> ({maxCombo.name})</> : null}.
              </p>
            )}
            {milli % CREDIT_SCALE !== 0 && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: '#C9B79A', margin: '4px 0 0', lineHeight: 1.4 }}>
                Pago 100% com pãezinhos — o crédito é fracionado, então não sobra troco em dinheiro.
              </p>
            )}
          </div>
        )}
      </div>
      )}

      {/* Tipo de estoque + quantidade — o Pão Francês é sempre disponível (oculto) */}
      {!isBread && (
        <>
          <div>
            <FieldLabel>Tipo de estoque</FieldLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              <SegBtn active={stockType === 'DAILY'} onClick={() => setStockType('DAILY')} title="Diário" sub="Reseta a cada dia" />
              <SegBtn active={stockType === 'FIXED'} onClick={() => setStockType('FIXED')} title="Fixo" sub="Inventário total" />
            </div>
          </div>

          <TextField
            label={stockType === 'FIXED' ? 'Quantidade em estoque' : 'Capacidade por dia'}
            value={stockValue}
            onChange={setStockValue}
            placeholder="Ex.: 18"
            type="number"
          />
        </>
      )}

      {/* Dias de ENTREGA — validados contra a data escolhida no checkout. Não confundir com o
          horário de venda logo abaixo, que é relógio. */}
      <div>
        <FieldLabel>Dias de entrega</FieldLabel>
        <div style={{ display: 'flex', gap: 8, marginBottom: restrito ? 10 : 0 }}>
          <SegBtn active={!restrito} onClick={() => setRestrito(false)} title="Todos os dias" sub="Sem restrição" />
          <SegBtn active={restrito} onClick={() => setRestrito(true)} title="Dias da semana" sub="Escolher dias" />
        </div>
        {restrito && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {WEEKDAYS.map((d) => {
              const on = dias.includes(d.key)
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => toggleDia(d.key)}
                  style={{
                    minWidth: 46,
                    minHeight: 34,
                    borderRadius: 10,
                    border: on ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
                    background: on ? 'var(--color-surface)' : 'transparent',
                    color: on ? 'var(--color-accent)' : 'var(--color-text-sec)',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: 'pointer',
                  }}
                >
                  {d.label}
                </button>
              )
            })}
          </div>
        )}
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: '8px 2px 0', lineHeight: 1.45 }}>
          Em que dias este produto pode <strong>chegar</strong> na casa do cliente.
        </p>
      </div>

      {/* Horário de VENDA — relógio de loja. Bloco SEPARADO dos dias de propósito: os dias dizem
          quando o produto pode CHEGAR, o horário diz quando ele pode ser COMPRADO. Juntos, sob um
          título só, os dois pareciam a mesma regra. */}
      {!isBread && (
        <div>
          <FieldLabel>Horário de venda</FieldLabel>
          <div style={{ display: 'flex', gap: 8, marginBottom: janela ? 10 : 0 }}>
            <SegBtn active={!janela} onClick={() => setJanela(false)} title="Sempre aberto" sub="Vende a qualquer hora" />
            <SegBtn active={janela} onClick={() => setJanela(true)} title="Fecha e reabre" sub="Em horários fixos" />
          </div>
          {janela && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TimeField label="Fecha às" value={horaFecha} onChange={setHoraFecha} />
                <TimeField label="Reabre às" value={horaReabre} onChange={setHoraReabre} />
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: '7px 2px 0', lineHeight: 1.45 }}>
                Em que horas ele pode ser <strong>comprado</strong>. Deixe um campo vazio para usar
                a meia-noite.
              </p>
              {!janelaOk && (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 700, color: 'var(--color-accent)', margin: '7px 2px 0' }}>
                  {!horaFecha && !horaReabre
                    ? 'Preencha ao menos um horário.'
                    : 'O horário de fechar e o de reabrir não podem ser iguais.'}
                </p>
              )}
              {janelaOk && (
                <div style={{ background: 'var(--color-espresso)', borderRadius: 12, padding: '11px 13px', marginTop: 10 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: '#F4E8D2', margin: 0 }}>
                    🕐 {storeHoursSummary(horaReabre || null, horaFecha || null)}
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: '#C9B79A', margin: '4px 0 0', lineHeight: 1.45 }}>
                    Nesse intervalo o cliente vê “Esgotado”, para qualquer data de entrega. Volta
                    sozinho {horaReabre ? `às ${horaReabre}` : 'à meia-noite'}.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Novidade — sobe o produto para a frente da vitrine */}
      {!isBread && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 14, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                ✦ Marcar como novidade
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '1px 0 0', lineHeight: 1.4 }}>
                Aparece na frente da vitrine, logo depois do Pão Francês
              </p>
            </div>
            <SwitchToggle
              on={novidade}
              onChange={() => {
                setNovidade((v) => !v)
                setNovidadeDirty(true)
              }}
              aria-label="Marcar como novidade"
            />
          </div>

          {novidade && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
                {[7, 14, 30].map((d) => (
                  <PrazoChip
                    key={d}
                    active={novidadeDias === d}
                    onClick={() => {
                      setNovidadeDias(d)
                      setNovidadeDirty(true)
                    }}
                  >
                    {d} dias
                  </PrazoChip>
                ))}
                <PrazoChip
                  active={novidadeDias === null}
                  onClick={() => {
                    setNovidadeDias(null)
                    setNovidadeDirty(true)
                  }}
                >
                  Até eu remover
                </PrazoChip>
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: '8px 2px 0', lineHeight: 1.45 }}>
                {novidadeDias == null
                  ? 'O selo fica até você desmarcar.'
                  : novidadeDirty
                    ? `O selo sai sozinho em ${new Date(Date.now() + novidadeDias * 86_400_000).toLocaleDateString('pt-BR')}.`
                    : 'O prazo já definido será mantido. Toque num prazo para redefinir.'}
              </p>
            </>
          )}
        </div>
      )}

      {/* Ativo — o Pão Francês fica sempre ativo (oculto) */}
      {!isBread && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 14, padding: '12px 14px' }}>
          <div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Produto ativo</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '1px 0 0' }}>Aparece no catálogo do cliente</p>
          </div>
          <SwitchToggle on={ativo} onChange={() => setAtivo((v) => !v)} aria-label="Ativar produto" />
        </div>
      )}

      {/* Promoção — é preço, não enfeite. O cliente vê o "de/por", e o custo em pãezinhos cai junto. */}
      {!isBread && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 14, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                🏷 Promoção
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '1px 0 0', lineHeight: 1.4 }}>
                O cliente vê o preço antigo riscado e paga o novo
              </p>
            </div>
            <SwitchToggle
              on={promo}
              onChange={() => {
                setPromo((v) => !v)
                setPromoDirty(true)
              }}
              aria-label="Marcar promoção"
            />
          </div>

          {promo && (
            <>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <SegBtn
                  active={promoTipo === 'PERCENT'}
                  onClick={() => {
                    setPromoTipo('PERCENT')
                    setPromoDirty(true)
                  }}
                  title="Percentual"
                  sub="Ex.: 18%"
                />
                <SegBtn
                  active={promoTipo === 'FIXED'}
                  onClick={() => {
                    setPromoTipo('FIXED')
                    setPromoDirty(true)
                  }}
                  title="Valor fixo"
                  sub="Ex.: R$ 3,00"
                />
              </div>

              <div style={{ marginTop: 10 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'var(--color-surface-alt, #FBF6EC)',
                    border: `1.5px solid ${promoOk ? 'var(--color-border)' : 'var(--color-accent)'}`,
                    borderRadius: 14,
                    padding: '11px 14px',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-text-ter)' }}>
                    {promoTipo === 'PERCENT' ? '%' : 'R$'}
                  </span>
                  <input
                    type="number"
                    step={promoTipo === 'PERCENT' ? '1' : '0.01'}
                    value={promoValor}
                    onChange={(e) => {
                      setPromoValor(e.target.value)
                      setPromoDirty(true)
                    }}
                    placeholder={promoTipo === 'PERCENT' ? '18' : '3.00'}
                    aria-label="Valor do desconto"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontFamily: 'var(--font-body)',
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'var(--color-text)',
                    }}
                  />
                </div>
                {!promoOk && (
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 700, color: 'var(--color-accent)', margin: '7px 2px 0' }}>
                    {promoValorNum <= 0
                      ? 'Informe o desconto.'
                      : promoTipo === 'PERCENT'
                        ? 'O desconto máximo é 90%.'
                        : 'O desconto precisa ser menor que o preço do produto.'}
                  </p>
                )}
              </div>

              {/* Prévia do de/por — o número que o cliente vai ver */}
              {promoPreco != null && promoOk && (
                <div style={{ background: 'var(--color-espresso)', borderRadius: 12, padding: '11px 13px', marginTop: 10 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: '#F4E8D2', margin: 0 }}>
                    <span style={{ textDecoration: 'line-through', color: '#C9B79A', fontWeight: 600 }}>
                      {formatBRL(precoNum)}
                    </span>{' '}
                    → <span style={{ color: 'var(--color-gold, #E3AC3F)' }}>{formatBRL(promoPreco)}</span>
                  </p>
                  {promoAbaixoDoCusto && (
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: '#F0A58A', margin: '5px 0 0', lineHeight: 1.4 }}>
                      ⚠ Abaixo do custo ({formatBRL(unitCost ?? 0)}). Dá para salvar — só não passe
                      despercebido.
                    </p>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
                {[7, 14, 30].map((d) => (
                  <PrazoChip
                    key={d}
                    active={promoDias === d}
                    onClick={() => {
                      setPromoDias(d)
                      setPromoDirty(true)
                    }}
                  >
                    {d} dias
                  </PrazoChip>
                ))}
                <PrazoChip
                  active={promoDias === null}
                  onClick={() => {
                    setPromoDias(null)
                    setPromoDirty(true)
                  }}
                >
                  Até eu remover
                </PrazoChip>
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: '8px 2px 0', lineHeight: 1.45 }}>
                {promoDias == null
                  ? 'O preço promocional fica até você desligar.'
                  : promoDirty
                    ? `O preço volta ao cheio sozinho em ${new Date(Date.now() + promoDias * 86_400_000).toLocaleDateString('pt-BR')}.`
                    : 'O prazo já definido será mantido. Toque num prazo para redefinir.'}
                {' '}Para destacar na vitrine, use <strong>Ordenar</strong>.
              </p>
            </>
          )}
        </div>
      )}

      {/* Fornecimento (leitura) — quem fornece este produto e por quanto. A edição fica no
          fornecedor (D-8: o custo mora na relação, e é lá que ele é cadastrado). */}
      {id && <ProductSuppliers productId={id} />}

      {error && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-accent)', margin: 0 }}>{error}</p>
      )}

      {/* Salvar */}
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={!isValid || saving || uploading}
        style={{
          width: '100%',
          minHeight: 52,
          background: 'var(--color-espresso)',
          color: '#FAF5EC',
          border: 'none',
          borderRadius: 16,
          fontFamily: 'var(--font-body)',
          fontSize: 16,
          fontWeight: 700,
          cursor: !isValid || saving || uploading ? 'default' : 'pointer',
          opacity: !isValid || saving || uploading ? 0.5 : 1,
        }}
      >
        {saving ? 'Salvando...' : id ? 'Salvar alterações' : 'Criar produto'}
      </button>

      {id && !isBread && (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={saving}
          style={{ width: '100%', minHeight: 44, background: 'none', border: 'none', color: 'var(--color-bad, #C2410C)', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          Excluir produto
        </button>
      )}

      <ConfirmSheet
        open={confirmDelete}
        title="Excluir produto?"
        description="O produto sai do catálogo permanentemente. Para apenas ocultar, use o toggle 'Produto ativo'."
        confirmLabel="Excluir"
        tone="danger"
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}

// ── primitivas locais ──
const miniBackStyle: React.CSSProperties = {
  background: 'var(--color-surface-2)',
  border: 'none',
  width: 34,
  height: 34,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-sec)', marginBottom: 7 }}>
      {children}
    </div>
  )
}

function TextField({
  label, value, onChange, placeholder, type = 'text', step,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  step?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <label style={{ display: 'block' }}>
      <FieldLabel>{label}</FieldLabel>
      <div
        style={{
          background: 'var(--color-surface-alt, #FBF6EC)',
          border: `1.5px solid ${focused ? 'var(--color-accent)' : 'var(--color-border)'}`,
          borderRadius: 14,
          padding: '12px 14px',
        }}
      >
        <input
          type={type}
          value={value}
          step={step}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 500,
            color: 'var(--color-text)',
          }}
        />
      </div>
    </label>
  )
}

/** Campo de hora "HH:MM" — `type="time"` nativo, que no mobile abre o seletor do sistema. */
function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-surface-alt, #FBF6EC)', border: '1.5px solid var(--color-border)', borderRadius: 14, padding: '11px 13px' }}>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-ter)', flexShrink: 0 }}>
        {label}
      </span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--color-text)',
        }}
      />
    </label>
  )
}

function PrazoChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 34,
        padding: '0 13px',
        borderRadius: 999,
        border: active ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
        background: active ? 'var(--color-surface)' : 'transparent',
        color: active ? 'var(--color-accent)' : 'var(--color-text-sec)',
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        fontSize: 12.5,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function SegBtn({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        borderRadius: 12,
        border: active ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
        background: active ? 'var(--color-surface)' : 'transparent',
        padding: '10px 12px',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: active ? 'var(--color-accent)' : 'var(--color-text)', margin: 0 }}>{title}</p>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: '1px 0 0' }}>{sub}</p>
    </button>
  )
}

/**
 * ProductSuppliers — visão espelhada da matriz de fornecimento: quem fornece ESTE produto, por
 * quanto e com que fatia da demanda. Somente leitura.
 *
 * A edição é no fornecedor (D-8: a linha `(fornecedor, produto)` é o que afirma "fornece", e o
 * custo é dele). Aqui o valor é responder "meu bolo tem quem forneça?" sem sair da tela — porque um
 * produto sem fornecedor é vendido e não é comprado.
 */
function ProductSuppliers({ productId }: { productId: string }) {
  const [rows, setRows] = useState<
    Array<{ supplierId: string; supplierName: string; supplierActive: boolean; unitCost: number; defaultSharePct: number; isPreferred: boolean; isActive: boolean }>
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const r = await apiFetch(`/admin/market/products/${productId}/suppliers`)
        if (r.ok && active) setRows((await r.json()).suppliers)
      } catch {
        /* falha silenciosa */
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [productId])

  if (loading) return null

  const eligible = rows.filter((r) => r.isActive && r.supplierActive)
  const shareSum = eligible.reduce((s, r) => s + r.defaultSharePct, 0)
  const shareOff = eligible.length > 0 && shareSum !== 0 && shareSum !== 100

  return (
    <div
      style={{
        background: eligible.length === 0 ? '#F8E7DA' : 'var(--color-surface-alt, #FBF6EC)',
        border: `1.5px solid ${eligible.length === 0 ? '#E2B4A0' : 'var(--color-border)'}`,
        borderRadius: 14,
        padding: 13,
      }}
    >
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: eligible.length === 0 ? '#B4541F' : 'var(--color-text)', margin: 0 }}>
        Fornecimento
      </p>

      {eligible.length === 0 ? (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#8A3D14', margin: '4px 0 0', lineHeight: 1.45 }}>
          Nenhum fornecedor ativo cadastrado para este produto — ele não entra no pedido ao
          fornecedor. Cadastre em Gestão › Fornecedores, abrindo o fornecedor.
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
            {eligible.map((r) => (
              <div key={r.supplierId} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.supplierName}
                  {r.isPreferred && <span style={{ marginLeft: 5, fontSize: 9.5, fontWeight: 800, color: 'var(--color-accent)' }}>PADRÃO</span>}
                </span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-sec)', whiteSpace: 'nowrap' }}>
                  R$ {r.unitCost.toFixed(2).replace('.', ',')}
                  {r.defaultSharePct > 0 ? ` · ${r.defaultSharePct}%` : ''}
                </span>
              </div>
            ))}
          </div>
          {shareOff && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 700, color: '#B4541F', margin: '8px 0 0' }}>
              As fatias somam {shareSum}% — o pedido pode sair errado. Ajuste no fornecedor.
            </p>
          )}
        </>
      )}
    </div>
  )
}
