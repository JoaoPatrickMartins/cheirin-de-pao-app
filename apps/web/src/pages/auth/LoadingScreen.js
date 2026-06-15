import { jsx as _jsx } from "react/jsx-runtime";
import { BreadMark } from '../../components/brand/BreadMark';
export function LoadingScreen() {
    return (_jsx("div", { "aria-live": "polite", style: {
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--color-app-bg)',
        }, children: _jsx(BreadMark, { size: 48, color: "var(--color-gold)" }) }));
}
