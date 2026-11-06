package net.nanthrax.moussaillon.services;

import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.metamodel.EntityType;
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
import net.nanthrax.moussaillon.persistence.ChantierEntity;
import net.nanthrax.moussaillon.persistence.ModuleApplication;
import net.nanthrax.moussaillon.persistence.PanacheEntityChantier;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import net.nanthrax.moussaillon.persistence.UserEntity;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.hibernate.Session;
import org.jboss.logging.Logger;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Administration de l'instance, réservée à l'administrateur défini dans la configuration (admin.username,
 * admin.password, admin.email) : création des chantiers, changement de leur code, gestion de leur abonnement
 * (gratuit, modules, paiements reçus, résiliation), suspension de leur accès et suppression.
 */
@Path("/admin")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
public class AdminResource {

    private static final Logger LOG = Logger.getLogger(AdminResource.class);

    // Signature enregistrée sur les paiements saisis par l'administrateur.
    static final String SIGNATURE_ADMIN = "Administrateur moussAIllon";

    @ConfigProperty(name = "admin.username")
    String username;

    @ConfigProperty(name = "admin.password")
    String password;

    @ConfigProperty(name = "admin.email", defaultValue = "")
    String email;

    @ConfigProperty(name = "chantier.par-defaut")
    Optional<String> chantierParDefaut;

    @Inject
    TokenService tokenService;

    @Inject
    Chantiers chantiers;

    @Inject
    SocieteResource societeResource;

    @Inject
    DataInitializer dataInitializer;

    public static class LoginRequest {
        public String name;
        public String password;
    }

    public static class AuthResponse {
        public String token;
        public String name;
        public String email;
    }

    /** Chantier et société (abonnement compris) : null si la société n'existe pas. */
    public static class ChantierVue {
        public ChantierEntity chantier;
        public SocieteEntity societe;
    }

    public static class ChantierCreation {
        public String code;
        public String nom;
        public String email;
        // Premier utilisateur du chantier, qui a accès à tous les modules.
        public String utilisateur;
        public String motDePasse;
        public boolean gratuit;
        // Modules souscrits ; tous si vide.
        public Set<ModuleApplication> modules;
    }

    public static class ChantierModification {
        public String nom;
        public String email;
        public Boolean gratuit;
        public Boolean accesSuspendu;
    }

    public static class ChangementCode {
        public String code;
    }

