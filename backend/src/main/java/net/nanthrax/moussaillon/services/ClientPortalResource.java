package net.nanthrax.moussaillon.services;

import java.util.List;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.PUT;
import net.nanthrax.moussaillon.persistence.AnnonceEntity;
import net.nanthrax.moussaillon.persistence.AvoirEntity;
import net.nanthrax.moussaillon.persistence.BateauClientEntity;
import net.nanthrax.moussaillon.persistence.ClientEntity;
import net.nanthrax.moussaillon.persistence.MoteurClientEntity;
import net.nanthrax.moussaillon.persistence.RemorqueClientEntity;
import net.nanthrax.moussaillon.persistence.VenteEntity;

@Path("/portal")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ClientPortalResource {

    @Inject
    TokenService tokenService;

    public static class LoginRequest {
        public String email;
        public String password;
    }

    public static class AuthResponse {
        public String token;
        public long id;
        public String prenom;
        public String nom;
        public String type;
        public String email;
        public String telephone;
        public String adresse;
        public boolean consentement;
        public double evaluation;
        public double remise;
        public String siren;
        public String siret;
        public String tva;
        public String naf;
    }

    public static class ChangePasswordRequest {
        public String currentPassword;
        public String newPassword;
    }

    @POST
    @Path("/login")
    @Transactional
    public Response login(LoginRequest request) {
        if (request == null || request.email == null || request.email.isBlank()) {
            throw new WebApplicationException("L'email est requis", Response.Status.BAD_REQUEST);
        }
        List<ClientEntity> clients = ClientEntity.list("LOWER(email) = ?1", request.email.toLowerCase().trim());
        if (clients.isEmpty()) {
            throw new WebApplicationException("Aucun compte client trouve avec cet email", Response.Status.UNAUTHORIZED);
        }
        ClientEntity client = clients.get(0);
        if (request.password == null || request.password.isBlank()) {
            throw new WebApplicationException("Le mot de passe est requis", Response.Status.BAD_REQUEST);
        }
        if (!PasswordUtil.verify(request.password, client.motDePasse)) {
            throw new WebApplicationException("Mot de passe invalide", Response.Status.UNAUTHORIZED);
        }
        // Opportunistic rehash of legacy plaintext passwords
        if (PasswordUtil.needsRehash(client.motDePasse)) {
            client.motDePasse = PasswordUtil.hash(request.password);
        }

        AuthResponse auth = new AuthResponse();
        auth.token = tokenService.generateToken(String.valueOf(client.id), "client", client.email, client.id);
        auth.id = client.id;
        auth.prenom = client.prenom;
        auth.nom = client.nom;
        auth.type = client.type;
        auth.email = client.email;
        auth.telephone = client.telephone;
        auth.adresse = client.adresse;
        auth.consentement = client.consentement;
        auth.evaluation = client.evaluation;
        auth.remise = client.remise;
        auth.siren = client.siren;
        auth.siret = client.siret;
        auth.tva = client.tva;
        auth.naf = client.naf;
        return Response.ok(auth).build();
    }

    @POST
    @Path("/clients/{id}/change-password")
    @Transactional
    public Response changePassword(@PathParam("id") long id, ChangePasswordRequest request) {
        if (request == null || request.currentPassword == null || request.newPassword == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Mot de passe actuel et nouveau mot de passe requis.").build();
        }
        if (request.newPassword.trim().isEmpty()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Le nouveau mot de passe ne peut pas etre vide.").build();
        }
        ClientEntity client = ClientEntity.findById(id);
        if (client == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Client non trouve.").build();
        }
        if (!PasswordUtil.verify(request.currentPassword, client.motDePasse)) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Mot de passe actuel invalide.").build();
        }
        client.motDePasse = PasswordUtil.hash(request.newPassword);
        return Response.noContent().build();
    }

    public static class ConsentementRequest {
        public boolean consentement;
    }

    @jakarta.ws.rs.PUT
    @Path("/clients/{id}/consentement")
    @Transactional
    public Response updateConsentement(@PathParam("id") long id, ConsentementRequest request) {
        ClientEntity client = ClientEntity.findById(id);
        if (client == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Client non trouve.").build();
        }
        client.consentement = request.consentement;
        return Response.ok(client).build();
    }

    @GET
    @Path("/clients/{id}")
    public ClientEntity getClient(@PathParam("id") long id) {
        ClientEntity entity = ClientEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Client non trouve", Response.Status.NOT_FOUND);
        }
        entity.motDePasse = null;
        return entity;
    }

    @GET
    @Path("/clients/{id}/bateaux")
    public List<BateauClientEntity> getClientBateaux(@PathParam("id") long id) {
        return BateauClientEntity.list("SELECT b FROM BateauClientEntity b JOIN b.proprietaires p WHERE p.id = ?1", id);
    }

    @GET
    @Path("/clients/{id}/moteurs")
    public List<MoteurClientEntity> getClientMoteurs(@PathParam("id") long id) {
        return MoteurClientEntity.list("proprietaire.id = ?1", id);
    }

    @GET
    @Path("/clients/{id}/remorques")
    public List<RemorqueClientEntity> getClientRemorques(@PathParam("id") long id) {
        return RemorqueClientEntity.list("proprietaire.id = ?1", id);
    }

    @GET
    @Path("/clients/{id}/ventes")
    public List<VenteEntity> getClientVentes(@PathParam("id") long id) {
        return VenteEntity.list("client.id = ?1", id);
    }

    @PUT
    @Path("/ventes/{id}/bon-pour-accord")
    @Transactional
    public VenteEntity signerBonPourAccord(@PathParam("id") long id, java.util.Map<String, String> body) {
        VenteEntity entity = VenteEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("La vente n'est pas trouvée", 404);
        }
        if (entity.status != VenteEntity.Status.DEVIS) {
            throw new WebApplicationException(
                Response.status(Response.Status.BAD_REQUEST)
                    .entity(java.util.Map.of("error", "Le bon pour accord n'est possible qu'au statut Devis"))
                    .build());
        }
        entity.bonPourAccord = true;
        entity.dateBonPourAccord = new java.sql.Timestamp(System.currentTimeMillis());
        if (body != null && body.get("signature") != null) {
            entity.signatureBonPourAccord = body.get("signature");
        }
        // Force initialization of lazy collections before serialization
        if (entity.produits != null) entity.produits.size();
        return entity;
    }

    @GET
    @Path("/clients/{id}/avoirs")
    public List<AvoirEntity> getClientAvoirs(@PathParam("id") long id) {
        return AvoirEntity.list("client.id = ?1 AND status != ?2", id, AvoirEntity.Status.ANNULE);
    }

    @GET
    @Path("/clients/{id}/annonces")
    public List<AnnonceEntity> getClientAnnonces(@PathParam("id") long id) {
        return AnnonceEntity.list("client.id = ?1", id);
    }
}
