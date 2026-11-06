package net.nanthrax.moussaillon.services;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.response.Response;
import net.nanthrax.moussaillon.persistence.AvoirEntity;
import net.nanthrax.moussaillon.persistence.ClientEntity;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.containsString;
import static org.hamcrest.CoreMatchers.is;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
public class ExportComptableResourceTest {

    @Test
    void testParametresComptables() {
        given()
            .when().get("/export-comptable/parametres")
            .then()
            .statusCode(200)
            .body("journalVentes", is("VE"))
            .body("compteClients", is("411000"))
            .body("compteTvaCollectee", is("445710"));

        given()
            .contentType("application/json")
            .body(parametres("V-E", "411000"))
            .when().put("/export-comptable/parametres")
            .then()
            .statusCode(400)
            .body("error", containsString("journal des ventes"));
        given()
            .contentType("application/json")
            .body(parametres("VE", "411 000"))
            .when().put("/export-comptable/parametres")
            .then()
            .statusCode(400)
            .body("error", containsString("compte clients"));
        // Un compte du FEC commence par les 3 chiffres du plan comptable
        given()
            .contentType("application/json")
            .body(parametres("VE", "CLIENTS"))
            .when().put("/export-comptable/parametres")
            .then()
            .statusCode(400)
            .body("error", containsString("plan comptable"));

        // Codes en majuscules, conservés pour les exports suivants
        given()
            .contentType("application/json")
            .body(parametres("vt", "41100000"))
            .when().put("/export-comptable/parametres")
            .then()
            .statusCode(200)
            .body("journalVentes", is("VT"))
            .body("compteClients", is("41100000"));
        given()
            .when().get("/export-comptable/parametres")
            .then()
            .statusCode(200)
            .body("journalVentes", is("VT"));

        // Retour aux valeurs par défaut, attendues par les autres tests
        given()
            .contentType("application/json")
            .body(parametres("VE", "411000"))
            .when().put("/export-comptable/parametres")
            .then()
            .statusCode(200);
    }

