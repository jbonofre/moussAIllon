package net.nanthrax.moussaillon.services;

import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import net.nanthrax.moussaillon.persistence.ChantierEntity;
import org.jboss.logging.Logger;

import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Exécution de traitements dans les données d'un chantier donné, hors requête de ce chantier : tâches planifiées
 * (pour chaque chantier), migrations au démarrage, administration. Chaque traitement a sa propre transaction,
 * donc sa propre session Hibernate, ouverte sur le chantier demandé.
 */
@ApplicationScoped
public class Chantiers {

    private static final Logger LOG = Logger.getLogger(Chantiers.class);

    // Le registre est lu à chaque requête (ChantierFilter, abonnement gratuit, essai) : un chantier trouvé est gardé
    // en mémoire quelques secondes, et oublié dès que l'administration le modifie (voir oublier).
    static final long DUREE_CACHE_MS = 30_000;

    private static final Map<String, EnCache> REGISTRE = new ConcurrentHashMap<>();

    private record EnCache(ChantierEntity chantier, long expiration) {}

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

    /**
     * Chantier portant ce code, en lecture seule : gardé en mémoire, sinon lu dans une transaction à part (sans ouvrir
     * la session de la requête). Un code inconnu n'est pas gardé : un chantier créé est trouvé aussitôt.
     */
    public ChantierEntity trouver(String code) {
        return enCache(code);
    }

    /** Chantier de la requête ou de la tâche en cours (lecture seule), null s'il n'y en a pas. */
    public static ChantierEntity courant() {
        return enCache(ChantierContexte.courant());
    }

    private static ChantierEntity enCache(String code) {
        if (code == null || code.isBlank()) {
            return null;
        }
        long maintenant = System.currentTimeMillis();
        EnCache enCache = REGISTRE.get(code);
        if (enCache != null && enCache.expiration() > maintenant) {
            return enCache.chantier();
        }
        ChantierEntity chantier = QuarkusTransaction.requiringNew().call(() -> ChantierEntity.<ChantierEntity>findById(code));
        if (chantier != null) {
            REGISTRE.put(code, new EnCache(chantier, maintenant + DUREE_CACHE_MS));
        } else {
            REGISTRE.remove(code);
        }
        return chantier;
    }

    /** Le chantier a changé, de code ou a été supprimé : il est relu à sa prochaine utilisation. */
    public void oublier(String code) {
        if (code != null) {
            REGISTRE.remove(code);
        }
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
