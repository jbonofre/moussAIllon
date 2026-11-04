package net.nanthrax.moussaillon.services;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import net.nanthrax.moussaillon.persistence.ModuleApplication;
import net.nanthrax.moussaillon.persistence.ProduitCatalogueEntity;
import net.nanthrax.moussaillon.persistence.ReferenceValeurEntity;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import net.nanthrax.moussaillon.persistence.UserEntity;
import org.hibernate.Session;
import org.jboss.logging.Logger;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@ApplicationScoped
public class DataInitializer {

    private static final Logger LOG = Logger.getLogger(DataInitializer.class);

    @Transactional
    void onStart(@Observes StartupEvent event) {
        repairLegacySchema();

        if (UserEntity.count() == 0) {
            UserEntity admin = new UserEntity();
            admin.name = UserResource.ADMIN;
            admin.modules.addAll(EnumSet.allOf(ModuleApplication.class));
            admin.password = PasswordUtil.hash("admin");
            admin.email = "contact@msplaisance.com";
            admin.persist();
        } else {
            // L'utilisateur admin a toujours accès au module Paramétrage.
            UserEntity admin = UserEntity.findById(UserResource.ADMIN);
            if (admin != null) {
                admin.modules.add(ModuleApplication.PARAMETRAGE);
            }
        }
        if (SocieteEntity.count() == 0) {
            SocieteEntity societe = new SocieteEntity();
            societe.nom = "A changer";
            societe.siren = "A changer";
            societe.capital = 0;
            societe.adresse = "A changer";
            societe.persist();
        }
        if (ReferenceValeurEntity.count() == 0) {
            String[][] categories = {
                {"CATEGORIE_PRODUIT", "Pièces Moteur"},
                {"CATEGORIE_PRODUIT", "Pièces Remorque"},
                {"CATEGORIE_PRODUIT", "Electronique"},
                {"CATEGORIE_PRODUIT", "Sécurité"},
                {"CATEGORIE_PRODUIT", "Equipement & Accessoires"},
                {"CATEGORIE_PRODUIT", "Loisirs"},
                {"TYPE_BATEAU", "Bateau à Moteur"},
                {"TYPE_BATEAU", "Voilier"},
                {"TYPE_BATEAU", "Catamaran"},
                {"TYPE_BATEAU", "Péniche"},
                {"TYPE_BATEAU", "Pêche"},
                {"TYPE_BATEAU", "Annexe"},
                {"TYPE_BATEAU", "Autre"},
                {"TYPE_MOTEUR", "Hors-bord"},
                {"TYPE_MOTEUR", "In-bord"},
                {"TYPE_MOTEUR", "Electrique"},
                {"TYPE_MOTEUR", "Diesel"},
            };
            int ordre = 10;
            String currentType = "";
            for (String[] entry : categories) {
                if (!entry[0].equals(currentType)) {
                    currentType = entry[0];
                    ordre = 10;
                }
                ReferenceValeurEntity ref = new ReferenceValeurEntity();
                ref.type = entry[0];
                ref.valeur = entry[1];
                ref.ordre = ordre;
                ref.persist();
                ordre += 10;
            }
        }
    }

