package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.path.json.JsonPath;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.junit.jupiter.api.Assertions.assertEquals;

@QuarkusTest
public class SocieteResourceTest {

    @Test
    void testObtenirSociete() {
        given()
            .when().get("/societe")
            .then()
            .statusCode(200)
            .body("nom", is("MS Plaisance"))
            .body("siren", is("123456789"));
    }

    @Test
    void testModifierSociete() {
        given()
            .contentType("application/json")
            .body("{\"nom\":\"MS Plaisance Updated\",\"siren\":\"123456789\",\"adresse\":\"20 quai du Port\",\"email\":\"new@msplaisance.com\"}")
            .when().put("/societe")
            .then()
            .statusCode(200)
            .body("nom", is("MS Plaisance Updated"))
            .body("adresse", is("20 quai du Port"));

        // Restaurer l'original
        given()
            .contentType("application/json")
            .body("{\"nom\":\"MS Plaisance\",\"siren\":\"123456789\",\"adresse\":\"10 quai du Port\"}")
            .when().put("/societe")
            .then()
            .statusCode(200);
    }

    @Test
    void testParametrerConditionsPaiement() {
        given()
            .contentType("application/json")
            .body("{\"nom\":\"MS Plaisance\",\"siren\":\"123456789\",\"adresse\":\"10 quai du Port\","
                + "\"conditionsPaiement\":\"30 jours nets\",\"penalitesRetard\":\"3 fois le taux légal\",\"indemniteForfaitaire\":40.0}")
            .when().put("/societe")
            .then()
            .statusCode(200)
            .body("conditionsPaiement", is("30 jours nets"))
            .body("penalitesRetard", is("3 fois le taux légal"))
            .body("indemniteForfaitaire", is(40.0f));

        // Restaurer l'original : sans indemnité envoyée, la valeur par défaut de 40 € s'applique
        given()
            .contentType("application/json")
            .body("{\"nom\":\"MS Plaisance\",\"siren\":\"123456789\",\"adresse\":\"10 quai du Port\"}")
            .when().put("/societe")
            .then()
            .statusCode(200)
            .body("conditionsPaiement", nullValue())
            .body("indemniteForfaitaire", is(40.0f));
    }

    @Test
    void testIndemniteForfaitaireNegativeRefusee() {
        given()
            .contentType("application/json")
            .body("{\"nom\":\"MS Plaisance\",\"siren\":\"123456789\",\"adresse\":\"10 quai du Port\",\"indemniteForfaitaire\":-1.0}")
            .when().put("/societe")
            .then()
            .statusCode(400);
    }

    @Test
    void testParametrerRelances() {
        given()
            .contentType("application/json")
            .body("{\"nom\":\"MS Plaisance\",\"siren\":\"123456789\",\"adresse\":\"10 quai du Port\","
                + "\"relance1Jours\":15,\"relance2Jours\":30,\"relance3Jours\":45}")
            .when().put("/societe")
            .then()
            .statusCode(200)
            .body("relance1Jours", is(15))
            .body("relance2Jours", is(30))
            .body("relance3Jours", is(45));

        given()
            .when().get("/societe")
            .then()
            .statusCode(200)
            .body("relance2Jours", is(30));

        // Restaurer l'original (relances désactivées)
        given()
            .contentType("application/json")
            .body("{\"nom\":\"MS Plaisance\",\"siren\":\"123456789\",\"adresse\":\"10 quai du Port\"}")
            .when().put("/societe")
            .then()
            .statusCode(200)
            .body("relance1Jours", nullValue());
    }

    @Test
    void testRelancesDelaisCroissants() {
        given()
            .contentType("application/json")
            .body("{\"nom\":\"MS Plaisance\",\"siren\":\"123456789\",\"adresse\":\"10 quai du Port\","
                + "\"relance1Jours\":30,\"relance2Jours\":15}")
            .when().put("/societe")
            .then()
            .statusCode(400);

        given()
            .when().get("/societe")
            .then()
            .statusCode(200)
            .body("relance1Jours", nullValue());
    }

    // D'autres classes de test créent des techniciens et des clients : le montant attendu se calcule
    // d'après les effectifs renvoyés par le serveur.
    private static JsonPath societe() {
        return given().when().get("/societe").then().statusCode(200).extract().jsonPath();
    }

    private static double arrondi(double montant) {
        return Math.round(montant * 100.0) / 100.0;
    }

