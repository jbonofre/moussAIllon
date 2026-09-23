package net.nanthrax.moussaillon.cli;

import com.github.tomakehurst.wiremock.WireMockServer;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import picocli.CommandLine;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;

import static com.github.tomakehurst.wiremock.client.WireMock.*;
import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
@QuarkusTestResource(WireMockResource.class)
class MoteurCommandTest {

    @InjectWireMock
    WireMockServer wireMock;

    @Inject
    CommandLine.IFactory factory;

    @BeforeEach
    void resetStubs() {
        wireMock.resetAll();
    }

    @Test
    void testListerMoteursViaCommande() {
        wireMock.stubFor(get(urlEqualTo("/catalogue/moteurs"))
                .willReturn(okJson("[{\"id\":1,\"designation\":\"Yamaha F150\",\"type\":\"Hors-bord\"}]")));

        int exitCode = new CommandLine(MoteurCommand.List.class, factory).execute();
        assertEquals(0, exitCode);
    }

    @Test
    void testListerMoteursJson() {
        wireMock.stubFor(get(urlEqualTo("/catalogue/moteurs"))
                .willReturn(okJson("[{\"id\":1,\"designation\":\"Yamaha\"}]")));

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PrintStream original = System.out;
        System.setOut(new PrintStream(out));
        try {
            new CommandLine(MoteurCommand.List.class, factory).execute("--json");
        } finally {
            System.setOut(original);
        }
        assertTrue(out.toString().contains("\"designation\""));
    }

    @Test
    void testObtenirMoteurViaCommande() {
        wireMock.stubFor(get(urlEqualTo("/catalogue/moteurs/1"))
                .willReturn(okJson("{\"id\":1,\"designation\":\"Yamaha F150\"}")));

        int exitCode = new CommandLine(MoteurCommand.Get.class, factory).execute("1");
        assertEquals(0, exitCode);
    }

    @Test
    void testRechercherMoteursViaCommande() {
        wireMock.stubFor(get(urlPathEqualTo("/catalogue/moteurs/search"))
                .willReturn(okJson("[{\"id\":1,\"designation\":\"Yamaha\"}]")));

        int exitCode = new CommandLine(MoteurCommand.Search.class, factory).execute("yamaha");
        assertEquals(0, exitCode);
        wireMock.verify(getRequestedFor(urlPathEqualTo("/catalogue/moteurs/search"))
                .withQueryParam("q", equalTo("yamaha")));
    }

    @Test
    void testCreerMoteurViaCommande() {
        wireMock.stubFor(post(urlEqualTo("/catalogue/moteurs"))
                .willReturn(aResponse().withStatus(201)
                        .withHeader("Content-Type", "application/json")
                        .withBody("{\"id\":5,\"designation\":\"Mercury Verado 300\",\"type\":\"Hors-bord\"}")));

        int exitCode = new CommandLine(MoteurCommand.Create.class, factory)
                .execute("--designation", "Mercury Verado 300", "--type", "Hors-bord", "--puissance", "300cv");
        assertEquals(0, exitCode);
        wireMock.verify(postRequestedFor(urlEqualTo("/catalogue/moteurs"))
                .withRequestBody(containing("\"puissance\":\"300cv\"")));
    }

    @Test
    void testModifierMoteurViaCommande() {
        wireMock.stubFor(get(urlEqualTo("/catalogue/moteurs/1"))
                .willReturn(okJson("{\"id\":1,\"designation\":\"Yamaha F150\",\"type\":\"Hors-bord\",\"puissance\":\"150cv\"}")));
        wireMock.stubFor(put(urlEqualTo("/catalogue/moteurs/1"))
                .willReturn(okJson("{\"id\":1,\"designation\":\"Yamaha F200\",\"type\":\"Hors-bord\",\"puissance\":\"150cv\",\"prixPublic\":20000,\"stock\":2}")));

        int exitCode = new CommandLine(MoteurCommand.Update.class, factory)
                .execute("1", "--designation", "Yamaha F200", "--prix-public", "20000", "--stock", "2");
        assertEquals(0, exitCode);
        wireMock.verify(getRequestedFor(urlEqualTo("/catalogue/moteurs/1")));
        wireMock.verify(putRequestedFor(urlEqualTo("/catalogue/moteurs/1"))
                .withRequestBody(containing("\"designation\":\"Yamaha F200\""))
                .withRequestBody(containing("\"puissance\":\"150cv\"")));
    }

    @Test
    void testSupprimerMoteurViaCommande() {
        wireMock.stubFor(delete(urlEqualTo("/catalogue/moteurs/1"))
                .willReturn(noContent()));

        int exitCode = new CommandLine(MoteurCommand.Delete.class, factory).execute("1");
        assertEquals(0, exitCode);
    }

    @Test
    void testMoteurNonTrouveViaCommande() {
        wireMock.stubFor(get(urlEqualTo("/catalogue/moteurs/9999"))
                .willReturn(aResponse().withStatus(404)));

        ByteArrayOutputStream err = new ByteArrayOutputStream();
        PrintStream original = System.err;
        System.setErr(new PrintStream(err));
        try {
            int exitCode = new CommandLine(MoteurCommand.Get.class, factory).execute("9999");
            assertEquals(0, exitCode);
        } finally {
            System.setErr(original);
        }
        assertTrue(err.toString().contains("Erreur"));
    }
}