    @POST
    @Path("/authenticate")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response authenticate(LoginRequest request) {
        if (request == null || request.name == null || request.password == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Nom d'utilisateur et mot de passe requis.").build();
        }
        if (password == null || password.isBlank() || !egal(username, request.name) || !egal(password, request.password)) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Identifiants invalides.").build();
        }
        AuthResponse auth = new AuthResponse();
        auth.token = tokenService.generateToken(null, username, Set.of(AccesApiFilter.GROUPE_ADMIN), email, null);
        auth.name = username;
        auth.email = email;
        return Response.ok(auth).build();
    }

    @GET
    @Path("/tarifs")
    public SocieteResource.Tarifs tarifs() {
        return societeResource.tarifs();
    }

    @GET
    @Path("/chantiers")
    public List<ChantierVue> list() {
        List<ChantierVue> vues = new ArrayList<>();
        for (String code : chantiers.codes()) {
            vues.add(vue(code));
        }
        return vues;
    }

    @GET
    @Path("/chantiers/{code}")
    public ChantierVue get(@PathParam("code") String code) {
        return vue(existant(code).code);
    }

    /** Crée le chantier et ses données : société, premier utilisateur et référentiels par défaut. */
    @POST
    @Path("/chantiers")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response create(ChantierCreation creation) {
        if (creation == null) {
            throw requeteInvalide("Les informations du chantier sont requises.");
        }
        String code = codeSaisi(creation.code);
        if (creation.nom == null || creation.nom.isBlank()) {
            throw requeteInvalide("Le nom du chantier est requis.");
        }
        if (creation.email == null || creation.email.isBlank()) {
            throw requeteInvalide("L'email du chantier est requis.");
        }
        if (creation.motDePasse == null || creation.motDePasse.isBlank()) {
            throw requeteInvalide("Le mot de passe du premier utilisateur est requis.");
        }
        String utilisateur = creation.utilisateur == null || creation.utilisateur.isBlank() ? UserResource.ADMIN : creation.utilisateur.trim();
        if (chantiers.trouver(code) != null) {
            throw requeteInvalide("Le chantier " + code + " existe déjà.");
        }
        chantiers.dans(code, () -> {
            ChantierEntity chantier = new ChantierEntity();
            chantier.code = code;
            chantier.nom = creation.nom.trim();
            chantier.email = creation.email.trim();
            chantier.gratuit = creation.gratuit;
            chantier.dateCreation = SocieteResource.horodatage();
            chantier.persist();
            dataInitializer.initialiserChantier(chantier.nom, chantier.email, utilisateur, creation.motDePasse, chantier.email);
            if (creation.modules != null && !creation.modules.isEmpty()) {
                SocieteResource.appliquerModules(SocieteEntity.courante(), creation.modules);
            }
        });
        LOG.infof("Chantier %s créé (%s)", code, creation.nom);
        return Response.status(Response.Status.CREATED).entity(vue(code)).build();
    }

    /** Modifie le nom et le contact du chantier, son abonnement gratuit et la suspension de son accès. */
    @PUT
    @Path("/chantiers/{code}")
    @Consumes(MediaType.APPLICATION_JSON)
    public ChantierVue update(@PathParam("code") String code, ChantierModification modification) {
        String chantierCode = existant(code).code;
        if (modification == null) {
            throw requeteInvalide("Les modifications du chantier sont requises.");
        }
        QuarkusTransaction.requiringNew().run(() -> {
            ChantierEntity chantier = ChantierEntity.findById(chantierCode);
            if (modification.nom != null) {
                if (modification.nom.isBlank()) {
                    throw requeteInvalide("Le nom du chantier est requis.");
                }
                chantier.nom = modification.nom.trim();
            }
            if (modification.email != null) {
                chantier.email = modification.email.trim();
            }
            if (modification.gratuit != null) {
                chantier.gratuit = modification.gratuit;
            }
            if (modification.accesSuspendu != null && modification.accesSuspendu != chantier.accesSuspendu) {
                chantier.accesSuspendu = modification.accesSuspendu;
                chantier.accesSuspenduDate = chantier.accesSuspendu ? SocieteResource.horodatage() : null;
                LOG.infof("Accès du chantier %s %s", chantierCode, chantier.accesSuspendu ? "suspendu" : "rétabli");
            }
        });
        return vue(chantierCode);
    }

    /**
     * Change le code du chantier, dans le registre et dans toutes ses données, en une seule transaction. Les jetons
     * émis avec l'ancien code sont refusés : utilisateurs, clients et techniciens se reconnectent avec le nouveau.
     */
    @PUT
    @Path("/chantiers/{code}/code")
    @Consumes(MediaType.APPLICATION_JSON)
    public ChantierVue changerCode(@PathParam("code") String code, ChangementCode changement) {
        String ancien = existant(code).code;
        String nouveau = codeSaisi(changement == null ? null : changement.code);
        if (nouveau.equals(ancien)) {
            return vue(ancien);
        }
        if (chantierParDefaut.map(ChantierEntity::normaliser).filter(ancien::equals).isPresent()) {
            throw requeteInvalide("Le chantier " + ancien + " est le chantier par défaut de l'instance (propriété chantier.par-defaut) :"
                + " changez d'abord cette propriété.");
        }
        if (chantiers.trouver(nouveau) != null) {
            throw requeteInvalide("Le chantier " + nouveau + " existe déjà.");
        }
        chantiers.enRacine(() -> SocieteEntity.getEntityManager().unwrap(Session.class)
            .doWork(connection -> remplacerCode(connection, ancien, nouveau)));
        LOG.infof("Code du chantier %s changé en %s", ancien, nouveau);
        return vue(nouveau);
    }

    /**
     * Remplace le code du chantier dans le registre et dans la colonne chantier de chaque table. Refusé si des
     * données portent déjà le nouveau code (restes d'un chantier qui n'est plus au registre) : le chantier les
     * récupérerait.
     */
    static void remplacerCode(Connection connection, String ancien, String nouveau) throws SQLException {
        List<String> tables = DataInitializer.tablesChantier(connection);
        for (String table : tables) {
            try (PreparedStatement requete = connection.prepareStatement("SELECT COUNT(*) FROM " + table + " WHERE chantier = ?")) {
                requete.setString(1, nouveau);
                try (ResultSet rs = requete.executeQuery()) {
                    if (rs.next() && rs.getLong(1) > 0) {
                        throw requeteInvalide("Des données portent déjà le code " + nouveau + " (table " + table + ") : choisissez un autre code.");
                    }
                }
            }
        }
        try (PreparedStatement requete = connection.prepareStatement("UPDATE ChantierEntity SET code = ? WHERE code = ?")) {
            requete.setString(1, nouveau);
            requete.setString(2, ancien);
            requete.executeUpdate();
        }
        for (String table : tables) {
            try (PreparedStatement requete = connection.prepareStatement("UPDATE " + table + " SET chantier = ? WHERE chantier = ?")) {
                requete.setString(1, nouveau);
                requete.setString(2, ancien);
                int lignes = requete.executeUpdate();
                if (lignes > 0) {
                    LOG.infof("%s : %d ligne(s) passée(s) du chantier %s au chantier %s", table, lignes, ancien, nouveau);
                }
            }
        }
    }

    /** Modules souscrits par le chantier, sans paiement (les utilisateurs perdent les modules retirés). */
    @PUT
    @Path("/chantiers/{code}/modules")
    @Consumes(MediaType.APPLICATION_JSON)
    public ChantierVue modules(@PathParam("code") String code, Set<ModuleApplication> modules) {
        String chantierCode = existant(code).code;
        if (modules == null) {
            throw requeteInvalide("Les modules souscrits sont requis.");
        }
        chantiers.dans(chantierCode, () -> SocieteResource.appliquerModules(societe(), modules));
        return vue(chantierCode);
    }

    /** Enregistre un paiement de l'abonnement reçu par l'éditeur (virement, carte...). */
    @POST
    @Path("/chantiers/{code}/paiements")
    @Consumes(MediaType.APPLICATION_JSON)
    public ChantierVue paiement(@PathParam("code") String code, SocieteResource.PaiementRequest paiement) {
        String chantierCode = existant(code).code;
        if (paiement == null) {
            throw requeteInvalide("Le paiement est requis.");
        }
        paiement.signature = SIGNATURE_ADMIN;
        chantiers.dans(chantierCode, () -> {
            societe();
            societeResource.payer(paiement);
        });
        return vue(chantierCode);
    }

    @POST
    @Path("/chantiers/{code}/resilier")
    public ChantierVue resilier(@PathParam("code") String code) {
        String chantierCode = existant(code).code;
        chantiers.dans(chantierCode, () -> {
            societe();
            societeResource.resilier();
        });
        return vue(chantierCode);
    }

    @POST
    @Path("/chantiers/{code}/reactiver")
    public ChantierVue reactiver(@PathParam("code") String code) {
        String chantierCode = existant(code).code;
        chantiers.dans(chantierCode, () -> {
            societe();
            societeResource.reactiver();
        });
        return vue(chantierCode);
    }

    /**
     * Supprime le chantier et toutes ses données. Le code du chantier doit être confirmé (paramètre confirmation).
     * Les images et documents déposés restent sur le disque (noms aléatoires, communs à tous les chantiers).
     */
    @DELETE
    @Path("/chantiers/{code}")
    public Response delete(@PathParam("code") String code, @QueryParam("confirmation") String confirmation) {
        String chantierCode = existant(code).code;
        if (!chantierCode.equals(ChantierEntity.normaliser(confirmation))) {
            throw requeteInvalide("Confirmez la suppression en saisissant le code du chantier.");
        }
        supprimerDonnees(chantierCode);
        QuarkusTransaction.requiringNew().run(() -> ChantierEntity.deleteById(chantierCode));
        LOG.infof("Chantier %s supprimé", chantierCode);
        return Response.noContent().build();
    }

    /**
     * Supprime les données du chantier, table par table. L'ordre des suppressions dépend des clés étrangères :
     * une suppression refusée (données encore référencées) est retentée au tour suivant, jusqu'à ce que toutes
     * aboutissent. Les collections des entités (modules, images...) sont supprimées avec elles.
     */
    void supprimerDonnees(String code) {
        List<String> restantes = chantiers.enRacine(() -> {
            EntityManager em = SocieteEntity.getEntityManager();
            List<String> entites = new ArrayList<>();
            for (EntityType<?> type : em.getMetamodel().getEntities()) {
                if (PanacheEntityChantier.class.isAssignableFrom(type.getJavaType()) || UserEntity.class.equals(type.getJavaType())) {
                    entites.add(type.getName());
                }
            }
            return entites;
        });
        boolean referencesDetachees = false;
        while (!restantes.isEmpty()) {
            List<String> refusees = new ArrayList<>();
            RuntimeException derniereErreur = null;
            for (String entite : restantes) {
                try {
                    chantiers.enRacine(() -> {
                        SocieteEntity.getEntityManager()
                            .createQuery("delete from " + entite + " where chantier = :chantier")
                            .setParameter("chantier", code)
                            .executeUpdate();
                    });
                } catch (RuntimeException e) {
                    refusees.add(entite);
                    derniereErreur = e;
                }
            }
            if (refusees.size() == restantes.size() && !referencesDetachees) {
                // Données encore référencées par celles d'un autre chantier : ces références sont détachées.
                chantiers.enRacine(() -> SocieteEntity.getEntityManager().unwrap(Session.class)
                    .doWork(connection -> detacherReferencesExternes(connection, code)));
                referencesDetachees = true;
                continue;
            }
            if (refusees.size() == restantes.size()) {
                LOG.errorf(derniereErreur, "Suppression des données du chantier %s impossible : %s", code, refusees);
                throw new WebApplicationException(Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("Suppression des données du chantier impossible : " + refusees)
                    .type(MediaType.TEXT_PLAIN + ";charset=UTF-8").build());
            }
            restantes = refusees;
        }
    }

    /**
     * Détache les références aux données du chantier venant d'ailleurs : une ligne d'un autre chantier (clé
     * étrangère nullable, mise à null) ou une table de collection (ligne de liaison supprimée). Ces références
     * n'ont pas lieu d'être (chaque chantier ne voit que ses données), mais une requête forgeant l'identifiant
     * d'une donnée d'un autre chantier peut en créer ; elles empêcheraient la suppression du chantier.
     */
    static void detacherReferencesExternes(Connection connection, String code) throws SQLException {
        List<String> tablesChantier = DataInitializer.tablesChantier(connection);
        DatabaseMetaData metadonnees = connection.getMetaData();
        for (String table : tablesDuSchema(metadonnees)) {
            try (ResultSet cles = metadonnees.getImportedKeys(null, "PUBLIC", table)) {
                while (cles.next()) {
                    String cible = cles.getString("PKTABLE_NAME");
                    String colonne = cles.getString("FKCOLUMN_NAME");
                    if (!tablesChantier.contains(cible) || cible.equals(table)) {
                        continue;
                    }
                    String donneesDuChantier = colonne + " IN (SELECT " + cles.getString("PKCOLUMN_NAME") + " FROM " + cible
                        + " WHERE chantier = ?)";
                    String sql;
                    if (!tablesChantier.contains(table)) {
                        sql = "DELETE FROM " + table + " WHERE " + donneesDuChantier;
                    } else if (colonneNullable(metadonnees, table, colonne)) {
                        sql = "UPDATE " + table + " SET " + colonne + " = NULL WHERE chantier <> ? AND " + donneesDuChantier;
                    } else {
                        continue;
                    }
                    try (PreparedStatement requete = connection.prepareStatement(sql)) {
                        int index = 1;
                        if (sql.startsWith("UPDATE")) {
                            requete.setString(index++, code);
                        }
                        requete.setString(index, code);
                        int lignes = requete.executeUpdate();
                        if (lignes > 0) {
                            LOG.infof("%s.%s : %d référence(s) aux données du chantier %s détachée(s)", table, colonne, lignes, code);
                        }
                    }
                }
            }
        }
    }

    private static List<String> tablesDuSchema(DatabaseMetaData metadonnees) throws SQLException {
        List<String> tables = new ArrayList<>();
        try (ResultSet rs = metadonnees.getTables(null, "PUBLIC", "%", new String[] { "TABLE" })) {
            while (rs.next()) {
                tables.add(rs.getString("TABLE_NAME"));
            }
        }
        return tables;
    }

    private static boolean colonneNullable(DatabaseMetaData metadonnees, String table, String colonne) throws SQLException {
        try (ResultSet rs = metadonnees.getColumns(null, "PUBLIC", table, colonne)) {
            return rs.next() && "YES".equals(rs.getString("IS_NULLABLE"));
        }
    }

    private ChantierVue vue(String code) {
        return chantiers.dans(code, () -> {
            ChantierVue vue = new ChantierVue();
            vue.chantier = ChantierEntity.findById(code);
            vue.societe = SocieteEntity.courante() == null ? null : societeResource.get();
            return vue;
        });
    }

    /** Code chantier saisi, normalisé ; refusé s'il n'a pas le format des codes. */
    private static String codeSaisi(String saisi) {
        String code = ChantierEntity.normaliser(saisi);
        if (!ChantierEntity.codeValide(code)) {
            throw requeteInvalide("Code chantier invalide : 2 à " + ChantierEntity.LONGUEUR_CODE
                + " caractères parmi les lettres minuscules, les chiffres et le tiret, en commençant par une lettre ou un chiffre.");
        }
        return code;
    }

    private ChantierEntity existant(String code) {
        ChantierEntity chantier = chantiers.trouver(ChantierEntity.normaliser(code));
        if (chantier == null) {
            throw new WebApplicationException("Le chantier " + code + " n'existe pas", 404);
        }
        return chantier;
    }

    /** Société du chantier courant : son abonnement ne se gère pas sans elle. */
    private static SocieteEntity societe() {
        SocieteEntity societe = SocieteEntity.courante();
        if (societe == null) {
            throw new WebApplicationException("La société du chantier n'est pas trouvée", 404);
        }
        return societe;
    }

    private static boolean egal(String attendu, String recu) {
        return attendu != null && recu != null
            && MessageDigest.isEqual(attendu.getBytes(StandardCharsets.UTF_8), recu.getBytes(StandardCharsets.UTF_8));
    }

    private static WebApplicationException requeteInvalide(String message) {
        return new WebApplicationException(Response.status(Response.Status.BAD_REQUEST)
            .entity(message).type(MediaType.TEXT_PLAIN + ";charset=UTF-8").build());
    }

}
