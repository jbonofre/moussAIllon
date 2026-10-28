package net.nanthrax.moussaillon.services;

import java.sql.Timestamp;
import java.util.List;
import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
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
import net.nanthrax.moussaillon.persistence.BanqueConnecteurEntity;

@Path("/connecteurs")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class BanqueConnecteurResource {

    @Inject
    ReglementResource reglements;

    @Inject
    PowensClient powens;

    @GET
    public List<BanqueConnecteurEntity> list() {
        return BanqueConnecteurEntity.listAll();
    }

    private static BanqueConnecteurEntity find(long id) {
        BanqueConnecteurEntity e = BanqueConnecteurEntity.findById(id);
        if (e == null) {
            throw new WebApplicationException("Le connecteur (" + id + ") n'est pas trouvé", 404);
        }
        return e;
    }

    private static void copy(BanqueConnecteurEntity from, BanqueConnecteurEntity to) {
        if (from.nom == null || from.nom.isBlank()) {
            throw new WebApplicationException("Le nom est requis", 400);
        }
        to.nom = from.nom.trim();
        to.banque = from.banque;
        to.iban = from.iban;
        to.bic = from.bic;
        to.notes = from.notes;
        to.actif = from.actif;
        to.fournisseur = "POWENS".equals(from.fournisseur) ? "POWENS" : "MANUEL";
    }

    @POST
    @Transactional
    public BanqueConnecteurEntity create(BanqueConnecteurEntity connecteur) {
        BanqueConnecteurEntity e = new BanqueConnecteurEntity();
        copy(connecteur, e);
        e.persist();
        return e;
    }

    @PUT
    @Path("{id}")
    @Transactional
    public BanqueConnecteurEntity update(@PathParam("id") long id, BanqueConnecteurEntity connecteur) {
        BanqueConnecteurEntity e = find(id);
        copy(connecteur, e);
        return e;
    }

    @DELETE
    @Path("{id}")
    @Transactional
    public void delete(@PathParam("id") long id) {
        find(id).delete();
    }

    @POST
    @Path("{id}/rapprochement")
    @Transactional
    public Map<String, Object> rapprocher(@PathParam("id") long id, ReglementResource.RapprochementAutoRequest request) {
        BanqueConnecteurEntity e = find(id);
        if (!e.actif) {
            throw new WebApplicationException("Le connecteur est désactivé", 400);
        }
        if (request == null || request.transactions == null || request.transactions.isEmpty()) {
            throw new WebApplicationException("Aucune écriture bancaire fournie", 400);
        }
        Map<String, Object> result = reglements.rapprocherAuto(request.transactions, e.nom);
        e.dernierRapprochement = new Timestamp(System.currentTimeMillis());
        e.dernierNbRapproches = ((List<?>) result.get("rapproches")).size();
        return result;
    }

    public static class PowensConfigRequest {
        public String domain;
        public String clientId;
        public String clientSecret;
    }

    public static class PowensUrlRequest {
        public String redirectUri;
    }

    public static class PowensConnexionRequest {
        public Long connectionId;
    }

    @PUT
    @Path("{id}/powens")
    @Transactional
    public BanqueConnecteurEntity configurerPowens(@PathParam("id") long id, PowensConfigRequest request) {
        BanqueConnecteurEntity e = find(id);
        if (request == null || isBlank(request.domain) || isBlank(request.clientId)) {
            throw new WebApplicationException("Le domaine et le client_id Powens sont requis", 400);
        }
        // Un secret laissé vide conserve celui déjà enregistré
        if (isBlank(request.clientSecret) && e.powensClientSecret == null) {
            throw new WebApplicationException("Le client_secret Powens est requis", 400);
        }
        e.fournisseur = "POWENS";
        e.powensDomain = request.domain.trim().replaceAll("^https?://", "").replaceAll("\\.biapi\\.pro.*$", "");
        e.powensClientId = request.clientId.trim();
        if (!isBlank(request.clientSecret)) {
            e.powensClientSecret = request.clientSecret.trim();
        }
        return e;
    }

    /** Retourne l'URL de la fenêtre Powens où l'utilisateur choisit sa banque (Crédit Agricole…) et consent à l'accès. */
    @POST
    @Path("{id}/powens/connexion-url")
    @Transactional
    public Map<String, String> powensConnexionUrl(@PathParam("id") long id, PowensUrlRequest request) {
        BanqueConnecteurEntity e = find(id);
        if (!e.isPowensConfigure()) {
            throw new WebApplicationException("Le connecteur Powens n'est pas configuré", 400);
        }
        if (request == null || isBlank(request.redirectUri)) {
            throw new WebApplicationException("L'URL de redirection est requise", 400);
        }
        if (e.powensUserToken == null) {
            Map<String, Object> init = powens.post(e, "/auth/init",
                    Map.of("client_id", e.powensClientId, "client_secret", e.powensClientSecret), null);
            e.powensUserToken = String.valueOf(init.get("auth_token"));
        }
        Map<String, Object> code = powens.get(e, "/auth/token/code?type=temporary", e.powensUserToken);
        String url = "https://webview.powens.com/fr/connect?domain=" + e.powensDomain + ".biapi.pro"
                + "&client_id=" + enc(e.powensClientId)
                + "&redirect_uri=" + enc(request.redirectUri)
                + "&code=" + enc(String.valueOf(code.get("code")));
        return Map.of("url", url);
    }

    /** Enregistre l'identifiant de connexion renvoyé par Powens à la fin du consentement. */
    @POST
    @Path("{id}/powens/connexion")
    @Transactional
    public BanqueConnecteurEntity powensConnexion(@PathParam("id") long id, PowensConnexionRequest request) {
        BanqueConnecteurEntity e = find(id);
        if (request == null || request.connectionId == null) {
            throw new WebApplicationException("L'identifiant de connexion est requis", 400);
        }
        e.powensConnectionId = request.connectionId;
        return e;
    }

    /** Récupère les écritures créditrices des 60 derniers jours chez Powens et rapproche les règlements. */
    @POST
    @Path("{id}/synchronisation")
    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> synchroniser(@PathParam("id") long id) {
        BanqueConnecteurEntity e = find(id);
        if (!e.actif) {
            throw new WebApplicationException("Le connecteur est désactivé", 400);
        }
        if (!"POWENS".equals(e.fournisseur) || !e.isPowensConnecte()) {
            throw new WebApplicationException("Le compte n'est pas connecté à Powens", 400);
        }
        String minDate = java.time.LocalDate.now().minusDays(60).toString();
        Map<String, Object> data = powens.get(e,
                "/users/me/transactions?limit=1000&min_date=" + minDate, e.powensUserToken);
        List<ReglementResource.BanqueTransaction> transactions = new java.util.ArrayList<>();
        Object list = data.get("transactions");
        if (list instanceof List) {
            for (Object o : (List<Object>) list) {
                Map<String, Object> t = (Map<String, Object>) o;
                Object value = t.get("value");
                if (!(value instanceof Number) || ((Number) value).doubleValue() <= 0 || t.get("date") == null) {
                    continue;
                }
                ReglementResource.BanqueTransaction tx = new ReglementResource.BanqueTransaction();
                tx.date = String.valueOf(t.get("date"));
                tx.libelle = String.valueOf(t.get("wording") != null ? t.get("wording") : t.get("original_wording"));
                tx.montant = ((Number) value).doubleValue();
                transactions.add(tx);
            }
        }
        Map<String, Object> result = new java.util.LinkedHashMap<>(reglements.rapprocherAuto(transactions, e.nom));
        e.dernierRapprochement = new Timestamp(System.currentTimeMillis());
        e.dernierNbRapproches = ((List<?>) result.get("rapproches")).size();
        result.put("ecrituresLues", transactions.size());
        return result;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String enc(String s) {
        return java.net.URLEncoder.encode(s, java.nio.charset.StandardCharsets.UTF_8);
    }
}
