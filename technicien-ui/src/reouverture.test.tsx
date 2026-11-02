import { dureeReelleALaFin, messageErreur, peutEtreRouverte } from './reouverture.tsx';

const a = (dateHeure: string) => new Date(dateHeure).getTime();

describe('dureeReelleALaFin', () => {
    it('compte le temps écoulé depuis le début de la tâche', () => {
        expect(dureeReelleALaFin({ dateDebut: '2026-11-02T08:00:00' }, a('2026-11-02T10:30:00'))).toBe(2.5);
    });

    it('après une réouverture, ajoute au temps déjà compté celui écoulé depuis la réouverture', () => {
        const tache = {
            dateDebut: '2026-10-30T08:00:00',
            dateReouverture: '2026-11-02 14:00:00.0',
            dureeReelle: 2,
        };
        expect(dureeReelleALaFin(tache, a('2026-11-02T14:45:00'))).toBe(2.75);
    });

    it('garde le temps déjà compté sans date exploitable', () => {
        expect(dureeReelleALaFin({ dureeReelle: 1.5 }, a('2026-11-02T10:00:00'))).toBe(1.5);
        expect(dureeReelleALaFin({ dateDebut: '2026-11-02T12:00:00', dureeReelle: 1.5 }, a('2026-11-02T10:00:00'))).toBe(1.5);
        expect(dureeReelleALaFin({}, a('2026-11-02T10:00:00'))).toBe(0);
    });
});

describe('peutEtreRouverte', () => {
    it("rouvre une tâche terminée tant que la vente n'est pas payée", () => {
        expect(peutEtreRouverte({ itemStatus: 'TERMINEE', venteType: 'FACTURE_EN_ATTENTE' })).toBe(true);
        expect(peutEtreRouverte({ itemStatus: 'TERMINEE', venteType: 'FACTURE_PRETE' })).toBe(true);
        expect(peutEtreRouverte({ itemStatus: 'TERMINEE', venteType: 'FACTURE_PAYEE' })).toBe(false);
        expect(peutEtreRouverte({ itemStatus: 'EN_COURS', venteType: 'FACTURE_EN_ATTENTE' })).toBe(false);
    });
});

describe('messageErreur', () => {
    it('reprend le message du portail, sinon le message par défaut', () => {
        expect(messageErreur({ response: { data: { message: 'Une vente payée ne peut plus être modifiée' } } }, 'Erreur'))
            .toBe('Une vente payée ne peut plus être modifiée');
        expect(messageErreur(new Error('réseau'), 'Erreur')).toBe('Erreur');
    });
});
