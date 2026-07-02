package net.nanthrax.moussaillon.services;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.FournisseurRemorqueEntity;
import net.nanthrax.moussaillon.persistence.RemorqueCatalogueEntity;

import java.util.List;

import jakarta.transaction.Transactional;

@Path("/fournisseur-remorque")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class FournisseurRemorqueResource {

    @GET
    public List<FournisseurRemorqueEntity> listAll() {
        return FournisseurRemorqueEntity.listAll();
    }

    @GET
    @Path("{id}")
    public FournisseurRemorqueEntity getById(@PathParam("id") Long id) {
        FournisseurRemorqueEntity entity = FournisseurRemorqueEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("FournisseurRemorqueEntity with id " + id + " does not exist.", 404);
        }
        return entity;
    }

    @GET
    @Path("/fournisseur/{fournisseurId}")
    public List<FournisseurRemorqueEntity> getByFournisseurId(@PathParam("fournisseurId") Long fournisseurId) {
        return FournisseurRemorqueEntity.list("fournisseur.id", fournisseurId);
    }

    @GET
    @Path("/remorque/{remorqueId}")
    public List<FournisseurRemorqueEntity> getByRemorqueId(@PathParam("remorqueId") Long remorqueId) {
        return FournisseurRemorqueEntity.list("remorque.id", remorqueId);
    }

    @GET
    @Path("/remorque/{remorqueId}/fournisseurs")
    public List<net.nanthrax.moussaillon.persistence.FournisseurEntity> getFournisseursByRemorqueId(@PathParam("remorqueId") Long remorqueId) {
        List<FournisseurRemorqueEntity> fournisseurRemorques = FournisseurRemorqueEntity.list("remorque.id", remorqueId);
        java.util.List<net.nanthrax.moussaillon.persistence.FournisseurEntity> fournisseurs = new java.util.ArrayList<>();
        for (FournisseurRemorqueEntity fr : fournisseurRemorques) {
            if (fr.fournisseur != null) {
                fournisseurs.add(fr.fournisseur);
            }
        }
        return fournisseurs;
    }

    @GET
    @Path("/fournisseur/{fournisseurId}/remorques")
    public List<RemorqueCatalogueEntity> getRemorquesByFournisseurId(@PathParam("fournisseurId") Long fournisseurId) {
        List<FournisseurRemorqueEntity> fournisseurRemorques = FournisseurRemorqueEntity.list("fournisseur.id", fournisseurId);
        java.util.List<RemorqueCatalogueEntity> remorques = new java.util.ArrayList<>();
        for (FournisseurRemorqueEntity fr : fournisseurRemorques) {
            if (fr.remorque != null) {
                remorques.add(fr.remorque);
            }
        }
        return remorques;
    }

    @GET
    @Path("/search")
    public List<FournisseurRemorqueEntity> search(
            @QueryParam("fournisseurId") Long fournisseurId,
            @QueryParam("remorqueId") Long remorqueId,
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
        if (remorqueId != null) {
            if (!query.isEmpty()) query += " and ";
            query += "remorque.id = :remorqueId";
            params.put("remorqueId", remorqueId);
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
            return FournisseurRemorqueEntity.listAll();
        } else {
            return FournisseurRemorqueEntity.list(query, params);
        }
    }

    @POST
    @Transactional
    public Response create(FournisseurRemorqueEntity entity) {
        entity.id = null; // Ensure to not overwrite existing entity
        entity.persist();
        return Response.status(Response.Status.CREATED).entity(entity).build();
    }

    @PUT
    @Path("{id}")
    @Transactional
    public FournisseurRemorqueEntity update(@PathParam("id") Long id, FournisseurRemorqueEntity updated) {
        FournisseurRemorqueEntity entity = FournisseurRemorqueEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("FournisseurRemorqueEntity with id " + id + " does not exist.", 404);
        }
        // Copy updatable fields
        entity.fournisseur = updated.fournisseur;
        entity.remorque = updated.remorque;
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
        FournisseurRemorqueEntity entity = FournisseurRemorqueEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("FournisseurRemorqueEntity with id " + id + " does not exist.", 404);
        }
        entity.delete();
        return Response.noContent().build();
    }
}
