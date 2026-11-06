// Remise de la fiche client (#755) : un pourcentage du montant TTC de ses ventes

const arrondir = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Taux de remise (en %) de la fiche client, 0 s'il n'en a pas. */
export const tauxRemiseClient = (client?: { remise?: number | string } | null): number => {
    const taux = Number(client?.remise) || 0;
    return Math.min(Math.max(taux, 0), 100);
};

/**
 * Une vente enregistrée porte la remise de son client si sa remise vaut le taux du client appliqué
 * à son montant TTC, au centime près (les arrondis peuvent différer d'un centime).
 */
export const remiseClientEnVigueur = (client: { remise?: number | string } | null | undefined, remise?: number, montantTTC?: number): boolean => {
    const taux = tauxRemiseClient(client);
    return taux > 0 && Math.abs(Math.round((remise || 0) * 100) - Math.round((montantTTC || 0) * taux)) <= 1;
};

/**
 * Remise d'une vente quand son montant TTC change : la remise du client garde son pourcentage,
 * une remise saisie à la main garde son montant.
 */
export const remiseSurMontant = (montantTTC: number, remise: number, remisePourcentage: number, garderPourcentage: boolean) => {
    const remiseCalculee = garderPourcentage ? arrondir((montantTTC * remisePourcentage) / 100) : remise;
    const pourcentage = garderPourcentage
        ? remisePourcentage
        : montantTTC > 0 ? arrondir((remise / montantTTC) * 100) : 0;
    return { remise: remiseCalculee, remisePourcentage: pourcentage, prixVenteTTC: arrondir(montantTTC - remiseCalculee) };
};
