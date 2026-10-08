import { articlesDuPackage, getPackageLabel, parsePackageRef, totalPackageTTC, PackageEntity } from './package-lignes.ts';

const pack: PackageEntity = {
    id: 7,
    designation: 'Pack prêt à naviguer',
    ref: 'PKG-000007',
    lignes: [
        { id: 1, bateau: { id: 1, designation: 'Cap Camarat 6.5', prixVenteTTC: 45000 }, quantite: 1 },
        { id: 2, moteur: { id: 1, designation: 'F115 XB', prixVenteTTC: 13000 }, quantite: 1 },
        { id: 3, produit: { id: 1, designation: 'Anode zinc', prixVenteTTC: 12.1 }, quantite: 4 },
    ],
};

describe('package-lignes', () => {
    it('liste les articles du package avec leur type, dans l\'ordre des lignes', () => {
        expect(articlesDuPackage(pack).map(({ type, article, quantite }) => [type, article.designation, quantite])).toEqual([
            ['bateau', 'Cap Camarat 6.5', 1],
            ['moteur', 'F115 XB', 1],
            ['produit', 'Anode zinc', 4],
        ]);
    });

    it('ignore les lignes sans article et ramène la quantité à 1 au minimum', () => {
        const incomplet: PackageEntity = {
            designation: 'Incomplet',
            lignes: [{ quantite: 3 }, { helice: { id: 5, designation: 'Alu 13x19' }, quantite: 0 }, { remorque: { id: 2, designation: 'Satellite 750' } }],
        };
        expect(articlesDuPackage(incomplet).map(({ type, quantite }) => [type, quantite])).toEqual([['helice', 1], ['remorque', 1]]);
        expect(articlesDuPackage(undefined)).toEqual([]);
        expect(articlesDuPackage({ designation: 'Sans ligne' })).toEqual([]);
    });

    it('calcule le total TTC au prix catalogue', () => {
        expect(totalPackageTTC(pack)).toBe(58048.4);
        expect(totalPackageTTC({ designation: 'Vide', lignes: [] })).toBe(0);
    });

    it('libelle le package avec sa référence', () => {
        expect(getPackageLabel(pack)).toBe('PKG-000007 - Pack prêt à naviguer');
        expect(getPackageLabel({ designation: 'Sans référence' })).toBe('Sans référence');
    });

    it('ne reconnaît que les références de package', () => {
        expect(parsePackageRef('package:7')).toBe(7);
        expect(parsePackageRef('produit:7')).toBeUndefined();
        expect(parsePackageRef('package:')).toBeUndefined();
        expect(parsePackageRef(undefined)).toBeUndefined();
    });
});
