package net.nanthrax.moussaillon.services;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.path.json.JsonPath;
import net.nanthrax.moussaillon.persistence.AvoirEntity;
import net.nanthrax.moussaillon.persistence.ClientEntity;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
public class KpiFinancierResourceTest {

    @Test
    void testCaMargeEtEncaissementsParActivite() {
        // Période N : 2001, période N-1 : 2000 (aucune autre donnée de test à ces dates)
        int piece = creer("/catalogue/produits", "{\"designation\":\"Anode KPI\",\"categorie\":\"Pièces Moteur\","
                + "\"prixVenteHT\":100,\"tva\":20,\"prixVenteTTC\":120,\"prixAchatMoyenHT\":60}");
        int hivernage = creer("/catalogue/produits", "{\"designation\":\"Hivernage KPI\",\"categorie\":\"Hivernage\","
                + "\"prixVenteHT\":500,\"tva\":20,\"prixVenteTTC\":600}");
        int bateau = creer("/catalogue/bateaux", "{\"designation\":\"Bateau KPI\",\"type\":\"Voilier\",\"occasion\":true,"
                + "\"prixVenteHT\":10000,\"prixVenteTTC\":10000,\"prixAchatMoyenHT\":7000}");
        int forfait = creer("/forfaits", "{\"nom\":\"Révision KPI\",\"prixHT\":200,\"tva\":20,\"prixTTC\":240,\"dureeEstimee\":2}");
        int technicien = creer("/techniciens", "{\"nom\":\"Kpi\",\"prenom\":\"Test\",\"coutHoraire\":30}");

        // Facture de mars 2001 : 2 pièces, un hivernage, un bateau d'occasion (sans TVA) et un forfait de 3 h réelles
        creer("/ventes", "{\"status\":\"FACTURE_PAYEE\",\"date\":\"2001-03-10\",\"dateFacturePrete\":\"2001-03-10\","
                + "\"dateFacturePayee\":\"2001-03-20\",\"tva\":20,\"montantHT\":10900,\"montantTVA\":180,\"montantTTC\":11080,"
                + "\"prixVenteTTC\":11080,"
                + "\"venteProduits\":[{\"produit\":{\"id\":" + piece + "},\"quantite\":2},{\"produit\":{\"id\":" + hivernage + "},\"quantite\":1}],"
                + "\"venteBateauxCatalogue\":[{\"bateau\":{\"id\":" + bateau + "},\"quantite\":1}],"
                + "\"venteForfaits\":[{\"forfait\":{\"id\":" + forfait + "},\"quantite\":1,\"status\":\"TERMINEE\",\"dureeReelle\":3,"
                + "\"techniciens\":[{\"id\":" + technicien + "}]}],"
                + "\"paiements\":[{\"mode\":\"VIREMENT\",\"montant\":11080,\"date\":\"2001-03-20\"}]}");
        // Facture de mai 2001 avec une remise globale de 10 % (12 € TTC) : 90 € HT, échue et non payée
        int venteRemise = creer("/ventes", "{\"status\":\"FACTURE_PRETE\",\"date\":\"2001-05-02\",\"dateFacturePrete\":\"2001-05-02\","
                + "\"dateEcheance\":\"2001-06-01\",\"numeroFacture\":\"FA-KPI-1\",\"tva\":20,\"montantHT\":100,\"montantTVA\":20,"
                + "\"montantTTC\":120,\"remise\":12,\"prixVenteTTC\":108,"
                + "\"venteProduits\":[{\"produit\":{\"id\":" + piece + "},\"quantite\":1}]}");
        // Facture de mars 2000 (N-1) payée sans règlement saisi : encaissée à sa date de paiement
        creer("/ventes", "{\"status\":\"FACTURE_PAYEE\",\"date\":\"2000-03-05\",\"dateFacturePrete\":\"2000-03-05\","
                + "\"dateFacturePayee\":\"2000-03-06\",\"tva\":20,\"montantHT\":100,\"montantTVA\":20,\"montantTTC\":120,"
                + "\"prixVenteTTC\":120,\"venteProduits\":[{\"produit\":{\"id\":" + piece + "},\"quantite\":1}]}");
        // Avoirs : l'un émis en avril, l'autre remboursé en juin (décaissé)
        creerAvoir(AvoirEntity.Status.EMIS, "2001-04-02", null, 50, 60);
        creerAvoir(AvoirEntity.Status.REMBOURSE, "2001-06-01", "2001-06-10", 20, 24);

        JsonPath kpis = kpis("2001-12");
        assertEquals("2001-01", kpis.getString("debut"));
        assertEquals("2001-12", kpis.getString("fin"));

        Map<String, Object> pieces = activite(kpis, "PIECES");
        assertEquals("Transactions", pieces.get("groupe"));
        assertEquals(290.0, nombre(pieces.get("caHT")), 0.001);
        assertEquals(100.0, nombre(pieces.get("caHTN1")), 0.001);
        assertEquals(180.0, nombre(pieces.get("coutHT")), 0.001);
        assertEquals(110.0, nombre(pieces.get("margeBruteHT")), 0.001);

        Map<String, Object> hivernageKpi = activite(kpis, "HIVERNAGE_GARDIENNAGE");
        assertEquals(500.0, nombre(hivernageKpi.get("caHT")), 0.001);
        assertEquals(500.0, nombre(hivernageKpi.get("margeBruteHT")), 0.001);

        Map<String, Object> bateaux = activite(kpis, "BATEAUX_OCCASION");
        assertEquals(10000.0, nombre(bateaux.get("caHT")), 0.001);
        assertEquals(3000.0, nombre(bateaux.get("margeBruteHT")), 0.001);
        assertEquals(30.0, nombre(bateaux.get("tauxMarge")), 0.001);

        // Main d'oeuvre : 3 h réelles au coût horaire de 30 €
        Map<String, Object> prestations = activite(kpis, "PRESTATIONS");
        assertEquals(200.0, nombre(prestations.get("caHT")), 0.001);
        assertEquals(90.0, nombre(prestations.get("coutHT")), 0.001);

        assertEquals(-70.0, nombre(activite(kpis, "AVOIRS").get("caHT")), 0.001);

        assertEquals(10920.0, kpis.getDouble("caHT"), 0.001);
        assertEquals(100.0, kpis.getDouble("caHTN1"), 0.001);
        assertEquals(80 + 500 + 3000 + 110 + 30 - 70, kpis.getDouble("margeBruteHT"), 0.001);
        assertEquals(11080.0 - 24.0, kpis.getDouble("encaissementsTTC"), 0.001);
        assertEquals(120.0, kpis.getDouble("encaissementsTTCN1"), 0.001);

        Map<String, Object> mars = kpis.getMap("mois.find { it.mois == '2001-03' }");
        assertEquals(10900.0, nombre(mars.get("caHT")), 0.001);
        assertEquals(100.0, nombre(mars.get("caHTN1")), 0.001);
        assertEquals(11080.0, nombre(mars.get("encaissementsTTC")), 0.001);
        assertEquals(120.0, nombre(mars.get("encaissementsTTCN1")), 0.001);
        assertEquals(10000.0, kpis.getDouble("mois.find { it.mois == '2001-03' }.caHTParActivite.BATEAUX_OCCASION"), 0.001);
        assertEquals(12, kpis.getList("mois").size());

        // La facture de mai, échue depuis plus de 90 jours, reste à encaisser
        Map<String, Object> enRetard = kpis.getMap("creances.facturesEnRetard.find { it.venteId == " + venteRemise + " }");
        assertNotNull(enRetard);
        assertEquals(108.0, nombre(enRetard.get("soldeTTC")), 0.001);
        assertEquals("2001-06-01", enRetard.get("dateEcheance"));
        assertTrue(nombre(enRetard.get("joursRetard")) > 90);
        assertTrue(kpis.getDouble("creances.retardPlus90TTC") >= 108.0);
    }

