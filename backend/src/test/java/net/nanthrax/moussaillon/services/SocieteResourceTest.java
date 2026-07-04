package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;

@QuarkusTest
public class SocieteResourceTest {

    @Test
    void testObtenirSociete() {
        given()
            .when().get("/societe")
            .then()
            .statusCode(200)
            .body("nom", is("MS Plaisance"))
            .body("siren", is("123456789"));
    }

    @Test
    void testModifierSociete() {
        given()
            .contentType("application/json")
            .body("{\"nom\":\"MS Plaisance Updated\",\"siren\":\"123456789\",\"adresse\":\"20 quai du Port\",\"email\":\"new@msplaisance.com\"}")
            .when().put("/societe")
            .then()
            .statusCode(200)
            .body("nom", is("MS Plaisance Updated"))
            .body("adresse", is("20 quai du Port"));

        // Restaurer l'original
        given()
            .contentType("application/json")
            .body("{\"nom\":\"MS Plaisance\",\"siren\":\"123456789\",\"adresse\":\"10 quai du Port\"}")
            .when().put("/societe")
            .then()
            .statusCode(200);
    }

    @Test
    void testModifierAbonnement() {
        given()
            .contentType("application/json")
            .body("{\"nom\":\"MS Plaisance\",\"siren\":\"123456789\",\"adresse\":\"10 quai du Port\","
                + "\"abonnementActivationDate\":\"2026-01-15\",\"abonnementActivationMontant\":990.0,"
                + "\"abonnementProchainPaiementDate\":\"2027-01-15\",\"abonnementProchainPaiementMontant\":49.9}")
            .when().put("/societe")
            .then()
            .statusCode(200)
            .body("abonnementActivationDate", startsWith("2026-01-15"))
            .body("abonnementActivationMontant", is(990.0f))
            .body("abonnementProchainPaiementDate", startsWith("2027-01-15"))
            .body("abonnementProchainPaiementMontant", is(49.9f));

        // Restaurer l'original
        given()
            .contentType("application/json")
            .body("{\"nom\":\"MS Plaisance\",\"siren\":\"123456789\",\"adresse\":\"10 quai du Port\"}")
            .when().put("/societe")
            .then()
            .statusCode(200);
    }
}
