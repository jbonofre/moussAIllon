package net.nanthrax.moussaillon.services;

import net.nanthrax.moussaillon.persistence.ModuleApplication;
import net.nanthrax.moussaillon.persistence.SocieteAbonnementMoisEntity;
import net.nanthrax.moussaillon.persistence.SocietePaiementEntity;
import org.junit.jupiter.api.Test;

import java.sql.Timestamp;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class DataInitializerTest {

    @Test
    void testAdminDonneTousLesModules() {
        assertEquals(EnumSet.allOf(ModuleApplication.class), DataInitializer.modulesDepuisRoles("ADMIN"));
    }

    @Test
    void testRolesConvertisEnModules() {
        assertEquals(Set.of(ModuleApplication.VENTE, ModuleApplication.PARC, ModuleApplication.CATALOGUE),
            DataInitializer.modulesDepuisRoles("vendeur, manager,magasinier"));
    }

    @Test
    void testRoleInconnuOuAbsent() {
        assertTrue(DataInitializer.modulesDepuisRoles("TECHNICIEN").isEmpty());
        assertTrue(DataInitializer.modulesDepuisRoles(null).isEmpty());
    }

    private static SocietePaiementEntity paiement(SocietePaiementEntity.Type type, double montant, String date) {
        SocietePaiementEntity paiement = new SocietePaiementEntity();
        paiement.type = type;
        paiement.montant = montant;
        paiement.date = Timestamp.valueOf(date);
        return paiement;
    }

    @Test
    void testMoisPayesReconstitues() {
        // Payé un mois en janvier, puis l'année en février : échéance suivante le 15/02/2027
        SocietePaiementEntity mensuel = paiement(SocietePaiementEntity.Type.MENSUEL, 150.0, "2026-01-20 10:00:00");
        SocietePaiementEntity annuel = paiement(SocietePaiementEntity.Type.ANNUEL, 1650.0, "2026-02-10 10:00:00");
        annuel.modules.add(ModuleApplication.VENTE);

        List<SocieteAbonnementMoisEntity> mois = DataInitializer.moisDepuisPaiements(
            List.of(mensuel, annuel), Timestamp.valueOf("2027-02-15 00:00:00"));

        assertEquals(13, mois.size());
        assertEquals(Timestamp.valueOf("2026-02-15 00:00:00"), annuel.periodeDebut);
        assertEquals(Timestamp.valueOf("2027-02-15 00:00:00"), annuel.periodeFin);
        assertEquals(Timestamp.valueOf("2026-01-15 00:00:00"), mensuel.periodeDebut);
        assertEquals(Timestamp.valueOf("2026-02-15 00:00:00"), mensuel.periodeFin);

        assertEquals(Timestamp.valueOf("2027-01-15 00:00:00"), mois.get(0).debut);
        assertEquals(Timestamp.valueOf("2027-02-15 00:00:00"), mois.get(0).fin);
        assertEquals(137.5, mois.get(0).montant, 0.001);
        assertEquals(Set.of(ModuleApplication.VENTE), mois.get(0).modules);
        assertEquals(SocietePaiementEntity.Type.ANNUEL, mois.get(0).typePaiement);
        assertEquals(1650.0, mois.subList(0, 12).stream().mapToDouble(m -> m.montant).sum(), 0.001);

        // Avant les modules, l'abonnement les comprenait tous
        assertEquals(Timestamp.valueOf("2026-01-15 00:00:00"), mois.get(12).debut);
        assertEquals(EnumSet.allOf(ModuleApplication.class), mois.get(12).modules);
        assertEquals(150.0, mois.get(12).montant, 0.001);
    }

}
