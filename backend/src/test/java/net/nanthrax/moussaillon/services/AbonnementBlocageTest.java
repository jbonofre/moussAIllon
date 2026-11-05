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
        return QuarkusTransaction.requiringNew().call(() -> SocieteEntity.courante().abonnementProchainPaiementDate);
    }

    static void echeance(Timestamp date) {
        QuarkusTransaction.requiringNew().run(() -> SocieteEntity.courante().abonnementProchainPaiementDate = date);
    }

    static Timestamp ilYa(int mois, int jours) {
        return Timestamp.valueOf(LocalDateTime.now().minusMonths(mois).minusDays(jours));
    }

    /** Date d'activation et prochaine échéance de l'abonnement. */
    static Timestamp[] activation() {
        return QuarkusTransaction.requiringNew().call(() -> {
            SocieteEntity societe = SocieteEntity.courante();
            return new Timestamp[] { societe.abonnementActivationDate, societe.abonnementProchainPaiementDate };
        });
    }

    static void activation(Timestamp[] dates) {
        QuarkusTransaction.requiringNew().run(() -> {
            SocieteEntity societe = SocieteEntity.courante();
            societe.abonnementActivationDate = dates[0];
            societe.abonnementProchainPaiementDate = dates[1];
        });
    }

    @Test
    void testAbonnementNonActiveLimiteAccesAFacturation() {
        Timestamp[] origine = activation();
        try {
            activation(new Timestamp[] { null, null });

            given()
                .when().get("/societe")
                .then()
                .statusCode(200)
                .body("abonnementActif", is(false))
                .body("abonnementAJour", is(false))
                .body("accesLimiteFacturation", is(true))
                .body("abonnementActivationDate", nullValue())
                .body("abonnementBlocageImpayeDate", nullValue());

            // Les utilisateurs du module Paramétrage se connectent, pour activer l'abonnement
            given()
                .contentType("application/json")
                .body(ADMIN)
                .when().post("/users/authenticate")
                .then()
                .statusCode(200)
                .body("accesLimiteFacturation", is(true))
                .body("abonnementActif", is(false));

            given()
                .contentType("application/json")
                .body("{\"name\":\"technicien1\",\"password\":\"tech123\"}")
                .when().post("/users/authenticate")
                .then()
                .statusCode(403)
                .body(containsString("pas activé"));

            given()
                .contentType("application/json")
                .body(CLIENT)
                .when().post("/portal/login")
                .then()
                .statusCode(403);
        } finally {
            activation(origine);
        }
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
                .body("accesLimiteFacturation", is(true));

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
                .body("accesLimiteFacturation", is(false));
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
                .body("accesLimiteFacturation", is(false));
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
            .body("abonnementActif", is(true))
            .body("abonnementAJour", is(true))
            .body("accesLimiteFacturation", is(false))
            .body("accesBloqueImpaye", is(false))
            .body("abonnementBlocageImpayeDate", nullValue());
    }
}
