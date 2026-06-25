package net.nanthrax.moussaillon.services;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.transaction.Transactional;
import net.nanthrax.moussaillon.persistence.BateauCatalogueEntity;
import net.nanthrax.moussaillon.persistence.HeliceCatalogueEntity;
import net.nanthrax.moussaillon.persistence.MoteurCatalogueEntity;
import net.nanthrax.moussaillon.persistence.ProduitCatalogueEntity;
import net.nanthrax.moussaillon.persistence.RemorqueCatalogueEntity;
import net.nanthrax.moussaillon.persistence.VenteBateauCatalogueEntity;
import net.nanthrax.moussaillon.persistence.VenteEntity;
import net.nanthrax.moussaillon.persistence.VenteHeliceCatalogueEntity;
import net.nanthrax.moussaillon.persistence.VenteMoteurCatalogueEntity;
import net.nanthrax.moussaillon.persistence.VenteProduitEntity;
import net.nanthrax.moussaillon.persistence.VenteRemorqueCatalogueEntity;

/**
 * Migrates the historical @ManyToMany lists on VenteEntity (produits, bateauxCatalogue,
 * moteursCatalogue, helicesCatalogue, remorquesCatalogue) — where quantity was encoded by
 * duplicating entries — into the new dedicated line entities that carry quantite + remise.
 *
 * Runs once on startup, idempotent: only migrates ventes that still have legacy entries and
 * empty new lists.
 */
@ApplicationScoped
public class VenteLignesMigrator {

    @Transactional
    void onStart(@Observes StartupEvent event) {
        List<VenteEntity> ventes = VenteEntity.listAll();
        for (VenteEntity vente : ventes) {
            migrateVente(vente);
        }
    }

    private void migrateVente(VenteEntity vente) {
        if (vente.produits != null && !vente.produits.isEmpty() && vente.venteProduits.isEmpty()) {
            Map<Long, Integer> counts = countById(vente.produits, p -> p.id);
            for (Map.Entry<Long, Integer> entry : counts.entrySet()) {
                ProduitCatalogueEntity ref = ProduitCatalogueEntity.findById(entry.getKey());
                if (ref == null) continue;
                VenteProduitEntity line = new VenteProduitEntity();
                line.produit = ref;
                line.quantite = entry.getValue();
                vente.venteProduits.add(line);
            }
            vente.produits.clear();
        }

        if (vente.bateauxCatalogue != null && !vente.bateauxCatalogue.isEmpty() && vente.venteBateauxCatalogue.isEmpty()) {
            Map<Long, Integer> counts = countById(vente.bateauxCatalogue, b -> b.id);
            for (Map.Entry<Long, Integer> entry : counts.entrySet()) {
                BateauCatalogueEntity ref = BateauCatalogueEntity.findById(entry.getKey());
                if (ref == null) continue;
                VenteBateauCatalogueEntity line = new VenteBateauCatalogueEntity();
                line.bateau = ref;
                line.quantite = entry.getValue();
                vente.venteBateauxCatalogue.add(line);
            }
            vente.bateauxCatalogue.clear();
        }

        if (vente.moteursCatalogue != null && !vente.moteursCatalogue.isEmpty() && vente.venteMoteursCatalogue.isEmpty()) {
            Map<Long, Integer> counts = countById(vente.moteursCatalogue, m -> m.id);
            for (Map.Entry<Long, Integer> entry : counts.entrySet()) {
                MoteurCatalogueEntity ref = MoteurCatalogueEntity.findById(entry.getKey());
                if (ref == null) continue;
                VenteMoteurCatalogueEntity line = new VenteMoteurCatalogueEntity();
                line.moteur = ref;
                line.quantite = entry.getValue();
                vente.venteMoteursCatalogue.add(line);
            }
            vente.moteursCatalogue.clear();
        }

        if (vente.helicesCatalogue != null && !vente.helicesCatalogue.isEmpty() && vente.venteHelicesCatalogue.isEmpty()) {
            Map<Long, Integer> counts = countById(vente.helicesCatalogue, h -> h.id);
            for (Map.Entry<Long, Integer> entry : counts.entrySet()) {
                HeliceCatalogueEntity ref = HeliceCatalogueEntity.findById(entry.getKey());
                if (ref == null) continue;
                VenteHeliceCatalogueEntity line = new VenteHeliceCatalogueEntity();
                line.helice = ref;
                line.quantite = entry.getValue();
                vente.venteHelicesCatalogue.add(line);
            }
            vente.helicesCatalogue.clear();
        }

        if (vente.remorquesCatalogue != null && !vente.remorquesCatalogue.isEmpty() && vente.venteRemorquesCatalogue.isEmpty()) {
            Map<Long, Integer> counts = countById(vente.remorquesCatalogue, r -> r.id);
            for (Map.Entry<Long, Integer> entry : counts.entrySet()) {
                RemorqueCatalogueEntity ref = RemorqueCatalogueEntity.findById(entry.getKey());
                if (ref == null) continue;
                VenteRemorqueCatalogueEntity line = new VenteRemorqueCatalogueEntity();
                line.remorque = ref;
                line.quantite = entry.getValue();
                vente.venteRemorquesCatalogue.add(line);
            }
            vente.remorquesCatalogue.clear();
        }
    }

    private <T> Map<Long, Integer> countById(List<T> items, java.util.function.Function<T, Long> idGetter) {
        Map<Long, Integer> counts = new LinkedHashMap<>();
        for (T item : items) {
            Long id = idGetter.apply(item);
            if (id == null) continue;
            counts.merge(id, 1, Integer::sum);
        }
        return counts;
    }
}
