package net.nanthrax.moussaillon.services;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.containsString;
import static org.hamcrest.CoreMatchers.equalTo;
import static org.hamcrest.CoreMatchers.notNullValue;

import org.junit.jupiter.api.Test;

import io.quarkus.test.junit.QuarkusTest;

@QuarkusTest
public class CatalogueConversionResourceTest {

    private int creer(String chemin, String body) {
        return given().contentType("application/json").body(body)
            .when().post(chemin)
            .then().statusCode(200)
            .extract().path("id");
    }

    private String convertir(int id, String source, String cible, String categorie) {
        return "{\"id\":" + id + ",\"source\":\"" + source + "\",\"cible\":\"" + cible + "\""
            + (categorie != null ? ",\"categorie\":\"" + categorie + "\"" : "") + "}";
    }

    @Test
    void convertirUneHeliceEnProduit() {
        int id = creer("/catalogue/helices",
            "{\"designation\":\"Conv helice\",\"ref\":\"CONV-HEL\",\"diametre\":14,\"prixVenteTTC\":120.0}");

        int nouvelId = given().contentType("application/json")
            .body(convertir(id, "helice", "produit", "Accastillage"))
            .when().post("/catalogue/convertir")
            .then().statusCode(200)
            .body("type", equalTo("produit"))
            .body("id", notNullValue())
            .extract().path("id");

        given().when().get("/catalogue/helices/" + id).then().statusCode(404);
        given().when().get("/catalogue/produits/" + nouvelId).then().statusCode(200)
            .body("designation", equalTo("Conv helice"))
            .body("ref", equalTo("CONV-HEL"))
            .body("categorie", equalTo("Accastillage"))
            .body("prixVenteTTC", equalTo(120.0f));
    }

    @Test
    void conversionEnProduitSansCategorieRefusee() {
        int id = creer("/catalogue/helices", "{\"designation\":\"Conv sans categorie\"}");
        given().contentType("application/json").body(convertir(id, "helice", "produit", null))
            .when().post("/catalogue/convertir")
            .then().statusCode(400);
    }

    @Test
    void conversionRefuseeSiArticleUtilise() {
        int id = creer("/catalogue/helices", "{\"designation\":\"Conv utilisee\"}");
        given().contentType("application/json")
            .body("{\"fournisseur\":{\"id\":100},\"helice\":{\"id\":" + id + "},\"prixAchatHT\":200.0,\"tva\":20.0}")
            .when().post("/fournisseur-helice")
            .then().statusCode(201);

        given().contentType("application/json").body(convertir(id, "helice", "moteur", "Hors-bord"))
            .when().post("/catalogue/convertir")
            .then().statusCode(409)
            .body("message", containsString("fournisseurs"));

        given().when().get("/catalogue/helices/" + id).then().statusCode(200);
    }

    @Test
    void conversionVersLeMemeTypeRefusee() {
        given().contentType("application/json").body(convertir(1, "helice", "helice", null))
            .when().post("/catalogue/convertir")
            .then().statusCode(400);
    }

    @Test
    void conversionEnChaineParcourtTousLesTypes() {
        int id = creer("/catalogue/produits",
            "{\"designation\":\"Conv chaine\",\"categorie\":\"Divers\",\"stock\":3}");
        String[][] etapes = {
            {"produit", "bateau", "/catalogue/bateaux"},
            {"bateau", "moteur", "/catalogue/moteurs"},
            {"moteur", "remorque", "/catalogue/remorques"},
            {"remorque", "helice", "/catalogue/helices"},
            {"helice", "produit", "/catalogue/produits"},
        };
        for (String[] etape : etapes) {
            id = given().contentType("application/json")
                .body(convertir(id, etape[0], etape[1], "Divers"))
                .when().post("/catalogue/convertir")
                .then().statusCode(200)
                .extract().path("id");
            given().when().get(etape[2] + "/" + id).then().statusCode(200)
                .body("designation", equalTo("Conv chaine"));
        }
    }
}
