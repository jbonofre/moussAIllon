package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;

@QuarkusTest
public class TechnicienPortalResourceTest {

    @Test
    void testConnexionReussie() {
        given()
            .contentType("application/json")
            .body("{\"email\":\"pierre.leclerc@test.com\",\"motDePasse\":\"tech456\"}")
            .when().post("/technicien-portal/login")
            .then()
            .statusCode(200)
            .body("nom", is("Leclerc"))
            .body("token", notNullValue());
    }

    @Test
    void testConnexionEmailManquant() {
        given()
            .contentType("application/json")
            .body("{\"motDePasse\":\"test\"}")
            .when().post("/technicien-portal/login")
            .then()
            .statusCode(400);
    }

    @Test
    void testConnexionEmailInconnu() {
        given()
            .contentType("application/json")
            .body("{\"email\":\"unknown@test.com\",\"motDePasse\":\"test\"}")
            .when().post("/technicien-portal/login")
            .then()
            .statusCode(401);
    }

    @Test
    void testConnexionMotDePasseIncorrect() {
        given()
            .contentType("application/json")
            .body("{\"email\":\"pierre.leclerc@test.com\",\"motDePasse\":\"wrong\"}")
            .when().post("/technicien-portal/login")
            .then()
            .statusCode(401);
    }

    @Test
    void testChangerMotDePasse() {
        given()
            .contentType("application/json")
            .body("{\"technicienId\":100,\"currentPassword\":\"tech456\",\"newPassword\":\"newpass123\"}")
            .when().post("/technicien-portal/change-password")
            .then()
            .statusCode(204);

        // verify new password works for login
        given()
            .contentType("application/json")
            .body("{\"email\":\"pierre.leclerc@test.com\",\"motDePasse\":\"newpass123\"}")
            .when().post("/technicien-portal/login")
            .then()
            .statusCode(200)
            .body("nom", is("Leclerc"))
            .body("token", notNullValue());

        // restore original password
        given()
            .contentType("application/json")
            .body("{\"technicienId\":100,\"currentPassword\":\"newpass123\",\"newPassword\":\"tech456\"}")
            .when().post("/technicien-portal/change-password")
            .then()
            .statusCode(204);
    }

    @Test
    void testChangerMotDePasseActuelIncorrect() {
        given()
            .contentType("application/json")
            .body("{\"technicienId\":100,\"currentPassword\":\"wrong\",\"newPassword\":\"newpass123\"}")
            .when().post("/technicien-portal/change-password")
            .then()
            .statusCode(401);
    }

    @Test
    void testChangerMotDePasseNouveauVide() {
        given()
            .contentType("application/json")
            .body("{\"technicienId\":100,\"currentPassword\":\"tech456\",\"newPassword\":\"\"}")
            .when().post("/technicien-portal/change-password")
            .then()
            .statusCode(400);
    }

    @Test
    void testChangerMotDePasseTechnicienNonTrouve() {
        given()
            .contentType("application/json")
            .body("{\"technicienId\":9999,\"currentPassword\":\"test\",\"newPassword\":\"newpass\"}")
            .when().post("/technicien-portal/change-password")
            .then()
            .statusCode(404);
    }

    @Test
    void testObtenirTachesTechnicien() {
        given()
            .when().get("/technicien-portal/techniciens/100/taches")
            .then()
            .statusCode(200);
    }

    @Test
    void testObtenirTachesTechnicienNonTrouve() {
        given()
            .when().get("/technicien-portal/techniciens/9999/taches")
            .then()
            .statusCode(404);
    }

    @Test
    void testObtenirTachesParc() {
        for (String type : new String[] {"bateaux", "moteurs", "remorques"}) {
            given()
                .when().get("/technicien-portal/parc/" + type + "/9999/taches")
                .then()
                .statusCode(200)
                .body("size()", is(0));
        }
    }

    @Test
    void testObtenirTachesParcTypeInconnu() {
        given()
            .when().get("/technicien-portal/parc/helices/1/taches")
            .then()
            .statusCode(404);
    }

    @Test
    void testModifierForfait() {
        given()
            .contentType("application/json")
            .body("{\"status\":\"EN_COURS\",\"dureeReelle\":1.5,\"notes\":\"En cours de traitement\"}")
            .when().put("/technicien-portal/forfaits/100")
            .then()
            .statusCode(200)
            .body("itemStatus", is("EN_COURS"));
    }

