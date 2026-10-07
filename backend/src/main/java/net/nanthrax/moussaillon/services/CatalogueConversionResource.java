package net.nanthrax.moussaillon.services;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.BateauCatalogueEntity;
import net.nanthrax.moussaillon.persistence.HeliceCatalogueEntity;
import net.nanthrax.moussaillon.persistence.MoteurCatalogueEntity;
import net.nanthrax.moussaillon.persistence.ProduitCatalogueEntity;
import net.nanthrax.moussaillon.persistence.RemorqueCatalogueEntity;

/**
 * Changement du type d'un article du catalogue (produit, bateau, moteur, hélice, remorque).
 *
 * Chaque type possède son propre référentiel : la conversion crée l'article dans le référentiel cible
 * (champs communs conservés, champs propres à l'ancien type perdus) puis supprime l'ancien. Elle est
 * refusée si l'article est référencé ailleurs (ventes, commandes fournisseur, forfaits, fournisseurs,
 * mouvements de stock...), pour ne jamais modifier l'historique de facturation.
 */
@Path("/catalogue/convertir")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class CatalogueConversionResource {

    private static final List<String> TYPES = List.of("produit", "bateau", "moteur", "helice", "remorque");

    public static class ConversionRequest {
        public String source;
        public Long id;
        public String cible;
        /** Catégorie (produit) ou type (bateau, moteur) : obligatoire pour ces trois types cibles. */
        public String categorie;
    }

    @Inject
    EntityManager em;

    @POST
    @Transactional
    public Response convertir(ConversionRequest request) {
        if (request == null || request.id == null || !TYPES.contains(request.source) || !TYPES.contains(request.cible)) {
            throw new WebApplicationException("Type source, type cible et identifiant requis", 400);
        }
        if (request.source.equals(request.cible)) {
            throw new WebApplicationException("Le type cible est identique au type actuel", 400);
        }
        if (List.of("produit", "bateau", "moteur").contains(request.cible)
                && (request.categorie == null || request.categorie.isBlank())) {
            throw new WebApplicationException("Une catégorie (ou un type) est requise pour convertir en " + request.cible, 400);
        }

        PanacheEntity source = charger(request.source, request.id);
        List<String> usages = usages(request.source, request.id);
        if (!usages.isEmpty()) {
            throw new WebApplicationException(
                Response.status(Response.Status.CONFLICT)
                    .entity(Map.of("message", "Cet article ne peut pas changer de type car il est utilisé dans : "
                        + String.join(", ", usages) + "."))
                    .build());
        }

        Commun commun = Commun.de(source);
        // Les liens de compatibilité moteur/hélice sont portés par des tables de jointure
        if (source instanceof HeliceCatalogueEntity helice) {
            for (MoteurCatalogueEntity moteur : new ArrayList<>(helice.moteursCompatibles)) {
                moteur.helicesCompatibles.remove(helice);
            }
        } else if (source instanceof MoteurCatalogueEntity moteur) {
            moteur.helicesCompatibles.clear();
        }
        source.delete();
        em.flush();

        PanacheEntity cible = creer(request.cible, commun, request.categorie);
        return Response.ok(Map.of("type", request.cible, "id", cible.id)).build();
    }

    private PanacheEntity charger(String type, long id) {
        PanacheEntity entity = switch (type) {
            case "produit" -> ProduitCatalogueEntity.findById(id);
            case "bateau" -> BateauCatalogueEntity.findById(id);
            case "moteur" -> MoteurCatalogueEntity.findById(id);
            case "helice" -> HeliceCatalogueEntity.findById(id);
            default -> RemorqueCatalogueEntity.findById(id);
        };
        if (entity == null) {
            throw new WebApplicationException("L'article (" + id + ") n'est pas trouvé", 404);
        }
        return entity;
    }

    /** Libellés des endroits où l'article est encore référencé. */
    private List<String> usages(String type, long id) {
        List<String> result = new ArrayList<>();
        switch (type) {
            case "produit" -> {
                compter(result, "ventes", "select count(l) from VenteProduitEntity l where l.produit.id = ?1", id);
                compter(result, "ventes (historique)", "select count(v) from VenteEntity v join v.produits p where p.id = ?1", id);
                compter(result, "transactions", "select count(t) from TransactionEntity t join t.articles a where a.id = ?1", id);
                compter(result, "commandes fournisseur", "select count(l) from CommandeFournisseurLigneEntity l where l.produit.id = ?1", id);
                compter(result, "forfaits", "select count(l) from ForfaitProduitEntity l where l.produit.id = ?1", id);
                compter(result, "services", "select count(l) from ServiceProduitEntity l where l.produit.id = ?1", id);
                compter(result, "fournisseurs", "select count(l) from FournisseurProduitEntity l where l.produit.id = ?1", id);
                compter(result, "mouvements de stock", "select count(m) from ProduitMouvementEntity m where m.produit.id = ?1", id);
            }
            case "bateau" -> {
                compter(result, "ventes", "select count(l) from VenteBateauCatalogueEntity l where l.bateau.id = ?1", id);
                compter(result, "ventes (historique)", "select count(v) from VenteEntity v join v.bateauxCatalogue p where p.id = ?1", id);
                compter(result, "commandes fournisseur", "select count(l) from CommandeFournisseurLigneEntity l where l.bateau.id = ?1", id);
                compter(result, "forfaits", "select count(f) from ForfaitEntity f join f.bateauxAssocies b where b.id = ?1", id);
                compter(result, "fournisseurs", "select count(l) from FournisseurBateauEntity l where l.bateau.id = ?1", id);
                compter(result, "bateaux clients", "select count(b) from BateauClientEntity b where b.modele.id = ?1", id);
            }
            case "moteur" -> {
                compter(result, "ventes", "select count(l) from VenteMoteurCatalogueEntity l where l.moteur.id = ?1", id);
                compter(result, "ventes (historique)", "select count(v) from VenteEntity v join v.moteursCatalogue p where p.id = ?1", id);
                compter(result, "commandes fournisseur", "select count(l) from CommandeFournisseurLigneEntity l where l.moteur.id = ?1", id);
                compter(result, "forfaits", "select count(f) from ForfaitEntity f join f.moteursAssocies m where m.id = ?1", id);
                compter(result, "fournisseurs", "select count(l) from FournisseurMoteurEntity l where l.moteur.id = ?1", id);
                compter(result, "moteurs clients", "select count(m) from MoteurClientEntity m where m.modele.id = ?1", id);
                compter(result, "bateaux clients", "select count(b) from BateauClientEntity b join b.moteurs m where m.id = ?1", id);
            }
            case "helice" -> {
                compter(result, "ventes", "select count(l) from VenteHeliceCatalogueEntity l where l.helice.id = ?1", id);
                compter(result, "ventes (historique)", "select count(v) from VenteEntity v join v.helicesCatalogue p where p.id = ?1", id);
                compter(result, "commandes fournisseur", "select count(l) from CommandeFournisseurLigneEntity l where l.helice.id = ?1", id);
                compter(result, "fournisseurs", "select count(l) from FournisseurHeliceEntity l where l.helice.id = ?1", id);
                compter(result, "bateaux clients", "select count(b) from BateauClientEntity b join b.helices h where h.id = ?1", id);
            }
            default -> {
                compter(result, "ventes", "select count(l) from VenteRemorqueCatalogueEntity l where l.remorque.id = ?1", id);
                compter(result, "ventes (historique)", "select count(v) from VenteEntity v join v.remorquesCatalogue p where p.id = ?1", id);
                compter(result, "commandes fournisseur", "select count(l) from CommandeFournisseurLigneEntity l where l.remorque.id = ?1", id);
                compter(result, "fournisseurs", "select count(l) from FournisseurRemorqueEntity l where l.remorque.id = ?1", id);
                compter(result, "remorques clients", "select count(r) from RemorqueClientEntity r where r.modele.id = ?1", id);
            }
        }
        return result;
    }

    private void compter(List<String> result, String libelle, String jpql, long id) {
        Long count = em.createQuery(jpql, Long.class).setParameter(1, id).getSingleResult();
        if (count != null && count > 0) {
            result.add(libelle + " (" + count + ")");
        }
    }

    private PanacheEntity creer(String type, Commun c, String categorie) {
        switch (type) {
            case "produit" -> {
                ProduitCatalogueEntity e = new ProduitCatalogueEntity();
                e.designation = c.designation;
                e.categorie = categorie;
                e.ref = c.ref;
                e.description = c.description;
                e.anneeDebut = c.anneeDebut;
                e.anneeFin = c.anneeFin;
                e.evaluation = c.evaluation;
                e.images = c.images;
                e.documents = c.documents;
                e.stock = (int) c.stock;
                e.stockMini = (int) c.stockAlerte;
                e.emplacement = c.emplacement;
                e.prixVenteHT = c.prixVenteHT;
                e.tva = c.tva;
                e.montantTVA = c.montantTVA;
                e.prixVenteTTC = c.prixVenteTTC;
                e.persist();
                referenceParDefaut(e.id, e.ref, "PRD", r -> e.ref = r);
                return e;
            }
            case "bateau" -> {
                BateauCatalogueEntity e = new BateauCatalogueEntity();
                e.type = categorie;
                e.designation = c.designation;
                e.ref = c.ref;
                e.description = c.description;
                e.anneeDebut = c.anneeDebut;
                e.anneeFin = c.anneeFin;
                e.evaluation = c.evaluation;
                e.images = c.images;
                e.documents = c.documents;
                e.stock = c.stock;
                e.stockAlerte = c.stockAlerte;
                e.emplacement = c.emplacement;
                e.prixVenteHT = c.prixVenteHT;
                e.tva = c.tva;
                e.montantTVA = c.montantTVA;
                e.prixVenteTTC = c.prixVenteTTC;
                e.persist();
                referenceParDefaut(e.id, e.ref, "BAT", r -> e.ref = r);
                return e;
            }
            case "moteur" -> {
                MoteurCatalogueEntity e = new MoteurCatalogueEntity();
                e.type = categorie;
                e.designation = c.designation;
                e.ref = c.ref;
                e.description = c.description;
                e.anneeDebut = c.anneeDebut;
                e.anneeFin = c.anneeFin;
                e.evaluation = c.evaluation;
                e.images = c.images;
                e.documents = c.documents;
                e.stock = c.stock;
                e.stockAlerte = c.stockAlerte;
                e.emplacement = c.emplacement;
                e.prixVenteHT = c.prixVenteHT;
                e.tva = c.tva;
                e.montantTVA = c.montantTVA;
                e.prixVenteTTC = c.prixVenteTTC;
                e.persist();
                referenceParDefaut(e.id, e.ref, "MOT", r -> e.ref = r);
                return e;
            }
            case "helice" -> {
                HeliceCatalogueEntity e = new HeliceCatalogueEntity();
                e.designation = c.designation;
                e.ref = c.ref;
                e.description = c.description;
                e.anneeDebut = c.anneeDebut;
                e.anneeFin = c.anneeFin;
                e.evaluation = c.evaluation;
                e.images = c.images;
                e.documents = c.documents;
                e.prixVenteHT = c.prixVenteHT;
                e.tva = c.tva;
                e.montantTVA = c.montantTVA;
                e.prixVenteTTC = c.prixVenteTTC;
                e.persist();
                referenceParDefaut(e.id, e.ref, "HEL", r -> e.ref = r);
                return e;
            }
            default -> {
                RemorqueCatalogueEntity e = new RemorqueCatalogueEntity();
                e.designation = c.designation;
                e.ref = c.ref;
                e.description = c.description;
                e.anneeDebut = c.anneeDebut;
                e.anneeFin = c.anneeFin;
                e.evaluation = (int) c.evaluation;
                e.images = c.images;
                e.documents = c.documents;
                e.stock = c.stock;
                e.stockAlerte = c.stockAlerte;
                e.emplacement = c.emplacement;
                e.prixVenteHT = c.prixVenteHT;
                e.tva = c.tva;
                e.montantTVA = c.montantTVA;
                e.prixVenteTTC = c.prixVenteTTC;
                e.persist();
                referenceParDefaut(e.id, e.ref, "REM", r -> e.ref = r);
                return e;
            }
        }
    }

    /** La référence reprise de l'ancien article est conservée ; à défaut, on en génère une pour le nouveau type. */
    private void referenceParDefaut(Long id, String ref, String prefixe, java.util.function.Consumer<String> setter) {
        if (ReferenceInterne.absente(ref)) {
            setter.accept(ReferenceInterne.generer(prefixe, id));
        }
    }

    /** Champs communs à tous les types d'article, repris lors d'une conversion. */
    private static class Commun {
        String designation;
        String ref;
        String description;
        Integer anneeDebut;
        Integer anneeFin;
        double evaluation;
        List<String> images = new ArrayList<>();
        List<String> documents = new ArrayList<>();
        long stock;
        long stockAlerte;
        String emplacement;
        double prixVenteHT;
        double tva;
        double montantTVA;
        double prixVenteTTC;

        static Commun de(PanacheEntity source) {
            Commun c = new Commun();
            if (source instanceof ProduitCatalogueEntity e) {
                c.designation = e.designation; c.ref = e.ref; c.description = e.description;
                c.anneeDebut = e.anneeDebut; c.anneeFin = e.anneeFin; c.evaluation = e.evaluation;
                c.images = copie(e.images); c.documents = copie(e.documents);
                c.stock = e.stock; c.stockAlerte = e.stockMini; c.emplacement = e.emplacement;
                c.prixVenteHT = e.prixVenteHT; c.tva = e.tva; c.montantTVA = e.montantTVA; c.prixVenteTTC = e.prixVenteTTC;
            } else if (source instanceof BateauCatalogueEntity e) {
                c.designation = e.designation; c.ref = e.ref; c.description = e.description;
                c.anneeDebut = e.anneeDebut; c.anneeFin = e.anneeFin; c.evaluation = e.evaluation;
                c.images = copie(e.images); c.documents = copie(e.documents);
                c.stock = e.stock; c.stockAlerte = e.stockAlerte; c.emplacement = e.emplacement;
                c.prixVenteHT = e.prixVenteHT; c.tva = e.tva; c.montantTVA = e.montantTVA; c.prixVenteTTC = e.prixVenteTTC;
            } else if (source instanceof MoteurCatalogueEntity e) {
                c.designation = e.designation; c.ref = e.ref; c.description = e.description;
                c.anneeDebut = e.anneeDebut; c.anneeFin = e.anneeFin; c.evaluation = e.evaluation;
                c.images = copie(e.images); c.documents = copie(e.documents);
                c.stock = e.stock; c.stockAlerte = e.stockAlerte; c.emplacement = e.emplacement;
                c.prixVenteHT = e.prixVenteHT; c.tva = e.tva; c.montantTVA = e.montantTVA; c.prixVenteTTC = e.prixVenteTTC;
            } else if (source instanceof HeliceCatalogueEntity e) {
                c.designation = e.designation; c.ref = e.ref; c.description = e.description;
                c.anneeDebut = e.anneeDebut; c.anneeFin = e.anneeFin; c.evaluation = e.evaluation;
                c.images = copie(e.images); c.documents = copie(e.documents);
                c.prixVenteHT = e.prixVenteHT; c.tva = e.tva; c.montantTVA = e.montantTVA; c.prixVenteTTC = e.prixVenteTTC;
            } else if (source instanceof RemorqueCatalogueEntity e) {
                c.designation = e.designation; c.ref = e.ref; c.description = e.description;
                c.anneeDebut = e.anneeDebut; c.anneeFin = e.anneeFin; c.evaluation = e.evaluation;
                c.images = copie(e.images); c.documents = copie(e.documents);
                c.stock = e.stock; c.stockAlerte = e.stockAlerte; c.emplacement = e.emplacement;
                c.prixVenteHT = e.prixVenteHT; c.tva = e.tva; c.montantTVA = e.montantTVA; c.prixVenteTTC = e.prixVenteTTC;
            }
            return c;
        }

        private static List<String> copie(List<String> list) {
            return list == null ? new ArrayList<>() : new ArrayList<>(list);
        }
    }
}
