package net.nanthrax.moussaillon.services;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.BateauCatalogueEntity;
import net.nanthrax.moussaillon.persistence.FournisseurBateauEntity;

import java.util.List;

import jakarta.transaction.Transactional;

@Path("/fournisseur-bateau")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class FournisseurBateauResource {

    @GET
    public List<FournisseurBateauEntity> listAll() {
        return FournisseurBateauEntity.listAll();
    }

    @GET
    @Path("{id}")
    public FournisseurBateauEntity getById(@PathParam("id") Long id) {
        FournisseurBateauEntity entity = FournisseurBateauEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("FournisseurBateauEntity with id " + id + " does not exist.", 404);
        }
        return entity;
    }

    @GET
    @Path("/fournisseur/{fournisseurId}")
    public List<FournisseurBateauEntity> getByFournisseurId(@PathParam("fournisseurId") Long fournisseurId) {
        return FournisseurBateauEntity.list("fournisseur.id", fournisseurId);
    }

    @GET
    @Path("/bateau/{bateauId}")
    public List<BateauCatalogueEntity> getByBateauId(@PathParam("bateauId") Long bateauId) {
        return BateauCatalogueEntity.list("id", bateauId);
    }

    @GET
    @Path("/search")
    public List<FournisseurBateauEntity> search(
            @QueryParam("fournisseurId") Long fournisseurId,
            @QueryParam("bateauId") Long bateauId,
            @QueryParam("minPrixAchatHT") Double minPrixAchatHT,
            @QueryParam("maxPrixAchatHT") Double maxPrixAchatHT,
            @QueryParam("notes") String notes
    ) {
        String query = "";
        java.util.Map<String, Object> params = new java.util.HashMap<>();

        if (fournisseurId != null) {
            query += "fournisseur.id = :fournisseurId";
            params.put("fournisseurId", fournisseurId);
        }
        if (bateauId != null) {
            if (!query.isEmpty()) query += " and ";
            query += "bateau.id = :bateauId";
            params.put("bateauId", bateauId);
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
        if (notes != null && !notes.isEmpty()) {
            if (!query.isEmpty()) query += " and ";
            query += "notes like :notes";
            params.put("notes", "%" + notes + "%");
        }
        if (query.isEmpty()) {
            return FournisseurBateauEntity.listAll();
        } else {
            return FournisseurBateauEntity.list(query, params);
        }
    }

    @POST
    @Transactional
    public Response create(FournisseurBateauEntity entity) {
        entity.id = null; // Ensure to not overwrite existing entity
        entity.persist();
        return Response.status(Response.Status.CREATED).entity(entity).build();
    }

    @PUT
    @Path("{id}")
    @Transactional
    public FournisseurBateauEntity update(@PathParam("id") Long id, FournisseurBateauEntity updated) {
        FournisseurBateauEntity entity = FournisseurBateauEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("FournisseurBateauEntity with id " + id + " does not exist.", 404);
        }
        // Copy updatable fields
        entity.fournisseur = updated.fournisseur;
        entity.bateau = updated.bateau;
        entity.prixAchatHT = updated.prixAchatHT;
        entity.tva = updated.tva;
        entity.montantTVA = updated.montantTVA;
        entity.prixAchatTTC = updated.prixAchatTTC;
        entity.portForfaitaire = updated.portForfaitaire;
        entity.portParUnite = updated.portParUnite;
        entity.nombreMinACommander = updated.nombreMinACommander;
        entity.tauxMarge = updated.tauxMarge;
        entity.tauxMarque = updated.tauxMarque;
        entity.notes = updated.notes;
        return entity;
    }

    @DELETE
    @Path("{id}")
    @Transactional
    public Response delete(@PathParam("id") Long id) {
        FournisseurBateauEntity entity = FournisseurBateauEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("FournisseurBateauEntity with id " + id + " does not exist.", 404);
        }
        entity.delete();
        return Response.noContent().build();
    }
}
