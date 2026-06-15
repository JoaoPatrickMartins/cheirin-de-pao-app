import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import { LoadingScreen } from '../auth/LoadingScreen';
import { Navigate } from 'react-router';
export function CourierLayout() {
    const { user, isLoading } = useAuth();
    if (isLoading)
        return _jsx(LoadingScreen, {});
    if (!user || user.role !== 'COURIER')
        return _jsx(Navigate, { to: "/", replace: true });
    return (_jsx("div", { style: { minHeight: '100dvh', background: 'var(--color-app-bg)' }, children: _jsxs("div", { style: { padding: '1rem' }, children: ["\u00C1rea do Entregador \u2014 Fase 3", _jsx(Outlet, {})] }) }));
}
