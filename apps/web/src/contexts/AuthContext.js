import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useState, useEffect, useMemo } from 'react';
import { useNavigate, Outlet } from 'react-router';
export const AuthContext = createContext(null);
export function AuthProvider() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    // Rehydrate session from localStorage on mount
    // ALL localStorage calls are wrapped in try/catch — iOS Safari private mode can throw
    useEffect(() => {
        try {
            const storedToken = localStorage.getItem('auth_token');
            const storedUser = localStorage.getItem('auth_user');
            if (storedToken && storedUser) {
                setToken(storedToken);
                const parsed = JSON.parse(storedUser);
                // backward compat: older sessions may not have creditBalance
                setUser({ ...parsed, creditBalance: parsed.creditBalance ?? 0 });
            }
        }
        catch {
            // localStorage unavailable (iOS Safari private mode) — user stays unauthenticated
        }
        setIsLoading(false);
    }, []);
    const value = useMemo(() => ({
        user,
        token,
        isLoading,
        login: (t, u) => {
            // ensure creditBalance is always present (backward compat with callers that may omit it)
            const userData = { ...u, creditBalance: u.creditBalance ?? 0 };
            try {
                localStorage.setItem('auth_token', t);
                localStorage.setItem('auth_user', JSON.stringify(userData));
            }
            catch {
                // localStorage unavailable — in-memory only; user re-authenticates on refresh
            }
            setToken(t);
            setUser(userData);
        },
        logout: () => {
            try {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('auth_user');
            }
            catch {
                // localStorage unavailable — clear in-memory state only
            }
            setToken(null);
            setUser(null);
            navigate('/');
        },
        updateCreditBalance: (balance) => {
            setUser((prev) => {
                if (!prev)
                    return prev;
                const updated = { ...prev, creditBalance: balance };
                try {
                    localStorage.setItem('auth_user', JSON.stringify(updated));
                }
                catch {
                    // localStorage unavailable — update in-memory only
                }
                return updated;
            });
        },
    }), [user, token, isLoading, navigate]);
    return (_jsx(AuthContext.Provider, { value: value, children: _jsx(Outlet, {}) }));
}
