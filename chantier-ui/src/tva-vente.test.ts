import { calculerTvaVente } from './tva-vente.ts';

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
