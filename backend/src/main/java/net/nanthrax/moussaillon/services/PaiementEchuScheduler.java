package net.nanthrax.moussaillon.services;

import java.util.List;

import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import net.nanthrax.moussaillon.persistence.VenteEntity;

@ApplicationScoped
public class PaiementEchuScheduler {

    /** Passe en « payée » les factures soldées dont les paiements à date future sont désormais échus. */
    @Scheduled(cron = "0 */5 * * * ?")
    @Transactional
    public void marquerFacturesPayees() {
        List<VenteEntity> ventes = VenteEntity.list("status", VenteEntity.Status.FACTURE_PRETE);
        for (VenteEntity vente : ventes) {
            if (!vente.paiements.isEmpty()) {
                VenteResource.marquerPayeeSiSoldee(vente);
            }
        }
    }

}
