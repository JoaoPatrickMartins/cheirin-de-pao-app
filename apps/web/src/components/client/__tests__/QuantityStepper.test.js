import { jsx as _jsx } from "react/jsx-runtime";
// QuantityStepper component tests
// Requirements: UI-07 (stepper respeita min/max; botoes desabilitados nos limites)
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QuantityStepper from '../QuantityStepper';
describe('QuantityStepper [UI-07]', () => {
    beforeEach(() => { vi.clearAllMocks(); });
    describe('limites de valor', () => {
        it('value nao ultrapassa max quando botao + e pressionado no limite superior', () => {
            const onChange = vi.fn();
            render(_jsx(QuantityStepper, { min: 1, max: 5, value: 5, onChange: onChange }));
            fireEvent.click(screen.getByLabelText('aumentar'));
            expect(onChange).not.toHaveBeenCalled();
        });
        it('value nao cai abaixo de min quando botao - e pressionado no limite inferior', () => {
            const onChange = vi.fn();
            render(_jsx(QuantityStepper, { min: 1, max: 5, value: 1, onChange: onChange }));
            fireEvent.click(screen.getByLabelText('diminuir'));
            expect(onChange).not.toHaveBeenCalled();
        });
        it('value incrementa corretamente entre min e max', () => {
            const onChange = vi.fn();
            render(_jsx(QuantityStepper, { min: 1, max: 5, value: 3, onChange: onChange }));
            fireEvent.click(screen.getByLabelText('aumentar'));
            expect(onChange).toHaveBeenCalledWith(4);
        });
    });
    describe('estado dos botoes', () => {
        it('botao - esta desabilitado quando value == min', () => {
            render(_jsx(QuantityStepper, { min: 1, max: 5, value: 1, onChange: () => { } }));
            expect(screen.getByLabelText('diminuir')).toBeDisabled();
        });
        it('botao + esta desabilitado quando value == max', () => {
            render(_jsx(QuantityStepper, { min: 1, max: 5, value: 5, onChange: () => { } }));
            expect(screen.getByLabelText('aumentar')).toBeDisabled();
        });
        it('ambos os botoes habilitados quando value esta entre min e max', () => {
            render(_jsx(QuantityStepper, { min: 1, max: 5, value: 3, onChange: () => { } }));
            expect(screen.getByLabelText('diminuir')).not.toBeDisabled();
            expect(screen.getByLabelText('aumentar')).not.toBeDisabled();
        });
    });
});
