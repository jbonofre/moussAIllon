import { alertesVente, progressionChecklist } from './progression-checklist';

describe('progressionChecklist', () => {
    it('renvoie null sans checklist', () => {
        expect(progressionChecklist({ venteForfaits: [{ taches: [] }], venteServices: [] })).toBeNull();
        expect(progressionChecklist(undefined)).toBeNull();
    });

    it('compte les points faits et non faits sur forfaits et services', () => {
        const progression = progressionChecklist({
            venteForfaits: [{ taches: [{ done: true }, { nonFait: true }] }],
            venteServices: [{ taches: [{}, {}] }],
        });
        expect(progression).toEqual({ total: 4, traites: 2, pourcentage: 50 });
    });
});

describe('alertesVente', () => {
    it('détaille les incidents et les points non faits', () => {
        expect(alertesVente({
            venteForfaits: [{ status: 'INCIDENT', forfait: { nom: 'Révision' }, incidentDetails: 'Pièce cassée', incidentDate: '2026-11-02',
                taches: [{ nom: 'Vidange', nonFait: true, motif: 'Huile absente' }, { done: true }] }],
            venteServices: [{ status: 'EN_COURS', service: { nom: 'Lavage' }, taches: [{ nom: 'Coque', nonFait: true }] }],
        })).toEqual({
            incidents: [{ prestation: 'Révision', details: 'Pièce cassée', date: '2026-11-02' }],
            pointsNonFaits: [
                { prestation: 'Révision', nom: 'Vidange', motif: 'Huile absente' },
                { prestation: 'Lavage', nom: 'Coque', motif: undefined },
            ],
        });
        expect(alertesVente(undefined)).toEqual({ incidents: [], pointsNonFaits: [] });
    });
});