    @Test
    void testMargeAuCoutFigeALaSortieDeStock() {
        int produit = creer("/catalogue/produits", "{\"designation\":\"Filtre KPI " + System.nanoTime() + "\",\"categorie\":\"Divers\","
                + "\"stock\":3,\"prixVenteHT\":50,\"tva\":20,\"prixVenteTTC\":60,\"prixAchatMoyenHT\":10}");
        double coutAvant = coutPieces(kpis(null));

        String vente = "\"comptoir\":true,\"tva\":20,\"montantHT\":100,\"montantTVA\":20,\"montantTTC\":120,\"prixVenteTTC\":120,"
                + "\"venteProduits\":[{\"produit\":{\"id\":" + produit + "},\"quantite\":2}]";
        int venteId = creer("/ventes", "{\"status\":\"DEVIS\"," + vente + "}");
        given().contentType("application/json").body("{\"status\":\"FACTURE_PRETE\"," + vente + "}")
                .when().put("/ventes/" + venteId)
                .then().statusCode(200);

        // Une réception plus chère après la vente change le prix moyen pondéré (1 à 10 € + 1 à 40 €), pas le coût de la vente
        recevoir(produit, 1, 40.0, 0, null);
        assertEquals(25.0, nombre(given().when().get("/catalogue/produits/" + produit)
                .then().extract().path("prixAchatMoyenHT")), 0.001);

        assertEquals(coutAvant + 2 * 10.0, coutPieces(kpis(null)), 0.001);
    }

