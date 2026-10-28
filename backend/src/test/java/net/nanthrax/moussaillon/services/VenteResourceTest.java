package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;

@QuarkusTest
public class VenteResourceTest {

    @Test
    void testListerVentes() {
        given()
            .when().get("/ventes")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testObtenirVente() {
        given()
            .when().get("/ventes/100")
            .then()
            .statusCode(200)
            .body("status", is("FACTURE_PAYEE"));
    }

    @Test
    void testObtenirVenteNonTrouvee() {
        given()
            .when().get("/ventes/9999")
            .then()
            .statusCode(404);
    }

    @Test
    void testCreerVente() {
        given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":100.0,\"montantTTC\":100.0}")
            .when().post("/ventes")
            .then()
            .statusCode(201)
            .body("status", is("DEVIS"))
            .body("id", notNullValue());
    }

    @Test
    void testModifierVente() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":200.0}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"status\":\"FACTURE_EN_ATTENTE\",\"bonPourAccord\":true,\"prixVenteTTC\":200.0,\"remise\":10.0}")
            .when().put("/ventes/" + id)
            .then()
            .statusCode(200)
            .body("status", is("FACTURE_EN_ATTENTE"))
            .body("bonPourAccord", is(true));
    }

    @Test
    void testRechercherVentesParStatut() {
        given()
            .queryParam("status", "FACTURE_PAYEE")
            .when().get("/ventes/search")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testRechercherVentesStatutInvalide() {
        given()
            .queryParam("status", "INVALID")
            .when().get("/ventes/search")
            .then()
            .statusCode(400);
    }

    @Test
    void testRechercherVentesSansFiltre() {
        given()
            .when().get("/ventes/search")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testSupprimerVente() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":50.0}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        given()
            .when().delete("/ventes/" + id)
            .then()
            .statusCode(204);

        given()
            .when().get("/ventes/" + id)
            .then()
            .statusCode(404);
    }

    @Test
    void testSupprimerVenteNonTrouvee() {
        given()
            .when().delete("/ventes/9999")
            .then()
            .statusCode(404);
    }

    @Test
    void testCreerVenteAvecRappels() {
        given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":300.0,\"rappel1Jours\":30,\"rappel2Jours\":7,\"rappel3Jours\":1}")
            .when().post("/ventes")
            .then()
            .statusCode(201)
            .body("rappel1Jours", is(30))
            .body("rappel2Jours", is(7))
            .body("rappel3Jours", is(1))
            .body("rappel1Envoye", is(false))
            .body("rappel2Envoye", is(false))
            .body("rappel3Envoye", is(false));
    }

    @Test
    void testModifierRappelsVente() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":200.0}")
            .when().post("/ventes")
            .then().statusCode(201)
            .body("rappel1Jours", nullValue())
            .extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":200.0,\"rappel1Jours\":14,\"rappel2Jours\":3}")
            .when().put("/ventes/" + id)
            .then()
            .statusCode(200)
            .body("rappel1Jours", is(14))
            .body("rappel2Jours", is(3))
            .body("rappel3Jours", nullValue());
    }

    @Test
    void testModifierRappelsResetDrapeauEnvoi() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":200.0,\"rappel1Jours\":30}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":200.0,\"rappel1Jours\":15}")
            .when().put("/ventes/" + id)
            .then()
            .statusCode(200)
            .body("rappel1Jours", is(15))
            .body("rappel1Envoye", is(false));
    }

    @Test
    void testCreerVenteSansRappels() {
        given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":50.0}")
            .when().post("/ventes")
            .then()
            .statusCode(201)
            .body("rappel1Jours", nullValue())
            .body("rappel2Jours", nullValue())
            .body("rappel3Jours", nullValue());
    }

    @Test
    void testEnvoyerRappelManuel() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":100.0,\"client\":{\"id\":100}}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        given()
            .contentType("application/json")
            .when().post("/ventes/" + id + "/rappel")
            .then()
            .statusCode(200);

        // Verifier que l'historique a ete cree
        given()
            .when().get("/rappels/vente/" + id)
            .then()
            .statusCode(200)
            .body("size()", is(1))
            .body("[0].numeroRappel", is(0))
            .body("[0].destinataire", is("jean.dupont@test.com"));
    }

    @Test
    void testEnvoyerRappelManuelVenteNonTrouvee() {
        given()
            .contentType("application/json")
            .when().post("/ventes/9999/rappel")
            .then()
            .statusCode(404);
    }

    @Test
    void testEnvoyerRappelManuelSansEmailClient() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":100.0}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        given()
            .contentType("application/json")
            .when().post("/ventes/" + id + "/rappel")
            .then()
            .statusCode(400);
    }

    @Test
    void testBonPourAccordRequisPourPlanification() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":200.0,\"bonPourAccord\":false}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        // Trying to set a forfait to PLANIFIEE without bonPourAccord should fail
        given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"bonPourAccord\":false,\"prixVenteTTC\":200.0,\"venteForfaits\":[{\"forfait\":{\"id\":100},\"quantite\":1,\"status\":\"PLANIFIEE\"}]}")
            .when().put("/ventes/" + id)
            .then()
            .statusCode(400);
    }

    @Test
    void testPrestationLanceePasseEnFactureEnAttente() {
        String body = "{\"status\":\"DEVIS\",\"bonPourAccord\":true,\"prixVenteTTC\":200.0,"
                + "\"venteForfaits\":[{\"forfait\":{\"id\":100},\"quantite\":1,\"status\":\"%s\"}]}";

        int id = given()
            .contentType("application/json")
            .body(String.format(body, "PLANIFIEE"))
            .when().post("/ventes")
            .then().statusCode(201)
            .body("status", is("DEVIS"))
            .extract().path("id");

        given()
            .contentType("application/json")
            .body(String.format(body, "EN_COURS"))
            .when().put("/ventes/" + id)
            .then()
            .statusCode(200)
            .body("status", is("FACTURE_EN_ATTENTE"))
            .body("dateFactureEnAttente", notNullValue());
    }

    // --- Numérotation et champs légaux ---

    @Test
    void testGenererNumeroFactureAutomatique() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":150.0}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"status\":\"FACTURE_PRETE\",\"prixVenteTTC\":150.0}")
            .when().put("/ventes/" + id)
            .then()
            .statusCode(200)
            .body("status", is("FACTURE_PRETE"))
            .body("numeroFacture", notNullValue())
            .body("numeroFacture", startsWith("FACT-"));
    }

    @Test
    void testNumeroFactureImmuable() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":150.0}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        String numero = given()
            .contentType("application/json")
            .body("{\"status\":\"FACTURE_PRETE\",\"prixVenteTTC\":150.0}")
            .when().put("/ventes/" + id)
            .then().statusCode(200).extract().path("numeroFacture");

        // Deuxième mise à jour : le numéro ne doit pas changer
        given()
            .contentType("application/json")
            .body("{\"status\":\"FACTURE_PRETE\",\"prixVenteTTC\":200.0}")
            .when().put("/ventes/" + id)
            .then()
            .statusCode(200)
            .body("numeroFacture", is(numero));
    }

    @Test
    void testModifierVenteAvecChampsPaiementLegaux() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":300.0}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":300.0,"
                + "\"dateEcheance\":\"2026-12-31\","
                + "\"conditionsPaiement\":\"30 jours nets\","
                + "\"penalitesRetard\":\"3 fois le taux légal\","
                + "\"indemniteForfaitaire\":45.0}")
            .when().put("/ventes/" + id)
            .then()
            .statusCode(200)
            .body("conditionsPaiement", is("30 jours nets"))
            .body("penalitesRetard", is("3 fois le taux légal"))
            .body("indemniteForfaitaire", is(45.0f))
            .body("dateEcheance", notNullValue());
    }

    @Test
    void testIndemniteForfaitaireDefaut() {
        given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":100.0}")
            .when().post("/ventes")
            .then()
            .statusCode(201)
            .body("indemniteForfaitaire", is(40.0f));
    }

    // --- Endpoint Factur-X ---

    @Test
    void testTelechargerFacturXVentePayee() {
        given()
            .when().get("/ventes/100/facturx")
            .then()
            .statusCode(200)
            .contentType("application/pdf")
            .header("Content-Disposition", containsString("attachment"));
    }

    @Test
    void testTelechargerFacturXVentePrete() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":120.0}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"status\":\"FACTURE_PRETE\",\"prixVenteTTC\":120.0}")
            .when().put("/ventes/" + id)
            .then().statusCode(200);

        given()
            .when().get("/ventes/" + id + "/facturx")
            .then()
            .statusCode(200)
            .contentType("application/pdf")
            .header("Content-Disposition", containsString("attachment"));
    }

    @Test
    void testTelechargerFacturXVenteNonTrouvee() {
        given()
            .when().get("/ventes/9999/facturx")
            .then()
            .statusCode(404);
    }

    @Test
    void testTelechargerFacturXStatutInvalide() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":100.0}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        given()
            .when().get("/ventes/" + id + "/facturx")
            .then()
            .statusCode(400);
    }

    @Test
    void testDecrementStock() {
        int stockAvant = given()
            .when().get("/catalogue/produits/100")
            .then().statusCode(200).extract().path("stock");

        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"comptoir\":true,\"prixVenteTTC\":24.0,\"produits\":[{\"id\":100}]}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"status\":\"FACTURE_PRETE\",\"comptoir\":true,\"prixVenteTTC\":24.0,\"produits\":[{\"id\":100}]}")
            .when().put("/ventes/" + id)
            .then().statusCode(200);

        int stockApres = given()
            .when().get("/catalogue/produits/100")
            .then().statusCode(200).extract().path("stock");

        org.junit.jupiter.api.Assertions.assertEquals(stockAvant - 1, stockApres);
    }

    private static String venteAvecLignesLibres(String... articles) {
        StringBuilder lignes = new StringBuilder();
        for (String article : articles) {
            if (lignes.length() > 0) lignes.append(',');
            lignes.append("{\"quantite\":2,\"remise\":1.0,\"produit\":").append(article).append('}');
        }
        return "{\"status\":\"DEVIS\",\"comptoir\":true,\"prixVenteTTC\":23.0,\"venteProduits\":[" + lignes + "]}";
    }

    @Test
    void testLigneLibreCreeArticleAuCatalogue() {
        String designation = "Manille inox " + System.nanoTime();
        String ref = "MAN-" + System.nanoTime();

        int produitId = given()
            .contentType("application/json")
            .body(venteAvecLignesLibres("{\"ref\":\" " + ref + " \",\"designation\":\" " + designation + " \",\"prixVenteTTC\":12.0,\"tva\":20.0}"))
            .when().post("/ventes")
            .then()
            .statusCode(201)
            .body("venteProduits[0].quantite", is(2))
            .body("venteProduits[0].remise", is(1.0f))
            .body("venteProduits[0].produit.designation", is(designation))
            .extract().path("venteProduits[0].produit.id");

        given()
            .when().get("/catalogue/produits/" + produitId)
            .then()
            .statusCode(200)
            .body("ref", is(ref))
            .body("designation", is(designation))
            .body("categorie", is("Non classé"))
            .body("prixVenteTTC", is(12.0f))
            .body("tva", is(20.0f))
            .body("montantTVA", is(2.0f))
            .body("prixVenteHT", is(10.0f))
            .body("stock", is(0));
    }

    @Test
    void testLigneLibreSansReferenceGenereLaReference() {
        given()
            .contentType("application/json")
            .body(venteAvecLignesLibres("{\"designation\":\"Bout amarrage " + System.nanoTime() + "\",\"prixVenteTTC\":11.0,\"tva\":10.0}"))
            .when().post("/ventes")
            .then()
            .statusCode(201)
            .body("venteProduits[0].produit.ref", startsWith("PRD-"))
            .body("venteProduits[0].produit.montantTVA", is(1.0f))
            .body("venteProduits[0].produit.prixVenteHT", is(10.0f));
    }

    @Test
    void testLigneLibreAjouteeEnModification() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"comptoir\":true,\"prixVenteTTC\":24.0,\"venteProduits\":[{\"quantite\":1,\"produit\":{\"id\":100}}]}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        String designation = "Gaffe telescopique " + System.nanoTime();
        given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"comptoir\":true,\"prixVenteTTC\":59.0,\"venteProduits\":["
                + "{\"quantite\":1,\"produit\":{\"id\":100}},"
                + "{\"quantite\":1,\"produit\":{\"designation\":\"" + designation + "\",\"prixVenteTTC\":35.0,\"tva\":20.0}}]}")
            .when().put("/ventes/" + id)
            .then()
            .statusCode(200)
            .body("venteProduits.size()", is(2))
            .body("venteProduits.produit.designation", hasItem(designation));

        given()
            .when().get("/ventes/" + id)
            .then()
            .statusCode(200)
            .body("venteProduits.produit.designation", hasItem(designation))
            .body("venteProduits.find { it.produit.designation == '" + designation + "' }.produit.id", notNullValue());
    }

    @Test
    void testLigneLibreDesignationDejaAuCatalogueAcceptee() {
        given()
            .contentType("application/json")
            .body(venteAvecLignesLibres("{\"designation\":\"motul huile moteur 4T\",\"prixVenteTTC\":30.0,\"tva\":20.0}"))
            .when().post("/ventes")
            .then()
            .statusCode(201)
            .body("venteProduits[0].produit.id", notNullValue())
            .body("venteProduits[0].produit.ref", startsWith("PRD-"));
    }

    @Test
    void testLigneLibreReferenceDejaAuCatalogueRefusee() {
        String ref = "DUP-" + System.nanoTime();
        given()
            .contentType("application/json")
            .body(venteAvecLignesLibres("{\"ref\":\"" + ref + "\",\"designation\":\"Article A " + System.nanoTime() + "\",\"prixVenteTTC\":5.0,\"tva\":20.0}"))
            .when().post("/ventes")
            .then().statusCode(201);

        given()
            .contentType("application/json")
            .body(venteAvecLignesLibres("{\"ref\":\"" + ref.toLowerCase() + "\",\"designation\":\"Article B " + System.nanoTime() + "\",\"prixVenteTTC\":5.0,\"tva\":20.0}"))
            .when().post("/ventes")
            .then()
            .statusCode(400)
            .body("message", containsString("déjà utilisée"));
    }

    @Test
    void testLignesLibresDeMemeDesignationCreentChacuneUnArticle() {
        String designation = "Defense cylindrique " + System.nanoTime();
        String article = "{\"designation\":\"" + designation + "\",\"prixVenteTTC\":20.0,\"tva\":20.0}";

        given()
            .contentType("application/json")
            .body(venteAvecLignesLibres(article, article))
            .when().post("/ventes")
            .then()
            .statusCode(201)
            .body("venteProduits.size()", is(2))
            .body("venteProduits[0].produit.ref", notNullValue())
            .body("venteProduits[0].produit.id", notNullValue());

        given()
            .queryParam("q", designation)
            .when().get("/catalogue/produits/search")
            .then()
            .statusCode(200)
            .body("size()", is(2));
    }

    @Test
    void testLigneLibreSansDesignationRefusee() {
        given()
            .contentType("application/json")
            .body(venteAvecLignesLibres("{\"ref\":\"SANS-DESIGNATION\",\"designation\":\"  \",\"prixVenteTTC\":5.0,\"tva\":20.0}"))
            .when().post("/ventes")
            .then()
            .statusCode(400)
            .body("message", containsString("désignation"));
    }

    @Test
    void testPassageEnPayeeRefuseSansPaiement() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"FACTURE_PRETE\",\"comptoir\":true,\"prixVenteTTC\":24.0,\"produits\":[{\"id\":100}]}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"status\":\"FACTURE_PAYEE\",\"comptoir\":true,\"prixVenteTTC\":24.0,\"produits\":[{\"id\":100}]}")
            .when().put("/ventes/" + id)
            .then().statusCode(400)
            .body("message", org.hamcrest.Matchers.containsString("solde dû"));

        given().when().get("/ventes/" + id).then().statusCode(200).body("status", is("FACTURE_PRETE"));
    }

    @Test
    void testPassageAutomatiqueEnPayeeQuandSoldeAZero() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"FACTURE_PRETE\",\"comptoir\":true,\"prixVenteTTC\":24.0,\"produits\":[{\"id\":100}]}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"mode\":\"CARTE\",\"montant\":10.0}")
            .when().post("/ventes/" + id + "/paiements")
            .then().statusCode(200);
        given().when().get("/ventes/" + id).then().statusCode(200).body("status", is("FACTURE_PRETE"));

        given()
            .contentType("application/json")
            .body("{\"mode\":\"ESPÈCES\",\"montant\":14.0}")
            .when().post("/ventes/" + id + "/paiements")
            .then().statusCode(200);
        given().when().get("/ventes/" + id).then().statusCode(200)
            .body("status", is("FACTURE_PAYEE"))
            .body("dateFacturePayee", org.hamcrest.Matchers.notNullValue());
    }

    @Test
    void testPaiementDateFutureBloquePassageEnPayee() {
        int id = given()
            .contentType("application/json")
            .body("{\"status\":\"FACTURE_PRETE\",\"comptoir\":true,\"prixVenteTTC\":24.0,\"produits\":[{\"id\":100}]}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        String futur = java.time.LocalDateTime.now().plusDays(10).withNano(0).format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        int paiementId = given()
            .contentType("application/json")
            .body("{\"mode\":\"VIREMENT\",\"montant\":24.0,\"date\":\"" + futur + "\"}")
            .when().post("/ventes/" + id + "/paiements")
            .then().statusCode(200).body("date", is(futur)).extract().path("id");
        given().when().get("/ventes/" + id).then().statusCode(200).body("status", is("FACTURE_PRETE"));

        given()
            .contentType("application/json")
            .body("{\"status\":\"FACTURE_PAYEE\",\"comptoir\":true,\"prixVenteTTC\":24.0,\"produits\":[{\"id\":100}]}")
            .when().put("/ventes/" + id)
            .then().statusCode(400)
            .body("message", org.hamcrest.Matchers.containsString("futur"));

        String passe = java.time.LocalDateTime.now().minusDays(1).withNano(0).format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        given()
            .contentType("application/json")
            .body("{\"date\":\"" + passe + "\"}")
            .when().put("/ventes/" + id + "/paiements/" + paiementId)
            .then().statusCode(200).body("date", is(passe));
        given().when().get("/ventes/" + id).then().statusCode(200).body("status", is("FACTURE_PAYEE"));
    }

    // --- Parc client ---

    private int vendre(String lignes) {
        String corps = "{\"status\":\"%s\",\"client\":{\"id\":100},\"prixVenteTTC\":100.0," + lignes + "}";
        int id = given().contentType("application/json")
            .body(String.format(corps, "DEVIS"))
            .when().post("/ventes").then().statusCode(201).extract().path("id");
        given().contentType("application/json")
            .body(String.format(corps, "FACTURE_PRETE"))
            .when().put("/ventes/" + id).then().statusCode(200);
        return id;
    }

    private int taille(String chemin) {
        return given().when().get(chemin).then().statusCode(200).extract().path("size()");
    }

    @Test
    void testVenteBateauMoteurAjouteBateauAuParc() {
        int bateaux = taille("/bateaux");
        int moteurs = taille("/moteurs");
        vendre("\"venteBateauxCatalogue\":[{\"bateau\":{\"id\":100},\"quantite\":1}],"
            + "\"venteMoteursCatalogue\":[{\"moteur\":{\"id\":100},\"quantite\":1}]");
        org.junit.jupiter.api.Assertions.assertEquals(bateaux + 1, taille("/bateaux"));
        // le moteur est porté par le bateau, pas ajouté seul
        org.junit.jupiter.api.Assertions.assertEquals(moteurs, taille("/moteurs"));
    }

    @Test
    void testVenteMoteurSeulAjouteMoteurAuParc() {
        int bateaux = taille("/bateaux");
        int moteurs = taille("/moteurs");
        vendre("\"venteMoteursCatalogue\":[{\"moteur\":{\"id\":100},\"quantite\":1}]");
        org.junit.jupiter.api.Assertions.assertEquals(moteurs + 1, taille("/moteurs"));
        org.junit.jupiter.api.Assertions.assertEquals(bateaux, taille("/bateaux"));
    }

    @Test
    void testVenteRemorqueAjouteRemorqueAuParc() {
        int remorques = taille("/remorques");
        vendre("\"venteRemorquesCatalogue\":[{\"remorque\":{\"id\":100},\"quantite\":1}]");
        org.junit.jupiter.api.Assertions.assertEquals(remorques + 1, taille("/remorques"));
    }

    @Test
    void testVenteBateauMoteurHeliceAjouteHeliceAuBateauClient() {
        int id = vendre("\"venteBateauxCatalogue\":[{\"bateau\":{\"id\":100},\"quantite\":1}],"
            + "\"venteMoteursCatalogue\":[{\"moteur\":{\"id\":100},\"quantite\":1}],"
            + "\"venteHelicesCatalogue\":[{\"helice\":{\"id\":100},\"quantite\":1}]");
        given().when().get("/bateaux")
            .then().statusCode(200)
            .body("findAll { it.helices.size() > 0 }.helices.flatten().id", hasItem(100));
    }

    @Test
    void testPretARecupererPoseEtAnnule() {
        int remorqueId = given()
            .contentType("application/json")
            .body("{\"immatriculation\":\"REM-PRET\"}")
            .when().post("/remorques")
            .then().statusCode(200).extract().path("id");

        String body = "{\"status\":\"DEVIS\",\"bonPourAccord\":true,\"prixVenteTTC\":200.0,"
                + "\"remorque\":{\"id\":" + remorqueId + "},"
                + "\"venteForfaits\":[{\"forfait\":{\"id\":100},\"quantite\":1,\"status\":\"%s\"}]}";

        int id = given()
            .contentType("application/json")
            .body(String.format(body, "EN_COURS"))
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        given().when().get("/ventes/" + id).then().body("datePretRecuperation", nullValue());

        given()
            .contentType("application/json")
            .body(String.format(body, "TERMINEE"))
            .when().put("/ventes/" + id)
            .then().statusCode(200)
            .body("datePretRecuperation", notNullValue());

        given().when().get("/remorques/" + remorqueId)
            .then().body("datePretRecuperation", notNullValue());

        given().when().post("/ventes/" + id + "/recupere")
            .then().statusCode(204);

        given().when().get("/ventes/" + id)
            .then().body("datePretRecuperation", nullValue());

        given().when().get("/remorques/" + remorqueId)
            .then().body("datePretRecuperation", nullValue());
    }

}
