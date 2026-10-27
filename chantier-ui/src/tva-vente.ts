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
