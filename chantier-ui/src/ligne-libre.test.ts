import {
    articleALaVolee,
    articleCreePourLigneLibre,
    erreurDesignationLibre,
    erreurRefLibre,
    insererLigneLibre,
    nouvelleLigneLibre,
} from './ligne-libre.ts';

const catalogue = [
    { id: 1, designation: 'Anode zinc', ref: 'AN-1' },
    { id: 2, designation: 'Filtre à huile' },
];

describe('ligne-libre', () => {
    it('propose une TVA de 20 % sur une nouvelle ligne libre', () => {
        expect(nouvelleLigneLibre()).toEqual({ tva: 20 });
    });

    it('transmet l\'article saisi, désignation et référence nettoyées', () => {
        expect(articleALaVolee({ ref: '  MAN-6 ', designation: ' Manille inox 6 mm ', prixVenteTTC: 4.5, tva: 10 }))
            .toEqual({ ref: 'MAN-6', designation: 'Manille inox 6 mm', prixVenteTTC: 4.5, tva: 10 });
    });

    it('laisse le backend générer une référence absente, et garde une TVA à 0 %', () => {
        expect(articleALaVolee({ ref: '   ', designation: 'Bout', tva: 0 }))
            .toEqual({ ref: undefined, designation: 'Bout', prixVenteTTC: 0, tva: 0 });
        expect(articleALaVolee({ designation: 'Bout' }).tva).toBe(20);
    });

    it('exige une désignation absente du catalogue et des autres lignes libres', () => {
        expect(erreurDesignationLibre('  ', catalogue, [])).toBe('Désignation requise');
        expect(erreurDesignationLibre(undefined, catalogue, [])).toBe('Désignation requise');
        expect(erreurDesignationLibre(' anode ZINC ', catalogue, [])).toBe('Article déjà au catalogue');
        expect(erreurDesignationLibre('Manille', catalogue, [{ designation: 'manille ' }])).toBe('Déjà saisie sur une autre ligne');
        expect(erreurDesignationLibre('Manille', catalogue, [{ designation: 'Bout' }])).toBeUndefined();
    });

    it('accepte une référence vide, mais pas une référence déjà utilisée', () => {
        expect(erreurRefLibre(undefined, catalogue, [])).toBeUndefined();
        expect(erreurRefLibre(' ', catalogue, [])).toBeUndefined();
        expect(erreurRefLibre('an-1', catalogue, [])).toBe('Référence déjà utilisée');
        expect(erreurRefLibre('MAN-6', catalogue, [{ ref: 'man-6' }])).toBe('Déjà saisie sur une autre ligne');
        expect(erreurRefLibre('MAN-6', catalogue, [{ ref: 'MAN-8' }])).toBeUndefined();
    });

    it('retrouve l\'article créé par sa désignation dans la vente enregistrée', () => {
        const vendus = [{ id: 1, designation: 'Anode zinc' }, { id: 42, designation: 'Manille inox' }];
        expect(articleCreePourLigneLibre({ designation: ' manille INOX' }, vendus)).toEqual({ id: 42, designation: 'Manille inox' });
        expect(articleCreePourLigneLibre({ designation: 'Bout' }, vendus)).toBeUndefined();
        expect(articleCreePourLigneLibre({ designation: 'Manille inox' }, [{ designation: 'Manille inox' }])).toBeUndefined();
    });

    it('insère la ligne libre avant la ligne vide de saisie', () => {
        const estVide = (ligne: { ref?: string; libre?: object }) => !ligne.ref && !ligne.libre;
        const libre = { libre: { tva: 20 } };
        expect(insererLigneLibre([{ ref: 'produit:1' }, {}], libre, {}, estVide)).toEqual([{ ref: 'produit:1' }, libre, {}]);
        expect(insererLigneLibre([{ ref: 'produit:1' }], libre, {}, estVide)).toEqual([{ ref: 'produit:1' }, libre, {}]);
        expect(insererLigneLibre([], libre, {}, estVide)).toEqual([libre, {}]);
    });
});
