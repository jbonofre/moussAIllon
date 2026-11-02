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
        int forfaitId = venteAvecForfait("FACTURE_EN_ATTENTE", "EN_COURS").path("venteForfaits[0].id");
        given()
            .contentType("application/json")
            .body("{\"produitId\":100,\"quantite\":2}")
            .when().post("/technicien-portal/forfaits/" + forfaitId + "/produits")
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
        int forfaitId = venteAvecForfait("FACTURE_EN_ATTENTE", "EN_COURS").path("venteForfaits[0].id");
        given()
            .contentType("application/json")
            .body("{\"produitId\":9999,\"quantite\":1}")
            .when().post("/technicien-portal/forfaits/" + forfaitId + "/produits")
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

        io.restassured.response.Response vente = venteAvecForfait("FACTURE_EN_ATTENTE", "EN_COURS");
        int venteId = vente.path("id");
        int forfaitId = vente.path("venteForfaits[0].id");
        float montantTTCAvant = vente.path("montantTTC");

        given()
            .contentType("application/json")
            .body("{\"produitId\":" + produitId + ",\"quantite\":2}")
            .when().post("/technicien-portal/forfaits/" + forfaitId + "/produits")
            .then()
            .statusCode(200);

        // Le TTC augmente du prix des articles d'occasion, mais la TVA ne porte que sur le reste de la vente
        float tvaAttendue = Math.round(montantTTCAvant / 120.0 * 20.0 * 100.0) / 100.0f;
        given()
            .when().get("/ventes/" + venteId)
            .then()
            .statusCode(200)
            .body("montantTTC", is(montantTTCAvant + 100.0f))
            .body("montantTVA", is(tvaAttendue));
    }

    // Vente de 300 € TTC (TVA 20 %) avec un forfait au statut donné ; un forfait terminé a toutes ses tâches cochées
    private static io.restassured.response.Response venteAvecForfait(String statutVente, String statutForfait) {
        return venteAvecForfait(statutVente, statutForfait, "");
    }

    private static io.restassured.response.Response venteAvecForfait(String statutVente, String statutForfait, String champsVente) {
        boolean termine = "TERMINEE".equals(statutForfait);
        return given()
            .contentType("application/json")
            .body("{\"status\":\"" + statutVente + "\",\"bonPourAccord\":true,"
                + "\"montantTTC\":300.0,\"prixVenteTTC\":300.0,\"tva\":20.0," + champsVente
                + "\"venteForfaits\":[{\"forfait\":{\"id\":100},\"quantite\":1,\"status\":\"" + statutForfait + "\","
                + (termine ? "\"dureeReelle\":2.0,\"dateFin\":\"2026-10-30T17:00:00\"," : "")
                + "\"taches\":[{\"nom\":\"Revision moteur\",\"done\":" + termine + "}]}]}")
            .when().post("/ventes")
            .then().statusCode(201).extract().response();
    }

    private static int stockProduit(int produitId) {
        return given().when().get("/catalogue/produits/" + produitId).then().statusCode(200).extract().path("stock");
    }

    private static int nouveauProduit(String designation, int stock) {
        return given()
            .contentType("application/json")
            .body("{\"designation\":\"" + designation + "\",\"categorie\":\"Divers\",\"stock\":" + stock + ",\"prixVenteTTC\":12.0}")
            .when().post("/catalogue/produits")
            .then().statusCode(200).extract().path("id");
    }

    @Test
    void testRouvrirTacheTerminee() {
        int forfaitId = venteAvecForfait("FACTURE_EN_ATTENTE", "TERMINEE").path("venteForfaits[0].id");

        // La tâche repasse en cours : le temps déjà compté et la checklist sont gardés, la date de fin est effacée
        given()
            .when().post("/technicien-portal/forfaits/" + forfaitId + "/rouvrir")
            .then()
            .statusCode(200)
            .body("itemStatus", is("EN_COURS"))
            .body("dureeReelle", is(2.0f))
            .body("dateReouverture", notNullValue())
            .body("dateFin", nullValue())
            .body("taches[0].done", is(true))
            .body("venteType", is("FACTURE_EN_ATTENTE"));

        // Une tâche en cours ne se rouvre pas
        given()
            .when().post("/technicien-portal/forfaits/" + forfaitId + "/rouvrir")
            .then()
            .statusCode(400)
            .body("message", is("Seule une tâche terminée peut être rouverte"));
    }

    @Test
    void testRouvrirServiceTermine() {
        int serviceId = given()
            .contentType("application/json")
            .body("{\"status\":\"FACTURE_EN_ATTENTE\",\"bonPourAccord\":true,\"prixVenteTTC\":276.0,"
                + "\"venteServices\":[{\"service\":{\"id\":100},\"quantite\":1,\"status\":\"TERMINEE\",\"dureeReelle\":1.5}]}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("venteServices[0].id");

        given()
            .when().post("/technicien-portal/services/" + serviceId + "/rouvrir")
            .then()
            .statusCode(200)
            .body("itemStatus", is("EN_COURS"))
            .body("dureeReelle", is(1.5f))
            .body("dateReouverture", notNullValue());
    }

    @Test
    void testRouvrirTacheInconnue() {
        given().when().post("/technicien-portal/forfaits/9999/rouvrir").then().statusCode(404);
        given().when().post("/technicien-portal/services/9999/rouvrir").then().statusCode(404);
    }

    @Test
    void testRouvrirFacturePreteLaRepasseEnAttente() {
        io.restassured.response.Response vente = venteAvecForfait("FACTURE_PRETE", "TERMINEE",
            "\"dateFacturePrete\":\"2026-10-30T18:00:00\",\"niveauRelance\":1,");
        int venteId = vente.path("id");
        int forfaitId = vente.path("venteForfaits[0].id");
        String numero = vente.path("numeroFacture");
        org.junit.jupiter.api.Assertions.assertTrue(numero.startsWith("FA"), numero);

        given()
            .when().post("/technicien-portal/forfaits/" + forfaitId + "/rouvrir")
            .then()
            .statusCode(200)
            .body("venteType", is("FACTURE_EN_ATTENTE"));

        // Le numéro FA est gardé ; la date d'émission et les relances repartiront de la prochaine clôture
        given()
            .when().get("/ventes/" + venteId)
            .then()
            .statusCode(200)
            .body("status", is("FACTURE_EN_ATTENTE"))
            .body("numeroFacture", is(numero))
            .body("dateFacturePrete", nullValue())
            .body("niveauRelance", is(0))
            .body("venteForfaits[0].status", is("EN_COURS"));
    }

    @Test
    void testRouvrirRefuseSurVentePayee() {
        io.restassured.response.Response vente = venteAvecForfait("FACTURE_PAYEE", "TERMINEE");
        int venteId = vente.path("id");
        int forfaitId = vente.path("venteForfaits[0].id");

        given()
            .when().post("/technicien-portal/forfaits/" + forfaitId + "/rouvrir")
            .then()
            .statusCode(400)
            .body("message", is("Une vente payée ne peut plus être modifiée"));

        given().when().get("/ventes/" + venteId).then().statusCode(200)
            .body("status", is("FACTURE_PAYEE"))
            .body("venteForfaits[0].status", is("TERMINEE"));
    }

    @Test
    void testRouvrirRefuseSurFacturePreteDejaReglee() {
        io.restassured.response.Response vente = venteAvecForfait("FACTURE_PRETE", "TERMINEE");
        int venteId = vente.path("id");
        int forfaitId = vente.path("venteForfaits[0].id");
        given()
            .contentType("application/json")
            .body("{\"mode\":\"CHEQUE\",\"montant\":100.0}")
            .when().post("/ventes/" + venteId + "/paiements")
            .then().statusCode(200);

        given()
            .when().post("/technicien-portal/forfaits/" + forfaitId + "/rouvrir")
            .then()
            .statusCode(400)
            .body("message", containsString("déjà reçu un paiement"));

        given().when().get("/ventes/" + venteId).then().statusCode(200)
            .body("status", is("FACTURE_PRETE"))
            .body("venteForfaits[0].status", is("TERMINEE"));
    }

    @Test
    void testQuitterTermineeParMiseAJourSuitLesMemesRegles() {
        // Facture prête : la tâche repasse en cours et la facture en attente, comme avec « Rouvrir »
        int forfaitId = venteAvecForfait("FACTURE_PRETE", "TERMINEE").path("venteForfaits[0].id");
        given()
            .contentType("application/json")
            .body("{\"status\":\"EN_COURS\",\"dureeReelle\":2.0}")
            .when().put("/technicien-portal/forfaits/" + forfaitId)
            .then()
            .statusCode(200)
            .body("itemStatus", is("EN_COURS"))
            .body("dateReouverture", notNullValue())
            .body("venteType", is("FACTURE_EN_ATTENTE"));

        // Vente payée : refusé
        io.restassured.response.Response payee = venteAvecForfait("FACTURE_PAYEE", "TERMINEE");
        given()
            .contentType("application/json")
            .body("{\"status\":\"EN_COURS\",\"dureeReelle\":2.0}")
            .when().put("/technicien-portal/forfaits/" + (int) payee.path("venteForfaits[0].id"))
            .then()
            .statusCode(400)
            .body("message", is("Une vente payée ne peut plus être modifiée"));
        given().when().get("/ventes/" + (int) payee.path("id")).then().statusCode(200)
            .body("venteForfaits[0].status", is("TERMINEE"));
    }

    @Test
    void testPieceAjouteeApresDemarrageSortDuStock() {
        int produitId = nouveauProduit("Anode oubliee", 10);
        io.restassured.response.Response vente = venteAvecForfait("DEVIS", "PLANIFIEE");
        int venteId = vente.path("id");
        int forfaitId = vente.path("venteForfaits[0].id");

        // Le démarrage sort le stock de la vente ; une pièce ajoutée ensuite sort tout de suite
        given().contentType("application/json").body("{\"status\":\"EN_COURS\",\"dureeReelle\":0}")
            .when().put("/technicien-portal/forfaits/" + forfaitId).then().statusCode(200);
        int ligneId = given()
            .contentType("application/json")
            .body("{\"produitId\":" + produitId + ",\"quantite\":2}")
            .when().post("/technicien-portal/forfaits/" + forfaitId + "/produits")
            .then().statusCode(200)
            .extract().path("produitsExtra.find { it.designation == 'Anode oubliee' }.id");

        org.junit.jupiter.api.Assertions.assertEquals(8, stockProduit(produitId));
        given().when().get("/catalogue/produits/" + produitId + "/mouvements").then().statusCode(200)
            .body("size()", is(1))
            .body("[0].type", is("VENTE"))
            .body("[0].quantite", is(2))
            .body("[0].venteId", is(venteId));

        // Retirée, la pièce retourne en stock
        given().when().delete("/technicien-portal/forfaits/" + forfaitId + "/produits/" + ligneId)
            .then().statusCode(200);
        org.junit.jupiter.api.Assertions.assertEquals(10, stockProduit(produitId));
        given().when().get("/catalogue/produits/" + produitId + "/mouvements").then().statusCode(200)
            .body("quantite", hasItems(2, -2));
    }

    @Test
    void testPieceAjouteeAvantDemarrageSortAvecLaVente() {
        int produitId = nouveauProduit("Joint prepare", 10);
        int forfaitId = venteAvecForfait("DEVIS", "PLANIFIEE").path("venteForfaits[0].id");

        given().contentType("application/json").body("{\"produitId\":" + produitId + ",\"quantite\":3}")
            .when().post("/technicien-portal/forfaits/" + forfaitId + "/produits").then().statusCode(200);
        org.junit.jupiter.api.Assertions.assertEquals(10, stockProduit(produitId));

        // Le démarrage sort la pièce avec le reste de la vente, une seule fois, avec son mouvement
        given().contentType("application/json").body("{\"status\":\"EN_COURS\",\"dureeReelle\":0}")
            .when().put("/technicien-portal/forfaits/" + forfaitId).then().statusCode(200);
        given().contentType("application/json").body("{\"status\":\"EN_COURS\",\"dureeReelle\":0.5}")
            .when().put("/technicien-portal/forfaits/" + forfaitId).then().statusCode(200);
        org.junit.jupiter.api.Assertions.assertEquals(7, stockProduit(produitId));
        given().when().get("/catalogue/produits/" + produitId + "/mouvements").then().statusCode(200)
            .body("size()", is(1))
            .body("[0].quantite", is(3));
    }

    @Test
    void testPiecesRefuseesSurVentePayee() {
        // La vente 100 est payée
        given()
            .contentType("application/json")
            .body("{\"produitId\":100,\"quantite\":1}")
            .when().post("/technicien-portal/forfaits/100/produits")
            .then()
            .statusCode(400)
            .body("message", is("Une vente payée ne peut plus être modifiée"));

        given()
            .when().delete("/technicien-portal/forfaits/100/produits/1")
            .then()
            .statusCode(400);
    }
}