    /** 10 € par utilisateur et par technicien, 0,10 € par client ayant accès au portail, plus les modules. */
    private static double montantMensuelAttendu(JsonPath societe, double prixModules) {
        return arrondi(societe.getLong("abonnementNombreUtilisateurs") * 10.0
            + societe.getLong("abonnementNombreTechniciens") * 10.0
            + societe.getLong("abonnementNombreClients") * 0.10
            + prixModules);
    }

    // Tous les modules souscrits (par défaut) : 140 € par mois.
    private static final double TOUS_LES_MODULES_PRIX = 140.0;

    private static final String TOUS_LES_MODULES =
        "[\"VENTE\",\"PARC\",\"CATALOGUE\",\"ATELIER\",\"MARKETING\",\"COMPTABILITE\",\"PARAMETRAGE\"]";

    @Test
    void testAbonnementInfosParDefaut() {
        // Les informations d'abonnement sont renseignées automatiquement (lecture seule).
        given()
            .when().get("/societe")
            .then()
            .statusCode(200)
            .body("abonnementActivationDate", notNullValue())
            .body("abonnementActivationMontant", is(350.0f))
            .body("abonnementProchainPaiementDate", notNullValue())
            .body("modules", containsInAnyOrder("VENTE", "PARC", "CATALOGUE", "ATELIER", "MARKETING", "COMPTABILITE", "PARAMETRAGE"))
            .body("abonnementNombreUtilisateurs", is(2));

        JsonPath societe = societe();
        double mensuel = montantMensuelAttendu(societe, TOUS_LES_MODULES_PRIX);
        assertEquals(mensuel, societe.getDouble("abonnementProchainPaiementMontant"), 0.001);
        assertEquals(arrondi(mensuel * 11), societe.getDouble("abonnementMontantAnnuel"), 0.001);
    }

    @Test
    void testTechniciensEtClientsDuPortailComptes() {
        JsonPath avant = societe();
        int technicien = given()
            .contentType("application/json")
            .body("{\"nom\":\"Abonnement\",\"prenom\":\"Technicien\",\"email\":\"technicien.abonnement@test.com\"}")
            .when().post("/techniciens")
            .then().statusCode(200)
            .extract().path("id");
        int clientPortail = given()
            .contentType("application/json")
            .body("{\"nom\":\"Client Portail\",\"type\":\"Particulier\",\"email\":\"portail@test.com\",\"motDePasse\":\"secret\"}")
            .when().post("/clients")
            .then().statusCode(200)
            .extract().path("id");
        int clientSansPortail = given()
            .contentType("application/json")
            .body("{\"nom\":\"Client Sans Portail\",\"type\":\"Particulier\"}")
            .when().post("/clients")
            .then().statusCode(200)
            .extract().path("id");
        try {
            JsonPath apres = societe();
            assertEquals(avant.getLong("abonnementNombreTechniciens") + 1, apres.getLong("abonnementNombreTechniciens"));
            // Seul le client ayant accès au portail compte
            assertEquals(avant.getLong("abonnementNombreClients") + 1, apres.getLong("abonnementNombreClients"));
            assertEquals(arrondi(avant.getDouble("abonnementProchainPaiementMontant") + 10.10),
                apres.getDouble("abonnementProchainPaiementMontant"), 0.001);
        } finally {
            given().when().delete("/techniciens/" + technicien).then().statusCode(204);
            given().when().delete("/clients/" + clientPortail).then().statusCode(204);
            given().when().delete("/clients/" + clientSansPortail).then().statusCode(204);
        }
    }

    @Test
    void testTarifs() {
        given()
            .when().get("/societe/tarifs")
            .then()
            .statusCode(200)
            .body("prixUtilisateur", is(10.0f))
            .body("prixTechnicien", is(10.0f))
            .body("prixClient", is(0.1f))
            .body("prixModules.VENTE", is(35.0f))
            .body("prixModules.PARAMETRAGE", is(0.0f))
            .body("moisFacturesAnnuel", is(11));
    }

