package net.nanthrax.moussaillon.services;

import net.nanthrax.moussaillon.persistence.VenteEntity;
import org.junit.jupiter.api.Test;

import java.sql.Timestamp;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Test unitaire (sans contexte Quarkus) de l'arithmétique de
 * {@link ClientResource#averageDelaiPaiementJours}, utilisée à la fois pour le délai de
 * paiement moyen par client et pour la moyenne globale du tableau de bord.
 */
public class ClientResourceAverageDelaiPaiementTest {

    private static VenteEntity venteAvecDelai(long joursDelai) {
        VenteEntity vente = new VenteEntity();
        long now = System.currentTimeMillis();
        vente.dateFacturePrete = new Timestamp(now - 30L * 86_400_000);
        vente.dateFacturePayee = new Timestamp(vente.dateFacturePrete.getTime() + joursDelai * 86_400_000);
        return vente;
    }

    @Test
    void testMoyenneListeVide() {
        assertNull(ClientResource.averageDelaiPaiementJours(List.of()));
    }

    @Test
    void testMoyenneUneFacture() {
        Double moyenne = ClientResource.averageDelaiPaiementJours(List.of(venteAvecDelai(3)));
        assertEquals(3.0, moyenne, 0.01);
    }

    @Test
    void testMoyennePlusieursFactures() {
        Double moyenne = ClientResource.averageDelaiPaiementJours(
            List.of(venteAvecDelai(2), venteAvecDelai(4), venteAvecDelai(6))
        );
        assertEquals(4.0, moyenne, 0.01); // (2 + 4 + 6) / 3
    }
}