    @Test
    void testLancerForfaitPasseVenteEnFactureEnAttente() {
        io.restassured.response.Response vente = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"bonPourAccord\":true,\"prixVenteTTC\":200.0,"
                + "\"venteForfaits\":[{\"forfait\":{\"id\":100},\"quantite\":1,\"status\":\"PLANIFIEE\"}]}")
            .when().post("/ventes")
            .then().statusCode(201)
            .body("status", is("DEVIS"))
            .extract().response();
        int venteId = vente.path("id");
        int forfaitId = vente.path("venteForfaits[0].id");

        given()
            .contentType("application/json")
            .body("{\"status\":\"EN_COURS\",\"dureeReelle\":0}")
            .when().put("/technicien-portal/forfaits/" + forfaitId)
            .then()
            .statusCode(200)
            .body("itemStatus", is("EN_COURS"))
            .body("venteType", is("FACTURE_EN_ATTENTE"));

        given()
            .when().get("/ventes/" + venteId)
            .then()
            .statusCode(200)
            .body("status", is("FACTURE_EN_ATTENTE"))
            .body("dateFactureEnAttente", notNullValue());
    }

    @Test
    void testHeuresMoteurReporteesSurBateauEtMoteur() {
        int bateauId = given().contentType("application/json").body("{\"name\":\"Bateau heures\"}")
            .when().post("/bateaux").then().statusCode(201).extract().path("id");
        int moteurId = given().contentType("application/json").body("{\"numeroSerie\":\"HM-1\"}")
            .when().post("/moteurs").then().statusCode(200).extract().path("id");
        int forfaitId = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"bonPourAccord\":true,\"prixVenteTTC\":200.0,"
                + "\"bateau\":{\"id\":" + bateauId + "},\"moteur\":{\"id\":" + moteurId + "},"
                + "\"venteForfaits\":[{\"forfait\":{\"id\":100},\"quantite\":1,\"status\":\"PLANIFIEE\"}]}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("venteForfaits[0].id");

        given()
            .contentType("application/json")
            .body("{\"status\":\"EN_COURS\",\"dureeReelle\":1,\"heuresMoteur\":123.5}")
            .when().put("/technicien-portal/forfaits/" + forfaitId)
            .then()
            .statusCode(200)
            .body("heuresMoteur", is(123.5f));

        given().when().get("/bateaux/" + bateauId).then().statusCode(200).body("heuresMoteur", is(123.5f));
        given().when().get("/moteurs/" + moteurId).then().statusCode(200).body("heuresMoteur", is(123.5f));
    }

    @Test
    void testNoteClientEnregistreeSurLaVente() {
        io.restassured.response.Response vente = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"bonPourAccord\":true,\"prixVenteTTC\":200.0,"
                + "\"venteForfaits\":[{\"forfait\":{\"id\":100},\"quantite\":1,\"status\":\"PLANIFIEE\"}],"
                + "\"venteServices\":[{\"service\":{\"id\":100},\"quantite\":1,\"status\":\"PLANIFIEE\"}]}")
            .when().post("/ventes")
            .then().statusCode(201).extract().response();
        int venteId = vente.path("id");
        int forfaitId = vente.path("venteForfaits[0].id");
        int serviceId = vente.path("venteServices[0].id");

        // La note client va sur la vente, la note interne reste sur la prestation
        given()
            .contentType("application/json")
            .body("{\"status\":\"EN_COURS\",\"dureeReelle\":0,\"notes\":\"Pour l'atelier\","
                + "\"noteVente\":\"Oxydation importante au niveau du thermostat, surveillance a prevoir\"}")
            .when().put("/technicien-portal/forfaits/" + forfaitId)
            .then()
            .statusCode(200)
            .body("notes", is("Pour l'atelier"))
            .body("noteVente", is("Oxydation importante au niveau du thermostat, surveillance a prevoir"));

        given().when().get("/ventes/" + venteId).then().statusCode(200)
            .body("note", is("Oxydation importante au niveau du thermostat, surveillance a prevoir"));

        // Sans noteVente, la note reste inchangée ; elle est visible depuis les autres prestations de la vente
        given()
            .contentType("application/json")
            .body("{\"status\":\"EN_COURS\",\"dureeReelle\":0}")
            .when().put("/technicien-portal/services/" + serviceId)
            .then()
            .statusCode(200)
            .body("noteVente", is("Oxydation importante au niveau du thermostat, surveillance a prevoir"));

        // Une note vide efface la note de la vente
        given()
            .contentType("application/json")
            .body("{\"status\":\"EN_COURS\",\"dureeReelle\":0,\"noteVente\":\"  \"}")
            .when().put("/technicien-portal/services/" + serviceId)
            .then()
            .statusCode(200)
            .body("noteVente", nullValue());

        given().when().get("/ventes/" + venteId).then().statusCode(200).body("note", nullValue());
    }

    @Test
    void testNoteClientRefuseeSurVentePayee() {
        // La vente 100 est payée
        given()
            .contentType("application/json")
            .body("{\"status\":\"EN_COURS\",\"dureeReelle\":1.5,\"noteVente\":\"Trop tard\"}")
            .when().put("/technicien-portal/forfaits/100")
            .then()
            .statusCode(400);

        given().when().get("/ventes/100").then().statusCode(200).body("note", nullValue());
    }

    @Test
    void testModifierForfaitNonTrouve() {
        given()
            .contentType("application/json")
            .body("{\"status\":\"EN_COURS\",\"dureeReelle\":1.0}")
            .when().put("/technicien-portal/forfaits/9999")
            .then()
            .statusCode(404);
    }

    @Test
    void testModifierServiceNonTrouve() {
        given()
            .contentType("application/json")
            .body("{\"status\":\"EN_COURS\",\"dureeReelle\":1.0}")
            .when().put("/technicien-portal/services/9999")
            .then()
            .statusCode(404);
    }

    @Test
    void testObtenirCatalogueProduits() {
        given()
            .when().get("/technicien-portal/produits")
            .then()
            .statusCode(200)
            .body("$.size()", org.hamcrest.Matchers.greaterThan(0));
    }

    @Test
    void testAjouterProduitForfait() {
        given()
            .contentType("application/json")
            .body("{\"produitId\":100,\"quantite\":2}")
            .when().post("/technicien-portal/forfaits/100/produits")
            .then()
            .statusCode(200)
            .body("produitsExtra.size()", org.hamcrest.Matchers.greaterThan(0));
    }

    @Test
    void testAjouterProduitForfaitNonTrouve() {
        given()
            .contentType("application/json")
            .body("{\"produitId\":100,\"quantite\":1}")
            .when().post("/technicien-portal/forfaits/9999/produits")
            .then()
            .statusCode(404);
    }

    @Test
    void testAjouterProduitForfaitProduitInconnu() {
        given()
            .contentType("application/json")
            .body("{\"produitId\":9999,\"quantite\":1}")
            .when().post("/technicien-portal/forfaits/100/produits")
            .then()
            .statusCode(404);
    }

    @Test
    void testPlanningGeneral() {
        given()
            .when().get("/technicien-portal/planning-general")
            .then()
            .statusCode(200)
            .body("$", notNullValue());
    }

    @Test
    void testAjouterProduitOccasionNeModifiePasLaTva() {
        int produitId = given()
            .contentType("application/json")
            .body("{\"designation\":\"Test Occasion Technicien\",\"categorie\":\"Divers\",\"occasion\":true,\"prixVenteTTC\":50.0}")
            .when().post("/catalogue/produits")
            .then().statusCode(200).extract().path("id");

        float montantTTCAvant = given().when().get("/ventes/100").then().statusCode(200).extract().path("montantTTC");

        given()
            .contentType("application/json")
            .body("{\"produitId\":" + produitId + ",\"quantite\":2}")
            .when().post("/technicien-portal/forfaits/100/produits")
            .then()
            .statusCode(200);

        // Le TTC augmente du prix des articles d'occasion, mais la TVA ne porte que sur le reste de la vente
        float tvaAttendue = Math.round(montantTTCAvant / 120.0 * 20.0 * 100.0) / 100.0f;
        given()
            .when().get("/ventes/100")
            .then()
            .statusCode(200)
            .body("montantTTC", is(montantTTCAvant + 100.0f))
            .body("montantTVA", is(tvaAttendue));
    }
}
