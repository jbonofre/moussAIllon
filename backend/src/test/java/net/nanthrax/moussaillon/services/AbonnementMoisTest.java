package net.nanthrax.moussaillon.services;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.path.json.JsonPath;
import net.nanthrax.moussaillon.persistence.ModuleApplication;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import net.nanthrax.moussaillon.persistence.UserEntity;
import org.junit.jupiter.api.Test;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
public class AbonnementMoisTest {

    private static final String TOUS_LES_MODULES =
        "[\"VENTE\",\"PARC\",\"CATALOGUE\",\"ATELIER\",\"MARKETING\",\"COMPTABILITE\",\"PARAMETRAGE\"]";

    private static final String SANS_MARKETING =
        "[\"VENTE\",\"PARC\",\"CATALOGUE\",\"ATELIER\",\"COMPTABILITE\",\"PARAMETRAGE\"]";

    private static JsonPath societe() {
        return given().when().get("/societe").then().statusCode(200).extract().jsonPath();
    }

    private static JsonPath payer(String type, String modules) {
        return given()
            .contentType("application/json")
            .body("{\"type\":\"" + type + "\",\"mode\":\"VIREMENT\",\"signature\":\"signature\""
                + (modules != null ? ",\"modules\":" + modules : "") + "}")
            .when().post("/societe/paiement")
            .then()
            .statusCode(200)
            .extract().jsonPath();
    }

    /** Tous les modules souscrits, pour la société et l'admin, quel que soit le déroulé du test. */
    private static void restaurerModules() {
        QuarkusTransaction.requiringNew().run(() -> {
            SocieteEntity.<SocieteEntity>findById(1L).modules.addAll(EnumSet.allOf(ModuleApplication.class));
            UserEntity.<UserEntity>findById("admin").modules.addAll(EnumSet.allOf(ModuleApplication.class));
        });
    }

    /** Mois payés par le dernier paiement, du plus récent au plus ancien. */
    private static List<Map<String, Object>> moisDuPaiement(JsonPath societe) {
        String date = societe.getString("paiements[0].date");
        List<Map<String, Object>> mois = societe.getList("abonnementMois");
        return mois.stream().filter(m -> date.equals(m.get("payeLe"))).toList();
    }

    /** Mois payés non terminés qui ne comprennent pas le module. */
    private static long moisPayesSans(JsonPath societe, String module) {
        List<Map<String, Object>> mois = societe.getList("abonnementMois");
        LocalDateTime maintenant = LocalDateTime.now();
        return mois.stream()
            .filter(m -> "PAYE".equals(m.get("statut")))
            .filter(m -> LocalDateTime.parse((String) m.get("fin")).isAfter(maintenant))
            .filter(m -> !((List<?>) m.get("modules")).contains(module))
            .count();
    }

    @Test
    void testActivationAuPremierPaiement() {
        Timestamp[] origine = AbonnementBlocageTest.activation();
        try {
            AbonnementBlocageTest.activation(new Timestamp[] { null, null });
            JsonPath avant = societe();
            double mensuel = avant.getDouble("abonnementProchainPaiementMontant");

            // Avant l'activation, les modules s'ajoutent librement : ils sont payés avec l'activation
            given().contentType("application/json").body(SANS_MARKETING).when().put("/societe/modules").then().statusCode(200);
            given().contentType("application/json").body(TOUS_LES_MODULES).when().put("/societe/modules").then().statusCode(200);

            // Le premier paiement comprend les frais d'activation et démarre l'abonnement
            JsonPath active = payer("MENSUEL", null);
            assertEquals(arrondi(mensuel + 350.0), active.getDouble("paiements[0].montant"), 0.001);
            assertEquals(350.0, active.getDouble("paiements[0].montantActivation"), 0.001);
            assertTrue(active.getBoolean("abonnementActif"));
            assertTrue(active.getBoolean("abonnementAJour"));
            assertFalse(active.getBoolean("accesLimiteFacturation"));
            assertEquals(active.getString("abonnementActivationDate"), active.getString("paiements[0].periodeDebut"));
            assertEquals(active.getString("abonnementProchainPaiementDate"), active.getString("paiements[0].periodeFin"));
            List<Map<String, Object>> moisActivation = moisDuPaiement(active);
            assertEquals(1, moisActivation.size());
            assertEquals("PAYE", moisActivation.get(0).get("statut"));
            assertEquals("MENSUEL", moisActivation.get(0).get("typePaiement"));
            assertEquals(active.getString("abonnementActivationDate"), moisActivation.get(0).get("debut"));
            assertEquals(mensuel, ((Number) moisActivation.get(0).get("montant")).doubleValue(), 0.001);

            // Les paiements suivants ne les comprennent plus
            JsonPath suivant = payer("MENSUEL", null);
            assertEquals(mensuel, suivant.getDouble("paiements[0].montant"), 0.001);
            assertNull(suivant.get("paiements[0].montantActivation"));
            assertEquals(active.getString("abonnementProchainPaiementDate"), moisDuPaiement(suivant).get(0).get("debut"));
        } finally {
            AbonnementBlocageTest.activation(origine);
            restaurerModules();
        }
    }

