package net.nanthrax.moussaillon.services;

import io.quarkus.test.TestTransaction;
import io.quarkus.test.junit.QuarkusTest;
import net.nanthrax.moussaillon.persistence.ClientEntity;
import net.nanthrax.moussaillon.persistence.VenteEntity;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;

/** Suivi commercial : statut prospect / client / inactif, échanges et actions commerciales à faire. */
@QuarkusTest
public class InteractionClientResourceTest {

    private static int creerClient(String nom, String statut) {
        String corps = statut == null
            ? "{\"nom\":\"" + nom + "\",\"type\":\"PARTICULIER\"}"
            : "{\"nom\":\"" + nom + "\",\"type\":\"PARTICULIER\",\"statut\":\"" + statut + "\"}";
        return given()
            .contentType("application/json")
            .body(corps)
            .when().post("/clients")
            .then()
            .statusCode(200)
            .extract().path("id");
    }

    private static int creerInteraction(String corps) {
        return given()
            .contentType("application/json")
            .body(corps)
            .when().post("/interactions")
            .then()
            .statusCode(201)
            .extract().path("id");
    }

    @Test
    void testClientsExistantsSontDesClients() {
        given().when().get("/clients/100").then().statusCode(200).body("statut", is("CLIENT"));
    }

    @Test
    void testStatutDuClient() {
        int prospect = creerClient("Prospect Statut", "PROSPECT");
        given().when().get("/clients/" + prospect).then().statusCode(200).body("statut", is("PROSPECT"));
        // Sans statut, un nouveau contact est un client
        int client = creerClient("Client Sans Statut", null);
        given().when().get("/clients/" + client).then().statusCode(200).body("statut", is("CLIENT"));

        given()
            .contentType("application/json")
            .body("{\"nom\":\"Prospect Statut\",\"type\":\"PARTICULIER\",\"statut\":\"INACTIF\"}")
            .when().put("/clients/" + prospect)
            .then()
            .statusCode(200)
            .body("statut", is("INACTIF"));
        // Une fiche enregistrée sans statut le garde
        given()
            .contentType("application/json")
            .body("{\"nom\":\"Prospect Statut\",\"type\":\"PARTICULIER\"}")
            .when().put("/clients/" + prospect)
            .then()
            .statusCode(200)
            .body("statut", is("INACTIF"));
    }

    @Test
    void testProspectDevientClientQuandSaVenteEstAcceptee() {
        int prospect = creerClient("Prospect Devis", "PROSPECT");
        int vente = given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":500.0,\"client\":{\"id\":" + prospect + "}}")
            .when().post("/ventes")
            .then()
            .statusCode(201)
            .extract().path("id");
        // Un devis en attente ne change rien
        given().when().get("/clients/" + prospect).then().statusCode(200).body("statut", is("PROSPECT"));

