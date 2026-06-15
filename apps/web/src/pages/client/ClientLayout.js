import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import { LoadingScreen } from '../auth/LoadingScreen';
import { Navigate } from 'react-router';
import { ClientTabBar } from '../../components/client/ClientTabBar';
import { useOneSignalRegister } from '../../hooks/useOneSignalRegister';
export function ClientLayout() {
    const { user, isLoading } = useAuth();
    // Registra o player_id do OneSignal no backend — executado apenas quando autenticado (JWT disponível)
    useOneSignalRegister();
    if (isLoading)
        return _jsx(LoadingScreen, {});
    if (!user || user.role !== 'CLIENT')
        return _jsx(Navigate, { to: "/", replace: true });
    return (_jsxs("div", { style: {
            minHeight: '100dvh',
            background: 'var(--color-app-bg)',
            paddingBottom: 'calc(56px + env(safe-area-inset-bottom))',
        }, children: [_jsx(Outlet, {}), _jsx(ClientTabBar, {})] }));
}
