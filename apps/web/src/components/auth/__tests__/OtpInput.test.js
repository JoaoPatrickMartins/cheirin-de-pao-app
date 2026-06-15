import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen, fireEvent } from '@testing-library/react';
import { OtpInput } from '../OtpInput';
describe('OtpInput [UI-06]', () => {
    it('renders 4 input elements', () => {
        render(_jsx(OtpInput, { onComplete: () => { } }));
        const inputs = screen.getAllByRole('textbox');
        expect(inputs).toHaveLength(4);
    });
    it('calls onComplete when all 4 digits filled', () => {
        const onComplete = vi.fn();
        render(_jsx(OtpInput, { onComplete: onComplete }));
        const inputs = screen.getAllByRole('textbox');
        fireEvent.change(inputs[0], { target: { value: '1' } });
        fireEvent.change(inputs[1], { target: { value: '2' } });
        fireEvent.change(inputs[2], { target: { value: '3' } });
        fireEvent.change(inputs[3], { target: { value: '4' } });
        expect(onComplete).toHaveBeenCalledWith('1234');
    });
    it('rejects non-numeric characters', () => {
        const onComplete = vi.fn();
        render(_jsx(OtpInput, { onComplete: onComplete }));
        const inputs = screen.getAllByRole('textbox');
        // Attempt to type a non-numeric character
        fireEvent.change(inputs[0], { target: { value: 'a' } });
        expect(inputs[0]).toHaveValue('');
        fireEvent.change(inputs[0], { target: { value: '!' } });
        expect(inputs[0]).toHaveValue('');
        // Numeric input should work
        fireEvent.change(inputs[0], { target: { value: '5' } });
        expect(inputs[0]).toHaveValue('5');
    });
    it('focuses previous input on Backspace when current is empty', () => {
        render(_jsx(OtpInput, { onComplete: () => { } }));
        const inputs = screen.getAllByRole('textbox');
        // Fill first two inputs
        fireEvent.change(inputs[0], { target: { value: '1' } });
        fireEvent.change(inputs[1], { target: { value: '2' } });
        // Clear second input then press Backspace — should focus first
        fireEvent.change(inputs[1], { target: { value: '' } });
        inputs[1].focus();
        fireEvent.keyDown(inputs[1], { key: 'Backspace' });
        // After backspace on empty box, focus moves to previous
        expect(document.activeElement).toBe(inputs[0]);
    });
});
