import { debutDepot, minutesAuPointeur } from './planning-creneau.ts';

const h = (heures: number, minutes = 0) => heures * 60 + minutes;

describe('minutesAuPointeur', () => {
    const ligne = { left: 100, width: 1200 }; // 7h-19h : 100 px par heure

    it("donne l'heure sous le pointeur, sans arrondi", () => {
        expect(minutesAuPointeur(100, ligne)).toBe(h(7));
        expect(minutesAuPointeur(375, ligne)).toBe(h(9, 45));
    });

    it('tombe au début de la journée sans mise en page', () => {
        expect(minutesAuPointeur(500, { left: 0, width: 0 })).toBe(h(7));
    });
});

describe('debutDepot', () => {
    it('arrondit à la demi-heure sans tâche voisine', () => {
        expect(debutDepot(h(10, 10), 60)).toBe(h(10));
        expect(debutDepot(h(10, 20), 60)).toBe(h(10, 30));
    });

    it("colle la tâche à la fin d'une voisine terminant à un quart d'heure", () => {
        // Voisine de 8h30 à 10h45 (2h15) : sans aimantation, 10h30 chevauche et 11h laisse un trou
        const voisines = [{ debut: h(8, 30), fin: h(10, 45) }];
        expect(debutDepot(h(10, 50), 120, voisines)).toBe(h(10, 45));
        expect(debutDepot(h(10, 35), 120, voisines)).toBe(h(10, 45));
    });

    it("colle la fin de la tâche au début d'une voisine", () => {
        // Tâche de 1h15 posée juste avant une voisine commençant à 14h
        expect(debutDepot(h(12, 40), 75, [{ debut: h(14), fin: h(16) }])).toBe(h(12, 45));
    });

    it('retient la voisine la plus proche', () => {
        const voisines = [{ debut: h(8), fin: h(10, 45) }, { debut: h(12), fin: h(13) }];
        // Fin à 10h45 (à 10 min) ou fin collée à 12h (début 11h, à 5 min)
        expect(debutDepot(h(10, 55), 60, voisines)).toBe(h(11));
    });

    it("ignore les voisines au-delà d'un quart d'heure", () => {
        expect(debutDepot(h(11, 10), 60, [{ debut: h(8, 30), fin: h(10, 45) }])).toBe(h(11));
    });

    it('reste dans la plage affichée', () => {
        expect(debutDepot(h(6), 60)).toBe(h(7));
        expect(debutDepot(h(19), 60)).toBe(h(18, 30));
    });

    it("arrondit à la minute la fin d'une voisine à durée décimale", () => {
        // 1,33 h = 79,8 min
        expect(debutDepot(h(9, 20), 60, [{ debut: h(8), fin: h(8) + 79.8 }])).toBe(h(9, 20));
    });
});
