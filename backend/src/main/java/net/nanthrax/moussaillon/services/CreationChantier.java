package net.nanthrax.moussaillon.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.ChantierEntity;
import net.nanthrax.moussaillon.persistence.ModuleApplication;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import org.jboss.logging.Logger;

import java.sql.Timestamp;
import java.util.Set;

/**
 * Création d'un chantier et de ses données (société, premier utilisateur, référentiels par défaut), par
 * l'administrateur de l'instance ou par une inscription depuis l'espace chantier.
 */
@ApplicationScoped
public class CreationChantier {

    private static final Logger LOG = Logger.getLogger(CreationChantier.class);

    @Inject
    Chantiers chantiers;

    @Inject
    DataInitializer dataInitializer;

    public static class Demande {
        public String code;
        public String nom;
        public String email;
        // Premier utilisateur du chantier, qui a accès à tous les modules.
        public String utilisateur;
        public String motDePasse;
        public boolean gratuit;
        // Modules souscrits ; tous si vide.
        public Set<ModuleApplication> modules;
    }

    /**
     * Crée le chantier demandé, avec une période d'essai gratuite jusqu'à essaiFin (aucune si null). Renvoie son
     * code ; refuse une demande incomplète ou un code invalide ou déjà pris (400, raison en texte).
     */
    public String creer(Demande demande, Timestamp essaiFin) {
        if (demande == null) {
            throw requeteInvalide("Les informations du chantier sont requises.");
        }
        String code = codeSaisi(demande.code);
        if (demande.nom == null || demande.nom.isBlank()) {
            throw requeteInvalide("Le nom du chantier est requis.");
        }
        if (demande.email == null || demande.email.isBlank()) {
            throw requeteInvalide("L'email du chantier est requis.");
        }
        if (demande.motDePasse == null || demande.motDePasse.isBlank()) {
            throw requeteInvalide("Le mot de passe du premier utilisateur est requis.");
        }
        String utilisateur = demande.utilisateur == null || demande.utilisateur.isBlank() ? UserResource.ADMIN : demande.utilisateur.trim();
        if (chantiers.trouver(code) != null) {
            throw requeteInvalide("Le chantier " + code + " existe déjà.");
        }
        chantiers.dans(code, () -> {
            ChantierEntity chantier = new ChantierEntity();
            chantier.code = code;
            chantier.nom = demande.nom.trim();
            chantier.email = demande.email.trim();
            chantier.gratuit = demande.gratuit;
            chantier.essaiFin = essaiFin;
            chantier.dateCreation = SocieteResource.horodatage();
            chantier.persist();
            dataInitializer.initialiserChantier(chantier.nom, chantier.email, utilisateur, demande.motDePasse, chantier.email);
            if (demande.modules != null && !demande.modules.isEmpty()) {
                SocieteResource.appliquerModules(SocieteEntity.courante(), demande.modules);
            }
        });
        LOG.infof("Chantier %s créé (%s)", code, demande.nom);
        return code;
    }

    /** Code chantier saisi, normalisé ; refusé s'il n'a pas le format des codes. */
    static String codeSaisi(String saisi) {
        String code = ChantierEntity.normaliser(saisi);
        if (!ChantierEntity.codeValide(code)) {
            throw requeteInvalide("Code chantier invalide : 2 à " + ChantierEntity.LONGUEUR_CODE
                + " caractères parmi les lettres minuscules, les chiffres et le tiret, en commençant par une lettre ou un chiffre.");
        }
        return code;
    }

    static WebApplicationException requeteInvalide(String message) {
        return new WebApplicationException(Response.status(Response.Status.BAD_REQUEST)
            .entity(message).type(MediaType.TEXT_PLAIN + ";charset=UTF-8").build());
    }

}
