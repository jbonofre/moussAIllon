package net.nanthrax.moussaillon.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import net.nanthrax.moussaillon.persistence.ClientEntity;
import net.nanthrax.moussaillon.persistence.ModuleApplication;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import net.nanthrax.moussaillon.persistence.SocietePaiementEntity;
import net.nanthrax.moussaillon.persistence.TechnicienEntity;
import net.nanthrax.moussaillon.persistence.UserEntity;
import org.eclipse.microprofile.config.Config;
import org.eclipse.microprofile.config.ConfigProvider;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Path("/societe")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SocieteResource {

    static final double MONTANT_ACTIVATION = 350.0;
    // Le paiement annuel correspond à 11 mensualités (1 mois offert).
    static final int MOIS_FACTURES_ANNUEL = 11;

    // Délai de rétractation après résiliation avant blocage effectif des accès.
    static final int DUREE_RETRACTATION_JOURS = 14;

    // Délai après une échéance impayée au-delà duquel l'accès est limité à la facturation.
    static final int DELAI_BLOCAGE_IMPAYE_MOIS = 2;

    @Inject
    Config config;

    // Prix mensuel par utilisateur du chantier, par technicien et par client ayant accès au portail ;
    // s'y ajoute le prix de chaque module souscrit.
    @ConfigProperty(name = "abonnement.prix-utilisateur", defaultValue = "10")
    double prixUtilisateur;

    @ConfigProperty(name = "abonnement.prix-technicien", defaultValue = "10")
    double prixTechnicien;

    @ConfigProperty(name = "abonnement.prix-client", defaultValue = "0.10")
    double prixClient;

    // Paiement en ligne de l'abonnement, au montant calculé : comptes Stripe / PayPlug de l'éditeur,
    // distincts de ceux du chantier qui encaissent les ventes (payment.*).
    @ConfigProperty(name = "abonnement.stripe.api-key")
    Optional<String> abonnementStripeApiKey;

    @ConfigProperty(name = "abonnement.payplug.api-key")
    Optional<String> abonnementPayplugApiKey;

    // Page de retour après le paiement en ligne (la facturation du chantier).
    @ConfigProperty(name = "abonnement.paiement.retour-url", defaultValue = "http://localhost:3000/chantier/")
    String abonnementPaiementRetourUrl;

    public static class Tarifs {
        public double prixUtilisateur;
        public double prixTechnicien;
        public double prixClient;
        // Prix mensuel de chaque module, dans l'ordre des modules.
        public Map<String, Double> prixModules = new LinkedHashMap<>();
        public int moisFacturesAnnuel;
        // Modes de paiement en ligne au montant calculé (clé API de l'éditeur configurée).
        public Map<String, Boolean> paiementEnLigne = new LinkedHashMap<>();
    }

    public static class PaiementEnLigneRequest {
        public String type; // MENSUEL | ANNUEL
        public String mode; // STRIPE | PAYPLUG
    }

    public static class PaiementRequest {
        public String type; // MENSUEL | ANNUEL
        public String mode; // CHEQUE | VIREMENT | CARTE | ESPÈCES
        public String signature;
    }

    @GET
    @Transactional
    public SocieteEntity get() {
        SocieteEntity entity = SocieteEntity.findById(1);
        if (entity == null) {
            throw new WebApplicationException("La société n'est pas trouvée", 404);
        }
        initAbonnement(entity);
        return entity;
    }

    @GET
    @Path("/tarifs")
    public Tarifs tarifs() {
        Tarifs tarifs = new Tarifs();
        tarifs.prixUtilisateur = prixUtilisateur;
        tarifs.prixTechnicien = prixTechnicien;
        tarifs.prixClient = prixClient;
        for (ModuleApplication module : ModuleApplication.values()) {
            tarifs.prixModules.put(module.name(), prixModule(module));
        }
        tarifs.moisFacturesAnnuel = MOIS_FACTURES_ANNUEL;
        tarifs.paiementEnLigne.put("STRIPE", abonnementStripeApiKey.isPresent());
        tarifs.paiementEnLigne.put("PAYPLUG", abonnementPayplugApiKey.isPresent());
        return tarifs;
    }

    /**
     * Crée un paiement en ligne (Stripe ou PayPlug) au montant de l'échéance et renvoie l'URL de sa page de
     * paiement. Sans clé API de l'éditeur, le lien de paiement fixe de la société est renvoyé s'il existe :
     * son montant ne suit alors pas le prix calculé.
     */
    @POST
    @Path("/paiement/en-ligne")
    @Transactional
    public Map<String, String> paiementEnLigne(PaiementEnLigneRequest request) {
        if (request == null || request.type == null || (!request.type.equals("MENSUEL") && !request.type.equals("ANNUEL"))) {
            throw new WebApplicationException("Type de paiement invalide (MENSUEL ou ANNUEL attendu)", 400);
        }
        boolean annuel = request.type.equals("ANNUEL");
        SocieteEntity entity = SocieteEntity.findById(1);
        if (entity == null) {
            throw new WebApplicationException("La société n'est pas trouvée", 404);
        }
        if (entity.abonnementResilie) {
            throw new WebApplicationException("L'abonnement est résilié", 400);
        }
        initAbonnement(entity);
        long montantCentimes = Math.round((annuel ? entity.abonnementMontantAnnuel : entity.abonnementProchainPaiementMontant) * 100);
        String designation = "Abonnement moussAIllon " + (annuel ? "annuel" : "mensuel") + " - " + entity.nom;

        String url;
        try {
            if ("STRIPE".equals(request.mode)) {
                url = abonnementStripeApiKey.isPresent()
                    ? PaymentResource.creerSessionStripe(abonnementStripeApiKey.get(), montantCentimes, designation,
                        abonnementPaiementRetourUrl, abonnementPaiementRetourUrl)
                    : (annuel ? entity.stripePaymentLinkAnnuel : entity.stripePaymentLinkMensuel);
            } else if ("PAYPLUG".equals(request.mode)) {
                url = abonnementPayplugApiKey.isPresent()
                    ? PaymentResource.creerPaiementPayplug(abonnementPayplugApiKey.get(), montantCentimes, entity.email, entity.nom,
                        abonnementPaiementRetourUrl, abonnementPaiementRetourUrl)
                    : (annuel ? entity.payplugPaymentLinkAnnuel : entity.payplugPaymentLinkMensuel);
            } else {
                throw new WebApplicationException("Mode de paiement en ligne invalide (STRIPE ou PAYPLUG attendu)", 400);
            }
        } catch (WebApplicationException e) {
            throw e;
        } catch (Exception e) {
            throw new WebApplicationException("Erreur lors de la création du paiement en ligne : " + e.getMessage(), 500);
        }
        if (url == null || url.isBlank()) {
            throw new WebApplicationException("Le paiement " + request.mode + " n'est pas configuré", 400);
        }
        return Map.of("url", url);
    }

    /**
     * Modifie les modules souscrits (le module Paramétrage l'est toujours). Les utilisateurs
     * perdent l'accès aux modules qui ne sont plus souscrits.
     */
    @PUT
    @Path("/modules")
    @Transactional
    public SocieteEntity modifierModules(Set<ModuleApplication> modules) {
        if (modules == null) {
            throw new WebApplicationException("Les modules souscrits sont requis", 400);
        }
        SocieteEntity entity = SocieteEntity.findById(1);
        if (entity == null) {
            throw new WebApplicationException("La société n'est pas trouvée", 404);
        }
        entity.modules.clear();
        entity.modules.addAll(modules);
        entity.modules.add(ModuleApplication.PARAMETRAGE);
        for (UserEntity user : UserEntity.<UserEntity>listAll()) {
            user.modules.retainAll(entity.modules);
        }
        initAbonnement(entity);
        return entity;
    }

    @PUT
    @Transactional
    public SocieteEntity update(SocieteEntity societe) {
        validerRelances(societe);
        if (societe.indemniteForfaitaire < 0) {
            throw new WebApplicationException("L'indemnité forfaitaire doit être positive", 400);
        }
        SocieteEntity entity = SocieteEntity.findById(1);
        if (entity == null) {
            throw new WebApplicationException("La société n'est pas trouvée", 404);
        }

        entity.nom = societe.nom;
        entity.siren = societe.siren;
        entity.siret = societe.siret;
        entity.ape = societe.ape;
        entity.rcs = societe.rcs;
        entity.forme = societe.forme;
        entity.capital = societe.capital;
        entity.numerotva = societe.numerotva;
        entity.adresse = societe.adresse;
        entity.telephone = societe.telephone;
        entity.email = societe.email;
        entity.bancaire = societe.bancaire;
        entity.banque = societe.banque;
        entity.iban = societe.iban;
        entity.bic = societe.bic;
        entity.images = societe.images;
        entity.conditionsPaiement = societe.conditionsPaiement;
        entity.penalitesRetard = societe.penalitesRetard;
        entity.indemniteForfaitaire = societe.indemniteForfaitaire;
        entity.relance1Jours = societe.relance1Jours;
        entity.relance2Jours = societe.relance2Jours;
        entity.relance3Jours = societe.relance3Jours;
        entity.stripePaymentLinkMensuel = societe.stripePaymentLinkMensuel;
        entity.stripePaymentLinkAnnuel = societe.stripePaymentLinkAnnuel;
        entity.payplugPaymentLinkMensuel = societe.payplugPaymentLinkMensuel;
        entity.payplugPaymentLinkAnnuel = societe.payplugPaymentLinkAnnuel;
        initAbonnement(entity);

        return entity;
    }

    @POST
    @Path("/paiement")
    @Transactional
    public SocieteEntity payer(PaiementRequest request) {
        if (request.type == null || (!request.type.equals("MENSUEL") && !request.type.equals("ANNUEL"))) {
            throw new WebApplicationException("Type de paiement invalide (MENSUEL ou ANNUEL attendu)", 400);
        }
        SocietePaiementEntity.Mode mode;
        try {
            mode = SocietePaiementEntity.Mode.valueOf(request.mode);
        } catch (Exception e) {
            throw new WebApplicationException("Mode de paiement invalide", 400);
        }
        if (request.signature == null || request.signature.isBlank()) {
            throw new WebApplicationException("La signature est requise", 400);
        }
        SocieteEntity entity = SocieteEntity.findById(1);
        if (entity == null) {
            throw new WebApplicationException("La société n'est pas trouvée", 404);
        }
        initAbonnement(entity);

        int mois = request.type.equals("ANNUEL") ? 12 : 1;
        double montant = request.type.equals("ANNUEL")
            ? entity.abonnementMontantAnnuel
            : entity.abonnementProchainPaiementMontant;

        entity.abonnementProchainPaiementDate = Timestamp.valueOf(
            entity.abonnementProchainPaiementDate.toLocalDateTime().plusMonths(mois));

        SocietePaiementEntity paiement = new SocietePaiementEntity();
        paiement.type = SocietePaiementEntity.Type.valueOf(request.type);
        paiement.montant = montant;
        paiement.mode = mode;
        paiement.date = Timestamp.from(Instant.now());
        paiement.nombreUtilisateurs = (int) entity.abonnementNombreUtilisateurs;
        paiement.nombreTechniciens = (int) entity.abonnementNombreTechniciens;
        paiement.nombreClients = (int) entity.abonnementNombreClients;
        paiement.modules.addAll(entity.modules);
        paiement.societe = entity;
        paiement.persist();
        entity.paiements.add(0, paiement);
        // La nouvelle échéance peut lever le blocage pour impayé.
        initAbonnement(entity);

        return entity;
    }

    @POST
    @Path("/resilier")
    @Transactional
    public SocieteEntity resilier() {
        SocieteEntity entity = SocieteEntity.findById(1);
        if (entity == null) {
            throw new WebApplicationException("La société n'est pas trouvée", 404);
        }
        if (entity.abonnementResilie) {
            throw new WebApplicationException("L'abonnement est déjà résilié", 400);
        }

        entity.abonnementResilie = true;
        entity.abonnementResiliationDate = Timestamp.from(Instant.now());
        initAbonnement(entity);

        return entity;
    }

    @POST
    @Path("/reactiver")
    @Transactional
    public SocieteEntity reactiver() {
        SocieteEntity entity = SocieteEntity.findById(1);
        if (entity == null) {
            throw new WebApplicationException("La société n'est pas trouvée", 404);
        }
        if (!entity.abonnementResilie) {
            throw new WebApplicationException("L'abonnement n'est pas résilié", 400);
        }

        entity.abonnementResilie = false;
        entity.abonnementResiliationDate = null;
        initAbonnement(entity);

        return entity;
    }

    /** Les délais de relance renseignés doivent être positifs et strictement croissants. */
    private static void validerRelances(SocieteEntity societe) {
        Integer[] delais = { societe.relance1Jours, societe.relance2Jours, societe.relance3Jours };
        Integer precedent = null;
        for (int i = 0; i < delais.length; i++) {
            Integer delai = delais[i];
            if (delai == null) {
                continue;
            }
            if (delai < 0) {
                throw new WebApplicationException("Le délai de la relance " + (i + 1) + " doit être positif", 400);
            }
            if (precedent != null && delai <= precedent) {
                throw new WebApplicationException(
                    "Le délai de la relance " + (i + 1) + " doit être supérieur à celui de la relance précédente", 400);
            }
            precedent = delai;
        }
    }

    /**
     * Modules souscrits par la société, Paramétrage compris. Un compte créé avant l'introduction
     * des modules (aucun module enregistré) les souscrit tous, comme son abonnement d'alors.
     */
    static Set<ModuleApplication> modulesSouscrits(SocieteEntity entity) {
        if (entity.modules.isEmpty()) {
            entity.modules.addAll(EnumSet.allOf(ModuleApplication.class));
        }
        entity.modules.add(ModuleApplication.PARAMETRAGE);
        return entity.modules;
    }

    /** Modules souscrits par la société ; tous si la société n'existe pas encore. */
    static Set<ModuleApplication> modulesSouscrits() {
        SocieteEntity entity = SocieteEntity.findById(1);
        return entity == null ? EnumSet.allOf(ModuleApplication.class) : modulesSouscrits(entity);
    }

    double prixModule(ModuleApplication module) {
        return config.getOptionalValue("abonnement.prix-module." + module.name().toLowerCase(Locale.ROOT), Double.class)
            .orElse(module.prixMensuelParDefaut);
    }

    /**
     * Renseigne, si nécessaire, les informations d'abonnement du compte :
     * date d'activation = date de création du compte, montant d'activation de 350 €,
     * prochaine échéance un mois plus tard. Le montant mensuel est recalculé à chaque fois : utilisateurs,
     * techniciens et clients ayant accès au portail, chacun à son prix, plus le prix des modules souscrits.
     */
    private void initAbonnement(SocieteEntity entity) {
        if (entity.dateCreation == null) {
            entity.dateCreation = Timestamp.from(Instant.now());
        }
        if (entity.abonnementActivationDate == null) {
            entity.abonnementActivationDate = entity.dateCreation;
        }
        if (entity.abonnementActivationMontant == null) {
            entity.abonnementActivationMontant = MONTANT_ACTIVATION;
        }
        if (entity.abonnementProchainPaiementDate == null) {
            entity.abonnementProchainPaiementDate = Timestamp.valueOf(
                entity.abonnementActivationDate.toLocalDateTime().plusMonths(1));
        }

        entity.abonnementNombreUtilisateurs = UserEntity.count();
        entity.abonnementNombreTechniciens = TechnicienEntity.count();
        entity.abonnementNombreClients = ClientEntity.count("motDePasse is not null and motDePasse <> ''");
        double montantMensuel = entity.abonnementNombreUtilisateurs * prixUtilisateur
            + entity.abonnementNombreTechniciens * prixTechnicien
            + entity.abonnementNombreClients * prixClient;
        for (ModuleApplication module : modulesSouscrits(entity)) {
            montantMensuel += prixModule(module);
        }
        entity.abonnementProchainPaiementMontant = arrondi(montantMensuel);
        entity.abonnementMontantAnnuel = arrondi(montantMensuel * MOIS_FACTURES_ANNUEL);

        entity.versionFree = versionFree();
        entity.abonnementBlocageDate = dateBlocageResiliation(entity);
        entity.accesBloque = depasse(entity.abonnementBlocageDate);
        Timestamp blocageImpaye = dateBlocageImpaye(entity);
        entity.abonnementBlocageImpayeDate = depasse(entity.abonnementProchainPaiementDate) ? blocageImpaye : null;
        entity.accesBloqueImpaye = depasse(blocageImpaye);
    }

    /** Version « Free » (propriété abonnement.free) : les accès ne sont jamais bloqués, ni pour impayé ni après résiliation. */
    static boolean versionFree() {
        return ConfigProvider.getConfig().getOptionalValue("abonnement.free", Boolean.class).orElse(false);
    }

    /** Fin de la période de rétractation après résiliation ; null si l'abonnement n'est pas résilié ou en version Free. */
    static Timestamp dateBlocageResiliation(SocieteEntity entity) {
        if (versionFree() || !entity.abonnementResilie || entity.abonnementResiliationDate == null) {
            return null;
        }
        return Timestamp.valueOf(entity.abonnementResiliationDate.toLocalDateTime().plusDays(DUREE_RETRACTATION_JOURS));
    }

    /** Échéance non réglée depuis {@link #DELAI_BLOCAGE_IMPAYE_MOIS} mois ; null sans échéance ou en version Free. */
    static Timestamp dateBlocageImpaye(SocieteEntity entity) {
        if (versionFree() || entity.abonnementProchainPaiementDate == null) {
            return null;
        }
        return Timestamp.valueOf(entity.abonnementProchainPaiementDate.toLocalDateTime().plusMonths(DELAI_BLOCAGE_IMPAYE_MOIS));
    }

    private static double arrondi(double montant) {
        return Math.round(montant * 100.0) / 100.0;
    }

    private static boolean depasse(Timestamp date) {
        return date != null && Timestamp.from(Instant.now()).after(date);
    }

    /**
     * Abonnement résilié depuis plus longtemps que le délai de rétractation
     * ({@link #DUREE_RETRACTATION_JOURS} jours) : plus aucune connexion n'est possible.
     */
    public static boolean accesBloqueParResiliation() {
        SocieteEntity entity = SocieteEntity.findById(1);
        return entity != null && depasse(dateBlocageResiliation(entity));
    }

    /**
     * Échéance impayée depuis {@link #DELAI_BLOCAGE_IMPAYE_MOIS} mois ou plus : seuls les utilisateurs
     * du module Paramétrage peuvent encore se connecter, pour régler les échéances en retard.
     */
    public static boolean accesBloqueParImpaye() {
        SocieteEntity entity = SocieteEntity.findById(1);
        return entity != null && depasse(dateBlocageImpaye(entity));
    }

    /**
     * Indique si les accès (login) doivent être bloqués, après résiliation ou pour impayé.
     * Utilisé par les points d'authentification des portails technicien et client.
     */
    public static boolean accesBloque() {
        return accesBloqueParResiliation() || accesBloqueParImpaye();
    }

}