    /**
     * Certaines bases H2 locales/volumes persistants ont accumulé, au fil des refactors,
     * des colonnes NOT NULL (ex. FRAIS, PRIXPUBLIC) qui n'existent plus sur ProduitCatalogueEntity.
     * La stratégie de schéma "update" n'ajoute que les colonnes manquantes et ne supprime jamais
     * les colonnes obsolètes, ce qui fait échouer toute création de produit (issue #439).
     * On supprime ici toute colonne NOT NULL de la table qui ne correspond plus à un champ de
     * l'entité. Ce nettoyage est un no-op sur une base à jour ou fraîchement créée.
     */
    private void repairLegacySchema() {
        try {
            dropOrphanNotNullColumns(ProduitCatalogueEntity.class, "ProduitCatalogueEntity");
        } catch (Exception e) {
            LOG.warn("Impossible de nettoyer les colonnes obsolètes de ProduitCatalogueEntity", e);
        }
        try {
            dropRappelsParVente();
        } catch (Exception e) {
            LOG.warn("Impossible de supprimer les anciennes colonnes de rappel de VenteEntity", e);
        }
        try {
            elargirContenuHistoriqueRappels();
        } catch (Exception e) {
            LOG.warn("Impossible d'élargir la colonne contenu de RappelHistoriqueEntity", e);
        }
        try {
            convertirTypeModelesEmail();
        } catch (Exception e) {
            LOG.warn("Impossible de convertir la colonne type de EmailTemplateEntity", e);
        }
        try {
            migrerRolesVersModules();
        } catch (Exception e) {
            LOG.warn("Impossible de convertir les rôles des utilisateurs en modules", e);
        }
        EmailTemplateResource.migrerModeleRelance();
    }

    /**
     * Les rôles des utilisateurs sont remplacés par l'accès à des modules : chaque utilisateur
     * reçoit les modules correspondant à ses rôles, puis la colonne roles est supprimée
     * (NOT NULL, elle ferait échouer la création des utilisateurs).
     */
    private void migrerRolesVersModules() {
        EntityManager em = UserEntity.getEntityManager();
        Map<String, String> rolesParUtilisateur = new HashMap<>();
        boolean colonnePresente = em.unwrap(Session.class).doReturningWork(connection -> {
            try (Statement query = connection.createStatement();
                 ResultSet rs = query.executeQuery(
                     "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
                         + "WHERE TABLE_NAME = 'USERENTITY' AND COLUMN_NAME = 'ROLES'")) {
                if (!rs.next() || rs.getLong(1) == 0) {
                    return false;
                }
            }
            try (Statement query = connection.createStatement();
                 ResultSet rs = query.executeQuery("SELECT name, roles FROM UserEntity")) {
                while (rs.next()) {
                    rolesParUtilisateur.put(rs.getString(1), rs.getString(2));
                }
            }
            return true;
        });
        if (!colonnePresente) {
            return;
        }
        rolesParUtilisateur.forEach((name, roles) -> {
            UserEntity user = UserEntity.findById(name);
            if (user != null) {
                user.modules.addAll(modulesDepuisRoles(roles));
            }
        });
        em.flush();
        em.unwrap(Session.class).doWork(connection -> {
            try (Statement alter = connection.createStatement()) {
                alter.executeUpdate("ALTER TABLE UserEntity DROP COLUMN IF EXISTS roles");
            }
        });
        LOG.infof("Rôles de %d utilisateur(s) convertis en modules", rolesParUtilisateur.size());
    }

    /** Modules correspondant aux anciens rôles (liste séparée par des virgules). */
    static Set<ModuleApplication> modulesDepuisRoles(String roles) {
        Set<ModuleApplication> modules = EnumSet.noneOf(ModuleApplication.class);
        if (roles == null) {
            return modules;
        }
        for (String role : roles.split(",")) {
            switch (role.trim().toLowerCase(Locale.ROOT)) {
                case "admin" -> modules.addAll(EnumSet.allOf(ModuleApplication.class));
                case "vendeur" -> modules.add(ModuleApplication.VENTE);
                case "manager" -> modules.add(ModuleApplication.PARC);
                case "magasinier" -> modules.add(ModuleApplication.CATALOGUE);
                default -> { }
            }
        }
        return modules;
    }

