package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.containsInAnyOrder;

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

    // Tous modules souscrits par défaut, 2 utilisateurs : 2 × 10 € + 140 € de modules.
    private static final float MONTANT_MENSUEL_PAR_DEFAUT = 160.0f;

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
            .body("abonnementNombreUtilisateurs", is(2))
            .body("abonnementProchainPaiementMontant", is(MONTANT_MENSUEL_PAR_DEFAUT))
            .body("abonnementMontantAnnuel", is(MONTANT_MENSUEL_PAR_DEFAUT * 11));
    }

    @Test
    void testTarifs() {
        given()
            .when().get("/societe/tarifs")
            .then()
            .statusCode(200)
            .body("prixUtilisateur", is(10.0f))
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
        try {
            // Paramétrage reste toujours souscrit ; 2 × 10 € + Vente 35 € + Parc 20 €.
            given()
                .contentType("application/json")
                .body("[\"VENTE\",\"PARC\"]")
                .when().put("/societe/modules")
                .then()
                .statusCode(200)
                .body("modules", containsInAnyOrder("VENTE", "PARC", "PARAMETRAGE"))
                .body("abonnementProchainPaiementMontant", is(75.0f))
                .body("abonnementMontantAnnuel", is(825.0f));

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

        given()
            .when().get("/societe")
            .then()
            .statusCode(200)
            .body("abonnementProchainPaiementMontant", is(MONTANT_MENSUEL_PAR_DEFAUT));
    }

    @Test
    void testPaiementSelonUtilisateursEtModules() {
        given()
            .contentType("application/json")
            .body("{\"type\":\"ANNUEL\",\"mode\":\"VIREMENT\",\"signature\":\"signature\"}")
            .when().post("/societe/paiement")
            .then()
            .statusCode(200)
            .body("paiements[0].type", is("ANNUEL"))
            .body("paiements[0].montant", is(MONTANT_MENSUEL_PAR_DEFAUT * 11))
            .body("paiements[0].nombreUtilisateurs", is(2))
            .body("paiements[0].modules.size()", is(7));
    }

    @Test
    void testAbonnementNonModifiableParPut() {
        // Un PUT ne doit pas pouvoir écraser les informations d'abonnement.
        given()
            .contentType("application/json")
            .body("{\"nom\":\"MS Plaisance\",\"siren\":\"123456789\",\"adresse\":\"10 quai du Port\","
                + "\"abonnementActivationMontant\":990.0,\"abonnementProchainPaiementMontant\":49.9}")
            .when().put("/societe")
            .then()
            .statusCode(200)
            .body("abonnementActivationMontant", is(350.0f))
            .body("abonnementProchainPaiementMontant", is(MONTANT_MENSUEL_PAR_DEFAUT));
    }
}
