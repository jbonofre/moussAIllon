package net.nanthrax.moussaillon.services;

import io.quarkus.panache.common.Sort;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.ClientEntity;
import net.nanthrax.moussaillon.persistence.InteractionClientEntity;
import net.nanthrax.moussaillon.persistence.TimestampJsonbAdapter;
import net.nanthrax.moussaillon.persistence.UserEntity;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

/**
 * Suivi commercial des clients et des prospects : échanges (appels, emails, visites, rendez-vous, notes)
 * et actions commerciales à faire, confiées à un utilisateur du chantier.
 */
@Path("/interactions")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class InteractionClientResource {

    @Inject
    SecurityIdentity identity;

    public static class InteractionRequest {
        public Long clientId;
        public InteractionClientEntity.Type type;
        // Échange déjà eu par défaut
        public InteractionClientEntity.Statut statut;
        public String sujet;
        public String compteRendu;
        // Date de l'échange ou échéance de l'action ; maintenant par défaut
        @JsonbTypeAdapter(TimestampJsonbAdapter.class)
        public Timestamp date;
        // Utilisateur connecté par défaut
        public String utilisateur;
    }

    public static class TerminerRequest {
        public String compteRendu;
    }

    /**
     * Suivi commercial d'un client : ses actions à faire, de la plus proche échéance à la plus lointaine,
     * puis ses échanges, du plus récent au plus ancien.
     */
    @GET
    public List<InteractionClientEntity> list(@QueryParam("clientId") Long clientId) {
        if (clientId == null) {
            throw new WebApplicationException("Le client est requis", 400);
        }
        List<InteractionClientEntity> suivi = new ArrayList<>(InteractionClientEntity.list(
            "client.id = ?1 and statut = ?2 order by date, id", clientId, InteractionClientEntity.Statut.A_FAIRE));
        suivi.addAll(InteractionClientEntity.list(
            "client.id = ?1 and statut = ?2 order by coalesce(dateRealisation, date) desc, id desc",
            clientId, InteractionClientEntity.Statut.FAITE));
        return suivi;
    }

    /** Actions commerciales à faire, de la plus en retard à la plus lointaine ; celles d'un utilisateur s'il est précisé. */
    @GET
    @Path("a-faire")
    public List<InteractionClientEntity> aFaire(@QueryParam("utilisateur") String utilisateur) {
        if (utilisateur == null || utilisateur.isBlank()) {
            return InteractionClientEntity.list("statut = ?1 order by date, id", InteractionClientEntity.Statut.A_FAIRE);
        }
        return InteractionClientEntity.list("statut = ?1 and utilisateur = ?2 order by date, id",
            InteractionClientEntity.Statut.A_FAIRE, utilisateur);
    }

    /** Utilisateurs à qui confier une action : la liste complète des utilisateurs est réservée au Paramétrage. */
    @GET
    @Path("utilisateurs")
    public List<String> utilisateurs() {
        return UserEntity.<UserEntity>listAll(Sort.by("name")).stream().map(u -> u.name).toList();
    }

    @POST
    @Transactional
    public Response create(InteractionRequest request) {
        InteractionClientEntity interaction = new InteractionClientEntity();
        interaction.client = client(request);
        interaction.creePar = utilisateurConnecte();
        interaction.dateCreation = new Timestamp(System.currentTimeMillis());
        appliquer(interaction, request);
        if (interaction.utilisateur == null) {
            interaction.utilisateur = interaction.creePar;
        }
        interaction.persist();
        return Response.status(Response.Status.CREATED).entity(interaction).build();
    }

    @PUT
    @Path("{id}")
    @Transactional
    public InteractionClientEntity update(@PathParam("id") long id, InteractionRequest request) {
        InteractionClientEntity interaction = trouver(id);
        appliquer(interaction, request);
        return interaction;
    }

    /** L'action est faite : son compte rendu est enregistré et elle rejoint les échanges du client. */
    @POST
    @Path("{id}/terminer")
    @Transactional
    public InteractionClientEntity terminer(@PathParam("id") long id, TerminerRequest request) {
        InteractionClientEntity interaction = trouver(id);
        if (interaction.statut == InteractionClientEntity.Statut.FAITE) {
            throw new WebApplicationException("Cette action est déjà faite", 400);
        }
        interaction.statut = InteractionClientEntity.Statut.FAITE;
        interaction.dateRealisation = new Timestamp(System.currentTimeMillis());
        if (request != null && request.compteRendu != null && !request.compteRendu.isBlank()) {
            interaction.compteRendu = request.compteRendu.trim();
        }
        return interaction;
    }

    @DELETE
    @Path("{id}")
    @Transactional
    public Response delete(@PathParam("id") long id) {
        trouver(id).delete();
        return Response.noContent().build();
    }

    private static void appliquer(InteractionClientEntity interaction, InteractionRequest request) {
        if (request.type == null) {
            throw new WebApplicationException("Le type est requis", 400);
        }
        if (request.sujet == null || request.sujet.isBlank()) {
            throw new WebApplicationException("Le sujet est requis", 400);
        }
        InteractionClientEntity.Statut statut = request.statut != null ? request.statut : InteractionClientEntity.Statut.FAITE;
        if (statut == InteractionClientEntity.Statut.A_FAIRE) {
            interaction.dateRealisation = null;
        } else if (interaction.statut == InteractionClientEntity.Statut.A_FAIRE) {
            // Action marquée comme faite en la modifiant
            interaction.dateRealisation = new Timestamp(System.currentTimeMillis());
        }
        interaction.statut = statut;
        interaction.type = request.type;
        interaction.sujet = request.sujet.trim();
        interaction.compteRendu = request.compteRendu;
        interaction.date = request.date != null ? request.date : new Timestamp(System.currentTimeMillis());
        if (request.utilisateur != null) {
            interaction.utilisateur = request.utilisateur.isBlank() ? null : request.utilisateur;
        }
    }

    private static ClientEntity client(InteractionRequest request) {
        if (request.clientId == null) {
            throw new WebApplicationException("Le client est requis", 400);
        }
        ClientEntity client = ClientEntity.findById(request.clientId);
        if (client == null) {
            throw new WebApplicationException("Le client (" + request.clientId + ") n'est pas trouvé", 404);
        }
        return client;
    }

    private static InteractionClientEntity trouver(long id) {
        InteractionClientEntity interaction = InteractionClientEntity.findById(id);
        if (interaction == null) {
            throw new WebApplicationException("L'interaction (" + id + ") n'est pas trouvée", 404);
        }
        return interaction;
    }

    private String utilisateurConnecte() {
        return identity == null || identity.isAnonymous() ? null : identity.getPrincipal().getName();
    }

}
