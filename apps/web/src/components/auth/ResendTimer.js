import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
/**
 * ResendTimer — 30-second countdown before enabling the resend action.
 *
 * During countdown: "Não chegou? Reenviar em 0:XX" in --color-text-ter (non-interactive)
 * After countdown: "Não chegou? Reenviar código" in --color-accent (clickable)
 * On resend click: resets timer to 30s and calls onResend().
 *
 * Font: 12px --font-body weight 700 text-align center
 */
export function ResendTimer({ onResend }) {
    const [seconds, setSeconds] = useState(30);
    useEffect(() => {
        if (seconds <= 0)
            return;
        const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
        return () => clearTimeout(timer);
    }, [seconds]);
    const handleResend = () => {
        setSeconds(30);
        onResend();
    };
    const baseStyle = {
        fontFamily: 'var(--font-body)',
        fontSize: 12,
        fontWeight: 700,
        textAlign: 'center',
        background: 'none',
        border: 'none',
        padding: 0,
        lineHeight: 1.4,
        display: 'block',
        width: '100%',
    };
    if (seconds > 0) {
        return (_jsx("span", { style: {
                ...baseStyle,
                color: 'var(--color-text-ter)',
                cursor: 'default',
            }, children: `Não chegou? Reenviar em 0:${String(seconds).padStart(2, '0')}` }));
    }
    return (_jsx("button", { onClick: handleResend, style: {
            ...baseStyle,
            color: 'var(--color-accent)',
            cursor: 'pointer',
        }, children: "N\u00E3o chegou? Reenviar c\u00F3digo" }));
}
