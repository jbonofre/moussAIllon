package net.nanthrax.moussaillon.services;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.Mailer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import net.nanthrax.moussaillon.persistence.TechnicienEntity;

import java.util.List;

@Path("/techniciens")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class TechnicienResource {

    @Inject
    Mailer mailer;

    @GET
    public List<TechnicienEntity> list() {
        List<TechnicienEntity> techniciens = TechnicienEntity.listAll();
        techniciens.forEach(t -> t.motDePasse = null);
        return techniciens;
    }

    @GET
    @Path("/search")
    public List<TechnicienEntity> search(@QueryParam("q") String q) {
        if (q == null || q.trim().isEmpty()) {
            return list();
        }
        String likePattern = "%" + q.toLowerCase() + "%";
        List<TechnicienEntity> techniciens = TechnicienEntity.list("LOWER(nom) LIKE ?1 OR LOWER(prenom) LIKE ?1 OR LOWER(email) LIKE ?1 OR LOWER(telephone) LIKE ?1", likePattern);
        techniciens.forEach(t -> t.motDePasse = null);
        return techniciens;
    }

    @POST
    @Transactional
    public TechnicienEntity create(TechnicienEntity technicien) {
        if (technicien.motDePasse != null && !technicien.motDePasse.isBlank()) {
            technicien.motDePasse = PasswordUtil.hash(technicien.motDePasse);
        }
        technicien.persist();
        technicien.flush();
        TechnicienEntity.getEntityManager().detach(technicien);
        technicien.motDePasse = null;
        return technicien;
    }

    @GET
    @Path("{id}")
    public TechnicienEntity get(long id) {
        TechnicienEntity entity = TechnicienEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le technicien (" + id + ") n'est pas trouvé", 404);
        }
        entity.motDePasse = null;
        return entity;
    }

    @DELETE
    @Path("{id}")
    @Transactional
    public Response delete(long id) {
        TechnicienEntity entity = TechnicienEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le technicien (" + id + ") n'est pas trouvé", 404);
        }
        entity.delete();
        return Response.status(204).build();
    }

    @PUT
    @Path("{id}")
    @Transactional
    public TechnicienEntity update(long id, TechnicienEntity technicien) {
        TechnicienEntity entity = TechnicienEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le technicien (" + id + ") n'est pas trouvé", 404);
        }

        entity.nom = technicien.nom;
        entity.prenom = technicien.prenom;
        if (technicien.motDePasse != null && !technicien.motDePasse.isBlank()) {
            entity.motDePasse = PasswordUtil.hash(technicien.motDePasse);
        }
        entity.email = technicien.email;
        entity.telephone = technicien.telephone;
        entity.couleur = technicien.couleur;

        entity.flush();
        TechnicienEntity.getEntityManager().detach(entity);
        entity.motDePasse = null;
        return entity;
    }

    @POST
    @Path("{id}/send-password")
    @Transactional
    public Response sendPassword(@PathParam("id") long id, PasswordRequest request) {
        TechnicienEntity technicien = TechnicienEntity.findById(id);
        if (technicien == null) {
            throw new WebApplicationException("Le technicien (" + id + ") n'est pas trouvé", 404);
        }
        if (technicien.email == null || technicien.email.isBlank()) {
            throw new WebApplicationException("Le technicien n'a pas d'adresse email", 400);
        }
        if (request.password == null || request.password.isBlank()) {
            throw new WebApplicationException("Le mot de passe est requis", 400);
        }

        technicien.motDePasse = PasswordUtil.hash(request.password);

        SocieteEntity societe = SocieteEntity.findById(1L);
        String societeNom = societe != null ? societe.nom : "moussAIllon";

        String subject = "Votre mot de passe - Espace Technicien " + societeNom;
        String body = "Bonjour " + technicien.prenom + ",\n\n"
                + "Votre mot de passe pour accéder à l'Espace Technicien " + societeNom + " :\n\n"
                + "    " + request.password + "\n\n"
                + "Connectez-vous avec votre email : " + technicien.email + "\n\n"
                + "Cordialement,\n"
                + societeNom;

        mailer.send(Mail.withText(technicien.email, subject, body));

        return Response.ok().build();
    }

}
