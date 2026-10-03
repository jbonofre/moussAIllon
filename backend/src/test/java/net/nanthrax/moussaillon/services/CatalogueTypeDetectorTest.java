package net.nanthrax.moussaillon.services;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import net.nanthrax.moussaillon.services.CatalogueTypeDetector.Detection;
import net.nanthrax.moussaillon.services.CatalogueTypeDetector.Mode;
import net.nanthrax.moussaillon.services.CatalogueTypeDetector.Resultat;
import net.nanthrax.moussaillon.services.CatalogueTypeDetector.Type;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * L'API Anthropic est remplacée par un serveur HTTP local : aucun appel externe.
 */
public class CatalogueTypeDetectorTest {

    private static final List<String> TYPES_BATEAU = List.of("Bateau à Moteur", "Voilier");
    private static final List<String> TYPES_MOTEUR = List.of("Hors-bord", "In-bord");

    private interface Reponse {
        void repondre(HttpExchange exchange, int appel) throws IOException;
    }

    private HttpServer server;
    private Reponse reponse;
    private final List<String> corps = new CopyOnWriteArrayList<>();
    private final List<String> cles = new CopyOnWriteArrayList<>();

    @BeforeEach
    void demarrerServeur() throws IOException {
        server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        server.createContext("/v1/messages", exchange -> {
            corps.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            cles.add(exchange.getRequestHeaders().getFirst("x-api-key"));
            reponse.repondre(exchange, corps.size());
        });
        server.start();
    }

    @AfterEach
    void arreterServeur() {
        server.stop(0);
    }

    private CatalogueTypeDetector detector(String apiKey) {
        CatalogueTypeDetector detector = new CatalogueTypeDetector();
        detector.anthropicApiKey = apiKey;
        detector.anthropicModel = "test-model";
        detector.anthropicBaseUrl = "http://localhost:" + server.getAddress().getPort();
        detector.iaActivee = true;
        return detector;
    }

