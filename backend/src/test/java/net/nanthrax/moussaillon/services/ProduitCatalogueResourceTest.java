package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;

@QuarkusTest
public class ProduitCatalogueResourceTest {

    @Test
    void testListerProduits() {
        given()
            .when().get("/catalogue/produits")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testObtenirProduit() {
        given()
            .when().get("/catalogue/produits/100")
            .then()
            .statusCode(200)
            .body("nom", is("Huile moteur 4T"))
            .body("marque", is("Motul"));
    }

    @Test
    void testObtenirProduitNonTrouve() {
        given()
            .when().get("/catalogue/produits/9999")
            .then()
            .statusCode(404);
    }

    @Test
    void testCreerProduit() {
        given()
            .contentType("application/json")
            .body("{\"nom\":\"Antifouling\",\"marque\":\"International\",\"categorie\":\"Peinture\",\"stock\":10,\"prixVenteTTC\":45.0}")
            .when().post("/catalogue/produits")
            .then()
            .statusCode(200)
            .body("nom", is("Antifouling"))
            .body("id", notNullValue());
    }

    @Test
    void testModifierProduit() {
        int id = given()
            .contentType("application/json")
            .body("{\"nom\":\"AvantUpdate\",\"marque\":\"Test\",\"categorie\":\"Test\"}")
            .when().post("/catalogue/produits")
            .then().statusCode(200).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"nom\":\"ApresUpdate\",\"marque\":\"Test\",\"categorie\":\"Test\"}")
            .when().put("/catalogue/produits/" + id)
            .then()
            .statusCode(200)
            .body("nom", is("ApresUpdate"));
    }

    @Test
    void testRechercherProduits() {
        given()
            .queryParam("q", "huile")
            .when().get("/catalogue/produits/search")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testListerFournisseurs() {
        given()
            .when().get("/catalogue/produits/fournisseurs")
            .then()
            .statusCode(200);
    }

    @Test
    void testAjustementManuelStockCreeMouvement() {
        int id = given()
            .contentType("application/json")
            .body("{\"nom\":\"ProduitAjustement\",\"marque\":\"Test\",\"categorie\":\"Test\",\"stock\":10}")
            .when().post("/catalogue/produits")
            .then().statusCode(200).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"nom\":\"ProduitAjustement\",\"marque\":\"Test\",\"categorie\":\"Test\",\"stock\":7}")
            .when().put("/catalogue/produits/" + id)
            .then().statusCode(200);

        given()
            .when().get("/catalogue/produits/" + id + "/mouvements")
            .then()
            .statusCode(200)
            .body("size()", is(1))
            .body("[0].type", is("AJUSTEMENT_MANUEL"))
            .body("[0].quantite", is(-3))
            .body("[0].stockApres", is(7));
    }

