package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;

@QuarkusTest
public class TechnicienPortalResourceTest {

    @Test
    void testConnexionReussie() {
        given()
            .contentType("application/json")
            .body("{\"email\":\"pierre.leclerc@test.com\",\"motDePasse\":\"tech456\"}")
            .when().post("/technicien-portal/login")
            .then()
            .statusCode(200)
            .body("nom", is("Leclerc"))
            .body("token", notNullValue());
    }

    @Test
    void testConnexionEmailManquant() {
        given()
            .contentType("application/json")
            .body("{\"motDePasse\":\"test\"}")
            .when().post("/technicien-portal/login")
            .then()
            .statusCode(400);
    }

    @Test
    void testConnexionEmailInconnu() {
        given()
            .contentType("application/json")
            .body("{\"email\":\"unknown@test.com\",\"motDePasse\":\"test\"}")
            .when().post("/technicien-portal/login")
            .then()
            .statusCode(401);
    }

    @Test
    void testConnexionMotDePasseIncorrect() {
        given()
            .contentType("application/json")
            .body("{\"email\":\"pierre.leclerc@test.com\",\"motDePasse\":\"wrong\"}")
            .when().post("/technicien-portal/login")
            .then()
            .statusCode(401);
    }

    @Test
    void testChangerMotDePasse() {
        given()
            .contentType("application/json")
            .body("{\"technicienId\":100,\"currentPassword\":\"tech456\",\"newPassword\":\"newpass123\"}")
            .when().post("/technicien-portal/change-password")
            .then()
            .statusCode(204);

        // verify new password works for login
        given()
            .contentType("application/json")
            .body("{\"email\":\"pierre.leclerc@test.com\",\"motDePasse\":\"newpass123\"}")
            .when().post("/technicien-portal/login")
            .then()
            .statusCode(200)
            .body("nom", is("Leclerc"))
            .body("token", notNullValue());

        // restore original password
        given()
            .contentType("application/json")
            .body("{\"technicienId\":100,\"currentPassword\":\"newpass123\",\"newPassword\":\"tech456\"}")
            .when().post("/technicien-portal/change-password")
            .then()
            .statusCode(204);
    }

    @Test
    void testChangerMotDePasseActuelIncorrect() {
        given()
            .contentType("application/json")
            .body("{\"technicienId\":100,\"currentPassword\":\"wrong\",\"newPassword\":\"newpass123\"}")
            .when().post("/technicien-portal/change-password")
            .then()
            .statusCode(401);
    }

    @Test
    void testChangerMotDePasseNouveauVide() {
        given()
            .contentType("application/json")
            .body("{\"technicienId\":100,\"currentPassword\":\"tech456\",\"newPassword\":\"\"}")
            .when().post("/technicien-portal/change-password")
            .then()
            .statusCode(400);
    }

    @Test
    void testChangerMotDePasseTechnicienNonTrouve() {
        given()
            .contentType("application/json")
            .body("{\"technicienId\":9999,\"currentPassword\":\"test\",\"newPassword\":\"newpass\"}")
            .when().post("/technicien-portal/change-password")
            .then()
            .statusCode(404);
    }

    @Test
    void testObtenirTachesTechnicien() {
        given()
            .when().get("/technicien-portal/techniciens/100/taches")
            .then()
            .statusCode(200);
    }

    @Test
    void testObtenirTachesTechnicienNonTrouve() {
        given()
            .when().get("/technicien-portal/techniciens/9999/taches")
            .then()
            .statusCode(404);
    }

    @Test
    void testModifierForfait() {
        given()
            .contentType("application/json")
            .body("{\"status\":\"EN_COURS\",\"dureeReelle\":1.5,\"notes\":\"En cours de traitement\"}")
            .when().put("/technicien-portal/forfaits/100")
            .then()
            .statusCode(200)
            .body("itemStatus", is("EN_COURS"));
    }

    @Test
    void testModifierForfaitNonTrouve() {
        given()
            .contentType("application/json")
            .body("{\"status\":\"EN_COURS\",\"dureeReelle\":1.0}")
            .when().put("/technicien-portal/forfaits/9999")
            .then()
            .statusCode(404);
    }

    @Test
    void testModifierServiceNonTrouve() {
        given()
            .contentType("application/json")
            .body("{\"status\":\"EN_COURS\",\"dureeReelle\":1.0}")
            .when().put("/technicien-portal/services/9999")
            .then()
            .statusCode(404);
    }

    @Test
    void testObtenirCatalogueProduits() {
        given()
            .when().get("/technicien-portal/produits")
            .then()
            .statusCode(200)
            .body("$.size()", org.hamcrest.Matchers.greaterThan(0));
    }

    @Test
    void testAjouterProduitForfait() {
        given()
            .contentType("application/json")
            .body("{\"produitId\":100,\"quantite\":2}")
            .when().post("/technicien-portal/forfaits/100/produits")
            .then()
            .statusCode(200)
            .body("produitsExtra.size()", org.hamcrest.Matchers.greaterThan(0));
    }

    @Test
    void testAjouterProduitForfaitNonTrouve() {
        given()
            .contentType("application/json")
            .body("{\"produitId\":100,\"quantite\":1}")
            .when().post("/technicien-portal/forfaits/9999/produits")
            .then()
            .statusCode(404);
    }

    @Test
    void testAjouterProduitForfaitProduitInconnu() {
        given()
            .contentType("application/json")
            .body("{\"produitId\":9999,\"quantite\":1}")
            .when().post("/technicien-portal/forfaits/100/produits")
            .then()
            .statusCode(404);
    }
}