    @Test
    void testPaiementAnnuelSuiviMoisParMois() {
        JsonPath avant = societe();
        int moisAvant = avant.getList("abonnementMois").size();
        double annuel = avant.getDouble("abonnementMontantAnnuel");

        JsonPath apres = payer("ANNUEL", null);
        assertEquals(moisAvant + 12, apres.getList("abonnementMois").size());
        assertEquals(avant.getString("abonnementProchainPaiementDate"), apres.getString("paiements[0].periodeDebut"));
        assertEquals(apres.getString("abonnementProchainPaiementDate"), apres.getString("paiements[0].periodeFin"));
        List<Map<String, Object>> mois = moisDuPaiement(apres);
        assertEquals(12, mois.size());
        assertEquals(apres.getString("paiements[0].periodeDebut"), mois.get(11).get("debut"));
        assertEquals(apres.getString("paiements[0].periodeFin"), mois.get(0).get("fin"));
        double total = 0;
        for (Map<String, Object> m : mois) {
            assertEquals("ANNUEL", m.get("typePaiement"));
            total += ((Number) m.get("montant")).doubleValue();
        }
        // Les parts mensuelles font le montant annuel, à l'arrondi près
        assertEquals(annuel, arrondi(total), 0.001);
        assertEquals(avant.getInt("abonnementMoisPayesRestants") + 12, apres.getInt("abonnementMoisPayesRestants"));
    }

    @Test
    void testMoisAPayer() {
        Timestamp origine = AbonnementBlocageTest.echeance();
        try {
            AbonnementBlocageTest.echeance(AbonnementBlocageTest.ilYa(1, 5));

            JsonPath societe = societe();
            assertFalse(societe.getBoolean("abonnementAJour"));
            // Le mois en cours est à payer, le précédent est impayé, au prix en vigueur
            assertEquals("A_PAYER", societe.getString("abonnementMois[0].statut"));
            assertEquals("IMPAYE", societe.getString("abonnementMois[1].statut"));
            assertEquals(societe.getDouble("abonnementProchainPaiementMontant"), societe.getDouble("abonnementMois[0].montant"), 0.001);
            assertEquals("PAYE", societe.getString("abonnementMois[2].statut"));
        } finally {
            AbonnementBlocageTest.echeance(origine);
        }
    }

    @Test
    void testModuleAjoutePayeToutDeSuite() {
        try {
            // Retirer un module ne demande aucun paiement
            given().contentType("application/json").body(SANS_MARKETING).when().put("/societe/modules").then().statusCode(200);
            // Un mois payé sans le module Marketing
            payer("MENSUEL", null);
            JsonPath avant = societe();
            long mois = moisPayesSans(avant, "MARKETING");
            assertTrue(mois >= 1);

            // Le module ajouté doit être payé
            given()
                .contentType("application/json")
                .body(TOUS_LES_MODULES)
                .when().put("/societe/modules")
                .then()
                .statusCode(400)
                .body(containsString("payés tout de suite"));

            // 20 € par mois payé qui ne le comprend pas, mois en cours compris
            JsonPath apres = payer("MODULES", TOUS_LES_MODULES);
            assertEquals("MODULES", apres.getString("paiements[0].type"));
            assertEquals(arrondi(20.0 * mois), apres.getDouble("paiements[0].montant"), 0.001);
            assertEquals(List.of("MARKETING"), apres.getList("paiements[0].modules"));
            assertTrue(apres.getList("modules").contains("MARKETING"));
            assertEquals(0, moisPayesSans(apres, "MARKETING"));

            // Plus rien à payer : le module est déjà payé pour les mois en cours
            given()
                .contentType("application/json")
                .body("{\"type\":\"MODULES\",\"mode\":\"VIREMENT\",\"signature\":\"signature\",\"modules\":" + TOUS_LES_MODULES + "}")
                .when().post("/societe/paiement")
                .then()
                .statusCode(400)
                .body(containsString("Aucun module"));

            // Retiré puis rajouté pendant les mois déjà payés avec lui : rien à payer
            given().contentType("application/json").body(SANS_MARKETING).when().put("/societe/modules").then().statusCode(200);
            given().contentType("application/json").body(TOUS_LES_MODULES).when().put("/societe/modules").then().statusCode(200);
        } finally {
            restaurerModules();
        }
    }

    @Test
    void testAjoutDeModuleRefuseEnRetard() {
        Timestamp origine = AbonnementBlocageTest.echeance();
        try {
            given().contentType("application/json").body(SANS_MARKETING).when().put("/societe/modules").then().statusCode(200);
            AbonnementBlocageTest.echeance(AbonnementBlocageTest.ilYa(0, 5));

            given()
                .contentType("application/json")
                .body(TOUS_LES_MODULES)
                .when().put("/societe/modules")
                .then()
                .statusCode(400)
                .body(containsString("échéances en retard"));
            given()
                .contentType("application/json")
                .body("{\"type\":\"MODULES\",\"mode\":\"STRIPE\",\"modules\":" + TOUS_LES_MODULES + "}")
                .when().post("/societe/paiement/en-ligne")
                .then()
                .statusCode(400)
                .body(containsString("échéances en retard"));
        } finally {
            AbonnementBlocageTest.echeance(origine);
            restaurerModules();
        }
    }

    private static double arrondi(double montant) {
        return Math.round(montant * 100.0) / 100.0;
    }
}
