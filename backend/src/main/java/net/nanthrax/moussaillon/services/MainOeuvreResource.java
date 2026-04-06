package net.nanthrax.moussaillon.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.MainOeuvreEntity;

import java.util.List;

@Path("/main-oeuvres")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class MainOeuvreResource {

    @GET
    public List<MainOeuvreEntity> list() {
        return MainOeuvreEntity.listAll();
    }

    @GET
    @Path("/search")
    public List<MainOeuvreEntity> search(@QueryParam("q") String q) {
        if (q == null || q.trim().isEmpty()) {
            return MainOeuvreEntity.listAll();
        }
        String likePattern = "%" + q.toLowerCase() + "%";
        return MainOeuvreEntity.list("LOWER(nom) LIKE ?1 OR LOWER(description) LIKE ?1 OR LOWER(reference) LIKE ?1", likePattern);
    }

    @POST
    @Transactional
    public MainOeuvreEntity create(MainOeuvreEntity mainOeuvre) {
        mainOeuvre.persist();
        return mainOeuvre;
    }

    @GET
    @Path("{id}")
    public MainOeuvreEntity get(long id) {
        MainOeuvreEntity entity = MainOeuvreEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("La main d'oeuvre (" + id + ") n'est pas trouvée", 404);
        }
        return entity;
    }

    @DELETE
    @Path("{id}")
    @Transactional
    public Response delete(long id) {
        MainOeuvreEntity entity = MainOeuvreEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("La main d'oeuvre (" + id + ") n'est pas trouvée", 404);
        }
        entity.delete();
        return Response.status(204).build();
    }

    @PUT
    @Path("{id}")
    @Transactional
    public MainOeuvreEntity update(long id, MainOeuvreEntity mainOeuvre) {
        MainOeuvreEntity entity = MainOeuvreEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("La main d'oeuvre (" + id + ") n'est pas trouvée", 404);
        }

        entity.reference = mainOeuvre.reference;
        entity.nom = mainOeuvre.nom;
        entity.description = mainOeuvre.description;
        entity.prixHT = mainOeuvre.prixHT;
        entity.tva = mainOeuvre.tva;
        entity.montantTVA = mainOeuvre.montantTVA;
        entity.prixTTC = mainOeuvre.prixTTC;

        return entity;
    }
}
