package net.nanthrax.moussaillon.services;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.LinkedHashMap;
import java.util.Map;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import net.nanthrax.moussaillon.persistence.ClientEntity;
import org.hibernate.Session;

/**
 * ClientEntity no longer has a 'prenom' field (fusionné dans 'nom' : "Prénom Nom"), mais la
 * colonne existe encore en base pour les clients créés avant ce changement.
 *
 * Runs once on startup, idempotent : ne traite que les lignes où la colonne orpheline 'prenom'
 * contient encore une valeur, et la vide après fusion.
 */
@ApplicationScoped
public class ClientNomMigrator {

    @Transactional
    void onStart(@Observes StartupEvent event) {
        EntityManager em = ClientEntity.getEntityManager();
        em.unwrap(Session.class).doWork(connection -> {
            if (!hasPrenomColumn(connection)) {
                return;
            }
            Map<Long, String> merges = new LinkedHashMap<>();
            try (Statement query = connection.createStatement();
                 ResultSet rs = query.executeQuery(
                     "SELECT id, prenom, nom FROM ClientEntity WHERE prenom IS NOT NULL AND TRIM(prenom) <> ''")) {
                while (rs.next()) {
                    long id = rs.getLong("id");
                    String prenom = rs.getString("prenom").trim();
                    String nom = rs.getString("nom");
                    String merged = (prenom + " " + (nom != null ? nom : "")).trim();
                    merges.put(id, merged);
                }
            }
            if (merges.isEmpty()) {
                return;
            }
            try (PreparedStatement update = connection.prepareStatement("UPDATE ClientEntity SET nom = ?, prenom = NULL WHERE id = ?")) {
                for (Map.Entry<Long, String> entry : merges.entrySet()) {
                    update.setString(1, entry.getValue());
                    update.setLong(2, entry.getKey());
                    update.addBatch();
                }
                update.executeBatch();
            }
        });
    }

    private boolean hasPrenomColumn(java.sql.Connection connection) throws java.sql.SQLException {
        try (Statement query = connection.createStatement();
             ResultSet rs = query.executeQuery(
                 "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                     + "WHERE TABLE_NAME = 'CLIENTENTITY' AND COLUMN_NAME = 'PRENOM'")) {
            return rs.next();
        }
    }
}
