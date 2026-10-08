package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.startsWith;

@QuarkusTest
public class PackageResourceTest {

    private static final String LIGNES_COMPLETES = "["
        + "{\"bateau\":{\"id\":100},\"quantite\":1},"
        + "{\"moteur\":{\"id\":100},\"quantite\":1},"
        + "{\"helice\":{\"id\":100},\"quantite\":1},"
        + "{\"remorque\":{\"id\":100},\"quantite\":1},"
        + "{\"produit\":{\"id\":100},\"quantite\":4}"
        + "]";

    private int creer(String designation, String lignes) {
        return given()
            .contentType("application/json")
            .body("{\"designation\":\"" + designation + "\",\"lignes\":" + lignes + "}")
            .when().post("/catalogue/packages")
            .then().statusCode(201)
            .extract().path("id");
    }

    @Test
    void testCreerPackage() {
        given()
            .contentType("application/json")
            .body("{\"designation\":\"Pack pret a naviguer\",\"description\":\"Bateau, moteur et remorque\",\"lignes\":" + LIGNES_COMPLETES + "}")
            .when().post("/catalogue/packages")
            .then()
            .statusCode(201)
            .body("id", notNullValue())
            .body("designation", is("Pack pret a naviguer"))
            .body("ref", startsWith("PKG-"))
            .body("lignes.size()", is(5))
            .body("lignes[1].moteur.designation", is("Mercury 115 EFI"))
            .body("lignes[2].helice.designation", is("Mercury Vengeance 14x19"))
            .body("lignes[4].produit.designation", is("Motul Huile moteur 4T"))
            .body("lignes[4].quantite", is(4));
    }

    @Test
    void testObtenirPackage() {
        int id = creer("Pack a relire", LIGNES_COMPLETES);

        given()
            .when().get("/catalogue/packages/" + id)
            .then()
            .statusCode(200)
            .body("designation", is("Pack a relire"))
            .body("lignes.size()", is(5));
    }

    @Test
    void testObtenirPackageNonTrouve() {
        given()
            .when().get("/catalogue/packages/9999")
            .then()
            .statusCode(404);
    }