    @Test
    void testStatistiquesApresVente() {
        int id = given()
            .contentType("application/json")
            .body("{\"nom\":\"ProduitStats\",\"marque\":\"Test\",\"categorie\":\"Test\",\"stock\":10,\"prixVenteTTC\":20.0}")
            .when().post("/catalogue/produits")
            .then().statusCode(200).extract().path("id");

        int venteId = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"comptoir\":true,\"prixVenteTTC\":20.0,\"produits\":[{\"id\":" + id + "}],"
                + "\"venteForfaits\":[{\"forfait\":{\"id\":100},\"quantite\":1,\"status\":\"PLANIFIEE\"}]}")
            .when().post("/ventes")
            .then().statusCode(201).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"bonPourAccord\":true,\"comptoir\":true,\"prixVenteTTC\":20.0,\"produits\":[{\"id\":" + id + "}],"
                + "\"venteForfaits\":[{\"forfait\":{\"id\":100},\"quantite\":1,\"status\":\"EN_COURS\"}]}")
            .when().put("/ventes/" + venteId)
            .then().statusCode(200);

        given()
            .when().get("/catalogue/produits/" + id)
            .then()
            .statusCode(200)
            .body("stock", is(9));

        given()
            .when().get("/catalogue/produits/" + id + "/mouvements")
            .then()
            .statusCode(200)
            .body("size()", is(1));

        given()
            .when().get("/catalogue/produits/" + id + "/statistiques")
            .then()
            .statusCode(200)
            .body("quantiteVendueTotal", is(1))
            .body("chiffreAffairesTotal", is(20.0f));
    }

    @Test
    void testSupprimerProduit() {
        int id = given()
            .contentType("application/json")
            .body("{\"nom\":\"ToDelete\",\"marque\":\"Test\",\"categorie\":\"Test\"}")
            .when().post("/catalogue/produits")
            .then().statusCode(200).extract().path("id");

        given()
            .when().delete("/catalogue/produits/" + id)
            .then()
            .statusCode(204);

        given()
            .when().get("/catalogue/produits/" + id)
            .then()
            .statusCode(404);
    }

    @Test
    void testImporterProduitsCsv() {
        String csv = "Code article,Libellé,Type d'article,PV HT,Unité,PV TTC,Code barre,Stock virtuel,Stock réel,Statut,Géré en stock\r\n"
            + "IMP001,Produit Import Test,Bien,\"100,00000\",,\"120,00000\",1234567890123,\"5,00\",\"5,00\",Actif,Coché\r\n"
            + "IMP002,Produit Bloqué,Bien,\"10,00000\",,\"12,00000\",,\"0,00\",\"0,00\",Bloqué,Coché\r\n";

        given()
            .multiPart("file", "produits.csv", csv.getBytes(StandardCharsets.ISO_8859_1), "text/csv")
            .when().post("/catalogue/produits/import")
            .then()
            .statusCode(200)
            .body("total", is(2))
            .body("created", is(1))
            .body("skipped", is(1))
            .body("errors", is(0));

        given()
            .queryParam("q", "Produit Import Test")
            .when().get("/catalogue/produits/search")
            .then()
            .statusCode(200)
            .body("size()", is(1))
            .body("[0].nom", is("Produit Import Test"))
            .body("[0].ref", is("IMP001"))
            .body("[0].prixVenteHT", is(100.0f))
            .body("[0].prixVenteTTC", is(120.0f))
            .body("[0].tva", is(20.0f))
            .body("[0].stock", is(5))
            .body("[0].refs", hasItem("1234567890123"));

        given()
            .queryParam("q", "Produit Bloqu")
            .when().get("/catalogue/produits/search")
            .then()
            .statusCode(200)
            .body("size()", is(0));

        // Ré-importer met à jour le produit existant (retrouvé par Code article) sans le dupliquer.
        String csvMaj = "Code article,Libellé,Type d'article,PV HT,Unité,PV TTC,Code barre,Stock virtuel,Stock réel,Statut,Géré en stock\r\n"
            + "IMP001,Produit Import Test,Bien,\"90,00000\",,\"108,00000\",1234567890123,\"3,00\",\"3,00\",Actif,Coché\r\n";
        given()
            .multiPart("file", "produits.csv", csvMaj.getBytes(StandardCharsets.ISO_8859_1), "text/csv")
            .when().post("/catalogue/produits/import")
            .then()
            .statusCode(200)
            .body("created", is(0))
            .body("updated", is(1));

        given()
            .queryParam("q", "Produit Import Test")
            .when().get("/catalogue/produits/search")
            .then()
            .statusCode(200)
            .body("size()", is(1))
            .body("[0].stock", is(3));
    }

    @Test
    void testImporterProduitsCsvLibellesEnDoublon() {
        String csv = "Code article,Libellé,Type d'article,PV HT,Unité,PV TTC,Code barre,Stock virtuel,Stock réel,Statut,Géré en stock\r\n"
            + "DUP001,VIS,Bien,\"1,00000\",,\"1,20000\",,\"0,00\",\"0,00\",Actif,Coché\r\n"
            + "DUP002,VIS,Bien,\"2,00000\",,\"2,40000\",,\"0,00\",\"0,00\",Actif,Coché\r\n";

        given()
            .multiPart("file", "produits.csv", csv.getBytes(StandardCharsets.ISO_8859_1), "text/csv")
            .when().post("/catalogue/produits/import")
            .then()
            .statusCode(200)
            .body("created", is(2))
            .body("errors", is(0));

        given()
            .queryParam("q", "VIS")
            .when().get("/catalogue/produits/search")
            .then()
            .statusCode(200)
            .body("size()", is(2));
    }

    @Test
    void testImporterProduitsCsvColonneManquante() {
        String csv = "Colonne;Autre\r\nValeur;Valeur2\r\n";

        given()
            .multiPart("file", "invalide.csv", csv.getBytes(StandardCharsets.ISO_8859_1), "text/csv")
            .when().post("/catalogue/produits/import")
            .then()
            .statusCode(400);
    }
}
