package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;

@QuarkusTest
public class RemorqueCatalogResourceTest {

    @Test
    void testListerRemorques() {
        given()
            .when().get("/catalogue/remorques")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testObtenirRemorque() {
        given()
            .when().get("/catalogue/remorques/100")
            .then()
            .statusCode(200)
            .body("designation", is("Sun Way 500"));
    }

    @Test
    void testObtenirRemorqueNonTrouve() {
        given()
            .when().get("/catalogue/remorques/9999")
            .then()
            .statusCode(404);
    }

    @Test
    void testCreerRemorque() {
        given()
            .contentType("application/json")
            .body("{\"designation\":\"TestBrand Test Remorque\",\"description\":\"Test\",\"ptac\":500,\"stock\":1,\"prixVenteTTC\":1500.0}")
            .when().post("/catalogue/remorques")
            .then()
            .statusCode(200)
            .body("designation", is("TestBrand Test Remorque"))
            .body("id", notNullValue());
    }

    @Test
    void testModifierRemorque() {
        int id = given()
            .contentType("application/json")
            .body("{\"designation\":\"Test AvantUpdate\",\"description\":\"Test\"}")
            .when().post("/catalogue/remorques")
            .then().statusCode(200).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"designation\":\"Test ApresUpdate\",\"description\":\"Updated\"}")
            .when().put("/catalogue/remorques/" + id)
            .then()
            .statusCode(200)
            .body("designation", is("Test ApresUpdate"));
    }

    @Test
    void testRechercherRemorques() {
        given()
            .queryParam("designation", "sun")
            .when().get("/catalogue/remorques/search")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testSupprimerRemorque() {
        int id = given()
            .contentType("application/json")
            .body("{\"designation\":\"Test ToDelete\",\"description\":\"Test\"}")
            .when().post("/catalogue/remorques")
            .then().statusCode(200).extract().path("id");

        given()
            .when().delete("/catalogue/remorques/" + id)
            .then()
            .statusCode(204);

        given()
            .when().get("/catalogue/remorques/" + id)
            .then()
            .statusCode(404);
    }
}
