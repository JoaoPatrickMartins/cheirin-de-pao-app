import { jsx as _jsx } from "react/jsx-runtime";
import { useRef, useState } from 'react';
/**
 * OtpInput — 4-digit OTP entry component (UI-06)
 *
 * Each box: 64×72px, borderRadius 18, fontSize 30, fontFamily --font-display
 * Border: --color-accent when filled, --color-border when empty
 * Auto-advances focus on digit entry, backspace on empty box moves to previous.
 * Calls onComplete(4-digit string) when all boxes are filled.
 * Rejects non-numeric input via /^\d?$/ guard.
 */
export function OtpInput({ onComplete, disabled = false }) {
    const [digits, setDigits] = useState(['', '', '', '']);
    const ref0 = useRef(null);
    const ref1 = useRef(null);
    const ref2 = useRef(null);
    const ref3 = useRef(null);
    const refs = [ref0, ref1, ref2, ref3];
    const setDigit = (i, v) => {
        // Reject non-numeric — only single digit or empty string allowed
        if (!/^\d?$/.test(v))
            return;
        const next = [...digits];
        next[i] = v;
        setDigits(next);
        // Auto-advance to next box when digit entered
        if (v && i < 3)
            refs[i + 1].current?.focus();
        // Fire onComplete when all 4 digits are filled
        if (v && i === 3 && next.every((d) => d !== '')) {
            onComplete(next.join(''));
        }
    };
    const handleKeyDown = (i, e) => {
        // Backspace on empty box: focus previous
        if (e.key === 'Backspace' && digits[i] === '' && i > 0) {
            refs[i - 1].current?.focus();
        }
    };
    return (_jsx("div", { style: {
            display: 'flex',
            gap: 12,
            justifyContent: 'space-between',
        }, children: digits.map((d, i) => (_jsx("input", { ref: refs[i], value: d, onChange: (e) => setDigit(i, e.target.value), onKeyDown: (e) => handleKeyDown(i, e), maxLength: 1, inputMode: "numeric", disabled: disabled, "aria-label": `Dígito ${i + 1}`, style: {
                width: 64,
                height: 72,
                textAlign: 'center',
                fontSize: 30,
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text)',
                background: 'var(--color-surface-alt)',
                border: `1.5px solid ${d ? 'var(--color-accent)' : 'var(--color-border)'}`,
                borderRadius: 18,
                outline: 'none',
            } }, i))) }));
}
