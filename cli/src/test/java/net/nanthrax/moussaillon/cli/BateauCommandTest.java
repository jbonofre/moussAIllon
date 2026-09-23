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
class BateauCommandTest {

    @InjectWireMock
    WireMockServer wireMock;

    @Inject
    ApiClient api;

    @Inject
    CommandLine.IFactory factory;

    @BeforeEach
    void resetStubs() {
        wireMock.resetAll();
    }

    @Test
    void testListerBateauxViaCommande() {
        wireMock.stubFor(get(urlEqualTo("/catalogue/bateaux"))
                .willReturn(okJson("[{\"id\":1,\"designation\":\"Bénéteau Flyer 7\",\"type\":\"Moteur\"}]")));

        int exitCode = new CommandLine(BateauCommand.List.class, factory).execute();
        assertEquals(0, exitCode);
        wireMock.verify(getRequestedFor(urlEqualTo("/catalogue/bateaux")));
    }

    @Test
    void testListerBateauxJson() {
        wireMock.stubFor(get(urlEqualTo("/catalogue/bateaux"))
                .willReturn(okJson("[{\"id\":1,\"designation\":\"Bénéteau\"}]")));

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PrintStream original = System.out;
        System.setOut(new PrintStream(out));
        try {
            new CommandLine(BateauCommand.List.class, factory).execute("--json");
        } finally {
            System.setOut(original);
        }
        assertTrue(out.toString().contains("\"designation\""));
        assertTrue(out.toString().contains("Bénéteau"));
    }

    @Test
    void testObtenirBateauViaCommande() {
        wireMock.stubFor(get(urlEqualTo("/catalogue/bateaux/1"))
                .willReturn(okJson("{\"id\":1,\"designation\":\"Bénéteau Flyer 7\"}")));

        int exitCode = new CommandLine(BateauCommand.Get.class, factory).execute("1");
        assertEquals(0, exitCode);
    }

    @Test
    void testRechercherBateauxViaCommande() {
        wireMock.stubFor(get(urlPathEqualTo("/catalogue/bateaux/search"))
                .willReturn(okJson("[{\"id\":1,\"designation\":\"Bénéteau\"}]")));

        int exitCode = new CommandLine(BateauCommand.Search.class, factory).execute("beneteau");
        assertEquals(0, exitCode);
        wireMock.verify(getRequestedFor(urlPathEqualTo("/catalogue/bateaux/search"))
                .withQueryParam("q", equalTo("beneteau")));
    }

    @Test
    void testCreerBateauViaCommande() {
        wireMock.stubFor(post(urlEqualTo("/catalogue/bateaux"))
                .willReturn(aResponse().withStatus(201)
                        .withHeader("Content-Type", "application/json")
                        .withBody("{\"id\":5,\"designation\":\"Jeanneau Cap Camarat\",\"type\":\"Moteur\",\"annee\":2025,\"stock\":3}")));

        int exitCode = new CommandLine(BateauCommand.Create.class, factory)
                .execute("--designation", "Jeanneau Cap Camarat", "--type", "Moteur", "--annee", "2025", "--stock", "3");
        assertEquals(0, exitCode);
        wireMock.verify(postRequestedFor(urlEqualTo("/catalogue/bateaux"))
                .withRequestBody(containing("\"designation\":\"Jeanneau Cap Camarat\""))
                .withRequestBody(containing("\"annee\":2025"))
                .withRequestBody(containing("\"stock\":3")));
    }

    @Test
    void testCreerBateauStockZero() {
        wireMock.stubFor(post(urlEqualTo("/catalogue/bateaux"))
                .willReturn(aResponse().withStatus(201)
                        .withHeader("Content-Type", "application/json")
                        .withBody("{\"id\":6,\"designation\":\"Test M1\",\"type\":\"Voile\",\"stock\":0}")));

        int exitCode = new CommandLine(BateauCommand.Create.class, factory)
                .execute("--designation", "Test M1", "--type", "Voile", "--stock", "0");
        assertEquals(0, exitCode);
        wireMock.verify(postRequestedFor(urlEqualTo("/catalogue/bateaux"))
                .withRequestBody(containing("\"stock\":0")));
    }

    @Test
    void testModifierBateauViaCommande() {
        wireMock.stubFor(get(urlEqualTo("/catalogue/bateaux/1"))
                .willReturn(okJson("{\"id\":1,\"designation\":\"Bénéteau Flyer 7\",\"type\":\"Moteur\",\"stock\":5}")));
        wireMock.stubFor(put(urlEqualTo("/catalogue/bateaux/1"))
                .willReturn(okJson("{\"id\":1,\"designation\":\"Bénéteau Flyer 8\",\"type\":\"Moteur\",\"stock\":0}")));

        int exitCode = new CommandLine(BateauCommand.Update.class, factory)
                .execute("1", "--designation", "Bénéteau Flyer 8", "--stock", "0");
        assertEquals(0, exitCode);
        wireMock.verify(getRequestedFor(urlEqualTo("/catalogue/bateaux/1")));
        wireMock.verify(putRequestedFor(urlEqualTo("/catalogue/bateaux/1"))
                .withRequestBody(containing("\"designation\":\"Bénéteau Flyer 8\""))
                .withRequestBody(containing("\"stock\":0")));
    }

    @Test
    void testSupprimerBateauViaCommande() {
        wireMock.stubFor(delete(urlEqualTo("/catalogue/bateaux/1"))
                .willReturn(noContent()));

        int exitCode = new CommandLine(BateauCommand.Delete.class, factory).execute("1");
        assertEquals(0, exitCode);
        wireMock.verify(deleteRequestedFor(urlEqualTo("/catalogue/bateaux/1")));
    }

    @Test
    void testBateauNonTrouveViaCommande() {
        wireMock.stubFor(get(urlEqualTo("/catalogue/bateaux/9999"))
                .willReturn(aResponse().withStatus(404)));

        ByteArrayOutputStream err = new ByteArrayOutputStream();
        PrintStream original = System.err;
        System.setErr(new PrintStream(err));
        try {
            int exitCode = new CommandLine(BateauCommand.Get.class, factory).execute("9999");
            assertEquals(0, exitCode);
        } finally {
            System.setErr(original);
        }
        assertTrue(err.toString().contains("Erreur"));
    }
}
