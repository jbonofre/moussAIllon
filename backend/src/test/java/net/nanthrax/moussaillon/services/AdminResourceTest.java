package net.nanthrax.moussaillon.services;

import io.quarkus.arc.Arc;
import io.quarkus.arc.ManagedContext;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.response.ValidatableResponse;
import jakarta.inject.Inject;
import net.nanthrax.moussaillon.persistence.ReferenceValeurEntity;
import org.junit.jupiter.api.Test;

import java.util.List;

import static io.restassured.RestAssured.given;
import static net.nanthrax.moussaillon.services.MultiChantierTest.avecJeton;
import static net.nanthrax.moussaillon.services.MultiChantierTest.connexion;
import static net.nanthrax.moussaillon.services.MultiChantierTest.creerChantier;
import static net.nanthrax.moussaillon.services.MultiChantierTest.dans;
import static net.nanthrax.moussaillon.services.MultiChantierTest.supprimerChantier;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Application d'administration : connexion de l'administrateur de l'instance (application.properties),
 * création, changement de code, abonnement, suspension et suppression des chantiers.
 */
@QuarkusTest
public class AdminResourceTest {

    @Inject
    Chantiers chantiers;

    private static String jetonAdmin() {
        return given()
            .contentType("application/json")
            .body("{\"name\":\"superadmin\",\"password\":\"superadmin123\"}")
            .when().post("/admin/authenticate")
            .then()
            .statusCode(200)
            .body("email", is("admin@moussaillon.test"))
            .extract().path("token");
    }

    @Test
    void testConnexionAdministrateur() {
        given()
            .contentType("application/json")
            .body("{\"name\":\"superadmin\",\"password\":\"faux\"}")
            .when().post("/admin/authenticate")
            .then().statusCode(401);
        given()
            .contentType("application/json")
            .body("{\"name\":\"admin\",\"password\":\"admin123\"}")
            .when().post("/admin/authenticate")
            .then().statusCode(401);

        String jeton = jetonAdmin();
        avecJeton(jeton).when().get("/admin/chantiers").then().statusCode(200)
            .body("chantier.code", hasItem("test"));
        // L'administrateur n'accède pas aux données des chantiers, ni un utilisateur d'un chantier à l'administration
        avecJeton(jeton).when().get("/clients").then().statusCode(403);
        String utilisateur = connexion("test", "admin", "admin123");
        avecJeton(utilisateur).when().get("/admin/chantiers").then().statusCode(403);
    }

    @Test
    void testCreationValidee() {
        String valide = "{\"code\":\"%s\",\"nom\":\"Nom\",\"email\":\"a@b.fr\",\"motDePasse\":\"x\"}";
        given().contentType("application/json").body(String.format(valide, "A"))
            .when().post("/admin/chantiers").then().statusCode(400).body(containsString("Code chantier invalide"));
        given().contentType("application/json").body(String.format(valide, "-tiret"))
            .when().post("/admin/chantiers").then().statusCode(400);
        given().contentType("application/json").body(String.format(valide, "avec espace"))
            .when().post("/admin/chantiers").then().statusCode(400);
        given().contentType("application/json").body(String.format(valide, "test"))
            .when().post("/admin/chantiers").then().statusCode(400).body(containsString("existe déjà"));
        given().contentType("application/json").body("{\"code\":\"sans-mdp\",\"nom\":\"Nom\",\"email\":\"a@b.fr\"}")
            .when().post("/admin/chantiers").then().statusCode(400).body(containsString("mot de passe"));
        given().when().get("/admin/chantiers/sans-mdp").then().statusCode(404);
    }

