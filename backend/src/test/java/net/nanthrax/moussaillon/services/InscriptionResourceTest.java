package net.nanthrax.moussaillon.services;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.MockMailbox;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.specification.RequestSpecification;
import jakarta.inject.Inject;
import net.nanthrax.moussaillon.persistence.ChantierEntity;
import org.junit.jupiter.api.Test;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static io.restassured.RestAssured.given;
import static net.nanthrax.moussaillon.services.MultiChantierTest.avecJeton;
import static net.nanthrax.moussaillon.services.MultiChantierTest.dans;
import static net.nanthrax.moussaillon.services.MultiChantierTest.horsRequete;
import static net.nanthrax.moussaillon.services.MultiChantierTest.supprimerChantier;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.hasItems;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Inscription d'un chantier depuis l'espace chantier : création immédiate, essai gratuit d'un mois, emails de
 * bienvenue et d'avis à l'administrateur, limite par adresse IP. Chaque test s'inscrit depuis sa propre adresse.
 */
@QuarkusTest
public class InscriptionResourceTest {

    @Inject
    MockMailbox mailbox;

    @Inject
    Chantiers chantiers;

    private static RequestSpecification depuis(String adresse) {
        return given().header("X-Real-IP", adresse).contentType("application/json");
    }

    private static String inscription(String nom, String code, String email, String motDePasse) {
        return "{\"nom\":\"" + nom + "\",\"code\":\"" + code + "\",\"email\":\"" + email + "\","
            + "\"utilisateur\":\"gerant\",\"motDePasse\":\"" + motDePasse + "\"}";
    }

    /** Inscrit le chantier et renvoie la fin de son essai gratuit. */
    private static String inscrire(String adresse, String code) {
        return depuis(adresse).body(inscription("Port " + code, code, "contact@" + code + ".fr", "motdepasse"))
            .when().post("/inscription")
            .then().statusCode(201)
            .extract().path("essaiFin");
    }

    private static String connexion(String code) {
        return dans(code).contentType("application/json").body("{\"name\":\"gerant\",\"password\":\"motdepasse\"}")
            .when().post("/users/authenticate")
            .then().statusCode(200)
            .extract().path("token");
    }

    @Test
    void testConfiguration() {
        given().when().get("/inscription").then().statusCode(200)
            .body("active", is(true))
            .body("essaiMois", is(1));
    }

    @Test
    void testInscriptionAvecEssaiGratuit() {
        String code = "port-inscrit";
        supprimerChantier(code);
        mailbox.clear();
        try {
            String essaiFin = depuis("10.0.0.1").body(inscription("Port Inscrit", " Port-Inscrit ", "contact@inscrit.fr", "motdepasse"))
                .when().post("/inscription")
                .then().statusCode(201)
                .body("code", is(code))
                .body("utilisateur", is("gerant"))
                .extract().path("essaiFin");
            assertTrue(essaiFin.startsWith(LocalDate.now().plusMonths(1).toString()), essaiFin);

            // Connexion aussitôt, avec tous les modules, sans limitation à la facturation pendant l'essai
            String jeton = dans(code).contentType("application/json").body("{\"name\":\"gerant\",\"password\":\"motdepasse\"}")
                .when().post("/users/authenticate")
                .then().statusCode(200)
                .body("accesLimiteFacturation", is(false))
                .body("abonnementActif", is(false))
                .body("modules", hasItems("VENTE", "PARC", "CATALOGUE", "ATELIER", "MARKETING", "COMPTABILITE", "PARAMETRAGE"))
                .extract().path("token");
            avecJeton(jeton).when().get("/societe").then().statusCode(200)
                .body("nom", is("Port Inscrit"))
                .body("enEssai", is(true))
                .body("essaiFin", is(essaiFin))
                .body("accesLimiteFacturation", is(false));
            avecJeton(jeton).when().get("/clients").then().statusCode(200);

            // Bienvenue au chantier (son code et son utilisateur), avis à l'administrateur
            List<Mail> bienvenue = mailbox.getMailsSentTo("contact@inscrit.fr");
            assertEquals(1, bienvenue.size());
            assertTrue(bienvenue.get(0).getText().contains("Code chantier : " + code));
            assertTrue(bienvenue.get(0).getText().contains("Utilisateur : gerant"));
            List<Mail> avis = mailbox.getMailsSentTo("admin@moussaillon.test");
            assertEquals(1, avis.size());
            assertTrue(avis.get(0).getSubject().contains(code));

            // L'administrateur voit l'essai en cours
            given().when().get("/admin/chantiers/" + code).then().statusCode(200)
                .body("chantier.essaiFin", is(essaiFin))
                .body("chantier.gratuit", is(false))
                .body("societe.enEssai", is(true));
        } finally {
            supprimerChantier(code);
        }
    }