    /**
     * H2 crée la colonne d'un enum en ENUM natif, figé sur les valeurs connues à sa création :
     * le type PRET_A_RECUPERER, ajouté depuis, y est refusé. L'initialisation des modèles d'email
     * échouait alors en bloc, laissant la base sans aucun modèle (dont celui des relances).
     */
    private void convertirTypeModelesEmail() {
        EntityManager em = SocieteEntity.getEntityManager();
        em.unwrap(Session.class).doWork(connection -> {
            try (Statement query = connection.createStatement();
                 ResultSet rs = query.executeQuery(
                     "SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS "
                         + "WHERE TABLE_NAME = 'EMAILTEMPLATEENTITY' AND COLUMN_NAME = 'TYPE'")) {
                if (!rs.next() || !"ENUM".equals(rs.getString(1))) {
                    return;
                }
            }
            try (Statement alter = connection.createStatement()) {
                alter.executeUpdate("ALTER TABLE EmailTemplateEntity ALTER COLUMN type SET DATA TYPE VARCHAR(64)");
                LOG.info("Colonne EmailTemplateEntity.type convertie en VARCHAR");
            }
        });
    }

    /**
     * Le contenu des relances était limité à 255 caractères : tout email issu d'un modèle
     * dépassait cette taille et l'enregistrement de l'historique échouait.
     */
    private void elargirContenuHistoriqueRappels() {
        EntityManager em = SocieteEntity.getEntityManager();
        em.unwrap(Session.class).doWork(connection -> {
            try (Statement query = connection.createStatement();
                 ResultSet rs = query.executeQuery(
                     "SELECT CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS "
                         + "WHERE TABLE_NAME = 'RAPPELHISTORIQUEENTITY' AND COLUMN_NAME = 'CONTENU'")) {
                if (!rs.next() || rs.getLong(1) >= 10000) {
                    return;
                }
            }
            try (Statement alter = connection.createStatement()) {
                alter.executeUpdate("ALTER TABLE RappelHistoriqueEntity ALTER COLUMN contenu SET DATA TYPE VARCHAR(10000)");
                LOG.info("Colonne RappelHistoriqueEntity.contenu élargie à 10000 caractères");
            }
        });
    }

    /**
     * Les relances sont désormais paramétrées sur la société (issue #682) : les délais et drapeaux
     * de rappel portés par chaque vente disparaissent. Les drapeaux étant NOT NULL sans valeur par
     * défaut, les laisser en base ferait échouer la création des ventes.
     */
    private void dropRappelsParVente() {
        String[] colonnes = { "rappel1Jours", "rappel2Jours", "rappel3Jours", "rappel1Envoye", "rappel2Envoye", "rappel3Envoye" };
        EntityManager em = SocieteEntity.getEntityManager();
        em.unwrap(Session.class).doWork(connection -> {
            try (Statement alter = connection.createStatement()) {
                for (String colonne : colonnes) {
                    alter.executeUpdate("ALTER TABLE VenteEntity DROP COLUMN IF EXISTS " + colonne);
                }
            }
        });
    }

    private void dropOrphanNotNullColumns(Class<?> entityClass, String tableName) {
        Set<String> expectedColumns = new HashSet<>();
        for (Field field : entityClass.getDeclaredFields()) {
            if (Modifier.isStatic(field.getModifiers())) {
                continue;
            }
            expectedColumns.add(field.getName().toLowerCase(Locale.ROOT));
        }

        EntityManager em = ProduitCatalogueEntity.getEntityManager();
        em.unwrap(Session.class).doWork(connection -> {
            List<String> orphanColumns = new ArrayList<>();
            try (Statement query = connection.createStatement();
                 ResultSet rs = query.executeQuery(
                     "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                         + "WHERE TABLE_NAME = '" + tableName.toUpperCase(Locale.ROOT) + "' AND IS_NULLABLE = 'NO'")) {
                while (rs.next()) {
                    String columnName = rs.getString("COLUMN_NAME");
                    if (!"ID".equals(columnName) && !expectedColumns.contains(columnName.toLowerCase(Locale.ROOT))) {
                        orphanColumns.add(columnName);
                    }
                }
            }
            try (Statement alter = connection.createStatement()) {
                for (String column : orphanColumns) {
                    alter.executeUpdate("ALTER TABLE " + tableName + " DROP COLUMN IF EXISTS \"" + column + "\"");
                    LOG.infof("Colonne obsolète supprimée sur %s : %s", tableName, column);
                }
            }
        });
    }

}
