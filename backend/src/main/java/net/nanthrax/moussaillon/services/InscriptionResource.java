package net.nanthrax.moussaillon.services;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.Mailer;
import io.vertx.core.http.HttpServerRequest;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.TimestampJsonbAdapter;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

import static net.nanthrax.moussaillon.services.CreationChantier.requeteInvalide;

/**
 * Inscription d'un chantier depuis l'espace chantier, sans passer par l'administrateur de l'instance : le chantier
 * est créé aussitôt, avec une période d'essai gratuite (propriété inscription.essai-mois) pendant laquelle
 * l'accès n'est pas limité à la facturation. L'administrateur est prévenu par email de chaque inscription.
 */
@Path("/inscription")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
public class InscriptionResource {

    private static final Logger LOG = Logger.getLogger(InscriptionResource.class);

    static final int LONGUEUR_MIN_MOT_DE_PASSE = 8;

    private static final Pattern FORMAT_EMAIL = Pattern.compile("[^@\\s]+@[^@\\s]+\\.[^@\\s]+");

    private static final DateTimeFormatter FORMAT_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private static final Duration FENETRE_LIMITE = Duration.ofHours(1);

    @ConfigProperty(name = "inscription.active", defaultValue = "true")
    boolean active;

    @ConfigProperty(name = "inscription.essai-mois", defaultValue = "1")
    int essaiMois;

    // Inscriptions acceptées par heure depuis une même adresse IP.
    @ConfigProperty(name = "inscription.limite-par-heure", defaultValue = "3")
    int limiteParHeure;

    // Adresse publique de l'espace chantier, pour le lien de l'email de bienvenue.
    @ConfigProperty(name = "chantier.url")
    Optional<String> urlEspaceChantier;

    @ConfigProperty(name = "admin.email")
    Optional<String> adminEmail;

    @Inject
    CreationChantier creationChantier;

    @Inject
    Mailer mailer;

    // Dates des inscriptions récentes, par adresse IP.
    private final Map<String, Deque<Instant>> inscriptionsRecentes = new HashMap<>();

    public static class Configuration {
        public boolean active;
        public int essaiMois;
    }

    public static class Inscription {
        public String nom;
        public String code;
        public String email;
        public String utilisateur;
        public String motDePasse;
    }

    public static class Resultat {
        public String code;
        public String utilisateur;
        @JsonbTypeAdapter(TimestampJsonbAdapter.class)
        public Timestamp essaiFin;
    }

