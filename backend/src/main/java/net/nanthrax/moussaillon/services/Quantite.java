package net.nanthrax.moussaillon.services;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Les quantités des lignes (ventes, forfaits, prestations, packages, avoirs, commandes fournisseur)
 * sont des nombres à virgule : un moteur contient 5,5 L d'huile, une embase 0,5 L (issue #761).
 */
final class Quantite {

    private Quantite() {
    }

    /** Quantité d'une ligne, 1 quand elle n'est pas renseignée (une quantité inférieure à 1, ex. 0,5 L, est conservée). */
    static double ouUn(double quantite) {
        return quantite > 0 ? quantite : 1;
    }

    /**
     * Nombre d'unités d'une ligne d'articles suivis à l'unité (bateaux, moteurs, hélices, remorques du catalogue),
     * arrondi à l'unité supérieure.
     */
    static long unites(double quantite) {
        return (long) Math.ceil(ouUn(quantite));
    }

    /** Quantité affichée sur les documents et emails, avec un point comme les prix : « 5 », « 5.5 », « 2.25 ». */
    static String format(double quantite) {
        return BigDecimal.valueOf(quantite).setScale(3, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
    }

}
