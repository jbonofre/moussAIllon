const arrondir = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * TVA d'une vente : le taux de la vente s'applique au montant TTC, sauf aux articles d'occasion,
 * vendus sans TVA (montantOccasionTTC : leur montant TTC, remises de ligne déduites).
 */
export const calculerTvaVente = (montantTTC: number, montantOccasionTTC: number, tva: number) => {
    const baseTaxableTTC = Math.max(0, montantTTC - montantOccasionTTC);
    const montantTVA = arrondir((baseTaxableTTC / (100 + tva)) * tva);
    return { montantTVA, montantHT: arrondir(montantTTC - montantTVA) };
};

/**
 * TVA d'une vente dont le montant HT est fixé (HT ou taux de TVA modifié à la main) : le TTC en découle.
 * Les articles d'occasion (montantOccasion, sans TVA : leur HT est leur TTC) restent hors base taxable.
 */
export const calculerTvaVenteDepuisHT = (montantHT: number, montantOccasion: number, tva: number) => {
    const baseTaxableHT = Math.max(0, montantHT - montantOccasion);
    const montantTVA = arrondir((baseTaxableHT * tva) / 100);
    return { montantTVA, montantTTC: arrondir(montantHT + montantTVA) };
};

/**
 * Taux de TVA d'une vente dont le montant de TVA est saisi à la main, au centième près.
 * Sans base taxable (vente vide ou entièrement d'occasion), aucun taux ne s'en déduit : undefined.
 */
export const tauxTvaVente = (montantHT: number, montantOccasion: number, montantTVA: number): number | undefined => {
    const baseTaxableHT = Math.max(0, montantHT - montantOccasion);
    return baseTaxableHT > 0 ? arrondir((montantTVA / baseTaxableHT) * 100) : undefined;
};
