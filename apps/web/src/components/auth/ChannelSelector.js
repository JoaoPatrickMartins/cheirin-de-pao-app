import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Icon } from '../brand/Icon';
/**
 * SMS / E-mail OTP channel toggle with auto-select logic.
 *
 * Auto-select rules:
 *   - Only phone entered → SMS pre-selected, E-mail disabled
 *   - Only email entered → E-mail pre-selected, SMS disabled
 *   - Both entered → both enabled, defaults to current selection
 */
export function ChannelSelector({ phone, email, selected, onChange }) {
    const hasPhone = phone.trim().length > 0;
    const hasEmail = email.trim().length > 0;
    const channels = [
        {
            key: 'sms',
            label: 'SMS',
            icon: 'phone',
            disabled: !hasPhone,
        },
        {
            key: 'email',
            label: 'E-mail',
            icon: 'mail',
            disabled: !hasEmail,
        },
    ];
    return (_jsxs("div", { children: [_jsx("div", { style: {
                    fontSize: 12,
                    fontFamily: 'var(--font-body)',
                    fontWeight: 700,
                    color: 'var(--color-text-sec)',
                    marginBottom: 8,
                }, children: "Receber o c\u00F3digo por" }), _jsx("div", { style: { display: 'flex', flexDirection: 'row', gap: 8 }, children: channels.map((ch) => {
                    const isSelected = selected === ch.key && !ch.disabled;
                    return (_jsxs("button", { type: "button", disabled: ch.disabled, onClick: () => !ch.disabled && onChange(ch.key), style: {
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            padding: '12px 0',
                            borderRadius: 14,
                            border: `1.5px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                            background: isSelected ? 'var(--color-gold-soft)' : 'var(--color-surface)',
                            color: ch.disabled
                                ? 'var(--color-text-ter)'
                                : isSelected
                                    ? 'var(--color-accent)'
                                    : 'var(--color-text)',
                            fontFamily: 'var(--font-body)',
                            fontSize: 15,
                            fontWeight: 700,
                            cursor: ch.disabled ? 'default' : 'pointer',
                            opacity: ch.disabled ? 0.5 : 1,
                            transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease',
                        }, children: [_jsx(Icon, { name: ch.icon, size: 16 }), ch.label] }, ch.key));
                }) })] }));
}
