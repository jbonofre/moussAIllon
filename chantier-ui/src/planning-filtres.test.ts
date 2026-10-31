import { correspondFiltres, correspondRecherche, nombreFiltresActifs, type LignePlanningFiltrable } from './planning-filtres.ts';

const ligne = (surcharge: Partial<LignePlanningFiltrable['item']> = {}, bonPourAccord = true): LignePlanningFiltrable => ({
    vente: { bonPourAccord },
    item: {
        type: 'forfait',
        nom: 'Hivernage moteur',
        clientNom: 'Hélène Le Gall',
        bateauNom: 'Bavaria 32',
        bateauImmatriculation: 'CM 123456',
        techniciens: [],
        ...surcharge,
    },
});

describe('correspondRecherche', () => {
    const champs = ['Hélène Le Gall', 'Bavaria 32', 'CM 123456', 'Hivernage moteur'];

    it('accepte tout quand la recherche est vide', () => {
        expect(correspondRecherche(champs, '')).toBe(true);
        expect(correspondRecherche(champs, '   ')).toBe(true);
        expect(correspondRecherche(champs, undefined)).toBe(true);
    });

    it('ignore la casse et les accents', () => {
        expect(correspondRecherche(champs, 'HELENE')).toBe(true);
        expect(correspondRecherche(champs, 'bavaria')).toBe(true);
    });

    it("trouve une immatriculation tapée sans espace ou avec un tiret", () => {
        expect(correspondRecherche(champs, 'cm123456')).toBe(true);
        expect(correspondRecherche(champs, 'CM-123456')).toBe(true);
        expect(correspondRecherche(champs, '3456')).toBe(true);
    });

    it('exige que chaque mot se retrouve dans un des champs', () => {
        expect(correspondRecherche(champs, 'gall bavaria')).toBe(true);
        expect(correspondRecherche(champs, 'gall jeanneau')).toBe(false);
    });

    it('ne trouve rien quand aucun champ ne correspond', () => {
        expect(correspondRecherche(champs, 'dupont')).toBe(false);
        expect(correspondRecherche([undefined, undefined], 'dupont')).toBe(false);
    });
});

describe('correspondFiltres', () => {
    it('cherche dans le client, le bateau, l’immatriculation et la prestation', () => {
        expect(correspondFiltres(ligne(), { recherche: 'le gall' })).toBe(true);
        expect(correspondFiltres(ligne(), { recherche: 'bavaria' })).toBe(true);
        expect(correspondFiltres(ligne(), { recherche: 'cm123456' })).toBe(true);
        expect(correspondFiltres(ligne(), { recherche: 'hivernage' })).toBe(true);
        expect(correspondFiltres(ligne(), { recherche: 'carénage' })).toBe(false);
    });

    it('filtre par technicien affecté', () => {
        const affectee = ligne({ techniciens: [{ id: 1 }, { id: 2 }] });
        expect(correspondFiltres(affectee, { technicienId: 2 })).toBe(true);
        expect(correspondFiltres(affectee, { technicienId: 3 })).toBe(false);
        expect(correspondFiltres(ligne(), { technicienId: 1 })).toBe(false);
    });

    it('filtre par type de prestation', () => {
        expect(correspondFiltres(ligne(), { type: 'forfait' })).toBe(true);
        expect(correspondFiltres(ligne(), { type: 'service' })).toBe(false);
    });

    it('filtre sur le bon pour accord', () => {
        expect(correspondFiltres(ligne({}, true), { bonPourAccord: 'avec' })).toBe(true);
        expect(correspondFiltres(ligne({}, true), { bonPourAccord: 'sans' })).toBe(false);
        expect(correspondFiltres(ligne({}, false), { bonPourAccord: 'sans' })).toBe(true);
        expect(correspondFiltres(ligne({}, false), { bonPourAccord: 'avec' })).toBe(false);
    });

    it('combine les filtres', () => {
        const filtres = { recherche: 'bavaria', type: 'forfait' as const, bonPourAccord: 'avec' as const };
        expect(correspondFiltres(ligne(), filtres)).toBe(true);
        expect(correspondFiltres(ligne({}, false), filtres)).toBe(false);
    });
});

describe('nombreFiltresActifs', () => {
    it('compte les filtres renseignés, sans compter une recherche faite d’espaces', () => {
        expect(nombreFiltresActifs({})).toBe(0);
        expect(nombreFiltresActifs({ recherche: '  ' })).toBe(0);
        expect(nombreFiltresActifs({ recherche: 'gall', technicienId: 1, type: 'service', bonPourAccord: 'sans', statut: 'EN_ATTENTE' })).toBe(5);
    });
});
