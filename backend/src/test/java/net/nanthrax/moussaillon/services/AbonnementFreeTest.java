package net.nanthrax.moussaillon.services;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;

@QuarkusTest
@TestProfile(AbonnementFreeTest.VersionFree.class)
public class AbonnementFreeTest {

    public static class VersionFree implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of("abonnement.free", "true");
        }
    }

    @Test
    void testVersionFreeNeBloqueJamaisLAcces() {
        given().when().get("/societe").then().statusCode(200);
        // Impayé depuis 6 mois et résilié depuis 1 mois
        QuarkusTransaction.requiringNew().run(() -> {
            SocieteEntity societe = SocieteEntity.findById(1L);
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
            .body("abonnementImpaye", is(false));

        given()
            .contentType("application/json")
            .body("{\"email\":\"jean.dupont@test.com\",\"password\":\"client123\"}")
            .when().post("/portal/login")
            .then()
            .statusCode(200);
    }
}
