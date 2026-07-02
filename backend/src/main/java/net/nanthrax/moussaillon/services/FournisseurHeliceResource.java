package net.nanthrax.moussaillon.services;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.FournisseurHeliceEntity;
import net.nanthrax.moussaillon.persistence.HeliceCatalogueEntity;

import java.util.List;

import jakarta.transaction.Transactional;

@Path("/fournisseur-helice")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class FournisseurHeliceResource {

    @GET
    public List<FournisseurHeliceEntity> listAll() {
        return FournisseurHeliceEntity.listAll();
    }

    @GET
    @Path("{id}")
    public FournisseurHeliceEntity getById(@PathParam("id") Long id) {
        FournisseurHeliceEntity entity = FournisseurHeliceEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("FournisseurHeliceEntity with id " + id + " does not exist.", 404);
        }
        return entity;
    }

    @GET
    @Path("/helice/{heliceId}/fournisseurs")
    public List<net.nanthrax.moussaillon.persistence.FournisseurEntity> getFournisseursByHeliceId(@PathParam("heliceId") Long heliceId) {
        List<FournisseurHeliceEntity> fournisseurHelices = FournisseurHeliceEntity.list("helice.id", heliceId);
        java.util.List<net.nanthrax.moussaillon.persistence.FournisseurEntity> fournisseurs = new java.util.ArrayList<>();
        for (FournisseurHeliceEntity fh : fournisseurHelices) {
            if (fh.fournisseur != null) {
                fournisseurs.add(fh.fournisseur);
            }
        }
        return fournisseurs;
    }
    @GET
    @Path("/fournisseur/{fournisseurId}/helices")
    public List<HeliceCatalogueEntity> getHelicesByFournisseurId(@PathParam("fournisseurId") Long fournisseurId) {
        List<FournisseurHeliceEntity> fournisseurHelices = FournisseurHeliceEntity.list("fournisseur.id", fournisseurId);
        java.util.List<HeliceCatalogueEntity> helices = new java.util.ArrayList<>();
        for (FournisseurHeliceEntity fh : fournisseurHelices) {
            if (fh.helice != null) {
                helices.add(fh.helice);
            }
        }
        return helices;
    }

    @GET
    @Path("/fournisseur/{fournisseurId}")
    public List<FournisseurHeliceEntity> getByFournisseurId(@PathParam("fournisseurId") Long fournisseurId) {
        return FournisseurHeliceEntity.list("fournisseur.id", fournisseurId);
    }

    @GET
    @Path("/helice/{heliceId}")
    public List<FournisseurHeliceEntity> getByHeliceId(@PathParam("heliceId") Long heliceId) {
        return FournisseurHeliceEntity.list("helice.id", heliceId);
    }

    @GET
    @Path("/search")
    public List<FournisseurHeliceEntity> search(
            @QueryParam("fournisseurId") Long fournisseurId,
            @QueryParam("heliceId") Long heliceId,
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
        if (heliceId != null) {
            if (!query.isEmpty()) query += " and ";
            query += "helice.id = :heliceId";
            params.put("heliceId", heliceId);
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
            return FournisseurHeliceEntity.listAll();
        } else {
            return FournisseurHeliceEntity.list(query, params);
        }
    }

    @POST
    @Transactional
    public Response create(FournisseurHeliceEntity entity) {
        entity.id = null; // Ensure to not overwrite existing entity
        entity.persist();
        return Response.status(Response.Status.CREATED).entity(entity).build();
    }

    @PUT
    @Path("{id}")
    @Transactional
    public FournisseurHeliceEntity update(@PathParam("id") Long id, FournisseurHeliceEntity updated) {
        FournisseurHeliceEntity entity = FournisseurHeliceEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("FournisseurHeliceEntity with id " + id + " does not exist.", 404);
        }
        // Copy updatable fields
        entity.fournisseur = updated.fournisseur;
        entity.helice = updated.helice;
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
        FournisseurHeliceEntity entity = FournisseurHeliceEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("FournisseurHeliceEntity with id " + id + " does not exist.", 404);
        }
        entity.delete();
        return Response.noContent().build();
    }
}
