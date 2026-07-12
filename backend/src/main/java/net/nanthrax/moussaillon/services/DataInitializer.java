package net.nanthrax.moussaillon.services;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
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
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@ApplicationScoped
public class DataInitializer {

    private static final Logger LOG = Logger.getLogger(DataInitializer.class);

    @Transactional
    void onStart(@Observes StartupEvent event) {
        repairLegacySchema();

        if (UserEntity.count() == 0) {
            UserEntity admin = new UserEntity();
            admin.name = "admin";
            admin.roles = "admin";
            admin.password = PasswordUtil.hash("admin");
            admin.email = "contact@msplaisance.com";
            admin.persist();
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
