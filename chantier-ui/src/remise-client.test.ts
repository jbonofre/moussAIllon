import { remiseClientEnVigueur, remiseSurMontant, tauxRemiseClient } from './remise-client.ts';

describe('tauxRemiseClient', () => {
    it('reprend le pourcentage de la fiche client', () => {
        expect(tauxRemiseClient({ remise: 10 })).toBe(10);
        expect(tauxRemiseClient({ remise: '12.5' })).toBe(12.5);
    });

    it('vaut 0 sans client ou sans remise', () => {
        expect(tauxRemiseClient(undefined)).toBe(0);
        expect(tauxRemiseClient({})).toBe(0);
        expect(tauxRemiseClient({ remise: -5 })).toBe(0);
    });

    it('ne dépasse pas 100 %', () => {
        expect(tauxRemiseClient({ remise: 150 })).toBe(100);
    });
});

describe('remiseClientEnVigueur', () => {
    it('reconnaît la remise du client sur une vente enregistrée', () => {
        expect(remiseClientEnVigueur({ remise: 10 }, 31.2, 312)).toBe(true);
    });

    it('tolère un écart d\'arrondi d\'un centime', () => {
        expect(remiseClientEnVigueur({ remise: 15 }, 0.51, 3.33)).toBe(true);
        expect(remiseClientEnVigueur({ remise: 15 }, 0.49, 3.33)).toBe(true);
    });

    it('s\'applique à une vente encore vide', () => {
        expect(remiseClientEnVigueur({ remise: 10 }, 0, 0)).toBe(true);
    });

    it('ne reconnaît pas une remise saisie à la main', () => {
        expect(remiseClientEnVigueur({ remise: 10 }, 20, 312)).toBe(false);
        expect(remiseClientEnVigueur({ remise: 10 }, 0, 312)).toBe(false);
    });

    it('ne s\'applique pas à un client sans remise', () => {
        expect(remiseClientEnVigueur({ remise: 0 }, 0, 0)).toBe(false);
        expect(remiseClientEnVigueur(undefined, 0, 0)).toBe(false);
    });
});

describe('remiseSurMontant', () => {
    it('garde le pourcentage de la remise du client', () => {
        expect(remiseSurMontant(200, 10, 10, true)).toEqual({ remise: 20, remisePourcentage: 10, prixVenteTTC: 180 });
    });

    it('garde le montant d\'une remise saisie à la main', () => {
        expect(remiseSurMontant(200, 10, 10, false)).toEqual({ remise: 10, remisePourcentage: 5, prixVenteTTC: 190 });
    });

    it('vaut 0 % pour une vente vide', () => {
        expect(remiseSurMontant(0, 0, 0, false)).toEqual({ remise: 0, remisePourcentage: 0, prixVenteTTC: 0 });
    });
});