    @Test
    void testCreationAvecModulesEtPremierUtilisateur() {
        String code = "port-modules";
        supprimerChantier(code);
        try {
            given()
                .contentType("application/json")
                .body("{\"code\":\"Port-Modules\",\"nom\":\"Port Modules\",\"email\":\"contact@port.fr\","
                    + "\"utilisateur\":\"directeur\",\"motDePasse\":\"port123\",\"modules\":[\"VENTE\",\"ATELIER\"]}")
                .when().post("/admin/chantiers")
                .then()
                .statusCode(201)
                .body("chantier.code", is(code))
                .body("chantier.gratuit", is(false))
                .body("chantier.dateCreation", notNullValue())
                .body("societe.nom", is("Port Modules"))
                .body("societe.modules", containsInAnyOrder("VENTE", "ATELIER", "PARAMETRAGE"))
                .body("societe.abonnementActif", is(false))
                .body("societe.accesLimiteFacturation", is(true));

            // Le premier utilisateur a les modules souscrits ; sans abonnement activé, l'accès est limité à la facturation
            dans(code)
                .contentType("application/json")
                .body("{\"name\":\"directeur\",\"password\":\"port123\"}")
                .when().post("/users/authenticate")
                .then()
                .statusCode(200)
                .body("modules", containsInAnyOrder("VENTE", "ATELIER", "PARAMETRAGE"))
                .body("accesLimiteFacturation", is(true));
        } finally {
            supprimerChantier(code);
        }
    }

    private static ValidatableResponse changerCode(String code, String nouveau) {
        return given().contentType("application/json").body("{\"code\":\"" + nouveau + "\"}")
            .when().put("/admin/chantiers/" + code + "/code")
            .then();
    }

    /** Exécute le traitement hors requête HTTP (contexte de requête activé pour l'occasion). */
    private static void horsRequete(Runnable traitement) {
        ManagedContext contexte = Arc.container().requestContext();
        contexte.activate();
        try {
            traitement.run();
        } finally {
            contexte.terminate();
        }
    }

    @Test
    void testChangementCode() {
        String ancien = "port-ancien";
        String nouveau = "port-nouveau";
        supprimerChantier(ancien);
        supprimerChantier(nouveau);
        try {
            creerChantier(ancien, "Port Ancien");
            int client = dans(ancien).contentType("application/json")
                .body("{\"nom\":\"Client Renomme\",\"type\":\"Particulier\",\"email\":\"renomme@port.fr\"}")
                .when().post("/clients").then().statusCode(200).extract().path("id");
            String jeton = connexion(ancien, "admin", "secret-" + ancien);
            int clientsTest = given().when().get("/clients").then().statusCode(200).extract().path("size()");

            changerCode(ancien, "A").statusCode(400).body(containsString("Code chantier invalide"));
            changerCode(ancien, "test").statusCode(400).body(containsString("existe déjà"));
            changerCode("test", nouveau).statusCode(400).body(containsString("chantier par défaut"));
            changerCode("inconnu", nouveau).statusCode(404);
            changerCode(ancien, ancien).statusCode(200).body("chantier.code", is(ancien));

            changerCode(ancien, " Port-Nouveau ").statusCode(200)
                .body("chantier.code", is(nouveau))
                .body("chantier.nom", is("Port Ancien"))
                .body("chantier.gratuit", is(true))
                .body("societe.nom", is("Port Ancien"));

            given().when().get("/admin/chantiers/" + ancien).then().statusCode(404);
            List<String> codes = given().when().get("/admin/chantiers").then().statusCode(200).extract().path("chantier.code");
            assertTrue(codes.contains(nouveau) && !codes.contains(ancien));
            // Les jetons de l'ancien code sont refusés ; on se reconnecte avec le nouveau, sans changer de mot de passe
            avecJeton(jeton).when().get("/clients").then().statusCode(401);
            dans(ancien).contentType("application/json").body("{\"name\":\"admin\",\"password\":\"secret-" + ancien + "\"}")
                .when().post("/users/authenticate").then().statusCode(401);
            String nouveauJeton = connexion(nouveau, "admin", "secret-" + ancien);
            avecJeton(nouveauJeton).when().get("/clients").then().statusCode(200)
                .body("size()", is(1))
                .body("id", hasItem(client));
            // Le chantier test n'est pas concerné
            assertEquals(clientsTest, (int) given().when().get("/clients").then().statusCode(200).extract().path("size()"));
        } finally {
            supprimerChantier(ancien);
            supprimerChantier(nouveau);
        }
    }

