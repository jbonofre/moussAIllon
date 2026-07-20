package net.nanthrax.moussaillon.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.UserEntity;

import java.util.List;

@Path("/users")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class UserResource {

    @Inject
    TokenService tokenService;

    public static class LoginRequest {
        public String name;
        public String password;
    }

    public static class AuthResponse {
        public String token;
        public String name;
        public String roles;
        public String email;
        public UserEntity.Theme theme;
    }

    public static class ChangePasswordRequest {
        public String currentPassword;
        public String newPassword;
    }

    @POST
    @Path("/authenticate")
    @Transactional
    public Response authenticate(LoginRequest request) {
        if (SocieteResource.accesBloque()) {
            return Response.status(Response.Status.FORBIDDEN)
                .entity("Accès bloqué : l'abonnement a été résilié.").build();
        }
        if (request == null || request.name == null || request.password == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Nom d'utilisateur et mot de passe requis.").build();
        }
        UserEntity entity = UserEntity.findById(request.name);
        if (entity == null || !PasswordUtil.verify(request.password, entity.password)) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Identifiants invalides.").build();
        }
        // Opportunistic rehash of legacy plaintext passwords
        if (PasswordUtil.needsRehash(entity.password)) {
            entity.password = PasswordUtil.hash(request.password);
        }
        AuthResponse auth = new AuthResponse();
        auth.token = tokenService.generateToken(entity.name, entity.roles, entity.email, null);
        auth.name = entity.name;
        auth.roles = entity.roles;
        auth.email = entity.email;
        auth.theme = entity.theme;
        return Response.ok(auth).build();
    }

    @POST
    @Path("/{name}/change-password")
    @Transactional
    public Response changePassword(@PathParam("name") String name, ChangePasswordRequest request) {
        if (request == null || request.currentPassword == null || request.newPassword == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Mot de passe actuel et nouveau mot de passe requis.").build();
        }
        if (request.newPassword.trim().isEmpty()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Le nouveau mot de passe ne peut pas être vide.").build();
        }

        UserEntity entity = UserEntity.findById(name);
        if (entity == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("L'utilisateur " + name + " n'est pas trouvé").build();
        }
        if (!PasswordUtil.verify(request.currentPassword, entity.password)) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Mot de passe actuel invalide.").build();
        }

        entity.password = PasswordUtil.hash(request.newPassword);
        return Response.noContent().build();
    }

    @GET
    @Path("/search")
    public List<UserEntity> search(@QueryParam("q") String query) {
        if (query == null || query.trim().isEmpty()) {
            return sanitizeList(UserEntity.listAll());
        }
        String likeQuery = "%" + query.toLowerCase() + "%";
        return sanitizeList(UserEntity.list("lower(name) like ?1 or lower(email) like ?1", likeQuery));
    }

    @GET
    public List<UserEntity> list() {
        return sanitizeList(UserEntity.listAll());
    }

    @POST
    @Transactional
    public Response create(UserEntity user) {
        if (user.password != null && !user.password.isBlank()) {
            user.password = PasswordUtil.hash(user.password);
        }
        user.persist();
        user.flush();
        UserEntity.getEntityManager().detach(user);
        user.password = null;
        return Response.ok(user).status(201).build();
    }

    @GET
    @Path("{name}")
    public UserEntity get(String name) {
        UserEntity entity = UserEntity.findById(name);
        if (entity == null) {
            throw new WebApplicationException("L'utilisateur " + name + " n'est pas trouvé", 404);
        }
        entity.password = null;
        return entity;
    }

    @DELETE
    @Path("{name}")
    @Transactional
    public Response delete(String name) {
        UserEntity entity = UserEntity.findById(name);
        if (entity == null) {
            throw new WebApplicationException("L'utilisateur " + name + " n'est pas trouvé", 404);
        }
        entity.delete();
        return Response.status(204).build();
    }

    @PUT
    @Path("{name}")
    @Transactional
    public UserEntity update(String name, UserEntity user) {
        UserEntity entity = UserEntity.findById(name);
        if (entity == null) {
            throw new WebApplicationException("L'utilisateur " + name + " n'est pas trouvé", 404);
        }

        entity.name = user.name;
        entity.email = user.email;
        entity.roles = user.roles;
        if (user.password != null && !user.password.isBlank()) {
            entity.password = PasswordUtil.hash(user.password);
        }
        entity.theme = user.theme;

        entity.flush();
        UserEntity.getEntityManager().detach(entity);
        entity.password = null;
        return entity;
    }

    private List<UserEntity> sanitizeList(List<UserEntity> users) {
        users.forEach(u -> u.password = null);
        return users;
    }

}
