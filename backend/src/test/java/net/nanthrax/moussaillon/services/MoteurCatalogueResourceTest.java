package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;

@QuarkusTest
public class MoteurCatalogueResourceTest {

    @Test
    void testListerMoteurs() {
        given()
            .when().get("/catalogue/moteurs")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testObtenirMoteur() {
        given()
            .when().get("/catalogue/moteurs/100")
            .then()
            .statusCode(200)
            .body("designation", is("Mercury 115 EFI"));
    }

    @Test
    void testObtenirMoteurNonTrouve() {
        given()
            .when().get("/catalogue/moteurs/9999")
            .then()
            .statusCode(404);
    }

    @Test
    void testCreerMoteur() {
        given()
            .contentType("application/json")
            .body("{\"designation\":\"Yamaha F90\",\"type\":\"Hors-bord\",\"puissanceCv\":90,\"stock\":3,\"prixVenteTTC\":9000.0}")
            .when().post("/catalogue/moteurs")
            .then()
            .statusCode(200)
            .body("designation", is("Yamaha F90"))
            .body("id", notNullValue());
    }

    @Test
    void testModifierMoteur() {
        int id = given()
            .contentType("application/json")
            .body("{\"designation\":\"Test AvantUpdate\",\"type\":\"Hors-bord\"}")
            .when().post("/catalogue/moteurs")
            .then().statusCode(200).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"designation\":\"Test ApresUpdate\",\"type\":\"Hors-bord\"}")
            .when().put("/catalogue/moteurs/" + id)
            .then()
            .statusCode(200)
            .body("designation", is("Test ApresUpdate"));
    }

    @Test
    void testRechercherMoteurs() {
        given()
            .queryParam("q", "mercury")
            .when().get("/catalogue/moteurs/search")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testSupprimerMoteur() {
        int id = given()
            .contentType("application/json")
            .body("{\"designation\":\"Test ToDelete\",\"type\":\"Hors-bord\"}")
            .when().post("/catalogue/moteurs")
            .then().statusCode(200).extract().path("id");

        given()
            .when().delete("/catalogue/moteurs/" + id)
            .then()
            .statusCode(204);

        given()
            .when().get("/catalogue/moteurs/" + id)
            .then()
            .statusCode(404);
    }
}