    @Test
    void testEcrituresDeLaPeriode() {
        // Période : 2002 (aucune autre donnée de test à ces dates)
        int piece = creer("/catalogue/produits", "{\"designation\":\"Anode export\",\"categorie\":\"Pièces Moteur\","
                + "\"prixVenteHT\":100,\"tva\":20,\"prixVenteTTC\":120}");
        int hivernage = creer("/catalogue/produits", "{\"designation\":\"Hivernage export\",\"categorie\":\"Hivernage\","
                + "\"prixVenteHT\":500,\"tva\":20,\"prixVenteTTC\":600}");
        int bateau = creer("/catalogue/bateaux", "{\"designation\":\"Bateau export\",\"type\":\"Voilier\",\"occasion\":true,"
                + "\"prixVenteHT\":10000,\"prixVenteTTC\":10000}");
        int forfait = creer("/forfaits", "{\"nom\":\"Révision export\",\"prixHT\":200,\"tva\":20,\"prixTTC\":240}");

        // Facture de mars 2002 : 2 pièces, un hivernage, un bateau d'occasion (sans TVA) et un forfait, réglée par virement
        String facture = given().contentType("application/json")
                .body("{\"status\":\"FACTURE_PAYEE\",\"client\":{\"id\":100},\"date\":\"2002-03-10\","
                + "\"dateFacturePrete\":\"2002-03-10\",\"dateFacturePayee\":\"2002-03-20\",\"dateEcheance\":\"2002-04-09\","
                + "\"tva\":20,\"montantHT\":10900,\"montantTVA\":180,\"montantTTC\":11080,\"prixVenteTTC\":11080,"
                + "\"venteProduits\":[{\"produit\":{\"id\":" + piece + "},\"quantite\":2},{\"produit\":{\"id\":" + hivernage + "},\"quantite\":1}],"
                + "\"venteBateauxCatalogue\":[{\"bateau\":{\"id\":" + bateau + "},\"quantite\":1}],"
                + "\"venteForfaits\":[{\"forfait\":{\"id\":" + forfait + "},\"quantite\":1,\"status\":\"TERMINEE\"}],"
                + "\"paiements\":[{\"mode\":\"VIREMENT\",\"montant\":11080,\"date\":\"2002-03-20\"}]}")
                .when().post("/ventes")
                .then().statusCode(201).extract().path("numeroFacture");
        // Facture de mai 2002 avec une remise globale de 10 % (12 € TTC) : 90 € HT et 18 € de TVA, non réglée
        String factureRemise = given().contentType("application/json")
                .body("{\"status\":\"FACTURE_PRETE\",\"client\":{\"id\":100},\"date\":\"2002-05-02\","
                + "\"dateFacturePrete\":\"2002-05-02\",\"tva\":20,\"montantHT\":100,\"montantTVA\":20,"
                + "\"montantTTC\":120,\"remise\":12,\"prixVenteTTC\":108,"
                + "\"venteProduits\":[{\"produit\":{\"id\":" + piece + "},\"quantite\":1}]}")
                .when().post("/ventes")
                .then().statusCode(201).extract().path("numeroFacture");
        // Devis de 2002 : pas d'écriture
        creer("/ventes", "{\"status\":\"DEVIS\",\"client\":{\"id\":100},\"date\":\"2002-05-03\",\"prixVenteTTC\":500}");
        // Avoirs : l'un émis en avril, l'autre remboursé par chèque en juin
        creerAvoir("AV-2002-00001", AvoirEntity.Status.EMIS, "2002-04-02", null, 50, 60);
        creerAvoir("AV-2002-00002", AvoirEntity.Status.REMBOURSE, "2002-06-01", "2002-06-10", 20, 24);

        List<Map<String, Object>> ventes = ecritures("2002-01-01", "2002-12-31", false);
        assertEquals(13, ventes.size());
        assertEquilibre(ventes);
        // Factures et avoirs au journal des ventes, dans l'ordre des dates
        assertTrue(ventes.stream().allMatch(e -> "VE".equals(e.get("journal"))));
        assertEquals(List.of(facture, "AV-2002-00001", factureRemise, "AV-2002-00002"),
                ventes.stream().map(e -> (String) e.get("piece")).distinct().toList());
        // Une écriture par pièce, numérotée en séquence continue
        assertEquals(List.of(1, 2, 3, 4), ventes.stream().map(e -> e.get("numero")).distinct().toList());

        // Chiffre d'affaires HT ventilé : hivernage et forfait en prestations, pièces et bateau d'occasion en marchandises
        // (même compte par défaut) ; la TVA ne porte que sur les articles neufs
        assertEcriture(ventes, facture, "411000", 11080, 0);
        assertEcriture(ventes, facture, "706000", 0, 700);
        assertEcriture(ventes, facture, "707000", 0, 10200);
        assertEcriture(ventes, facture, "445710", 0, 180);
        Map<String, Object> client = ecriture(ventes, facture, "411000");
        assertEquals("2002-03-10", client.get("date"));
        assertEquals("Facture Jean Dupont", client.get("libelle"));
        assertEquals("Journal des ventes", client.get("journalLibelle"));
        assertEquals("Clients", client.get("compteLibelle"));
        // Le client en compte auxiliaire, sur le seul compte clients
        assertEquals("C000100", client.get("compteAuxiliaire"));
        assertEquals("Jean Dupont", client.get("compteAuxiliaireLibelle"));
        assertNull(ecriture(ventes, facture, "706000").get("compteAuxiliaire"));
        assertEquals("Prestations de services", ecriture(ventes, facture, "706000").get("compteLibelle"));
        // La remise globale réduit le HT et la TVA dans la même proportion
        assertEcriture(ventes, factureRemise, "411000", 108, 0);
        assertEcriture(ventes, factureRemise, "707000", 0, 90);
        assertEcriture(ventes, factureRemise, "445710", 0, 18);
        // Avoir sans facture d'origine : en prestations
        assertEcriture(ventes, "AV-2002-00001", "411000", 0, 60);
        assertEcriture(ventes, "AV-2002-00001", "706000", 50, 0);
        assertEcriture(ventes, "AV-2002-00001", "445710", 10, 0);

        // Avec les règlements : virement de la facture et remboursement de l'avoir, au journal de banque
        List<Map<String, Object>> toutes = ecritures("2002-01-01", "2002-12-31", true);
        assertEquals(17, toutes.size());
        assertEquilibre(toutes);
        List<Map<String, Object>> banque = toutes.stream().filter(e -> "BQ".equals(e.get("journal"))).toList();
        assertEquals(4, banque.size());
        assertEcriture(banque, facture, "512000", 11080, 0);
        assertEcriture(banque, facture, "411000", 0, 11080);
        assertEquals("2002-03-20", ecriture(banque, facture, "512000").get("date"));
        assertEquals("Virement Jean Dupont", ecriture(banque, facture, "512000").get("libelle"));
        assertEquals("C000100", ecriture(banque, facture, "411000").get("compteAuxiliaire"));
        // Numérotation dans l'ordre chronologique, tous journaux confondus : le virement suit la facture
        assertEquals(2, ecriture(banque, facture, "512000").get("numero"));
        assertEquals(6, ecriture(banque, "AV-2002-00002", "512000").get("numero"));
        assertEcriture(banque, "AV-2002-00002", "411000", 24, 0);
        assertEcriture(banque, "AV-2002-00002", "512000", 0, 24);

        // Période limitée à mars
        assertEquals(4, ecritures("2002-03-01", "2002-03-31", false).size());
    }

