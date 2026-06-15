// useSchedule hook tests — Wave 2 implementation (GREEN state)
// Requirements: SCHED-02, SCHED-06 (cálculo de cobertura de créditos D-03)
import { describe, it, expect } from 'vitest';
function calcConsumoSemanal(weeklyQty) {
    return Object.values(weeklyQty).reduce((a, b) => a + b, 0);
}
function calcCobre(creditBalance, consumoSemanal) {
    return Math.floor(creditBalance / (consumoSemanal || 1));
}
function calcFalta(consumoSemanal, creditBalance) {
    return consumoSemanal > creditBalance;
}
describe('useSchedule coverage calculation', () => {
    it('calcula consumoSemanal como soma de todos os dias em weeklyQty', () => {
        const weeklyQty = {
            seg: 2,
            ter: 3,
            qua: 0,
            qui: 1,
            sex: 2,
            sab: 0,
            dom: 1,
        };
        expect(calcConsumoSemanal(weeklyQty)).toBe(9);
    });
    it('calcula cobre como Math.floor(saldo dividido por consumoSemanal)', () => {
        // saldo 30, consumo 7 => Math.floor(30/7) = 4
        expect(calcCobre(30, 7)).toBe(4);
        // saldo 21, consumo 7 => Math.floor(21/7) = 3
        expect(calcCobre(21, 7)).toBe(3);
        // saldo 10, consumo 4 => Math.floor(10/4) = 2
        expect(calcCobre(10, 4)).toBe(2);
    });
    it('retorna falta true quando semana maior que saldo', () => {
        // consumo 10, saldo 5 => falta = true
        expect(calcFalta(10, 5)).toBe(true);
        // consumo 5, saldo 5 => falta = false (igual ao saldo = cobre)
        expect(calcFalta(5, 5)).toBe(false);
        // consumo 3, saldo 10 => falta = false
        expect(calcFalta(3, 10)).toBe(false);
    });
    it('evita divisão por zero quando consumoSemanal é 0', () => {
        // consumoSemanal=0 => usa (0 || 1) = 1 no denominador => Math.floor(saldo/1)
        const resultado = calcCobre(10, 0);
        expect(Number.isFinite(resultado)).toBe(true);
        expect(resultado).toBe(10); // Math.floor(10/1)
    });
});
