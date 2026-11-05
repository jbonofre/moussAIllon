package net.nanthrax.moussaillon.services;

import java.util.Map;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.path.json.JsonPath;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
public class KpiCommercialResourceTest {

    @Test
    void testLeadsConversionEtPipeline() {
        // Période N : 2003, période N-1 : 2002 (aucune autre donnée de test à ces dates)
        int facebook = creer("/clients", "{\"nom\":\"Client Facebook KPI\",\"type\":\"PARTICULIER\",\"canalAcquisition\":\"FACEBOOK\"}");
        int sansCanal = creer("/clients", "{\"nom\":\"Client Sans Canal KPI\",\"type\":\"PARTICULIER\",\"email\":\"sans.canal@test.com\"}");

        // Mars 2003 : un devis signé 10 jours après, une prestation facturée, un devis refusé
        creer("/ventes", vente(facebook, "DEVIS", "2003-03-01", 1000) + ",\"bonPourAccord\":true,\"dateBonPourAccord\":\"2003-03-11\"}");
        creer("/ventes", vente(facebook, "FACTURE_PAYEE", "2003-03-15", 500) + "}");
        creer("/ventes", vente(sansCanal, "DEVIS", "2003-03-20", 300) + ",\"dateRefus\":\"2003-04-01\",\"motifRefus\":\"Prix\"}");
        // Mai 2003 : un OR toujours en attente de signature
        int enAttente = creer("/ventes", vente(sansCanal, "DEVIS", "2003-05-10", 200) + ",\"ordreDeReparation\":true}");
        // Une vente comptoir n'est pas un lead
        creer("/ventes", vente(facebook, "FACTURE_PAYEE", "2003-03-05", 800) + ",\"comptoir\":true}");
        // Mars 2002 (N-1) : un devis signé
        creer("/ventes", vente(facebook, "DEVIS", "2002-03-04", 100) + ",\"bonPourAccord\":true}");

        JsonPath kpis = kpis("2003-12");
        assertEquals("2003-01", kpis.getString("debut"));
        assertEquals(4, kpis.getInt("leads"));
        assertEquals(1, kpis.getInt("leadsN1"));
        assertEquals(2, kpis.getInt("acceptes"));
        assertEquals(1, kpis.getInt("refuses"));
        assertEquals(1, kpis.getInt("enAttente"));
        assertEquals(2000.0, kpis.getDouble("montantLeadsHT"), 0.001);
        assertEquals(1500.0, kpis.getDouble("montantAccepteHT"), 0.001);
        assertEquals(50.0, kpis.getDouble("tauxConversion"), 0.001);
        assertEquals(100.0, kpis.getDouble("tauxConversionN1"), 0.001);
        assertEquals(10.0, kpis.getDouble("delaiMoyenAcceptationJours"), 0.001);

        Map<String, Object> mars = kpis.getMap("mois.find { it.mois == '2003-03' }");
        assertEquals(3, mars.get("leads"));
        assertEquals(1, mars.get("leadsN1"));
        assertEquals(2, mars.get("acceptes"));
        assertEquals(1, mars.get("refuses"));
        assertEquals(2, kpis.getInt("mois.find { it.mois == '2003-03' }.leadsParCanal.FACEBOOK"));
        assertEquals(1, kpis.getInt("mois.find { it.mois == '2003-03' }.leadsParCanal.NON_RENSEIGNE"));
        assertEquals(12, kpis.getList("mois").size());

        Map<String, Object> canalFacebook = kpis.getMap("canaux.find { it.code == 'FACEBOOK' }");
        assertEquals(2, canalFacebook.get("leads"));
        assertEquals(1, canalFacebook.get("leadsN1"));
        assertEquals(100.0, nombre(canalFacebook.get("tauxConversion")), 0.001);
        Map<String, Object> nonRenseigne = kpis.getMap("canaux.find { it.code == 'NON_RENSEIGNE' }");
        assertEquals(2, nonRenseigne.get("leads"));
        assertEquals(1, nonRenseigne.get("refuses"));
        assertEquals(1, nonRenseigne.get("enAttente"));
        assertEquals(0.0, nombre(nonRenseigne.get("tauxConversion")), 0.001);

        Map<String, Object> prix = kpis.getMap("motifsRefus.find { it.motif == 'Prix' }");
        assertEquals(1, prix.get("nombre"));
        assertEquals(300.0, nombre(prix.get("montantHT")), 0.001);

        // Le pipeline est à ce jour : l'OR de mai 2003, sans nouvelle depuis, est à relancer
        Map<String, Object> devis = devisEnAttente(kpis, enAttente);
        assertEquals("2003-05-10", devis.get("dateDevis"));
        assertEquals(200.0, nombre(devis.get("montantHT")), 0.001);
        assertEquals(true, devis.get("ordreDeReparation"));
        assertEquals("NON_RENSEIGNE", devis.get("canal"));
        assertTrue(nombre(devis.get("joursAttente")) > 60);
        assertEquals(true, devis.get("aRelancer"));
        assertTrue(kpis.getInt("pipeline.nombreARelancer") >= 1);
        assertTrue(kpis.getDouble("pipeline.montantPlus60HT") >= 200.0);

        // Relancé aujourd'hui, il n'est plus à relancer
        given().contentType("application/json")
                .when().post("/ventes/" + enAttente + "/rappel")
                .then().statusCode(200);
        devis = devisEnAttente(kpis(null), enAttente);
        assertEquals(false, devis.get("aRelancer"));
        assertNotNull(devis.get("derniereRelance"));

        // Refusé, il sort du pipeline et compte parmi les refus de sa période
        given().contentType("application/json").body("{\"motif\":\"Délai\"}")
                .when().post("/ventes/" + enAttente + "/refus")
                .then().statusCode(204);
        JsonPath apresRefus = kpis("2003-12");
        assertFalse(apresRefus.getList("pipeline.devis.venteId").contains(enAttente));
        assertEquals(2, apresRefus.getInt("refuses"));
        assertEquals(0, apresRefus.getInt("enAttente"));
    }

    @Test
    void testMoisDeFinInvalide() {
        given().queryParam("fin", "2003-13").when().get("/kpis-commerciaux").then().statusCode(400);
    }

    // Vente au montant HT donné (TTC à 20 %), datée de son devis ; le JSON est à compléter et fermer
    private static String vente(int client, String status, String dateDevis, double montantHT) {
        double ttc = montantHT * 1.2;
        return "{\"status\":\"" + status + "\",\"client\":{\"id\":" + client + "},\"date\":\"" + dateDevis + "\","
                + "\"dateDevis\":\"" + dateDevis + "\",\"tva\":20,\"montantHT\":" + montantHT + ",\"montantTVA\":" + (ttc - montantHT)
                + ",\"montantTTC\":" + ttc + ",\"prixVenteTTC\":" + ttc;
    }

    private static JsonPath kpis(String fin) {
        var requete = given();
        if (fin != null) {
            requete = requete.queryParam("fin", fin);
        }
        return requete.when().get("/kpis-commerciaux").then().statusCode(200).extract().jsonPath();
    }

    private static Map<String, Object> devisEnAttente(JsonPath kpis, int venteId) {
        Map<String, Object> devis = kpis.getMap("pipeline.devis.find { it.venteId == " + venteId + " }");
        assertNotNull(devis, "devis " + venteId);
        return devis;
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
}