    @Test
    void testFichierFec() {
        given().contentType("application/json")
                .body("{\"status\":\"FACTURE_PRETE\",\"client\":{\"id\":100},\"date\":\"2003-02-14\","
                + "\"dateFacturePrete\":\"2003-02-14\",\"tva\":20,\"montantHT\":100,\"montantTVA\":20,"
                + "\"montantTTC\":120,\"prixVenteTTC\":120}")
                .when().post("/ventes")
                .then().statusCode(201);

        Response reponse = given()
                .queryParam("debut", "2003-02-01").queryParam("fin", "2003-02-28")
                .when().get("/export-comptable/fec")
                .then()
                .statusCode(200)
                .header("Content-Disposition", containsString("FEC20030228.txt"))
                .extract().response();
        String[] lignes = new String(reponse.asByteArray(), StandardCharsets.UTF_8).split("\r\n");
        assertEquals(4, lignes.length);
        // Première ligne : le nom des 18 zones, dans l'ordre imposé
        assertEquals("JournalCode\tJournalLib\tEcritureNum\tEcritureDate\tCompteNum\tCompteLib\tCompAuxNum\tCompAuxLib\t"
                + "PieceRef\tPieceDate\tEcritureLib\tDebit\tCredit\tEcritureLet\tDateLet\tValidDate\tMontantdevise\tIdevise",
                lignes[0]);

        String[] client = lignes[1].split("\t", -1);
        assertEquals(18, client.length);
        assertTrue(client[8].matches("FA\\d{2}-\\d{6}"), client[8]);
        assertEquals(List.of("VE", "Journal des ventes", "1", "20030214", "411000", "Clients", "C000100", "Jean Dupont",
                client[8], "20030214", "Facture Jean Dupont", "120,00", "0,00", "", "", "20030214", "", ""), List.of(client));
        String[] produit = lignes[2].split("\t", -1);
        assertEquals(List.of("VE", "Journal des ventes", "1", "20030214", "706000", "Prestations de services", "", "",
                client[8], "20030214", "Facture Jean Dupont", "0,00", "100,00", "", "", "20030214", "", ""), List.of(produit));
        String[] tva = lignes[3].split("\t", -1);
        assertEquals(List.of("445710", "TVA collectée", "0,00", "20,00"), List.of(tva[4], tva[5], tva[11], tva[12]));

        given()
                .queryParam("debut", "2003-02-28").queryParam("fin", "2003-02-01")
                .when().get("/export-comptable/fec")
                .then()
                .statusCode(400);
        given()
                .queryParam("debut", "02/2003")
                .when().get("/export-comptable/ecritures")
                .then()
                .statusCode(400);
    }

    @Test
    void testFormatFec() {
        ExportComptableResource.Ecriture ecriture = new ExportComptableResource.Ecriture();
        ecriture.numero = 7;
        ecriture.date = LocalDate.of(2026, 10, 31);
        ecriture.journal = "VE";
        ecriture.journalLibelle = "Journal des ventes";
        ecriture.compte = "706000";
        ecriture.compteLibelle = "Prestations de services";
        ecriture.libelle = "Facture Chantier\t\"Le Goéland\"\nBrest";
        ecriture.piece = "FA26-000123";
        ecriture.credit = 12345.5;
        assertEquals(String.join("\t", ExportComptableResource.ZONES_FEC) + "\r\n"
                + "VE\tJournal des ventes\t7\t20261031\t706000\tPrestations de services\t\t\tFA26-000123\t20261031\t"
                + "Facture Chantier \"Le Goéland\" Brest\t0,00\t12345,50\t\t\t20261031\t\t\r\n",
                ExportComptableResource.formatFec(List.of(ecriture)));
    }

