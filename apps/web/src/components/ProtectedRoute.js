import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { Navigate } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { LoadingScreen } from '../pages/auth/LoadingScreen';
export function ProtectedRoute({ requiredRole, children }) {
    const { user, isLoading } = useAuth();
    if (isLoading)
        return _jsx(LoadingScreen, {});
    if (!user)
        return _jsx(Navigate, { to: "/", replace: true });
    if (user.role !== requiredRole)
        return _jsx(Navigate, { to: "/", replace: true });
    return _jsx(_Fragment, { children: children });
}
