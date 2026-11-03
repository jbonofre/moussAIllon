const arrondir = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const TVA_VENTE_DEFAUT = 20;

// Mention légale portée sur les devis et factures d'un client exonéré de TVA
export const MENTION_EXONERATION_TVA = 'Exonération de TVA, article 262 II du Code général des impôts';

export const TOOLTIP_EXONERATION_TVA = 'Client professionnel de la mer : exonéré de TVA, ses lignes sont au prix HT';

/** Un professionnel de la mer est exonéré de TVA : ses ventes sont au taux de 0 %, au prix HT des articles. */
export const clientExonereTva = (client?: { type?: string } | null) => client?.type === 'PROFESSIONNEL_MER';

/**
 * Prix unitaire d'un article sur une vente : son prix TTC, ou son prix HT pour un client exonéré de TVA
 * (déduit du TTC et du taux de l'article s'il n'est pas renseigné).
 */
export const prixUnitaireVente = (prixTTC: number | undefined, prixHT: number | undefined, tva: number | undefined, exonere: boolean) => {
    if (!exonere) return prixTTC || 0;
    return prixHT || arrondir((prixTTC || 0) / (1 + (tva || 0) / 100));
};

// Article du catalogue (produit, bateau, moteur, hélice, remorque) ou ligne libre
export const prixArticleVente = (article: { prixVenteTTC?: number; prixVenteHT?: number; tva?: number } | undefined, exonere: boolean) =>
    prixUnitaireVente(article?.prixVenteTTC, article?.prixVenteHT, article?.tva, exonere);

// Forfait ou service
export const prixPrestationVente = (prestation: { prixTTC?: number; prixHT?: number; tva?: number } | undefined, exonere: boolean) =>
    prixUnitaireVente(prestation?.prixTTC, prestation?.prixHT, prestation?.tva, exonere);

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
