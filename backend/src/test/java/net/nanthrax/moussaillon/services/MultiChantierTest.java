package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.specification.RequestSpecification;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Plusieurs chantiers sur une instance : chacun ne voit que ses données, se connecte avec son code et garde ses
 * propres utilisateurs. Les requêtes sans jeton ni code portent sur le chantier test (chantier.par-defaut).
 */
@QuarkusTest
public class MultiChantierTest {

    static final String AUTRE = "voisin";

    @Inject
    Chantiers chantiers;

    static RequestSpecification dans(String chantier) {
        return given().header(ChantierFilter.ENTETE, chantier);
    }

    static RequestSpecification avecJeton(String jeton) {
        return given().header("Authorization", "Bearer " + jeton);
    }

    static void creerChantier(String code, String nom) {
        given()
            .contentType("application/json")
            .body("{\"code\":\"" + code + "\",\"nom\":\"" + nom + "\",\"email\":\"contact@" + code + ".fr\","
                + "\"utilisateur\":\"admin\",\"motDePasse\":\"secret-" + code + "\",\"gratuit\":true}")
            .when().post("/admin/chantiers")
            .then()
            .statusCode(201);
    }

    static void supprimerChantier(String code) {
        given().queryParam("confirmation", code).when().delete("/admin/chantiers/" + code);
    }

    static String connexion(String chantier, String nom, String motDePasse) {
        return dans(chantier)
            .contentType("application/json")
            .body("{\"name\":\"" + nom + "\",\"password\":\"" + motDePasse + "\"}")
            .when().post("/users/authenticate")
            .then()
            .statusCode(200)
            .body("chantier", is(chantier))
            .extract().path("token");
    }

    // RestAssured n'est configuré qu'autour de chaque test : le chantier est créé par le premier.
    @BeforeEach
    void creerAutreChantier() {
        if (given().when().get("/admin/chantiers/" + AUTRE).statusCode() == 404) {
            creerChantier(AUTRE, "Chantier Voisin");
        }
    }

    @Test
    void testNouveauChantierInitialise() {
        dans(AUTRE)
            .when().get("/societe")
            .then()
            .statusCode(200)
            .body("nom", is("Chantier Voisin"))
            .body("email", is("contact@" + AUTRE + ".fr"))
            .body("versionFree", is(true))
            .body("abonnementNombreUtilisateurs", is(1));

        dans(AUTRE).when().get("/users").then().statusCode(200)
            .body("size()", is(1))
            .body("[0].name", is("admin"))
            .body("[0].id", nullValue());

        dans(AUTRE).when().get("/reference-valeurs").then().statusCode(200)
            .body("size()", greaterThanOrEqualTo(1));

        dans(AUTRE).when().get("/clients").then().statusCode(200).body("nom", not(hasItem("Jean Dupont")));
    }

    @Test
    void testDonneesIsoleesEntreChantiers() {
        int client = dans(AUTRE)
            .contentType("application/json")
            .body("{\"nom\":\"Client Voisin\",\"type\":\"Particulier\",\"email\":\"client@voisin.fr\"}")
            .when().post("/clients")
            .then().statusCode(200).extract().path("id");

        List<String> nomsTest = given().when().get("/clients").then().statusCode(200).extract().path("nom");
        assertFalse(nomsTest.contains("Client Voisin"));
        assertTrue(nomsTest.contains("Jean Dupont"));

        dans(AUTRE).when().get("/clients").then().statusCode(200)
            .body("nom", hasItem("Client Voisin"))
            .body("nom", not(hasItem("Jean Dupont")));

        // Ni lecture ni modification ni suppression d'une donnée d'un autre chantier par son identifiant
        given().when().get("/clients/" + client).then().statusCode(404);
        dans(AUTRE).when().get("/clients/100").then().statusCode(404);
        given().when().delete("/clients/" + client).then().statusCode(404);
        dans(AUTRE).when().get("/clients/" + client).then().statusCode(200);
    }

    @Test
    void testMiseAJourEnMasseLimiteeAuChantier() {
        // Clients 100 et 101 du chantier test (consentement donné), désignés depuis l'autre chantier
        dans(AUTRE)
            .contentType("application/json")
            .body("{\"ids\":[100,101],\"consentement\":false}")
            .when().put("/clients/consentement")
            .then()
            .statusCode(200)
            .body("modifies", is(0));
        given().when().get("/clients/100").then().statusCode(200).body("consentement", is(true));
    }

    @Test
    void testMemesNomsDansDeuxChantiers() {
        // Fournisseur et utilisateur du même nom que ceux du chantier test (contraintes d'unicité par chantier)
        dans(AUTRE)
            .contentType("application/json")
            .body("{\"nom\":\"Marine Parts SA\",\"email\":\"mp@voisin.fr\"}")
            .when().post("/catalogue/fournisseurs")
            .then().statusCode(anyOf(is(200), is(201)));
        dans(AUTRE)
            .contentType("application/json")
            .body("{\"name\":\"technicien1\",\"password\":\"voisin123\",\"email\":\"t1@voisin.fr\",\"modules\":[\"ATELIER\"]}")
            .when().post("/users")
            .then().statusCode(201);

        // Deux utilisateurs technicien1, chacun avec son mot de passe dans son chantier
        connexion(AUTRE, "technicien1", "voisin123");
        connexion("test", "technicien1", "tech123");
        dans(AUTRE)
            .contentType("application/json")
            .body("{\"name\":\"technicien1\",\"password\":\"tech123\"}")
            .when().post("/users/authenticate")
            .then().statusCode(401);

        // Un nom déjà pris dans le chantier est refusé
        dans(AUTRE)
            .contentType("application/json")
            .body("{\"name\":\"technicien1\",\"password\":\"autre\",\"email\":\"t1b@voisin.fr\"}")
            .when().post("/users")
            .then().statusCode(400);
    }

