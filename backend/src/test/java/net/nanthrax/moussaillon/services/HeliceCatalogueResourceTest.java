package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;

@QuarkusTest
public class HeliceCatalogueResourceTest {

    @Test
    void testListerHelices() {
        given()
            .when().get("/catalogue/helices")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testObtenirHelice() {
        given()
            .when().get("/catalogue/helices/100")
            .then()
            .statusCode(200)
            .body("designation", is("Mercury Vengeance 14x19"));
    }

    @Test
    void testObtenirHeliceNonTrouve() {
        given()
            .when().get("/catalogue/helices/9999")
            .then()
            .statusCode(404);
    }

    @Test
    void testCreerHelice() {
        given()
            .contentType("application/json")
            .body("{\"designation\":\"TestBrand Test Helice\",\"description\":\"Test\",\"diametre\":12,\"pas\":17,\"pales\":3,\"prixVenteTTC\":200.0}")
            .when().post("/catalogue/helices")
            .then()
            .statusCode(200)
            .body("designation", is("TestBrand Test Helice"))
            .body("id", notNullValue());
    }

    @Test
    void testModifierHelice() {
        int id = given()
            .contentType("application/json")
            .body("{\"designation\":\"Test AvantUpdate\",\"description\":\"Test\"}")
            .when().post("/catalogue/helices")
            .then().statusCode(200).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"designation\":\"Test ApresUpdate\",\"description\":\"Updated\"}")
            .when().put("/catalogue/helices/" + id)
            .then()
            .statusCode(200)
            .body("designation", is("Test ApresUpdate"));
    }

    @Test
    void testRechercherHelices() {
        given()
            .queryParam("designation", "vengeance")
            .when().get("/catalogue/helices/search")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testSupprimerHelice() {
        int id = given()
            .contentType("application/json")
            .body("{\"designation\":\"Test ToDelete\",\"description\":\"Test\"}")
            .when().post("/catalogue/helices")
            .then().statusCode(200).extract().path("id");

        given()
            .when().delete("/catalogue/helices/" + id)
            .then()
            .statusCode(204);

        given()
            .when().get("/catalogue/helices/" + id)
            .then()
            .statusCode(404);
    }
}
