package net.nanthrax.moussaillon.services;

import io.quarkus.test.TestTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import net.nanthrax.moussaillon.persistence.ClientEntity;
import net.nanthrax.moussaillon.persistence.EmailTemplateEntity;
import net.nanthrax.moussaillon.persistence.RappelHistoriqueEntity;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import net.nanthrax.moussaillon.persistence.VenteEntity;
import net.nanthrax.moussaillon.persistence.VentePaiementEntity;
import org.junit.jupiter.api.Test;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Relances de paiement automatiques : chaque test est annulé en fin d'exécution (@TestTransaction). */
@QuarkusTest
public class RappelSchedulerTest {

    @Inject
    RappelScheduler rappelScheduler;

    private static void parametrerRelances(Integer j1, Integer j2, Integer j3) {
        SocieteEntity societe = SocieteEntity.findById(1L);
        societe.relance1Jours = j1;
        societe.relance2Jours = j2;
        societe.relance3Jours = j3;
    }

    private static Timestamp ilYA(int jours) {
        return Timestamp.valueOf(LocalDate.now().minusDays(jours).atStartOfDay());
    }

    private static VenteEntity facture(ClientEntity client, double prixTTC) {
        VenteEntity vente = new VenteEntity();
        vente.status = VenteEntity.Status.FACTURE_PRETE;
        vente.client = client;
        vente.numeroFacture = "FA-TEST";
        vente.date = ilYA(60);
        vente.dateFacturePrete = ilYA(60);
        vente.prixVenteTTC = prixTTC;
        return vente;
    }

    private static List<RappelHistoriqueEntity> historique(VenteEntity vente) {
        return RappelHistoriqueEntity.list("vente.id", vente.id);
    }

    @Test
    @TestTransaction
    void testRelance1QuandDelaiDepuisEcheanceAtteint() {
        parametrerRelances(15, 30, 45);
        VenteEntity vente = facture(ClientEntity.findById(100L), 500.0);
        vente.dateEcheance = ilYA(20);
        vente.persist();

        rappelScheduler.envoyerRelances();

        assertEquals(1, vente.niveauRelance, "J+20 après l'échéance : relance 1 (J+15) envoyée, pas la 2 (J+30)");
        List<RappelHistoriqueEntity> envois = historique(vente);
        assertEquals(1, envois.size());
        assertEquals(1, envois.get(0).numeroRappel);
        assertEquals("jean.dupont@test.com", envois.get(0).destinataire);
        assertTrue(envois.get(0).sujet.contains("FA-TEST"), "Le sujet reprend le numéro de facture");
    }

    @Test
    @TestTransaction
    void testPasDeRelanceAvantPremierDelai() {
        parametrerRelances(15, 30, 45);
        VenteEntity vente = facture(ClientEntity.findById(100L), 500.0);
        vente.dateEcheance = ilYA(5);
        vente.persist();

        rappelScheduler.envoyerRelances();

        assertEquals(0, vente.niveauRelance);
        assertTrue(historique(vente).isEmpty());
    }

    @Test
    @TestTransaction
    void testEcheanceFuturePrimeSurDateFacture() {
        // La facture date de 60 jours mais l'échéance n'est pas encore passée : pas de relance.
        parametrerRelances(15, 30, 45);
        VenteEntity vente = facture(ClientEntity.findById(100L), 500.0);
        vente.dateEcheance = Timestamp.valueOf(LocalDate.now().plusDays(10).atStartOfDay());
        vente.persist();

        rappelScheduler.envoyerRelances();

        assertEquals(0, vente.niveauRelance);
    }

    @Test
    @TestTransaction
    void testDateFactureSansEcheance() {
        parametrerRelances(15, 30, 45);
        VenteEntity vente = facture(ClientEntity.findById(100L), 500.0);
        vente.dateFacturePrete = ilYA(31);
        vente.persist();

        rappelScheduler.envoyerRelances();

        assertEquals(2, vente.niveauRelance, "Sans échéance, J+31 depuis la facture : relance 2 (J+30)");
    }

    @Test
    @TestTransaction
    void testUneSeuleRelanceQuandPlusieursDelaisDepasses() {
        parametrerRelances(15, 30, 45);
        VenteEntity vente = facture(ClientEntity.findById(100L), 500.0);
        vente.dateEcheance = ilYA(100);
        vente.persist();

        rappelScheduler.envoyerRelances();

        assertEquals(3, vente.niveauRelance);
        List<RappelHistoriqueEntity> envois = historique(vente);
        assertEquals(1, envois.size(), "Les relances 1 et 2 ne sont pas rattrapées");
        assertEquals(3, envois.get(0).numeroRappel);
    }

    @Test
    @TestTransaction
    void testPasDeDoublonRelanceDejaEnvoyee() {
        parametrerRelances(15, 30, 45);
        VenteEntity vente = facture(ClientEntity.findById(100L), 500.0);
        vente.dateEcheance = ilYA(20);
        vente.niveauRelance = 1;
        vente.persist();

        rappelScheduler.envoyerRelances();

        assertEquals(1, vente.niveauRelance);
        assertTrue(historique(vente).isEmpty());
    }