    @Test
    void testPaiementEnLigne() {
        // Sans clé API de l'éditeur ni lien fixe, le paiement en ligne n'est pas disponible
        given()
            .when().get("/societe/tarifs")
            .then()
            .statusCode(200)
            .body("paiementEnLigne.STRIPE", is(false))
            .body("paiementEnLigne.PAYPLUG", is(false));
        given()
            .contentType("application/json")
            .body("{\"type\":\"MENSUEL\",\"mode\":\"STRIPE\"}")
            .when().post("/societe/paiement/en-ligne")
            .then()
            .statusCode(400);

        // Sans clé API, le lien fixe de la société est utilisé
        try {
            given()
                .contentType("application/json")
                .body("{\"nom\":\"MS Plaisance\",\"siren\":\"123456789\",\"adresse\":\"10 quai du Port\","
                    + "\"payplugPaymentLinkAnnuel\":\"https://payplug.example.com/annuel\"}")
                .when().put("/societe")
                .then()
                .statusCode(200);
            given()
                .contentType("application/json")
                .body("{\"type\":\"ANNUEL\",\"mode\":\"PAYPLUG\"}")
                .when().post("/societe/paiement/en-ligne")
                .then()
                .statusCode(200)
                .body("url", is("https://payplug.example.com/annuel"));
        } finally {
            given()
                .contentType("application/json")
                .body("{\"nom\":\"MS Plaisance\",\"siren\":\"123456789\",\"adresse\":\"10 quai du Port\"}")
                .when().put("/societe")
                .then()
                .statusCode(200);
        }
    }

    @Test
    void testPrixSelonModulesSouscrits() {
        double mensuelTousModules = societe().getDouble("abonnementProchainPaiementMontant");
        try {
            // Paramétrage reste toujours souscrit : seuls Vente (35 €) et Parc (20 €) sont facturés.
            JsonPath societe = given()
                .contentType("application/json")
                .body("[\"VENTE\",\"PARC\"]")
                .when().put("/societe/modules")
                .then()
                .statusCode(200)
                .body("modules", containsInAnyOrder("VENTE", "PARC", "PARAMETRAGE"))
                .extract().jsonPath();
            double mensuel = montantMensuelAttendu(societe, 55.0);
            assertEquals(mensuel, societe.getDouble("abonnementProchainPaiementMontant"), 0.001);
            assertEquals(arrondi(mensuel * 11), societe.getDouble("abonnementMontantAnnuel"), 0.001);

            // Les utilisateurs perdent l'accès aux modules qui ne sont plus souscrits.
            given()
                .when().get("/users/admin")
                .then()
                .statusCode(200)
                .body("modules", containsInAnyOrder("VENTE", "PARC", "PARAMETRAGE"));

            // Un module non souscrit ne peut pas être attribué.
            given()
                .contentType("application/json")
                .body("{\"name\":\"marketeur\",\"password\":\"pass123\",\"email\":\"m@test.com\",\"modules\":[\"MARKETING\"]}")
                .when().post("/users")
                .then()
                .statusCode(400);
        } finally {
            given()
                .contentType("application/json")
                .body(TOUS_LES_MODULES)
                .when().put("/societe/modules")
                .then()
                .statusCode(200);
            given()
                .contentType("application/json")
                .body("{\"name\":\"admin\",\"email\":\"admin@test.com\",\"modules\":" + TOUS_LES_MODULES + "}")
                .when().put("/users/admin")
                .then()
                .statusCode(200);
        }

        assertEquals(mensuelTousModules, societe().getDouble("abonnementProchainPaiementMontant"), 0.001);
    }

    @Test
    void testPaiementSelonUtilisateursEtModules() {
        JsonPath avant = societe();
        given()
            .contentType("application/json")
            .body("{\"type\":\"ANNUEL\",\"mode\":\"VIREMENT\",\"signature\":\"signature\"}")
            .when().post("/societe/paiement")
            .then()
            .statusCode(200)
            .body("paiements[0].type", is("ANNUEL"))
            .body("paiements[0].montant", is((float) avant.getDouble("abonnementMontantAnnuel")))
            .body("paiements[0].nombreUtilisateurs", is(2))
            .body("paiements[0].nombreTechniciens", is(avant.getInt("abonnementNombreTechniciens")))
            .body("paiements[0].nombreClients", is(avant.getInt("abonnementNombreClients")))
            .body("paiements[0].modules.size()", is(7));
    }

    @Test
    void testAbonnementNonModifiableParPut() {
        double mensuel = societe().getDouble("abonnementProchainPaiementMontant");
        // Un PUT ne doit pas pouvoir écraser les informations d'abonnement.
        given()
            .contentType("application/json")
            .body("{\"nom\":\"MS Plaisance\",\"siren\":\"123456789\",\"adresse\":\"10 quai du Port\","
                + "\"abonnementActivationMontant\":990.0,\"abonnementProchainPaiementMontant\":49.9}")
            .when().put("/societe")
            .then()
            .statusCode(200)
            .body("abonnementActivationMontant", is(350.0f))
            .body("abonnementProchainPaiementMontant", is((float) mensuel));
    }
}
