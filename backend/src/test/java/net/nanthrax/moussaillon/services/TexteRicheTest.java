package net.nanthrax.moussaillon.services;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** Description mise en forme des annonces : balises conservées et flux NautiX. */
public class TexteRicheTest {

    @Test
    void texteBrutLaisseTelQuel() {
        assertFalse(TexteRiche.estHtml("Moteur < 300 h & entretenu"));
        assertEquals("Moteur < 300 h & entretenu\nTrès bon état", TexteRiche.nettoyer("Moteur < 300 h & entretenu\nTrès bon état"));
        assertNull(TexteRiche.nettoyer(null));
    }

    @Test
    void seulesLesBalisesDeMiseEnFormeSansAttributSontGardees() {
        assertEquals("<p><strong>Gras</strong> et <em>italique</em></p>",
                TexteRiche.nettoyer("<P class=\"x\"><strong style=\"color:red\">Gras</strong> et <em>italique</em></P>"));
        // Texte d'un client affiché au chantier : ni script, ni gestionnaire d'événement, ni lien
        assertEquals("<p>Bonjour </p><p>lien</p>", TexteRiche.nettoyer(
                "<p>Bonjour <img src=x onerror=\"alert(1)\"><script>alert(2)</script></p><p><a href=\"javascript:alert(3)\">lien</a></p>"));
        assertEquals("<b>survol</b>", TexteRiche.nettoyer("<b onmouseover=\"alert(1)\">survol</b>"));
    }

    @Test
    void espacesInsecablesDeLEditeurRemplaces() {
        assertEquals("<p>Très bon  état</p>".replace("  ", "&nbsp; "), TexteRiche.nettoyer("<p>Très&nbsp;bon&nbsp;&nbsp;état</p>"));
    }

    @Test
    void listesNumeroteesEtImbriqueesEnLignes() {
        assertEquals("1. Coque<br>&nbsp;&nbsp;&nbsp;• antifouling<br>2. Moteur",
                TexteRiche.versHtmlSimple("<ol><li>Coque<ul><li>antifouling</li></ul></li><li>Moteur</li></ol>"));
        assertEquals("Ligne 1<br><br>Ligne 3",
                TexteRiche.versHtmlSimple("<p>Ligne 1</p><p><br></p><p>Ligne 3</p>"));
        assertEquals("<u>Souligné</u> barré", TexteRiche.versHtmlSimple("<p><u>Souligné</u> <s>barré</s></p>"));
    }
}
