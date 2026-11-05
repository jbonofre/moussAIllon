package net.nanthrax.moussaillon.services;

import java.util.Map;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.path.json.JsonPath;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
public class KpiAtelierResourceTest {

    @Test
    void testHeuresTauxEtCaParTechnicienEtParPrestation() {
        // Période N : 2005, période N-1 : 2004 (aucune autre donnée de test à ces dates)
        int a = creer("/techniciens", "{\"nom\":\"Atelier\",\"prenom\":\"Alice\",\"email\":\"alice@kpi.test\",\"heuresHebdomadaires\":35}");
        int b = creer("/techniciens", "{\"nom\":\"Atelier\",\"prenom\":\"Bruno\",\"email\":\"bruno@kpi.test\",\"heuresHebdomadaires\":35}");
        // Une semaine de congés en mars 2005 pour Alice
        creer("/techniciens/" + a + "/absences", "{\"dateDebut\":\"2005-03-14\",\"dateFin\":\"2005-03-18\",\"type\":\"CONGES\"}");

        int mecanique = creer("/main-oeuvres", "{\"nom\":\"MO mécanique KPI\",\"prixHT\":60,\"tva\":20,\"prixTTC\":72}");
        int deplacement = creer("/main-oeuvres", "{\"nom\":\"Déplacement KPI\",\"prixHT\":50,\"tva\":20,\"prixTTC\":60,\"forfaitaire\":true}");
        int filtre = creer("/catalogue/produits", "{\"designation\":\"Filtre KPI atelier\",\"categorie\":\"Pièces Moteur\",\"prixVenteHT\":80,\"tva\":20,\"prixVenteTTC\":96}");
        int anode = creer("/catalogue/produits", "{\"designation\":\"Anode KPI atelier\",\"categorie\":\"Pièces Moteur\","
                + "\"prixVenteHT\":100,\"tva\":20,\"prixVenteTTC\":120}");
        // Forfait de 2 h estimées : 2 h de main d'oeuvre (120 € HT) et un filtre (80 € HT)
        int forfait = creer("/forfaits", "{\"nom\":\"Révision KPI atelier\",\"prixHT\":200,\"tva\":20,\"prixTTC\":240,\"dureeEstimee\":2,"
                + "\"mainOeuvres\":[{\"mainOeuvre\":{\"id\":" + mecanique + "},\"quantite\":2}],"
                + "\"produits\":[{\"produit\":{\"id\":" + filtre + "},\"quantite\":1}]}");
        // Service d'1 h estimée dont la main d'oeuvre est forfaitaire : sa durée estimée est facturée
        int service = creer("/services", "{\"nom\":\"Diagnostic KPI atelier\",\"prixHT\":50,\"tva\":20,\"prixTTC\":60,\"dureeEstimee\":1,"
                + "\"mainOeuvres\":[{\"mainOeuvre\":{\"id\":" + deplacement + "},\"quantite\":1}]}");

        // Facture de mars 2005 : forfait à deux (3 h), service d'Alice (0,5 h) et une anode
        creer("/ventes", "{\"status\":\"FACTURE_PAYEE\",\"bonPourAccord\":true,\"date\":\"2005-03-10\","
                + "\"dateFacturePrete\":\"2005-03-20\",\"dateFacturePayee\":\"2005-03-25\",\"tva\":20,\"montantHT\":350,"
                + "\"montantTVA\":70,\"montantTTC\":420,\"prixVenteTTC\":420,"
                + "\"venteForfaits\":[{\"forfait\":{\"id\":" + forfait + "},\"quantite\":1,\"status\":\"TERMINEE\",\"dureeReelle\":3,"
                + "\"dateFin\":\"2005-03-15\",\"techniciens\":[{\"id\":" + a + "},{\"id\":" + b + "}]}],"
                + "\"venteServices\":[{\"service\":{\"id\":" + service + "},\"quantite\":1,\"status\":\"TERMINEE\",\"dureeReelle\":0.5,"
                + "\"dateFin\":\"2005-03-16\",\"techniciens\":[{\"id\":" + a + "}]}],"
                + "\"venteProduits\":[{\"produit\":{\"id\":" + anode + "},\"quantite\":1}]}");
        // Reprise sous garantie de Bruno en juin (2 h), offerte : pas d'heures facturées
        String venteSav = "{\"status\":\"FACTURE_PRETE\",\"bonPourAccord\":true,\"date\":\"2005-06-01\",\"dateFacturePrete\":\"2005-06-10\","
                + "\"tva\":20,\"montantHT\":0,\"montantTTC\":0,\"prixVenteTTC\":0,"
                + "\"venteForfaits\":[{\"forfait\":{\"id\":" + forfait + "},\"quantite\":1,\"remise\":240,\"status\":\"TERMINEE\","
                + "\"dureeReelle\":2,\"dateFin\":\"2005-06-05\",\"sav\":true,\"techniciens\":[{\"id\":" + b + "}]}]}";
        int sav = creer("/ventes", venteSav);
        // La marque SAV est conservée à la mise à jour de la vente
        given().contentType("application/json").body(venteSav).when().put("/ventes/" + sav).then().statusCode(200);
        given().when().get("/ventes/" + sav).then().statusCode(200).body("venteForfaits[0].sav", is(true));
        // Prestations terminées en juillet sans technicien, pas encore facturées ; le forfait n'a pas de durée réelle
        creer("/ventes", "{\"status\":\"FACTURE_EN_ATTENTE\",\"bonPourAccord\":true,\"date\":\"2005-07-01\",\"tva\":20,"
                + "\"venteServices\":[{\"service\":{\"id\":" + service + "},\"quantite\":1,\"status\":\"TERMINEE\",\"dureeReelle\":1,"
                + "\"dateFin\":\"2005-07-01\"}],"
                + "\"venteForfaits\":[{\"forfait\":{\"id\":" + forfait + "},\"quantite\":1,\"status\":\"TERMINEE\",\"dateFin\":\"2005-07-02\"}]}");
        // N-1 : forfait d'Alice terminé et facturé en mai 2004
        creer("/ventes", "{\"status\":\"FACTURE_PAYEE\",\"bonPourAccord\":true,\"date\":\"2004-05-10\","
                + "\"dateFacturePrete\":\"2004-05-12\",\"dateFacturePayee\":\"2004-05-12\",\"tva\":20,\"montantHT\":200,"
                + "\"montantTVA\":40,\"montantTTC\":240,\"prixVenteTTC\":240,"
                + "\"venteForfaits\":[{\"forfait\":{\"id\":" + forfait + "},\"quantite\":1,\"status\":\"TERMINEE\",\"dureeReelle\":2,"
                + "\"dateFin\":\"2004-05-10\",\"techniciens\":[{\"id\":" + a + "}]}]}");

        JsonPath kpis = kpis("2005-12");
        assertEquals("2005-01", kpis.getString("debut"));
        assertEquals("2005-12", kpis.getString("fin"));

        // 2005 : 260 jours du lundi au vendredi à 7 h, dont 7 fériés ; Alice absente 5 jours
        Map<String, Object> alice = technicien(kpis, a);
        assertEquals(35.0, nombre(alice.get("heuresHebdomadaires")), 0.001);
        assertEquals(1820.0, nombre(alice.get("heuresContrat")), 0.001);
        assertEquals(49.0, nombre(alice.get("heuresFeries")), 0.001);
        assertEquals(35.0, nombre(alice.get("heuresAbsence")), 0.001);
        assertEquals(5, alice.get("joursAbsence"));
        Map<String, Object> aliceN = indicateurs(alice);
        assertEquals(1736.0, nombre(aliceN.get("heuresDisponibles")), 0.001);
        // Moitié du forfait (1 h prévue, 1,5 h réalisée, 1 h facturée) et le service (1 h prévue et facturée, 0,5 h réalisée)
        assertEquals(2.0, nombre(aliceN.get("heuresPrevues")), 0.001);
        assertEquals(2.0, nombre(aliceN.get("heuresRealisees")), 0.001);
        assertEquals(2.0, nombre(aliceN.get("heuresFacturees")), 0.001);
        assertEquals(2, aliceN.get("interventions"));
        assertEquals(100.0, nombre(aliceN.get("tauxEfficience")), 0.001);
        assertEquals(0.1, nombre(aliceN.get("tauxValorisation")), 0.001);
        // CA main d'oeuvre : moitié des 120 € du forfait et le service ; pièces : moitié du filtre et 2/3,5 de l'anode
        assertEquals(110.0, nombre(aliceN.get("caMainOeuvreHT")), 0.001);
        assertEquals(97.14, nombre(aliceN.get("caPiecesHT")), 0.001);
        assertEquals(0.1, nombre(alice.get("tauxValorisationN1")), 0.001);

        Map<String, Object> brunoN = indicateurs(technicien(kpis, b));
        assertEquals(1771.0, nombre(brunoN.get("heuresDisponibles")), 0.001);
        assertEquals(3.0, nombre(brunoN.get("heuresPrevues")), 0.001);
        assertEquals(3.5, nombre(brunoN.get("heuresRealisees")), 0.001);
        assertEquals(1.0, nombre(brunoN.get("heuresFacturees")), 0.001);
        assertEquals(2.0, nombre(brunoN.get("heuresSav")), 0.001);
        assertEquals(1, brunoN.get("interventionsSav"));
        assertEquals(28.6, nombre(brunoN.get("tauxEfficience")), 0.001);
        assertEquals(57.1, nombre(brunoN.get("tauxSav")), 0.001);
        assertEquals(60.0, nombre(brunoN.get("caMainOeuvreHT")), 0.001);
        assertEquals(82.86, nombre(brunoN.get("caPiecesHT")), 0.001);

        Map<String, Object> nonAffecte = kpis.getMap("techniciens.find { it.technicienId == null }");
        assertNotNull(nonAffecte);
        assertEquals(KpiAtelierResource.NON_AFFECTE, nonAffecte.get("nom"));
        assertEquals(1.0, nombre(indicateurs(nonAffecte).get("heuresRealisees")), 0.001);
        assertEquals(2, indicateurs(nonAffecte).get("interventions"));
        assertTrue(kpis.getList("techniciensSansHoraire").isEmpty());
        assertEquals(1, kpis.getInt("prestationsSansDureeReelle"));

        Map<String, Object> revision = indicateurs(kpis.getMap("prestations.find { it.cle == 'F" + forfait + "' }"));
        assertEquals(3, revision.get("interventions"));
        assertEquals(6.0, nombre(revision.get("heuresPrevues")), 0.001);
        assertEquals(5.0, nombre(revision.get("heuresRealisees")), 0.001);
        assertEquals(2.0, nombre(revision.get("heuresFacturees")), 0.001);
        assertEquals(2.0, nombre(revision.get("heuresSav")), 0.001);
        assertEquals(120.0, nombre(revision.get("caMainOeuvreHT")), 0.001);
        assertEquals(80.0, nombre(revision.get("caPiecesHT")), 0.001);
        Map<String, Object> diagnostic = kpis.getMap("prestations.find { it.cle == 'S" + service + "' }");
        assertEquals("Service", diagnostic.get("type"));
        assertEquals(1.5, nombre(indicateurs(diagnostic).get("heuresRealisees")), 0.001);
        assertEquals(1.0, nombre(indicateurs(diagnostic).get("heuresFacturees")), 0.001);

        Map<String, Object> n = kpis.getMap("n");
        assertEquals(3507.0, nombre(n.get("heuresDisponibles")), 0.001);
        assertEquals(8.0, nombre(n.get("heuresPrevues")), 0.001);
        assertEquals(6.5, nombre(n.get("heuresRealisees")), 0.001);
        assertEquals(3.0, nombre(n.get("heuresFacturees")), 0.001);
        assertEquals(2.0, nombre(n.get("heuresSav")), 0.001);
        assertEquals(5, n.get("interventions"));
        assertEquals(46.2, nombre(n.get("tauxEfficience")), 0.001);
        assertEquals(170.0, nombre(n.get("caMainOeuvreHT")), 0.001);
        assertEquals(180.0, nombre(n.get("caPiecesHT")), 0.001);

        Map<String, Object> n1 = kpis.getMap("n1");
        assertEquals(2.0, nombre(n1.get("heuresRealisees")), 0.001);
        assertEquals(2.0, nombre(n1.get("heuresFacturees")), 0.001);
        assertEquals(120.0, nombre(n1.get("caMainOeuvreHT")), 0.001);

        // Mars 2005 : réalisé à la fin des prestations, facturé à l'émission de la facture
        Map<String, Object> mars = kpis.getMap("mois.find { it.mois == '2005-03' }.n");
        assertEquals(3.5, nombre(mars.get("heuresRealisees")), 0.001);
        assertEquals(3.0, nombre(mars.get("heuresFacturees")), 0.001);
        Map<String, Object> mai = kpis.getMap("mois.find { it.mois == '2005-05' }.n1");
        assertEquals(2.0, nombre(mai.get("heuresRealisees")), 0.001);
        assertEquals(12, kpis.getList("mois").size());
    }

