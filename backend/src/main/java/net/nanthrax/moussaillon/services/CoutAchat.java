package net.nanthrax.moussaillon.services;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;

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
 * Coût d'achat unitaire HT des articles du catalogue, pour la valeur du stock et la marge brute : le prix d'achat
 * moyen pondéré (PMP) de l'article, recalculé à chaque réception de commande fournisseur, ou à défaut la moyenne
 * de ses prix d'achat chez ses fournisseurs (0 quand aucun n'est renseigné).
 */
final class CoutAchat {

    // Prix d'achat moyen chez les fournisseurs, par identifiant d'article
    private final Map<Long, Double> produits = new HashMap<>();
    private final Map<Long, Double> bateaux = new HashMap<>();
    private final Map<Long, Double> moteurs = new HashMap<>();
    private final Map<Long, Double> helices = new HashMap<>();
    private final Map<Long, Double> remorques = new HashMap<>();
    // Vrai quand les prix de tous les articles sont chargés : un article absent n'a pas de prix fournisseur
    private boolean complet;

    /** Prix fournisseurs chargés à la demande, article par article. */
    CoutAchat() {
    }

    /** Prix fournisseurs de tous les articles, chargés en une requête par type : pour un calcul portant sur de nombreux articles. */
    static CoutAchat charge() {
        CoutAchat couts = new CoutAchat();
        couts.produits.putAll(moyennes(FournisseurProduitEntity.<FournisseurProduitEntity>listAll(),
                f -> f.produit != null ? f.produit.id : null, f -> f.prixAchatHT));
        couts.bateaux.putAll(moyennes(FournisseurBateauEntity.<FournisseurBateauEntity>listAll(),
                f -> f.bateau != null ? f.bateau.id : null, f -> f.prixAchatHT));
        couts.moteurs.putAll(moyennes(FournisseurMoteurEntity.<FournisseurMoteurEntity>listAll(),
                f -> f.moteur != null ? f.moteur.id : null, f -> f.prixAchatHT));
        couts.helices.putAll(moyennes(FournisseurHeliceEntity.<FournisseurHeliceEntity>listAll(),
                f -> f.helice != null ? f.helice.id : null, f -> f.prixAchatHT));
        couts.remorques.putAll(moyennes(FournisseurRemorqueEntity.<FournisseurRemorqueEntity>listAll(),
                f -> f.remorque != null ? f.remorque.id : null, f -> f.prixAchatHT));
        couts.complet = true;
        return couts;
    }

    double produit(ProduitCatalogueEntity p) {
        if (p == null) return 0;
        return p.prixAchatMoyenHT > 0 ? p.prixAchatMoyenHT
                : prixFournisseurs(produits, p.id, () -> FournisseurProduitEntity.<FournisseurProduitEntity>list("produit.id", p.id)
                        .stream().map(f -> f.prixAchatHT).toList());
    }

    double bateau(BateauCatalogueEntity b) {
        if (b == null) return 0;
        return b.prixAchatMoyenHT > 0 ? b.prixAchatMoyenHT
                : prixFournisseurs(bateaux, b.id, () -> FournisseurBateauEntity.<FournisseurBateauEntity>list("bateau.id", b.id)
                        .stream().map(f -> f.prixAchatHT).toList());
    }

    double moteur(MoteurCatalogueEntity m) {
        if (m == null) return 0;
        return m.prixAchatMoyenHT > 0 ? m.prixAchatMoyenHT
                : prixFournisseurs(moteurs, m.id, () -> FournisseurMoteurEntity.<FournisseurMoteurEntity>list("moteur.id", m.id)
                        .stream().map(f -> f.prixAchatHT).toList());
    }

    // Les hélices ne sont pas suivies en stock : leur coût est celui de leurs fournisseurs
    double helice(HeliceCatalogueEntity h) {
        if (h == null) return 0;
        return prixFournisseurs(helices, h.id, () -> FournisseurHeliceEntity.<FournisseurHeliceEntity>list("helice.id", h.id)
                .stream().map(f -> f.prixAchatHT).toList());
    }

    double remorque(RemorqueCatalogueEntity r) {
        if (r == null) return 0;
        return r.prixAchatMoyenHT > 0 ? r.prixAchatMoyenHT
                : prixFournisseurs(remorques, r.id, () -> FournisseurRemorqueEntity.<FournisseurRemorqueEntity>list("remorque.id", r.id)
                        .stream().map(f -> f.prixAchatHT).toList());
    }

    /**
     * Prix d'achat moyen pondéré après l'entrée de quantite articles au coût unitaire coutEntree, le stock existant
     * étant valorisé à coutStock. Sans stock existant, ou si son coût n'est pas connu, c'est le coût de l'entrée.
     */
    static double pmp(double stockAvant, double coutStock, double quantite, double coutEntree) {
        if (stockAvant <= 0 || coutStock <= 0 || quantite <= 0) {
            return coutEntree;
        }
        double pmp = (stockAvant * coutStock + quantite * coutEntree) / (stockAvant + quantite);
        return Math.round(pmp * 10000.0) / 10000.0;
    }

    private double prixFournisseurs(Map<Long, Double> cache, Long id, Supplier<List<Double>> prix) {
        if (id == null) return 0;
        Double cout = cache.get(id);
        if (cout == null) {
            cout = complet ? 0.0 : moyenne(prix.get());
            cache.put(id, cout);
        }
        return cout;
    }

    // Moyenne des prix renseignés (un prix nul n'est pas un prix d'achat)
    private static double moyenne(List<Double> prix) {
        return prix.stream().mapToDouble(Double::doubleValue).filter(p -> p > 0).average().orElse(0);
    }

    private static <F> Map<Long, Double> moyennes(List<F> fournisseurs, Function<F, Long> article, Function<F, Double> prix) {
        return fournisseurs.stream()
                .filter(f -> article.apply(f) != null)
                .collect(Collectors.groupingBy(article, Collectors.collectingAndThen(
                        Collectors.mapping(prix, Collectors.toList()), CoutAchat::moyenne)));
    }
}