    @Test
    void testChangementCodeVersDonneesOrphelines() {
        String code = "port-orphelin";
        String orphelin = "code-orphelin";
        supprimerChantier(code);
        creerChantier(code, "Port Orphelin");
        // Données d'un code absent du registre : le chantier renommé les récupérerait
        horsRequete(() -> chantiers.dans(orphelin, () -> {
            ReferenceValeurEntity reference = new ReferenceValeurEntity();
            reference.type = "TEST";
            reference.valeur = "orpheline";
            reference.persist();
        }));
        try {
            changerCode(code, orphelin).statusCode(400).body(containsString("Des données portent déjà le code " + orphelin));
            given().when().get("/admin/chantiers/" + code).then().statusCode(200);
        } finally {
            horsRequete(() -> chantiers.enRacine(() -> {
                ReferenceValeurEntity.delete("chantier = ?1", orphelin);
            }));
            supprimerChantier(code);
        }
    }

    @Test
    void testGestionAbonnement() {
        String code = "port-abonnement";
        supprimerChantier(code);
        try {
            given()
                .contentType("application/json")
                .body("{\"code\":\"" + code + "\",\"nom\":\"Port Abonnement\",\"email\":\"contact@abo.fr\",\"motDePasse\":\"abo123\"}")
                .when().post("/admin/chantiers")
                .then().statusCode(201);

            // Abonnement gratuit : plus de limitation, sans activation
            given().contentType("application/json").body("{\"gratuit\":true,\"nom\":\"Port Abonnement Gratuit\"}")
                .when().put("/admin/chantiers/" + code)
                .then().statusCode(200)
                .body("chantier.gratuit", is(true))
                .body("chantier.nom", is("Port Abonnement Gratuit"))
                .body("societe.versionFree", is(true))
                .body("societe.accesLimiteFacturation", is(false));
            dans(code).when().get("/societe").then().statusCode(200).body("versionFree", is(true));
            given().contentType("application/json").body("{\"gratuit\":false}")
                .when().put("/admin/chantiers/" + code)
                .then().statusCode(200).body("societe.accesLimiteFacturation", is(true));

            // Paiement reçu par virement : l'abonnement est activé
            given().contentType("application/json").body("{\"type\":\"MENSUEL\",\"mode\":\"VIREMENT\"}")
                .when().post("/admin/chantiers/" + code + "/paiements")
                .then().statusCode(200)
                .body("societe.abonnementActif", is(true))
                .body("societe.abonnementAJour", is(true))
                .body("societe.accesLimiteFacturation", is(false))
                .body("societe.paiements.size()", is(1))
                .body("societe.paiements[0].montantActivation", is(350.0f));

            // Modules ajoutés par l'administrateur, sans paiement
            given().contentType("application/json").body("[\"VENTE\",\"COMPTABILITE\"]")
                .when().put("/admin/chantiers/" + code + "/modules")
                .then().statusCode(200)
                .body("societe.modules", containsInAnyOrder("VENTE", "COMPTABILITE", "PARAMETRAGE"))
                .body("societe.paiements.size()", is(1));
            dans(code).when().get("/users/admin").then().statusCode(200)
                .body("modules", containsInAnyOrder("VENTE", "COMPTABILITE", "PARAMETRAGE"));

            // Résiliation et réactivation
            given().when().post("/admin/chantiers/" + code + "/resilier")
                .then().statusCode(200)
                .body("societe.abonnementResilie", is(true))
                .body("societe.abonnementBlocageDate", notNullValue());
            given().when().post("/admin/chantiers/" + code + "/reactiver")
                .then().statusCode(200).body("societe.abonnementResilie", is(false));

            // Le chantier test n'est pas concerné
            given().when().get("/societe").then().statusCode(200).body("nom", is("MS Plaisance"));
        } finally {
            supprimerChantier(code);
        }
    }

