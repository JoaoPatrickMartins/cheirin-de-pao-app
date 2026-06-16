import { jsx as _jsx } from "react/jsx-runtime";
export function SegmentedControl({ tabs, value, onChange, }) {
    return (_jsx("div", { role: "tablist", "aria-label": "Navega\u00E7\u00E3o segmentada", style: {
            background: 'var(--color-surface-2)',
            borderRadius: 13,
            padding: 4,
            display: 'flex',
            gap: 4,
        }, children: tabs.map((tab) => {
            const isActive = value === tab.key;
            return (_jsx("button", { role: "tab", "aria-selected": isActive, onClick: () => onChange(tab.key), style: {
                    flex: 1,
                    minHeight: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    border: 'none',
                    cursor: 'pointer',
                    borderRadius: 10,
                    background: isActive ? 'var(--color-surface)' : 'transparent',
                    boxShadow: isActive ? 'var(--shadow-soft)' : 'none',
                    transition: 'background 0.15s ease, box-shadow 0.15s ease',
                    fontFamily: 'var(--font-body)',
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: isActive ? 'var(--color-text)' : 'var(--color-text-sec)',
                }, children: tab.label }, tab.key));
        }) }));
}
