package net.nanthrax.moussaillon.services;

import java.time.LocalDate;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.anyOf;
import static org.hamcrest.Matchers.instanceOf;
import static org.junit.jupiter.api.Assertions.assertEquals;

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
            .body("ventesComptoir", notNullValue())
            .body("contratsMaintenancePct", notNullValue())
            .body("bateauxDansLeChantier", notNullValue())
            .body("bateauxEntreesSemaine", notNullValue())
            .body("bateauxEnAttenteIntervention", notNullValue())
            // Null tant qu'aucune facture payee n'a a la fois sa date d'emission et sa date
            // de paiement renseignees ; sinon un nombre (moyenne en jours). L'arithmetique de
            // calcul de la moyenne est couverte par ClientResourceAverageDelaiPaiementTest.
            .body("delaiPaiementMoyenJours", anyOf(nullValue(), instanceOf(Number.class)));
    }

    @Test
    void testCaDuMoisSurLaDateDePaiement() {
        double avant = caDuMois();
        LocalDate debutDuMois = LocalDate.now().withDayOfMonth(1);

        // Vente du mois dernier payée ce mois-ci : comptée.
        creerVente("FACTURE_PAYEE", debutDuMois.minusMonths(1), LocalDate.now(), 123.45);
        // Vente du mois payée le mois dernier : non comptée.
        creerVente("FACTURE_PAYEE", LocalDate.now(), debutDuMois.minusDays(1), 1000.0);
        // Vente payée sans date de paiement : rattachée à la date de la vente, ici ce mois-ci.
        creerVente("FACTURE_PAYEE", LocalDate.now(), null, 10.0);
        // Facture émise mais non payée : non comptée.
        creerVente("FACTURE_PRETE", LocalDate.now(), null, 500.0);

        assertEquals(avant + 133.45, caDuMois(), 0.001);
    }

    @Test
    void testVentesComptoirDuMois() {
        long avant = ventesComptoir();
        LocalDate debutDuMois = LocalDate.now().withDayOfMonth(1);

        // Vente comptoir du mois : comptée.
        creerVenteComptoir(true, LocalDate.now());
        // Vente comptoir du mois dernier : non comptée.
        creerVenteComptoir(true, debutDuMois.minusDays(1));
        // Transaction/prestation du mois : non comptée.
        creerVenteComptoir(false, LocalDate.now());

        assertEquals(avant + 1, ventesComptoir());
    }

    private static long ventesComptoir() {
        Number n = given()
            .when().get("/dashboard")
            .then()
            .statusCode(200)
            .extract().path("ventesComptoir");
        return n.longValue();
    }

    private static void creerVenteComptoir(boolean comptoir, LocalDate date) {
        given()
            .contentType("application/json")
            .body("{\"status\":\"FACTURE_PAYEE\",\"comptoir\":" + comptoir + ",\"date\":\"" + date + "\",\"prixVenteTTC\":10.0}")
            .when().post("/ventes")
            .then()
            .statusCode(201);
    }

    private static double caDuMois() {
        Number ca = given()
            .when().get("/dashboard")
            .then()
            .statusCode(200)
            .extract().path("caDuMois");
        return ca.doubleValue();
    }

    private static void creerVente(String status, LocalDate date, LocalDate dateFacturePayee, double prixVenteTTC) {
        given()
            .contentType("application/json")
            .body("{\"status\":\"" + status + "\",\"date\":\"" + date + "\","
                + (dateFacturePayee != null ? "\"dateFacturePayee\":\"" + dateFacturePayee + "\"," : "")
                + "\"prixVenteTTC\":" + prixVenteTTC + "}")
            .when().post("/ventes")
            .then()
            .statusCode(201);
    }
}
