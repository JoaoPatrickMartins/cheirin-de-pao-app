import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { breadsLabel } from '@cheirin-de-pao/shared'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../../components/brand/Icon'
import { BreadMark } from '../../components/brand/BreadMark'
import {
  buildReferralLink,
  buildReferralMessage,
  shortDay,
  type ReferralMe,
} from '../../lib/referral'
import { RefCard, RefSection, RefSkel, RF_BODY, RF_DISPLAY } from '../../components/client/referral/RefPrimitives'
import { RefCodeCard } from '../../components/client/referral/RefCode'
import { RefShareButtons } from '../../components/client/referral/RefShareButtons'
import { RefItem } from '../../components/client/referral/RefItem'
import { patchReferralSummary } from '../../hooks/useReferralSummary'

/**
 * C1 — Indique e ganhe (`/client/perfil/indique`). Handoff: `ReferralScreen` em
 * `design_handoff_indique_e_ganhe/design/app/screens-referral.jsx`.
 *
 * Os 8 estados do handoff saem dos dados: `loading`, `error`, `paused` (programa desligado), e
 * dentro do ativo `empty` (sem indicados), `campaign`, `goal` (meta que acabou de bater),
 * `nobonus` (Y = 0) e `full`.
 */

const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

/** Quanto tempo o toast fica na tela. */
const TOAST_MS = 2000

