// AdminBottomNav — stub placeholder Wave 0
// Implementação real será feita na Wave 1 (07-09-PLAN.md)
// Este arquivo existe apenas para satisfazer o contrato de importação dos testes

interface AdminBottomNavProps {
  activeTab: 'painel' | 'pedido' | 'entregas' | 'clientes' | 'gestao'
  onTabChange: (tab: 'painel' | 'pedido' | 'entregas' | 'clientes' | 'gestao') => void
}

const TABS: Array<{ id: AdminBottomNavProps['activeTab']; label: string }> = [
  { id: 'painel', label: 'Painel' },
  { id: 'pedido', label: 'Pedido' },
  { id: 'entregas', label: 'Entregas' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'gestao', label: 'Gestão' },
]

export function AdminBottomNav({ activeTab, onTabChange }: AdminBottomNavProps) {
  return (
    <nav role="navigation" aria-label="Admin navigation" className="flex border-t bg-white">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="button"
          aria-current={activeTab === tab.id ? 'page' : undefined}
          onClick={() => onTabChange(tab.id)}
          className="flex-1 py-2 text-xs"
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