        given()
            .contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"bonPourAccord\":true,\"prixVenteTTC\":500.0,\"client\":{\"id\":" + prospect + "}}")
            .when().put("/ventes/" + vente)
            .then()
            .statusCode(200);
        given().when().get("/clients/" + prospect).then().statusCode(200).body("statut", is("CLIENT"));
    }

    @Test
    void testInactifRedevientClientAvecUneVenteComptoir() {
        int inactif = creerClient("Inactif Comptoir", "INACTIF");
        given()
            .contentType("application/json")
            .body("{\"status\":\"FACTURE_PRETE\",\"comptoir\":true,\"prixVenteTTC\":30.0,\"client\":{\"id\":" + inactif + "}}")
            .when().post("/ventes")
            .then()
            .statusCode(201);
        // Un client inactif qui revient n'est pas un prospect converti
        given().when().get("/clients/" + inactif).then().statusCode(200)
            .body("statut", is("CLIENT"))
            .body("dateConversion", nullValue());
    }

    @Test
    void testDateDeConversionDuProspect() {
        int prospect = creerClient("Prospect Conversion", "PROSPECT");
        given().when().get("/clients/" + prospect).then().statusCode(200).body("dateConversion", nullValue());

        // Passé client depuis sa fiche, puis repassé prospect
        modifierStatut(prospect, "Prospect Conversion", "CLIENT").body("dateConversion", notNullValue());
        modifierStatut(prospect, "Prospect Conversion", "PROSPECT").body("dateConversion", nullValue());

        // Devenu client avec une vente acceptée
        given()
            .contentType("application/json")
            .body("{\"status\":\"FACTURE_PRETE\",\"comptoir\":true,\"prixVenteTTC\":30.0,\"client\":{\"id\":" + prospect + "}}")
            .when().post("/ventes")
            .then()
            .statusCode(201);
        given().when().get("/clients/" + prospect).then().statusCode(200)
            .body("statut", is("CLIENT"))
            .body("dateConversion", notNullValue());
    }

    private static io.restassured.response.ValidatableResponse modifierStatut(int client, String nom, String statut) {
        return given()
            .contentType("application/json")
            .body("{\"nom\":\"" + nom + "\",\"type\":\"PARTICULIER\",\"statut\":\"" + statut + "\"}")
            .when().put("/clients/" + client)
            .then()
            .statusCode(200)
            .body("statut", is(statut));
    }

    @Test
    @TestTransaction
    void testConversionSansClientNiVenteAcceptee() {
        ClientEntity prospect = new ClientEntity();
        prospect.nom = "Prospect Direct";
        prospect.type = "PARTICULIER";
        prospect.statut = ClientEntity.Statut.PROSPECT;
        prospect.persist();

        VenteEntity devis = new VenteEntity();
        devis.status = VenteEntity.Status.DEVIS;
        devis.client = prospect;
        ClientResource.convertirEnClient(devis);
        assertEquals(ClientEntity.Statut.PROSPECT, prospect.statut);

        ClientResource.convertirEnClient(null);
        devis.client = null;
        devis.bonPourAccord = true;
        ClientResource.convertirEnClient(devis);
        assertEquals(ClientEntity.Statut.PROSPECT, prospect.statut);

        devis.client = prospect;
        ClientResource.convertirEnClient(devis);
        assertEquals(ClientEntity.Statut.CLIENT, prospect.statut);
    }

    @Test
    void testEchangesEtActionsDuClient() {
        int client = creerClient("Suivi Commercial", "PROSPECT");
        String demain = LocalDate.now().plusDays(1) + "T09:00:00";
        String dansUneSemaine = LocalDate.now().plusDays(7) + "T10:30:00";

        int appel = creerInteraction("{\"clientId\":" + client + ",\"type\":\"APPEL\",\"sujet\":\"Demande de devis carénage\","
            + "\"compteRendu\":\"Rappeler avec un prix\",\"date\":\"2026-10-01T14:00:00\",\"utilisateur\":\"admin\"}");
        int relance = creerInteraction("{\"clientId\":" + client + ",\"type\":\"APPEL\",\"statut\":\"A_FAIRE\","
            + "\"sujet\":\"Rappeler pour le devis\",\"date\":\"" + dansUneSemaine + "\",\"utilisateur\":\"admin\"}");
        int visite = creerInteraction("{\"clientId\":" + client + ",\"type\":\"VISITE\",\"statut\":\"A_FAIRE\","
            + "\"sujet\":\"Voir le bateau au ponton\",\"date\":\"" + demain + "\",\"utilisateur\":\"technicien1\"}");

        // Actions à faire de la plus proche à la plus lointaine, puis échanges
        given()
            .when().get("/interactions?clientId=" + client)
            .then()
            .statusCode(200)
            .body("size()", is(3))
            .body("[0].id", is(visite))
            .body("[0].statut", is("A_FAIRE"))
            .body("[0].clientNom", is("Suivi Commercial"))
            .body("[0].clientStatut", is("PROSPECT"))
            .body("[1].id", is(relance))
            .body("[2].id", is(appel))
            .body("[2].statut", is("FAITE"))
            .body("[2].type", is("APPEL"))
            .body("[2].date", is("2026-10-01T14:00:00"))
            .body("[2].compteRendu", is("Rappeler avec un prix"));

        // Fiche et liste des clients : dernier échange et prochaine action
        given()
            .when().get("/clients/" + client)
            .then()
            .statusCode(200)
            .body("derniereInteraction", is("2026-10-01T14:00:00"))
            .body("prochaineAction", is(demain));

        // Actions à faire : toutes, ou celles d'un utilisateur
        given()
            .when().get("/interactions/a-faire?utilisateur=admin")
            .then()
            .statusCode(200)
            .body("findAll { it.clientId == " + client + " }.id", is(java.util.List.of(relance)));
        given()
            .when().get("/interactions/a-faire")
            .then()
            .statusCode(200)
            .body("findAll { it.clientId == " + client + " }.id", is(java.util.List.of(visite, relance)));

        // L'action faite rejoint les échanges, avec son compte rendu
        given()
            .contentType("application/json")
            .body("{\"compteRendu\":\"Le client signe la semaine prochaine\"}")
            .when().post("/interactions/" + visite + "/terminer")
            .then()
            .statusCode(200)
            .body("statut", is("FAITE"))
            .body("dateRealisation", notNullValue())
            .body("compteRendu", is("Le client signe la semaine prochaine"));
        given()
            .contentType("application/json")
            .body("{}")
            .when().post("/interactions/" + visite + "/terminer")
            .then()
            .statusCode(400);
        given()
            .when().get("/clients/" + client)
            .then()
            .statusCode(200)
            .body("prochaineAction", is(dansUneSemaine));

        // Report de l'échéance
        given()
            .contentType("application/json")
            .body("{\"type\":\"EMAIL\",\"statut\":\"A_FAIRE\",\"sujet\":\"Envoyer le devis\",\"date\":\"2026-12-01\"}")
            .when().put("/interactions/" + relance)
            .then()
            .statusCode(200)
            .body("type", is("EMAIL"))
            .body("sujet", is("Envoyer le devis"))
            .body("date", is("2026-12-01T00:00:00"))
            .body("utilisateur", is("admin"));

        given().when().delete("/interactions/" + appel).then().statusCode(204);
        given().when().get("/interactions?clientId=" + client).then().statusCode(200).body("id", hasSize(2));
        given().when().delete("/interactions/" + appel).then().statusCode(404);
    }

    @Test
    void testActionMarqueeFaiteEnLaModifiant() {
        int client = creerClient("Action Modifiee", null);
        int action = creerInteraction("{\"clientId\":" + client + ",\"type\":\"RENDEZ_VOUS\",\"statut\":\"A_FAIRE\","
            + "\"sujet\":\"Rendez-vous hivernage\",\"date\":\"2026-11-20T10:00:00\"}");
        given()
            .contentType("application/json")
            .body("{\"type\":\"RENDEZ_VOUS\",\"statut\":\"FAITE\",\"sujet\":\"Rendez-vous hivernage\",\"date\":\"2026-11-20T10:00:00\"}")
            .when().put("/interactions/" + action)
            .then()
            .statusCode(200)
            .body("statut", is("FAITE"))
            .body("dateRealisation", notNullValue());
        given()
            .contentType("application/json")
            .body("{\"type\":\"RENDEZ_VOUS\",\"statut\":\"A_FAIRE\",\"sujet\":\"Rendez-vous hivernage\",\"date\":\"2026-11-27T10:00:00\"}")
            .when().put("/interactions/" + action)
            .then()
            .statusCode(200)
            .body("statut", is("A_FAIRE"))
            .body("dateRealisation", nullValue());
    }

    @Test
    void testEchangeDateDeMaintenantParDefaut() {
        int client = creerClient("Echange Sans Date", null);
        given()
            .contentType("application/json")
            .body("{\"clientId\":" + client + ",\"type\":\"NOTE\",\"sujet\":\"Préfère être appelé le matin\"}")
            .when().post("/interactions")
            .then()
            .statusCode(201)
            .body("statut", is("FAITE"))
            .body("date", startsWith(LocalDate.now().toString()))
            .body("dateCreation", notNullValue());
    }

    @Test
    void testSaisieInvalide() {
        given().when().get("/interactions").then().statusCode(400);
        given()
            .contentType("application/json")
            .body("{\"type\":\"APPEL\",\"sujet\":\"Sans client\"}")
            .when().post("/interactions")
            .then()
            .statusCode(400);
        given()
            .contentType("application/json")
            .body("{\"clientId\":999999,\"type\":\"APPEL\",\"sujet\":\"Client inconnu\"}")
            .when().post("/interactions")
            .then()
            .statusCode(404);
        given()
            .contentType("application/json")
            .body("{\"clientId\":100,\"type\":\"APPEL\",\"sujet\":\"  \"}")
            .when().post("/interactions")
            .then()
            .statusCode(400);
        given()
            .contentType("application/json")
            .body("{\"clientId\":100,\"sujet\":\"Sans type\"}")
            .when().post("/interactions")
            .then()
            .statusCode(400);
        given()
            .contentType("application/json")
            .body("{}")
            .when().post("/interactions/999999/terminer")
            .then()
            .statusCode(404);
    }

    @Test
    void testUtilisateursAQuiConfierUneAction() {
        given()
            .when().get("/interactions/utilisateurs")
            .then()
            .statusCode(200)
            .body("$", hasItems("admin", "technicien1"));
    }

    @Test
    void testSuppressionDuClientAvecSonSuivi() {
        int client = creerClient("Client Supprime", "PROSPECT");
        creerInteraction("{\"clientId\":" + client + ",\"type\":\"APPEL\",\"sujet\":\"Premier contact\"}");
        creerInteraction("{\"clientId\":" + client + ",\"type\":\"APPEL\",\"statut\":\"A_FAIRE\",\"sujet\":\"Rappeler\"}");

        given().when().delete("/clients/" + client).then().statusCode(204);
        given().when().get("/interactions?clientId=" + client).then().statusCode(200).body("size()", is(0));
    }

}
