package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.contains;
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
    void testOrdreDesLignesConserve() {
        int id = given()
            .contentType("application/json")
            .body("{\"nom\":\"Forfait ordre\",\"reference\":\"REF-ORDRE\",\"produits\":["
                + "{\"quantite\":1,\"produit\":{\"id\":100}},"
                + "{\"quantite\":1,\"produit\":{\"id\":101}}]}")
            .when().post("/forfaits")
            .then().statusCode(201).extract().path("id");

        // Lignes réordonnées à l'écran : le forfait les restitue dans le nouvel ordre
        given()
            .contentType("application/json")
            .body("{\"nom\":\"Forfait ordre\",\"reference\":\"REF-ORDRE\",\"produits\":["
                + "{\"quantite\":1,\"produit\":{\"id\":101}},"
                + "{\"quantite\":1,\"produit\":{\"id\":100}}]}")
            .when().put("/forfaits/" + id)
            .then().statusCode(200);

        given()
            .when().get("/forfaits/" + id)
            .then()
            .statusCode(200)
            .body("produits.produit.id", contains(101, 100));
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
    void testForfaitSurNumerosSerieMoteur() {
        int id = given()
            .contentType("application/json")
            .body("{\"nom\":\"Rappel constructeur\",\"reference\":\"FNS-1\",\"numerosSerieMoteur\":\"7XQ-10*\"}")
            .when().post("/forfaits")
            .then().statusCode(201)
            .body("numerosSerieMoteur", is("7XQ-10*"))
            .extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"nom\":\"Rappel constructeur\",\"reference\":\"FNS-1\",\"numerosSerieMoteur\":\"7XQ-1000000..7XQ-1050000\"}")
            .when().put("/forfaits/" + id)
            .then().statusCode(200)
            .body("numerosSerieMoteur", is("7XQ-1000000..7XQ-1050000"));

        // Un numéro de série couvert par la plage trouve le forfait, un numéro hors plage non
        given().queryParam("q", "7xq-1012345")
            .when().get("/forfaits/search")
            .then().statusCode(200)
            .body("id", hasItem(id));
        given().queryParam("q", "7XQ-1099999")
            .when().get("/forfaits/search")
            .then().statusCode(200)
            .body("id", not(hasItem(id)));
        // Le texte des motifs reste cherchable
        given().queryParam("q", "7xq-10000")
            .when().get("/forfaits/search")
            .then().statusCode(200)
            .body("id", hasItem(id));
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
