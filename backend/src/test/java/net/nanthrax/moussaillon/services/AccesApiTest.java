package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.sql.Timestamp;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.containsInAnyOrder;

@QuarkusTest
public class AccesApiTest {

    private static String jeton(String chemin, String identifiants) {
        return given()
            .contentType("application/json")
            .body(identifiants)
            .when().post(chemin)
            .then()
            .statusCode(200)
            .extract().path("token");
    }

    @BeforeEach
    void creerVendeur() {
        given()
            .contentType("application/json")
            .body("{\"name\":\"vendeur\",\"password\":\"vente123\",\"email\":\"vendeur@test.com\",\"modules\":[\"VENTE\"]}")
            .when().post("/users")
            .then()
            .statusCode(201);
    }

    @AfterEach
    void supprimerVendeur() {
        given().when().delete("/users/vendeur").then().statusCode(204);
    }

    @Test
    void testJetonDuPortailClientLimiteAuPortail() {
        String client = jeton("/portal/login", "{\"email\":\"jean.dupont@test.com\",\"password\":\"client123\"}");

        given().auth().oauth2(client).when().get("/users").then().statusCode(403);
        given().auth().oauth2(client).when().get("/ventes").then().statusCode(403);
        given().auth().oauth2(client).when().get("/annonces/active").then().statusCode(200);
    }

    @Test
    void testUtilisateurSansParametrage() {
        String vendeur = jeton("/users/authenticate", "{\"name\":\"vendeur\",\"password\":\"vente123\"}");

        given().auth().oauth2(vendeur).when().get("/ventes").then().statusCode(200);
        given().auth().oauth2(vendeur).when().get("/users").then().statusCode(403);
        given().auth().oauth2(vendeur)
            .contentType("application/json")
            .body("[\"VENTE\"]")
            .when().put("/societe/modules")
            .then()
            .statusCode(403)
            .body(containsString("Paramétrage"));

        // Sur son propre compte, seul le thème est modifié : pas ses modules
        given().auth().oauth2(vendeur)
            .contentType("application/json")
            .body("{\"name\":\"vendeur\",\"email\":\"autre@test.com\",\"modules\":[\"VENTE\",\"PARAMETRAGE\"],\"theme\":\"DARK\"}")
            .when().put("/users/vendeur")
            .then()
            .statusCode(200)
            .body("theme", is("DARK"))
            .body("email", is("vendeur@test.com"))
            .body("modules", containsInAnyOrder("VENTE"));
    }

    @Test
    void testUtilisateurAvecParametrage() {
        String admin = jeton("/users/authenticate", "{\"name\":\"admin\",\"password\":\"admin123\"}");

        given().auth().oauth2(admin).when().get("/users").then().statusCode(200);
        given().auth().oauth2(admin)
            .contentType("application/json")
            .body("{\"name\":\"vendeur\",\"email\":\"vendeur@test.com\",\"modules\":[\"VENTE\",\"PARC\"]}")
            .when().put("/users/vendeur")
            .then()
            .statusCode(200)
            .body("modules", containsInAnyOrder("VENTE", "PARC"));
    }

    @Test
    void testImpayeLimiteLesJetonsALaFacturation() {
        String admin = jeton("/users/authenticate", "{\"name\":\"admin\",\"password\":\"admin123\"}");
        given().when().get("/societe").then().statusCode(200);
        Timestamp origine = AbonnementBlocageTest.echeance();
        try {
            AbonnementBlocageTest.echeance(AbonnementBlocageTest.ilYa(2, 1));

            given().auth().oauth2(admin).when().get("/ventes").then().statusCode(403);
            given().auth().oauth2(admin).when().get("/societe").then().statusCode(200);
        } finally {
            AbonnementBlocageTest.echeance(origine);
        }
        given().auth().oauth2(admin).when().get("/ventes").then().statusCode(200);
    }
}
