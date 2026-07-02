package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;

@QuarkusTest
public class DashboardResourceTest {

    @Test
    void testObtenirTableauDeBord() {
        given()
            .when().get("/dashboard")
            .then()
            .statusCode(200)
            .body("caDuMois", notNullValue())
            .body("interventionsOuvertes", notNullValue())
            .body("retards48h", notNullValue())
            .body("alertesStock", notNullValue())
            .body("interventions", notNullValue())
            .body("stockAlerts", notNullValue())
            .body("heuresAtelierPct", notNullValue())
            .body("ventesComptoirPct", notNullValue())
            .body("contratsMaintenancePct", notNullValue())
            .body("bateauxDansLeChantier", notNullValue())
            .body("bateauxEntreesSemaine", notNullValue())
            .body("bateauxEnAttenteIntervention", notNullValue());
    }
}
