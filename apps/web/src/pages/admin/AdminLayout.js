import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { LoadingScreen } from '../auth/LoadingScreen';
import { Navigate } from 'react-router';
import { AdminBottomNav } from '../../components/admin/AdminBottomNav';
import { AdminPainel } from './tabs/AdminPainel';
export function AdminLayout() {
    const { user, isLoading } = useAuth();
    const [tab, setTab] = useState('painel');
    if (isLoading)
        return _jsx(LoadingScreen, {});
    if (!user || user.role !== 'ADMIN')
        return _jsx(Navigate, { to: "/", replace: true });
    return (_jsxs("div", { style: {
            minHeight: '100dvh',
            background: 'var(--color-app-bg)',
            display: 'flex',
            flexDirection: 'column',
            paddingBottom: 'calc(56px + env(safe-area-inset-bottom))',
        }, children: [tab === 'painel' && _jsx(AdminPainel, { onNavigate: setTab }), tab === 'pedido' && _jsx("div", {}), tab === 'entregas' && _jsx("div", {}), tab === 'clientes' && _jsx("div", {}), tab === 'gestao' && _jsx("div", {}), _jsx(AdminBottomNav, { activeTab: tab, onTabChange: setTab })] }));
}
