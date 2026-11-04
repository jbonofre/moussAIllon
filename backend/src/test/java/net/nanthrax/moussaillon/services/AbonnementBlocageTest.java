package net.nanthrax.moussaillon.services;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import org.junit.jupiter.api.Test;

import java.sql.Timestamp;
import java.time.LocalDateTime;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;

@QuarkusTest
public class AbonnementBlocageTest {

    private static final String ADMIN = "{\"name\":\"admin\",\"password\":\"admin123\"}";
    private static final String COMPTABLE = "{\"name\":\"comptable\",\"password\":\"compta123\"}";
    private static final String CLIENT = "{\"email\":\"jean.dupont@test.com\",\"password\":\"client123\"}";

    static Timestamp echeance() {
        return QuarkusTransaction.requiringNew().call(() -> SocieteEntity.<SocieteEntity>findById(1L).abonnementProchainPaiementDate);
    }

    static void echeance(Timestamp date) {
        QuarkusTransaction.requiringNew().run(() -> SocieteEntity.<SocieteEntity>findById(1L).abonnementProchainPaiementDate = date);
    }

    static Timestamp ilYa(int mois, int jours) {
        return Timestamp.valueOf(LocalDateTime.now().minusMonths(mois).minusDays(jours));
    }

    @Test
    void testImpayeDepuisDeuxMoisLimiteAccesAFacturation() {
        given().when().get("/societe").then().statusCode(200);
        Timestamp origine = echeance();
        given()
            .contentType("application/json")
            .body("{\"name\":\"comptable\",\"password\":\"compta123\",\"email\":\"compta@test.com\",\"modules\":[\"COMPTABILITE\"]}")
            .when().post("/users")
            .then()
            .statusCode(201);
        try {
            echeance(ilYa(2, 1));

            given()
                .when().get("/societe")
                .then()
                .statusCode(200)
                .body("accesBloqueImpaye", is(true))
                .body("abonnementBlocageImpayeDate", notNullValue());

            // Les utilisateurs du module Paramétrage se connectent, pour régler la facturation
            given()
                .contentType("application/json")
                .body(ADMIN)
                .when().post("/users/authenticate")
                .then()
                .statusCode(200)
                .body("abonnementImpaye", is(true));

            given()
                .contentType("application/json")
                .body(COMPTABLE)
                .when().post("/users/authenticate")
                .then()
                .statusCode(403)
                .body(containsString("impayé"));

            given()
                .contentType("application/json")
                .body(CLIENT)
                .when().post("/portal/login")
                .then()
                .statusCode(403);

            // Régler une échéance ramène l'impayé sous 2 mois et rétablit l'accès
            given()
                .contentType("application/json")
                .body("{\"type\":\"MENSUEL\",\"mode\":\"VIREMENT\",\"signature\":\"signature\"}")
                .when().post("/societe/paiement")
                .then()
                .statusCode(200)
                .body("accesBloqueImpaye", is(false));

            given()
                .contentType("application/json")
                .body(COMPTABLE)
                .when().post("/users/authenticate")
                .then()
                .statusCode(200)
                .body("abonnementImpaye", is(false));
        } finally {
            echeance(origine);
            given().when().delete("/users/comptable").then().statusCode(204);
        }
    }

    @Test
    void testEcheanceDepasseeDeMoinsDeDeuxMois() {
        given().when().get("/societe").then().statusCode(200);
        Timestamp origine = echeance();
        try {
            echeance(ilYa(1, 0));

            given()
                .when().get("/societe")
                .then()
                .statusCode(200)
                .body("accesBloqueImpaye", is(false))
                .body("abonnementBlocageImpayeDate", notNullValue());

            given()
                .contentType("application/json")
                .body(ADMIN)
                .when().post("/users/authenticate")
                .then()
                .statusCode(200)
                .body("abonnementImpaye", is(false));
        } finally {
            echeance(origine);
        }
    }

    @Test
    void testEcheanceAVenir() {
        given()
            .when().get("/societe")
            .then()
            .statusCode(200)
            .body("versionFree", is(false))
            .body("accesBloqueImpaye", is(false))
            .body("abonnementBlocageImpayeDate", nullValue());
    }
}
