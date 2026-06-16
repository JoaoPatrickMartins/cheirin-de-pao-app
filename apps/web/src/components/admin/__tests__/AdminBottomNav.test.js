import { jsx as _jsx } from "react/jsx-runtime";
// AdminBottomNav unit tests — Fase 7 / Plano 07-07 (Wave 2 — implementação real)
// Requirements: UI-09 (navegação inferior Admin com 5 itens)
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AdminBottomNav } from '../AdminBottomNav.js';
// ── Testes ────────────────────────────────────────────────────────────────────
describe('AdminBottomNav', () => {
    it('renderiza 5 abas e marca a aba ativa corretamente', () => {
        const onTabChange = vi.fn();
        render(_jsx(AdminBottomNav, { activeTab: "painel", onTabChange: onTabChange }));
        // Deve renderizar exatamente 5 botões de navegação
        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(5);
        // A aba ativa deve estar marcada com aria-current="page"
        const activeButton = screen.getByRole('button', { name: 'Painel' });
        expect(activeButton).toHaveAttribute('aria-current', 'page');
    });
    it('renderiza com aria-label de navegação administrativa', () => {
        const onTabChange = vi.fn();
        render(_jsx(AdminBottomNav, { activeTab: "pedido", onTabChange: onTabChange }));
        const nav = screen.getByRole('navigation', { name: 'Navegação administrativa' });
        expect(nav).toBeDefined();
    });
    it('marca a aba correta como ativa quando activeTab é gestao', () => {
        const onTabChange = vi.fn();
        render(_jsx(AdminBottomNav, { activeTab: "gestao", onTabChange: onTabChange }));
        const gestaoButton = screen.getByRole('button', { name: 'Gestão' });
        expect(gestaoButton).toHaveAttribute('aria-current', 'page');
        // As outras abas não devem ter aria-current
        const painelButton = screen.getByRole('button', { name: 'Painel' });
        expect(painelButton).not.toHaveAttribute('aria-current', 'page');
    });
});
