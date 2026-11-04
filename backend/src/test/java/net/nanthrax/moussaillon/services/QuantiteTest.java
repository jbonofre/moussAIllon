package net.nanthrax.moussaillon.services;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class QuantiteTest {

    @Test
    void testQuantiteParDefaut() {
        assertEquals(1.0, Quantite.ouUn(0), 0.0);
        assertEquals(1.0, Quantite.ouUn(-2), 0.0);
        // Une embase contient 0,5 L d'huile : la quantité n'est pas ramenée à 1
        assertEquals(0.5, Quantite.ouUn(0.5), 0.0);
        assertEquals(5.5, Quantite.ouUn(5.5), 0.0);
    }

    @Test
    void testUnites() {
        assertEquals(1, Quantite.unites(0));
        assertEquals(1, Quantite.unites(0.5));
        assertEquals(2, Quantite.unites(2));
        assertEquals(2, Quantite.unites(1.5));
    }

    @Test
    void testFormat() {
        assertEquals("5", Quantite.format(5));
        assertEquals("10", Quantite.format(10));
        assertEquals("5.5", Quantite.format(5.5));
        assertEquals("2.25", Quantite.format(2.25));
        assertEquals("2.1", Quantite.format(2.1));
        assertEquals("-3", Quantite.format(-3));
    }

}
