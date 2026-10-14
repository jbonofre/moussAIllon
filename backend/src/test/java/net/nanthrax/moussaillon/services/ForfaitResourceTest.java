package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;

@QuarkusTest
public class ForfaitResourceTest {

    @Test
    void testListerForfaits() {
        given()
            .when().get("/forfaits")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testObtenirForfait() {
        given()
            .when().get("/forfaits/100")
            .then()
            .statusCode(200)
            .body("nom", is("Pack entretien complet"));
    }

    @Test
    void testObtenirForfaitNonTrouve() {
        given()
            .when().get("/forfaits/9999")
            .then()
            .statusCode(404);
    }

    @Test
    void testCreerForfait() {
        given()
            .contentType("application/json")
            .body("{\"nom\":\"Pack hivernage\",\"reference\":\"FORFAIT-002\",\"prixHT\":180.0,\"tva\":20.0}")
            .when().post("/forfaits")
            .then()
            .statusCode(201)
            .body("nom", is("Pack hivernage"))
            .body("id", notNullValue());
    }

    @Test
    void testModifierForfait() {
        int id = given()
            .contentType("application/json")
            .body("{\"nom\":\"AvantUpdate\",\"reference\":\"REF-UPD\"}")
            .when().post("/forfaits")
            .then().statusCode(201).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"nom\":\"ApresUpdate\",\"reference\":\"REF-UPD\"}")
            .when().put("/forfaits/" + id)
            .then()
            .statusCode(200)
            .body("nom", is("ApresUpdate"));
    }

    @Test
    void testRechercherForfaits() {
        given()
            .queryParam("q", "entretien")
            .when().get("/forfaits/search")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testSupprimerForfait() {
        int id = given()
            .contentType("application/json")
            .body("{\"nom\":\"ToDelete\",\"reference\":\"REF-DEL\"}")
            .when().post("/forfaits")
            .then().statusCode(201).extract().path("id");

        given()
            .when().delete("/forfaits/" + id)
            .then()
            .statusCode(204);

        given()
            .when().get("/forfaits/" + id)
            .then()
            .statusCode(404);
    }

    @Test
    void testForfaitSurBateauEtMoteurClient() {
        int bateauId = given()
            .contentType("application/json")
            .body("{\"name\":\"Zéphyr Forfait\",\"immatriculation\":\"ZZ-777-FF\",\"numeroSerie\":\"SN-FORFAIT-BAT\"}")
            .when().post("/bateaux")
            .then().statusCode(201).extract().path("id");
        int moteurId = given()
            .contentType("application/json")
            .body("{\"numeroSerie\":\"SN-FORFAIT-MOT\"}")
            .when().post("/moteurs")
            .then().statusCode(200).extract().path("id");

        int id = given()
            .contentType("application/json")
            .body("{\"nom\":\"Forfait parc client\",\"reference\":\"FPC-1\","
                + "\"bateauxClientsAssocies\":[{\"id\":" + bateauId + "}],"
                + "\"moteursClientsAssocies\":[{\"id\":" + moteurId + "}]}")
            .when().post("/forfaits")
            .then().statusCode(201).extract().path("id");

        given().when().get("/forfaits/" + id)
            .then().statusCode(200)
            .body("bateauxClientsAssocies.size()", is(1))
            .body("moteursClientsAssocies.size()", is(1));

        for (String q : new String[] {"zz-777", "sn-forfait-bat", "zéphyr", "sn-forfait-mot"}) {
            given().queryParam("q", q)
                .when().get("/forfaits/search")
                .then().statusCode(200)
                .body("id", hasItem(id));
        }

        // La suppression du bateau / moteur client détache le forfait
        given().when().delete("/bateaux/" + bateauId).then().statusCode(204);
        given().when().delete("/moteurs/" + moteurId).then().statusCode(204);
        given().when().get("/forfaits/" + id)
            .then().statusCode(200)
            .body("bateauxClientsAssocies.size()", is(0))
            .body("moteursClientsAssocies.size()", is(0));
    }
}
