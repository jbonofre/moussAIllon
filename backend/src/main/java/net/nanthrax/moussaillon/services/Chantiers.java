package net.nanthrax.moussaillon.services;

import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import net.nanthrax.moussaillon.persistence.ChantierEntity;
import org.jboss.logging.Logger;

import java.util.List;
import java.util.concurrent.Callable;

/**
 * Exécution de traitements dans les données d'un chantier donné, hors requête de ce chantier : tâches planifiées
 * (pour chaque chantier), migrations au démarrage, administration. Chaque traitement a sa propre transaction,
 * donc sa propre session Hibernate, ouverte sur le chantier demandé.
 */
@ApplicationScoped
public class Chantiers {

    private static final Logger LOG = Logger.getLogger(Chantiers.class);

    @Inject
    ChantierContexte contexte;

    /** Exécute le traitement dans les données du chantier, dans une nouvelle transaction. */
    public <T> T dans(String code, Callable<T> traitement) {
        String precedent = contexte.brut();
        contexte.definir(code);
        try {
            return QuarkusTransaction.requiringNew().call(traitement);
        } finally {
            contexte.definir(precedent);
        }
    }

    public void dans(String code, Runnable traitement) {
        dans(code, () -> {
            traitement.run();
            return null;
        });
    }

    /** Exécute le traitement avec une vue sur les données de tous les chantiers (aucune donnée n'y est créée). */
    public void enRacine(Runnable traitement) {
        dans(ChantierContexte.RACINE, traitement);
    }

    public <T> T enRacine(Callable<T> traitement) {
        return dans(ChantierContexte.RACINE, traitement);
    }

    /** Chantier portant ce code, lu dans une transaction à part (sans ouvrir la session de la requête). */
    public ChantierEntity trouver(String code) {
        if (code == null || code.isBlank()) {
            return null;
        }
        return QuarkusTransaction.requiringNew().call(() -> ChantierEntity.<ChantierEntity>findById(code));
    }

    /** Codes de tous les chantiers. */
    public List<String> codes() {
        return QuarkusTransaction.requiringNew().call(() ->
            ChantierEntity.<ChantierEntity>listAll().stream().map(chantier -> chantier.code).sorted().toList());
    }

    /** Codes des chantiers dont l'accès n'est pas suspendu. */
    public List<String> actifs() {
        return QuarkusTransaction.requiringNew().call(() ->
            ChantierEntity.<ChantierEntity>list("accesSuspendu = false").stream().map(chantier -> chantier.code).sorted().toList());
    }

    /**
     * Exécute le traitement pour chaque chantier dont l'accès n'est pas suspendu, chacun dans sa transaction :
     * l'échec d'un chantier n'empêche pas le traitement des suivants.
     */
    public void pourChaqueChantier(String tache, Runnable traitement) {
        for (String code : actifs()) {
            try {
                dans(code, traitement);
            } catch (Exception e) {
                LOG.errorf(e, "%s : échec pour le chantier %s", tache, code);
            }
        }
    }

}
