package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;

@QuarkusTest
public class AnnonceResourceTest {

    @Test
    void testListerAnnonces() {
        given()
            .when().get("/annonces")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testObtenirAnnoncesActives() {
        given()
            .when().get("/annonces/active")
            .then()
            .statusCode(200);
    }

    @Test
    void testObtenirAnnonce() {
        given()
            .when().get("/annonces/100")
            .then()
            .statusCode(200)
            .body("titre", is("Vente bateau occasion"));
    }

    @Test
    void testObtenirAnnonceNonTrouvee() {
        given()
            .when().get("/annonces/9999")
            .then()
            .statusCode(404);
    }

    @Test
    void testObtenirAnnoncesParClient() {
        given()
            .when().get("/annonces/client/100")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testCreerAnnonce() {
        given()
            .contentType("application/json")
            .body("{\"titre\":\"Nouvelle annonce\",\"description\":\"Description test\",\"prix\":5000.0,\"contact\":\"Test\",\"telephone\":\"0600000000\"}")
            .when().post("/annonces")
            .then()
            .statusCode(200)
            .body("titre", is("Nouvelle annonce"))
            .body("status", is("ACTIVE"))
            .body("id", notNullValue());
    }

    @Test
    void testModifierAnnonce() {
        int id = given()
            .contentType("application/json")
            .body("{\"titre\":\"AvantUpdate\",\"prix\":1000.0}")
            .when().post("/annonces")
            .then().statusCode(200).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"titre\":\"ApresUpdate\",\"prix\":1200.0,\"status\":\"ACTIVE\"}")
            .when().put("/annonces/" + id)
            .then()
            .statusCode(200)
            .body("titre", is("ApresUpdate"));
    }

    @Test
    void testModifierAnnonceConserveLesPublications() {
        int id = given()
            .contentType("application/json")
            .body("{\"titre\":\"Annonce diffusee\",\"prix\":4000.0}")
            .when().post("/annonces")
            .then().statusCode(200).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"plateforme\":\"LEBONCOIN\"}")
            .when().post("/annonces/" + id + "/publier")
            .then().statusCode(200);

        // Le formulaire de l'annonce n'envoie pas les publications
        given()
            .contentType("application/json")
            .body("{\"titre\":\"Annonce diffusee modifiee\",\"prix\":3800.0,\"status\":\"ACTIVE\"}")
            .when().put("/annonces/" + id)
            .then()
            .statusCode(200)
            .body("publications", hasItem("LEBONCOIN"));

        given()
            .when().get("/annonces/" + id)
            .then()
            .statusCode(200)
            .body("titre", is("Annonce diffusee modifiee"))
            .body("publications", hasItem("LEBONCOIN"));
    }

    @Test
    void testModifierClientAnnonce() {
        int id = given()
            .contentType("application/json")
            .body("{\"titre\":\"Annonce client\",\"prix\":1500.0,\"client\":{\"id\":100}}")
            .when().post("/annonces")
            .then().statusCode(200).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"titre\":\"Annonce client\",\"prix\":1500.0,\"status\":\"ACTIVE\",\"client\":{\"id\":101}}")
            .when().put("/annonces/" + id)
            .then()
            .statusCode(200)
            .body("client.id", is(101))
            .body("client.nom", is("Sophie Martin"));

        given()
            .when().get("/annonces/" + id)
            .then()
            .statusCode(200)
            .body("client.id", is(101));

