import { comparerNumeroSerie, correspondNumeroSerie, forfaitCorrespondAuMoteur, motifsNumeroSerie } from './numero-serie.ts';

describe('numero-serie', () => {
    it('découpe les motifs sur les virgules, points-virgules et retours à la ligne', () => {
        expect(motifsNumeroSerie(' 6ek-10* ; 1B0..1B9,\n0R1 ,, ')).toEqual(['6EK-10*', '1B0..1B9', '0R1']);
        expect(motifsNumeroSerie(undefined)).toEqual([]);
    });

    it('reconnaît un numéro exact sans tenir compte de la casse', () => {
        expect(correspondNumeroSerie('6EK-1012345', ' 6ek-1012345')).toBe(true);
        expect(correspondNumeroSerie('6EK-1012345', '6EK-10123456')).toBe(false);
    });

    it('reconnaît les jokers * et ?', () => {
        expect(correspondNumeroSerie('6EK-10*', '6EK-1012345')).toBe(true);
        expect(correspondNumeroSerie('6EK-10*', '6EL-1012345')).toBe(false);
        expect(correspondNumeroSerie('1B2345??', '1B234567')).toBe(true);
        expect(correspondNumeroSerie('1B2345??', '1B2345678')).toBe(false);
        // les caractères spéciaux des expressions régulières sont pris à la lettre
        expect(correspondNumeroSerie('F.115(X)*', 'F.115(X)-01')).toBe(true);
        expect(correspondNumeroSerie('F.115*', 'FA115')).toBe(false);
    });

    it('reconnaît une plage, bornes incluses, en comparant les parties numériques par valeur', () => {
        expect(correspondNumeroSerie('1B000000..1B099999', '1B000000')).toBe(true);
        expect(correspondNumeroSerie('1B000000..1B099999', '1b054321')).toBe(true);
        expect(correspondNumeroSerie('1B000000..1B099999', '1B099999')).toBe(true);
        expect(correspondNumeroSerie('1B000000..1B099999', '1B100000')).toBe(false);
        expect(correspondNumeroSerie('1B000000..1B099999', '1C000001')).toBe(false);
        expect(correspondNumeroSerie('SN-900..SN-1200', 'SN-1000')).toBe(true);
        expect(correspondNumeroSerie('SN-900..SN-1200', 'SN-1500')).toBe(false);
        expect(comparerNumeroSerie('1B999', '1B1000')).toBeLessThan(0);
    });

    it('accepte une plage ouverte d’un côté', () => {
        expect(correspondNumeroSerie('1B050000..', '1B999999')).toBe(true);
        expect(correspondNumeroSerie('1B050000..', '1B049999')).toBe(false);
        expect(correspondNumeroSerie('..1B050000', '1B000001')).toBe(true);
        expect(correspondNumeroSerie('..', '1B000001')).toBe(false);
    });

    it('ne reconnaît rien sans motif ou sans numéro de série', () => {
        expect(correspondNumeroSerie('', '1B000000')).toBe(false);
        expect(correspondNumeroSerie('*', undefined)).toBe(false);
        expect(correspondNumeroSerie('*', '  ')).toBe(false);
    });

    describe('forfaitCorrespondAuMoteur', () => {
        const moteur = { id: 7, numeroSerie: '6EK-1012345', modele: { id: 3 } };

        it('applique un forfait associé directement au moteur client', () => {
            expect(forfaitCorrespondAuMoteur({ moteursClientsAssocies: [{ id: 7 }], numerosSerieMoteur: 'AUTRE*' }, moteur)).toBe(true);
        });

        it('applique un forfait sans motif à tous les moteurs du modèle associé', () => {
            expect(forfaitCorrespondAuMoteur({ moteursAssocies: [{ id: 3 }] }, moteur)).toBe(true);
            expect(forfaitCorrespondAuMoteur({ moteursAssocies: [{ id: 4 }] }, moteur)).toBe(false);
            expect(forfaitCorrespondAuMoteur({}, moteur)).toBe(false);
        });

        it('applique un forfait avec motifs aux seuls numéros de série couverts', () => {
            expect(forfaitCorrespondAuMoteur({ numerosSerieMoteur: '6EK-10*' }, moteur)).toBe(true);
            expect(forfaitCorrespondAuMoteur({ numerosSerieMoteur: '6EK-11*' }, moteur)).toBe(false);
            // le modèle associé ne suffit plus : le numéro de série doit aussi correspondre
            expect(forfaitCorrespondAuMoteur({ moteursAssocies: [{ id: 3 }], numerosSerieMoteur: '6EK-11*' }, moteur)).toBe(false);
            expect(forfaitCorrespondAuMoteur({ moteursAssocies: [{ id: 3 }], numerosSerieMoteur: '6EK-10*' }, moteur)).toBe(true);
            // les motifs sont limités aux modèles associés
            expect(forfaitCorrespondAuMoteur({ moteursAssocies: [{ id: 4 }], numerosSerieMoteur: '6EK-10*' }, moteur)).toBe(false);
        });

        it('ne s’applique à aucun moteur absent', () => {
            expect(forfaitCorrespondAuMoteur({ numerosSerieMoteur: '*' }, undefined)).toBe(false);
        });
    });
});
