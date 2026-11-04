package net.nanthrax.moussaillon.services;

import net.nanthrax.moussaillon.persistence.ModuleApplication;
import org.junit.jupiter.api.Test;

import java.util.EnumSet;
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

}
