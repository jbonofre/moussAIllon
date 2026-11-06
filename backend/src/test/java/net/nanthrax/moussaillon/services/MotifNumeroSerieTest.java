package net.nanthrax.moussaillon.services;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class MotifNumeroSerieTest {

    @Test
    void testNumeroExact() {
        assertTrue(MotifNumeroSerie.correspond("6EK-1012345", "6ek-1012345 "));
        assertFalse(MotifNumeroSerie.correspond("6EK-1012345", "6EK-10123456"));
    }

    @Test
    void testJokers() {
        assertTrue(MotifNumeroSerie.correspond("6EK-10*", "6EK-1012345"));
        assertTrue(MotifNumeroSerie.correspond("6EK-10*", "6EK-10"));
        assertFalse(MotifNumeroSerie.correspond("6EK-10*", "6EL-1012345"));
        assertTrue(MotifNumeroSerie.correspond("1B2345??", "1B234567"));
        assertFalse(MotifNumeroSerie.correspond("1B2345??", "1B2345678"));
        // Les caractères spéciaux des expressions régulières sont pris à la lettre
        assertTrue(MotifNumeroSerie.correspond("F.115(X)*", "F.115(X)-01"));
        assertFalse(MotifNumeroSerie.correspond("F.115*", "FA115"));
    }

    @Test
    void testPlage() {
        assertTrue(MotifNumeroSerie.correspond("1B000000..1B099999", "1B000000"));
        assertTrue(MotifNumeroSerie.correspond("1B000000..1B099999", "1b054321"));
        assertTrue(MotifNumeroSerie.correspond("1B000000..1B099999", "1B099999"));
        assertFalse(MotifNumeroSerie.correspond("1B000000..1B099999", "1B100000"));
        assertFalse(MotifNumeroSerie.correspond("1B000000..1B099999", "1C000001"));
        assertFalse(MotifNumeroSerie.correspond("1B000000..1B099999", "1B"));
        // Les parties numériques sont comparées par valeur
        assertTrue(MotifNumeroSerie.correspond("SN-900..SN-1200", "SN-1000"));
        assertFalse(MotifNumeroSerie.correspond("SN-900..SN-1200", "SN-1500"));
    }

    @Test
    void testPlageOuverte() {
        assertTrue(MotifNumeroSerie.correspond("1B050000..", "1B999999"));
        assertFalse(MotifNumeroSerie.correspond("1B050000..", "1B049999"));
        assertTrue(MotifNumeroSerie.correspond("..1B050000", "1B000001"));
        assertFalse(MotifNumeroSerie.correspond("..", "1B000001"));
    }

    @Test
    void testPlusieursMotifs() {
        String motifs = "6EK-10*; 1B000000 .. 1B099999,\n 0R123456";
        assertTrue(MotifNumeroSerie.correspond(motifs, "6EK-1099999"));
        assertTrue(MotifNumeroSerie.correspond(motifs, "1B012345"));
        assertTrue(MotifNumeroSerie.correspond(motifs, "0R123456"));
        assertFalse(MotifNumeroSerie.correspond(motifs, "0R123457"));
    }

    @Test
    void testSansMotifOuSansNumero() {
        assertFalse(MotifNumeroSerie.correspond(null, "1B000000"));
        assertFalse(MotifNumeroSerie.correspond(" , ;", "1B000000"));
        assertFalse(MotifNumeroSerie.correspond("*", null));
        assertFalse(MotifNumeroSerie.correspond("*", "  "));
    }
}
