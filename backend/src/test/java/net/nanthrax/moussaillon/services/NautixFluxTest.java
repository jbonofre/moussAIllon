package net.nanthrax.moussaillon.services;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;

import net.nanthrax.moussaillon.persistence.AnnonceEntity;
import net.nanthrax.moussaillon.persistence.SocieteEntity;

class NautixFluxTest {

    @Test
    void testAdresseSurPlusieursLignes() {
        assertEquals(new NautixFlux.Adresse("1 quai du Port, Bâtiment B", "56000", "Vannes"),
                NautixFlux.adresse("1 quai du Port\nBâtiment B\n56000 Vannes"));
    }

    @Test
    void testAdresseSurUneLigne() {
        assertEquals(new NautixFlux.Adresse("1 quai du Port", "56000", "Vannes"),
                NautixFlux.adresse("1 quai du Port, 56000 Vannes"));
    }

    @Test
    void testAdresseSansCodePostal() {
        assertEquals(new NautixFlux.Adresse("10 quai du Port", null, null), NautixFlux.adresse("10 quai du Port"));
        assertEquals(new NautixFlux.Adresse(null, null, null), NautixFlux.adresse("  "));
    }

    @Test
    void testAvertissementsSociete() {
        SocieteEntity societe = new SocieteEntity();
        societe.nom = "Chantier";
        societe.adresse = "1 quai du Port\n56000 Vannes";
        societe.email = "contact@chantier.fr";
        assertTrue(NautixFlux.avertissements(societe).isEmpty());

        societe.adresse = "1 quai du Port";
        societe.email = null;
        assertEquals(List.of(
                "L'adresse de la société doit se terminer par le code postal et la ville (ex. 56000 Vannes)",
                "Email de la société manquant (fiche Société)"), NautixFlux.avertissements(societe));
        assertEquals(3, NautixFlux.avertissements((SocieteEntity) null).size());
    }

    @Test
    void testTypeBateau() {
        // Catégories générales : règle NautiX selon la longueur (yacht au-delà de 9 m)
        assertEquals("power-daycruiser", NautixFlux.typeBateau("Bateau à Moteur", 6.5));
        assertEquals("power-yacht", NautixFlux.typeBateau("Bateau à Moteur", 12));
        assertEquals("sail-cabin", NautixFlux.typeBateau("Voilier", 8));
        assertEquals("sail-yacht", NautixFlux.typeBateau("Voilier", 11.3));
        assertEquals("power-daycruiser", NautixFlux.typeBateau(null, 0));
        assertEquals("power-daycruiser", NautixFlux.typeBateau("Autre", 5));
        // Catégories précises de la liste de référence
        assertEquals("sail-catamaran", NautixFlux.typeBateau("Catamaran", 12));
        assertEquals("power-catamaran", NautixFlux.typeBateau("Catamaran à moteur", 12));
        assertEquals("power-houseboat", NautixFlux.typeBateau("Péniche", 15));
        assertEquals("power-fishing", NautixFlux.typeBateau("Pêche", 6));
        assertEquals("small-dinghy", NautixFlux.typeBateau("Annexe", 2.5));
        assertEquals("inflatable-rib", NautixFlux.typeBateau("Semi-rigide", 6));
        assertEquals("inflatable-rib", NautixFlux.typeBateau("RIB", 6));
        assertEquals("pwc-jetski", NautixFlux.typeBateau("Jet ski", 3));
    }

    @Test
    void testMoteur() {
        assertEquals("outboard", NautixFlux.typeMoteur("Hors-bord"));
        assertEquals("inboard", NautixFlux.typeMoteur("In-bord"));
        assertNull(NautixFlux.typeMoteur("Diesel"));
        assertEquals("diesel", NautixFlux.carburant("Diesel"));
        assertEquals("electric", NautixFlux.carburant("Electrique"));
        assertNull(NautixFlux.carburant("Hors-bord"));
    }

    @Test
    void testDescriptionEchappeLeHtml() {
        AnnonceEntity annonce = new AnnonceEntity();
        annonce.titre = "Flyer 7.7 <révisé>";
        annonce.description = "Très bon état\nMoteur < 300 h & entretenu";
        assertEquals("<b>Flyer 7.7 &lt;révisé&gt;</b><br><br>Très bon état<br>Moteur &lt; 300 h &amp; entretenu",
                NautixFlux.description(annonce));
        assertNull(NautixFlux.description(new AnnonceEntity()));
    }

    @Test
    void testValeurs() {
        assertEquals("25000", NautixFlux.decimal(25000));
        assertEquals("7.7", NautixFlux.decimal(7.7));
        assertEquals("2.55", NautixFlux.decimal(2.549));
        assertEquals("2019", NautixFlux.annee("2019-04-01"));
        assertNull(NautixFlux.annee("01/04/2019"));
        assertNull(NautixFlux.annee(null));
        assertArrayEquals(new double[] { 47.65, -2.76 }, NautixFlux.gps("47.65,-2.76"));
        assertNull(NautixFlux.gps("47.65"));
        assertNull(NautixFlux.gps("147.65,-2.76"));
        assertEquals("image/jpeg", NautixFlux.typeImage("/api/images/a.JPG"));
        assertEquals("image/webp", NautixFlux.typeImage("https://cdn.example.com/b.webp?v=2"));
        assertNull(NautixFlux.typeImage("/api/images/c.heic"));
        assertEquals("https://chantier.example.com/api/images/a.jpg", NautixFlux.urlAbsolue("/api/images/a.jpg", "https://chantier.example.com/"));
        assertEquals("https://cdn.example.com/b.png", NautixFlux.urlAbsolue("https://cdn.example.com/b.png", "https://chantier.example.com"));
    }

}
