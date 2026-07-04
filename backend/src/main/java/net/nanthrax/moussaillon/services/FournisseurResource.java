package net.nanthrax.moussaillon.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.FournisseurEntity;

import java.util.List;

@Path("/catalogue/fournisseurs")
@ApplicationScoped
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class FournisseurResource {

    @GET
    public List<FournisseurEntity> list() {
        return FournisseurEntity.listAll();
    }

    @GET
    @Path("{id}")
    public FournisseurEntity get(long id) {
        FournisseurEntity entity = FournisseurEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le fournisseur (" + id + ") n'est pas trouvé", 404);
        }

        return entity;
    }

    @GET
    @Path("/search")
    public List<FournisseurEntity> search(@QueryParam("q") String query) {
        if (query == null || query.trim().isEmpty()) {
            return FournisseurEntity.listAll();
        }
        String likeQuery = "%" + query.toLowerCase() + "%";
        return FournisseurEntity.list("lower(nom) like ?1 or lower(email) like ?1 or lower(telephone) like ?1", likeQuery);
    }

    @POST
    @Transactional
    public FournisseurEntity create(FournisseurEntity fournisseur) {
        fournisseur.persist();
        return fournisseur;
    }

    @DELETE
    @Path("{id}")
    @Transactional
    public Response delete(long id) {
        FournisseurEntity entity = FournisseurEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le fournisseur (" + id + ") n'est pas trouvé", 404);
        }

        entity.delete();
        return Response.status(204).build();
    }

    @PUT
    @Path("{id}")
    @Transactional
    public FournisseurEntity update(long id, FournisseurEntity fournisseur) {
        FournisseurEntity entity = FournisseurEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le fournisseur (" + id + ") n'est pas trouvé", 404);
        }

        entity.nom = fournisseur.nom;
        entity.image = fournisseur.image;
        entity.email = fournisseur.email;
        entity.telephone = fournisseur.telephone;
        entity.adresse = fournisseur.adresse;
        entity.evaluation = fournisseur.evaluation;
        entity.siren = fournisseur.siren;
        entity.siret = fournisseur.siret;
        entity.tva = fournisseur.tva;
        entity.naf = fournisseur.naf;
        entity.connexion = fournisseur.connexion;
        entity.documents = fournisseur.documents;
        entity.portForfaitaireDefaut = fournisseur.portForfaitaireDefaut;
        entity.portParUniteDefaut = fournisseur.portParUniteDefaut;
        entity.nombreMinACommanderDefaut = fournisseur.nombreMinACommanderDefaut;
        entity.tauxMargeDefaut = fournisseur.tauxMargeDefaut;
        entity.tauxMarqueDefaut = fournisseur.tauxMarqueDefaut;

        return entity;
    }

}
