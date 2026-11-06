package net.nanthrax.moussaillon.services;

import io.quarkus.arc.Arc;
import jakarta.enterprise.context.RequestScoped;
import org.eclipse.microprofile.config.ConfigProvider;

/**
 * Chantier dont la requête (ou la tâche en cours) lit et écrit les données. Renseigné par {@link ChantierFilter}
 * depuis le jeton de l'appelant (ou le code chantier d'une connexion), et par {@link Chantiers} pour les tâches
 * de fond. Hibernate l'obtient de {@link ChantierTenantResolver} à l'ouverture de chaque session.
 */
@RequestScoped
public class ChantierContexte {

    // Chantier sans aucune donnée : requête qui ne désigne pas de chantier (connexion sans code, administration).
    public static final String AUCUN = "_aucun";

    // Voit les données de tous les chantiers, sans en créer : migrations au démarrage, suppression d'un chantier,
    // recherche du chantier d'un flux d'annonces.
    public static final String RACINE = "_racine";

    private String code;

    /**
     * Chantier courant : celui renseigné, sinon le chantier par défaut (propriété chantier.par-defaut, pour une
     * instance qui n'héberge qu'un chantier et pour les tests), sinon {@link #AUCUN}.
     */
    public String code() {
        if (code != null) {
            return code;
        }
        return ConfigProvider.getConfig().getOptionalValue("chantier.par-defaut", String.class)
            .map(String::trim).filter(defaut -> !defaut.isEmpty())
            .orElse(AUCUN);
    }

    /** Chantier renseigné explicitement (null sinon), pour le rétablir après une tâche dans un autre chantier. */
    String brut() {
        return code;
    }

    public void definir(String code) {
        this.code = code;
    }

    /** La requête porte sur un chantier (ni aucun, ni tous). */
    public boolean defini() {
        String courant = code();
        return !AUCUN.equals(courant) && !RACINE.equals(courant);
    }

    /** Chantier courant hors injection (méthodes statiques) ; {@link #AUCUN} sans contexte de requête. */
    public static String courant() {
        if (!Arc.container().requestContext().isActive()) {
            return AUCUN;
        }
        return Arc.container().instance(ChantierContexte.class).get().code();
    }

}
