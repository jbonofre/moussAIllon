package net.nanthrax.moussaillon.services;

import io.quarkus.test.TestTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.ws.rs.WebApplicationException;
import net.nanthrax.moussaillon.persistence.ClientEntity;
import net.nanthrax.moussaillon.persistence.RappelHistoriqueEntity;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import net.nanthrax.moussaillon.persistence.VenteEntity;
import org.junit.jupiter.api.Test;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Journal des relances : chaque test est annulé en fin d'exécution (@TestTransaction). */
@QuarkusTest
public class RelanceResourceTest {

    @Inject
    RelanceResource relanceResource;

    // Relances à valider dans le journal (pas d'envoi automatique)
    private static void parametrerRelances() {
        SocieteEntity societe = SocieteEntity.findById(1L);
        societe.relancesAutomatiques = false;
        societe.relance1Jours = 15;
        societe.relance2Jours = 30;
        societe.relance3Jours = 45;
        societe.relanceDevis1Jours = 7;
        societe.relanceDevis2Jours = null;
        societe.relanceDevis3Jours = null;
    }

    private static Timestamp ilYA(int jours) {
        return Timestamp.valueOf(LocalDate.now().minusDays(jours).atStartOfDay());
    }

    private static VenteEntity facture(ClientEntity client, int joursDepuisEcheance) {
        VenteEntity vente = new VenteEntity();
        vente.status = VenteEntity.Status.FACTURE_PRETE;
        vente.client = client;
        vente.numeroFacture = "FA-JOURNAL";
        vente.date = ilYA(60);
        vente.dateFacturePrete = ilYA(60);
        vente.dateEcheance = ilYA(joursDepuisEcheance);
        vente.prixVenteTTC = 500.0;
        vente.persist();
        return vente;
    }

    private static VenteEntity devis(ClientEntity client, int joursDepuisDevis) {
        VenteEntity vente = new VenteEntity();
        vente.status = VenteEntity.Status.DEVIS;
        vente.client = client;
        vente.numeroFacture = "DE-JOURNAL";
        vente.date = ilYA(joursDepuisDevis);
        vente.dateDevis = ilYA(joursDepuisDevis);
        vente.prixVenteTTC = 900.0;
        vente.persist();
        return vente;
    }

    private static RelanceResource.Relance ligne(RelanceResource.Journal journal, VenteEntity vente) {
        return journal.relances.stream().filter(r -> r.venteId.equals(vente.id)).findFirst().orElse(null);
    }

    private static List<RappelHistoriqueEntity> historique(VenteEntity vente) {
        return RappelHistoriqueEntity.list("vente.id", vente.id);
    }

    @Test
    @TestTransaction
    void testJournalDesRelancesDues() {
        parametrerRelances();
        ClientEntity client = ClientEntity.findById(100L);
        VenteEntity facture = facture(client, 32);
        VenteEntity devis = devis(client, 10);
        VenteEntity pasEncore = facture(client, 3);

        RelanceResource.Journal journal = relanceResource.journal();

        assertFalse(journal.relancesAutomatiques);
        RelanceResource.Relance relanceFacture = ligne(journal, facture);
        assertNotNull(relanceFacture);
        assertFalse(relanceFacture.devis);
        assertEquals(2, relanceFacture.niveau, "J+32 après l'échéance : relance 2");
        assertEquals(32, relanceFacture.joursEcoules);
        assertEquals(500.0, relanceFacture.montant, 0.001, "Solde dû de la facture");
        assertEquals("FA-JOURNAL", relanceFacture.numero);
        assertEquals("jean.dupont@test.com", relanceFacture.email);
        RelanceResource.Relance relanceDevis = ligne(journal, devis);
        assertNotNull(relanceDevis);
        assertTrue(relanceDevis.devis);
        assertEquals(1, relanceDevis.niveau);
        assertEquals(900.0, relanceDevis.montant, 0.001);
        assertNull(ligne(journal, pasEncore));
    }