    @Test
    void testAbsencesEtJoursTravailles() {
        int technicien = creer("/techniciens", "{\"nom\":\"Absent\",\"prenom\":\"Test\",\"email\":\"absent@kpi.test\",\"joursTravailles\":\"6, 2,3\"}");
        given().when().get("/techniciens/" + technicien).then().statusCode(200).body("joursTravailles", is("2,3,6"));
        // La semaine du lundi au vendredi est la valeur par défaut ; un jour inconnu est refusé
        given().contentType("application/json").body("{\"nom\":\"Absent\",\"prenom\":\"Test\",\"joursTravailles\":\"1,2,3,4,5\"}")
                .when().put("/techniciens/" + technicien).then().statusCode(200).body("joursTravailles", nullValue());
        given().contentType("application/json").body("{\"nom\":\"Absent\",\"prenom\":\"Test\",\"joursTravailles\":\"1,9\"}")
                .when().put("/techniciens/" + technicien).then().statusCode(400);

        String absences = "/techniciens/" + technicien + "/absences";
        given().contentType("application/json").body("{\"dateDebut\":\"2026-08-03\"}")
                .when().post(absences).then().statusCode(400);
        given().contentType("application/json").body("{\"dateDebut\":\"2026-08-07\",\"dateFin\":\"2026-08-03\"}")
                .when().post(absences).then().statusCode(400);
        int conges = creer(absences, "{\"dateDebut\":\"2026-08-03\",\"dateFin\":\"2026-08-21\",\"type\":\"CONGES\",\"motif\":\"Été\"}");
        int formation = creer(absences, "{\"dateDebut\":\"2026-10-12\",\"dateFin\":\"2026-10-12\"}");

        given().when().get(absences).then().statusCode(200)
                .body("size()", is(2))
                .body("[0].id", is(formation))
                .body("[0].type", is("AUTRE"))
                .body("[1].type", is("CONGES"))
                .body("[1].motif", is("Été"))
                .body("[1].dateFin", is("2026-08-21"));

        given().when().delete(absences + "/" + formation).then().statusCode(204);
        given().when().delete(absences + "/" + formation).then().statusCode(404);
        given().when().get(absences).then().statusCode(200).body("size()", is(1)).body("[0].id", is(conges));
        given().when().get("/techniciens/999999/absences").then().statusCode(404);

        // Le technicien supprimé emporte ses absences
        given().when().delete("/techniciens/" + technicien).then().statusCode(204);
    }

    @Test
    void testMoisInvalide() {
        given().queryParam("fin", "2005-13").when().get("/kpis-atelier").then().statusCode(400);
        given().when().get("/kpis-atelier").then().statusCode(200).body("mois.size()", is(12));
    }

    private static JsonPath kpis(String fin) {
        return given().queryParam("fin", fin).when().get("/kpis-atelier").then().statusCode(200).extract().jsonPath();
    }

    private static Map<String, Object> technicien(JsonPath kpis, int id) {
        Map<String, Object> technicien = kpis.getMap("techniciens.find { it.technicienId == " + id + " }");
        assertNotNull(technicien, "technicien " + id);
        return technicien;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> indicateurs(Map<String, Object> ligne) {
        assertNotNull(ligne);
        return (Map<String, Object>) ligne.get("n");
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
