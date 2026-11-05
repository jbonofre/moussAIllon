// Ligne libre d'un avoir généré depuis une facture : saisie sur l'avoir au lieu d'être reprise de la facture,
// par exemple une heure de main d'œuvre sans faire l'avoir sur la totalité d'un forfait (issue #756).
import { quantiteLigne } from './quantite.ts';

export interface AvoirLigneLibre {
    designation: string;
    quantite: number;
    prixUnitaireHT: number;
    tva: number;
}

export const TVA_OPTIONS_AVOIR = [
    { value: 0, label: '0%' },
    { value: 5.5, label: '5,5%' },
    { value: 10, label: '10%' },
    { value: 20, label: '20%' },
];

const arrondir = (value: number) => Math.round(value * 100) / 100;

export const nouvelleLigneLibreAvoir = (tva: number): AvoirLigneLibre => ({
    designation: '',
    quantite: 1,
    prixUnitaireHT: 0,
    tva,
});

// Même calcul que le backend : la TVA du total HT, arrondie au centime, s'y ajoute
export const totalTTCLigneLibreAvoir = (ligne: AvoirLigneLibre): number => {
    const totalHT = (ligne.prixUnitaireHT || 0) * quantiteLigne(ligne.quantite);
    return arrondir(totalHT + arrondir(totalHT * ((ligne.tva || 0) / 100)));
};

export const erreurLignesLibresAvoir = (lignes: AvoirLigneLibre[]): string | undefined =>
    lignes.some((ligne) => !ligne.designation.trim())
        ? 'Toutes les lignes libres doivent avoir une désignation'
        : undefined;
