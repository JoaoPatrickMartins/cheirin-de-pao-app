import { jsx as _jsx } from "react/jsx-runtime";
// ClientTabBar component tests
// Requirements: UI-08 (4 abas com labels corretos; aba ativa com cor diferente)
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ClientTabBar } from '../ClientTabBar';
describe('ClientTabBar [UI-08]', () => {
    beforeEach(() => { vi.clearAllMocks(); });
    describe('renderizacao das abas', () => {
        it('renderiza exatamente 4 abas de navegacao', () => {
            render(_jsx(MemoryRouter, { initialEntries: ['/client/home'], children: _jsx(ClientTabBar, {}) }));
            const buttons = screen.getAllByRole('button');
            expect(buttons).toHaveLength(4);
        });
        it('aba "Inicio" esta presente com label correto', () => {
            render(_jsx(MemoryRouter, { initialEntries: ['/client/home'], children: _jsx(ClientTabBar, {}) }));
            expect(screen.getByText('Início')).toBeDefined();
        });
        it('aba "Agenda" esta presente com label correto', () => {
            render(_jsx(MemoryRouter, { initialEntries: ['/client/home'], children: _jsx(ClientTabBar, {}) }));
            expect(screen.getByText('Agenda')).toBeDefined();
        });
        it('aba "Creditos" esta presente com label correto', () => {
            render(_jsx(MemoryRouter, { initialEntries: ['/client/home'], children: _jsx(ClientTabBar, {}) }));
            expect(screen.getByText('Créditos')).toBeDefined();
        });
        it('aba "Pedidos" esta presente com label correto', () => {
            render(_jsx(MemoryRouter, { initialEntries: ['/client/home'], children: _jsx(ClientTabBar, {}) }));
            expect(screen.getByText('Pedidos')).toBeDefined();
        });
    });
    describe('estado ativo', () => {
        it('aba ativa tem data-active="true" diferente das inativas', () => {
            render(_jsx(MemoryRouter, { initialEntries: ['/client/home'], children: _jsx(ClientTabBar, {}) }));
            const activeButtons = screen.getAllByRole('button').filter(btn => btn.getAttribute('data-active') === 'true');
            expect(activeButtons).toHaveLength(1);
        });
        it('apenas uma aba esta ativa por vez', () => {
            render(_jsx(MemoryRouter, { initialEntries: ['/client/creditos'], children: _jsx(ClientTabBar, {}) }));
            const activeButtons = screen.getAllByRole('button').filter(btn => btn.getAttribute('data-active') === 'true');
            expect(activeButtons).toHaveLength(1);
        });
    });
});