    @Test
    void testValeurEtAncienneteDuStock() {
        String categorie = "Stock KPI " + System.nanoTime();
        int produit = creer("/catalogue/produits", "{\"designation\":\"Bougie KPI\",\"categorie\":\"" + categorie + "\","
                + "\"prixVenteHT\":50,\"tva\":20,\"prixVenteTTC\":60}");
        // 4 articles reçus il y a longtemps (25 € + 20 € de port), puis 2 aujourd'hui à 45 €
        recevoir(produit, 4, 25.0, 20.0, "2000-01-15");
        recevoir(produit, 2, 45.0, 0, null);

        JsonPath fiche = given().when().get("/catalogue/produits/" + produit).then().statusCode(200).extract().jsonPath();
        assertEquals(6.0, fiche.getDouble("stock"), 0.001);
        assertEquals(35.0, fiche.getDouble("prixAchatMoyenHT"), 0.001);

        JsonPath mouvements = given().when().get("/catalogue/produits/" + produit + "/mouvements").then().statusCode(200).extract().jsonPath();
        assertEquals(List.of("RECEPTION", "RECEPTION"), mouvements.getList("type"));
        assertEquals(30.0, mouvements.getDouble("find { it.quantite == 4 }.prixUnitaireHT"), 0.001);
        assertNotNull(mouvements.get("[0].commandeFournisseurId"));

        JsonPath kpis = kpis(null);
        Map<String, Object> stock = kpis.getMap("stock.categories.find { it.categorie == '" + categorie + "' }");
        assertEquals(210.0, nombre(stock.get("valeurHT")), 0.001);
        // Premier entré, premier sorti : les 2 articles du jour sont récents, les 4 autres ont plus d'un an
        assertEquals(70.0, nombre(stock.get("valeur0a90")), 0.001);
        assertEquals(140.0, nombre(stock.get("valeurPlus365")), 0.001);
        assertEquals(0.0, nombre(stock.get("valeurNonDatee")), 0.001);

        Map<String, Object> dormant = kpis.getMap("stock.articlesDormants.find { it.type == 'Produit' && it.id == " + produit + " }");
        assertNotNull(dormant);
        assertEquals(140.0, nombre(dormant.get("valeurDormanteHT")), 0.001);
        assertEquals("2000-01-15", dormant.get("dateEntree"));
    }

    @Test
    void testStockInitialDateEtSupprimeAvecLArticle() {
        int produit = creer("/catalogue/produits", "{\"designation\":\"Stock initial KPI\",\"categorie\":\"Divers\",\"stock\":2}");
        assertEquals(List.of("AJUSTEMENT_MANUEL"), given().when().get("/catalogue/produits/" + produit + "/mouvements")
                .then().statusCode(200)
                .extract().jsonPath().getList("type"));
        // L'historique de stock n'empêche pas de supprimer l'article
        given().when().delete("/catalogue/produits/" + produit).then().statusCode(204);
    }

    @Test
    void testSuppressionDUneCommandeRecueConserveLHistorique() {
        int produit = creer("/catalogue/produits", "{\"designation\":\"Joint KPI\",\"categorie\":\"Divers\"}");
        int commande = recevoir(produit, 1, 5.0, 0, null);
        given().when().delete("/commandes-fournisseur/" + commande).then().statusCode(204);

        JsonPath mouvements = given().when().get("/catalogue/produits/" + produit + "/mouvements").then().statusCode(200).extract().jsonPath();
        assertEquals("RECEPTION", mouvements.getString("[0].type"));
        assertNull(mouvements.get("[0].commandeFournisseurId"));
    }

