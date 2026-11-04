import { calculerMarge, calculerMargeVente } from './marge-vente.ts';

const produits = [{ id: 1, prixVenteHT: 10, tva: 20 }];
const achats = [
    { produit: { id: 1 }, prixAchatHT: 4 },
    { produit: { id: 1 }, prixAchatHT: 6 },
];
const services = [{ id: 2, dureeEstimee: 3, mainOeuvres: [{ mainOeuvre: { prixHT: 50 }, quantite: 3 }] }];

describe('calculerMarge', () => {
    it('produit : prix de vente HT moins la moyenne des prix d\'achat', () => {
        expect(calculerMarge([{ type: 'produit', itemId: 1, quantite: 2 }], produits, achats, [], [])).toBe(10);
    });

    it('produit vendu en quantité à virgule (5,5 L, 0,5 L)', () => {
        expect(calculerMarge([{ type: 'produit', itemId: 1, quantite: 5.5 }], produits, achats, [], [])).toBe(27.5);
        expect(calculerMarge([{ type: 'produit', itemId: 1, quantite: 0.5 }], produits, achats, [], [])).toBe(2.5);
    });

    it('déduit la remise de ligne (TTC converti en HT)', () => {
        expect(calculerMarge([{ type: 'produit', itemId: 1, quantite: 2, remise: 12 }], produits, achats, [], [])).toBe(0);
    });

    it('service : temps gagné valorisé au tarif de la main d\'œuvre', () => {
        expect(calculerMarge([{ type: 'service', itemId: 2, quantite: 1, dureeReelle: 2 }], [], [], services, [])).toBe(50);
    });

    it('service : dépassement de temps en négatif, rien tant que le temps réel est vide', () => {
        expect(calculerMarge([{ type: 'service', itemId: 2, dureeReelle: 4 }], [], [], services, [])).toBe(-50);
        expect(calculerMarge([{ type: 'service', itemId: 2 }], [], [], services, [])).toBe(0);
    });
});

describe('calculerMargeVente', () => {
    it('calcule la marge d\'une vente enregistrée', () => {
        const vente = {
            venteProduits: [{ produit: produits[0], quantite: 2 }],
            venteServices: [{ service: services[0], quantite: 1, dureeReelle: 2 }],
        };
        expect(calculerMargeVente(vente, achats)).toBe(60);
    });
});
