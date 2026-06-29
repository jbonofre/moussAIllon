package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;

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
}
