package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;

@QuarkusTest
public class AvoirResourceTest {

    @Test
    void testCreerEtModifierAvoirAvecReferences() {
        // Create an avoir with a reference and line reference
        String jsonCreate = "{\n" +
                "  \"client\": {\"id\": 100},\n" +
                "  \"reference\": \"AV-2026-TEST\",\n" +
                "  \"motif\": \"Retour produit défectueux\",\n" +
                "  \"montantHT\": 50.0,\n" +
                "  \"tva\": 20.0,\n" +
                "  \"montantTVA\": 10.0,\n" +
                "  \"montantTTC\": 60.0,\n" +
                "  \"lignes\": [\n" +
                "    {\n" +
                "      \"reference\": \"FILT-001\",\n" +
                "      \"designation\": \"Filtre à huile\",\n" +
                "      \"quantite\": 1,\n" +
                "      \"prixUnitaireHT\": 50.0,\n" +
                "      \"tva\": 20.0,\n" +
                "      \"montantTVA\": 10.0,\n" +
                "      \"totalTTC\": 60.0\n" +
                "    }\n" +
                "  ]\n" +
                "}";

        int id = given()
                .contentType("application/json")
                .body(jsonCreate)
                .when().post("/avoirs")
                .then()
                .statusCode(200)
                .body("reference", is("AV-2026-TEST"))
                .body("lignes[0].reference", is("FILT-001"))
                .body("lignes[0].designation", is("Filtre à huile"))
                .extract().path("id");

        // Get by ID
        given()
                .when().get("/avoirs/" + id)
                .then()
                .statusCode(200)
                .body("reference", is("AV-2026-TEST"))
                .body("lignes[0].reference", is("FILT-001"));

        // Search by reference
        given()
                .when().get("/avoirs/search?reference=AV-2026-TEST")
                .then()
                .statusCode(200)
                .body("size()", greaterThanOrEqualTo(1))
                .body("[0].reference", is("AV-2026-TEST"));

        // Update avoir
        String jsonUpdate = "{\n" +
                "  \"client\": {\"id\": 100},\n" +
                "  \"reference\": \"AV-2026-UPDATED\",\n" +
                "  \"motif\": \"Retour produit défectueux mis à jour\",\n" +
                "  \"montantHT\": 75.0,\n" +
                "  \"tva\": 20.0,\n" +
                "  \"montantTVA\": 15.0,\n" +
                "  \"montantTTC\": 90.0,\n" +
                "  \"lignes\": [\n" +
                "    {\n" +
                "      \"reference\": \"FILT-002\",\n" +
                "      \"designation\": \"Filtre à carburant\",\n" +
                "      \"quantite\": 1,\n" +
                "      \"prixUnitaireHT\": 75.0,\n" +
                "      \"tva\": 20.0,\n" +
                "      \"montantTVA\": 15.0,\n" +
                "      \"totalTTC\": 90.0\n" +
                "    }\n" +
                "  ]\n" +
                "}";

        given()
                .contentType("application/json")
                .body(jsonUpdate)
                .when().put("/avoirs/" + id)
                .then()
                .statusCode(200)
                .body("reference", is("AV-2026-UPDATED"))
                .body("lignes[0].reference", is("FILT-002"));
    }

    @Test
    void testGenerationAutomatiqueReferenceAvoir() {
        int year = java.time.LocalDate.now().getYear();

        // Create an avoir without reference
        String jsonCreate = "{\n" +
                "  \"client\": {\"id\": 100},\n" +
                "  \"motif\": \"Geste commercial\",\n" +
                "  \"montantHT\": 10.0,\n" +
                "  \"tva\": 20.0,\n" +
                "  \"montantTVA\": 2.0,\n" +
                "  \"montantTTC\": 12.0,\n" +
                "  \"lignes\": [\n" +
                "    {\n" +
                "      \"designation\": \"Remise commerciale\",\n" +
                "      \"quantite\": 1,\n" +
                "      \"prixUnitaireHT\": 10.0,\n" +
                "      \"tva\": 20.0,\n" +
                "      \"montantTVA\": 2.0,\n" +
                "      \"totalTTC\": 12.0\n" +
                "    }\n" +
                "  ]\n" +
                "}";

        int id = given()
                .contentType("application/json")
                .body(jsonCreate)
                .when().post("/avoirs")
                .then()
                .statusCode(200)
                .body("reference", startsWith("AV-" + year + "-"))
                .extract().path("id");

        // Verify that emettre maintains the auto-generated reference
        given()
                .contentType("application/json")
                .when().post("/avoirs/" + id + "/emettre")
                .then()
                .statusCode(200)
                .body("reference", startsWith("AV-" + year + "-"))
                .body("status", is("EMIS"));
    }

