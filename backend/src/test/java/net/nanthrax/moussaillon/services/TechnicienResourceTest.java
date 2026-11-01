package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;

@QuarkusTest
public class TechnicienResourceTest {

    @Test
    void testListerTechniciens() {
        given()
            .when().get("/techniciens")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testObtenirTechnicien() {
        given()
            .when().get("/techniciens/100")
            .then()
            .statusCode(200)
            .body("nom", is("Leclerc"))
            .body("prenom", is("Pierre"));
    }

    @Test
    void testObtenirTechnicienNonTrouve() {
        given()
            .when().get("/techniciens/9999")
            .then()
            .statusCode(404);
    }

    @Test
    void testCreerTechnicien() {
        given()
            .contentType("application/json")
            .body("{\"nom\":\"Durand\",\"prenom\":\"Marc\",\"email\":\"marc@test.com\",\"telephone\":\"0600000001\",\"couleur\":\"#0000FF\"}")
            .when().post("/techniciens")
            .then()
            .statusCode(200)
            .body("nom", is("Durand"))
            .body("id", notNullValue());
    }

    @Test
    void testCreerTechnicienNomPrenomReformates() {
        // Nom et prénom saisis tout en majuscules ou tout en minuscules : reformatés en casse "Titre".
        given()
            .contentType("application/json")
            .body("{\"nom\":\"LE BIHAN\",\"prenom\":\"anne-sophie\",\"email\":\"as@test.com\"}")
            .when().post("/techniciens")
            .then()
            .statusCode(200)
            .body("nom", is("Le Bihan"))
            .body("prenom", is("Anne-Sophie"));
    }

    @Test
    void testModifierTechnicien() {
        int id = given()
            .contentType("application/json")
            .body("{\"nom\":\"Avant\",\"prenom\":\"Update\"}")
            .when().post("/techniciens")
            .then().statusCode(200).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"nom\":\"Apres\",\"prenom\":\"Update\",\"couleur\":\"#00FF00\"}")
            .when().put("/techniciens/" + id)
            .then()
            .statusCode(200)
            .body("nom", is("Apres"));
    }

    @Test
    void testRechercherTechniciens() {
        given()
            .queryParam("q", "leclerc")
            .when().get("/techniciens/search")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testSupprimerTechnicien() {
        int id = given()
            .contentType("application/json")
            .body("{\"nom\":\"ToDelete\",\"prenom\":\"Test\"}")
            .when().post("/techniciens")
            .then().statusCode(200).extract().path("id");

        given()
            .when().delete("/techniciens/" + id)
            .then()
            .statusCode(204);

        given()
            .when().get("/techniciens/" + id)
            .then()
            .statusCode(404);
    }
}
