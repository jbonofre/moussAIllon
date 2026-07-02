package net.nanthrax.moussaillon.services;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.FournisseurEntity;
import net.nanthrax.moussaillon.persistence.FournisseurProduitEntity;
import net.nanthrax.moussaillon.persistence.ProduitCatalogueEntity;
import jakarta.transaction.Transactional;

import java.util.List;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

@Path("/fournisseur-produit")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class FournisseurProduitResource {

    @GET
    public List<FournisseurProduitEntity> listAll() {
        return FournisseurProduitEntity.listAll();
    }

    @GET
    @Path("{id}")
    public FournisseurProduitEntity getById(@PathParam("id") Long id) {
        FournisseurProduitEntity entity = FournisseurProduitEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("FournisseurProduitEntity with id " + id + " does not exist.", 404);
        }
        return entity;
    }

    @GET
    @Path("/produit/{produitId}/fournisseurs")
    public List<FournisseurEntity> getFournisseursByProduitId(@PathParam("produitId") Long produitId) {
        List<FournisseurProduitEntity> list = FournisseurProduitEntity.list("produit.id", produitId);
        List<FournisseurEntity> fournisseurs = new ArrayList<>();
        for (FournisseurProduitEntity fp : list) {
            if (fp.fournisseur != null) {
                fournisseurs.add(fp.fournisseur);
            }
        }
        return fournisseurs;
    }

    @GET
    @Path("/fournisseur/{fournisseurId}/produits")
    public List<ProduitCatalogueEntity> getProduitsByFournisseurId(@PathParam("fournisseurId") Long fournisseurId) {
        List<FournisseurProduitEntity> list = FournisseurProduitEntity.list("fournisseur.id", fournisseurId);
        List<ProduitCatalogueEntity> produits = new ArrayList<>();
        for (FournisseurProduitEntity fp : list) {
            if (fp.produit != null) {
                produits.add(fp.produit);
            }
        }
        return produits;
    }

    @GET
    @Path("/fournisseur/{fournisseurId}")
    public List<FournisseurProduitEntity> getByFournisseurId(@PathParam("fournisseurId") Long fournisseurId) {
        return FournisseurProduitEntity.list("fournisseur.id", fournisseurId);
    }

    @GET
    @Path("/produit/{produitId}")
    public List<FournisseurProduitEntity> getByProduitId(@PathParam("produitId") Long produitId) {
        return FournisseurProduitEntity.list("produit.id", produitId);
    }

    @GET
    @Path("/search")
    public List<FournisseurProduitEntity> search(
            @QueryParam("fournisseurId") Long fournisseurId,
            @QueryParam("produitId") Long produitId,
            @QueryParam("reference") String reference,
            @QueryParam("minPrixAchatHT") Double minPrixAchatHT,
            @QueryParam("maxPrixAchatHT") Double maxPrixAchatHT
    ) {
        String query = "";
        Map<String,Object> params = new HashMap<>();

        if (fournisseurId != null) {
            query += "fournisseur.id = :fournisseurId";
            params.put("fournisseurId", fournisseurId);
        }
        if (produitId != null) {
            if (!query.isEmpty()) query += " and ";
            query += "produit.id = :produitId";
            params.put("produitId", produitId);
        }
        if (reference != null && !reference.isEmpty()) {
            if (!query.isEmpty()) query += " and ";
            query += "reference like :reference";
            params.put("reference", "%" + reference + "%");
        }
        if (minPrixAchatHT != null) {
            if (!query.isEmpty()) query += " and ";
            query += "prixAchatHT >= :minPrixAchatHT";
            params.put("minPrixAchatHT", minPrixAchatHT);
        }
        if (maxPrixAchatHT != null) {
            if (!query.isEmpty()) query += " and ";
            query += "prixAchatHT <= :maxPrixAchatHT";
            params.put("maxPrixAchatHT", maxPrixAchatHT);
        }

        if (query.isEmpty()) {
            return FournisseurProduitEntity.listAll();
        } else {
            return FournisseurProduitEntity.list(query, params);
        }
    }

    @POST
    @Transactional
    public Response create(FournisseurProduitEntity entity) {
        entity.id = null; // Ensure to not overwrite existing entity
        entity.persist();
        return Response.status(Response.Status.CREATED).entity(entity).build();
    }

    @PUT
    @Path("{id}")
    @Transactional
    public FournisseurProduitEntity update(@PathParam("id") Long id, FournisseurProduitEntity updated) {
        FournisseurProduitEntity entity = FournisseurProduitEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("FournisseurProduitEntity with id " + id + " does not exist.", 404);
        }
        // Copy updatable fields
        entity.fournisseur = updated.fournisseur;
        entity.produit = updated.produit;
        entity.reference = updated.reference;
        entity.prixAchatHT = updated.prixAchatHT;
        entity.tva = updated.tva;
        entity.montantTVA = updated.montantTVA;
        entity.prixAchatTTC = updated.prixAchatTTC;
        entity.portForfaitaire = updated.portForfaitaire;
        entity.portParUnite = updated.portParUnite;
        entity.nombreMinACommander = updated.nombreMinACommander;
        entity.tauxMarge = updated.tauxMarge;
        entity.tauxMarque = updated.tauxMarque;
        return entity;
    }

    @DELETE
    @Path("{id}")
    @Transactional
    public Response delete(@PathParam("id") Long id) {
        FournisseurProduitEntity entity = FournisseurProduitEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("FournisseurProduitEntity with id " + id + " does not exist.", 404);
        }
        entity.delete();
        return Response.noContent().build();
    }
}
