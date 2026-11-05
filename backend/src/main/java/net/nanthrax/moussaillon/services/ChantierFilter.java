package net.nanthrax.moussaillon.services;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import net.nanthrax.moussaillon.persistence.ChantierEntity;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.util.Optional;

/**
 * Détermine le chantier de chaque requête, avant tout accès aux données (et avant {@link AccesApiFilter}) :
 * <ul>
 *   <li>requête authentifiée : le chantier du jeton. Un chantier supprimé ou dont l'accès est suspendu refuse
 *   le jeton (401), ce qui déconnecte aussitôt ses utilisateurs ;</li>
 *   <li>administrateur de l'instance : aucun chantier (l'administration désigne chacun explicitement) ;</li>
 *   <li>requête anonyme (connexion) : le code chantier de l'en-tête X-Chantier ou du paramètre chantier.</li>
 * </ul>
 */
@Provider
@Priority(Priorities.AUTHENTICATION)
public class ChantierFilter implements ContainerRequestFilter {

    public static final String ENTETE = "X-Chantier";
    public static final String PARAMETRE = "chantier";
    public static final String CLAIM = "chantier";

    @Inject
    SecurityIdentity identity;

    @Inject
    JsonWebToken jwt;

    @Inject
    ChantierContexte contexte;

    @Inject
    Chantiers chantiers;

    @ConfigProperty(name = "admin.email")
    Optional<String> adminEmail;

    @Override
    public void filter(ContainerRequestContext requete) {
        if (identity.isAnonymous()) {
            filtrerAnonyme(requete);
            return;
        }
        if (identity.getRoles().contains(AccesApiFilter.GROUPE_ADMIN)) {
            // L'administration lit et modifie chaque chantier explicitement (Chantiers.dans).
            contexte.definir(ChantierContexte.AUCUN);
            return;
        }
        Object claim = jwt.getClaim(CLAIM);
        String code = claim == null ? null : claim.toString();
        if (code == null || code.isBlank()) {
            // Jeton émis avant le passage multi-chantier : une nouvelle connexion est nécessaire.
            refuser(requete, Response.Status.UNAUTHORIZED, "Session expirée : reconnectez-vous.");
            return;
        }
        ChantierEntity chantier = chantiers.trouver(code);
        if (chantier == null) {
            refuser(requete, Response.Status.UNAUTHORIZED, "Le chantier n'existe plus.");
            return;
        }
        if (chantier.accesSuspendu) {
            refuser(requete, Response.Status.UNAUTHORIZED, messageSuspendu());
            return;
        }
        contexte.definir(chantier.code);
    }

    private void filtrerAnonyme(ContainerRequestContext requete) {
        String code = requete.getHeaderString(ENTETE);
        if (code == null || code.isBlank()) {
            code = requete.getUriInfo().getQueryParameters().getFirst(PARAMETRE);
        }
        code = ChantierEntity.normaliser(code);
        if (code == null || code.isEmpty()) {
            return;
        }
        ChantierEntity chantier = chantiers.trouver(code);
        if (chantier == null) {
            refuser(requete, Response.Status.UNAUTHORIZED, "Code chantier inconnu : " + code + ".");
            return;
        }
        if (chantier.accesSuspendu) {
            refuser(requete, Response.Status.FORBIDDEN, messageSuspendu());
            return;
        }
        contexte.definir(chantier.code);
    }

    private String messageSuspendu() {
        String contact = adminEmail.filter(email -> !email.isBlank()).map(email -> " (" + email + ")").orElse("");
        return "Accès bloqué : l'accès à ce chantier est suspendu. Contactez l'éditeur de moussAIllon" + contact + ".";
    }

    private static void refuser(ContainerRequestContext requete, Response.Status statut, String message) {
        requete.abortWith(Response.status(statut).entity(message).type(MediaType.TEXT_PLAIN + ";charset=UTF-8").build());
    }

}
