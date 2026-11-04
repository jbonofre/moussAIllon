package net.nanthrax.moussaillon.persistence;

/**
 * Groupe de fonctionnalités de l'espace chantier. La société souscrit des modules (facturés
 * chaque mois), puis chaque utilisateur se voit attribuer l'accès à certains d'entre eux.
 */
public enum ModuleApplication {

    VENTE(35.0),
    PARC(20.0),
    CATALOGUE(25.0),
    ATELIER(20.0),
    MARKETING(20.0),
    COMPTABILITE(20.0),
    // Toujours souscrit (gestion de la société, de la facturation et des utilisateurs) et inclus.
    PARAMETRAGE(0.0);

    // Prix mensuel par défaut, surchargeable par la propriété abonnement.prix-module.<module>.
    public final double prixMensuelParDefaut;

    ModuleApplication(double prixMensuelParDefaut) {
        this.prixMensuelParDefaut = prixMensuelParDefaut;
    }

}
