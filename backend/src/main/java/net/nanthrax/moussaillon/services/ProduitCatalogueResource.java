package net.nanthrax.moussaillon.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.FournisseurProduitEntity;
import net.nanthrax.moussaillon.persistence.ProduitCatalogueEntity;

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
        entity.stock = produit.stock;
        entity.stockMini = produit.stockMini;
        entity.emplacement = produit.emplacement;
        entity.prixPublic = produit.prixPublic;
        entity.frais = produit.frais;
        entity.tauxMarge = produit.tauxMarge;
        entity.tauxMarque = produit.tauxMarque;
        entity.prixVenteHT = produit.prixVenteHT;
        entity.tva = produit.tva;
        entity.montantTVA = produit.montantTVA;
        entity.prixVenteTTC = produit.prixVenteTTC;

        return entity;
    }

}
