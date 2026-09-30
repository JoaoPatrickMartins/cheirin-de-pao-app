import { Icon } from '../../brand/Icon'
import { fmtBRL, type DashboardAlerts } from './painel-types'

/**
 * Faixa 0 do Painel — central de alertas.
 *
 * Antes desta faixa, "o que preciso resolver agora" estava espalhado: pedidos parados no painel,
 * ganchos pendentes só como badge em Gestão, estoque baixo só em push, e Cestinha sem desfecho sem
 * superfície nenhuma. Reunir tudo num lugar é a diferença entre um painel que informa e um que
 * mobiliza.
 *
 * **Nada a resolver = nada desenhado.** Sem placeholder "nenhum alerta": a ausência já é a
 * informação, e um cartão vazio ocuparia a dobra mais valiosa da tela todos os dias.
 */

export type AlertTarget =
  | { tab: 'entregas'; intent: { segment: 'historico'; filter: 'parados' } }
  | { tab: 'gestao' }

interface PainelAlertasProps {
  data: DashboardAlerts | null
  onNavigate: (target: AlertTarget) => void
}

type Tone = 'bad' | 'warn'

interface AlertRow {
  key: string
  tone: Tone
  icon: string
  title: string
  detail: string
  target?: AlertTarget
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

function buildRows(a: DashboardAlerts): AlertRow[] {
  const rows: AlertRow[] = []

  // Ordem = urgência. Pedido parado é o pior: já passou a data, o cliente esperou e ninguém sabe.
  if (a.stuckOrders > 0) {
    rows.push({
      key: 'stuck',
      tone: 'bad',
      icon: 'alert',
      title: `${a.stuckOrders} ${plural(a.stuckOrders, 'pedido parado', 'pedidos parados')}`,
      detail: 'Data passada sem desfecho — resolver em Entregas › Histórico',
      target: { tab: 'entregas', intent: { segment: 'historico', filter: 'parados' } },
    })
  }

  // Conta vencida é dinheiro saindo a mais (multa e juros) por inação — vem logo depois do pedido
  // parado, e antes de tudo que é recuperável.
  if ((a.payable?.overdue ?? 0) > 0) {
    rows.push({
      key: 'payable-overdue',
      tone: 'bad',
      icon: 'wallet',
      title: `${a.payable!.overdue} ${plural(a.payable!.overdue, 'conta vencida', 'contas vencidas')}`,
      detail: `${fmtBRL(a.payable!.overdueTotal)} em atraso — multa e juros correndo`,
      target: { tab: 'gestao' },
    })
  }

  // Mercadoria e crédito em limbo: a entrega falhou e ninguém disse o que aconteceu com a sacola.
  if (a.unresolvedMarketLoss > 0) {
    rows.push({
      key: 'loss',
      tone: 'bad',
      icon: 'bag',
      title: `${a.unresolvedMarketLoss} ${plural(a.unresolvedMarketLoss, 'Cestinha sem desfecho', 'Cestinhas sem desfecho')}`,
      detail: 'Não entregues aguardando baixa de perda ou devolução ao estoque',
    })
  }

  if (a.lowStock.out > 0) {
    rows.push({
      key: 'out',
      tone: 'bad',
      icon: 'bag',
      title: `${a.lowStock.out} ${plural(a.lowStock.out, 'produto esgotado', 'produtos esgotados')}`,
      detail: 'Fora da vitrine até a reposição',
      target: { tab: 'gestao' },
    })
  }

  if (a.failedPayments > 0) {
    rows.push({
      key: 'failed',
      tone: 'warn',
      icon: 'card',
      title: `${a.failedPayments} ${plural(a.failedPayments, 'pagamento recusado', 'pagamentos recusados')}`,
      detail: 'Sem pagamento posterior nos últimos 7 dias — venda ainda recuperável',
    })
  }

  if (a.pendingHooks > 0) {
    rows.push({
      key: 'hooks',
      tone: 'warn',
      icon: 'pin',
      title: `${a.pendingHooks} ${plural(a.pendingHooks, 'gancho a entregar', 'ganchos a entregar')}`,
      detail: 'Fila de entrega física em Gestão › Solicitação de Gancho',
      target: { tab: 'gestao' },
    })
  }

  if ((a.payable?.dueSoon ?? 0) > 0) {
    rows.push({
      key: 'payable-soon',
      tone: 'warn',
      icon: 'clock',
      title: `${a.payable!.dueSoon} ${plural(a.payable!.dueSoon, 'conta vence', 'contas vencem')} em até 3 dias`,
      detail: `${fmtBRL(a.payable!.dueSoonTotal)} a pagar — Financeiro › Contas a pagar`,
      target: { tab: 'gestao' },
    })
  }

  if (a.lowStock.low > 0) {
    rows.push({
      key: 'low',
      tone: 'warn',
      icon: 'factory',
      title: `${a.lowStock.low} ${plural(a.lowStock.low, 'produto com estoque baixo', 'produtos com estoque baixo')}`,
      detail: 'Programar reposição antes de esgotar',
      target: { tab: 'gestao' },
    })
  }

  return rows
}

const TONE: Record<Tone, { fg: string; bg: string; border: string; iconBg: string }> = {
  bad: {
    fg: 'var(--color-bad, #C2410C)',
    bg: 'rgba(194,65,12,0.10)',
    border: 'rgba(194,65,12,0.30)',
    iconBg: 'rgba(194,65,12,0.16)',
  },
  warn: {
    fg: '#8A6A00',
    bg: 'var(--color-gold-soft)',
    border: 'rgba(227,172,63,0.45)',
    iconBg: 'rgba(227,172,63,0.22)',
  },
}

export function PainelAlertas({ data, onNavigate }: PainelAlertasProps) {
  if (!data) return null
  const rows = buildRows(data)
  if (rows.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
      {rows.map((row) => {
        const tone = TONE[row.tone]
        const clickable = row.target != null
        return (
          <button
            key={row.key}
            type="button"
            onClick={clickable ? () => onNavigate(row.target!) : undefined}
            aria-label={row.title}
            aria-disabled={!clickable}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              textAlign: 'left',
              background: tone.bg,
              border: `1px solid ${tone.border}`,
              borderRadius: 16,
              padding: 13,
              cursor: clickable ? 'pointer' : 'default',
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                background: tone.iconBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon
                name={row.icon as Parameters<typeof Icon>[0]['name']}
                size={19}
                color={tone.fg}
                stroke={2.2}
              />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: tone.fg,
                  margin: 0,
                  lineHeight: 1.25,
                }}
              >
                {row.title}
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11.5,
                  color: 'var(--color-text-sec)',
                  margin: '2px 0 0',
                  lineHeight: 1.3,
                }}
              >
                {row.detail}
              </p>
            </div>

            {clickable && <Icon name="chevR" size={17} color={tone.fg} stroke={2} />}
          </button>
        )
      })}
    </div>
  )
}

/** Exportado para teste: a construção das linhas é a regra de negócio da faixa. */
export { buildRows as buildAlertRows }
