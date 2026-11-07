package net.nanthrax.moussaillon.services;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.List;

import io.quarkus.mailer.Attachment;
import io.quarkus.mailer.Mail;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.junit.jupiter.api.Assertions.*;

/** Mise en page des emails rédigés dans l'éditeur et images jointes au message (issue #757). */
public class EmailHtmlTest {

    @TempDir
    Path images;

    private Mail mail(String html) {
        return EmailHtml.mail("client@test.fr", "Sujet", html, images);
    }

    @Test
    void imageDeLApplicationJointeAuMessage() throws Exception {
        Files.write(images.resolve("photo.png"), new byte[] { 1, 2, 3 });

        Mail mail = mail("<p style=\"text-align: center;\"><img src=\"/api/images/photo.png\" width=\"280\"></p>");

        List<Attachment> jointes = mail.getAttachments();
        assertEquals(1, jointes.size());
        Attachment image = jointes.get(0);
        assertTrue(image.isInlineAttachment());
        assertEquals("photo.png", image.getName());
        assertEquals("<photo.png@moussaillon>", image.getContentId());
        assertEquals("image/png", image.getContentType());
        assertEquals(images.resolve("photo.png").toFile().getAbsoluteFile(), image.getFile().getAbsoluteFile());
        assertTrue(mail.getHtml().contains("<img src=\"cid:photo.png@moussaillon\" width=\"280\" style=\"max-width:100%;height:auto;border:0;\">"),
                mail.getHtml());
    }

    @Test
    void imageRepeteeJointeUneSeuleFois() throws Exception {
        Files.write(images.resolve("logo.jpg"), new byte[] { 1 });

        Mail mail = mail("<p><img src=\"/api/images/logo.jpg\"></p><p><img src=\"/api/images/logo.jpg\"></p>");

        assertEquals(1, mail.getAttachments().size());
        assertEquals(2, mail.getHtml().split("cid:logo.jpg@moussaillon", -1).length - 1);
    }

    @Test
    void imageEnLigneOuIntrouvableLaisseeEnLien() {
        Mail mail = mail("<p><img src=\"https://exemple.fr/banniere.png\"><img src=\"/api/images/absente.png\"></p>");

        assertTrue(mail.getAttachments().isEmpty());
        assertTrue(mail.getHtml().contains("src=\"https://exemple.fr/banniere.png\""));
        assertTrue(mail.getHtml().contains("src=\"/api/images/absente.png\""));
    }

    @Test
    void cheminHorsDuDossierDesImagesRefuse() throws Exception {
        Path dossier = Files.createDirectory(images.resolve("images"));
        Files.write(images.resolve("secret.png"), new byte[] { 1 });

        Mail mail = EmailHtml.mail("client@test.fr", "Sujet",
                "<p><img src=\"/api/images/../secret.png\"><img src=\"/api/images/..\"></p>", dossier);

        assertTrue(mail.getAttachments().isEmpty());
    }

    @Test
    void imageIntegreeEnBase64JointeAuMessage() {
        String base64 = Base64.getEncoder().encodeToString(new byte[] { 9, 8, 7 });

        Mail mail = mail("<p><img src=\"data:image/png;base64," + base64 + "\"></p>");

        assertEquals(1, mail.getAttachments().size());
        Attachment image = mail.getAttachments().get(0);
        assertEquals("image/png", image.getContentType());
        assertEquals("<image-1.png@moussaillon>", image.getContentId());
        assertTrue(mail.getHtml().contains("src=\"cid:image-1.png@moussaillon\""));
        assertFalse(mail.getHtml().contains("base64"));
    }

    @Test
    void contenuMisEnPageDansUneColonne() {
        String html = mail("<p>Bonjour</p>").getHtml();

        assertTrue(html.startsWith("<!DOCTYPE html>"));
        assertTrue(html.contains("max-width:600px"));
        assertTrue(html.contains("<p style=\"margin:0;\">Bonjour</p>"));
        assertTrue(html.endsWith("</body></html>"));
    }

    @Test
    void documentCompletEnvoyeTelQuel() {
        String document = "<html><body><p>Déjà mis en page</p></body></html>";

        assertEquals(document, mail(document).getHtml());
    }

    @Test
    void styleExistantConserveApresLeStyleParDefaut() {
        assertEquals("<p style=\"margin:0;text-align: center;\">Titre</p>", EmailHtml.styler("<p style=\"text-align: center;\">Titre</p>"));
        assertEquals("<h2 class=\"x\" style=\"margin:0;line-height:1.25;\">Titre</h2>", EmailHtml.styler("<h2 class=\"x\">Titre</h2>"));
        assertEquals("<img src=\"a.png\" style=\"max-width:100%;height:auto;border:0;\" />", EmailHtml.styler("<img src=\"a.png\" />"));
        // Les balises proches (pre, hr...) ne sont pas confondues avec p ou h1
        assertEquals("<pre>code</pre><hr>", EmailHtml.styler("<pre>code</pre><hr>"));
    }

    @Test
    void espacesInsecablesDeLEditeurRemplaces() {
        // Quill met un &nbsp; à la place de chaque espace : le texte ne pourrait plus passer à la ligne
        assertEquals("<p>Offre spéciale  hivernage</p>".replace("  ", "&nbsp; "),
                EmailHtml.texteEnHtml("<p>Offre&nbsp;spéciale&nbsp;&nbsp;hivernage</p>"));
    }

    @Test
    void texteSansBaliseGardeSesRetoursALaLigne() {
        assertEquals("Bonjour Dupont &amp; fils,<br><br>Cordialement", EmailHtml.texteEnHtml("Bonjour Dupont & fils,\n\nCordialement"));
    }
}