    @Test
    void testListerEtRechercherPackages() {
        creer("Pack Recherche Zodiac", "[]");

        given()
            .when().get("/catalogue/packages")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));

        given()
            .queryParam("q", "zodiac")
            .when().get("/catalogue/packages/search")
            .then()
            .statusCode(200)
            .body("designation", hasItem("Pack Recherche Zodiac"));

        given()
            .queryParam("q", "aucun package ne porte ce nom")
            .when().get("/catalogue/packages/search")
            .then()
            .statusCode(200)
            .body("size()", is(0));
    }

    @Test
    void testCreerPackageSansDesignation() {
        given()
            .contentType("application/json")
            .body("{\"designation\":\" \",\"lignes\":[]}")
            .when().post("/catalogue/packages")
            .then()
            .statusCode(400);
    }

    @Test
    void testCreerPackageAvecArticleInconnu() {
        given()
            .contentType("application/json")
            .body("{\"designation\":\"Pack article inconnu\",\"lignes\":[{\"produit\":{\"id\":9999},\"quantite\":1}]}")
            .when().post("/catalogue/packages")
            .then()
            .statusCode(400);
    }

    @Test
    void testCreerPackageAvecLigneSansArticle() {
        given()
            .contentType("application/json")
            .body("{\"designation\":\"Pack ligne vide\",\"lignes\":[{\"quantite\":2}]}")
            .when().post("/catalogue/packages")
            .then()
            .statusCode(400);
    }

    @Test
    void testCreerPackageAvecLigneDesignantDeuxArticles() {
        given()
            .contentType("application/json")
            .body("{\"designation\":\"Pack ligne double\",\"lignes\":[{\"produit\":{\"id\":100},\"bateau\":{\"id\":100},\"quantite\":1}]}")
            .when().post("/catalogue/packages")
            .then()
            .statusCode(400);
    }

    @Test
    void testQuantiteMinimaleDUneLigne() {
        given()
            .contentType("application/json")
            .body("{\"designation\":\"Pack quantite nulle\",\"lignes\":[{\"produit\":{\"id\":100},\"quantite\":0}]}")
            .when().post("/catalogue/packages")
            .then()
            .statusCode(201)
            .body("lignes[0].quantite", is(1));
    }

    @Test
    void testModifierPackage() {
        int id = creer("Pack AvantUpdate", LIGNES_COMPLETES);

        given()
            .contentType("application/json")
            .body("{\"designation\":\"Pack ApresUpdate\",\"ref\":\"PKG-MAJ\",\"lignes\":[{\"produit\":{\"id\":101},\"quantite\":3}]}")
            .when().put("/catalogue/packages/" + id)
            .then()
            .statusCode(200)
            .body("designation", is("Pack ApresUpdate"))
            .body("ref", is("PKG-MAJ"))
            .body("lignes.size()", is(1))
            .body("lignes[0].produit.id", is(101))
            .body("lignes[0].quantite", is(3));

        given()
            .when().get("/catalogue/packages/" + id)
            .then()
            .statusCode(200)
            .body("lignes.size()", is(1));
    }

    @Test
    void testModifierPackageNonTrouve() {
        given()
            .contentType("application/json")
            .body("{\"designation\":\"Pack fantome\",\"lignes\":[]}")
            .when().put("/catalogue/packages/9999")
            .then()
            .statusCode(404);
    }

    @Test
    void testSupprimerPackage() {
        int id = creer("Pack ToDelete", LIGNES_COMPLETES);

        given()
            .when().delete("/catalogue/packages/" + id)
            .then()
            .statusCode(204);

        given()
            .when().get("/catalogue/packages/" + id)
            .then()
            .statusCode(404);

        // les articles du catalogue ne sont pas supprimés avec le package
        given().when().get("/catalogue/bateaux/100").then().statusCode(200);
        given().when().get("/catalogue/produits/100").then().statusCode(200);
    }

    @Test
    void testSupprimerUnArticleLeRetireDesPackages() {
        int heliceId = given()
            .contentType("application/json")
            .body("{\"designation\":\"Helice du package\"}")
            .when().post("/catalogue/helices")
            .then().statusCode(200).extract().path("id");
        int produitId = given()
            .contentType("application/json")
            .body("{\"designation\":\"Produit du package\",\"categorie\":\"Divers\"}")
            .when().post("/catalogue/produits")
            .then().statusCode(200).extract().path("id");
        int id = creer("Pack article supprime", "["
            + "{\"helice\":{\"id\":" + heliceId + "},\"quantite\":1},"
            + "{\"produit\":{\"id\":" + produitId + "},\"quantite\":2},"
            + "{\"moteur\":{\"id\":100},\"quantite\":1}]");

        given().when().delete("/catalogue/helices/" + heliceId).then().statusCode(204);
        given().when().delete("/catalogue/produits/" + produitId).then().statusCode(204);

        given()
            .when().get("/catalogue/packages/" + id)
            .then()
            .statusCode(200)
            .body("lignes.size()", is(1))
            .body("lignes[0].moteur.id", is(100));
    }

    @Test
    void testConversionRefuseePourUnArticleDePackage() {
        int heliceId = given()
            .contentType("application/json")
            .body("{\"designation\":\"Helice de package a convertir\"}")
            .when().post("/catalogue/helices")
            .then().statusCode(200).extract().path("id");
        creer("Pack conversion", "[{\"helice\":{\"id\":" + heliceId + "},\"quantite\":1}]");

        given()
            .contentType("application/json")
            .body("{\"id\":" + heliceId + ",\"source\":\"helice\",\"cible\":\"remorque\"}")
            .when().post("/catalogue/convertir")
            .then()
            .statusCode(409)
            .body("message", containsString("packages"));
    }
}
