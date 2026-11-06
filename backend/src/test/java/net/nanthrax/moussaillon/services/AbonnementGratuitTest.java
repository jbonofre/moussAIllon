package net.nanthrax.moussaillon.services;

import io.quarkus.arc.Arc;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import net.nanthrax.moussaillon.persistence.ChantierEntity;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.sql.Timestamp;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;

/** Abonnement gratuit, accordé au chantier par l'administrateur (remplace l'ancienne version Free de l'instance). */
@QuarkusTest
public class AbonnementGratuitTest {

    @BeforeEach
    void abonnementGratuit() {
        gratuit(true);
    }

    @AfterEach
    void abonnementPayant() {
        gratuit(false);
    }

    static void gratuit(boolean gratuit) {
        QuarkusTransaction.requiringNew().run(() -> ChantierEntity.<ChantierEntity>findById("test").gratuit = gratuit);
        // Modifié hors de l'administration : le registre gardé en mémoire est relu
        Arc.container().instance(Chantiers.class).get().oublier("test");
    }

    @Test
    void testAbonnementGratuitSansAbonnementActive() {
        Timestamp[] origine = AbonnementBlocageTest.activation();
        try {
            AbonnementBlocageTest.activation(new Timestamp[] { null, null });

            given()
                .when().get("/societe")
                .then()
                .statusCode(200)
                .body("abonnementActif", is(false))
                .body("accesLimiteFacturation", is(false));

            given()
                .contentType("application/json")
                .body("{\"name\":\"technicien1\",\"password\":\"tech123\"}")
                .when().post("/users/authenticate")
                .then()
                .statusCode(200)
                .body("accesLimiteFacturation", is(false));
        } finally {
            AbonnementBlocageTest.activation(origine);
        }
    }

    @Test
    void testAbonnementGratuitNeBloqueJamaisLAcces() {
        given().when().get("/societe").then().statusCode(200);
        Timestamp[] origine = AbonnementBlocageTest.activation();
        try {
            // Impayé depuis 6 mois et résilié depuis 1 mois
            QuarkusTransaction.requiringNew().run(() -> {
                SocieteEntity societe = SocieteEntity.courante();
                societe.abonnementProchainPaiementDate = AbonnementBlocageTest.ilYa(6, 0);
                societe.abonnementResilie = true;
                societe.abonnementResiliationDate = AbonnementBlocageTest.ilYa(1, 0);
            });

            given()
                .when().get("/societe")
                .then()
                .statusCode(200)
                .body("versionFree", is(true))
                .body("accesBloque", is(false))
                .body("accesBloqueImpaye", is(false))
                .body("abonnementBlocageImpayeDate", nullValue());

            given()
                .contentType("application/json")
                .body("{\"name\":\"technicien1\",\"password\":\"tech123\"}")
                .when().post("/users/authenticate")
                .then()
                .statusCode(200)
                .body("accesLimiteFacturation", is(false));

            given()
                .contentType("application/json")
                .body("{\"email\":\"jean.dupont@test.com\",\"password\":\"client123\"}")
                .when().post("/portal/login")
                .then()
                .statusCode(200);
        } finally {
            QuarkusTransaction.requiringNew().run(() -> {
                SocieteEntity societe = SocieteEntity.courante();
                societe.abonnementResilie = false;
                societe.abonnementResiliationDate = null;
            });
            AbonnementBlocageTest.activation(origine);
        }
    }

    @Test
    void testSansAbonnementGratuitLAccesEstBloque() {
        gratuit(false);
        Timestamp[] origine = AbonnementBlocageTest.activation();
        try {
            AbonnementBlocageTest.activation(new Timestamp[] { null, null });
            given()
                .when().get("/societe")
                .then()
                .statusCode(200)
                .body("versionFree", is(false))
                .body("accesLimiteFacturation", is(true));
        } finally {
            AbonnementBlocageTest.activation(origine);
        }
    }
}
