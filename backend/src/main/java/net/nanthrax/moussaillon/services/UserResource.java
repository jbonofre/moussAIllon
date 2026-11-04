package net.nanthrax.moussaillon.services;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.ModuleApplication;
import net.nanthrax.moussaillon.persistence.UserEntity;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Path("/users")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class UserResource {

    // Utilisateur créé à l'installation : il garde toujours l'accès au module Paramétrage.
    static final String ADMIN = "admin";

    @Inject
    TokenService tokenService;

    @Inject
    SecurityIdentity identity;

    public static class LoginRequest {
        public String name;
        public String password;
    }

    public static class AuthResponse {
        public String token;
        public String name;
        public Set<ModuleApplication> modules;
        public String email;
        public UserEntity.Theme theme;
        // Échéance impayée depuis 2 mois ou plus : l'accès est limité à la facturation.
        public boolean abonnementImpaye;
    }

    public static class ChangePasswordRequest {
        public String currentPassword;
        public String newPassword;
    }

    @POST
    @Path("/authenticate")
    @Transactional
    public Response authenticate(LoginRequest request) {
        if (SocieteResource.accesBloqueParResiliation()) {
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
        // Abonnement impayé : seuls les utilisateurs du module Paramétrage se connectent, pour régler la facturation.
        boolean impaye = SocieteResource.accesBloqueParImpaye();
        if (impaye && !entity.modules.contains(ModuleApplication.PARAMETRAGE)) {
            return Response.status(Response.Status.FORBIDDEN)
                .entity("Accès bloqué : l'abonnement est impayé depuis 2 mois ou plus. Contactez un administrateur.").build();
        }
        AuthResponse auth = new AuthResponse();
        Set<String> groupes = entity.modules.stream().map(Enum::name).collect(Collectors.toCollection(HashSet::new));
        groupes.add(AccesApiFilter.GROUPE_CHANTIER);
        auth.token = tokenService.generateToken(entity.name, groupes, entity.email, null);
        auth.name = entity.name;
        auth.modules = entity.modules;
        auth.email = entity.email;
        auth.theme = entity.theme;
        auth.abonnementImpaye = impaye;
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
        validerModules(user.name, user);
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
        verifierAccesParametrageConserve(entity, Set.of());
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

        // Sans le module Paramétrage, un utilisateur ne modifie que son thème (préférences) : ni ses modules,
        // ni son email, ni son mot de passe (qui a son propre point d'API, avec le mot de passe actuel).
        // Une requête anonyme n'atteint ce point qu'en test, où l'authentification est désactivée.
        if (identity.isAnonymous() || identity.hasRole(ModuleApplication.PARAMETRAGE.name())) {
            validerModules(name, user);
            verifierAccesParametrageConserve(entity, user.modules);

            entity.name = user.name;
            entity.email = user.email;
            entity.modules.clear();
            entity.modules.addAll(user.modules);
            if (user.password != null && !user.password.isBlank()) {
                entity.password = PasswordUtil.hash(user.password);
            }
        }
        entity.theme = user.theme;

        entity.flush();
        UserEntity.getEntityManager().detach(entity);
        entity.password = null;
        return entity;
    }

    /**
     * Un utilisateur ne peut accéder qu'aux modules souscrits par la société ; l'utilisateur admin
     * a toujours accès au module Paramétrage (toujours souscrit).
     */
    private void validerModules(String name, UserEntity user) {
        if (user.modules == null) {
            user.modules = new HashSet<>();
        }
        if (ADMIN.equals(name)) {
            user.modules.add(ModuleApplication.PARAMETRAGE);
        }
        Set<ModuleApplication> souscrits = SocieteResource.modulesSouscrits();
        for (ModuleApplication module : user.modules) {
            if (!souscrits.contains(module)) {
                throw requeteInvalide("Le module " + module + " n'est pas souscrit par la société.");
            }
        }
    }

    /**
     * Au moins un utilisateur doit garder l'accès au module Paramétrage, sans quoi plus personne
     * ne pourrait gérer les utilisateurs ni l'abonnement.
     */
    private void verifierAccesParametrageConserve(UserEntity entity, Set<ModuleApplication> nouveauxModules) {
        if (!entity.modules.contains(ModuleApplication.PARAMETRAGE) || nouveauxModules.contains(ModuleApplication.PARAMETRAGE)) {
            return;
        }
        if (UserEntity.count("?1 member of modules and name <> ?2", ModuleApplication.PARAMETRAGE, entity.name) == 0) {
            throw requeteInvalide("Au moins un utilisateur doit conserver l'accès au module Paramétrage.");
        }
    }

    private static WebApplicationException requeteInvalide(String message) {
        return new WebApplicationException(Response.status(Response.Status.BAD_REQUEST).entity(message).build());
    }

    private List<UserEntity> sanitizeList(List<UserEntity> users) {
        users.forEach(u -> u.password = null);
        return users;
    }

}
