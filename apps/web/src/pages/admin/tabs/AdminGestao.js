import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { AdminHead } from '../../../components/admin/AdminHead';
import { Icon } from '../../../components/brand/Icon';
import { AdminCombos } from '../gestao/AdminCombos';
import { AdminAvulso } from '../gestao/AdminAvulso';
import { AdminFornecedores } from '../gestao/AdminFornecedores';
import { AdminEntregadores } from '../gestao/AdminEntregadores';
import { AdminCondos } from '../gestao/AdminCondos';
import { AdminPagamentos } from '../gestao/AdminPagamentos';
import { AdminFinanceiro } from '../gestao/AdminFinanceiro';
const HUB_ITEMS = [
    { key: 'combos', icon: 'bag', titulo: 'Combos e promoções', descricao: 'Criar, editar, descontos' },
    { key: 'avulso', icon: 'coin', titulo: 'Compra personalizada', descricao: 'Limite e preço por pão' },
    { key: 'fornecedores', icon: 'factory', titulo: 'Fornecedores', descricao: 'Padarias e preço do pão' },
    { key: 'entregadores', icon: 'truck', titulo: 'Entregadores', descricao: 'Equipe e disponibilidade' },
    { key: 'condos', icon: 'building', titulo: 'Condomínios', descricao: 'Locais atendidos' },
    { key: 'pagamentos', icon: 'card', titulo: 'Pagamentos', descricao: 'Status e estornos' },
    { key: 'financeiro', icon: 'trend', titulo: 'Financeiro', descricao: 'Receita por período' },
];
// ------------------------------------------------------------------ componente
export function AdminGestao() {
    const [sub, setSub] = useState(null);
    const onBack = () => setSub(null);
    if (sub === 'combos')
        return _jsx(AdminCombos, { onBack: onBack });
    if (sub === 'avulso')
        return _jsx(AdminAvulso, { onBack: onBack });
    if (sub === 'fornecedores')
        return _jsx(AdminFornecedores, { onBack: onBack });
    if (sub === 'entregadores')
        return _jsx(AdminEntregadores, { onBack: onBack });
    if (sub === 'condos')
        return _jsx(AdminCondos, { onBack: onBack });
    if (sub === 'pagamentos')
        return _jsx(AdminPagamentos, { onBack: onBack });
    if (sub === 'financeiro')
        return _jsx(AdminFinanceiro, { onBack: onBack });
    // Hub principal
    return (_jsxs("div", { style: { flex: 1, overflow: 'auto' }, children: [_jsx(AdminHead, { titulo: "Gest\u00E3o", sub: "Configura\u00E7\u00F5es da opera\u00E7\u00E3o" }), _jsx("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    padding: '0 20px 24px',
                }, children: HUB_ITEMS.map((item) => (_jsx(HubCard, { icon: item.icon, titulo: item.titulo, descricao: item.descricao, onClick: () => setSub(item.key) }, item.key))) })] }));
}
function HubCard({ icon, titulo, descricao, onClick }) {
    return (_jsxs("button", { type: "button", onClick: onClick, style: {
            display: 'flex',
            alignItems: 'center',
            gap: 13,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-2)',
            borderRadius: 16,
            padding: 15,
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%',
        }, children: [_jsx("div", { style: {
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: 'var(--color-surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: 'var(--color-accent)',
                }, children: _jsx(Icon, { name: icon, size: 22, color: "var(--color-accent)" }) }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 14.5,
                            fontWeight: 700,
                            color: 'var(--color-text)',
                            margin: 0,
                            lineHeight: 1.3,
                        }, children: titulo }), _jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--color-text-ter)',
                            margin: '1px 0 0',
                            lineHeight: 1.3,
                        }, children: descricao })] }), _jsx(Icon, { name: "chevR", size: 18, color: "var(--color-text-ter)" })] }));
}
