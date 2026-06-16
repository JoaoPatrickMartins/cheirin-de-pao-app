// AdminPainel — stub temporário (será substituído na Task 2)
type AdminTab = 'painel' | 'pedido' | 'entregas' | 'clientes' | 'gestao'

export function AdminPainel({ onNavigate }: { onNavigate: (tab: AdminTab) => void }) {
  void onNavigate
  return <div />
}
