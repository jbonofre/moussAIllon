import { libelleBateau, tacheCorrespond } from './recherche-tache.ts';

const tache = {
    itemNom: 'Hivernage moteur',
    clientNom: 'Le Gall Yann',
    bateauNom: 'Galatée',
    bateauImmatriculation: 'CC 696123',
};

describe('tacheCorrespond', () => {
    it('garde tout quand la recherche est vide', () => {
        expect(tacheCorrespond(tache, '')).toBe(true);
        expect(tacheCorrespond(tache, '   ')).toBe(true);
        expect(tacheCorrespond({}, '')).toBe(true);
    });

    it('trouve par nom de client ou de bateau, sans tenir compte de la casse ni des accents', () => {
        expect(tacheCorrespond(tache, 'gall')).toBe(true);
        expect(tacheCorrespond(tache, 'YANN')).toBe(true);
        expect(tacheCorrespond(tache, 'galatee')).toBe(true);
        expect(tacheCorrespond({ ...tache, bateauNom: 'Galatee' }, 'Galatée')).toBe(true);
    });

    it("trouve par immatriculation, avec ou sans espace, et par nom d'opération", () => {
        expect(tacheCorrespond(tache, 'cc 696')).toBe(true);
        expect(tacheCorrespond(tache, 'CC696123')).toBe(true);
        expect(tacheCorrespond(tache, 'hivernage')).toBe(true);
    });

    it('exige que chaque mot saisi soit trouvé (client et bateau)', () => {
        expect(tacheCorrespond(tache, 'gall galatee')).toBe(true);
        expect(tacheCorrespond(tache, 'dupont galatee')).toBe(false);
        expect(tacheCorrespond(tache, 'albatros')).toBe(false);
    });

    it('ignore les champs absents', () => {
        expect(tacheCorrespond({ itemNom: 'Carénage' }, 'carenage')).toBe(true);
        expect(tacheCorrespond({ itemNom: 'Carénage' }, 'dupont')).toBe(false);
    });
});

describe('libelleBateau', () => {
    it("affiche le nom du bateau et son immatriculation quand elle est connue", () => {
        expect(libelleBateau(tache)).toBe('Galatée (CC 696123)');
        expect(libelleBateau({ bateauNom: 'Galatée' })).toBe('Galatée');
        expect(libelleBateau({ bateauImmatriculation: 'CC 696123' })).toBe('CC 696123');
        expect(libelleBateau({})).toBe('-');
    });
});
