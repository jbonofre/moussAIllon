package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.anyOf;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.is;

@QuarkusTest
public class BateauClientResourceTest {

    @Test
    void testListerBateaux() {
        given()
            .when().get("/bateaux")
            .then()
            .statusCode(200);
    }

    @Test
    void testObtenirBateauNonTrouve() {
        given()
            .when().get("/bateaux/9999")
            .then()
            .statusCode(404);
    }

    @Test
    void testCreerBateau() {
        given()
            .contentType("application/json")
            .body("{\"name\":\"Mon Bateau\",\"immatriculation\":\"AB-123\",\"numeroSerie\":\"SN001\"}")
            .when().post("/bateaux")
            .then()
            .statusCode(201)
            .body("name", is("Mon Bateau"))
            .body("id", notNullValue());
    }

    @Test
    void testModifierBateau() {
        int id = given()
            .contentType("application/json")
            .body("{\"name\":\"AvantUpdate\",\"immatriculation\":\"XX-001\"}")
            .when().post("/bateaux")
            .then().statusCode(201).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"name\":\"ApresUpdate\",\"immatriculation\":\"XX-002\"}")
            .when().put("/bateaux/" + id)
            .then()
            .statusCode(200)
            .body("name", is("ApresUpdate"));
    }

    @Test
    void testNumeroSerieParMoteur() {
        int moteurId = given()
            .contentType("application/json")
            .body("{\"designation\":\"Moteur SN\",\"type\":\"Hors-bord\"}")
            .when().post("/catalogue/moteurs")
            .then().statusCode(200).extract().path("id");

        // Deux moteurs de même modèle, chacun avec son numéro de série ; le numéro d'un moteur
        // absent du bateau et le troisième numéro du même modèle sont ignorés
        int id = given()
            .contentType("application/json")
            .body("{\"name\":\"Bateau SN\",\"moteurs\":[{\"id\":" + moteurId + "},{\"id\":" + moteurId + "}],"
                + "\"numerosSerieMoteurs\":[{\"moteurId\":" + moteurId + ",\"numeroSerie\":\" ABC123 \"},"
                + "{\"moteurId\":" + moteurId + ",\"numeroSerie\":\"ABC124\"},"
                + "{\"moteurId\":" + moteurId + ",\"numeroSerie\":\"EXCES\"},"
                + "{\"moteurId\":99999,\"numeroSerie\":\"orphelin\"}]}")
            .when().post("/bateaux")
            .then().statusCode(201)
            .body("moteurs.size()", is(2))
            .body("numerosSerieMoteurs.size()", is(2))
            .body("numerosSerieMoteurs.numeroSerie", hasItems("ABC123", "ABC124"))
            .extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"name\":\"Bateau SN\",\"moteurs\":[{\"id\":" + moteurId + "}],"
                + "\"numerosSerieMoteurs\":[{\"moteurId\":" + moteurId + ",\"numeroSerie\":\"XYZ789\"}]}")
            .when().put("/bateaux/" + id)
            .then().statusCode(200)
            .body("moteurs.size()", is(1))
            .body("numerosSerieMoteurs.size()", is(1))
            .body("numerosSerieMoteurs[0].numeroSerie", is("XYZ789"));

        given()
            .contentType("application/json")
            .body("{\"name\":\"Bateau SN\",\"moteurs\":[]}")
            .when().put("/bateaux/" + id)
            .then().statusCode(200)
            .body("numerosSerieMoteurs.size()", is(0));
    }

    @Test
    void testRechercherBateaux() {
        // Creer un bateau pour garantir des resultats de recherche
        given()
            .contentType("application/json")
            .body("{\"name\":\"SearchTest\",\"immatriculation\":\"SR-001\"}")
            .when().post("/bateaux")
            .then().statusCode(201);

        given()
            .queryParam("q", "searchtest")
            .when().get("/bateaux/search")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    private int creer(String path, String body) {
        return given().contentType("application/json").body(body)
            .when().post(path).then().statusCode(anyOf(is(200), is(201))).extract().path("id");
    }

    @Test
    void testRechercheParClientMoteurEtRemorque() {
        int client = creer("/clients", "{\"nom\":\"Zorglub Rechbat\",\"type\":\"Particulier\"}");
        int autreClient = creer("/clients", "{\"nom\":\"Autre Rechbat\",\"type\":\"Particulier\"}");
        int moteurCat = creer("/catalogue/moteurs", "{\"designation\":\"Moteur rechbat\",\"type\":\"Hors-bord\"}");
        int remorqueCat = creer("/catalogue/remorques", "{\"designation\":\"Remorque rechbat\"}");
        creer("/moteurs", "{\"numeroSerie\":\"SNMOT-RB42\",\"proprietaire\":{\"id\":" + client
            + "},\"modele\":{\"id\":" + moteurCat + "}}");
        creer("/remorques", "{\"immatriculation\":\"RMQ-RB42\",\"proprietaire\":{\"id\":" + client
            + "},\"modele\":{\"id\":" + remorqueCat + "}}");
        // Moteur du même modèle mais d'un autre propriétaire : ne doit pas rattacher le bateau
        creer("/moteurs", "{\"numeroSerie\":\"SNMOT-AUTRE\",\"proprietaire\":{\"id\":" + autreClient
            + "},\"modele\":{\"id\":" + moteurCat + "}}");
        int bateau = creer("/bateaux", "{\"name\":\"Rechbat\",\"immatriculation\":\"IMM-RB\",\"proprietaires\":[{\"id\":"
            + client + "}],\"moteurs\":[{\"id\":" + moteurCat + "}],\"remorques\":[{\"id\":" + remorqueCat + "}]}");

        for (String q : new String[] {"rechbat", "imm-rb", "zorglub", "snmot-rb42", "rmq-rb42"}) {
            given().queryParam("q", q).when().get("/bateaux/search")
                .then().statusCode(200).body("id", hasItem(bateau)).body("size()", is(1));
        }
        given().queryParam("q", "snmot-autre").when().get("/bateaux/search")
            .then().statusCode(200).body("size()", is(0));
    }

    @Test
    void testSupprimerBateau() {
        int id = given()
            .contentType("application/json")
            .body("{\"name\":\"ToDelete\",\"immatriculation\":\"DEL-001\"}")
            .when().post("/bateaux")
            .then().statusCode(201).extract().path("id");

        given()
            .when().delete("/bateaux/" + id)
            .then()
            .statusCode(204);

        given()
            .when().get("/bateaux/" + id)
            .then()
            .statusCode(404);
    }
}
