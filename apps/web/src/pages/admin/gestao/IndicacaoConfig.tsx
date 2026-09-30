import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  REFERRAL_LIMITS,
  REFERRAL_MESSAGE_VARS,
  referralMessageBonusWarning,
  referralMessageHasCodeOrLink,
  renderReferralMessage,
} from '@cheirin-de-pao/shared'
import { apiFetch } from '../../../lib/apiFetch'
import { formatBRL } from '../../../lib/market'
import { buildReferralLink } from '../../../lib/referral'
import { Icon } from '../../../components/brand/Icon'
import { RefCard, RefSkel, RF_BODY, RF_DISPLAY } from '../../../components/client/referral/RefPrimitives'
import { RaBtn, RaInline, RaLabel, RaSpinner, RaStepper, RaSwitch } from '../../../components/admin/referral/RaKit'

/** Resposta de `GET /admin/settings/indicacao`. */
interface ReferralSettings {
  ativa: boolean
  recompensa: number
  bonusIndicado: number
  compraMinima: number
  limiteMensal: number
  prazoDias: number
  mensagem: string
  campanha: { rotulo: string; multiplicador: number; inicio: string; fim: string } | null
  metas: Array<{ quantidade: number; bonus: number }>
  /** Quanto vale um pãozin em R$ (preço médio pago). 0 = sem base ainda. */
  unitPrice: number
  /** Dia BRT de hoje (YYYY-MM-DD), pelo relógio do servidor. */
  today: string
}

type Campaign = NonNullable<ReferralSettings['campanha']>

/** Exemplo da prévia — o código do handoff e o nome de quem indica. */
const PREVIEW_CODE = 'JOAO7K2F'
const PREVIEW_NAME = 'João'

/** "12,50" a partir de 12.5. */
function moneyText(v: number): string {
  return v.toFixed(2).replace('.', ',')
}

/** "12,5" / "12.50" / "" → número; texto que não é valor → NaN. */
function parseMoney(text: string): number {
  const t = text.trim().replace(/\./g, '').replace(',', '.')
  if (t === '') return 0
  return /^\d+(\.\d{0,2})?$/.test(t) ? Number(t) : NaN
}

/** Inteiro digitado num campo das metas; vazio/lixo → 0 (o erro aparece na linha). */
function parseIntField(text: string): number {
  const n = Number(text.replace(/\D/g, ''))
  return Number.isFinite(n) ? n : 0
}

/**
 * A3 — Configuração do Indique e Ganhe (handoff `RAConfig`). Todos os valores e regras do programa
 * (D-3), a campanha, as metas e a mensagem com prévia. Os erros do handoff (`zeroErr`, `msgErr`,
 * `bonusWarn`) aparecem ao vivo e travam o Salvar; o servidor confere as mesmas regras (422).
 */
