package net.nanthrax.moussaillon.persistence;

import jakarta.persistence.EntityListeners;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class FormatNomListenerTest {

    @Test
    void testToutEnMajuscules() {
        assertEquals("Foo Bar", FormatNomListener.formater("FOO BAR"));
        assertEquals("Hamon Jean-Luc", FormatNomListener.formater("HAMON JEAN-LUC"));
        assertEquals("Chantier Naval De L'Odet", FormatNomListener.formater("CHANTIER NAVAL DE L'ODET"));
        assertEquals("Élodie Lemaître", FormatNomListener.formater("ÉLODIE LEMAÎTRE"));
    }

    @Test
    void testToutEnMinuscules() {
        assertEquals("Foo Bar", FormatNomListener.formater("foo bar"));
        assertEquals("Le Gall Jean-Pierre", FormatNomListener.formater("le gall jean-pierre"));
    }

    @Test
    void testCasseMixteConservee() {
        assertEquals("McDonald Ronald", FormatNomListener.formater("McDonald Ronald"));
        assertEquals("Yamaha F150 XL", FormatNomListener.formater("Yamaha F150 XL"));
        assertEquals("de La Tour Jean", FormatNomListener.formater("de La Tour Jean"));
    }

    @Test
    void testMotsAvecChiffreConserves() {
        // Références et modèles : les mots contenant un chiffre restent tels que saisis.
        assertEquals("Moteur F150 Xl", FormatNomListener.formater("MOTEUR F150 XL"));
        assertEquals("Hors-Bord 15CV 4T", FormatNomListener.formater("HORS-BORD 15CV 4T"));
        assertEquals("12 Avenue De La Mer\n29000 Brest", FormatNomListener.formater("12 AVENUE DE LA MER\n29000 BREST"));
    }

    @Test
    void testSeparateurs() {
        assertEquals("S.A.R.L. Nautic", FormatNomListener.formater("S.A.R.L. NAUTIC"));
        assertEquals("Joint (Moteur)", FormatNomListener.formater("JOINT (MOTEUR)"));
        assertEquals("Vis/Écrou", FormatNomListener.formater("VIS/ÉCROU"));
        assertEquals("\"Le Goéland\"", FormatNomListener.formater("\"LE GOÉLAND\""));
    }

    @Test
    void testValeursSansLettre() {
        assertNull(FormatNomListener.formater(null));
        assertEquals("", FormatNomListener.formater(""));
        assertEquals("  ", FormatNomListener.formater("  "));
        assertEquals("29000", FormatNomListener.formater("29000"));
    }

    @Test
    void testEntitesAvecFormatNomDeclarentLeListener() throws Exception {
        // Sans @EntityListeners(FormatNomListener.class), l'annotation @FormatNom est sans effet.
        Path dossier = Path.of(ClientEntity.class.getProtectionDomain().getCodeSource().getLocation().toURI())
            .resolve(ClientEntity.class.getPackageName().replace('.', '/'));
        List<String> entites = new ArrayList<>();
        try (Stream<Path> fichiers = Files.list(dossier)) {
            for (Path fichier : fichiers.filter(f -> f.toString().endsWith(".class")).toList()) {
                String nom = fichier.getFileName().toString().replace(".class", "");
                Class<?> classe = Class.forName(ClientEntity.class.getPackageName() + "." + nom);
                boolean formatNom = Arrays.stream(classe.getDeclaredFields()).anyMatch(f -> f.isAnnotationPresent(FormatNom.class));
                if (formatNom) {
                    EntityListeners listeners = classe.getAnnotation(EntityListeners.class);
                    assertTrue(listeners != null && Arrays.asList(listeners.value()).contains(FormatNomListener.class),
                        classe.getSimpleName() + " doit déclarer @EntityListeners(FormatNomListener.class)");
                    entites.add(classe.getSimpleName());
                }
            }
        }
        assertTrue(entites.contains("ClientEntity"), "Entités trouvées : " + entites);
    }
}
