package net.nanthrax.moussaillon.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.FournisseurProduitEntity;
import net.nanthrax.moussaillon.persistence.ProduitCatalogueEntity;
import net.nanthrax.moussaillon.persistence.ProduitMouvementEntity;

import java.sql.Timestamp;
import java.util.List;

@Path("/catalogue/produits")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ProduitCatalogueResource {

    @GET
    public List<ProduitCatalogueEntity> list() {
        return ProduitCatalogueEntity.listAll();
    }

    @GET
    @Path("/search")
    public List<ProduitCatalogueEntity> search(@QueryParam("q") String q) {
        if (q == null || q.trim().isEmpty()) {
            return ProduitCatalogueEntity.listAll();
        }
        String likePattern = "%" + q.toLowerCase() + "%";
        // Search in 'nom', 'marque', 'categorie', 'ref', 'description'
        return ProduitCatalogueEntity.list(
            "LOWER(nom) LIKE ?1 OR LOWER(marque) LIKE ?1 OR LOWER(categorie) LIKE ?1 OR LOWER(ref) LIKE ?1 OR LOWER(description) LIKE ?1",
            likePattern
        );
    }

    @GET
    @Path("/fournisseurs")
    public List<FournisseurProduitEntity> listProduitsFournisseurs() {
        return FournisseurProduitEntity.listAll();
    }

    @GET
    @Path("/{id}/fournisseurs")
    public List<FournisseurProduitEntity> listFournisseurs(long id) {
        return FournisseurProduitEntity.list("produit.id = ?1", id);
    }

    @POST
    @Transactional
    public ProduitCatalogueEntity create(ProduitCatalogueEntity produit) {
        produit.persist();
        return produit;
    }

    @GET
    @Path("{id}")
    public ProduitCatalogueEntity get(long id) {
        ProduitCatalogueEntity entity = ProduitCatalogueEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le produit (" + id + ") n'est pas trouvé", 404);
        }
        return entity;
    }

    @GET
    @Path("{id}/mouvements")
    public List<ProduitMouvementEntity> mouvements(@PathParam("id") long id) {
        ProduitCatalogueEntity entity = ProduitCatalogueEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le produit (" + id + ") n'est pas trouvé", 404);
        }
        return ProduitMouvementEntity.list("produit.id = ?1 ORDER BY date DESC", id);
    }

    public static class StatistiquesProduit {
        public int quantiteVendue30j;
        public int quantiteVendue90j;
        public int quantiteVendueTotal;
        public double chiffreAffaires30j;
        public double chiffreAffaires90j;
        public double chiffreAffairesTotal;
    }

    @GET
    @Path("{id}/statistiques")
    public StatistiquesProduit statistiques(@PathParam("id") long id) {
        ProduitCatalogueEntity entity = ProduitCatalogueEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le produit (" + id + ") n'est pas trouvé", 404);
        }

        List<ProduitMouvementEntity> ventes = ProduitMouvementEntity.list(
            "produit.id = ?1 AND type = ?2", id, ProduitMouvementEntity.Type.VENTE);

        long maintenant = System.currentTimeMillis();
        long jour = 24L * 60 * 60 * 1000;

        StatistiquesProduit stats = new StatistiquesProduit();
        for (ProduitMouvementEntity mouvement : ventes) {
            long age = mouvement.date != null ? maintenant - mouvement.date.getTime() : Long.MAX_VALUE;
            double montant = mouvement.quantite * entity.prixVenteTTC;

            stats.quantiteVendueTotal += mouvement.quantite;
            stats.chiffreAffairesTotal += montant;
            if (age <= 90 * jour) {
                stats.quantiteVendue90j += mouvement.quantite;
                stats.chiffreAffaires90j += montant;
            }
            if (age <= 30 * jour) {
                stats.quantiteVendue30j += mouvement.quantite;
                stats.chiffreAffaires30j += montant;
            }
        }
        return stats;
    }

    @DELETE
    @Path("{id}")
    @Transactional
    public Response delete(long id) {
        ProduitCatalogueEntity entity = ProduitCatalogueEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le produit (" + id + ") n'est pas trouvé", 404);
        }
        entity.delete();
        return Response.status(204).build();
    }

    @PUT
    @Path("{id}")
    @Transactional
    public ProduitCatalogueEntity update(long id, ProduitCatalogueEntity produit) {
        ProduitCatalogueEntity entity = ProduitCatalogueEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le produit (" + id + ") n'est pas trouvé", 404);
        }

        entity.nom = produit.nom;
        entity.marque = produit.marque;
        entity.categorie = produit.categorie;
        entity.ref = produit.ref;
        entity.refs = produit.refs;
        entity.images = produit.images;
        entity.documents = produit.documents;
        entity.description = produit.description;
        entity.anneeDebut = produit.anneeDebut;
        entity.anneeFin = produit.anneeFin;
        entity.evaluation = produit.evaluation;
        if (produit.stock != entity.stock) {
            ProduitMouvementEntity mouvement = new ProduitMouvementEntity();
            mouvement.produit = entity;
            mouvement.type = ProduitMouvementEntity.Type.AJUSTEMENT_MANUEL;
            mouvement.quantite = produit.stock - entity.stock;
            mouvement.stockApres = produit.stock;
            mouvement.date = new Timestamp(System.currentTimeMillis());
            mouvement.persist();
        }
        entity.stock = produit.stock;
        entity.stockMini = produit.stockMini;
        entity.emplacement = produit.emplacement;
        entity.prixVenteHT = produit.prixVenteHT;
        entity.tva = produit.tva;
        entity.montantTVA = produit.montantTVA;
        entity.prixVenteTTC = produit.prixVenteTTC;

        return entity;
    }

}