    /** Inscriptions ouvertes ou non, et durée de l'essai gratuit : l'écran de connexion propose l'inscription. */
    @GET
    public Configuration configuration() {
        Configuration configuration = new Configuration();
        configuration.active = active;
        configuration.essaiMois = essaiMois;
        return configuration;
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public Response inscrire(Inscription inscription, @Context HttpServerRequest requete) {
        if (!active) {
            throw refus(Response.Status.FORBIDDEN, "Les inscriptions sont fermées sur cette instance : contactez l'éditeur de moussAIllon.");
        }
        if (inscription == null) {
            throw requeteInvalide("Les informations du chantier sont requises.");
        }
        if (inscription.email == null || !FORMAT_EMAIL.matcher(inscription.email.trim()).matches()) {
            throw requeteInvalide("L'email du chantier est invalide.");
        }
        if (inscription.motDePasse == null || inscription.motDePasse.length() < LONGUEUR_MIN_MOT_DE_PASSE) {
            throw requeteInvalide("Le mot de passe doit contenir au moins " + LONGUEUR_MIN_MOT_DE_PASSE + " caractères.");
        }
        String adresse = adresse(requete);
        if (!autorisee(adresse)) {
            throw refus(Response.Status.TOO_MANY_REQUESTS, "Trop d'inscriptions depuis cette adresse : réessayez dans une heure.");
        }

        CreationChantier.Demande demande = new CreationChantier.Demande();
        demande.code = inscription.code;
        demande.nom = inscription.nom;
        demande.email = inscription.email.trim();
        demande.utilisateur = inscription.utilisateur;
        demande.motDePasse = inscription.motDePasse;
        Timestamp essaiFin = SocieteResource.plusMois(SocieteResource.horodatage(), essaiMois);
        String code = creationChantier.creer(demande, essaiFin);
        enregistrer(adresse);

        Resultat resultat = new Resultat();
        resultat.code = code;
        resultat.utilisateur = inscription.utilisateur == null || inscription.utilisateur.isBlank()
            ? UserResource.ADMIN : inscription.utilisateur.trim();
        resultat.essaiFin = essaiFin;
        LOG.infof("Inscription du chantier %s (%s, %s) depuis %s", code, inscription.nom, demande.email, adresse);
        envoyerEmails(inscription.nom.trim(), demande.email, resultat, adresse);
        return Response.status(Response.Status.CREATED).entity(resultat).build();
    }

    /** Email de bienvenue au chantier (code et utilisateur à garder) et avis d'inscription à l'administrateur. */
    private void envoyerEmails(String nom, String email, Resultat resultat, String adresse) {
        String finEssai = resultat.essaiFin.toLocalDateTime().format(FORMAT_DATE);
        String lien = urlEspaceChantier.map(String::trim).filter(url -> !url.isEmpty())
            .map(url -> "Espace chantier : " + url + (url.contains("?") ? "&" : "?") + "chantier=" + resultat.code + "\n")
            .orElse("");
        envoyer(email, "Bienvenue sur moussAIllon : votre chantier " + nom,
            "Bonjour,\n\n"
                + "Votre chantier « " + nom + " » est créé sur moussAIllon.\n\n"
                + "Code chantier : " + resultat.code + "\n"
                + "Utilisateur : " + resultat.utilisateur + "\n"
                + lien + "\n"
                + "Le code chantier vous est demandé à chaque connexion, avec votre utilisateur et votre mot de passe.\n\n"
                + "Votre essai gratuit dure jusqu'au " + finEssai + ". Pour continuer ensuite, activez votre abonnement "
                + "depuis la page Facturation (Paramétrage) : le premier mois payé commence à la fin de l'essai.\n\n"
                + "L'équipe moussAIllon");
        adminEmail.map(String::trim).filter(adresseAdmin -> !adresseAdmin.isEmpty()).ifPresent(adresseAdmin ->
            envoyer(adresseAdmin, "Nouveau chantier inscrit : " + nom + " (" + resultat.code + ")",
                "Un chantier s'est inscrit depuis l'espace chantier.\n\n"
                    + "Nom : " + nom + "\n"
                    + "Code chantier : " + resultat.code + "\n"
                    + "Email : " + email + "\n"
                    + "Utilisateur : " + resultat.utilisateur + "\n"
                    + "Essai gratuit jusqu'au " + finEssai + "\n"
                    + "Adresse IP : " + adresse + "\n\n"
                    + "Il se gère depuis l'application admin (abonnement, accès, suppression)."));
    }

    private void envoyer(String destinataire, String objet, String texte) {
        try {
            mailer.send(Mail.withText(destinataire, objet, texte));
        } catch (Exception e) {
            LOG.warnf(e, "Email d'inscription non envoyé à %s", destinataire);
        }
    }

    /** Adresse de l'appelant : celle transmise par le proxy (X-Real-IP), sinon celle de la connexion. */
    private static String adresse(HttpServerRequest requete) {
        if (requete == null) {
            return "inconnue";
        }
        String transmise = requete.getHeader("X-Real-IP");
        if (transmise != null && !transmise.isBlank()) {
            return transmise.trim();
        }
        return requete.remoteAddress() == null ? "inconnue" : requete.remoteAddress().hostAddress();
    }

    /** Moins de inscription.limite-par-heure inscriptions depuis cette adresse au cours de la dernière heure. */
    private synchronized boolean autorisee(String adresse) {
        Instant limite = Instant.now().minus(FENETRE_LIMITE);
        inscriptionsRecentes.values().forEach(dates -> dates.removeIf(date -> date.isBefore(limite)));
        inscriptionsRecentes.values().removeIf(Deque::isEmpty);
        return inscriptionsRecentes.getOrDefault(adresse, new ArrayDeque<>()).size() < limiteParHeure;
    }

    private synchronized void enregistrer(String adresse) {
        inscriptionsRecentes.computeIfAbsent(adresse, a -> new ArrayDeque<>()).add(Instant.now());
    }

    private static WebApplicationException refus(Response.Status statut, String message) {
        return new WebApplicationException(Response.status(statut)
            .entity(message).type(MediaType.TEXT_PLAIN + ";charset=UTF-8").build());
    }

}
