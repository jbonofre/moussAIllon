package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;

@QuarkusTest
public class BateauCatalogueResourceTest {

    @Test
    void testListerBateaux() {
        given()
            .when().get("/catalogue/bateaux")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testObtenirBateau() {
        given()
            .when().get("/catalogue/bateaux/100")
            .then()
            .statusCode(200)
            .body("modele", is("Quicksilver 505"))
            .body("marque", is("Quicksilver"))
            .body("type", is("Open"));
    }

    @Test
    void testObtenirBateauNonTrouve() {
        given()
            .when().get("/catalogue/bateaux/9999")
            .then()
            .statusCode(404);
    }

    @Test
    void testCreerBateau() {
        given()
            .contentType("application/json")
            .body("{\"modele\":\"Test 300\",\"marque\":\"TestBrand\",\"type\":\"Cabin\",\"description\":\"Test boat\",\"annee\":2025,\"stock\":5,\"prixVenteTTC\":30000.0}")
            .when().post("/catalogue/bateaux")
            .then()
            .statusCode(201)
            .body("modele", is("Test 300"))
            .body("marque", is("TestBrand"))
            .body("id", notNullValue());
    }

    @Test
    void testModifierBateau() {
        // Creer une entite dediee pour le test de modification
        int id = given()
            .contentType("application/json")
            .body("{\"modele\":\"AvantUpdate\",\"marque\":\"TestBrand\",\"type\":\"Open\"}")
            .when().post("/catalogue/bateaux")
            .then()
            .statusCode(201)
            .extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"modele\":\"ApresUpdate\",\"marque\":\"TestBrand\",\"type\":\"Open\",\"description\":\"Updated\",\"annee\":2025}")
            .when().put("/catalogue/bateaux/" + id)
            .then()
            .statusCode(200)
            .body("modele", is("ApresUpdate"));
    }

    @Test
    void testRechercherBateaux() {
        given()
            .queryParam("q", "quicksilver")
            .when().get("/catalogue/bateaux/search")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testRechercherBateauxSansRequete() {
        given()
            .when().get("/catalogue/bateaux/search")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testCreerBateauAvecOptions() {
        given()
            .contentType("application/json")
            .body("{\"modele\":\"Options 400\",\"marque\":\"TestBrand\",\"type\":\"Open\",\"options\":[{\"nom\":\"GPS chartplotter\",\"description\":\"Navigation GPS\",\"prixHT\":800.0,\"tva\":20.0,\"montantTVA\":160.0,\"prixTTC\":960.0}]}")
            .when().post("/catalogue/bateaux")
            .then()
            .statusCode(201)
            .body("options[0].nom", is("GPS chartplotter"));
    }

    @Test
    void testSupprimerBateau() {
        // Creer un bateau a supprimer
        int id = given()
            .contentType("application/json")
            .body("{\"modele\":\"ToDelete\",\"marque\":\"TestBrand\",\"type\":\"Open\"}")
            .when().post("/catalogue/bateaux")
            .then()
            .statusCode(201)
            .extract().path("id");

        given()
            .when().delete("/catalogue/bateaux/" + id)
            .then()
            .statusCode(204);

        given()
            .when().get("/catalogue/bateaux/" + id)
            .then()
            .statusCode(404);
    }
}
