package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.junit.jupiter.api.Assertions.assertEquals;

@QuarkusTest
public class ClientResourceTest {

    @Test
    void testListerClients() {
        given()
            .when().get("/clients")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(2));
    }

    @Test
    void testObtenirClient() {
        given()
            .when().get("/clients/100")
            .then()
            .statusCode(200)
            .body("nom", is("Jean Dupont"))
            .body("type", is("Particulier"))
            .body("email", is("jean.dupont@test.com"));
    }

    @Test
    void testObtenirClientNonTrouve() {
        given()
            .when().get("/clients/9999")
            .then()
            .statusCode(404);
    }

    @Test
    void testCreerClient() {
        given()
            .contentType("application/json")
            .body("{\"nom\":\"Nouveau Client\",\"type\":\"Particulier\",\"email\":\"nouveau@test.com\"}")
            .when().post("/clients")
            .then()
            .statusCode(200)
            .body("nom", is("Nouveau Client"))
            .body("id", notNullValue());
    }

    @Test
    void testModifierClient() {
        // Creer une entite dediee pour le test de modification
        int id = given()
            .contentType("application/json")
            .body("{\"nom\":\"AvantUpdate\",\"type\":\"Particulier\"}")
            .when().post("/clients")
            .then()
            .statusCode(200)
            .extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"nom\":\"ApresUpdate\",\"type\":\"Particulier\",\"email\":\"update@test.com\"}")
            .when().put("/clients/" + id)
            .then()
            .statusCode(200)
            .body("nom", is("ApresUpdate"));
    }

    @Test
    void testNomEtAdresseReformatesEnCasseTitre() {
        // Saisi tout en majuscules : reformaté en « Foo Bar » dès la création.
        int id = given()
            .contentType("application/json")
            .body("{\"nom\":\"KERMARREC YANN\",\"type\":\"PARTICULIER\",\"adresse\":\"3 QUAI DE L'ODET\\n29000 QUIMPER\"}")
            .when().post("/clients")
            .then()
            .statusCode(200)
            .body("nom", is("Kermarrec Yann"))
            .body("adresse", is("3 Quai De L'Odet\n29000 Quimper"))
            .extract().path("id");

        // Saisi tout en minuscules lors d'une modification : reformaté aussi, et enregistré ainsi.
        given()
            .contentType("application/json")
            .body("{\"nom\":\"kermarrec yann-erwan\",\"type\":\"PARTICULIER\",\"email\":\"YANN@TEST.COM\"}")
            .when().put("/clients/" + id)
            .then()
            .statusCode(200)
            .body("nom", is("Kermarrec Yann-Erwan"));

        given()
            .when().get("/clients/" + id)
            .then()
            .statusCode(200)
            .body("nom", is("Kermarrec Yann-Erwan"))
            // L'email n'est pas un nom : il reste tel que saisi.
            .body("email", is("YANN@TEST.COM"));

        // Casse mixte : considérée comme voulue, laissée telle quelle.
        given()
            .contentType("application/json")
            .body("{\"nom\":\"McDonald Ronald\",\"type\":\"PARTICULIER\"}")
            .when().put("/clients/" + id)
            .then()
            .statusCode(200);

        given()
            .when().get("/clients/" + id)
            .then()
            .statusCode(200)
            .body("nom", is("McDonald Ronald"));
    }

    @Test
    void testRechercherClients() {
        given()
            .queryParam("q", "dupont")
            .when().get("/clients/search")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));
    }

    @Test
    void testRechercherClientsSansRequete() {
        given()
            .when().get("/clients/search")
            .then()
            .statusCode(200)
            .body("size()", greaterThanOrEqualTo(2));
    }

    @Test
    void testSupprimerClient() {
        // Creer un client a supprimer
        int id = given()
            .contentType("application/json")
            .body("{\"nom\":\"ASupprimer\",\"type\":\"Particulier\"}")
            .when().post("/clients")
            .then()
            .statusCode(200)
            .extract().path("id");

        given()
            .when().delete("/clients/" + id)
            .then()
            .statusCode(204);

        given()
            .when().get("/clients/" + id)
            .then()
            .statusCode(404);
    }

    @Test
    void testDelaiPaiementMoyenSansFacturePayee() {
        int clientId = given()
            .contentType("application/json")
            .body("{\"nom\":\"SansFacturePayee\",\"type\":\"Particulier\"}")
            .when().post("/clients")
            .then()
            .statusCode(200)
            .extract().path("id");

        given()
            .when().get("/clients/" + clientId)
            .then()
            .statusCode(200)
            .body("delaiPaiementMoyenJours", nullValue());
    }

    @Test
    void testDelaiPaiementMoyenAvecFacturesPayees() {
        int clientId = given()
            .contentType("application/json")
            .body("{\"nom\":\"AvecFacturesPayees\",\"type\":\"Particulier\"}")
            .when().post("/clients")
            .then()
            .statusCode(200)
            .extract().path("id");

        // Facture emise le 01/01, payee le 05/01 : delai de 4 jours.
        given()
            .contentType("application/json")
            .body("{\"status\":\"FACTURE_PAYEE\",\"client\":{\"id\":" + clientId + "},"
                + "\"dateFacturePrete\":\"2026-01-01\",\"dateFacturePayee\":\"2026-01-05\",\"prixVenteTTC\":100.0}")
            .when().post("/ventes")
            .then()
            .statusCode(201);

        // Facture emise le 01/02, payee le 09/02 : delai de 8 jours.
        given()
            .contentType("application/json")
            .body("{\"status\":\"FACTURE_PAYEE\",\"client\":{\"id\":" + clientId + "},"
                + "\"dateFacturePrete\":\"2026-02-01\",\"dateFacturePayee\":\"2026-02-09\",\"prixVenteTTC\":200.0}")
            .when().post("/ventes")
            .then()
            .statusCode(201);

        // Facture payee mais sans date d'emission : ne doit pas entrer dans la moyenne.
        given()
            .contentType("application/json")
            .body("{\"status\":\"FACTURE_PAYEE\",\"client\":{\"id\":" + clientId + "},\"prixVenteTTC\":50.0}")
            .when().post("/ventes")
            .then()
            .statusCode(201);

        Number delai = given()
            .when().get("/clients/" + clientId)
            .then()
            .statusCode(200)
            .extract().path("delaiPaiementMoyenJours");
        assertEquals(6.0, delai.doubleValue(), 0.01); // (4 + 8) / 2
    }

    @Test
    void testImporterClientsCsv() {
        String csv = "Code (tiers);Nom;E-mail (facturation);Adresse 1 (facturation);Code postal (facturation);Ville (facturation);Code Pays (facturation);Téléphone fixe (facturation);Téléphone portable (facturation);Fax (facturation)\r\n"
            + "TST001;Martin Paul;import@test.com;1 rue du Test;29000;QUIMPER;FR;0298000000;;\r\n";

        given()
            .multiPart("file", "clients.csv", csv.getBytes(StandardCharsets.ISO_8859_1), "text/csv")
            .when().post("/clients/import")
            .then()
            .statusCode(200)
            .body("total", is(1))
            .body("created", is(1))
            .body("updated", is(0))
            .body("errors", is(0));

        given()
            .queryParam("q", "Martin Paul")
            .when().get("/clients/search")
            .then()
            .statusCode(200)
            .body("size()", is(1))
            // Le fichier exporte "Nom Prénom" ("Martin Paul") : l'import garde cet ordre.
            .body("[0].nom", is("Martin Paul"))
            .body("[0].email", is("import@test.com"))
            // "QUIMPER" (majuscules) est reformaté en "Quimper".
            .body("[0].adresse", is("1 rue du Test\n29000 Quimper"));

        // Ré-importer le même fichier met à jour le client existant (retrouvé par Code tiers)
        // au lieu d'en créer un doublon.
        given()
            .multiPart("file", "clients.csv", csv.getBytes(StandardCharsets.ISO_8859_1), "text/csv")
            .when().post("/clients/import")
            .then()
            .statusCode(200)
            .body("created", is(0))
            .body("updated", is(1));

        given()
            .queryParam("q", "Martin Paul")
            .when().get("/clients/search")
            .then()
            .statusCode(200)
            .body("size()", is(1));
    }

    @Test
    void testImporterClientsCsvNomEnMajuscules() {
        // Nom entièrement en majuscules dans le fichier exporté : doit être reformaté en casse
        // "Titre", sans changer l'ordre "Nom Prénom".
        String csv = "Code (tiers);Nom;E-mail (facturation);Adresse 1 (facturation);Code postal (facturation);Ville (facturation);Code Pays (facturation);Téléphone fixe (facturation);Téléphone portable (facturation);Fax (facturation)\r\n"
            + "TST002;FOO BAR;majuscules@test.com;12 AVENUE DE LA MER;29000;BREST;FR;;;\r\n";

        given()
            .multiPart("file", "clients.csv", csv.getBytes(StandardCharsets.ISO_8859_1), "text/csv")
            .when().post("/clients/import")
            .then()
            .statusCode(200)
            .body("created", is(1));

        given()
            .queryParam("q", "Foo Bar")
            .when().get("/clients/search")
            .then()
            .statusCode(200)
            .body("size()", is(1))
            .body("[0].nom", is("Foo Bar"))
            .body("[0].adresse", is("12 Avenue De La Mer\n29000 Brest"));
    }

    @Test
    void testImporterClientsCsvNomsComposes() {
        // Prénom composé sans tiret, nom composé et société : l'ordre du fichier est conservé
        // tel quel, sans chercher à séparer le nom du prénom (#703).
        String csv = "Code (tiers);Nom;E-mail (facturation);Adresse 1 (facturation);Code postal (facturation);Ville (facturation);Code Pays (facturation);Téléphone fixe (facturation);Téléphone portable (facturation);Fax (facturation)\r\n"
            + "TST703A;HAMON JEAN LUC;;;;;FR;;;\r\n"
            + "TST703B;LE GALL JEAN PIERRE;;;;;FR;;;\r\n"
            + "TST703C;CHANTIER NAVAL DE L'ODET;;;;;FR;;;\r\n";

        given()
            .multiPart("file", "clients.csv", csv.getBytes(StandardCharsets.ISO_8859_1), "text/csv")
            .when().post("/clients/import")
            .then()
            .statusCode(200)
            .body("created", is(3))
            .body("errors", is(0));

        given()
            .queryParam("q", "Hamon")
            .when().get("/clients/search")
            .then()
            .statusCode(200)
            .body("size()", is(1))
            .body("[0].nom", is("Hamon Jean Luc"));

        given()
            .queryParam("q", "Le Gall")
            .when().get("/clients/search")
            .then()
            .statusCode(200)
            .body("size()", is(1))
            .body("[0].nom", is("Le Gall Jean Pierre"));

        given()
            .queryParam("q", "Odet")
            .when().get("/clients/search")
            .then()
            .statusCode(200)
            .body("size()", is(1))
            .body("[0].nom", is("Chantier Naval De L'Odet"));
    }

    @Test
    void testReimporterClientsCsvRetablitOrdreNomPrenom() {
        // Un client importé avant la correction de #703 a été enregistré inversé ("Anne Kervella Marie") ;
        // ré-importer le fichier le retrouve par Code tiers et rétablit le nom du fichier.
        int id = given()
            .contentType("application/json")
            .body("{\"nom\":\"Anne Kervella Marie\",\"type\":\"PARTICULIER\",\"codeTiers\":\"TST703D\"}")
            .when().post("/clients")
            .then()
            .statusCode(200)
            .extract().path("id");

        String csv = "Code (tiers);Nom;E-mail (facturation);Adresse 1 (facturation);Code postal (facturation);Ville (facturation);Code Pays (facturation);Téléphone fixe (facturation);Téléphone portable (facturation);Fax (facturation)\r\n"
            + "TST703D;KERVELLA MARIE ANNE;;;;;FR;;;\r\n";

        given()
            .multiPart("file", "clients.csv", csv.getBytes(StandardCharsets.ISO_8859_1), "text/csv")
            .when().post("/clients/import")
            .then()
            .statusCode(200)
            .body("created", is(0))
            .body("updated", is(1));

        given()
            .when().get("/clients/" + id)
            .then()
            .statusCode(200)
            .body("nom", is("Kervella Marie Anne"));
    }

    @Test
    void testImporterClientsCsvColonneManquante() {
        String csv = "Colonne;Autre\r\nValeur;Valeur2\r\n";

        given()
            .multiPart("file", "invalide.csv", csv.getBytes(StandardCharsets.ISO_8859_1), "text/csv")
            .when().post("/clients/import")
            .then()
            .statusCode(400);
    }
}
