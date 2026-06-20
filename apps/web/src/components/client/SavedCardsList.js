import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { SavedCardItem } from './SavedCardItem';
export function SavedCardsList({ cards, loading, error, mode, selectedCardId, onSelect, onSetDefault, onRemove, removingId, }) {
    // Estado de loading: 3 skeleton cards
    if (loading) {
        return (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: [0, 1, 2].map((i) => (_jsx(SkeletonCard, {}, i))) }));
    }
    // Estado de erro
    if (error) {
        return (_jsx("p", { style: {
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                color: 'var(--color-text-sec)',
                textAlign: 'center',
                margin: 0,
                padding: '16px 0',
            }, children: error }));
    }
    // Estado vazio — apenas exibido no modo 'manage'
    if (cards.length === 0) {
        if (mode === 'manage') {
            return (_jsxs("div", { style: { textAlign: 'center', padding: '16px 0' }, children: [_jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 15,
                            color: 'var(--color-text-ter)',
                            margin: '0 0 4px',
                        }, children: "Nenhum cart\u00E3o salvo." }), _jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 12.5,
                            color: 'var(--color-text-ter)',
                            margin: 0,
                        }, children: "Voc\u00EA pode salvar um cart\u00E3o ao fazer uma compra." })] }));
        }
        // modo 'select' vazio: não exibe lista
        // (CardPaymentScreen controla o Modo B neste caso)
        return null;
    }
    // Lista normal
    return (_jsx("div", { role: mode === 'select' ? 'radiogroup' : undefined, style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: cards.map((card) => (_jsx(SavedCardItem, { card: card, mode: mode, selected: mode === 'select' ? selectedCardId === card.id : undefined, onSelect: onSelect, onSetDefault: onSetDefault, onRemove: onRemove, isRemoving: removingId === card.id }, card.id))) }));
}
// Skeleton card 64px height com animação de pulso via opacity
function SkeletonCard() {
    return (_jsx("div", { style: {
            height: 64,
            borderRadius: 22,
            background: 'var(--color-surface-2)',
            animation: 'savedcard-pulse 1.4s ease-in-out infinite',
        }, children: _jsx("style", { children: `
        @keyframes savedcard-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      ` }) }));
}
