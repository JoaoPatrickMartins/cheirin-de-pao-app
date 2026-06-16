import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const STEP_LABELS = ['Conferir', 'Ajustar', 'Dividir', 'Pronto'];
export function StepBar({ step, onStepClick }) {
    return (_jsx("div", { style: {
            display: 'flex',
            gap: 6,
            padding: '0 20px 14px',
        }, children: STEP_LABELS.map((label, i) => {
            const isActiveOrDone = i <= step;
            const isClickable = i < step;
            return (_jsxs("div", { style: {
                    flex: 1,
                    textAlign: 'center',
                    cursor: isClickable ? 'pointer' : 'default',
                }, onClick: () => {
                    if (isClickable)
                        onStepClick(i);
                }, role: isClickable ? 'button' : undefined, "aria-label": isClickable ? `Voltar para ${label}` : undefined, children: [_jsx("div", { style: {
                            height: 4,
                            borderRadius: 99,
                            marginBottom: 6,
                            background: isActiveOrDone ? '#E3AC3F' : 'var(--color-border)',
                        } }), _jsx("span", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 11,
                            fontWeight: 700,
                            color: isActiveOrDone ? 'var(--color-accent)' : 'var(--color-text-ter)',
                            lineHeight: 1.2,
                        }, children: label })] }, label));
        }) }));
}
