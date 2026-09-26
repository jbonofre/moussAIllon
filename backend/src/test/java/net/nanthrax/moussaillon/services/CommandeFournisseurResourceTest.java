package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;

@QuarkusTest
public class CommandeFournisseurResourceTest {

    @Test
    void testListerCommandesFournisseur() {
        given()
            .when().get("/commandes-fournisseur")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testObtenirCommandeFournisseur() {
        given()
            .when().get("/commandes-fournisseur/100")
            .then()
            .statusCode(200)
            .body("status", is("EN_ATTENTE"))
            .body("reference", is("CF-001"))
            .body("lignes.size()", is(1));
    }

    @Test
    void testObtenirCommandeFournisseurNonTrouvee() {
        given()
            .when().get("/commandes-fournisseur/9999")
            .then()
            .statusCode(404);
    }

    @Test
    void testCreerCommandeFournisseur() {
        given()
            .contentType("application/json")
            .body("{\"status\":\"BROUILLON\",\"reference\":\"CF-TEST\",\"fournisseur\":{\"id\":100},\"montantHT\":200.0,\"montantTTC\":240.0,\"tva\":20.0,\"montantTVA\":40.0,\"portTotal\":5.0,\"lignes\":[{\"produit\":{\"id\":100},\"quantite\":5,\"prixUnitaireHT\":40.0,\"tva\":20.0,\"montantTVA\":40.0,\"prixTotalHT\":200.0,\"prixTotalTTC\":240.0}]}")
            .when().post("/commandes-fournisseur")
            .then()
            .statusCode(201)
            .body("status", is("BROUILLON"))
            .body("reference", is("CF-TEST"))
            .body("id", notNullValue());
    }

    @Test
    void testModifierCommandeFournisseur() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"BROUILLON\",\"reference\":\"CF-UPD\",\"fournisseur\":{\"id\":100},\"montantHT\":100.0,\"montantTTC\":120.0,\"tva\":20.0,\"montantTVA\":20.0,\"portTotal\":0.0,\"lignes\":[]}")
            .when().post("/commandes-fournisseur")
            .then().statusCode(201).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"status\":\"CONFIRMEE\",\"reference\":\"CF-UPD\",\"fournisseur\":{\"id\":100},\"montantHT\":300.0,\"montantTTC\":360.0,\"tva\":20.0,\"montantTVA\":60.0,\"portTotal\":10.0,\"lignes\":[{\"produit\":{\"id\":100},\"quantite\":3,\"prixUnitaireHT\":100.0,\"tva\":20.0,\"montantTVA\":60.0,\"prixTotalHT\":300.0,\"prixTotalTTC\":360.0}]}")
            .when().put("/commandes-fournisseur/" + id)
            .then()
            .statusCode(200)
            .body("status", is("CONFIRMEE"))
            .body("lignes.size()", is(1));
    }

    @Test
    void testRechercherParStatut() {
        given()
            .queryParam("status", "EN_ATTENTE")
            .when().get("/commandes-fournisseur/search")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testRechercherParFournisseur() {
        given()
            .queryParam("fournisseurId", 100)
            .when().get("/commandes-fournisseur/search")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testRechercherStatutInvalide() {
        given()
            .queryParam("status", "INVALID")
            .when().get("/commandes-fournisseur/search")
            .then()
            .statusCode(400);
    }

    @Test
    void testSupprimerCommandeFournisseur() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"BROUILLON\",\"reference\":\"CF-DEL\",\"fournisseur\":{\"id\":100},\"montantHT\":50.0,\"montantTTC\":60.0,\"tva\":20.0,\"montantTVA\":10.0,\"portTotal\":0.0,\"lignes\":[]}")
            .when().post("/commandes-fournisseur")
            .then().statusCode(201).extract().path("id");

        given()
            .when().delete("/commandes-fournisseur/" + id)
            .then()
            .statusCode(204);

        given()
            .when().get("/commandes-fournisseur/" + id)
            .then()
            .statusCode(404);
    }

    @Test
    void testSupprimerCommandeFournisseurNonTrouvee() {
        given()
            .when().delete("/commandes-fournisseur/9999")
            .then()
            .statusCode(404);
    }

    @Test
    void testPrepareFromVente() {
        given()
            .when().get("/commandes-fournisseur/prepare-from-vente/100")
            .then()
            .statusCode(200)
            .body("venteId", is(100))
            .body("articles", notNullValue())
            .body("tousFournisseurs", notNullValue());
    }

    @Test
    void testPrepareFromVenteNonTrouvee() {
        given()
            .when().get("/commandes-fournisseur/prepare-from-vente/9999")
            .then()
            .statusCode(404);
    }

    @Test
    void testCreateFromVente() {
        given()
            .contentType("application/json")
            .body("{\"fournisseurId\":100,\"reference\":\"CF-VTE-100\",\"notes\":\"Test commande depuis vente\",\"portTotal\":10.0,\"lignes\":[{\"type\":\"produit\",\"id\":100,\"quantite\":2,\"prixUnitaireHT\":15.0,\"tva\":20.0}]}")
            .when().post("/commandes-fournisseur/from-vente/100")
            .then()
            .statusCode(201)
            .body("reference", is("CF-VTE-100"))
            .body("vente.id", is(100))
            .body("fournisseur.id", is(100))
            .body("status", is("EN_ATTENTE"))
            .body("montantHT", is(30.0f))
            .body("montantTVA", is(6.0f))
            .body("montantTTC", is(46.0f))
            .body("lignes.size()", is(1));

        // Verifier la recherche par venteId
        given()
            .queryParam("venteId", 100)
            .when().get("/commandes-fournisseur/search")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));

        // Verifier l'obtention par venteId
        given()
            .when().get("/commandes-fournisseur/vente/100")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }
}
