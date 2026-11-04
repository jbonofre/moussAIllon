import {
    calculerTvaVente,
    calculerTvaVenteDepuisHT,
    clientExonereTva,
    prixArticleVente,
    prixPrestationVente,
    prixUnitaireVente,
    tauxTvaVente,
} from './tva-vente.ts';

describe('calculerTvaVente', () => {
    it('applique le taux de la vente à tout le montant sans article d\'occasion', () => {
        expect(calculerTvaVente(120, 0, 20)).toEqual({ montantTVA: 20, montantHT: 100 });
    });

    it('exclut les articles d\'occasion de la base taxable', () => {
        // 120 TTC à 20 % + 5000 d'occasion sans TVA
        expect(calculerTvaVente(5120, 5000, 20)).toEqual({ montantTVA: 20, montantHT: 5100 });
    });

    it('ne compte aucune TVA si toute la vente est d\'occasion', () => {
        expect(calculerTvaVente(5000, 5000, 20)).toEqual({ montantTVA: 0, montantHT: 5000 });
    });
});

describe('calculerTvaVenteDepuisHT', () => {
    it('applique le taux de la vente au montant HT', () => {
        expect(calculerTvaVenteDepuisHT(100, 0, 10)).toEqual({ montantTVA: 10, montantTTC: 110 });
    });

    it('exclut les articles d\'occasion de la base taxable', () => {
        // 100 HT à 20 % + 5000 d'occasion sans TVA
        expect(calculerTvaVenteDepuisHT(5100, 5000, 20)).toEqual({ montantTVA: 20, montantTTC: 5120 });
    });

    it('retrouve le TTC des lignes quand le taux revient à celui des articles', () => {
        const { montantHT } = calculerTvaVente(12, 0, 20);
        expect(calculerTvaVenteDepuisHT(montantHT, 0, 20).montantTTC).toBe(12);
    });
});

describe('tauxTvaVente', () => {
    it('déduit le taux du montant de TVA et du HT', () => {
        expect(tauxTvaVente(10, 0, 3)).toBe(30);
    });

    it('exclut les articles d\'occasion de la base taxable', () => {
        expect(tauxTvaVente(5100, 5000, 20)).toBe(20);
    });

    it('arrondit le taux au centième', () => {
        // 100 TTC à 20 % : 83,33 HT et 16,67 de TVA
        expect(tauxTvaVente(83.33, 0, 16.67)).toBe(20);
    });

    it('ne déduit aucun taux sans base taxable', () => {
        expect(tauxTvaVente(0, 0, 5)).toBeUndefined();
        expect(tauxTvaVente(5000, 5000, 5)).toBeUndefined();
    });
});

describe('clientExonereTva', () => {
    it('exonère le professionnel de la mer uniquement', () => {
        expect(clientExonereTva({ type: 'PROFESSIONNEL_MER' })).toBe(true);
        expect(clientExonereTva({ type: 'PROFESSIONNEL' })).toBe(false);
        expect(clientExonereTva({ type: 'PARTICULIER' })).toBe(false);
        expect(clientExonereTva(undefined)).toBe(false);
    });
});

describe('prixUnitaireVente', () => {
    it('vend au prix TTC un client non exonéré', () => {
        expect(prixUnitaireVente(120, 100, 20, false)).toBe(120);
    });

    it('vend au prix HT un client exonéré de TVA', () => {
        expect(prixUnitaireVente(120, 100, 20, true)).toBe(100);
    });

    it('déduit le prix HT du TTC et du taux de l\'article s\'il n\'est pas renseigné', () => {
        expect(prixUnitaireVente(110, undefined, 10, true)).toBe(100);
        expect(prixUnitaireVente(12, 0, 20, true)).toBe(10);
    });

    it('lit le prix des articles du catalogue et des prestations', () => {
        expect(prixArticleVente({ prixVenteTTC: 60, prixVenteHT: 50, tva: 20 }, true)).toBe(50);
        expect(prixArticleVente({ prixVenteTTC: 60, prixVenteHT: 50, tva: 20 }, false)).toBe(60);
        // Ligne libre : seuls le prix TTC et le taux sont saisis
        expect(prixArticleVente({ prixVenteTTC: 24, tva: 20 }, true)).toBe(20);
        expect(prixPrestationVente({ prixTTC: 300, prixHT: 250, tva: 20 }, true)).toBe(250);
        expect(prixPrestationVente(undefined, true)).toBe(0);
    });
});
