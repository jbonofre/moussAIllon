// Les quantités sont des nombres à virgule : 5,5 L d'huile pour un moteur, 0,5 L pour une embase (issue #761).

// Quantité d'une ligne, 1 quand elle n'est pas renseignée (une quantité inférieure à 1 est conservée)
export const quantiteLigne = (quantite?: number | null): number => (quantite && quantite > 0 ? quantite : 1);
