package net.nanthrax.moussaillon.services;

import io.quarkus.mailer.MockMailbox;
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

/** Relances de paiement et de devis : chaque test est annulé en fin d'exécution (@TestTransaction). */
@QuarkusTest
public class RappelSchedulerTest {

    @Inject
    RappelScheduler rappelScheduler;

    @Inject
    MockMailbox mailbox;

    // Paramètre les délais, avec l'envoi automatique chaque matin (sinon les relances attendent le journal)
    private static void parametrerRelances(Integer j1, Integer j2, Integer j3) {
        SocieteEntity societe = SocieteEntity.findById(1L);
        societe.relancesAutomatiques = true;
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

    private static void parametrerRelancesDevis(Integer j1, Integer j2, Integer j3) {
        SocieteEntity societe = SocieteEntity.findById(1L);
        societe.relancesAutomatiques = true;
        societe.relanceDevis1Jours = j1;
        societe.relanceDevis2Jours = j2;
        societe.relanceDevis3Jours = j3;
    }

    private static VenteEntity devis(ClientEntity client, int joursDepuisDevis) {
        VenteEntity vente = new VenteEntity();
        vente.status = VenteEntity.Status.DEVIS;
        vente.client = client;
        vente.numeroFacture = "DE-TEST";
        vente.date = ilYA(joursDepuisDevis);
        vente.dateDevis = ilYA(joursDepuisDevis);
        vente.prixVenteTTC = 900.0;
        return vente;
    }

    private static List<RappelHistoriqueEntity> historique(VenteEntity vente) {
        return RappelHistoriqueEntity.list("vente.id", vente.id);
    }

    // Modèle d'email personnalisé, créé s'il n'existe pas encore (annulé avec le test)
    private static void personnaliserModele(EmailTemplateEntity.Type type, String sujet, String contenu) {
        EmailTemplateEntity modele = EmailTemplateEntity.findByType(type);
        if (modele == null) {
            modele = new EmailTemplateEntity();
            modele.type = type;
            modele.sujet = sujet;
            modele.contenu = contenu;
            modele.persist();
        }
        modele.sujet = sujet;
        modele.contenu = contenu;
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
        personnaliserModele(EmailTemplateEntity.Type.RAPPEL, "Relance {numeroFacture}",
            "Conditions : {conditionsPaiement} / Pénalités : {penalitesRetard} / Indemnité : {indemniteForfaitaire}");
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
    @TestTransaction
    void testRelanceDevisEnAttente() {
        parametrerRelancesDevis(7, 15, 30);
        VenteEntity vente = devis(ClientEntity.findById(100L), 20);
        vente.ordreDeReparation = true;
        vente.persist();

        rappelScheduler.envoyerRelancesDevis();

        assertEquals(2, vente.niveauRelanceDevis, "J+20 après le devis : relance 2 (J+15) envoyée");
        assertEquals(0, vente.niveauRelance, "Les relances de paiement ne sont pas concernées");
        List<RappelHistoriqueEntity> envois = historique(vente);
        assertEquals(1, envois.size());
        assertEquals(2, envois.get(0).numeroRappel);
        assertTrue(envois.get(0).sujet.contains("ordre de réparation DE-TEST"), envois.get(0).sujet);

        rappelScheduler.envoyerRelancesDevis();
        assertEquals(1, historique(vente).size(), "La relance déjà envoyée ne l'est pas une seconde fois");
    }

    @Test
    @TestTransaction
    void testPasDeRelanceDevisSigneRefuseOuComptoir() {
        parametrerRelancesDevis(7, 15, 30);
        ClientEntity client = ClientEntity.findById(100L);
        VenteEntity signe = devis(client, 20);
        signe.bonPourAccord = true;
        signe.persist();
        VenteEntity refuse = devis(client, 20);
        refuse.dateRefus = ilYA(2);
        refuse.persist();
        VenteEntity comptoir = devis(client, 20);
        comptoir.comptoir = true;
        comptoir.persist();
        // Prestation rouverte après son démarrage (forfait ajouté) : le client est déjà en contact avec l'atelier
        VenteEntity rouverte = devis(client, 20);
        rouverte.dateFactureEnAttente = ilYA(10);
        rouverte.persist();
        VenteEntity recent = devis(client, 3);
        recent.persist();

        rappelScheduler.envoyerRelancesDevis();

        for (VenteEntity vente : List.of(signe, refuse, comptoir, rouverte, recent)) {
            assertEquals(0, vente.niveauRelanceDevis);
            assertTrue(historique(vente).isEmpty());
        }
    }

    @Test
    @TestTransaction
    void testPasDeRelanceDevisSansParametrageNiConsentement() {
        parametrerRelancesDevis(null, null, null);
        VenteEntity vente = devis(ClientEntity.findById(100L), 40);
        vente.persist();

        rappelScheduler.envoyerRelancesDevis();
        assertEquals(0, vente.niveauRelanceDevis);

        parametrerRelancesDevis(7, null, null);
        ClientEntity sansConsentement = new ClientEntity();
        sansConsentement.nom = "SansConsentement";
        sansConsentement.type = "Particulier";
        sansConsentement.email = "sans.consentement@test.com";
        sansConsentement.persist();
        VenteEntity autre = devis(sansConsentement, 40);
        autre.persist();

        rappelScheduler.envoyerRelancesDevis();
        assertEquals(1, vente.niveauRelanceDevis);
        assertEquals(0, autre.niveauRelanceDevis);
    }

    @Test
    @TestTransaction
    void testRelancesAValiderSansEnvoiAutomatique() {
        parametrerRelances(15, 30, 45);
        parametrerRelancesDevis(7, 15, 30);
        SocieteEntity societe = SocieteEntity.findById(1L);
        societe.relancesAutomatiques = false;
        VenteEntity facture = facture(ClientEntity.findById(100L), 500.0);
        facture.dateEcheance = ilYA(20);
        facture.persist();
        VenteEntity devis = devis(ClientEntity.findById(100L), 20);
        devis.persist();

        rappelScheduler.envoyerRelances();
        rappelScheduler.envoyerRelancesDevis();

        assertEquals(0, facture.niveauRelance, "Rien n'est envoyé : les relances attendent le journal");
        assertEquals(0, devis.niveauRelanceDevis);
        assertTrue(historique(facture).isEmpty());
        List<RappelScheduler.RelanceDue> dues = RappelScheduler.relancesDues(societe, LocalDate.now());
        RappelScheduler.RelanceDue relanceFacture = relanceDue(dues, facture);
        assertFalse(relanceFacture.devis());
        assertEquals(1, relanceFacture.niveau());
        assertEquals(LocalDate.now().minusDays(20), relanceFacture.depart());
        RappelScheduler.RelanceDue relanceDevis = relanceDue(dues, devis);
        assertTrue(relanceDevis.devis());
        assertEquals(2, relanceDevis.niveau());

        rappelScheduler.envoyer(relanceFacture);
        assertEquals(1, facture.niveauRelance);
        assertEquals(1, historique(facture).size());
        assertNull(relanceDueOuNull(RappelScheduler.relancesDues(societe, LocalDate.now()), facture),
            "La relance envoyée n'est plus due");
    }

    @Test
    @TestTransaction
    void testRelanceIgnoreeSansEnvoi() {
        parametrerRelances(15, 30, 45);
        SocieteEntity societe = SocieteEntity.findById(1L);
        VenteEntity vente = facture(ClientEntity.findById(100L), 500.0);
        vente.dateEcheance = ilYA(20);
        vente.persist();

        rappelScheduler.ignorer(relanceDue(RappelScheduler.relancesDues(societe, LocalDate.now()), vente), "Échéancier convenu");

        assertEquals(1, vente.niveauRelance, "La relance 1 est traitée sans être envoyée");
        List<RappelHistoriqueEntity> lignes = historique(vente);
        assertEquals(1, lignes.size());
        assertTrue(lignes.get(0).ignoree);
        assertEquals(1, lignes.get(0).numeroRappel);
        assertEquals("Échéancier convenu", lignes.get(0).motif);

        rappelScheduler.envoyerRelances();
        assertEquals(1, historique(vente).size(), "La relance ignorée n'est pas envoyée le lendemain");

        // La relance suivante reste prévue
        vente.dateEcheance = ilYA(31);
        rappelScheduler.envoyerRelances();
        assertEquals(2, vente.niveauRelance);
        assertEquals(2, historique(vente).size());
    }

    @Test
    @TestTransaction
    void testPasDeRelanceVenteSuspendue() {
        parametrerRelances(15, 30, 45);
        parametrerRelancesDevis(7, 15, 30);
        ClientEntity client = ClientEntity.findById(100L);
        VenteEntity sansFin = facture(client, 500.0);
        sansFin.dateEcheance = ilYA(20);
        sansFin.dateSuspensionRelances = ilYA(1);
        sansFin.persist();
        VenteEntity jusquAujourdhui = devis(client, 20);
        jusquAujourdhui.dateSuspensionRelances = ilYA(5);
        jusquAujourdhui.finSuspensionRelances = ilYA(0);
        jusquAujourdhui.persist();
        VenteEntity suspensionTerminee = facture(client, 500.0);
        suspensionTerminee.dateEcheance = ilYA(20);
        suspensionTerminee.dateSuspensionRelances = ilYA(10);
        suspensionTerminee.finSuspensionRelances = ilYA(1);
        suspensionTerminee.persist();

        rappelScheduler.envoyerRelances();
        rappelScheduler.envoyerRelancesDevis();

        assertEquals(0, sansFin.niveauRelance, "Suspendue jusqu'à la reprise des relances");
        assertEquals(0, jusquAujourdhui.niveauRelanceDevis, "La date de fin est incluse dans la suspension");
        assertEquals(1, suspensionTerminee.niveauRelance, "Les relances reprennent après la date de fin");
    }

    @Test
    @TestTransaction
    void testPasDeRelanceClientSuspendu() {
        parametrerRelances(15, 30, 45);
        parametrerRelancesDevis(7, 15, 30);
        ClientEntity accord = new ClientEntity();
        accord.nom = "Accord Particulier";
        accord.type = "Particulier";
        accord.email = "accord.particulier@test.com";
        accord.consentement = true;
        accord.relancesSuspendues = true;
        accord.persist();
        VenteEntity facture = facture(accord, 500.0);
        facture.dateEcheance = ilYA(20);
        facture.persist();
        VenteEntity devis = devis(accord, 20);
        devis.persist();

        rappelScheduler.envoyerRelances();
        rappelScheduler.envoyerRelancesDevis();

        assertEquals(0, facture.niveauRelance);
        assertEquals(0, devis.niveauRelanceDevis);
        assertNull(relanceDueOuNull(RappelScheduler.relancesDues(SocieteEntity.findById(1L), LocalDate.now()), facture));
    }

    @Test
    @TestTransaction
    void testUnModeleParNiveauDeRelance() {
        parametrerRelances(15, 30, 45);
        personnaliserModele(EmailTemplateEntity.Type.RAPPEL, "Premier rappel {numeroFacture}", "Relance 1");
        personnaliserModele(EmailTemplateEntity.Type.RELANCE_2, "Deuxième rappel {numeroFacture}", "Relance {numeroRelance}");
        ClientEntity client = ClientEntity.findById(100L);
        VenteEntity relance2 = facture(client, 500.0);
        relance2.dateEcheance = ilYA(31);
        relance2.persist();
        VenteEntity relance3 = facture(client, 500.0);
        relance3.dateEcheance = ilYA(50);
        relance3.persist();

        rappelScheduler.envoyerRelances();

        RappelHistoriqueEntity envoi2 = historique(relance2).get(0);
        assertEquals("Deuxième rappel FA-TEST", envoi2.sujet);
        assertEquals("Relance 2", envoi2.contenu);
        RappelHistoriqueEntity envoi3 = historique(relance3).get(0);
        assertFalse(envoi3.courrier, "Sans courrier, la relance 3 part par email");
        assertTrue(envoi3.sujet.startsWith("Mise en demeure de payer - Facture FA-TEST"),
            "Modèle par défaut de la relance 3 : " + envoi3.sujet);
    }

    @Test
    @TestTransaction
    void testRelanceManuelleAvecLeModeleDeLaRelanceSuivante() {
        personnaliserModele(EmailTemplateEntity.Type.RELANCE_2, "Deuxième rappel {numeroFacture}", "Relance 2");
        ClientEntity client = ClientEntity.findById(100L);
        VenteEntity facture = facture(client, 500.0);
        facture.niveauRelance = 1;
        facture.persist();
        VenteEntity devis = devis(client, 40);
        devis.niveauRelanceDevis = 3;
        devis.persist();

        rappelScheduler.envoyerRelance(facture, 0);
        rappelScheduler.envoyerRelanceDevis(devis, 0);

        RappelHistoriqueEntity envoiFacture = historique(facture).get(0);
        assertEquals(0, envoiFacture.numeroRappel, "Relance manuelle");
        assertEquals("Deuxième rappel FA-TEST", envoiFacture.sujet, "La relance 1 a été envoyée : modèle de la relance 2");
        assertEquals(1, facture.niveauRelance, "Une relance manuelle ne change pas les relances prévues");
        assertTrue(historique(devis).get(0).sujet.startsWith("Dernière relance"),
            "Après la relance 3, le modèle de la relance 3 : " + historique(devis).get(0).sujet);
    }

    @Test
    void testNiveauModele() {
        assertEquals(2, RappelScheduler.niveauModele(2, 0));
        assertEquals(1, RappelScheduler.niveauModele(0, 0));
        assertEquals(3, RappelScheduler.niveauModele(0, 2));
        assertEquals(3, RappelScheduler.niveauModele(0, 3));
    }

    @Test
    @TestTransaction
    void testRelance3ParCourrier() {
        parametrerRelances(15, 30, 45);
        parametrerRelancesDevis(7, 15, 30);
        SocieteEntity.<SocieteEntity>findById(1L).relance3Courrier = true;
        // Client propre au test : les ventes d'autres classes de test ne lui envoient pas d'email
        ClientEntity client = new ClientEntity();
        client.nom = "Jean Courrier";
        client.type = "Particulier";
        client.email = "jean.courrier@test.com";
        client.adresse = "1 rue du Port";
        client.consentement = true;
        client.persist();
        VenteEntity facture = facture(client, 500.0);
        facture.dateEcheance = ilYA(50);
        facture.persist();
        VenteEntity devis = devis(client, 40);
        devis.persist();
        mailbox.clear();

        rappelScheduler.envoyerRelances();
        rappelScheduler.envoyerRelancesDevis();

        assertEquals(3, facture.niveauRelance);
        RappelHistoriqueEntity courrier = historique(facture).get(0);
        assertTrue(courrier.courrier);
        assertNull(courrier.dateImpression, "Le courrier reste à imprimer");
        assertEquals(3, courrier.numeroRappel);
        assertEquals("Jean Courrier, 1 rue du Port", courrier.destinataire);
        assertTrue(courrier.sujet.startsWith("Mise en demeure de payer - Facture FA-TEST"), courrier.sujet);
        assertTrue(courrier.contenu.contains(String.format("%.2f", 500.0)), "Le courrier reprend le solde dû");
        assertFalse(historique(devis).get(0).courrier, "Les relances de devis partent toujours par email");
        assertEquals(1, mailbox.getMailsSentTo("jean.courrier@test.com").size(), "Seule la relance du devis part par email");
    }

    @Test
    @TestTransaction
    void testCourrierPourUnClientSansEmail() {
        parametrerRelances(15, 30, 45);
        SocieteEntity.<SocieteEntity>findById(1L).relance3Courrier = true;
        ClientEntity sansEmail = new ClientEntity();
        sansEmail.nom = "Sans Email";
        sansEmail.type = "Particulier";
        sansEmail.adresse = "3 quai Est\n29900 Concarneau";
        sansEmail.persist();
        VenteEntity relance1 = facture(sansEmail, 500.0);
        relance1.dateEcheance = ilYA(20);
        relance1.persist();
        VenteEntity relance3 = facture(sansEmail, 500.0);
        relance3.dateEcheance = ilYA(50);
        relance3.persist();

        rappelScheduler.envoyerRelances();

        assertEquals(0, relance1.niveauRelance, "La relance 1 part par email : rien pour un client sans email");
        assertEquals(3, relance3.niveauRelance);
        assertEquals("Sans Email, 3 quai Est, 29900 Concarneau", historique(relance3).get(0).destinataire);
    }

    private static RappelScheduler.RelanceDue relanceDue(List<RappelScheduler.RelanceDue> dues, VenteEntity vente) {
        RappelScheduler.RelanceDue relance = relanceDueOuNull(dues, vente);
        assertNotNull(relance, "Une relance est due pour la vente " + vente.id);
        return relance;
    }

    private static RappelScheduler.RelanceDue relanceDueOuNull(List<RappelScheduler.RelanceDue> dues, VenteEntity vente) {
        return dues.stream().filter(r -> r.vente().id.equals(vente.id)).findFirst().orElse(null);
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