export function IndicacaoConfig() {
  const [loaded, setLoaded] = useState<ReferralSettings | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const [ativa, setAtiva] = useState(false)
  // Tentou ligar com recompensa 0: o switch fica desligado e o aviso aparece (estado `zeroErr`).
  const [zeroAttempt, setZeroAttempt] = useState(false)
  const [rec, setRec] = useState(5)
  const [bon, setBon] = useState(0)
  const [minText, setMinText] = useState('0,00')
  const [lim, setLim] = useState(10)
  const [prazo, setPrazo] = useState(60)
  const [camp, setCamp] = useState(false)
  const [rotulo, setRotulo] = useState('Semana em dobro')
  const [mult, setMult] = useState(2)
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [metas, setMetas] = useState<Array<{ quantidade: number; bonus: number }>>([])
  const [msg, setMsg] = useState('')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const msgRef = useRef<HTMLTextAreaElement>(null)

  const apply = (s: Omit<ReferralSettings, 'unitPrice' | 'today'>) => {
    setAtiva(s.ativa)
    setRec(s.recompensa)
    setBon(s.bonusIndicado)
    setMinText(moneyText(s.compraMinima))
    setLim(s.limiteMensal)
    setPrazo(s.prazoDias)
    setCamp(!!s.campanha)
    if (s.campanha) {
      setRotulo(s.campanha.rotulo)
      setMult(s.campanha.multiplicador)
      setInicio(s.campanha.inicio)
      setFim(s.campanha.fim)
    }
    setMetas(s.metas.map((m) => ({ ...m })))
    setMsg(s.mensagem)
  }

  useEffect(() => {
    let cancelled = false
    setLoadError(false)
    void (async () => {
      try {
        const res = await apiFetch('/admin/settings/indicacao')
        if (!res.ok) throw new Error('falha')
        const data = (await res.json()) as ReferralSettings
        if (cancelled) return
        setLoaded(data)
        apply(data)
        // Sem campanha gravada, as datas partem de hoje (relógio do servidor) — o admin só ajusta.
        if (!data.campanha) {
          setInicio(data.today)
          setFim(data.today)
        }
      } catch {
        if (!cancelled) setLoadError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  /** Toda edição invalida o "Alterações salvas". */
  const edit =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      setSaved(false)
      setSaveError(null)
      set(v)
    }

  if (loadError) {
    return (
      <div style={{ padding: '4px 20px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <RaInline>Não conseguimos carregar a configuração.</RaInline>
        <RaBtn variant="soft" icon="refresh" onClick={() => setReloadKey((k) => k + 1)}>
          Tentar de novo
        </RaBtn>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div aria-busy="true" style={{ padding: '4px 20px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <RefSkel h={72} r={22} />
        <RefSkel h={140} r={22} />
        <RefSkel h={200} r={22} />
      </div>
    )
  }

  const min = parseMoney(minText)
  const minErr = Number.isNaN(min)
  const semVar = !referralMessageHasCodeOrLink(msg)
  const msgLen = msg.trim().length
  const msgLenErr = msgLen < REFERRAL_LIMITS.mensagem.min || msgLen > REFERRAL_LIMITS.mensagem.max
  const bonusZeroWarn = referralMessageBonusWarning(msg, bon)
  const zeroErr = rec === 0 && (ativa || zeroAttempt)

  const campaign: Campaign | null = camp ? { rotulo: rotulo.trim(), multiplicador: mult, inicio, fim } : null
  // A campanha já gravada pode ter vencido — salvar o resto não pode ser barrado por ela.
  const campChanged = JSON.stringify(campaign) !== JSON.stringify(loaded.campanha)
  const campErr = !campaign
    ? null
    : !campaign.rotulo
      ? 'Dê um nome à campanha.'
      : !campaign.inicio || !campaign.fim
        ? 'Escolha o início e o fim da campanha.'
        : campaign.inicio > campaign.fim
          ? 'O fim vem depois do início.'
          : campChanged && campaign.fim < loaded.today
            ? 'A campanha precisa terminar hoje ou depois.'
            : null

  const quantidades = metas.map((m) => m.quantidade)
  const metaErr = metas.some(
    (m) =>
      m.quantidade < REFERRAL_LIMITS.metaQuantidade.min ||
      m.quantidade > REFERRAL_LIMITS.metaQuantidade.max ||
      m.bonus < REFERRAL_LIMITS.metaBonus.min ||
      m.bonus > REFERRAL_LIMITS.metaBonus.max,
  )
    ? 'Cada meta vai da 1ª à 999ª indicação, com bônus de 1 a 50.'
    : new Set(quantidades).size !== quantidades.length
      ? 'Duas metas na mesma quantidade.'
      : null

  const blocked = semVar || msgLenErr || zeroErr || minErr || !!campErr || !!metaErr
  const preview = renderReferralMessage(msg, {
    code: PREVIEW_CODE,
    link: buildReferralLink(PREVIEW_CODE),
    name: PREVIEW_NAME,
    welcomeBreads: bon,
  })

  const toggleAtiva = (next: boolean) => {
    setSaved(false)
    setSaveError(null)
    if (next && rec === 0) {
      setZeroAttempt(true)
      return
    }
    setZeroAttempt(false)
    setAtiva(next)
  }

  const insertVar = (v: string) => {
    setSaved(false)
    setSaveError(null)
    const el = msgRef.current
    // Insere onde está o cursor; sem cursor (nunca focou), vai no fim — como o handoff.
    const at = el && document.activeElement === el ? el.selectionStart : msg.length
    const before = msg.slice(0, at)
    const glue = before.length > 0 && !/\s$/.test(before) ? ' ' : ''
    setMsg(`${before}${glue}${v}${msg.slice(at)}`)
  }

  const save = async () => {
    if (blocked || saving) return
    setSaving(true)
    setSaved(false)
    setSaveError(null)
    try {
      const res = await apiFetch('/admin/settings/indicacao', {
        method: 'PATCH',
        body: JSON.stringify({
          ativa,
          recompensa: rec,
          bonusIndicado: bon,
          compraMinima: min,
          limiteMensal: lim,
          prazoDias: prazo,
          mensagem: msg.trim(),
          campanha: campaign,
          metas: [...metas].sort((a, b) => a.quantidade - b.quantidade),
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setSaveError(body?.error ?? 'Não foi possível salvar. Tente novamente.')
        return
      }
      const data = (await res.json()) as Omit<ReferralSettings, 'unitPrice' | 'today'>
      apply(data)
      setLoaded({ ...loaded, ...data })
      setSaved(true)
    } catch {
      setSaveError('Erro de conexão. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const approx = (breads: number) => (loaded.unitPrice > 0 ? `≈ ${formatBRL(breads * loaded.unitPrice)}` : null)

  return (
    <div style={{ padding: '4px 20px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <RefCard pad={0} style={{ border: ativa ? '1.5px solid var(--color-gold)' : '1px solid var(--color-border-2)' }}>
        <Row
          label="Programa ativo"
          desc={ativa ? 'Clientes veem e compartilham o código.' : 'Desligado: as entradas somem do app. Quem já indicou ainda vê o histórico.'}
          last={!zeroErr}
        >
          <RaSwitch on={ativa} onChange={toggleAtiva} label="Programa ativo" />
        </Row>
        {zeroErr && (
          <div style={{ padding: '0 16px 14px' }}>
            <RaInline>Para ligar o programa, defina uma recompensa maior que 0 para quem indica.</RaInline>
          </div>
        )}
      </RefCard>

      <div>
        <RaLabel>Recompensas</RaLabel>
        <RefCard pad={0}>
          <Row
            label="Quem indica ganha"
            desc={
              rec > 0
                ? [approx(rec), 'por indicação que valer'].filter(Boolean).join(' ')
                : 'Obrigatório para ligar o programa'
            }
          >
            <RaStepper value={rec} onChange={edit(setRec)} min={REFERRAL_LIMITS.recompensa.min} max={REFERRAL_LIMITS.recompensa.max} label="recompensa de quem indica" />
          </Row>
          <Row
            label="Bônus do amigo"
            desc={bon > 0 ? [approx(bon), '0 = sem bônus'].filter(Boolean).join(' · ') : 'Sem bônus — o app não fala de presente pro amigo'}
            last
          >
            <RaStepper value={bon} onChange={edit(setBon)} min={REFERRAL_LIMITS.bonusIndicado.min} max={REFERRAL_LIMITS.bonusIndicado.max} label="bônus do amigo" />
          </Row>
        </RefCard>
      </div>

      <div>
        <RaLabel>Regras</RaLabel>
        <RefCard pad={0}>
          <Row label="Compra mínima do amigo" desc={min ? null : '0 = qualquer 1º pedido'}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                width: 104,
                background: 'var(--color-surface-alt)',
                border: `1.5px solid ${minErr ? 'var(--color-warn)' : 'var(--color-border)'}`,
                borderRadius: 12,
                padding: '9px 10px',
                flexShrink: 0,
              }}
            >
              <span style={{ fontFamily: RF_BODY, fontSize: 13, color: 'var(--color-text-ter)', fontWeight: 700 }}>R$</span>
              <input
                aria-label="Compra mínima do amigo em reais"
                inputMode="decimal"
                value={minText}
                onChange={(e) => edit(setMinText)(e.target.value)}
                onBlur={() => !Number.isNaN(parseMoney(minText)) && setMinText(moneyText(parseMoney(minText)))}
                style={{
                  width: '100%',
                  minWidth: 0,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontWeight: 700,
                  fontSize: 15,
                  color: 'var(--color-text)',
                  textAlign: 'right',
                  fontFamily: RF_BODY,
                }}
              />
            </label>
          </Row>
          {minErr && (
            <div style={{ padding: '0 16px 12px' }}>
              <RaInline>Digite um valor em reais, como 12,50.</RaInline>
            </div>
          )}
          <Row label="Limite por indicador / mês" desc="Acima disso vai para análise · 0 = sem limite">
            <RaStepper value={lim} onChange={edit(setLim)} min={REFERRAL_LIMITS.limiteMensal.min} max={REFERRAL_LIMITS.limiteMensal.max} label="limite por indicador por mês" />
          </Row>
          <Row label="Prazo para o 1º pedido" desc={`${prazo ? `${prazo} dias` : 'sem prazo'} · 0 = sem prazo`} last>
            <RaStepper value={prazo} onChange={edit(setPrazo)} min={REFERRAL_LIMITS.prazoDias.min} max={REFERRAL_LIMITS.prazoDias.max} label="prazo em dias" />
          </Row>
        </RefCard>
      </div>

      <div>
        <RaLabel>Campanha</RaLabel>
        <RefCard pad={0} style={{ border: camp ? '1.5px solid var(--color-gold)' : '1px solid var(--color-border-2)' }}>
          <Row
            label="Campanha por período"
            desc={camp ? 'Ativa — aparece com destaque no app' : 'Multiplica a recompensa de quem indica'}
            last={!camp}
          >
            <RaSwitch on={camp} onChange={edit(setCamp)} label="Campanha por período" />
          </Row>
          {camp && (
            <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'block' }}>
                <FieldLabel>Rótulo</FieldLabel>
                <input
                  value={rotulo}
                  maxLength={REFERRAL_LIMITS.campanhaRotulo.max}
                  onChange={(e) => edit(setRotulo)(e.target.value)}
                  style={fieldStyle}
                />
              </label>
              <div>
                <FieldLabel>Multiplicador</FieldLabel>
                <div role="group" aria-label="Multiplicador" style={{ display: 'flex', gap: 6 }}>
                  {[2, 3, 4, 5].map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={mult === m}
                      onClick={() => edit(setMult)(m)}
                      style={{
                        flex: 1,
                        minHeight: 44,
                        borderRadius: 12,
                        border: `1.5px solid ${mult === m ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        background: mult === m ? 'var(--color-gold-soft)' : 'var(--color-surface)',
                        color: mult === m ? 'var(--color-accent)' : 'var(--color-text)',
                        fontFamily: RF_DISPLAY,
                        fontWeight: 800,
                        fontSize: 16,
                        cursor: 'pointer',
                      }}
                    >
                      {m}×
                    </button>
                  ))}
                </div>
                <div aria-live="polite" style={{ fontFamily: RF_BODY, fontSize: 12, color: 'var(--color-text-sec)', marginTop: 7 }}>
                  Quem indicar no período ganha <b style={{ color: 'var(--color-text)' }}>{rec * mult} pãezins</b> em vez de {rec}.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <DateBox label="Início da campanha" value={inicio} onChange={edit(setInicio)} />
                <DateBox label="Fim da campanha" value={fim} onChange={edit(setFim)} />
              </div>
              {campErr && <RaInline>{campErr}</RaInline>}
            </div>
          )}
        </RefCard>
      </div>

      <div>
        <RaLabel hint="Bônus extra quando o cliente chega na N-ésima indicação que valeu. Até 5.">Metas</RaLabel>
        <RefCard pad={0}>
          {metas.length === 0 && (
            <div style={{ padding: '18px 16px', textAlign: 'center', fontFamily: RF_BODY, fontSize: 13, color: 'var(--color-text-sec)' }}>
              Nenhuma meta. O app não mostra a barra de progresso.
            </div>
          )}
          {metas.map((m, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 10px 12px 16px',
                borderBottom: '1px solid var(--color-border-2)',
              }}
            >
              <span style={metaTextStyle}>Na</span>
              <span style={{ ...metaBoxStyle, minWidth: 44, background: 'var(--color-surface-alt)', border: '1.5px solid var(--color-border)' }}>
                <input
                  aria-label={`Meta ${i + 1}: número da indicação`}
                  inputMode="numeric"
                  value={m.quantidade || ''}
                  onChange={(e) =>
                    edit(setMetas)(metas.map((x, j) => (j === i ? { ...x, quantidade: parseIntField(e.target.value) } : x)))
                  }
                  style={{ ...metaInputStyle, width: 30 }}
                />
                ª
              </span>
              <span style={metaTextStyle}>indicação,</span>
              <span style={{ ...metaBoxStyle, minWidth: 52, background: 'var(--color-gold-soft)', color: 'var(--color-accent)' }}>
                +
                <input
                  aria-label={`Meta ${i + 1}: bônus em pãezins`}
                  inputMode="numeric"
                  value={m.bonus || ''}
                  onChange={(e) => edit(setMetas)(metas.map((x, j) => (j === i ? { ...x, bonus: parseIntField(e.target.value) } : x)))}
                  style={{ ...metaInputStyle, width: 24, color: 'var(--color-accent)' }}
                />
              </span>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                aria-label={`Remover meta da ${m.quantidade}ª indicação`}
                onClick={() => edit(setMetas)(metas.filter((_, j) => j !== i))}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  border: 'none',
                  background: 'none',
                  color: 'var(--color-text-ter)',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <Icon name="trash" size={18} />
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={metas.length >= REFERRAL_LIMITS.metas.max}
            onClick={() =>
              edit(setMetas)([
                ...metas,
                { quantidade: Math.min(REFERRAL_LIMITS.metaQuantidade.max, (metas[metas.length - 1]?.quantidade || 0) + 5), bonus: 10 },
              ])
            }
            style={{
              width: '100%',
              minHeight: 50,
              border: 'none',
              background: 'none',
              color: 'var(--color-accent)',
              fontWeight: 700,
              fontSize: 14,
              fontFamily: RF_BODY,
              cursor: metas.length >= REFERRAL_LIMITS.metas.max ? 'default' : 'pointer',
              opacity: metas.length >= REFERRAL_LIMITS.metas.max ? 0.45 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
            }}
          >
            <Icon name="plus" size={17} stroke={2.4} />
            Adicionar meta
          </button>
        </RefCard>
        {metaErr && (
          <div style={{ marginTop: 10 }}>
            <RaInline>{metaErr}</RaInline>
          </div>
        )}
      </div>

      <div>
        <RaLabel>Mensagem de compartilhamento</RaLabel>
        <RefCard pad={14} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <textarea
            ref={msgRef}
            aria-label="Mensagem de compartilhamento"
            aria-invalid={semVar || msgLenErr}
            value={msg}
            onChange={(e) => edit(setMsg)(e.target.value)}
            rows={5}
            maxLength={REFERRAL_LIMITS.mensagem.max + 50}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              resize: 'none',
              borderRadius: 14,
              border: `1.5px solid ${semVar || msgLenErr ? 'var(--color-warn)' : 'var(--color-border)'}`,
              background: 'var(--color-surface-alt)',
              padding: '12px 14px',
              fontSize: 14,
              lineHeight: 1.5,
              color: 'var(--color-text)',
              fontFamily: RF_BODY,
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {REFERRAL_MESSAGE_VARS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insertVar(v)}
                style={{
                  minHeight: 34,
                  padding: '0 11px',
                  borderRadius: 999,
                  border: '1.5px dashed var(--color-accent)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-accent)',
                  fontWeight: 700,
                  fontSize: 12.5,
                  fontFamily: RF_BODY,
                  cursor: 'pointer',
                }}
              >
                + {v}
              </button>
            ))}
          </div>
          {semVar && <RaInline>A mensagem precisa de {'{codigo}'} ou {'{link}'} — sem eles o amigo não tem como usar a indicação.</RaInline>}
          {!semVar && msgLenErr && (
            <RaInline>
              {msgLen < REFERRAL_LIMITS.mensagem.min
                ? 'A mensagem precisa de pelo menos 20 caracteres.'
                : 'A mensagem pode ter até 500 caracteres.'}
            </RaInline>
          )}
          {bonusZeroWarn && (
            <RaInline tone="gold">
              O bônus do amigo está em 0, mas a mensagem usa {'{bonus}'}. Vai aparecer "ganha 0 pãezins".
            </RaInline>
          )}
          <div>
            <div style={{ fontFamily: RF_BODY, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--color-text-ter)', marginBottom: 8 }}>
              PRÉVIA
            </div>
            <div style={{ background: 'var(--color-surface-2)', borderRadius: 16, padding: 12 }}>
              <div
                data-testid="ref-msg-preview"
                style={{
                  maxWidth: '88%',
                  marginLeft: 'auto',
                  background: 'var(--color-good-soft)',
                  borderRadius: '16px 16px 4px 16px',
                  padding: '10px 12px',
                  fontFamily: RF_BODY,
                  fontSize: 13.5,
                  lineHeight: 1.45,
                  color: 'var(--color-text)',
                  wordBreak: 'break-word',
                }}
              >
                {preview}
                <div aria-hidden="true" style={{ fontSize: 10.5, color: 'var(--color-text-ter)', textAlign: 'right', marginTop: 4 }}>
                  09:41 ✓✓
                </div>
              </div>
            </div>
          </div>
        </RefCard>
      </div>

      {saved && (
        <RaInline tone="good">
          Alterações salvas. Valem para novas indicações — as antigas mantêm os valores de quando foram feitas.
        </RaInline>
      )}
      {saveError && <RaInline>{saveError}</RaInline>}

      <RaBtn full size="lg" disabled={blocked || saving} icon={saving ? undefined : 'check'} onClick={() => void save()}>
        {saving ? (
          <>
            <RaSpinner />
            Salvando…
          </>
        ) : (
          'Salvar'
        )}
      </RaBtn>
    </div>
  )
}

// ------------------------------------------------------------------ peças locais

/** Linha de propriedade do handoff: rótulo + descrição à esquerda, controle à direita. */
function Row({ label, desc, last, children }: { label: string; desc?: ReactNode; last?: boolean; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '13px 16px',
        borderBottom: last ? 'none' : '1px solid var(--color-border-2)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: RF_BODY, fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>{label}</div>
        {desc && <div style={{ fontFamily: RF_BODY, fontSize: 12, color: 'var(--color-text-sec)', marginTop: 2, lineHeight: 1.35 }}>{desc}</div>}
      </div>
      {children}
    </div>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: RF_BODY, fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-sec)', marginBottom: 7, letterSpacing: '0.01em' }}>
      {children}
    </div>
  )
}

/** Caixa de data do handoff (ícone de calendário) sobre um `input type=date` real. */
function DateBox({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--color-surface-alt)',
        border: '1.5px solid var(--color-border)',
        borderRadius: 12,
        padding: '10px 12px',
      }}
    >
      <Icon name="calendar" size={16} color="var(--color-text-ter)" />
      <input
        type="date"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: RF_BODY,
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--color-text)',
        }}
      />
    </label>
  )
}

const fieldStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--color-surface-alt)',
  border: '1.5px solid var(--color-border)',
  borderRadius: 14,
  padding: '12px 14px',
  fontFamily: RF_BODY,
  fontSize: 15,
  fontWeight: 500,
  color: 'var(--color-text)',
  outline: 'none',
}

const metaTextStyle: CSSProperties = { fontFamily: RF_BODY, fontSize: 13, color: 'var(--color-text-sec)', fontWeight: 600 }

const metaBoxStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px 4px',
  borderRadius: 10,
  fontFamily: RF_DISPLAY,
  fontWeight: 800,
  fontSize: 15,
}

const metaInputStyle: CSSProperties = {
  border: 'none',
  outline: 'none',
  background: 'transparent',
  textAlign: 'center',
  fontFamily: RF_DISPLAY,
  fontWeight: 800,
  fontSize: 15,
  color: 'var(--color-text)',
  padding: 0,
}
