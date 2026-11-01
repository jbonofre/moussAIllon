// Plage horaire affichée par le calendrier
export const HOUR_START = 7;
export const HOUR_END = 19;
export const TOTAL_HOURS = HOUR_END - HOUR_START;

// Pas du dépôt sur le calendrier, en minutes
export const PAS_DEPOT = 30;
// Distance (en minutes) en deçà de laquelle une tâche déposée se colle à une tâche voisine
export const AIMANTATION = 15;

// Créneau d'une tâche, en minutes depuis minuit
export interface Plage {
    debut: number;
    fin: number;
}

// Heure (en minutes depuis minuit, non arrondie) sous le pointeur, sur la ligne d'un jour.
export const minutesAuPointeur = (clientX: number, rect: Pick<DOMRect, 'left' | 'width'>) => {
    const fraction = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    return (HOUR_START + fraction * TOTAL_HOURS) * 60;
};

// Heure de début (en minutes depuis minuit) d'une tâche de `duree` minutes déposée
// avec un début visé à `debutVise`. Si le début visé est proche de la fin d'une
// tâche voisine, la tâche s'y colle ; de même si sa fin est proche du début d'une
// voisine. Sinon, le début est arrondi au pas du dépôt.
export const debutDepot = (debutVise: number, duree: number, voisines: Plage[] = []) => {
    let debut = Math.round(debutVise / PAS_DEPOT) * PAS_DEPOT;
    let ecartRetenu = Infinity;
    voisines
        .flatMap((voisine) => [voisine.fin, voisine.debut - duree])
        .forEach((candidat) => {
            const ecart = Math.abs(candidat - debutVise);
            if (ecart <= AIMANTATION && ecart < ecartRetenu) {
                ecartRetenu = ecart;
                debut = candidat;
            }
        });
    return Math.min(Math.max(Math.round(debut), HOUR_START * 60), HOUR_END * 60 - PAS_DEPOT);
};