    @Test
    void testJetonPorteLeChantier() {
        String jeton = connexion(AUTRE, "admin", "secret-" + AUTRE);

        // Le jeton désigne le chantier, quel que soit l'en-tête X-Chantier
        avecJeton(jeton).when().get("/societe").then().statusCode(200).body("nom", is("Chantier Voisin"));
        avecJeton(jeton).header(ChantierFilter.ENTETE, "test")
            .when().get("/societe").then().statusCode(200).body("nom", is("Chantier Voisin"));

        // Jeton sans chantier (émis avant le multi-chantier) : il faut se reconnecter
        String ancien = new TokenService().generateToken(null, "admin", java.util.Set.of(AccesApiFilter.GROUPE_CHANTIER, "PARAMETRAGE"), "", null);
        avecJeton(ancien).when().get("/societe").then().statusCode(401);
    }

    @Test
    void testCodeChantierInconnu() {
        dans("inconnu")
            .contentType("application/json")
            .body("{\"name\":\"admin\",\"password\":\"admin123\"}")
            .when().post("/users/authenticate")
            .then()
            .statusCode(401)
            .body(containsString("Code chantier inconnu"));

        // Le code est aussi accepté en paramètre (lien ?chantier=code), sans tenir compte de la casse
        given().queryParam("chantier", AUTRE.toUpperCase())
            .when().get("/societe")
            .then().statusCode(200).body("nom", is("Chantier Voisin"));
    }

    @Test
    void testAccesSuspendu() {
        String jeton = connexion(AUTRE, "admin", "secret-" + AUTRE);
        try {
            given().contentType("application/json").body("{\"accesSuspendu\":true}")
                .when().put("/admin/chantiers/" + AUTRE)
                .then().statusCode(200)
                .body("chantier.accesSuspendu", is(true))
                .body("chantier.accesSuspenduDate", notNullValue());

            // Connexions refusées, jetons en cours rejetés (déconnexion), tâches de fond arrêtées
            dans(AUTRE)
                .contentType("application/json")
                .body("{\"name\":\"admin\",\"password\":\"secret-" + AUTRE + "\"}")
                .when().post("/users/authenticate")
                .then()
                .statusCode(403)
                .body(containsString("suspendu"))
                .body(containsString("admin@moussaillon.test"));
            dans(AUTRE)
                .contentType("application/json")
                .body("{\"email\":\"client@voisin.fr\",\"password\":\"x\"}")
                .when().post("/portal/login")
                .then().statusCode(403);
            avecJeton(jeton).when().get("/clients").then().statusCode(401);
            assertFalse(chantiers.actifs().contains(AUTRE));
            assertTrue(chantiers.actifs().contains("test"));

            // Les autres chantiers ne sont pas concernés
            given().when().get("/societe").then().statusCode(200);
        } finally {
            given().contentType("application/json").body("{\"accesSuspendu\":false}")
                .when().put("/admin/chantiers/" + AUTRE)
                .then().statusCode(200).body("chantier.accesSuspendu", is(false));
        }
        avecJeton(jeton).when().get("/clients").then().statusCode(200);
    }

    @Test
    void testPortailsSelonLeChantier() {
        dans(AUTRE)
            .contentType("application/json")
            .body("{\"nom\":\"Durand\",\"prenom\":\"Marc\",\"email\":\"pierre.leclerc@test.com\",\"motDePasse\":\"voisin456\"}")
            .when().post("/techniciens")
            .then().statusCode(200);

        // Même email de technicien dans deux chantiers : chacun se connecte dans le sien
        dans(AUTRE)
            .contentType("application/json")
            .body("{\"email\":\"pierre.leclerc@test.com\",\"motDePasse\":\"voisin456\"}")
            .when().post("/technicien-portal/login")
            .then().statusCode(200).body("nom", is("Durand"));
        given()
            .contentType("application/json")
            .body("{\"email\":\"pierre.leclerc@test.com\",\"motDePasse\":\"tech456\"}")
            .when().post("/technicien-portal/login")
            .then().statusCode(200).body("nom", is("Leclerc"));

        // Le client du chantier test n'existe pas dans l'autre chantier
        dans(AUTRE)
            .contentType("application/json")
            .body("{\"email\":\"jean.dupont@test.com\",\"password\":\"client123\"}")
            .when().post("/portal/login")
            .then().statusCode(401);
    }

    @Test
    void testFluxAnnoncesDuChantierDeLaPlateforme() {
        String url = dans(AUTRE)
            .contentType("application/json")
            .body("{\"actif\":true,\"format\":\"NAUTIX\"}")
            .when().put("/plateformes-annonces/youboat")
            .then().statusCode(200).extract().path("urlFlux");
        String jeton = url.substring(url.indexOf("token=") + "token=".length());

        // Le jeton de la plateforme suffit : le flux est celui de son chantier
        String xml = given().queryParam("token", jeton)
            .when().get("/flux/annonces/youboat.xml")
            .then().statusCode(200).extract().asString();
        assertTrue(xml.contains("Chantier Voisin"), xml);

        given().queryParam("token", "faux").when().get("/flux/annonces/youboat.xml").then().statusCode(404);
    }

}
