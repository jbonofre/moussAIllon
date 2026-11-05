package net.nanthrax.moussaillon.services;

import java.sql.Timestamp;
import java.util.List;

import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import net.nanthrax.moussaillon.persistence.CampagneEntity;
import net.nanthrax.moussaillon.persistence.CampagneHistoriqueEntity;

@ApplicationScoped
public class CampagneScheduler {

    @Inject
    CampagneResource campagneResource;

    @Inject
    Chantiers chantiers;

    @Scheduled(cron = "0 */5 * * * ?")
    void planifierCampagnes() {
        chantiers.pourChaqueChantier("Envoi des campagnes programmées", this::envoyerCampagnesProgrammees);
    }

    /** Envoie les campagnes programmées échues du chantier courant. */
    @Transactional
    public void envoyerCampagnesProgrammees() {
        List<CampagneEntity> campagnes = CampagneEntity.list(
                "statut = ?1 and dateProgrammee <= ?2",
                CampagneEntity.Statut.PROGRAMMEE,
                new Timestamp(System.currentTimeMillis()));

        for (CampagneEntity campagne : campagnes) {
            try {
                campagneResource.executerEnvoi(campagne);
            } catch (Exception e) {
                CampagneHistoriqueEntity historique = new CampagneHistoriqueEntity();
                historique.campagne = campagne;
                historique.dateEnvoi = new Timestamp(System.currentTimeMillis());
                historique.nombreDestinataires = 0;
                historique.statut = "ECHEC";
                historique.erreur = e.getMessage();
                historique.persist();
            }
        }
    }

}
