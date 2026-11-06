package net.nanthrax.moussaillon.services;

import net.nanthrax.moussaillon.persistence.ModuleApplication;
import net.nanthrax.moussaillon.persistence.SocieteAbonnementMoisEntity;
import net.nanthrax.moussaillon.persistence.SocietePaiementEntity;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
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

    @Test
    void testUnicitesGlobalesSupprimees() throws SQLException {
        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:unicites");
             Statement statement = connection.createStatement()) {
            statement.executeUpdate("CREATE TABLE FournisseurEntity (id BIGINT PRIMARY KEY, chantier VARCHAR(40), nom VARCHAR(255))");
            statement.executeUpdate("ALTER TABLE FournisseurEntity ADD CONSTRAINT UK_NOM UNIQUE (nom)");
            statement.executeUpdate("ALTER TABLE FournisseurEntity ADD CONSTRAINT UK_CHANTIER_NOM UNIQUE (chantier, nom)");
            statement.executeUpdate("CREATE TABLE ChantierEntity (code VARCHAR(40) PRIMARY KEY, nom VARCHAR(255) UNIQUE)");

            List<String> tables = DataInitializer.tablesChantier(connection);
            assertEquals(List.of("FOURNISSEURENTITY"), tables);
            DataInitializer.supprimerUnicitesGlobales(connection, tables);

            // Même nom dans deux chantiers, pas deux fois dans le même
            statement.executeUpdate("INSERT INTO FournisseurEntity VALUES (1, 'a', 'Marine Parts')");
            statement.executeUpdate("INSERT INTO FournisseurEntity VALUES (2, 'b', 'Marine Parts')");
            assertThrows(SQLException.class, () -> statement.executeUpdate("INSERT INTO FournisseurEntity VALUES (3, 'a', 'Marine Parts')"));
            // Les tables communes gardent leurs contraintes
            statement.executeUpdate("INSERT INTO ChantierEntity VALUES ('a', 'Port')");
            assertThrows(SQLException.class, () -> statement.executeUpdate("INSERT INTO ChantierEntity VALUES ('b', 'Port')"));
        }
    }

    @Test
    void testAnciensUtilisateursLus() throws SQLException {
        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:utilisateurs");
             Statement statement = connection.createStatement()) {
            assertTrue(DataInitializer.lireAnciensUtilisateurs(connection).isEmpty());

            statement.executeUpdate("CREATE TABLE UserEntity (name VARCHAR(255) PRIMARY KEY, password VARCHAR(255), email VARCHAR(255), theme TINYINT, roles VARCHAR(255))");
            statement.executeUpdate("CREATE TABLE UserEntity_modules (UserEntity_name VARCHAR(255), modules VARCHAR(64))");
            statement.executeUpdate("INSERT INTO UserEntity VALUES ('admin', 'hash', 'admin@port.fr', 1, NULL)");
            statement.executeUpdate("INSERT INTO UserEntity VALUES ('vendeur', 'hash2', 'v@port.fr', NULL, 'vendeur')");
            statement.executeUpdate("INSERT INTO UserEntity_modules VALUES ('admin', 'PARAMETRAGE'), ('admin', 'ATELIER'), ('admin', 'INCONNU')");

            List<DataInitializer.AncienUtilisateur> utilisateurs = DataInitializer.lireAnciensUtilisateurs(connection);
            assertEquals(2, utilisateurs.size());
            DataInitializer.AncienUtilisateur admin = utilisateurs.stream().filter(u -> u.name().equals("admin")).findFirst().orElseThrow();
            assertEquals("hash", admin.password());
            assertEquals(1, admin.theme());
            assertEquals(EnumSet.of(ModuleApplication.PARAMETRAGE, ModuleApplication.ATELIER), admin.modules());
            DataInitializer.AncienUtilisateur vendeur = utilisateurs.stream().filter(u -> u.name().equals("vendeur")).findFirst().orElseThrow();
            assertEquals(EnumSet.of(ModuleApplication.VENTE), vendeur.modules());
        }
    }

    @Test
    void testQuantitesConverties() throws SQLException {
        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:quantites");
             Statement statement = connection.createStatement()) {
            statement.executeUpdate("CREATE TABLE VenteProduitEntity (id BIGINT PRIMARY KEY, quantite INTEGER NOT NULL)");
            statement.executeUpdate("INSERT INTO VenteProduitEntity VALUES (1, 3)");

            DataInitializer.convertirQuantitesEnDecimal(connection);
            // Sans effet sur une colonne déjà convertie
            DataInitializer.convertirQuantitesEnDecimal(connection);

            try (ResultSet rs = statement.executeQuery("SELECT DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS "
                    + "WHERE TABLE_NAME = 'VENTEPRODUITENTITY' AND COLUMN_NAME = 'QUANTITE'")) {
                assertTrue(rs.next());
                assertEquals("DOUBLE PRECISION", rs.getString(1));
                assertEquals("NO", rs.getString(2));
            }
            statement.executeUpdate("INSERT INTO VenteProduitEntity VALUES (2, 5.5)");
            try (ResultSet rs = statement.executeQuery("SELECT quantite FROM VenteProduitEntity ORDER BY id")) {
                assertTrue(rs.next());
                assertEquals(3.0, rs.getDouble(1), 0.0);
                assertTrue(rs.next());
                assertEquals(5.5, rs.getDouble(1), 0.0);
            }
            assertThrows(SQLException.class, () -> statement.executeUpdate("INSERT INTO VenteProduitEntity VALUES (3, NULL)"));
        }
    }

}
