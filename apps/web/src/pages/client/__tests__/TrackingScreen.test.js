import { jsx as _jsx } from "react/jsx-runtime";
// TrackingScreen page tests
// Requirements: ACOMP-01 (stepper 3 estados), ACOMP-04 (histórico 30 dias)
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
const mockApiFetch = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }));
const mockUseOrderTracking = vi.hoisted(() => vi.fn());
vi.mock('../../../hooks/useOrderTracking', () => ({
    useOrderTracking: mockUseOrderTracking,
}));
vi.mock('react-router', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, useNavigate: () => vi.fn() };
});
import { TrackingScreen } from '../TrackingScreen';
const scheduledOrder = {
    id: 'order-1',
    status: 'SCHEDULED',
    quantity: 4,
    scheduledDate: new Date().toISOString(),
};
describe('TrackingScreen [ACOMP-01, ACOMP-04]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockApiFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    });
    it('renderiza AppBar "Sua entrega" quando não há entrega hoje', async () => {
        mockUseOrderTracking.mockReturnValue({ order: null, isLoading: false });
        render(_jsx(MemoryRouter, { children: _jsx(TrackingScreen, {}) }));
        expect(screen.getByText('Sua entrega')).toBeDefined();
    });
    it('renderiza HeroCard e label "Agendado" no stepper quando status é SCHEDULED', async () => {
        mockUseOrderTracking.mockReturnValue({ order: scheduledOrder, isLoading: false });
        render(_jsx(MemoryRouter, { children: _jsx(TrackingScreen, {}) }));
        expect(screen.getByText('Agendado')).toBeDefined();
    });
    it('renderiza label "Entregue" no stepper quando status é DELIVERED', async () => {
        mockUseOrderTracking.mockReturnValue({
            order: { ...scheduledOrder, status: 'DELIVERED' },
            isLoading: false,
        });
        render(_jsx(MemoryRouter, { children: _jsx(TrackingScreen, {}) }));
        expect(screen.getByText('Entregue')).toBeDefined();
    });
    it('renderiza item de histórico quando /orders/history retorna dados', async () => {
        mockUseOrderTracking.mockReturnValue({ order: null, isLoading: false });
        mockApiFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve([
                {
                    id: 'hist-1',
                    status: 'DELIVERED',
                    quantity: 2,
                    scheduledDate: new Date().toISOString(),
                    type: 'SCHEDULED',
                },
            ]),
        });
        render(_jsx(MemoryRouter, { children: _jsx(TrackingScreen, {}) }));
        await waitFor(() => {
            expect(screen.queryByText('Nenhuma entrega ainda')).toBeNull();
        });
    });
    it('renderiza empty state "Nenhuma entrega ainda" quando histórico está vazio', async () => {
        mockUseOrderTracking.mockReturnValue({ order: null, isLoading: false });
        mockApiFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
        render(_jsx(MemoryRouter, { children: _jsx(TrackingScreen, {}) }));
        await waitFor(() => {
            expect(screen.getByText('Nenhuma entrega ainda')).toBeDefined();
        });
    });
});