    @Test
    void testRembourserAvoirExigeModeRemboursement() {
        // Le mode de remboursement fourni à la création est ignoré
        String jsonCreate = "{\n" +
                "  \"client\": {\"id\": 100},\n" +
                "  \"motif\": \"Remboursement client\",\n" +
                "  \"modeRemboursement\": \"CHEQUE\",\n" +
                "  \"montantHT\": 10.0,\n" +
                "  \"tva\": 20.0,\n" +
                "  \"montantTVA\": 2.0,\n" +
                "  \"montantTTC\": 12.0,\n" +
                "  \"lignes\": [\n" +
                "    {\n" +
                "      \"designation\": \"Remise commerciale\",\n" +
                "      \"quantite\": 1,\n" +
                "      \"prixUnitaireHT\": 10.0,\n" +
                "      \"tva\": 20.0,\n" +
                "      \"montantTVA\": 2.0,\n" +
                "      \"totalTTC\": 12.0\n" +
                "    }\n" +
                "  ]\n" +
                "}";

        int id = given()
                .contentType("application/json")
                .body(jsonCreate)
                .when().post("/avoirs")
                .then()
                .statusCode(200)
                .body("modeRemboursement", nullValue())
                .extract().path("id");

        given()
                .contentType("application/json")
                .when().post("/avoirs/" + id + "/emettre")
                .then()
                .statusCode(200);

        // Sans mode de remboursement : refusé
        given()
                .contentType("application/json")
                .body("{}")
                .when().post("/avoirs/" + id + "/rembourser")
                .then()
                .statusCode(400);

        given()
                .contentType("application/json")
                .body("{\"modeRemboursement\": \"VIREMENT\"}")
                .when().post("/avoirs/" + id + "/rembourser")
                .then()
                .statusCode(200)
                .body("status", is("REMBOURSE"))
                .body("modeRemboursement", is("VIREMENT"));
    }


    @Test
    void testAvoirProfessionnelDeLaMerSansTva() {
        int clientId = given()
                .contentType("application/json")
                .body("{\"nom\":\"Armement Avoir\",\"type\":\"PROFESSIONNEL_MER\"}")
                .when().post("/clients")
                .then().statusCode(200).extract().path("id");
        // Article à 60 € TTC (50 € HT, TVA 20 %) facturé au prix HT
        String vente = "{\"status\":\"FACTURE_PRETE\",\"comptoir\":true,\"client\":{\"id\":" + clientId + "},"
                + "\"tva\":0.0,\"montantHT\":100.0,\"montantTTC\":100.0,\"prixVenteTTC\":100.0,\"venteProduits\":["
                + "{\"quantite\":2,\"produit\":{\"designation\":\"Ligne Pro Mer " + System.nanoTime() + "\",\"prixVenteTTC\":60.0,\"tva\":20.0}}]}";
        int venteId = given()
                .contentType("application/json")
                .body(vente)
                .when().post("/ventes")
                .then().statusCode(201).extract().path("id");

        given()
                .contentType("application/json")
                .body("{\"motif\":\"Retour\"}")
                .when().post("/avoirs/from-vente/" + venteId)
                .then().statusCode(200)
                .body("tva", is(0.0f))
                .body("lignes[0].tva", is(0.0f))
                .body("montantTVA", is(0.0f))
                .body("montantHT", is(100.0f))
                .body("montantTTC", is(100.0f));
    }

    @Test
    void testAvoirPartielSurLignesSelectionnees() {
        String vente = "{\"status\":\"DEVIS\",\"comptoir\":true,\"client\":{\"id\":100},\"prixVenteTTC\":46.0,\"venteProduits\":["
                + "{\"quantite\":1,\"produit\":{\"designation\":\"Ligne A " + System.nanoTime() + "\",\"prixVenteTTC\":12.0,\"tva\":20.0}},"
                + "{\"quantite\":2,\"produit\":{\"designation\":\"Ligne B " + System.nanoTime() + "\",\"prixVenteTTC\":17.0,\"tva\":20.0}}]}";
        io.restassured.path.json.JsonPath created = given()
                .contentType("application/json")
                .body(vente)
                .when().post("/ventes")
                .then().statusCode(201).extract().jsonPath();
        int venteId = created.getInt("id");
        int ligneB = created.getInt("venteProduits[1].id");

        // Seule la ligne B est reprise
        given()
                .contentType("application/json")
                .body("{\"motif\":\"Retour partiel\",\"produitIds\":[" + ligneB + "]}")
                .when().post("/avoirs/from-vente/" + venteId)
                .then().statusCode(200)
                .body("lignes.size()", is(1))
                .body("montantTTC", is(34.0f));

        // Sans sélection, toutes les lignes sont reprises
        given()
                .contentType("application/json")
                .body("{\"motif\":\"Retour total\"}")
                .when().post("/avoirs/from-vente/" + venteId)
                .then().statusCode(200)
                .body("lignes.size()", is(2))
                .body("montantTTC", is(46.0f));

        // Une sélection qui ne correspond à aucune ligne est refusée
        given()
                .contentType("application/json")
                .body("{\"motif\":\"Rien\",\"produitIds\":[]}")
                .when().post("/avoirs/from-vente/" + venteId)
                .then().statusCode(400);
    }
}