    private static void envoyer(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    private static String message(String texte, String stopReason) {
        return "{\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"text\",\"text\":\""
                + texte.replace("\"", "\\\"") + "\"}],\"stop_reason\":\"" + stopReason + "\"}";
    }

    @Test
    void testReglesParMotsCles() {
        assertEquals(Type.BATEAU, CatalogueTypeDetector.detecterParRegles("Quicksilver Open Activ 605"));
        assertEquals(Type.BATEAU, CatalogueTypeDetector.detecterParRegles("Jeanneau Cap Camarat 6.5 WA"));
        assertEquals(Type.MOTEUR, CatalogueTypeDetector.detecterParRegles("Mercury F115 EFI"));
        assertEquals(Type.MOTEUR, CatalogueTypeDetector.detecterParRegles("Moteur hors-bord Yamaha 40 CV"));
        assertEquals(Type.HELICE, CatalogueTypeDetector.detecterParRegles("Hélice Solas Amita 13x19"));
        assertEquals(Type.REMORQUE, CatalogueTypeDetector.detecterParRegles("REMORQUE SATELLITE MX751"));

        // pièces, accessoires et consommables liés à un bateau, un moteur, une hélice ou une remorque
        assertEquals(Type.PRODUIT, CatalogueTypeDetector.detecterParRegles("Huile Quicksilver 4T 25W40"));
        assertEquals(Type.PRODUIT, CatalogueTypeDetector.detecterParRegles("Anode Mercury F115"));
        assertEquals(Type.PRODUIT, CatalogueTypeDetector.detecterParRegles("Écrou d'hélice"));
        assertEquals(Type.PRODUIT, CatalogueTypeDetector.detecterParRegles("Roue jockey remorque"));
        assertEquals(Type.PRODUIT, CatalogueTypeDetector.detecterParRegles("Gilet de sauvetage 150N"));
        assertEquals(Type.PRODUIT, CatalogueTypeDetector.detecterParRegles(null));
    }

    @Test
    void testClassementParIa() {
        // réponse volontairement différente des règles, avec un sous-type inconnu et un numéro hors limites
        reponse = (exchange, appel) -> envoyer(exchange, 200, message("{\"elements\":["
                + "{\"i\":0,\"type\":\"bateau\",\"sousType\":\"bateau à moteur\"},"
                + "{\"i\":2,\"type\":\"helice\",\"sousType\":null},"
                + "{\"i\":3,\"type\":\"moteur\",\"sousType\":\"Fusée\"},"
                + "{\"i\":9,\"type\":\"remorque\",\"sousType\":null}]}", "end_turn"));

        Resultat resultat = detector("test-key").detecter(
                List.of("Activ 605 Open", "Mercury F115 EFI", "Vengeance 14x19", "Verado 300"), TYPES_BATEAU, TYPES_MOTEUR);

        assertEquals(Mode.IA, resultat.mode);
        List<Detection> detections = resultat.detections;
        assertEquals(4, detections.size());
        assertEquals(Type.BATEAU, detections.get(0).type);
        assertEquals("Bateau à Moteur", detections.get(0).sousType);
        assertEquals(Type.PRODUIT, detections.get(1).type);
        assertEquals(Type.HELICE, detections.get(2).type);
        assertEquals(Type.MOTEUR, detections.get(3).type);
        assertNull(detections.get(3).sousType);

        assertEquals(List.of("test-key"), cles);
        String requete = corps.get(0);
        assertTrue(requete.contains("\"model\":\"test-model\""), requete);
        assertTrue(requete.contains("\"json_schema\""), requete);
        assertTrue(requete.contains("0. Activ 605 Open"), requete);
        assertTrue(requete.contains("3. Verado 300"), requete);
    }

    @Test
    void testUnLotParCentDesignations() {
        reponse = (exchange, appel) -> envoyer(exchange, 200, message("{\"elements\":[{\"i\":0,\"type\":\"remorque\",\"sousType\":null}]}", "end_turn"));

        List<String> designations = new java.util.ArrayList<>();
        for (int i = 0; i < CatalogueTypeDetector.TAILLE_LOT + 1; i++) {
            designations.add("Article " + i);
        }
        Resultat resultat = detector("test-key").detecter(designations, TYPES_BATEAU, TYPES_MOTEUR);

        assertEquals(Mode.IA, resultat.mode);
        assertEquals(2, corps.size());
        // la première désignation de chaque lot
        assertEquals(Type.REMORQUE, resultat.detections.get(0).type);
        assertEquals(Type.PRODUIT, resultat.detections.get(1).type);
        assertEquals(Type.REMORQUE, resultat.detections.get(CatalogueTypeDetector.TAILLE_LOT).type);
    }

    @Test
    void testRepliSurLesReglesQuandIaEchoue() {
        reponse = (exchange, appel) -> envoyer(exchange, 400, "{\"type\":\"error\",\"error\":{\"type\":\"invalid_request_error\",\"message\":\"test\"}}");

        Resultat resultat = detector("test-key").detecter(List.of("Mercury F115 EFI", "Anode zinc"), TYPES_BATEAU, TYPES_MOTEUR);

        assertEquals(Mode.IA_ECHEC, resultat.mode);
        assertEquals(Type.MOTEUR, resultat.detections.get(0).type);
        assertEquals(Type.PRODUIT, resultat.detections.get(1).type);
        // une erreur 400 n'est pas réessayée
        assertEquals(1, corps.size());
    }

    @Test
    void testRepliSurLesReglesQuandLaReponseEstTronquee() {
        reponse = (exchange, appel) -> envoyer(exchange, 200, message("{\"elements\":[{\"i\":1,\"type\":\"bat", "max_tokens"));

        Resultat resultat = detector("test-key").detecter(List.of("Mercury F115 EFI", "Anode zinc"), TYPES_BATEAU, TYPES_MOTEUR);

        assertEquals(Mode.IA_ECHEC, resultat.mode);
        assertEquals(Type.MOTEUR, resultat.detections.get(0).type);
        assertEquals(Type.PRODUIT, resultat.detections.get(1).type);
    }

    @Test
    void testNouvelEssaiApresLimiteDeDebit() {
        reponse = (exchange, appel) -> {
            if (appel == 1) {
                exchange.getResponseHeaders().add("retry-after", "0");
                envoyer(exchange, 429, "{\"type\":\"error\",\"error\":{\"type\":\"rate_limit_error\",\"message\":\"test\"}}");
            } else {
                envoyer(exchange, 200, message("{\"elements\":[{\"i\":0,\"type\":\"bateau\",\"sousType\":\"Voilier\"}]}", "end_turn"));
            }
        };

        Resultat resultat = detector("test-key").detecter(List.of("First 210"), TYPES_BATEAU, TYPES_MOTEUR);

        assertEquals(Mode.IA, resultat.mode);
        assertEquals(Type.BATEAU, resultat.detections.get(0).type);
        assertEquals("Voilier", resultat.detections.get(0).sousType);
        assertEquals(2, corps.size());
    }

    @Test
    void testReglesSansIa() {
        reponse = (exchange, appel) -> envoyer(exchange, 500, "{}");

        for (String apiKey : new String[] { "", "not-set", null }) {
            Resultat resultat = detector(apiKey).detecter(List.of("Quicksilver Open Activ 605"), TYPES_BATEAU, TYPES_MOTEUR);
            assertEquals(Mode.REGLES, resultat.mode);
            assertEquals(Type.BATEAU, resultat.detections.get(0).type);
        }

        CatalogueTypeDetector desactive = detector("test-key");
        desactive.iaActivee = false;
        assertEquals(Mode.REGLES, desactive.detecter(List.of("Quicksilver Open Activ 605"), TYPES_BATEAU, TYPES_MOTEUR).mode);

        assertTrue(corps.isEmpty());
    }
}
