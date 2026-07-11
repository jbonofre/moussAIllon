package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;

@QuarkusTest
public class ImportResourceTest {

    private byte[] buildWorkbook(String[][] clientsSheet, String[][] bateauxSheet) throws IOException {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            if (clientsSheet != null) {
                writeSheet(workbook.createSheet("Clients"), clientsSheet);
            }
            if (bateauxSheet != null) {
                writeSheet(workbook.createSheet("Bateaux"), bateauxSheet);
            }
            workbook.write(out);
            return out.toByteArray();
        }
    }

    private void writeSheet(Sheet sheet, String[][] data) {
        for (int r = 0; r < data.length; r++) {
            Row row = sheet.createRow(r);
            for (int c = 0; c < data[r].length; c++) {
                row.createCell(c).setCellValue(data[r][c]);
            }
        }
    }

    @Test
    void testImportXlsxClientsEtBateaux() throws IOException {
        byte[] xlsx = buildWorkbook(
            new String[][] {
                { "Prenom", "Nom", "Email", "Type", "Consentement" },
                { "Alice", "ImportTest", "alice.importtest@test.com", "Particulier", "oui" }
            },
            new String[][] {
                { "Nom", "Immatriculation", "Email Client" },
                { "Bateau ImportTest", "IMPORT001", "alice.importtest@test.com" }
            }
        );

        given()
            .multiPart("file", "import.xlsx", xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            .when().post("/import")
            .then()
            .statusCode(200)
            .body("onglets.size()", is(2))
            .body("onglets[0].type", is("Clients"))
            .body("onglets[0].crees", is(1))
            .body("onglets[0].erreurs.size()", is(0))
            .body("onglets[1].type", is("Bateaux"))
            .body("onglets[1].crees", is(1))
            .body("onglets[1].erreurs.size()", is(0));

        given()
            .when().get("/clients/search?q=alice.importtest@test.com")
            .then()
            .statusCode(200)
            .body("size()", is(1))
            .body("[0].nom", is("ImportTest"))
            .body("[0].consentement", is(true));

        given()
            .when().get("/bateaux/search?q=IMPORT001")
            .then()
            .statusCode(200)
            .body("size()", is(1))
            .body("[0].name", is("Bateau ImportTest"));
    }

    @Test
    void testImportBateauAvecEmailClientInconnu() throws IOException {
        byte[] xlsx = buildWorkbook(
            null,
            new String[][] {
                { "Nom", "Email Client" },
                { "Bateau Orphelin", "inconnu.importtest@test.com" }
            }
        );

        given()
            .multiPart("file", "import.xlsx", xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            .when().post("/import")
            .then()
            .statusCode(200)
            .body("onglets.size()", is(1))
            .body("onglets[0].type", is("Bateaux"))
            .body("onglets[0].crees", is(0))
            .body("onglets[0].erreurs.size()", is(1))
            .body("onglets[0].erreurs[0].ligne", is(2));
    }

    @Test
    void testImportCsvClients() throws IOException {
        String csv = "Nom,Prenom,Email\nDupontCsvImport,Marc,marc.dupontcsvimport@test.com\n";
        byte[] bytes = csv.getBytes(StandardCharsets.UTF_8);

        given()
            .multiPart("file", "clients.csv", bytes, "text/csv")
            .multiPart("type", "clients")
            .when().post("/import")
            .then()
            .statusCode(200)
            .body("onglets.size()", is(1))
            .body("onglets[0].type", is("Clients"))
            .body("onglets[0].crees", is(1));

        given()
            .when().get("/clients/search?q=marc.dupontcsvimport@test.com")
            .then()
            .statusCode(200)
            .body("size()", is(1))
            .body("[0].prenom", is("Marc"));
    }

    @Test
    void testImportCsvSansType() throws IOException {
        String csv = "Nom\nSansType\n";
        given()
            .multiPart("file", "clients.csv", csv.getBytes(StandardCharsets.UTF_8), "text/csv")
            .when().post("/import")
            .then()
            .statusCode(400);
    }

    @Test
    void testImportClientExistantMisAJour() throws IOException {
        byte[] xlsx1 = buildWorkbook(
            new String[][] {
                { "Nom", "Email", "Telephone" },
                { "MiseAJourTest", "maj.importtest@test.com", "0600000000" }
            },
            null
        );
        given()
            .multiPart("file", "import.xlsx", xlsx1, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            .when().post("/import")
            .then().statusCode(200).body("onglets[0].crees", is(1));

        byte[] xlsx2 = buildWorkbook(
            new String[][] {
                { "Nom", "Email", "Telephone" },
                { "MiseAJourTest", "maj.importtest@test.com", "0611111111" }
            },
            null
        );
        given()
            .multiPart("file", "import.xlsx", xlsx2, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            .when().post("/import")
            .then()
            .statusCode(200)
            .body("onglets[0].crees", is(0))
            .body("onglets[0].misAJour", is(1));

        given()
            .when().get("/clients/search?q=maj.importtest@test.com")
            .then()
            .statusCode(200)
            .body("[0].telephone", is("0611111111"));
    }

    @Test
    void testImportFormatNonSupporte() {
        given()
            .multiPart("file", "notes.txt", "contenu".getBytes(StandardCharsets.UTF_8), "text/plain")
            .when().post("/import")
            .then()
            .statusCode(400);
    }
}
