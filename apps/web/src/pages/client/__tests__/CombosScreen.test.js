import { jsx as _jsx } from "react/jsx-runtime";
// CombosScreen page tests
// Requirements: CRED-01 (navega para /client/creditos/pix com state camelCase apos POST /payments/pix)
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
const mockApiFetch = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }));
vi.mock('../../../hooks/useAuth', () => ({
    useAuth: () => ({
        user: { id: 'u1', name: 'Test User', role: 'CLIENT', creditBalance: 100 },
        token: 'tok',
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        updateCreditBalance: vi.fn(),
    }),
}));
const mockNavigate = vi.fn();
vi.mock('react-router', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, useNavigate: () => mockNavigate };
});
import { CombosScreen } from '../CombosScreen';
const mockCombo = {
    id: 'combo-1',
    name: 'Combo Básico',
    quantity: 20,
    price: 29.9,
    isActive: true,
};
const mockPricing = { avulsoLimite: 30, avulsoUnit: 2.5 };
describe('CombosScreen [CRED-01]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockNavigate.mockClear();
        mockApiFetch.mockImplementation((url) => {
            if (url === '/combos') {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve([mockCombo]),
                });
            }
            if (url === '/pricing') {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockPricing),
                });
            }
            // POST /payments/pix
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    paymentId: 'pid-1',
                    qr_code_base64: 'base64data',
                    qr_code: 'pixcode',
                }),
            });
        });
    });
    describe('navegacao apos pagamento Pix', () => {
        it('apos POST /payments/pix retornar sucesso navega para /client/creditos/pix', async () => {
            render(_jsx(MemoryRouter, { children: _jsx(CombosScreen, {}) }));
            await waitFor(() => expect(screen.queryByText('Combo Básico')).toBeTruthy());
            fireEvent.click(screen.getByText(/Comprar Combo Básico/i));
            await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
            expect(mockNavigate).toHaveBeenCalledWith('/client/creditos/pix', expect.anything());
        });
        it('navigate state contem qrCodeBase64 (camelCase, nao qr_code_base64)', async () => {
            render(_jsx(MemoryRouter, { children: _jsx(CombosScreen, {}) }));
            await waitFor(() => expect(screen.queryByText('Combo Básico')).toBeTruthy());
            fireEvent.click(screen.getByText(/Comprar Combo Básico/i));
            await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
            const [, options] = mockNavigate.mock.calls[0];
            expect(options.state).toHaveProperty('qrCodeBase64', 'base64data');
            expect(options.state).not.toHaveProperty('qr_code_base64');
        });
        it('navigate state contem paymentId, qrCode e comboQuantity', async () => {
            render(_jsx(MemoryRouter, { children: _jsx(CombosScreen, {}) }));
            await waitFor(() => expect(screen.queryByText('Combo Básico')).toBeTruthy());
            fireEvent.click(screen.getByText(/Comprar Combo Básico/i));
            await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
            const [, options] = mockNavigate.mock.calls[0];
            expect(options.state).toHaveProperty('paymentId', 'pid-1');
            expect(options.state).toHaveProperty('qrCode', 'pixcode');
            expect(options.state).toHaveProperty('comboQuantity', 20);
        });
        it('navigate e chamado com "/client/creditos/pix" como primeiro argumento', async () => {
            render(_jsx(MemoryRouter, { children: _jsx(CombosScreen, {}) }));
            await waitFor(() => expect(screen.queryByText('Combo Básico')).toBeTruthy());
            fireEvent.click(screen.getByText(/Comprar Combo Básico/i));
            await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
            expect(mockNavigate.mock.calls[0][0]).toBe('/client/creditos/pix');
        });
    });
});
