package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;

@QuarkusTest
public class VenteResourceTest {

    @Test
    void testListerVentes() {
        given()
            .when().get("/ventes")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testObtenirVente() {
        given()
            .when().get("/ventes/100")
            .then()
            .statusCode(200)
            .body("status", is("FACTURE_PAYEE"));
    }

    @Test
    void testObtenirVenteNonTrouvee() {
        given()
            .when().get("/ventes/9999")
            .then()
            .statusCode(404);
    }

    @Test
    void testCreerVente() {
        given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":100.0,\"montantTTC\":100.0}")
            .when().post("/ventes")
            .then()
            .statusCode(201)
            .body("status", is("DEVIS"))
            .body("id", notNullValue());
    }

    @Test
    void testModifierVente() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":200.0}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"status\":\"FACTURE_EN_ATTENTE\",\"bonPourAccord\":true,\"prixVenteTTC\":200.0,\"remise\":10.0}")
            .when().put("/ventes/" + id)
            .then()
            .statusCode(200)
            .body("status", is("FACTURE_EN_ATTENTE"))
            .body("bonPourAccord", is(true));
    }

    @Test
    void testRechercherVentesParStatut() {
        given()
            .queryParam("status", "FACTURE_PAYEE")
            .when().get("/ventes/search")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testRechercherVentesStatutInvalide() {
        given()
            .queryParam("status", "INVALID")
            .when().get("/ventes/search")
            .then()
            .statusCode(400);
    }

    @Test
    void testRechercherVentesSansFiltre() {
        given()
            .when().get("/ventes/search")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testSupprimerVente() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":50.0}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        given()
            .when().delete("/ventes/" + id)
            .then()
            .statusCode(204);

        given()
            .when().get("/ventes/" + id)
            .then()
            .statusCode(404);
    }

    @Test
    void testSupprimerVenteNonTrouvee() {
        given()
            .when().delete("/ventes/9999")
            .then()
            .statusCode(404);
    }

    @Test
    void testCreerVenteAvecRappels() {
        given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":300.0,\"rappel1Jours\":30,\"rappel2Jours\":7,\"rappel3Jours\":1}")
            .when().post("/ventes")
            .then()
            .statusCode(201)
            .body("rappel1Jours", is(30))
            .body("rappel2Jours", is(7))
            .body("rappel3Jours", is(1))
            .body("rappel1Envoye", is(false))
            .body("rappel2Envoye", is(false))
            .body("rappel3Envoye", is(false));
    }

    @Test
    void testModifierRappelsVente() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":200.0}")
            .when().post("/ventes")
            .then().statusCode(201)
            .body("rappel1Jours", nullValue())
            .extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":200.0,\"rappel1Jours\":14,\"rappel2Jours\":3}")
            .when().put("/ventes/" + id)
            .then()
            .statusCode(200)
            .body("rappel1Jours", is(14))
            .body("rappel2Jours", is(3))
            .body("rappel3Jours", nullValue());
    }

    @Test
    void testModifierRappelsResetDrapeauEnvoi() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":200.0,\"rappel1Jours\":30}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":200.0,\"rappel1Jours\":15}")
            .when().put("/ventes/" + id)
            .then()
            .statusCode(200)
            .body("rappel1Jours", is(15))
            .body("rappel1Envoye", is(false));
    }

    @Test
    void testCreerVenteSansRappels() {
        given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":50.0}")
            .when().post("/ventes")
            .then()
            .statusCode(201)
            .body("rappel1Jours", nullValue())
            .body("rappel2Jours", nullValue())
            .body("rappel3Jours", nullValue());
    }

    @Test
    void testEnvoyerRappelManuel() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":100.0,\"client\":{\"id\":100}}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        given()
            .contentType("application/json")
            .when().post("/ventes/" + id + "/rappel")
            .then()
            .statusCode(200);

        // Verifier que l'historique a ete cree
        given()
            .when().get("/rappels/vente/" + id)
            .then()
            .statusCode(200)
            .body("size()", is(1))
            .body("[0].numeroRappel", is(0))
            .body("[0].destinataire", is("jean.dupont@test.com"));
    }

    @Test
    void testEnvoyerRappelManuelVenteNonTrouvee() {
        given()
            .contentType("application/json")
            .when().post("/ventes/9999/rappel")
            .then()
            .statusCode(404);
    }

    @Test
    void testEnvoyerRappelManuelSansEmailClient() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":100.0}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        given()
            .contentType("application/json")
            .when().post("/ventes/" + id + "/rappel")
            .then()
            .statusCode(400);
    }

    @Test
    void testBonPourAccordRequisPourPlanification() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":200.0,\"bonPourAccord\":false}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        // Trying to set a forfait to PLANIFIEE without bonPourAccord should fail
        given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"bonPourAccord\":false,\"prixVenteTTC\":200.0,\"venteForfaits\":[{\"forfait\":{\"id\":100},\"quantite\":1,\"status\":\"PLANIFIEE\"}]}")
            .when().put("/ventes/" + id)
            .then()
            .statusCode(400);
    }

    // --- Numérotation et champs légaux ---

    @Test
    void testGenererNumeroFactureAutomatique() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":150.0}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"status\":\"FACTURE_PRETE\",\"prixVenteTTC\":150.0}")
            .when().put("/ventes/" + id)
            .then()
            .statusCode(200)
            .body("status", is("FACTURE_PRETE"))
            .body("numeroFacture", notNullValue())
            .body("numeroFacture", startsWith("FACT-"));
    }

    @Test
    void testNumeroFactureImmuable() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":150.0}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        String numero = given()
            .contentType("application/json")
            .body("{\"status\":\"FACTURE_PRETE\",\"prixVenteTTC\":150.0}")
            .when().put("/ventes/" + id)
            .then().statusCode(200).extract().path("numeroFacture");

        // Deuxième mise à jour : le numéro ne doit pas changer
        given()
            .contentType("application/json")
            .body("{\"status\":\"FACTURE_PRETE\",\"prixVenteTTC\":200.0}")
            .when().put("/ventes/" + id)
            .then()
            .statusCode(200)
            .body("numeroFacture", is(numero));
    }

    @Test
    void testModifierVenteAvecChampsPaiementLegaux() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":300.0}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":300.0,"
                + "\"dateEcheance\":\"2026-12-31\","
                + "\"conditionsPaiement\":\"30 jours nets\","
                + "\"penalitesRetard\":\"3 fois le taux légal\","
                + "\"indemniteForfaitaire\":45.0}")
            .when().put("/ventes/" + id)
            .then()
            .statusCode(200)
            .body("conditionsPaiement", is("30 jours nets"))
            .body("penalitesRetard", is("3 fois le taux légal"))
            .body("indemniteForfaitaire", is(45.0f))
            .body("dateEcheance", notNullValue());
    }

    @Test
    void testIndemniteForfaitaireDefaut() {
        given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":100.0}")
            .when().post("/ventes")
            .then()
            .statusCode(201)
            .body("indemniteForfaitaire", is(40.0f));
    }

    // --- Endpoint Factur-X ---

    @Test
    void testTelechargerFacturXVentePayee() {
        given()
            .when().get("/ventes/100/facturx")
            .then()
            .statusCode(200)
            .contentType("application/pdf")
            .header("Content-Disposition", containsString("attachment"));
    }

    @Test
    void testTelechargerFacturXVentePrete() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":120.0}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"status\":\"FACTURE_PRETE\",\"prixVenteTTC\":120.0}")
            .when().put("/ventes/" + id)
            .then().statusCode(200);

        given()
            .when().get("/ventes/" + id + "/facturx")
            .then()
            .statusCode(200)
            .contentType("application/pdf")
            .header("Content-Disposition", containsString("attachment"));
    }

    @Test
    void testTelechargerFacturXVenteNonTrouvee() {
        given()
            .when().get("/ventes/9999/facturx")
            .then()
            .statusCode(404);
    }

    @Test
    void testTelechargerFacturXStatutInvalide() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":100.0}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        given()
            .when().get("/ventes/" + id + "/facturx")
            .then()
            .statusCode(400);
    }
}
