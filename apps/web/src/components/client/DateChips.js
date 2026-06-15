import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * DateChips — chips de seleção de data para a SingleScreen
 *
 * Exibe "Amanhã cedo" (desabilitado após 21h — D-05), "Depois de amanhã"
 * e "Outra data" (input nativo com min=amanhã e max=30dias — D-04, D-06).
 *
 * Requirements: SCHED-01
 * Source: screens-order.jsx linhas 280–288, 04-UI-SPEC.md seção 9
 */
import { useRef } from 'react';
import { Icon } from '../brand/Icon';
const CUTOFF_HOUR = 21;
function formatDateValue(dateStr) {
    // Formata "YYYY-MM-DD" para "DD mmm"
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${day} ${months[date.getMonth()]}`;
}
function toDateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
function getDayAbbr(date) {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return days[date.getDay()];
}
export default function DateChips({ value, onChange, deliveryTime }) {
    const dateInputRef = useRef(null);
    const now = new Date();
    const isAfterCutoff = now.getHours() >= CUTOFF_HOUR;
    // Calcular amanhã e depois de amanhã
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(now);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    // Max = 30 dias a partir de amanhã
    const in30Days = new Date(now);
    in30Days.setDate(in30Days.getDate() + 30);
    const tomorrowStr = toDateString(tomorrow);
    const dayAfterTomorrowStr = toDateString(dayAfterTomorrow);
    const in30DaysStr = toDateString(in30Days);
    // Verificar se o value atual é uma das datas pré-definidas ou outra data
    const isOtherDate = value !== null && value !== tomorrowStr && value !== dayAfterTomorrowStr;
    const chipBase = {
        flex: 1,
        padding: '13px 14px',
        borderRadius: 16,
        border: '1.5px solid var(--color-border)',
        background: 'var(--color-surface)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background .15s, border-color .15s, color .15s',
        minWidth: 0,
    };
    const chipActive = {
        ...chipBase,
        border: '1.5px solid var(--color-accent)',
        background: 'var(--color-gold-soft)',
    };
    const chipDisabled = {
        ...chipBase,
        opacity: 0.4,
        cursor: 'default',
    };
    const chipTitleBase = {
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        fontSize: 14,
        color: 'var(--color-text)',
        margin: 0,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    };
    const chipTitleActive = {
        ...chipTitleBase,
        color: 'var(--color-accent)',
    };
    const chipSubLabel = {
        fontFamily: 'var(--font-body)',
        fontSize: 12,
        color: 'var(--color-text-ter)',
        margin: '2px 0 0 0',
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    };
    return (_jsxs("div", { style: { marginBottom: 16 }, children: [_jsx("p", { style: {
                    fontFamily: 'var(--font-body)',
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: 'var(--color-text-sec)',
                    margin: 0,
                    marginBottom: 9,
                }, children: "Para quando?" }), _jsxs("div", { style: { display: 'flex', gap: 10 }, children: [_jsxs("button", { disabled: isAfterCutoff, style: isAfterCutoff ? chipDisabled : value === tomorrowStr ? chipActive : chipBase, onClick: isAfterCutoff ? undefined : () => onChange(tomorrowStr), children: [_jsx("p", { style: value === tomorrowStr && !isAfterCutoff ? chipTitleActive : chipTitleBase, children: "Amanh\u00E3 cedo" }), _jsx("p", { style: chipSubLabel, children: isAfterCutoff
                                    ? 'Disponível até 21:00'
                                    : `${getDayAbbr(tomorrow)}, ${deliveryTime}` })] }), _jsxs("button", { style: value === dayAfterTomorrowStr ? chipActive : chipBase, onClick: () => onChange(dayAfterTomorrowStr), children: [_jsx("p", { style: value === dayAfterTomorrowStr ? chipTitleActive : chipTitleBase, children: "Depois de amanh\u00E3" }), _jsxs("p", { style: chipSubLabel, children: [getDayAbbr(dayAfterTomorrow), ", ", deliveryTime] })] }), _jsx("button", { style: isOtherDate ? chipActive : chipBase, onClick: () => dateInputRef.current?.click(), children: _jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                            }, children: [_jsx(Icon, { name: "calendar", size: 16, color: isOtherDate ? 'var(--color-accent)' : 'var(--color-text)' }), _jsx("p", { style: isOtherDate ? chipTitleActive : chipTitleBase, children: isOtherDate ? formatDateValue(value) : 'Outra data' })] }) }), _jsx("input", { ref: dateInputRef, type: "date", min: tomorrowStr, max: in30DaysStr, style: { display: 'none' }, onChange: (e) => {
                            if (e.target.value)
                                onChange(e.target.value);
                        } })] })] }));
}
