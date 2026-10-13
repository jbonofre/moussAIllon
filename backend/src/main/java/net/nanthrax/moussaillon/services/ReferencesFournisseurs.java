package net.nanthrax.moussaillon.services;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BiConsumer;
import java.util.function.Function;

import net.nanthrax.moussaillon.persistence.BateauCatalogueEntity;
import net.nanthrax.moussaillon.persistence.FournisseurBateauEntity;
import net.nanthrax.moussaillon.persistence.FournisseurHeliceEntity;
import net.nanthrax.moussaillon.persistence.FournisseurMoteurEntity;
import net.nanthrax.moussaillon.persistence.FournisseurProduitEntity;
import net.nanthrax.moussaillon.persistence.FournisseurRemorqueEntity;
import net.nanthrax.moussaillon.persistence.HeliceCatalogueEntity;
import net.nanthrax.moussaillon.persistence.MoteurCatalogueEntity;
import net.nanthrax.moussaillon.persistence.ProduitCatalogueEntity;
import net.nanthrax.moussaillon.persistence.RemorqueCatalogueEntity;

/**
 * Renseigne, sur les résultats de recherche du catalogue, les références des fournisseurs
 * afin que les interfaces puissent les inclure dans leur filtrage.
 */
final class ReferencesFournisseurs {

    private ReferencesFournisseurs() {
    }

    static List<ProduitCatalogueEntity> produits(List<ProduitCatalogueEntity> items) {
        return remplir(items, FournisseurProduitEntity.<FournisseurProduitEntity>listAll(),
                fp -> fp.produit != null ? fp.produit.id : null, fp -> fp.reference,
                (e, refs) -> e.referencesFournisseurs = refs);
    }

    static List<BateauCatalogueEntity> bateaux(List<BateauCatalogueEntity> items) {
        return remplir(items, FournisseurBateauEntity.<FournisseurBateauEntity>listAll(),
                fp -> fp.bateau != null ? fp.bateau.id : null, fp -> fp.reference,
                (e, refs) -> e.referencesFournisseurs = refs);
    }

    static List<MoteurCatalogueEntity> moteurs(List<MoteurCatalogueEntity> items) {
        return remplir(items, FournisseurMoteurEntity.<FournisseurMoteurEntity>listAll(),
                fp -> fp.moteur != null ? fp.moteur.id : null, fp -> fp.reference,
                (e, refs) -> e.referencesFournisseurs = refs);
    }

    static List<HeliceCatalogueEntity> helices(List<HeliceCatalogueEntity> items) {
        return remplir(items, FournisseurHeliceEntity.<FournisseurHeliceEntity>listAll(),
                fp -> fp.helice != null ? fp.helice.id : null, fp -> fp.reference,
                (e, refs) -> e.referencesFournisseurs = refs);
    }

    static List<RemorqueCatalogueEntity> remorques(List<RemorqueCatalogueEntity> items) {
        return remplir(items, FournisseurRemorqueEntity.<FournisseurRemorqueEntity>listAll(),
                fp -> fp.remorque != null ? fp.remorque.id : null, fp -> fp.reference,
                (e, refs) -> e.referencesFournisseurs = refs);
    }

    private static <E, F> List<E> remplir(List<E> items, List<F> liens, Function<F, Long> itemId,
            Function<F, String> reference, BiConsumer<E, List<String>> setter) {
        Map<Long, List<String>> parItem = new HashMap<>();
        for (F lien : liens) {
            Long id = itemId.apply(lien);
            String ref = reference.apply(lien);
            if (id != null && ref != null && !ref.isBlank()) {
                parItem.computeIfAbsent(id, k -> new ArrayList<>()).add(ref);
            }
        }
        for (E item : items) {
            Long id = item instanceof io.quarkus.hibernate.orm.panache.PanacheEntity pe ? pe.id : null;
            setter.accept(item, parItem.get(id));
        }
        return items;
    }
}
