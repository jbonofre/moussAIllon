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
            .body("designation", is("Motul Huile moteur 4T"));
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
            .body("{\"designation\":\"International Antifouling\",\"categorie\":\"Peinture\",\"stock\":10,\"prixVenteTTC\":45.0}")
            .when().post("/catalogue/produits")
            .then()
            .statusCode(200)
            .body("designation", is("International Antifouling"))
            .body("id", notNullValue());
    }

    @Test
    void testModifierProduit() {
        int id = given()
            .contentType("application/json")
            .body("{\"designation\":\"Test AvantUpdate\",\"categorie\":\"Test\"}")
            .when().post("/catalogue/produits")
            .then().statusCode(200).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"designation\":\"Test ApresUpdate\",\"categorie\":\"Test\"}")
            .when().put("/catalogue/produits/" + id)
            .then()
            .statusCode(200)
            .body("designation", is("Test ApresUpdate"));
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
            .body("{\"designation\":\"Test ProduitAjustement\",\"categorie\":\"Test\",\"stock\":10}")
            .when().post("/catalogue/produits")
            .then().statusCode(200).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"designation\":\"Test ProduitAjustement\",\"categorie\":\"Test\",\"stock\":7}")
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
            .body("{\"designation\":\"Test ProduitStats\",\"categorie\":\"Test\",\"stock\":10,\"prixVenteTTC\":20.0}")
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
            .body("{\"designation\":\"Test ToDelete\",\"categorie\":\"Test\"}")
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
            .body("[0].designation", is("Produit Import Test"))
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
    void testImporterProduitsCsvLibelleEnMajuscules() {
        // Libellé entièrement en majuscules dans le fichier exporté (ex. EBP) : doit être
        // reformaté en casse "Titre", comme pour l'import clients.
        String csv = "Code article,Libellé,Type d'article,PV HT,Unité,PV TTC,Code barre,Stock virtuel,Stock réel,Statut,Géré en stock\r\n"
            + "MAJ001,HUILE MOTEUR 4T,Bien,\"10,00000\",,\"12,00000\",,\"0,00\",\"0,00\",Actif,Coché\r\n";

        given()
            .multiPart("file", "produits.csv", csv.getBytes(StandardCharsets.ISO_8859_1), "text/csv")
            .when().post("/catalogue/produits/import")
            .then()
            .statusCode(200)
            .body("created", is(1));

        given()
            .queryParam("q", "MAJ001")
            .when().get("/catalogue/produits/search")
            .then()
            .statusCode(200)
            .body("size()", is(1))
            .body("[0].designation", is("Huile Moteur 4t"));
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

    @Test
    void testImporterProduitsCsvDetecteLesTypes() {
        // La détection par IA est désactivée dans les tests : les types sont reconnus par les règles.
        String entete = "Code article,Libellé,Type d'article,PV HT,Unité,PV TTC,Code barre,Stock virtuel,Stock réel,Statut,Géré en stock\r\n";
        String csv = entete
            + "DET001,Quicksilver Open Activ 605,Bien,\"20000,00000\",,\"24000,00000\",,\"1,00\",\"1,00\",Actif,Coché\r\n"
            + "DET002,Mercury F115 EFI,Bien,\"10000,00000\",,\"12000,00000\",,\"2,00\",\"2,00\",Actif,Coché\r\n"
            + "DET003,Hélice Solas Amita 13x19,Bien,\"100,00000\",,\"120,00000\",,\"0,00\",\"0,00\",Actif,Coché\r\n"
            + "DET004,Remorque Satellite MX751,Bien,\"1500,00000\",,\"1800,00000\",,\"1,00\",\"1,00\",Actif,Coché\r\n"
            + "DET005,Huile Quicksilver 4T 25W40,Bien,\"10,00000\",,\"12,00000\",,\"8,00\",\"8,00\",Actif,Coché\r\n";

        given()
            .multiPart("file", "produits.csv", csv.getBytes(StandardCharsets.ISO_8859_1), "text/csv")
            .when().post("/catalogue/produits/import")
            .then()
            .statusCode(200)
            .body("total", is(5))
            .body("created", is(5))
            .body("errors", is(0))
            .body("bateaux", is(1))
            .body("moteurs", is(1))
            .body("helices", is(1))
            .body("remorques", is(1))
            .body("detection", is("REGLES"));

        given()
            .queryParam("q", "Activ 605")
            .when().get("/catalogue/bateaux/search")
            .then()
            .statusCode(200)
            .body("size()", is(1))
            .body("[0].designation", is("Quicksilver Open Activ 605"))
            .body("[0].ref", is("DET001"))
            .body("[0].type", is("Non classé"))
            .body("[0].stock", is(1))
            .body("[0].prixVenteHT", is(20000.0f))
            .body("[0].prixVenteTTC", is(24000.0f))
            .body("[0].tva", is(20.0f));

        given()
            .queryParam("type", "TYPE_BATEAU")
            .when().get("/reference-valeurs")
            .then()
            .statusCode(200)
            .body("valeur", hasItem("Non classé"));

        given()
            .queryParam("q", "F115 EFI")
            .when().get("/catalogue/moteurs/search")
            .then()
            .statusCode(200)
            .body("size()", is(1))
            .body("[0].ref", is("DET002"))
            .body("[0].type", is("Non classé"))
            .body("[0].stock", is(2));

        given()
            .queryParam("designation", "Solas Amita")
            .when().get("/catalogue/helices/search")
            .then()
            .statusCode(200)
            .body("size()", is(1))
            .body("[0].ref", is("DET003"))
            .body("[0].prixVenteTTC", is(120.0f));

        given()
            .queryParam("q", "Satellite MX751")
            .when().get("/catalogue/remorques/search")
            .then()
            .statusCode(200)
            .body("size()", is(1))
            .body("[0].ref", is("DET004"))
            .body("[0].stock", is(1));

        // seule l'huile est un produit
        given()
            .queryParam("q", "DET00")
            .when().get("/catalogue/produits/search")
            .then()
            .statusCode(200)
            .body("size()", is(1))
            .body("[0].designation", is("Huile Quicksilver 4T 25W40"));

        // Ré-importer met à jour chaque fiche dans son référentiel (retrouvée par Code article) sans la dupliquer.
        String csvMaj = entete
            + "DET001,Quicksilver Open Activ 605,Bien,\"21000,00000\",,\"25200,00000\",,\"3,00\",\"3,00\",Actif,Coché\r\n"
            + "DET004,Remorque Satellite MX751,Bien,\"1500,00000\",,\"1800,00000\",,\"0,00\",\"0,00\",Actif,Coché\r\n";
        given()
            .multiPart("file", "produits.csv", csvMaj.getBytes(StandardCharsets.ISO_8859_1), "text/csv")
            .when().post("/catalogue/produits/import")
            .then()
            .statusCode(200)
            .body("created", is(0))
            .body("updated", is(2))
            .body("bateaux", is(1))
            .body("remorques", is(1))
            .body("detection", nullValue());

        given()
            .queryParam("q", "Activ 605")
            .when().get("/catalogue/bateaux/search")
            .then()
            .statusCode(200)
            .body("size()", is(1))
            .body("[0].stock", is(3))
            .body("[0].prixVenteTTC", is(25200.0f));
    }

    @Test
    void testImporterProduitsCsvGardeLesProduitsExistants() {
        // Un code article déjà enregistré comme produit reste un produit, même si sa désignation évoque un bateau.
        given()
            .contentType("application/json")
            .body("{\"designation\":\"Zodiac Cadet 310 Aero\",\"categorie\":\"Annexes\",\"ref\":\"EXI001\",\"stock\":1}")
            .when().post("/catalogue/produits")
            .then()
            .statusCode(200);

        String csv = "Code article,Libellé,Type d'article,PV HT,Unité,PV TTC,Code barre,Stock virtuel,Stock réel,Statut,Géré en stock\r\n"
            + "EXI001,Zodiac Cadet 310 Aero,Bien,\"1000,00000\",,\"1200,00000\",,\"2,00\",\"2,00\",Actif,Coché\r\n";

        given()
            .multiPart("file", "produits.csv", csv.getBytes(StandardCharsets.ISO_8859_1), "text/csv")
            .when().post("/catalogue/produits/import")
            .then()
            .statusCode(200)
            .body("created", is(0))
            .body("updated", is(1))
            .body("bateaux", is(0));

        given()
            .queryParam("q", "Cadet 310")
            .when().get("/catalogue/bateaux/search")
            .then()
            .statusCode(200)
            .body("size()", is(0));

        given()
            .queryParam("q", "EXI001")
            .when().get("/catalogue/produits/search")
            .then()
            .statusCode(200)
            .body("size()", is(1))
            .body("[0].stock", is(2));
    }
}
