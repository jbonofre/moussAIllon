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
class ClientCommandTest {

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
    void testListerClientsViaCommande() {
        wireMock.stubFor(get(urlEqualTo("/clients"))
                .willReturn(okJson("[{\"id\":1,\"nom\":\"Jean Dupont\",\"type\":\"Particulier\"}]")));

        int exitCode = new CommandLine(ClientCommand.List.class, factory).execute();
        assertEquals(0, exitCode);
        wireMock.verify(getRequestedFor(urlEqualTo("/clients")));
    }

    @Test
    void testListerClientsJson() {
        wireMock.stubFor(get(urlEqualTo("/clients"))
                .willReturn(okJson("[{\"id\":1,\"nom\":\"Dupont\"}]")));

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PrintStream original = System.out;
        System.setOut(new PrintStream(out));
        try {
            new CommandLine(ClientCommand.List.class, factory).execute("--json");
        } finally {
            System.setOut(original);
        }
        String output = out.toString();
        assertTrue(output.contains("\"nom\""));
        assertTrue(output.contains("Dupont"));
    }

    @Test
    void testObtenirClientViaCommande() {
        wireMock.stubFor(get(urlEqualTo("/clients/1"))
                .willReturn(okJson("{\"id\":1,\"nom\":\"Dupont\"}")));

        int exitCode = new CommandLine(ClientCommand.Get.class, factory).execute("1");
        assertEquals(0, exitCode);
        wireMock.verify(getRequestedFor(urlEqualTo("/clients/1")));
    }

    @Test
    void testRechercherClientsViaCommande() {
        wireMock.stubFor(get(urlPathEqualTo("/clients/search"))
                .willReturn(okJson("[{\"id\":1,\"nom\":\"Dupont\"}]")));

        int exitCode = new CommandLine(ClientCommand.Search.class, factory).execute("dupont");
        assertEquals(0, exitCode);
        wireMock.verify(getRequestedFor(urlPathEqualTo("/clients/search"))
                .withQueryParam("q", equalTo("dupont")));
    }

    @Test
    void testRechercherClientsJson() {
        wireMock.stubFor(get(urlPathEqualTo("/clients/search"))
                .willReturn(okJson("[{\"id\":1,\"nom\":\"Dupont\"}]")));

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PrintStream original = System.out;
        System.setOut(new PrintStream(out));
        try {
            new CommandLine(ClientCommand.Search.class, factory).execute("dupont", "--json");
        } finally {
            System.setOut(original);
        }
        assertTrue(out.toString().contains("\"nom\""));
    }

    @Test
    void testCreerClientViaCommande() {
        wireMock.stubFor(post(urlEqualTo("/clients"))
                .willReturn(okJson("{\"id\":10,\"nom\":\"Nouveau\",\"type\":\"Particulier\"}")));

        int exitCode = new CommandLine(ClientCommand.Create.class, factory)
                .execute("--nom", "Nouveau", "--type", "Particulier", "--email", "test@test.com");
        assertEquals(0, exitCode);
        wireMock.verify(postRequestedFor(urlEqualTo("/clients"))
                .withRequestBody(containing("\"nom\":\"Nouveau\""))
                .withRequestBody(containing("\"type\":\"Particulier\""))
                .withRequestBody(containing("\"email\":\"test@test.com\"")));
    }

    @Test
    void testModifierClientViaCommande() {
        wireMock.stubFor(get(urlEqualTo("/clients/1"))
                .willReturn(okJson("{\"id\":1,\"nom\":\"Jean Dupont\",\"type\":\"Particulier\",\"email\":\"old@test.com\"}")));
        wireMock.stubFor(put(urlEqualTo("/clients/1"))
                .willReturn(okJson("{\"id\":1,\"nom\":\"Modifie\",\"type\":\"Particulier\",\"email\":\"new@test.com\"}")));

        int exitCode = new CommandLine(ClientCommand.Update.class, factory)
                .execute("1", "--nom", "Modifie", "--email", "new@test.com");
        assertEquals(0, exitCode);
        wireMock.verify(getRequestedFor(urlEqualTo("/clients/1")));
        wireMock.verify(putRequestedFor(urlEqualTo("/clients/1"))
                .withRequestBody(containing("\"nom\":\"Modifie\""))
                .withRequestBody(containing("\"email\":\"new@test.com\"")));
    }

    @Test
    void testSupprimerClientViaCommande() {
        wireMock.stubFor(delete(urlEqualTo("/clients/5"))
                .willReturn(noContent()));

        int exitCode = new CommandLine(ClientCommand.Delete.class, factory).execute("5");
        assertEquals(0, exitCode);
        wireMock.verify(deleteRequestedFor(urlEqualTo("/clients/5")));
    }

    @Test
    void testClientNonTrouveViaCommande() {
        wireMock.stubFor(get(urlEqualTo("/clients/9999"))
                .willReturn(aResponse().withStatus(404).withBody("Client non trouvé")));

        ByteArrayOutputStream err = new ByteArrayOutputStream();
        PrintStream original = System.err;
        System.setErr(new PrintStream(err));
        try {
            int exitCode = new CommandLine(ClientCommand.Get.class, factory).execute("9999");
            assertEquals(0, exitCode);
        } finally {
            System.setErr(original);
        }
        assertTrue(err.toString().contains("Erreur"));
        assertTrue(err.toString().contains("404"));
    }
}