    @Test
    @TestTransaction
    void testEnvoiDesRelancesSelectionnees() {
        parametrerRelances();
        ClientEntity client = ClientEntity.findById(100L);
        VenteEntity cochee = facture(client, 20);
        VenteEntity decochee = devis(client, 10);

        RelanceResource.EnvoiRequest request = new RelanceResource.EnvoiRequest();
        request.ventes = List.of(cochee.id);
        RelanceResource.EnvoiResultat resultat = relanceResource.envoyer(request);

        assertEquals(1, resultat.envoyees);
        assertTrue(resultat.erreurs.isEmpty());
        assertEquals(1, cochee.niveauRelance);
        assertEquals(1, historique(cochee).size());
        assertEquals(0, decochee.niveauRelanceDevis, "La relance décochée n'est pas envoyée");
        assertNotNull(ligne(relanceResource.journal(), decochee), "Elle reste dans le journal");

        assertEquals(0, relanceResource.envoyer(request).envoyees, "Une relance déjà envoyée ne l'est pas deux fois");

        RelanceResource.EnvoiRequest vide = new RelanceResource.EnvoiRequest();
        vide.ventes = List.of();
        assertEquals(400, assertThrows(WebApplicationException.class, () -> relanceResource.envoyer(vide))
            .getResponse().getStatus());
    }

    @Test
    @TestTransaction
    void testIgnorerUneRelance() {
        parametrerRelances();
        VenteEntity vente = facture(ClientEntity.findById(100L), 20);
        RelanceResource.MotifRequest request = new RelanceResource.MotifRequest();
        request.motif = "  Accord téléphonique  ";

        relanceResource.ignorer(vente.id, request);

        assertEquals(1, vente.niveauRelance);
        RappelHistoriqueEntity ligne = historique(vente).get(0);
        assertTrue(ligne.ignoree);
        assertEquals("Accord téléphonique", ligne.motif);
        assertNull(ligne(relanceResource.journal(), vente));
        assertEquals(400, assertThrows(WebApplicationException.class, () -> relanceResource.ignorer(vente.id, null))
            .getResponse().getStatus(), "Plus aucune relance n'est due");
    }

    @Test
    @TestTransaction
    void testSuspendreEtReprendreLesRelancesDUneVente() {
        parametrerRelances();
        VenteEntity vente = facture(ClientEntity.findById(100L), 20);
        RelanceResource.SuspensionRequest request = new RelanceResource.SuspensionRequest();
        request.jusquau = LocalDate.now().plusDays(10);
        request.motif = "Échéancier en 3 fois";

        relanceResource.suspendreVente(vente.id, request);

        RelanceResource.Journal journal = relanceResource.journal();
        assertNull(ligne(journal, vente), "Une vente suspendue n'est pas dans le journal");
        RelanceResource.VenteSuspendue suspendue = journal.ventesSuspendues.stream()
            .filter(v -> v.venteId.equals(vente.id)).findFirst().orElseThrow();
        assertEquals(LocalDate.now(), suspendue.depuis);
        assertEquals(LocalDate.now().plusDays(10), suspendue.jusquau);
        assertEquals("Échéancier en 3 fois", suspendue.motif);

        relanceResource.reprendreVente(vente.id);
        assertNull(vente.dateSuspensionRelances);
        assertNotNull(ligne(relanceResource.journal(), vente));

        request.jusquau = LocalDate.now().minusDays(1);
        assertEquals(400, assertThrows(WebApplicationException.class, () -> relanceResource.suspendreVente(vente.id, request))
            .getResponse().getStatus(), "La date de fin ne peut pas être passée");
    }

    @Test
    @TestTransaction
    void testSuspendreEtReprendreLesRelancesDUnClient() {
        parametrerRelances();
        ClientEntity client = new ClientEntity();
        client.nom = "Client Accord";
        client.type = "Particulier";
        client.email = "client.accord@test.com";
        client.consentement = true;
        client.persist();
        VenteEntity facture = facture(client, 20);
        VenteEntity devis = devis(client, 10);
        RelanceResource.MotifRequest request = new RelanceResource.MotifRequest();
        request.motif = "Règle à 60 jours";

        relanceResource.suspendreClient(client.id, request);

        RelanceResource.Journal journal = relanceResource.journal();
        assertNull(ligne(journal, facture));
        assertNull(ligne(journal, devis));
        RelanceResource.ClientSuspendu suspendu = journal.clientsSuspendus.stream()
            .filter(c -> c.clientId.equals(client.id)).findFirst().orElseThrow();
        assertEquals("Règle à 60 jours", suspendu.motif);

        relanceResource.reprendreClient(client.id);
        assertFalse(client.relancesSuspendues);
        assertNull(client.motifSuspensionRelances);
        assertNotNull(ligne(relanceResource.journal(), facture));
    }
}
