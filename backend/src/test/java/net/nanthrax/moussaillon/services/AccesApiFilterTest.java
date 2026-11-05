package net.nanthrax.moussaillon.services;

import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

public class AccesApiFilterTest {

    private static final Set<String> VENDEUR = Set.of("chantier", "VENTE");
    private static final Set<String> ADMIN = Set.of("chantier", "VENTE", "PARAMETRAGE");
    private static final Set<String> COMPTABLE = Set.of("chantier", "COMPTABILITE");

    private static String refus(Set<String> groupes, String methode, String chemin) {
        return AccesApiFilter.motifRefus(groupes, "marie", methode, chemin, () -> null);
    }

    private static String refusImpaye(Set<String> groupes, String methode, String chemin) {
        return AccesApiFilter.motifRefus(groupes, "marie", methode, chemin, () -> "l'abonnement est impayé depuis 2 mois ou plus");
    }

    @Test
    void testPortailClientLimiteASesPointsDApi() {
        Set<String> client = Set.of("client");
        assertNull(refus(client, "GET", "/portal/clients/100/ventes"));
        assertNull(refus(client, "POST", "/annonces"));
        assertNull(refus(client, "POST", "/ventes/12/payment-link/stripe"));
        assertNotNull(refus(client, "GET", "/ventes/12"));
        assertNotNull(refus(client, "GET", "/users"));
        assertNotNull(refus(client, "PUT", "/societe/modules"));
    }

    @Test
    void testPortailTechnicienLimiteASesPointsDApi() {
        Set<String> technicien = Set.of("technicien");
        assertNull(refus(technicien, "PUT", "/technicien-portal/services/3"));
        assertNull(refus(technicien, "GET", "/documents/plan.pdf"));
        assertNotNull(refus(technicien, "GET", "/clients"));
        assertNotNull(refus(technicien, "GET", "/technicien-portalx"));
    }

    @Test
    void testDonneesMetierOuvertesATousLesUtilisateursDuChantier() {
        assertNull(refus(VENDEUR, "POST", "/catalogue/produits"));
        assertNull(refus(VENDEUR, "GET", "/techniciens"));
        assertNull(refus(VENDEUR, "GET", "/societe"));
        assertNull(refus(VENDEUR, "GET", "/reference-valeurs"));
        assertNotNull(refus(Set.of("inconnu"), "GET", "/ventes"));
    }

    @Test
    void testUtilisateursGeresParLeParametrage() {
        assertNull(refus(VENDEUR, "GET", "/users/marie"));
        assertNull(refus(VENDEUR, "PUT", "/users/marie"));
        assertNull(refus(VENDEUR, "POST", "/users/marie/change-password"));
        assertNotNull(refus(VENDEUR, "DELETE", "/users/marie"));
        assertNotNull(refus(VENDEUR, "GET", "/users"));
        assertNotNull(refus(VENDEUR, "PUT", "/users/admin"));
        assertNull(refus(ADMIN, "PUT", "/users/admin"));
        assertNull(refus(Set.of("client"), "POST", "/users/authenticate"));
    }

    @Test
    void testFonctionsReserveesAuxModules() {
        assertNotNull(refus(VENDEUR, "PUT", "/societe/modules"));
        assertNotNull(refus(VENDEUR, "POST", "/societe/paiement"));
        assertNotNull(refus(VENDEUR, "POST", "/reference-valeurs"));
        assertNull(refus(ADMIN, "PUT", "/societe/modules"));
        assertNotNull(refus(VENDEUR, "GET", "/reglements"));
        assertNull(refus(COMPTABLE, "GET", "/reglements"));
        assertNotNull(refus(VENDEUR, "GET", "/kpis-financiers"));
        assertNull(refus(COMPTABLE, "GET", "/kpis-financiers"));
        assertNull(refus(COMPTABLE, "POST", "/connecteurs/1/synchronisation"));
        assertNull(refus(ADMIN, "GET", "/connecteurs"));
        assertNotNull(refus(VENDEUR, "GET", "/connecteurs"));
        assertNotNull(refus(VENDEUR, "GET", "/campagnes"));
        assertNull(refus(Set.of("chantier", "MARKETING"), "POST", "/email-sequences"));
        assertNotNull(refus(VENDEUR, "GET", "/kpis-commerciaux"));
        assertNotNull(refus(COMPTABLE, "GET", "/kpis-commerciaux"));
        assertNull(refus(Set.of("chantier", "MARKETING"), "GET", "/kpis-commerciaux"));
        assertNull(refus(ADMIN, "GET", "/plateformes-annonces"));
        assertNotNull(refus(VENDEUR, "GET", "/plateformes-annonces"));
    }

    @Test
    void testImpayeLimiteALaFacturation() {
        assertNull(refusImpaye(ADMIN, "GET", "/societe"));
        assertNull(refusImpaye(ADMIN, "POST", "/societe/paiement"));
        assertNull(refusImpaye(ADMIN, "GET", "/users/marie"));
        assertNotNull(refusImpaye(ADMIN, "GET", "/ventes"));
        assertNull(refusImpaye(VENDEUR, "GET", "/societe"));
        assertNotNull(refusImpaye(VENDEUR, "POST", "/societe/paiement"));
        assertNotNull(refusImpaye(VENDEUR, "GET", "/clients"));
    }

    @Test
    void testAbonnementNonActiveLimiteALaFacturation() {
        String limitation = "l'abonnement n'est pas activé";
        assertNull(AccesApiFilter.motifRefus(ADMIN, "marie", "POST", "/societe/paiement", () -> limitation));
        assertEquals("Accès limité à la facturation : l'abonnement n'est pas activé.",
            AccesApiFilter.motifRefus(ADMIN, "marie", "GET", "/ventes", () -> limitation));
    }
}
