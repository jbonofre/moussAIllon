import { quantiteLigne } from './quantite.ts';

describe('quantiteLigne', () => {
    it('conserve les quantités à virgule, même inférieures à 1', () => {
        expect(quantiteLigne(5.5)).toBe(5.5);
        expect(quantiteLigne(0.5)).toBe(0.5);
        expect(quantiteLigne(3)).toBe(3);
    });

    it('vaut 1 quand la quantité est absente ou nulle', () => {
        expect(quantiteLigne(undefined)).toBe(1);
        expect(quantiteLigne(null)).toBe(1);
        expect(quantiteLigne(0)).toBe(1);
        expect(quantiteLigne(-2)).toBe(1);
    });
});
