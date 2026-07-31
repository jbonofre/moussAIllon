package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.anyOf;
import static org.hamcrest.Matchers.instanceOf;

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
            .body("bateauxEnAttenteIntervention", notNullValue())
            // Null tant qu'aucune facture payee n'a a la fois sa date d'emission et sa date
            // de paiement renseignees ; sinon un nombre (moyenne en jours). L'arithmetique de
            // calcul de la moyenne est couverte par ClientResourceAverageDelaiPaiementTest.
            .body("delaiPaiementMoyenJours", anyOf(nullValue(), instanceOf(Number.class)));
    }
}
