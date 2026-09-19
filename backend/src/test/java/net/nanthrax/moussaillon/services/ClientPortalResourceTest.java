package net.nanthrax.moussaillon.services;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.empty;

@QuarkusTest
public class ClientPortalResourceTest {

    @Test
    void testConnexionReussie() {
        given()
            .contentType("application/json")
            .body("{\"email\":\"jean.dupont@test.com\",\"password\":\"client123\"}")
            .when().post("/portal/login")
            .then()
            .statusCode(200)
            .body("nom", is("Jean Dupont"))
            .body("token", notNullValue());
    }

    @Test
    void testConnexionEmailManquant() {
        given()
            .contentType("application/json")
            .body("{\"password\":\"test\"}")
            .when().post("/portal/login")
            .then()
            .statusCode(400);
    }

    @Test
    void testConnexionEmailInconnu() {
        given()
            .contentType("application/json")
            .body("{\"email\":\"unknown@test.com\",\"password\":\"test\"}")
            .when().post("/portal/login")
            .then()
            .statusCode(401);
    }

    @Test
    void testConnexionMotDePasseIncorrect() {
        given()
            .contentType("application/json")
            .body("{\"email\":\"jean.dupont@test.com\",\"password\":\"wrong\"}")
            .when().post("/portal/login")
            .then()
            .statusCode(401);
    }

    @Test
    void testObtenirClient() {
        given()
            .when().get("/portal/clients/100")
            .then()
            .statusCode(200)
            .body("nom", is("Jean Dupont"))
            .body("motDePasse", nullValue());
    }

    @Test
    void testObtenirSociete() {
        // Le portail client ne doit exposer que les champs nécessaires à l'impression
        // des devis/factures, pas le RIB d'abonnement ni les liens de paiement Stripe/Payplug.
        given()
            .when().get("/portal/societe")
            .then()
            .statusCode(200)
            .body("nom", is("MS Plaisance"))
            .body("siren", is("123456789"))
            .body("adresse", is("10 quai du Port"))
            .body("paiements", empty())
            .body("stripePaymentLinkMensuel", nullValue())
            .body("stripePaymentLinkAnnuel", nullValue())
            .body("payplugPaymentLinkMensuel", nullValue())
            .body("payplugPaymentLinkAnnuel", nullValue());
    }

    @Test
    void testObtenirClientNonTrouve() {
        given()
            .when().get("/portal/clients/9999")
            .then()
            .statusCode(404);
    }

    @Test
    void testObtenirBateauxClient() {
        given()
            .when().get("/portal/clients/100/bateaux")
            .then()
            .statusCode(200);
    }

    @Test
    void testObtenirMoteursClient() {
        given()
            .when().get("/portal/clients/100/moteurs")
            .then()
            .statusCode(200);
    }

    @Test
    void testObtenirRemorquesClient() {
        given()
            .when().get("/portal/clients/100/remorques")
            .then()
            .statusCode(200);
    }

    @Test
    void testObtenirVentesClient() {
        given()
            .when().get("/portal/clients/100/ventes")
            .then()
            .statusCode(200);
    }

    @Test
    void testObtenirAnnoncesClient() {
        given()
            .when().get("/portal/clients/100/annonces")
            .then()
            .statusCode(200);
    }

    @Test
    void testChangerMotDePasse() {
        given()
            .contentType("application/json")
            .body("{\"currentPassword\":\"client123\",\"newPassword\":\"newpass456\"}")
            .when().post("/portal/clients/100/change-password")
            .then()
            .statusCode(204);

        // verifier que le nouveau mot de passe fonctionne
        given()
            .contentType("application/json")
            .body("{\"email\":\"jean.dupont@test.com\",\"password\":\"newpass456\"}")
            .when().post("/portal/login")
            .then()
            .statusCode(200)
            .body("nom", is("Jean Dupont"))
            .body("token", notNullValue());
    }

    @Test
    void testChangerMotDePasseActuelIncorrect() {
        given()
            .contentType("application/json")
            .body("{\"currentPassword\":\"wrong\",\"newPassword\":\"newpass\"}")
            .when().post("/portal/clients/100/change-password")
            .then()
            .statusCode(401);
    }

    @Test
    void testChangerMotDePasseNouveauVide() {
        given()
            .contentType("application/json")
            .body("{\"currentPassword\":\"client123\",\"newPassword\":\"  \"}")
            .when().post("/portal/clients/100/change-password")
            .then()
            .statusCode(400);
    }

    @Test
    void testChangerMotDePasseClientNonTrouve() {
        given()
            .contentType("application/json")
            .body("{\"currentPassword\":\"test\",\"newPassword\":\"newpass\"}")
            .when().post("/portal/clients/9999/change-password")
            .then()
            .statusCode(404);
    }

    @Test
    void testChangerMotDePasseRequeteVide() {
        given()
            .contentType("application/json")
            .body("{}")
            .when().post("/portal/clients/100/change-password")
            .then()
            .statusCode(400);
    }
}