    @Test
    void testSuppressionChantier() {
        String code = "port-supprime";
        supprimerChantier(code);
        int clientsTest = given().when().get("/clients").then().statusCode(200).extract().path("size()");
        creerChantier(code, "Port Supprime");

        // Données variées : client, technicien, bateau et ses propriétaires, vente, utilisateur et ses modules,
        // paiement de l'abonnement et ses mois
        int client = dans(code).contentType("application/json")
            .body("{\"nom\":\"Client A Supprimer\",\"type\":\"Particulier\",\"email\":\"cas@port.fr\"}")
            .when().post("/clients").then().statusCode(200).extract().path("id");
        int technicien = dans(code).contentType("application/json")
            .body("{\"nom\":\"Durand\",\"prenom\":\"Marc\",\"email\":\"marc@port.fr\"}")
            .when().post("/techniciens").then().statusCode(200).extract().path("id");
        dans(code).contentType("application/json")
            .body("{\"name\":\"Bateau A Supprimer\",\"immatriculation\":\"SUP-1\",\"proprietaires\":[{\"id\":" + client + "}]}")
            .when().post("/bateaux").then().statusCode(201);
        dans(code).contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":100.0,\"client\":{\"id\":" + client + "},"
                + "\"venteServices\":[{\"quantite\":1,\"techniciens\":[{\"id\":" + technicien + "}]}]}")
            .when().post("/ventes").then().statusCode(201);
        dans(code).contentType("application/json")
            .body("{\"name\":\"vendeur\",\"password\":\"v\",\"email\":\"v@port.fr\",\"modules\":[\"VENTE\"]}")
            .when().post("/users").then().statusCode(201);
        given().contentType("application/json").body("{\"type\":\"ANNUEL\",\"mode\":\"CARTE\"}")
            .when().post("/admin/chantiers/" + code + "/paiements").then().statusCode(200);
        // Référence forgée vers le client du chantier supprimé, depuis le chantier test
        int venteTest = given().contentType("application/json")
            .body("{\"status\":\"DEVIS\",\"prixVenteTTC\":10.0,\"client\":{\"id\":" + client + "}}")
            .when().post("/ventes").then().statusCode(201).extract().path("id");

        // Le code du chantier doit être confirmé
        given().queryParam("confirmation", "autre").when().delete("/admin/chantiers/" + code)
            .then().statusCode(400);
        given().when().delete("/admin/chantiers/" + code).then().statusCode(400);

        given().queryParam("confirmation", code).when().delete("/admin/chantiers/" + code)
            .then().statusCode(204);

        given().when().get("/admin/chantiers/" + code).then().statusCode(404);
        List<String> codes = given().when().get("/admin/chantiers").then().statusCode(200).extract().path("chantier.code");
        assertTrue(!codes.contains(code));
        dans(code).when().get("/clients").then().statusCode(401);
        // Les données du chantier test sont intactes (la vente forgée perd seulement sa référence)
        assertEquals(clientsTest, (int) given().when().get("/clients").then().statusCode(200).extract().path("size()"));
        given().when().get("/ventes/" + venteTest).then().statusCode(200);
        given().when().get("/societe").then().statusCode(200).body("nom", is("MS Plaisance"));

        // Le code est de nouveau disponible
        creerChantier(code, "Port Recree");
        dans(code).when().get("/clients").then().statusCode(200).body("size()", is(0));
        dans(code).when().get("/users").then().statusCode(200).body("size()", is(1));
        supprimerChantier(code);
        given().when().delete("/ventes/" + venteTest);
    }

}
