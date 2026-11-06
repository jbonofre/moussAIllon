package net.nanthrax.moussaillon.services;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import net.nanthrax.moussaillon.persistence.ModuleApplication;

import java.util.Set;
import java.util.function.Supplier;

/**
 * Contrôle d'accès à l'API selon le jeton de l'appelant :
 * <ul>
 *   <li>l'administrateur de l'instance n'accède qu'à l'administration (/admin), réservée à lui seul ;</li>
 *   <li>les portails client et technicien n'accèdent qu'à leurs propres points d'API ;</li>
 *   <li>dans le chantier, les fonctions sensibles sont réservées à leur module (utilisateurs, paramètres
 *   et abonnement, comptabilité, marketing, KPIs atelier). Les données métier que les pages croisent (ventes, clients,
 *   catalogue, parc, techniciens...) restent accessibles à tout utilisateur du chantier ;</li>
 *   <li>un abonnement non activé, ou impayé depuis 2 mois ou plus, limite l'accès à la facturation.</li>
 * </ul>
 * Les requêtes anonymes relèvent des permissions HTTP (points publics, connexion).
 */
@Provider
public class AccesApiFilter implements ContainerRequestFilter {

    // Groupe porté par le jeton des utilisateurs du chantier, en plus de leurs modules.
    static final String GROUPE_CHANTIER = "chantier";

    // Groupe porté par le jeton de l'administrateur de l'instance (application d'administration).
    static final String GROUPE_ADMIN = "admin-instance";

    private static final String PARAMETRAGE = ModuleApplication.PARAMETRAGE.name();
    private static final String COMPTABILITE = ModuleApplication.COMPTABILITE.name();
    private static final String MARKETING = ModuleApplication.MARKETING.name();
    private static final String ATELIER = ModuleApplication.ATELIER.name();

    @Inject
    SecurityIdentity identity;

    @Override
    public void filter(ContainerRequestContext requete) {
        if (identity.isAnonymous()) {
            return;
        }
        String chemin = requete.getUriInfo().getPath();
        if (!chemin.startsWith("/")) {
            chemin = "/" + chemin;
        }
        String refus = motifRefus(identity.getRoles(), identity.getPrincipal().getName(), requete.getMethod(), chemin,
            SocieteResource::motifLimitationFacturation);
        if (refus != null) {
            requete.abortWith(Response.status(Response.Status.FORBIDDEN).entity(refus).build());
        }
    }

    /**
     * Raison du refus de la requête, ou null si elle est autorisée. La limitation de l'accès à la facturation
     * donne son motif (abonnement non activé ou impayé), ou null s'il n'y en a pas.
     */
    static String motifRefus(Set<String> groupes, String utilisateur, String methode, String chemin,
                             Supplier<String> limitationFacturation) {
        if (sous(chemin, "/users/authenticate", "/admin/authenticate")) {
            return null;
        }
        if (groupes.contains(GROUPE_ADMIN)) {
            return sous(chemin, "/admin") ? null : "Accès réservé aux chantiers.";
        }
        if (sous(chemin, "/admin")) {
            return "Accès réservé à l'administration de l'instance.";
        }
        if (groupes.contains("client")) {
            boolean portail = sous(chemin, "/portal", "/annonces", "/images", "/documents")
                || chemin.matches("/ventes/[^/]+/payment-link(/.*)?");
            return portail ? null : "Accès réservé à l'espace chantier.";
        }
        if (groupes.contains("technicien")) {
            return sous(chemin, "/technicien-portal", "/images", "/documents") ? null : "Accès réservé à l'espace chantier.";
        }
        if (!groupes.contains(GROUPE_CHANTIER)) {
            return "Accès refusé.";
        }

        boolean lecture = "GET".equals(methode) || "HEAD".equals(methode);
        boolean parametrage = groupes.contains(PARAMETRAGE);
        String compte = "/users/" + utilisateur;

        String limitation = limitationFacturation.get();
        if (limitation != null) {
            boolean facturation = (lecture && (chemin.equals("/societe") || chemin.equals(compte)))
                || (parametrage && sous(chemin, "/societe"));
            return facturation ? null : "Accès limité à la facturation : " + limitation + ".";
        }

        // Chacun consulte son compte, change son mot de passe et son thème ; le reste relève du Paramétrage.
        if (sous(chemin, "/users")) {
            boolean sonCompte = (chemin.equals(compte) && !"DELETE".equals(methode)) || chemin.equals(compte + "/change-password");
            return parametrage || sonCompte ? null : "Accès réservé au module Paramétrage.";
        }
        // Société, abonnement et paramètres : consultés par toutes les pages (impressions...), modifiés par le Paramétrage.
        if (!lecture && sous(chemin, "/societe", "/email-templates", "/reference-valeurs")) {
            return parametrage ? null : "Accès réservé au module Paramétrage.";
        }
        if (sous(chemin, "/connecteurs")) {
            return parametrage || groupes.contains(COMPTABILITE) ? null : "Accès réservé aux modules Paramétrage et Comptabilité.";
        }
        if (sous(chemin, "/reglements", "/kpis-financiers", "/export-comptable")) {
            return groupes.contains(COMPTABILITE) ? null : "Accès réservé au module Comptabilité.";
        }
        if (sous(chemin, "/campagnes", "/email-sequences", "/kpis-commerciaux")) {
            return groupes.contains(MARKETING) ? null : "Accès réservé au module Marketing.";
        }
        if (sous(chemin, "/kpis-atelier")) {
            return groupes.contains(ATELIER) ? null : "Accès réservé au module Atelier.";
        }
        if (sous(chemin, "/plateformes-annonces")) {
            return parametrage || groupes.contains(MARKETING) ? null : "Accès réservé aux modules Marketing et Paramétrage.";
        }
        return null;
    }

    private static boolean sous(String chemin, String... prefixes) {
        for (String prefixe : prefixes) {
            if (chemin.equals(prefixe) || chemin.startsWith(prefixe + "/")) {
                return true;
            }
        }
        return false;
    }

}
