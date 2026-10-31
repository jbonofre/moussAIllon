import { comparerDatesVentes } from './tri-ventes.ts';

describe('comparerDatesVentes', () => {
    it('classe les ventes par date', () => {
        const ventes = [
            { id: 1, date: '2026-10-30T09:00:00' },
            { id: 2, date: '2026-09-15T00:00:00' },
            { id: 3, date: '2026-10-30T14:30:00' },
        ];
        expect([...ventes].sort(comparerDatesVentes).map((v) => v.id)).toEqual([2, 1, 3]);
    });

    it('départage les ventes du même jour par leur ordre de création', () => {
        const ventes = [
            { id: 8, date: '2026-10-30T00:00:00' },
            { id: 5, date: '2026-10-30T00:00:00' },
        ];
        expect([...ventes].sort(comparerDatesVentes).map((v) => v.id)).toEqual([5, 8]);
    });

    it('considère une vente sans date comme la plus ancienne', () => {
        const ventes = [
            { id: 1, date: '2026-10-30T00:00:00' },
            { id: 2, date: undefined },
            { id: 3, date: null },
        ];
        expect([...ventes].sort(comparerDatesVentes).map((v) => v.id)).toEqual([2, 3, 1]);
    });
});
