package net.nanthrax.moussaillon.services;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.FournisseurEntity;
import net.nanthrax.moussaillon.persistence.FournisseurMoteurEntity;
import net.nanthrax.moussaillon.persistence.MoteurCatalogueEntity;

import java.util.List;
import jakarta.transaction.Transactional;

@Path("/fournisseur-moteur")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class FournisseurMoteurResource {

    @GET
    public List<FournisseurMoteurEntity> listAll() {
        return FournisseurMoteurEntity.listAll();
    }

    @GET
    @Path("{id}")
    public FournisseurMoteurEntity getById(@PathParam("id") Long id) {
        FournisseurMoteurEntity entity = FournisseurMoteurEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("FournisseurMoteurEntity with id " + id + " does not exist.", 404);
        }
        return entity;
    }

    @GET
    @Path("/moteur/{moteurId}/fournisseurs")
    public List<FournisseurEntity> getFournisseursByMoteurId(@PathParam("moteurId") Long moteurId) {
        List<FournisseurMoteurEntity> fournisseurMoteurs = FournisseurMoteurEntity.list("moteur.id", moteurId);
        java.util.List<FournisseurEntity> fournisseurs = new java.util.ArrayList<>();
        for (FournisseurMoteurEntity fm : fournisseurMoteurs) {
            if (fm.fournisseur != null) {
                fournisseurs.add(fm.fournisseur);
            }
        }
        return fournisseurs;
    }

    @GET
    @Path("/fournisseur/{fournisseurId}/moteurs")
    public List<MoteurCatalogueEntity> getMoteursByFournisseurId(@PathParam("fournisseurId") Long fournisseurId) {
        List<FournisseurMoteurEntity> fournisseurMoteurs = FournisseurMoteurEntity.list("fournisseur.id", fournisseurId);
        java.util.List<MoteurCatalogueEntity> moteurs = new java.util.ArrayList<>();
        for (FournisseurMoteurEntity fm : fournisseurMoteurs) {
            if (fm.moteur != null) {
                moteurs.add(fm.moteur);
            }
        }
        return moteurs;
    }

    @GET
    @Path("/fournisseur/{fournisseurId}")
    public List<FournisseurMoteurEntity> getByFournisseurId(@PathParam("fournisseurId") Long fournisseurId) {
        return FournisseurMoteurEntity.list("fournisseur.id", fournisseurId);
    }

    @GET
    @Path("/moteur/{moteurId}")
    public List<FournisseurMoteurEntity> getByMoteurId(@PathParam("moteurId") Long moteurId) {
        return FournisseurMoteurEntity.list("moteur.id", moteurId);
    }

    @GET
    @Path("/search")
    public List<FournisseurMoteurEntity> search(
            @QueryParam("fournisseurId") Long fournisseurId,
            @QueryParam("moteurId") Long moteurId,
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
        if (moteurId != null) {
            if (!query.isEmpty()) query += " and ";
            query += "moteur.id = :moteurId";
            params.put("moteurId", moteurId);
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
            return FournisseurMoteurEntity.listAll();
        } else {
            return FournisseurMoteurEntity.list(query, params);
        }
    }

    @POST
    @Transactional
    public Response create(FournisseurMoteurEntity entity) {
        entity.id = null; // Ensure a new entity is created
        entity.persist();
        return Response.status(Response.Status.CREATED).entity(entity).build();
    }

    @PUT
    @Path("{id}")
    @Transactional
    public FournisseurMoteurEntity update(@PathParam("id") Long id, FournisseurMoteurEntity updated) {
        FournisseurMoteurEntity entity = FournisseurMoteurEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("FournisseurMoteurEntity with id " + id + " does not exist.", 404);
        }
        // Copy updatable fields
        entity.fournisseur = updated.fournisseur;
        entity.moteur = updated.moteur;
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
        FournisseurMoteurEntity entity = FournisseurMoteurEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("FournisseurMoteurEntity with id " + id + " does not exist.", 404);
        }
        entity.delete();
        return Response.noContent().build();
    }
}
