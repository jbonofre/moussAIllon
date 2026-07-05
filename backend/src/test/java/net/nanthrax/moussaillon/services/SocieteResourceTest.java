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
    void testAbonnementInfosParDefaut() {
        // Les informations d'abonnement sont renseignées automatiquement (lecture seule).
        given()
            .when().get("/societe")
            .then()
            .statusCode(200)
            .body("abonnementActivationDate", notNullValue())
            .body("abonnementActivationMontant", is(350.0f))
            .body("abonnementProchainPaiementDate", notNullValue())
            .body("abonnementProchainPaiementMontant", is(150.0f));
    }

    @Test
    void testAbonnementNonModifiableParPut() {
        // Un PUT ne doit pas pouvoir écraser les informations d'abonnement.
        given()
            .contentType("application/json")
            .body("{\"nom\":\"MS Plaisance\",\"siren\":\"123456789\",\"adresse\":\"10 quai du Port\","
                + "\"abonnementActivationMontant\":990.0,\"abonnementProchainPaiementMontant\":49.9}")
            .when().put("/societe")
            .then()
            .statusCode(200)
            .body("abonnementActivationMontant", is(350.0f))
            .body("abonnementProchainPaiementMontant", is(150.0f));
    }
}