export function ReferralScreen() {
  const navigate = useNavigate()
  const [data, setData] = useState<ReferralMe | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const res = await apiFetch('/referrals/me')
      if (!res.ok) throw new Error(String(res.status))
      const json = (await res.json()) as ReferralMe
      setData(json)
      setStatus('ready')
      // Abrir a tela gera o código: o selo "novo" do Perfil some sem esperar o próximo resumo.
      if (json.code) patchReferralSummary((s) => ({ ...s, isNew: false }))
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS)
  }

  let body
  if (status === 'loading') {
    body = (
      <>
        <div style={{ background: 'var(--color-surface-2)', borderRadius: 24, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <RefSkel h={12} w={120} />
          <RefSkel h={28} w="85%" />
          <RefSkel h={28} w="60%" />
          <RefSkel h={14} w="75%" />
          <RefSkel h={74} r={18} style={{ marginTop: 6 }} />
        </div>
        <RefSkel h={56} r={16} />
        <div style={{ display: 'flex', gap: 10 }}>
          <RefSkel h={48} r={16} />
          <RefSkel h={48} r={16} />
        </div>
        <RefSkel h={80} r={22} />
        <RefSkel h={180} r={22} />
      </>
    )
  } else if (status === 'error' || !data) {
    body = (
      <RefCard pad={24} style={{ textAlign: 'center', marginTop: 40 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            background: 'var(--color-surface-2)',
            color: 'var(--color-text-sec)',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto',
          }}
        >
          <Icon name="refresh" size={26} />
        </div>
        <div role="alert" style={{ fontFamily: RF_DISPLAY, fontWeight: 700, fontSize: 19, color: 'var(--color-text)', marginTop: 14, letterSpacing: '-0.02em' }}>
          Não conseguimos carregar
        </div>
        <div style={{ fontFamily: RF_BODY, fontSize: 13.5, color: 'var(--color-text-sec)', marginTop: 6, lineHeight: 1.5 }}>
          Suas indicações estão guardadas. Confira a conexão e tente de novo.
        </div>
        <button
          type="button"
          onClick={() => void load()}
          style={{
            marginTop: 18,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '13px 18px',
            borderRadius: 16,
            border: 'none',
            background: 'var(--color-espresso)',
            color: 'var(--color-primary-btn-text)',
            fontFamily: RF_BODY,
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Icon name="refresh" size={18} stroke={2.2} />
          Tentar de novo
        </button>
      </RefCard>
    )
  } else {
    const paused = data.state === 'paused' || !data.code
    const list = data.referrals
    const message = data.code
      ? buildReferralMessage({
          template: data.messageTemplate,
          code: data.code,
          name: data.referrerFirstName,
          welcomeBreads: data.welcomeBreads,
        })
      : ''
    body = (
      <>
        <RefHero data={data} paused={paused} />
        {!paused && data.code && (
          <RefShareButtons message={message} link={buildReferralLink(data.code)} onToast={showToast} />
        )}
        {!paused && list.length === 0 && (
          <RefSection title="Como funciona">
            <RefHowItWorks data={data} />
          </RefSection>
        )}
        {list.length > 0 && (
          <RefSection title="Seu resumo">
            <RefSummary stats={data.stats} />
          </RefSection>
        )}
        {!paused && list.length > 0 && <RefGoals goals={data.goals} />}
        <RefSection
          title="Seus indicados"
          right={
            list.length > 0 ? (
              <span style={{ fontFamily: RF_BODY, fontSize: 12, color: 'var(--color-text-ter)', fontWeight: 600 }}>Só você vê</span>
            ) : undefined
          }
        >
          {list.length === 0 ? (
            <RefCard
              pad={20}
              style={{ textAlign: 'center', background: 'var(--color-surface-alt)', border: '1.5px dashed var(--color-border)', boxShadow: 'none' }}
            >
              <div style={{ display: 'grid', placeItems: 'center' }}>
                <BreadMark size={54} color="var(--color-gold)" />
              </div>
              <div style={{ fontFamily: RF_DISPLAY, fontWeight: 700, fontSize: 17, color: 'var(--color-text)', marginTop: 4, letterSpacing: '-0.02em' }}>
                Sua lista começa aqui
              </div>
              <div style={{ fontFamily: RF_BODY, fontSize: 13, color: 'var(--color-text-sec)', marginTop: 5, lineHeight: 1.5 }}>
                Quem se cadastrar com o seu código aparece nesta lista — você acompanha cada passo até o pão chegar.
              </div>
            </RefCard>
          ) : (
            <RefCard pad={0} style={{ padding: '2px 16px' }}>
              {list.map((r, i) => (
                <RefItem key={r.id} item={r} last={i === list.length - 1} />
              ))}
            </RefCard>
          )}
        </RefSection>
        {!paused && list.length > 0 && (
          <RefSection title="Como funciona">
            <RefHowItWorks data={data} />
          </RefSection>
        )}
        <RefRules rules={data.rules} />
      </>
    )
  }

  return (
    <div style={{ position: 'relative', minHeight: '100dvh', background: 'var(--color-app-bg)', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '6px 20px 14px',
          paddingTop: 'calc(6px + env(safe-area-inset-top))',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/client/perfil')}
          aria-label="Voltar"
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            border: 'none',
            background: 'var(--color-surface-2)',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon name="arrowL" size={20} color="var(--color-text)" />
        </button>
        <h1 style={{ fontFamily: RF_DISPLAY, fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>
          Indique e ganhe
        </h1>
      </div>

      <div style={{ padding: '0 20px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>{body}</div>

      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: 20,
            right: 20,
            bottom: 'calc(76px + env(safe-area-inset-bottom))',
            zIndex: 30,
            background: 'var(--color-espresso)',
            color: 'var(--color-app-bg)',
            borderRadius: 14,
            padding: '13px 16px',
            fontFamily: RF_BODY,
            fontSize: 13.5,
            fontWeight: 600,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            boxShadow: 'var(--shadow-strong)',
          }}
        >
          <Icon name="check" size={17} color="var(--color-gold)" stroke={2.4} />
          {toast}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────── hero

function RefHero({ data, paused }: { data: ReferralMe; paused: boolean }) {
  const campaign = paused ? null : data.campaign
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--color-espresso)',
        borderRadius: 24,
        padding: '20px 18px 18px',
        color: 'var(--color-app-bg)',
        boxShadow: 'var(--shadow-strong)',
      }}
    >
      <div aria-hidden="true" style={{ position: 'absolute', right: -48, bottom: -56, opacity: 0.1 }}>
        <BreadMark size={190} color="var(--color-gold)" />
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: RF_BODY, fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', color: 'var(--color-gold)' }}>
            INDIQUE E GANHE
          </span>
          {campaign && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 999,
                background: 'var(--color-gold)',
                color: 'var(--color-espresso)',
                fontFamily: RF_BODY,
                fontSize: 11.5,
                fontWeight: 800,
              }}
            >
              <Icon name="spark" size={12} stroke={2.6} />
              {campaign.label} · até {shortDay(campaign.until)}
            </span>
          )}
        </div>
        {paused ? (
          <>
            <div style={{ fontFamily: RF_DISPLAY, fontWeight: 800, fontSize: 26, letterSpacing: '-0.03em', lineHeight: 1.1, marginTop: 12 }}>
              O programa está pausado
            </div>
            <div style={{ fontFamily: RF_BODY, fontSize: 13.5, color: 'rgba(250,245,236,0.72)', marginTop: 8, lineHeight: 1.45 }}>
              Por enquanto não dá pra fazer novas indicações. O que você já indicou continua valendo.
            </div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: RF_DISPLAY, fontWeight: 800, fontSize: 27, letterSpacing: '-0.03em', lineHeight: 1.08, marginTop: 12, maxWidth: 290 }}>
              Indique um vizinho e ganhe <span style={{ color: 'var(--color-gold)' }}>{breadsLabel(data.rewardBreads)}</span>
            </div>
            {campaign && (
              <div style={{ fontFamily: RF_BODY, fontSize: 12.5, color: 'rgba(250,245,236,0.6)', marginTop: 6 }}>
                Em vez de {data.baseRewardBreads}, para quem indicar até {shortDay(campaign.until)}.
              </div>
            )}
            <div style={{ fontFamily: RF_BODY, fontSize: 13.5, color: 'rgba(250,245,236,0.78)', marginTop: 8, lineHeight: 1.45 }}>
              {data.welcomeBreads > 0 && (
                <>
                  Seu amigo ganha <b style={{ color: 'var(--color-app-bg)' }}>{breadsLabel(data.welcomeBreads)}</b> no primeiro pedido.{' '}
                </>
              )}
              Vale quando o pão chegar na porta dele.
            </div>
            {data.code && (
              <div style={{ marginTop: 16 }}>
                <RefCodeCard code={data.code} onDark />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────── blocos

function RefHowItWorks({ data }: { data: ReferralMe }) {
  const X = data.rewardBreads
  const Y = data.welcomeBreads
  const { prazoDias, compraMinima } = data.rules
  const steps: Array<[string, string]> = [
    ['Compartilhe seu código', 'Pelo WhatsApp, pelo link ou ditando mesmo.'],
    [
      'Seu amigo se cadastra e faz o 1º pedido',
      `Ele tem ${prazoDias ? `${prazoDias} dias` : 'o tempo que quiser'} pra isso${compraMinima ? `, a partir de ${formatBRL(compraMinima)}` : ''}.`,
    ],
    Y > 0
      ? ['O pão chegou? Vocês dois ganham', `+${X} pra você, +${Y} pra ele, na mesma hora.`]
      : ['O pão chegou? Você ganha', `+${X} pãezins caem no seu saldo na hora.`],
  ]
  return (
    <RefCard pad={16}>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {steps.map(([title, text], i) => (
          <li key={title} style={{ display: 'flex', gap: 13, position: 'relative', paddingBottom: i < 2 ? 16 : 0 }}>
            {i < 2 && (
              <div aria-hidden="true" style={{ position: 'absolute', left: 15, top: 34, bottom: 2, width: 2, background: 'var(--color-gold-soft)', borderRadius: 2 }} />
            )}
            <div
              aria-hidden="true"
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                background: i === 2 ? 'var(--color-gold)' : 'var(--color-gold-soft)',
                color: i === 2 ? 'var(--color-espresso)' : 'var(--color-accent)',
                display: 'grid',
                placeItems: 'center',
                fontFamily: RF_DISPLAY,
                fontWeight: 800,
                fontSize: 15,
                flexShrink: 0,
              }}
            >
              {i === 2 ? <Icon name="gift" size={16} stroke={2.3} /> : i + 1}
            </div>
            <div style={{ paddingTop: 5 }}>
              <div style={{ fontFamily: RF_BODY, fontWeight: 700, fontSize: 14.5, color: 'var(--color-text)', lineHeight: 1.3 }}>{title}</div>
              <div style={{ fontFamily: RF_BODY, fontSize: 13, color: 'var(--color-text-sec)', marginTop: 3, lineHeight: 1.45 }}>{text}</div>
            </div>
          </li>
        ))}
      </ol>
    </RefCard>
  )
}

function RefSummary({ stats }: { stats: ReferralMe['stats'] }) {
  const cell = (n: number, label: string, color = 'var(--color-text)') => (
    <div style={{ flex: 1, padding: '4px 6px', textAlign: 'center' }}>
      <div style={{ fontFamily: RF_DISPLAY, fontWeight: 800, fontSize: 26, letterSpacing: '-0.03em', color, lineHeight: 1 }}>
        {String(n).replace('.', ',')}
      </div>
      <div style={{ fontFamily: RF_BODY, fontSize: 11.5, color: 'var(--color-text-sec)', fontWeight: 600, marginTop: 6, lineHeight: 1.3 }}>{label}</div>
    </div>
  )
  const divider = <div aria-hidden="true" style={{ width: 1, background: 'var(--color-border-2)' }} />
  return (
    <RefCard pad={14} style={{ display: 'flex', alignItems: 'stretch' }}>
      {cell(stats.earnedBreads, 'pãezins ganhos', 'var(--color-good)')}
      {divider}
      {cell(stats.valeram, stats.valeram === 1 ? 'indicação valeu' : 'indicações valeram')}
      {divider}
      {cell(stats.emAndamento, 'em andamento')}
    </RefCard>
  )
}

function RefGoals({ goals }: { goals: ReferralMe['goals'] }) {
  const metas = goals.milestones
  if (metas.length === 0) return null
  const count = goals.count
  const max = metas[metas.length - 1].quantidade
  const { next, justHit } = goals
  const faltam = next ? next.quantidade - count : 0
  return (
    <RefCard pad={16}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          aria-hidden="true"
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: justHit ? 'var(--color-good-soft)' : 'var(--color-gold-soft)',
            color: justHit ? 'var(--color-good)' : 'var(--color-accent)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name={justHit ? 'star' : 'target'} size={19} />
        </div>
        <div style={{ flex: 1, fontFamily: RF_BODY, fontSize: 14, color: 'var(--color-text)', fontWeight: 700, lineHeight: 1.35 }}>
          {justHit ? (
            <>
              Meta atingida! <span style={{ color: 'var(--color-good)' }}>+{justHit.bonus} pãezins</span> pela {justHit.quantidade}ª indicação
            </>
          ) : next ? (
            <>
              Faltam {faltam} {faltam === 1 ? 'indicação' : 'indicações'} para ganhar{' '}
              <span style={{ color: 'var(--color-accent)' }}>+{next.bonus} pãezins</span>
            </>
          ) : (
            <>Você bateu todas as metas. Que vizinhança!</>
          )}
        </div>
      </div>
      {justHit && next && (
        <div style={{ fontFamily: RF_BODY, fontSize: 12.5, color: 'var(--color-text-sec)', marginTop: 8, marginLeft: 48 }}>
          Próxima: +{next.bonus} na {next.quantidade}ª indicação.
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(count, max)}
        aria-label="Progresso das metas"
        style={{ position: 'relative', height: 10, borderRadius: 99, background: 'var(--color-surface-2)', marginTop: 16 }}
      >
        <div style={{ position: 'absolute', inset: 0, width: `${Math.min(100, (count / max) * 100)}%`, borderRadius: 99, background: 'var(--color-gold)' }} />
      </div>
      <div style={{ position: 'relative', height: 30, marginTop: 6 }}>
        {metas.map((m) => {
          const hit = m.reached
          const isLast = m.quantidade === max
          return (
            <div
              key={m.quantidade}
              style={{
                position: 'absolute',
                left: `${(m.quantidade / max) * 100}%`,
                transform: isLast ? 'translateX(-100%)' : 'translateX(-50%)',
                textAlign: isLast ? 'right' : 'center',
                whiteSpace: 'nowrap',
                fontFamily: RF_BODY,
              }}
            >
              <div style={{ fontSize: 11.5, fontWeight: 800, color: hit ? 'var(--color-good)' : 'var(--color-text)' }}>
                {hit && '✓ '}
                {m.quantidade}ª
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-sec)', fontWeight: 600 }}>+{m.bonus}</div>
            </div>
          )
        })}
        <div style={{ position: 'absolute', left: 0, fontFamily: RF_BODY, fontSize: 11, color: 'var(--color-text-ter)', fontWeight: 600 }}>
          {count} {count === 1 ? 'valeu' : 'valeram'}
        </div>
      </div>
    </RefCard>
  )
}

function RefRules({ rules }: { rules: ReferralMe['rules'] }) {
  const [open, setOpen] = useState(false)
  const items = [
    rules.prazoDias
      ? `Seu amigo tem ${rules.prazoDias} dias, a partir do cadastro, para fazer e receber o 1º pedido.`
      : 'Não há prazo para o 1º pedido do seu amigo.',
    rules.compraMinima
      ? `O 1º pedido do amigo precisa ser de pelo menos ${formatBRL(rules.compraMinima)}.`
      : 'Vale qualquer 1º pedido: pão ou Cestinha.',
    'Vale para quem ainda não tem conta no Cheirin — e só uma indicação por pessoa.',
    'Os pãezins do bônus não viram dinheiro e não expiram.',
    'Algumas indicações podem passar por uma análise rápida antes de valer.',
    'O programa pode ser encerrado. O que já foi indicado continua valendo.',
  ]
  return (
    <RefCard pad={0}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="ref-rules"
        style={{
          width: '100%',
          minHeight: 52,
          padding: '0 16px',
          background: 'none',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
          color: 'var(--color-text)',
          fontFamily: RF_BODY,
        }}
      >
        <Icon name="doc" size={19} color="var(--color-text-sec)" />
        <span style={{ flex: 1, textAlign: 'left', fontWeight: 700, fontSize: 14.5 }}>Regras</span>
        <span style={{ display: 'grid', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
          <Icon name="chevD" size={18} color="var(--color-text-ter)" />
        </span>
      </button>
      {open && (
        <ul id="ref-rules" style={{ margin: 0, padding: '0 16px 16px 44px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((r) => (
            <li key={r} style={{ fontFamily: RF_BODY, fontSize: 13, color: 'var(--color-text-sec)', lineHeight: 1.5 }}>
              {r}
            </li>
          ))}
        </ul>
      )}
    </RefCard>
  )
}