    @Test
    void testRepartitionAuCentime() {
        Map<String, Double> parts = ExportComptableResource.repartir(100, Map.of("706000", 1.0, "707000", 2.0), "706000");
        assertEquals(33.33, parts.get("706000"), 0.001);
        assertEquals(66.67, parts.get("707000"), 0.001);
        // Tiers égaux : l'écart d'arrondi revient à un seul compte, le total reste juste
        Map<String, Double> poids = new LinkedHashMap<>();
        poids.put("A", 1.0);
        poids.put("B", 1.0);
        poids.put("C", 1.0);
        Map<String, Double> tiers = ExportComptableResource.repartir(100, poids, "A");
        assertEquals(List.of(33.34, 33.33, 33.33), List.copyOf(tiers.values()));
        assertEquals(100, ExportComptableResource.repartir(100, Map.of(), "706000").get("706000"), 0.001);
    }

    private static String parametres(String journalVentes, String compteClients) {
        return "{\"journalVentes\":\"" + journalVentes + "\",\"journalBanque\":\"BQ\",\"journalCaisse\":\"CA\","
                + "\"compteClients\":\"" + compteClients + "\",\"comptePrestations\":\"706000\",\"compteMarchandises\":\"707000\","
                + "\"compteOccasion\":\"707000\",\"compteTvaCollectee\":\"445710\",\"compteBanque\":\"512000\","
                + "\"compteCaisse\":\"530000\"}";
    }

    private static List<Map<String, Object>> ecritures(String debut, String fin, boolean reglements) {
        return given()
                .queryParam("debut", debut).queryParam("fin", fin).queryParam("reglements", reglements)
                .when().get("/export-comptable/ecritures")
                .then().statusCode(200)
                .extract().jsonPath().getList("$");
    }

    private static Map<String, Object> ecriture(List<Map<String, Object>> ecritures, String piece, String compte) {
        List<Map<String, Object>> trouvees = ecritures.stream()
                .filter(e -> piece.equals(e.get("piece")) && compte.equals(e.get("compte"))).toList();
        assertEquals(1, trouvees.size(), piece + " " + compte);
        return trouvees.get(0);
    }

    private static void assertEcriture(List<Map<String, Object>> ecritures, String piece, String compte, double debit, double credit) {
        Map<String, Object> ecriture = ecriture(ecritures, piece, compte);
        assertEquals(debit, nombre(ecriture.get("debit")), 0.001, piece + " " + compte);
        assertEquals(credit, nombre(ecriture.get("credit")), 0.001, piece + " " + compte);
    }

    // Chaque pièce est équilibrée
    private static void assertEquilibre(List<Map<String, Object>> ecritures) {
        Map<String, Double> soldes = new HashMap<>();
        for (Map<String, Object> e : ecritures) {
            soldes.merge(e.get("journal") + "/" + e.get("piece"), nombre(e.get("debit")) - nombre(e.get("credit")), Double::sum);
        }
        soldes.forEach((piece, solde) -> assertEquals(0, solde, 0.001, piece));
    }

    private static double nombre(Object valeur) {
        return ((Number) valeur).doubleValue();
    }

    private static int creer(String chemin, String body) {
        return given().contentType("application/json").body(body)
                .when().post(chemin)
                .then().statusCode(org.hamcrest.Matchers.oneOf(200, 201))
                .extract().path("id");
    }

    private static void creerAvoir(String reference, AvoirEntity.Status status, String dateEmission, String dateRemboursement,
                                   double montantHT, double montantTTC) {
        QuarkusTransaction.requiringNew().run(() -> {
            AvoirEntity avoir = new AvoirEntity();
            avoir.reference = reference;
            avoir.client = ClientEntity.findById(100L);
            avoir.status = status;
            avoir.dateCreation = Timestamp.valueOf(LocalDate.parse(dateEmission).atStartOfDay());
            avoir.dateEmission = avoir.dateCreation;
            if (dateRemboursement != null) {
                avoir.dateRemboursement = Timestamp.valueOf(LocalDate.parse(dateRemboursement).atStartOfDay());
                avoir.modeRemboursement = AvoirEntity.ModeRemboursement.CHEQUE;
            }
            avoir.montantHT = montantHT;
            avoir.tva = 20;
            avoir.montantTVA = montantTTC - montantHT;
            avoir.montantTTC = montantTTC;
            avoir.persist();
        });
    }
}