    @Test
    void testFinEssai() {
        String code = "port-essai-fini";
        supprimerChantier(code);
        try {
            inscrire("10.0.0.2", code);
            horsRequete(() -> chantiers.dans(code, () -> {
                ChantierEntity chantier = ChantierEntity.findById(code);
                chantier.essaiFin = Timestamp.valueOf(LocalDateTime.now().minusDays(1));
            }));

            // Essai terminé sans abonnement activé : accès limité à la facturation
            String jeton = connexion(code);
            avecJeton(jeton).when().get("/societe").then().statusCode(200)
                .body("enEssai", is(false))
                .body("accesLimiteFacturation", is(true));
            avecJeton(jeton).when().get("/clients").then().statusCode(403)
                .body(containsString("la période d'essai gratuite est terminée"));
        } finally {
            supprimerChantier(code);
        }
    }

    @Test
    void testActivationPendantEssai() {
        String code = "port-essai-paye";
        supprimerChantier(code);
        try {
            String essaiFin = inscrire("10.0.0.3", code);
            // Le premier mois payé commence à la fin de l'essai, qui n'est pas écourté
            given().contentType("application/json").body("{\"type\":\"MENSUEL\",\"mode\":\"VIREMENT\"}")
                .when().post("/admin/chantiers/" + code + "/paiements")
                .then().statusCode(200)
                .body("societe.abonnementActif", is(true))
                .body("societe.enEssai", is(false))
                .body("societe.accesLimiteFacturation", is(false))
                .body("societe.paiements[0].periodeDebut", is(essaiFin))
                .body("societe.paiements[0].montantActivation", is(350.0f));
        } finally {
            supprimerChantier(code);
        }
    }

    @Test
    void testInscriptionValidee() {
        String adresse = "10.0.0.4";
        depuis(adresse).body(inscription("Port", "test", "a@b.fr", "motdepasse"))
            .when().post("/inscription").then().statusCode(400).body(containsString("existe déjà"));
        depuis(adresse).body(inscription("Port", "-port", "a@b.fr", "motdepasse"))
            .when().post("/inscription").then().statusCode(400).body(containsString("Code chantier invalide"));
        depuis(adresse).body(inscription("Port", "port-email", "pas-un-email", "motdepasse"))
            .when().post("/inscription").then().statusCode(400).body(containsString("email"));
        depuis(adresse).body(inscription("Port", "port-court", "a@b.fr", "court"))
            .when().post("/inscription").then().statusCode(400).body(containsString("8 caractères"));
        depuis(adresse).body(inscription(" ", "port-sans-nom", "a@b.fr", "motdepasse"))
            .when().post("/inscription").then().statusCode(400).body(containsString("nom"));
        given().when().get("/admin/chantiers/port-email").then().statusCode(404);
    }

    @Test
    void testLimiteParAdresse() {
        List<String> codes = List.of("port-limite-1", "port-limite-2", "port-limite-3", "port-limite-4");
        codes.forEach(MultiChantierTest::supprimerChantier);
        try {
            for (String code : codes.subList(0, 3)) {
                inscrire("10.0.0.5", code);
            }
            depuis("10.0.0.5").body(inscription("Port Limite", "port-limite-4", "contact@limite.fr", "motdepasse"))
                .when().post("/inscription").then().statusCode(429);
            given().when().get("/admin/chantiers/port-limite-4").then().statusCode(404);
            // Une autre adresse n'est pas concernée
            inscrire("10.0.0.6", "port-limite-4");
        } finally {
            codes.forEach(MultiChantierTest::supprimerChantier);
        }
    }

}
