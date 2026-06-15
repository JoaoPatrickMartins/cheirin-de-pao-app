import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen, fireEvent } from '@testing-library/react';
import { OtpInput } from '../auth/OtpInput';
describe('OtpInput [UI-06]', () => {
    it('renders 4 input elements', () => {
        render(_jsx(OtpInput, { onComplete: () => { } }));
        const inputs = screen.getAllByRole('textbox');
        expect(inputs).toHaveLength(4);
    });
    it('focus advances to next input when digit entered', () => {
        render(_jsx(OtpInput, { onComplete: () => { } }));
        const inputs = screen.getAllByRole('textbox');
        // Focus first input and type a digit
        inputs[0].focus();
        fireEvent.change(inputs[0], { target: { value: '1' } });
        // After entering digit in first box, second box should be focused
        expect(document.activeElement).toBe(inputs[1]);
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
        // Non-numeric input should be rejected
        fireEvent.change(inputs[0], { target: { value: 'a' } });
        expect(inputs[0]).toHaveValue('');
        fireEvent.change(inputs[0], { target: { value: '!' } });
        expect(inputs[0]).toHaveValue('');
        // Numeric input should work
        fireEvent.change(inputs[0], { target: { value: '5' } });
        expect(inputs[0]).toHaveValue('5');
    });
});
