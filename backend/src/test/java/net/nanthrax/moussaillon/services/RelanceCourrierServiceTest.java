package net.nanthrax.moussaillon.services;

import net.nanthrax.moussaillon.persistence.ClientEntity;
import net.nanthrax.moussaillon.persistence.RappelHistoriqueEntity;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import net.nanthrax.moussaillon.persistence.VenteEntity;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Test unitaire (sans contexte Quarkus) des courriers de relance. */
public class RelanceCourrierServiceTest {

    private static RappelHistoriqueEntity courrier(String nomClient, String adresse, String contenu) {
        ClientEntity client = new ClientEntity();
        client.nom = nomClient;
        client.adresse = adresse;
        VenteEntity vente = new VenteEntity();
        vente.client = client;
        vente.numeroFacture = "FA26-00012";
        RappelHistoriqueEntity courrier = new RappelHistoriqueEntity();
        courrier.vente = vente;
        courrier.courrier = true;
        courrier.numeroRappel = 3;
        courrier.sujet = "Mise en demeure de payer - Facture FA26-00012";
        courrier.contenu = contenu;
        courrier.dateImpression = Timestamp.valueOf(LocalDate.of(2026, 11, 5).atStartOfDay());
        return courrier;
    }

    private static SocieteEntity societe() {
        SocieteEntity societe = new SocieteEntity();
        societe.nom = "MS Plaisance";
        societe.adresse = "10 quai du Port\n29900 Concarneau";
        societe.telephone = "0298000000";
        societe.siren = "123456789";
        return societe;
    }

    private static String texte(byte[] pdf) throws Exception {
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            return new PDFTextStripper().getText(doc);
        }
    }

    private static int pages(byte[] pdf) throws Exception {
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            return doc.getNumberOfPages();
        }
    }

    @Test
    void testLignesDuMessageHtml() {
        List<RelanceCourrierService.Ligne> lignes = RelanceCourrierService.lignes(
            "<p>Bonjour <strong>Jean</strong>,</p><p><br></p><p>Solde&nbsp;dû<br/>Tom &amp; Jerry</p><ul><li>un</li></ul>texte libre");

        assertEquals(6, lignes.size());
        List<RelanceCourrierService.Mot> bonjour = lignes.get(0).mots();
        assertEquals(List.of("Bonjour", "Jean", ","), bonjour.stream().map(RelanceCourrierService.Mot::texte).toList());
        assertTrue(bonjour.get(1).gras());
        assertTrue(bonjour.get(1).espaceAvant());
        assertFalse(bonjour.get(2).gras());
        assertFalse(bonjour.get(2).espaceAvant(), "La virgule reste accolée au mot en gras");
        assertTrue(lignes.get(0).finParagraphe());
        assertTrue(lignes.get(1).mots().isEmpty(), "Un paragraphe vide donne une seule ligne vide");
        assertTrue(lignes.get(1).finParagraphe());
        assertEquals("Solde dû", lignes.get(2).mots().get(0).texte(), "L'espace insécable lie les deux mots");
        assertFalse(lignes.get(2).finParagraphe(), "Un retour à la ligne ne termine pas le paragraphe");
        assertEquals(List.of("Tom", "&", "Jerry"), lignes.get(3).mots().stream().map(RelanceCourrierService.Mot::texte).toList());
        assertEquals(List.of("•", "un"), lignes.get(4).mots().stream().map(RelanceCourrierService.Mot::texte).toList());
        assertEquals("texte", lignes.get(5).mots().get(0).texte());
    }

    @Test
    void testCourrierAvecExpediteurDestinataireEtObjet() throws Exception {
        RappelHistoriqueEntity courrier = courrier("Jean Dupont", "1 rue du Port\n29000 Quimper",
            "<p>Madame, Monsieur,</p><p>Nous vous mettons en demeure de régler <strong>300,00 EUR</strong> → sous huit jours.</p>");

        byte[] pdf = new RelanceCourrierService().generer(List.of(courrier), societe());

        assertEquals(1, pages(pdf));
        String texte = texte(pdf);
        assertTrue(texte.contains("MS Plaisance"), texte);
        assertTrue(texte.contains("29900 Concarneau"), texte);
        assertTrue(texte.contains("Tél. : 0298000000"), texte);
        assertTrue(texte.contains("Jean Dupont"), texte);
        assertTrue(texte.contains("29000 Quimper"), texte);
        assertTrue(texte.contains("Le 05/11/2026"), "Le courrier est daté de sa première impression");
        assertTrue(texte.contains("Objet : Mise en demeure de payer - Facture FA26-00012"), texte);
        assertTrue(texte.contains("régler 300,00 EUR ? sous huit jours"), "Un caractère hors WinAnsi est remplacé : " + texte);
        assertTrue(texte.contains("SIREN 123456789"), "Mentions légales en pied de page : " + texte);
    }

    @Test
    void testUneLettreParCourrierEtSautDePage() throws Exception {
        String longMessage = "<p>" + "Nous vous rappelons que cette facture reste impayée malgré nos relances. ".repeat(40) + "</p>";
        RappelHistoriqueEntity long1 = courrier("Jean Dupont", "1 rue du Port", longMessage.repeat(2));
        RappelHistoriqueEntity court = courrier("Sophie Martin", null, "<p>Madame, Monsieur,</p>");
        RelanceCourrierService service = new RelanceCourrierService();

        int pagesLong = pages(service.generer(List.of(long1), null));
        byte[] pdf = service.generer(List.of(long1, court), null);

        assertTrue(pagesLong > 1, "Le long message déborde sur une page suivante");
        assertEquals(pagesLong + 1, pages(pdf), "Le second courrier commence sur une nouvelle page");
        assertTrue(texte(pdf).contains("Sophie Martin"));
    }
}
