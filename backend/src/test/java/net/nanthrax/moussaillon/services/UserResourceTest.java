package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;

@QuarkusTest
public class UserResourceTest {

    @Test
    void testListerUtilisateurs() {
        given()
            .when().get("/users")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(2));
    }

    @Test
    void testObtenirUtilisateur() {
        given()
            .when().get("/users/admin")
            .then()
            .statusCode(200)
            .body("name", is("admin"))
            .body("email", is("admin@test.com"))
            .body("modules", containsInAnyOrder("VENTE", "PARC", "CATALOGUE", "ATELIER", "MARKETING", "COMPTABILITE", "PARAMETRAGE"))
            .body("password", nullValue());
    }

    @Test
    void testObtenirUtilisateurNonTrouve() {
        given()
            .when().get("/users/inexistant")
            .then()
            .statusCode(404);
    }

    @Test
    void testAuthentifier() {
        given()
            .contentType("application/json")
            .body("{\"name\":\"admin\",\"password\":\"admin123\"}")
            .when().post("/users/authenticate")
            .then()
            .statusCode(200)
            .body("name", is("admin"))
            .body("modules", hasItem("PARAMETRAGE"))
            .body("token", notNullValue());
    }

    @Test
    void testAuthentifierMotDePasseInvalide() {
        given()
            .contentType("application/json")
            .body("{\"name\":\"admin\",\"password\":\"wrong\"}")
            .when().post("/users/authenticate")
            .then()
            .statusCode(401);
    }

    @Test
    void testRechercherUtilisateurs() {
        given()
            .queryParam("q", "admin")
            .when().get("/users/search")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testCreerEtSupprimerUtilisateur() {
        // Creer
        given()
            .contentType("application/json")
            .body("{\"name\":\"testuser\",\"password\":\"pass123\",\"email\":\"test@test.com\",\"modules\":[\"VENTE\",\"PARC\"]}")
            .when().post("/users")
            .then()
            .statusCode(201)
            .body("name", is("testuser"))
            .body("modules", containsInAnyOrder("VENTE", "PARC"))
            .body("password", nullValue());

        // Modifier les modules
        given()
            .contentType("application/json")
            .body("{\"name\":\"testuser\",\"email\":\"test@test.com\",\"modules\":[\"CATALOGUE\"]}")
            .when().put("/users/testuser")
            .then()
            .statusCode(200)
            .body("modules", containsInAnyOrder("CATALOGUE"));

        // Supprimer
        given()
            .when().delete("/users/testuser")
            .then()
            .statusCode(204);
    }

    @Test
    void testChangerMotDePasse() {
        given()
            .contentType("application/json")
            .body("{\"currentPassword\":\"tech123\",\"newPassword\":\"newpass\"}")
            .when().post("/users/technicien1/change-password")
            .then()
            .statusCode(204);

        // Verifier que le nouveau mot de passe fonctionne
        given()
            .contentType("application/json")
            .body("{\"name\":\"technicien1\",\"password\":\"newpass\"}")
            .when().post("/users/authenticate")
            .then()
            .statusCode(200)
            .body("token", notNullValue());
    }

    @Test
    void testChangerMotDePasseActuelIncorrect() {
        given()
            .contentType("application/json")
            .body("{\"currentPassword\":\"wrong\",\"newPassword\":\"newpass\"}")
            .when().post("/users/admin/change-password")
            .then()
            .statusCode(401);
    }

    @Test
    void testAdminConserveToujoursParametrage() {
        try {
            given()
                .contentType("application/json")
                .body("{\"name\":\"admin\",\"email\":\"admin@test.com\",\"modules\":[\"VENTE\"]}")
                .when().put("/users/admin")
                .then()
                .statusCode(200)
                .body("modules", containsInAnyOrder("VENTE", "PARAMETRAGE"));
        } finally {
            given()
                .contentType("application/json")
                .body("{\"name\":\"admin\",\"email\":\"admin@test.com\",\"modules\":"
                    + "[\"VENTE\",\"PARC\",\"CATALOGUE\",\"ATELIER\",\"MARKETING\",\"COMPTABILITE\",\"PARAMETRAGE\"]}")
                .when().put("/users/admin")
                .then()
                .statusCode(200);
        }
    }

    @Test
    void testDernierAccesParametrageConserve() {
        // admin est le seul utilisateur ayant accès au module Paramétrage
        given()
            .when().delete("/users/admin")
            .then()
            .statusCode(400)
            .body(containsString("Paramétrage"));

        given()
            .when().get("/users/admin")
            .then()
            .statusCode(200)
            .body("modules", hasItem("PARAMETRAGE"));
    }
}
