package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Nombre de requêtes SQL des listes : pas de requête par élément. Avec le filtre du chantier, Hibernate retraduit
 * chaque requête à chaque exécution ; la liste des clients en faisait quatre par client (plus de 10 000 sur une base
 * de développement, plus d'une seconde).
 */
@QuarkusTest
public class RequetesParAppelTest {

    @Inject
    SessionFactory sessionFactory;

    @Test
    void testListeDesClientsSansRequeteParClient() {
        List<Integer> clients = new ArrayList<>();
        List<Integer> bateaux = new ArrayList<>();
        try {
            for (int i = 0; i < 30; i++) {
                int client = given().contentType("application/json")
                    .body("{\"nom\":\"Client Requetes " + i + "\",\"type\":\"Particulier\"}")
                    .when().post("/clients").then().statusCode(200).extract().path("id");
                clients.add(client);
                bateaux.add(given().contentType("application/json")
                    .body("{\"name\":\"Bateau Requetes " + i + "\",\"immatriculation\":\"REQ-" + i + "\",\"proprietaires\":[{\"id\":" + client + "}]}")
                    .when().post("/bateaux").then().statusCode(201).extract().path("id"));
            }

            // Statistiques activées pour les tests (quarkus.hibernate-orm.statistics) : sans elles, le compte resterait à 0
            assertTrue(sessionFactory.getStatistics().isStatisticsEnabled());
            long avant = sessionFactory.getStatistics().getPrepareStatementCount();
            given().when().get("/clients").then().statusCode(200);
            long requetes = sessionFactory.getStatistics().getPrepareStatementCount() - avant;
            assertTrue(requetes < 30, requetes + " requêtes pour la liste des clients");

            // Les champs calculés restent justes
            given().when().get("/clients/" + clients.get(0)).then().statusCode(200)
                .body("nombreBateaux", is(1))
                .body("bateaux[0].name", is("Bateau Requetes 0"))
                .body("soldeDu", is(0.0f));
        } finally {
            bateaux.forEach(id -> given().when().delete("/bateaux/" + id));
            clients.forEach(id -> given().when().delete("/clients/" + id));
        }
    }

}