    @Test
    void testSuppressionDUneVenteSortieDuStock() {
        int bateau = creer("/catalogue/bateaux", "{\"designation\":\"Semi-rigide KPI\",\"type\":\"Annexe\",\"stock\":1,"
                + "\"prixVenteTTC\":3000,\"prixAchatMoyenHT\":2000}");
        String vente = "\"comptoir\":true,\"prixVenteTTC\":3000,\"venteBateauxCatalogue\":[{\"bateau\":{\"id\":" + bateau + "},\"quantite\":1}]";
        int venteId = creer("/ventes", "{\"status\":\"DEVIS\"," + vente + "}");
        given().contentType("application/json").body("{\"status\":\"FACTURE_PRETE\"," + vente + "}")
                .when().put("/ventes/" + venteId)
                .then().statusCode(200);
        assertEquals(0, ((Number) given().when().get("/catalogue/bateaux/" + bateau).then().extract().path("stock")).intValue());

        // La sortie de stock du bateau, inscrite à son historique, n'empêche pas de supprimer la vente non payée
        given().when().delete("/ventes/" + venteId).then().statusCode(204);
    }

    @Test
    void testMoisDeFinInvalide() {
        given().queryParam("fin", "2001-13").when().get("/kpis-financiers").then().statusCode(400);
    }

    private static JsonPath kpis(String fin) {
        var requete = given();
        if (fin != null) {
            requete = requete.queryParam("fin", fin);
        }
        return requete.when().get("/kpis-financiers").then().statusCode(200).extract().jsonPath();
    }

    private static Map<String, Object> activite(JsonPath kpis, String code) {
        Map<String, Object> activite = kpis.getMap("activites.find { it.code == '" + code + "' }");
        assertNotNull(activite, code);
        return activite;
    }

    private static double coutPieces(JsonPath kpis) {
        Map<String, Object> pieces = kpis.getMap("activites.find { it.code == 'PIECES' }");
        return pieces == null ? 0 : nombre(pieces.get("coutHT"));
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

    // Commande d'un article reçue (à la date donnée, aujourd'hui sans date) ; renvoie son identifiant
    private static int recevoir(int produit, double quantite, double prixUnitaireHT, double port, String dateReception) {
        String lignes = "\"portTotal\":" + port + ",\"lignes\":[{\"produit\":{\"id\":" + produit + "},\"quantite\":" + quantite
                + ",\"prixUnitaireHT\":" + prixUnitaireHT + ",\"prixTotalHT\":" + quantite * prixUnitaireHT + "}]";
        int commande = creer("/commandes-fournisseur", "{\"status\":\"BROUILLON\",\"fournisseur\":{\"id\":100}," + lignes + "}");
        given().contentType("application/json")
                .body("{\"status\":\"RECUE\",\"fournisseur\":{\"id\":100},"
                        + (dateReception != null ? "\"dateReception\":\"" + dateReception + "\"," : "") + lignes + "}")
                .when().put("/commandes-fournisseur/" + commande)
                .then().statusCode(200);
        return commande;
    }

    private static void creerAvoir(AvoirEntity.Status status, String dateEmission, String dateRemboursement, double montantHT, double montantTTC) {
        QuarkusTransaction.requiringNew().run(() -> {
            AvoirEntity avoir = new AvoirEntity();
            avoir.client = ClientEntity.findById(100L);
            avoir.status = status;
            avoir.dateCreation = Timestamp.valueOf(LocalDate.parse(dateEmission).atStartOfDay());
            avoir.dateEmission = avoir.dateCreation;
            if (dateRemboursement != null) {
                avoir.dateRemboursement = Timestamp.valueOf(LocalDate.parse(dateRemboursement).atStartOfDay());
            }
            avoir.montantHT = montantHT;
            avoir.tva = 20;
            avoir.montantTVA = montantTTC - montantHT;
            avoir.montantTTC = montantTTC;
            avoir.persist();
        });
    }
}
