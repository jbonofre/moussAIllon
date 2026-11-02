import dayjs from 'dayjs';
import { erreurHoraires, libelleCorrection, peutCorrigerHoraires } from './horaires.tsx';

const maintenant = dayjs('2026-11-02T18:00:00');
const h = (s: string) => dayjs(s);

describe('erreurHoraires', () => {
    it('accepte un début seul ou un début et une fin cohérents', () => {
        expect(erreurHoraires(h('2026-11-02T08:00:00'), null, maintenant)).toBeUndefined();
        expect(erreurHoraires(h('2026-11-02T08:00:00'), h('2026-11-02T10:30:00'), maintenant)).toBeUndefined();
    });

    it('exige un début', () => {
        expect(erreurHoraires(null, h('2026-11-02T10:00:00'), maintenant)).toBe("L'heure de début est requise");
    });

    it('refuse les horaires dans le futur', () => {
        expect(erreurHoraires(h('2026-11-02T19:00:00'), null, maintenant)).toBe('Les horaires ne peuvent pas être dans le futur');
        expect(erreurHoraires(h('2026-11-02T08:00:00'), h('2026-11-03T10:00:00'), maintenant))
            .toBe('Les horaires ne peuvent pas être dans le futur');
    });

    it('refuse une fin qui ne suit pas le début', () => {
        expect(erreurHoraires(h('2026-11-02T10:00:00'), h('2026-11-02T10:00:00'), maintenant))
            .toBe("L'heure de fin doit être postérieure à l'heure de début");
        expect(erreurHoraires(h('2026-11-02T10:00:00'), h('2026-11-02T09:00:00'), maintenant))
            .toBe("L'heure de fin doit être postérieure à l'heure de début");
    });

    it('refuse un écart de plus de 7 jours', () => {
        expect(erreurHoraires(h('2026-10-20T08:00:00'), h('2026-11-02T08:00:00'), maintenant))
            .toBe("L'écart entre le début et la fin ne peut pas dépasser 7 jours");
    });
});

describe('peutCorrigerHoraires', () => {
    it("se propose sur une tâche démarrée tant que la vente n'est pas payée", () => {
        expect(peutCorrigerHoraires({ itemStatus: 'EN_COURS', venteType: 'FACTURE_EN_ATTENTE' })).toBe(true);
        expect(peutCorrigerHoraires({ itemStatus: 'TERMINEE', venteType: 'FACTURE_PRETE' })).toBe(true);
        expect(peutCorrigerHoraires({ itemStatus: 'TERMINEE', venteType: 'FACTURE_PAYEE' })).toBe(false);
        expect(peutCorrigerHoraires({ itemStatus: 'PLANIFIEE' })).toBe(false);
    });
});

describe('libelleCorrection', () => {
    it("n'affiche rien sans correction", () => {
        expect(libelleCorrection({ dateDebut: '2026-11-02 08:00:00.0' })).toBeUndefined();
    });

    it("rappelle la date de correction et les horaires d'origine", () => {
        expect(libelleCorrection({
            dateCorrectionHoraires: '2026-11-02 18:00:00.0',
            dateDebutOriginale: '2026-11-02 14:00:00.0',
            dateFinOriginale: '2026-11-02 17:30:00.0',
        })).toBe("Horaires corrigés le 02/11/2026 18:00 (d'origine : 02/11/2026 14:00 → 02/11/2026 17:30)");
    });

    it("indique « - » pour un horaire d'origine absent (tâche jamais démarrée)", () => {
        expect(libelleCorrection({ dateCorrectionHoraires: '2026-11-02 18:00:00.0', dateFinOriginale: '2026-11-02 17:30:00.0' }))
            .toBe("Horaires corrigés le 02/11/2026 18:00 (d'origine : - → 02/11/2026 17:30)");
    });
});
