package net.nanthrax.moussaillon.services;

import java.sql.Timestamp;
import java.util.List;

import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.AnnonceEntity;
import net.nanthrax.moussaillon.persistence.ClientEntity;

@Path("/annonces")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AnnonceResource {

    @GET
    public List<AnnonceEntity> getAll() {
        return AnnonceEntity.listAll();
    }

    @GET
    @Path("/active")
    public List<AnnonceEntity> getActive() {
        return AnnonceEntity.list("status", AnnonceEntity.Status.ACTIVE);
    }

    @GET
    @Path("/{id}")
    public AnnonceEntity get(@PathParam("id") long id) {
        AnnonceEntity entity = AnnonceEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Annonce non trouvee", Response.Status.NOT_FOUND);
        }
        return entity;
    }

    @GET
    @Path("/client/{clientId}")
    public List<AnnonceEntity> getByClient(@PathParam("clientId") long clientId) {
        return AnnonceEntity.list("client.id", clientId);
    }

    @POST
    @Transactional
    public AnnonceEntity create(AnnonceEntity annonce) {
        annonce.dateCreation = new Timestamp(System.currentTimeMillis());
        annonce.dateModification = annonce.dateCreation;
        if (annonce.status == null) {
            annonce.status = AnnonceEntity.Status.ACTIVE;
        }
        annonce.persist();
        return annonce;
    }

    @PUT
    @Path("/{id}")
    @Transactional
    public AnnonceEntity update(@PathParam("id") long id, AnnonceEntity annonce) {
        AnnonceEntity entity = AnnonceEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Annonce non trouvee", Response.Status.NOT_FOUND);
        }
        entity.titre = annonce.titre;
        entity.description = annonce.description;
        entity.prix = annonce.prix;
        entity.contact = annonce.contact;
        entity.telephone = annonce.telephone;
        entity.photos = annonce.photos;
        entity.status = annonce.status;
        entity.bateau = annonce.bateau;
        if (annonce.client != null && annonce.client.id != null) {
            ClientEntity client = ClientEntity.findById(annonce.client.id);
            if (client == null) {
                throw new WebApplicationException("Le client (" + annonce.client.id + ") n'est pas trouvé", 404);
            }
            entity.client = client;
        } else {
            entity.client = null;
        }
        entity.dateModification = new Timestamp(System.currentTimeMillis());
        // Les publications ne sont gérées que par /publier et /depublier : le formulaire
        // de l'annonce ne les renvoie pas, et les écraser ici effaçait la diffusion.
        return entity;
    }

    public static class PublishRequest {
        public String plateforme;
    }

    @POST
    @Path("/{id}/publier")
    public AnnonceEntity publier(@PathParam("id") long id, PublishRequest request) {
        QuarkusTransaction.requiringNew().run(() -> {
            AnnonceEntity entity = trouverPourDiffusion(id, request);
            String plateforme = request.plateforme.trim().toUpperCase();
            if (!entity.publications.contains(plateforme)) {
                entity.publications.add(plateforme);
            }
        });
        // Relue hors transaction : la sérialisation du bateau lié charge ses collections à la demande
        return get(id);
    }

    @POST
    @Path("/{id}/depublier")
    public AnnonceEntity depublier(@PathParam("id") long id, PublishRequest request) {
        QuarkusTransaction.requiringNew().run(() -> {
            AnnonceEntity entity = trouverPourDiffusion(id, request);
            entity.publications.remove(request.plateforme.trim().toUpperCase());
        });
        return get(id);
    }

    private static AnnonceEntity trouverPourDiffusion(long id, PublishRequest request) {
        AnnonceEntity entity = AnnonceEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Annonce non trouvee", Response.Status.NOT_FOUND);
        }
        if (request == null || request.plateforme == null || request.plateforme.isBlank()) {
            throw new WebApplicationException("La plateforme est requise", Response.Status.BAD_REQUEST);
        }
        return entity;
    }

    @DELETE
    @Path("/{id}")
    @Transactional
    public void delete(@PathParam("id") long id) {
        AnnonceEntity entity = AnnonceEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Annonce non trouvee", Response.Status.NOT_FOUND);
        }
        entity.delete();
    }

}