        // Client retiré du formulaire
        given()
            .contentType("application/json")
            .body("{\"titre\":\"Annonce client\",\"prix\":1500.0,\"status\":\"ACTIVE\"}")
            .when().put("/annonces/" + id)
            .then()
            .statusCode(200)
            .body("client", nullValue());
    }

    @Test
    void testModifierAnnonceClientInconnu() {
        given()
            .contentType("application/json")
            .body("{\"titre\":\"Vente bateau occasion\",\"prix\":18000.0,\"status\":\"ACTIVE\",\"client\":{\"id\":9999}}")
            .when().put("/annonces/100")
            .then()
            .statusCode(404);
    }

    @Test
    void testPublierAnnonce() {
        int id = given()
            .contentType("application/json")
            .body("{\"titre\":\"Annonce a publier\",\"prix\":3000.0}")
            .when().post("/annonces")
            .then().statusCode(200).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"plateforme\":\"LEBONCOIN\"}")
            .when().post("/annonces/" + id + "/publier")
            .then()
            .statusCode(200);
    }

    @Test
    void testPublierAnnonceAvecBateau() {
        int bateauId = given()
            .contentType("application/json")
            .body("{\"name\":\"Bateau annonce\",\"modele\":{\"id\":100},\"moteurs\":[{\"id\":100}]}")
            .when().post("/bateaux")
            .then().statusCode(201).extract().path("id");
        int id = given()
            .contentType("application/json")
            .body("{\"titre\":\"Annonce avec bateau\",\"prix\":9000.0,\"bateau\":{\"id\":" + bateauId + "}}")
            .when().post("/annonces")
            .then().statusCode(200).extract().path("id");

        // La réponse sérialise le bateau et ses collections chargées à la demande
        given()
            .contentType("application/json")
            .body("{\"plateforme\":\"LEBONCOIN\"}")
            .when().post("/annonces/" + id + "/publier")
            .then()
            .statusCode(200)
            .body("publications", hasItem("LEBONCOIN"))
            .body("bateau.modele.designation", is("Quicksilver 505"));

        given()
            .contentType("application/json")
            .body("{\"plateforme\":\"LEBONCOIN\"}")
            .when().post("/annonces/" + id + "/depublier")
            .then()
            .statusCode(200)
            .body("bateau.name", is("Bateau annonce"));
    }

    @Test
    void testAnnonceAvecMoteur() {
        int moteurId = given()
            .contentType("application/json")
            .body("{\"numeroSerie\":\"MOT-ANNONCE\"}")
            .when().post("/moteurs")
            .then().statusCode(200).extract().path("id");
        int id = given()
            .contentType("application/json")
            .body("{\"titre\":\"Moteur a vendre\",\"prix\":3000.0,\"moteur\":{\"id\":" + moteurId + "}}")
            .when().post("/annonces")
            .then()
            .statusCode(200)
            .body("moteur.id", is(moteurId))
            .extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"titre\":\"Moteur a vendre\",\"prix\":2500.0,\"status\":\"ACTIVE\",\"moteur\":{\"id\":" + moteurId + "}}")
            .when().put("/annonces/" + id)
            .then()
            .statusCode(200)
            .body("moteur.numeroSerie", is("MOT-ANNONCE"));

        // La suppression du moteur conserve l'annonce, sans le moteur
        given()
            .when().delete("/moteurs/" + moteurId)
            .then()
            .statusCode(204);
        given()
            .when().get("/annonces/" + id)
            .then()
            .statusCode(200)
            .body("moteur", nullValue());
    }

    @Test
    void testPublierAnnoncePlateformeManquante() {
        given()
            .contentType("application/json")
            .body("{}")
            .when().post("/annonces/100/publier")
            .then()
            .statusCode(400);
    }

    @Test
    void testDepublierAnnonce() {
        // Create and publish first
        int id = given()
            .contentType("application/json")
            .body("{\"titre\":\"Annonce depublier\",\"prix\":2000.0}")
            .when().post("/annonces")
            .then().statusCode(200).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"plateforme\":\"LEBONCOIN\"}")
            .when().post("/annonces/" + id + "/publier")
            .then().statusCode(200);

        given()
            .contentType("application/json")
            .body("{\"plateforme\":\"LEBONCOIN\"}")
            .when().post("/annonces/" + id + "/depublier")
            .then()
            .statusCode(200);
    }

    @Test
    void testSupprimerAnnonce() {
        int id = given()
            .contentType("application/json")
            .body("{\"titre\":\"ToDelete\",\"prix\":500.0}")
            .when().post("/annonces")
            .then().statusCode(200).extract().path("id");

        given()
            .when().delete("/annonces/" + id)
            .then()
            .statusCode(204);

        given()
            .when().get("/annonces/" + id)
            .then()
            .statusCode(404);
    }
}
