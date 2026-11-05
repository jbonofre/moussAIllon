import { erreurLignesLibresAvoir, nouvelleLigneLibreAvoir, totalTTCLigneLibreAvoir } from './avoir-ligne-libre.ts';

describe('avoir-ligne-libre', () => {
    it('propose une ligne d\'une unité, au taux de TVA donné', () => {
        expect(nouvelleLigneLibreAvoir(20)).toEqual({ designation: '', quantite: 1, prixUnitaireHT: 0, tva: 20 });
    });

    it('calcule le total TTC d\'une demi-heure de main d\'œuvre', () => {
        expect(totalTTCLigneLibreAvoir({ designation: "Main d'œuvre", quantite: 0.5, prixUnitaireHT: 60, tva: 20 })).toBe(36);
    });

    it('arrondit la TVA au centime, comme le backend', () => {
        expect(totalTTCLigneLibreAvoir({ designation: 'Geste', quantite: 3, prixUnitaireHT: 3.33, tva: 5.5 })).toBe(10.54);
        expect(totalTTCLigneLibreAvoir({ designation: 'Geste', quantite: 1, prixUnitaireHT: 50, tva: 0 })).toBe(50);
    });

    it('exige une désignation sur chaque ligne libre', () => {
        expect(erreurLignesLibresAvoir([])).toBeUndefined();
        expect(erreurLignesLibresAvoir([{ designation: 'Main d\'œuvre', quantite: 1, prixUnitaireHT: 60, tva: 20 }])).toBeUndefined();
        expect(erreurLignesLibresAvoir([{ designation: '  ', quantite: 1, prixUnitaireHT: 60, tva: 20 }]))
            .toBe('Toutes les lignes libres doivent avoir une désignation');
    });
});
