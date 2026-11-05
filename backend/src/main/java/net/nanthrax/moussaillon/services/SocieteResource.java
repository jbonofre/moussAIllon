package net.nanthrax.moussaillon.services;

import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.ClientEntity;
import net.nanthrax.moussaillon.persistence.ModuleApplication;
import net.nanthrax.moussaillon.persistence.SocieteAbonnementMoisEntity;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import net.nanthrax.moussaillon.persistence.SocietePaiementEntity;
import net.nanthrax.moussaillon.persistence.TechnicienEntity;
import net.nanthrax.moussaillon.persistence.UserEntity;
import org.eclipse.microprofile.config.Config;
import org.eclipse.microprofile.config.ConfigProvider;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
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
        public String type; // MENSUEL | ANNUEL | MODULES
        public String mode; // STRIPE | PAYPLUG
        // Ajout de modules : modules souscrits demandés, dont les modules ajoutés sont payés.
        public Set<ModuleApplication> modules;
    }

    public static class PaiementRequest {
        public String type; // MENSUEL | ANNUEL | MODULES
        public String mode; // VIREMENT | CARTE | STRIPE | PAYPLUG
        public String signature;
        // Ajout de modules : modules souscrits demandés, dont les modules ajoutés sont payés.
        public Set<ModuleApplication> modules;
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
     * Crée un paiement en ligne (Stripe ou PayPlug) au montant à payer (échéance, activation comprise, ou ajout
     * de modules) et renvoie l'URL de sa page de paiement. Sans clé API de l'éditeur, le lien de paiement fixe
     * de la société est renvoyé s'il existe (pas pour un ajout de modules) : son montant ne suit alors pas le
     * prix calculé.
     */
    @POST
    @Path("/paiement/en-ligne")
    @Transactional
    public Map<String, String> paiementEnLigne(PaiementEnLigneRequest request) {
        SocietePaiementEntity.Type type = typePaiement(request == null ? null : request.type);
        boolean annuel = type == SocietePaiementEntity.Type.ANNUEL;
        SocieteEntity entity = SocieteEntity.findById(1);
        if (entity == null) {
            throw new WebApplicationException("La société n'est pas trouvée", 404);
        }
        if (entity.abonnementResilie) {
            throw new WebApplicationException("L'abonnement est résilié", 400);
        }
        initAbonnement(entity);
        long montantCentimes = Math.round(montantAPayer(entity, type, request.modules) * 100);
        String objet = switch (type) {
            case MENSUEL -> "mensuel";
            case ANNUEL -> "annuel";
            case MODULES -> "ajout de modules";
        };
        if (type != SocietePaiementEntity.Type.MODULES && !entity.abonnementActif) {
            objet += " (activation comprise)";
        }
        String designation = "Abonnement moussAIllon " + objet + " - " + entity.nom;
        boolean lienFixe = type != SocietePaiementEntity.Type.MODULES;

        String url;
        try {
            if ("STRIPE".equals(request.mode)) {
                url = abonnementStripeApiKey.isPresent()
                    ? PaymentResource.creerSessionStripe(abonnementStripeApiKey.get(), montantCentimes, designation,
                        abonnementPaiementRetourUrl, abonnementPaiementRetourUrl)
                    : !lienFixe ? null : (annuel ? entity.stripePaymentLinkAnnuel : entity.stripePaymentLinkMensuel);
            } else if ("PAYPLUG".equals(request.mode)) {
                url = abonnementPayplugApiKey.isPresent()
                    ? PaymentResource.creerPaiementPayplug(abonnementPayplugApiKey.get(), montantCentimes, entity.email, entity.nom,
                        abonnementPaiementRetourUrl, abonnementPaiementRetourUrl)
                    : !lienFixe ? null : (annuel ? entity.payplugPaymentLinkAnnuel : entity.payplugPaymentLinkMensuel);
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
     * perdent l'accès aux modules qui ne sont plus souscrits. Une fois l'abonnement activé, un module
     * ajouté est payé tout de suite (paiement de type MODULES) : il n'est enregistré ici que s'il n'y a
     * rien à payer (module déjà payé pour les mois en cours, version Free).
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
        initAbonnement(entity);
        Set<ModuleApplication> ajouts = modulesAjoutes(entity, modules);
        if (!ajouts.isEmpty() && !versionFree() && entity.abonnementActif) {
            if (!entity.abonnementAJour) {
                throw requeteInvalide("Réglez d'abord les échéances en retard pour ajouter des modules.");
            }
            if (complementModules(entity, ajouts) > 0) {
                throw requeteInvalide("Les modules ajoutés doivent être payés tout de suite.");
            }
        }
        appliquerModules(entity, modules);
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
        entity.relance3Courrier = societe.relance3Courrier;
        entity.relanceDevis1Jours = societe.relanceDevis1Jours;
        entity.relanceDevis2Jours = societe.relanceDevis2Jours;
        entity.relanceDevis3Jours = societe.relanceDevis3Jours;
        entity.relancesAutomatiques = societe.relancesAutomatiques;
        entity.stripePaymentLinkMensuel = societe.stripePaymentLinkMensuel;
        entity.stripePaymentLinkAnnuel = societe.stripePaymentLinkAnnuel;
        entity.payplugPaymentLinkMensuel = societe.payplugPaymentLinkMensuel;
        entity.payplugPaymentLinkAnnuel = societe.payplugPaymentLinkAnnuel;
        initAbonnement(entity);

        return entity;
    }

    /**
     * Enregistre un paiement : le mois suivant non payé (MENSUEL) ou les 12 suivants (ANNUEL), frais d'activation
     * compris si l'abonnement n'est pas encore activé, ou les modules ajoutés (MODULES), payés pour chaque mois
     * déjà réglé non terminé.
     */
    @POST
    @Path("/paiement")
    @Transactional
    public SocieteEntity payer(PaiementRequest request) {
        SocietePaiementEntity.Type type = typePaiement(request == null ? null : request.type);
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
        if (type == SocietePaiementEntity.Type.MODULES) {
            payerModules(entity, request.modules, mode);
        } else {
            payerMois(entity, type, mode);
        }
        // L'activation ou la nouvelle échéance peut lever la limitation de l'accès à la facturation.
        initAbonnement(entity);

        return entity;
    }

    private static SocietePaiementEntity.Type typePaiement(String type) {
        try {
            return SocietePaiementEntity.Type.valueOf(type);
        } catch (Exception e) {
            throw new WebApplicationException("Type de paiement invalide (MENSUEL, ANNUEL ou MODULES attendu)", 400);
        }
    }

    /** Montant du paiement demandé ; refuse un ajout de modules qui ne peut pas être payé. */
    private double montantAPayer(SocieteEntity entity, SocietePaiementEntity.Type type, Set<ModuleApplication> modules) {
        return switch (type) {
            case MODULES -> arrondi(complementModules(entity, ajoutsAPayer(entity, modules)));
            case ANNUEL -> arrondi(entity.abonnementMontantAnnuel + fraisActivationDus(entity));
            case MENSUEL -> arrondi(entity.abonnementProchainPaiementMontant + fraisActivationDus(entity));
        };
    }

    /** Frais d'activation, dus avec le premier paiement de l'abonnement. */
    private static double fraisActivationDus(SocieteEntity entity) {
        return entity.abonnementActif ? 0 : entity.abonnementActivationMontant;
    }

    /**
     * Paie le mois suivant non payé, ou les 12 suivants au prix annuel. Le premier paiement active
     * l'abonnement, qui démarre ce jour-là, et comprend les frais d'activation.
     */
    private void payerMois(SocieteEntity entity, SocietePaiementEntity.Type type, SocietePaiementEntity.Mode mode) {
        boolean annuel = type == SocietePaiementEntity.Type.ANNUEL;
        int nombreMois = annuel ? 12 : 1;
        double montant = annuel ? entity.abonnementMontantAnnuel : entity.abonnementProchainPaiementMontant;
        double activation = fraisActivationDus(entity);
        Timestamp maintenant = horodatage();
        if (!entity.abonnementActif) {
            entity.abonnementActivationDate = maintenant;
            entity.abonnementProchainPaiementDate = maintenant;
        }
        Timestamp debut = entity.abonnementProchainPaiementDate;
        Timestamp fin = plusMois(debut, nombreMois);

        SocietePaiementEntity paiement = nouveauPaiement(entity, type, mode, maintenant);
        paiement.montant = arrondi(montant + activation);
        paiement.montantActivation = activation > 0 ? activation : null;
        paiement.periodeDebut = debut;
        paiement.periodeFin = fin;
        paiement.modules.addAll(entity.modules);
        paiement.persist();
        entity.paiements.add(0, paiement);

        // Chaque mois payé est suivi, avec la part du paiement qui lui revient.
        double part = arrondi(montant / nombreMois);
        for (int i = 0; i < nombreMois; i++) {
            SocieteAbonnementMoisEntity mois = nouveauMois(entity, plusMois(debut, i));
            mois.montant = i < nombreMois - 1 ? part : arrondi(montant - part * (nombreMois - 1));
            mois.payeLe = maintenant;
            mois.typePaiement = type;
            mois.societe = entity;
            mois.persist();
        }
        entity.abonnementProchainPaiementDate = fin;
    }

    /**
     * Paie les modules ajoutés au prix d'un mois entier pour chaque mois payé non terminé (mois en cours
     * compris), puis enregistre les modules souscrits demandés.
     */
    private void payerModules(SocieteEntity entity, Set<ModuleApplication> modules, SocietePaiementEntity.Mode mode) {
        Set<ModuleApplication> ajouts = ajoutsAPayer(entity, modules);
        List<SocieteAbonnementMoisEntity> moisPayes = moisPayesRestants(entity);
        SocietePaiementEntity paiement = nouveauPaiement(entity, SocietePaiementEntity.Type.MODULES, mode, horodatage());
        double montant = 0;
        for (SocieteAbonnementMoisEntity mois : moisPayes) {
            double supplement = supplementModules(mois, ajouts);
            mois.montant = arrondi(mois.montant + supplement);
            mois.modules.addAll(ajouts);
            montant += supplement;
        }
        paiement.montant = arrondi(montant);
        paiement.periodeDebut = moisPayes.get(0).debut;
        paiement.periodeFin = moisPayes.get(moisPayes.size() - 1).fin;
        paiement.modules.addAll(ajouts);
        paiement.persist();
        entity.paiements.add(0, paiement);
        appliquerModules(entity, modules);
    }

    /** Modules ajoutés à payer tout de suite ; refuse l'ajout s'il ne peut pas être payé ou s'il n'y a rien à payer. */
    private Set<ModuleApplication> ajoutsAPayer(SocieteEntity entity, Set<ModuleApplication> modules) {
        if (modules == null) {
            throw new WebApplicationException("Les modules souscrits sont requis", 400);
        }
        if (entity.abonnementResilie) {
            throw requeteInvalide("L'abonnement est résilié.");
        }
        if (!entity.abonnementActif) {
            throw requeteInvalide("L'abonnement n'est pas activé : les modules sont payés avec l'activation.");
        }
        if (!entity.abonnementAJour) {
            throw requeteInvalide("Réglez d'abord les échéances en retard pour ajouter des modules.");
        }
        Set<ModuleApplication> ajouts = modulesAjoutes(entity, modules);
        if (complementModules(entity, ajouts) <= 0) {
            throw requeteInvalide("Aucun module ajouté à payer.");
        }
        return ajouts;
    }

    /** Requête refusée, avec sa raison en texte (affichée par la facturation). */
    private static WebApplicationException requeteInvalide(String message) {
        return new WebApplicationException(Response.status(Response.Status.BAD_REQUEST)
            .entity(message).type(MediaType.TEXT_PLAIN + ";charset=UTF-8").build());
    }

    /** Modules demandés qui ne sont pas encore souscrits. */
    private static Set<ModuleApplication> modulesAjoutes(SocieteEntity entity, Set<ModuleApplication> modules) {
        Set<ModuleApplication> ajouts = EnumSet.noneOf(ModuleApplication.class);
        ajouts.addAll(modules);
        ajouts.removeAll(modulesSouscrits(entity));
        return ajouts;
    }

    /** Prix des modules ajoutés pour les mois payés non terminés qui ne les comprennent pas déjà. */
    private double complementModules(SocieteEntity entity, Set<ModuleApplication> ajouts) {
        double complement = 0;
        for (SocieteAbonnementMoisEntity mois : moisPayesRestants(entity)) {
            complement += supplementModules(mois, ajouts);
        }
        return complement;
    }

    private double supplementModules(SocieteAbonnementMoisEntity mois, Set<ModuleApplication> ajouts) {
        double supplement = 0;
        for (ModuleApplication module : ajouts) {
            if (!mois.modules.contains(module)) {
                supplement += prixModule(module);
            }
        }
        return supplement;
    }

    /** Mois payés non terminés (mois en cours compris), du plus ancien au plus récent. */
    private static List<SocieteAbonnementMoisEntity> moisPayesRestants(SocieteEntity entity) {
        return SocieteAbonnementMoisEntity.list("societe = ?1 and fin > ?2", Sort.ascending("debut"), entity, Timestamp.from(Instant.now()));
    }

    private static void appliquerModules(SocieteEntity entity, Set<ModuleApplication> modules) {
        entity.modules.clear();
        entity.modules.addAll(modules);
        entity.modules.add(ModuleApplication.PARAMETRAGE);
        for (UserEntity user : UserEntity.<UserEntity>listAll()) {
            user.modules.retainAll(entity.modules);
        }
    }

    private static SocietePaiementEntity nouveauPaiement(SocieteEntity entity, SocietePaiementEntity.Type type,
                                                         SocietePaiementEntity.Mode mode, Timestamp date) {
        SocietePaiementEntity paiement = new SocietePaiementEntity();
        paiement.type = type;
        paiement.mode = mode;
        paiement.date = date;
        paiement.nombreUtilisateurs = (int) entity.abonnementNombreUtilisateurs;
        paiement.nombreTechniciens = (int) entity.abonnementNombreTechniciens;
        paiement.nombreClients = (int) entity.abonnementNombreClients;
        paiement.societe = entity;
        return paiement;
    }

    /** Mois commençant à la date donnée, sur la base de calcul en vigueur (effectifs et modules souscrits). */
    private static SocieteAbonnementMoisEntity nouveauMois(SocieteEntity entity, Timestamp debut) {
        SocieteAbonnementMoisEntity mois = new SocieteAbonnementMoisEntity();
        mois.debut = debut;
        mois.fin = plusMois(debut, 1);
        mois.nombreUtilisateurs = (int) entity.abonnementNombreUtilisateurs;
        mois.nombreTechniciens = (int) entity.abonnementNombreTechniciens;
        mois.nombreClients = (int) entity.abonnementNombreClients;
        mois.modules.addAll(modulesSouscrits(entity));
        return mois;
    }

    /**
     * Date enregistrée, à la milliseconde : l'horloge peut donner des nanosecondes (Linux), que la base ne garde
     * pas. Sans cela, la date renvoyée juste après l'enregistrement différerait de celle relue ensuite.
     */
    static Timestamp horodatage() {
        return Timestamp.from(Instant.now().truncatedTo(ChronoUnit.MILLIS));
    }

    static Timestamp plusMois(Timestamp date, int mois) {
        return Timestamp.valueOf(date.toLocalDateTime().plusMonths(mois));
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
        entity.abonnementResiliationDate = horodatage();
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
        validerDelais("la relance", societe.relance1Jours, societe.relance2Jours, societe.relance3Jours);
        validerDelais("la relance de devis", societe.relanceDevis1Jours, societe.relanceDevis2Jours, societe.relanceDevis3Jours);
    }

    private static void validerDelais(String relance, Integer... delais) {
        Integer precedent = null;
        for (int i = 0; i < delais.length; i++) {
            Integer delai = delais[i];
            if (delai == null) {
                continue;
            }
            if (delai < 0) {
                throw new WebApplicationException("Le délai de " + relance + " " + (i + 1) + " doit être positif", 400);
            }
            if (precedent != null && delai <= precedent) {
                throw new WebApplicationException(
                    "Le délai de " + relance + " " + (i + 1) + " doit être supérieur à celui de la relance précédente", 400);
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
     * Calcule les informations d'abonnement du compte : montant d'activation de 350 €, et le montant mensuel,
     * recalculé à chaque fois (utilisateurs, techniciens et clients ayant accès au portail, chacun à son prix,
     * plus le prix des modules souscrits), état de l'abonnement et suivi mois par mois.
     */
    private void initAbonnement(SocieteEntity entity) {
        if (entity.dateCreation == null) {
            entity.dateCreation = horodatage();
        }
        if (entity.abonnementActivationMontant == null) {
            entity.abonnementActivationMontant = MONTANT_ACTIVATION;
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
        entity.abonnementActif = entity.abonnementActivationDate != null;
        entity.abonnementAJour = entity.abonnementActif && entity.abonnementProchainPaiementDate != null
            && entity.abonnementProchainPaiementDate.after(Timestamp.from(Instant.now()));
        entity.abonnementBlocageDate = dateBlocageResiliation(entity);
        entity.accesBloque = depasse(entity.abonnementBlocageDate);
        Timestamp blocageImpaye = dateBlocageImpaye(entity);
        entity.abonnementBlocageImpayeDate = depasse(entity.abonnementProchainPaiementDate) ? blocageImpaye : null;
        entity.accesBloqueImpaye = depasse(blocageImpaye);
        entity.accesLimiteFacturation = motifLimitationFacturation(entity) != null;
        suivreMois(entity);
    }

    /**
     * Mois d'abonnement, du plus récent au plus ancien : les mois à payer jusqu'au mois en cours (au prix en
     * vigueur), puis les mois payés, y compris ceux à venir.
     */
    private static void suivreMois(SocieteEntity entity) {
        Timestamp maintenant = Timestamp.from(Instant.now());
        entity.abonnementMois = new ArrayList<>();
        if (entity.abonnementActif) {
            for (Timestamp debut = entity.abonnementProchainPaiementDate; debut != null && !debut.after(maintenant); debut = plusMois(debut, 1)) {
                SocieteAbonnementMoisEntity mois = nouveauMois(entity, debut);
                mois.montant = entity.abonnementProchainPaiementMontant;
                mois.statut = mois.fin.after(maintenant) ? SocieteAbonnementMoisEntity.Statut.A_PAYER : SocieteAbonnementMoisEntity.Statut.IMPAYE;
                entity.abonnementMois.add(0, mois);
            }
        }
        List<SocieteAbonnementMoisEntity> payes = SocieteAbonnementMoisEntity.list("societe = ?1", Sort.descending("debut"), entity);
        entity.abonnementMois.addAll(payes);
        entity.abonnementMoisPayesRestants = (int) payes.stream().filter(mois -> mois.fin.after(maintenant)).count();
    }

    /**
     * Version « Free » (propriété abonnement.free) : les accès ne sont jamais bloqués, ni sans abonnement activé,
     * ni pour impayé, ni après résiliation.
     */
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

    /** Échéance non réglée depuis {@link #DELAI_BLOCAGE_IMPAYE_MOIS} mois ; null sans abonnement activé ou en version Free. */
    static Timestamp dateBlocageImpaye(SocieteEntity entity) {
        if (versionFree() || entity.abonnementActivationDate == null || entity.abonnementProchainPaiementDate == null) {
            return null;
        }
        return Timestamp.valueOf(entity.abonnementProchainPaiementDate.toLocalDateTime().plusMonths(DELAI_BLOCAGE_IMPAYE_MOIS));
    }

    static double arrondi(double montant) {
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
     * Motif pour lequel l'accès est limité à la facturation, ou null : abonnement non activé, ou échéance
     * impayée depuis {@link #DELAI_BLOCAGE_IMPAYE_MOIS} mois ou plus (hors version Free). Seuls les
     * utilisateurs du module Paramétrage peuvent alors se connecter, pour activer l'abonnement ou régler
     * les échéances en retard.
     */
    static String motifLimitationFacturation(SocieteEntity entity) {
        if (versionFree()) {
            return null;
        }
        if (entity.abonnementActivationDate == null) {
            return "l'abonnement n'est pas activé";
        }
        if (depasse(dateBlocageImpaye(entity))) {
            return "l'abonnement est impayé depuis " + DELAI_BLOCAGE_IMPAYE_MOIS + " mois ou plus";
        }
        return null;
    }

    public static String motifLimitationFacturation() {
        SocieteEntity entity = SocieteEntity.findById(1);
        return entity == null ? null : motifLimitationFacturation(entity);
    }

    /** L'abonnement a été activé (frais d'activation payés). */
    public static boolean abonnementActif() {
        SocieteEntity entity = SocieteEntity.findById(1);
        return entity == null || entity.abonnementActivationDate != null;
    }

    /**
     * Indique si les accès (login) doivent être bloqués : après résiliation, abonnement non activé ou impayé.
     * Utilisé par les points d'authentification des portails technicien et client.
     */
    public static boolean accesBloque() {
        return accesBloqueParResiliation() || motifLimitationFacturation() != null;
    }

}