    @Test
    @TestTransaction
    void testPasDeRelanceSansParametrage() {
        parametrerRelances(null, null, null);
        VenteEntity vente = facture(ClientEntity.findById(100L), 500.0);
        vente.dateEcheance = ilYA(100);
        vente.persist();

        rappelScheduler.envoyerRelances();

        assertEquals(0, vente.niveauRelance);
    }

    @Test
    @TestTransaction
    void testPasDeRelanceFactureSoldee() {
        // Soldée par un paiement à date future (chèque encaissé plus tard) : rien à relancer.
        parametrerRelances(15, 30, 45);
        VenteEntity vente = facture(ClientEntity.findById(100L), 500.0);
        vente.dateEcheance = ilYA(20);
        VentePaiementEntity paiement = new VentePaiementEntity();
        paiement.mode = VentePaiementEntity.Mode.CHEQUE;
        paiement.montant = 500.0;
        paiement.date = Timestamp.valueOf(LocalDate.now().plusDays(5).atStartOfDay());
        vente.paiements.add(paiement);
        vente.persist();

        rappelScheduler.envoyerRelances();

        assertEquals(0, vente.niveauRelance);
    }

    @Test
    @TestTransaction
    void testMessageReprendLeSoldeDu() {
        parametrerRelances(15, 30, 45);
        VenteEntity vente = facture(ClientEntity.findById(100L), 500.0);
        vente.dateEcheance = ilYA(20);
        VentePaiementEntity acompte = new VentePaiementEntity();
        acompte.mode = VentePaiementEntity.Mode.VIREMENT;
        acompte.montant = 200.0;
        acompte.date = ilYA(30);
        vente.paiements.add(acompte);
        vente.persist();

        rappelScheduler.envoyerRelances();

        List<RappelHistoriqueEntity> envois = historique(vente);
        assertEquals(1, envois.size());
        assertTrue(envois.get(0).contenu.contains(String.format("%.2f", 300.0)), "Le message reprend le solde dû (300)");
    }

    @Test
    @TestTransaction
    void testMessageReprendLesConditionsDeLaFacture() {
        parametrerRelances(15, 30, 45);
        EmailTemplateEntity modele = EmailTemplateEntity.findByType(EmailTemplateEntity.Type.RAPPEL);
        boolean nouveau = modele == null;
        if (nouveau) {
            modele = new EmailTemplateEntity();
            modele.type = EmailTemplateEntity.Type.RAPPEL;
        }
        modele.sujet = "Relance {numeroFacture}";
        modele.contenu = "Conditions : {conditionsPaiement} / Pénalités : {penalitesRetard} / Indemnité : {indemniteForfaitaire}";
        if (nouveau) {
            modele.persist();
        }
        VenteEntity vente = facture(ClientEntity.findById(100L), 500.0);
        vente.dateEcheance = ilYA(20);
        vente.conditionsPaiement = "30 jours nets";
        vente.penalitesRetard = "3 fois le taux légal";
        vente.indemniteForfaitaire = 40.0;
        vente.persist();

        rappelScheduler.envoyerRelances();

        List<RappelHistoriqueEntity> envois = historique(vente);
        assertEquals(1, envois.size());
        assertEquals("Conditions : 30 jours nets / Pénalités : 3 fois le taux légal / Indemnité : " + String.format("%.2f", 40.0),
            envois.get(0).contenu);
    }

    @Test
    @TestTransaction
    void testPasDeRelanceFactureEnAttenteOuDevis() {
        parametrerRelances(15, 30, 45);
        ClientEntity client = ClientEntity.findById(100L);
        VenteEntity enAttente = facture(client, 500.0);
        enAttente.status = VenteEntity.Status.FACTURE_EN_ATTENTE;
        enAttente.dateEcheance = ilYA(20);
        enAttente.persist();
        VenteEntity devis = facture(client, 500.0);
        devis.status = VenteEntity.Status.DEVIS;
        devis.dateEcheance = ilYA(20);
        devis.persist();

        rappelScheduler.envoyerRelances();

        assertEquals(0, enAttente.niveauRelance);
        assertEquals(0, devis.niveauRelance);
    }

    @Test
    @TestTransaction
    void testPasDeRelanceSansEmailClient() {
        parametrerRelances(15, 30, 45);
        ClientEntity sansEmail = new ClientEntity();
        sansEmail.nom = "SansEmail";
        sansEmail.type = "Particulier";
        sansEmail.consentement = true;
        sansEmail.persist();
        VenteEntity vente = facture(sansEmail, 500.0);
        vente.dateEcheance = ilYA(20);
        vente.persist();

        rappelScheduler.envoyerRelances();

        assertEquals(0, vente.niveauRelance);
    }

    @Test
    void testNiveauAtteint() {
        Integer[] delais = { 15, 30, 45 };
        assertEquals(0, RappelScheduler.niveauAtteint(delais, -3));
        assertEquals(0, RappelScheduler.niveauAtteint(delais, 14));
        assertEquals(1, RappelScheduler.niveauAtteint(delais, 15));
        assertEquals(2, RappelScheduler.niveauAtteint(delais, 44));
        assertEquals(3, RappelScheduler.niveauAtteint(delais, 400));
        assertEquals(3, RappelScheduler.niveauAtteint(new Integer[] { 15, null, 45 }, 50), "Une relance intermédiaire vide est ignorée");
        assertEquals(0, RappelScheduler.niveauAtteint(new Integer[] { null, null, null }, 400));
    }
}
