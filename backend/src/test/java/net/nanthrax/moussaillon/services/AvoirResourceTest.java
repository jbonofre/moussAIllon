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

}
