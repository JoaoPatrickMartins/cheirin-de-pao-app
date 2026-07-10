import { useState } from 'react'
import { AdminPedido } from './AdminPedido'
import { DiasEmAberto, type UpcomingDay } from './DiasEmAberto'
import { SupplierOrderHistory } from '../../../components/admin/SupplierOrderHistory'

/**
 * AdminCompra — container da aba Compra.
 *
 * Orquestra três telas: a pré-tela de dias (DiasEmAberto), o detalhe/fluxo de um dia
 * (AdminPedido escopado por data) e o histórico de compras. O histórico foi movido para
 * a pré-tela; o detalhe ganhou seta de voltar.
 */
type View = 'dias' | 'detalhe' | 'historico'

/** Subtítulo desambiguado do dia: "Sábado · 28 de junho". */
function daySubtitle(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00-03:00`)
  const wd = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' }).format(d)
  const dm = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo' }).format(d)
  return `${wd.charAt(0).toUpperCase() + wd.slice(1)} · ${dm}`
}

export function AdminCompra() {
  const [view, setView] = useState<View>('dias')
  const [day, setDay] = useState<UpcomingDay | null>(null)

  if (view === 'historico') {
    return <SupplierOrderHistory onBack={() => setView('dias')} />
  }

  if (view === 'detalhe' && day) {
    return (
      <AdminPedido
        key={day.date}
        deliveryDate={day.date}
        daySlots={day.slots}
        daySubtitle={daySubtitle(day.date)}
        onBack={() => {
          setView('dias')
          setDay(null)
        }}
      />
    )
  }

  return (
    <DiasEmAberto
      onOpenDay={(d) => {
        setDay(d)
        setView('detalhe')
      }}
      onOpenHistory={() => setView('historico')}
    />
  )
}
