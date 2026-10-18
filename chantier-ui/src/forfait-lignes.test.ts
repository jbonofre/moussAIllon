import { filterLigneOption, mainOeuvreLigneOptions, produitLigneOptions } from './forfait-lignes.ts';

const produits = [
    { id: 1, ref: 'PRD-000001', designation: 'Huile moteur 4T', refs: ['HUI-4T'], referencesFournisseurs: ['YAM-90790'] },
    { id: 2, designation: 'Anode zinc' },
];

const rechercher = (options: ReturnType<typeof produitLigneOptions>, input: string) =>
    options.filter((option) => filterLigneOption(input, option)).map((option) => option.value);

describe('forfait-lignes', () => {
    it('affiche la référence interne devant la désignation du produit', () => {
        expect(produitLigneOptions(produits).map((option) => option.label)).toEqual(['PRD-000001 - Huile moteur 4T', 'Anode zinc']);
    });

    it('recherche un produit par référence interne, référence fournisseur ou désignation', () => {
        const options = produitLigneOptions(produits);
        expect(rechercher(options, 'prd-000001')).toEqual([1]);
        expect(rechercher(options, 'hui-4t')).toEqual([1]);
        expect(rechercher(options, 'YAM-90790')).toEqual([1]);
        expect(rechercher(options, ' huile ')).toEqual([1]);
        expect(rechercher(options, 'zinc')).toEqual([2]);
        // l'identifiant technique n'est pas un critère de recherche
        expect(rechercher(options, '2')).toEqual([]);
    });

    it('recherche une main d\'œuvre par référence ou nom', () => {
        const options = mainOeuvreLigneOptions([
            { id: 1, reference: 'MO-000001', nom: 'Vidange' },
            { id: 2, nom: 'Hivernage' },
        ]);
        expect(options.map((option) => option.label)).toEqual(['MO-000001 - Vidange', 'Hivernage']);
        expect(rechercher(options, 'mo-000001')).toEqual([1]);
        expect(rechercher(options, 'hiver')).toEqual([2]);
    });
});
