package net.nanthrax.moussaillon.persistence;

import io.quarkus.panache.common.Sort;
import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.persistence.*;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@EntityListeners(FormatNomListener.class)
public class SocieteEntity extends PanacheEntityChantier {

    @Column(nullable = false)
    @FormatNom
    public String nom;

    @Column(nullable = false)
    public String siren;

    public String siret;

    public String ape;

    public String rcs;

    public String forme;

    public int capital;

    public String numerotva;

    @Column(nullable = false)
    @FormatNom
    public String adresse;

    public String telephone;

    public String email;

    public String bancaire;

    public String banque;

    public String iban;

    public String bic;

    public List<String> images = new ArrayList<>();

    // Conditions de paiement communes à toutes les ventes, recopiées sur chaque vente
    // jusqu'à l'émission de sa facture (une facture émise garde celles en vigueur à son émission).
    public String conditionsPaiement;

    public String penalitesRetard;

    @Column(columnDefinition = "double default 40.0")
    public double indemniteForfaitaire = 40.0;

    // Relances de paiement automatiques, communes à toutes les transactions :
    // nombre de jours écoulés depuis l'échéance (ou la date de facture à défaut). Vide = relance désactivée.
    public Integer relance1Jours;
    public Integer relance2Jours;
    public Integer relance3Jours;

    // Relance de paiement 3 envoyée par courrier (mise en demeure à imprimer) plutôt que par email.
    @Column(columnDefinition = "boolean default false")
    public boolean relance3Courrier;

    // Relances automatiques des devis/OR en attente de signature : nombre de jours écoulés depuis le devis.
    // Vide = relance désactivée.
    public Integer relanceDevis1Jours;
    public Integer relanceDevis2Jours;
    public Integer relanceDevis3Jours;

    // Relances (paiement et devis) envoyées automatiquement chaque matin, ou à valider dans le journal des relances.
    @Column(columnDefinition = "boolean default false")
    public boolean relancesAutomatiques;

    // Date de création du compte.
    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateCreation;

    // Abonnement (informations en lecture seule, gérées par le serveur).
    // Activation : date du premier paiement (frais d'activation et premier mois ou première année) ;
    // vide tant que l'abonnement n'est pas activé.
    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp abonnementActivationDate;

    public Double abonnementActivationMontant;

    // Prochaine échéance : début du premier mois non payé (les mois sont comptés depuis l'activation),
    // et prix mensuel en vigueur.
    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp abonnementProchainPaiementDate;

    public Double abonnementProchainPaiementMontant;

    // Modules souscrits par la société : le prix de l'abonnement en dépend, ainsi que du nombre d'utilisateurs.
    @ElementCollection(fetch = FetchType.EAGER)
    @Enumerated(EnumType.STRING)
    public Set<ModuleApplication> modules = new HashSet<>();

    // Champs calculés (non persistés) détaillant le prix de l'abonnement.
    @Transient
    public long abonnementNombreUtilisateurs;

    @Transient
    public long abonnementNombreTechniciens;

    // Clients ayant accès au portail client (mot de passe renseigné).
    @Transient
    public long abonnementNombreClients;

    @Transient
    public Double abonnementMontantAnnuel;

    // Résiliation de l'abonnement par l'administrateur.
    public boolean abonnementResilie = false;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp abonnementResiliationDate;

    // Champs calculés (non persistés) informant le client de la date à partir de laquelle
    // les accès seront bloqués après résiliation, une fois la période de rétractation passée.
    @Transient
    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp abonnementBlocageDate;

    @Transient
    public boolean accesBloque;

    // Échéance impayée : date (échéance + 2 mois) à partir de laquelle l'accès est limité à la
    // facturation, renseignée dès que l'échéance est dépassée.
    @Transient
    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp abonnementBlocageImpayeDate;

    @Transient
    public boolean accesBloqueImpaye;

    // Abonnement gratuit, accordé par l'administrateur au chantier : les accès ne sont jamais bloqués.
    @Transient
    public boolean versionFree;

    // Période d'essai gratuite du chantier (voir ChantierEntity.essaiFin) : sa fin, et si elle est en cours
    // (abonnement pas encore activé).
    @Transient
    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp essaiFin;

    @Transient
    public boolean enEssai;

    // Champs calculés (non persistés) du suivi de l'abonnement mois par mois.
    // Abonnement activé (frais d'activation payés).
    @Transient
    public boolean abonnementActif;

    // Mois en cours payé.
    @Transient
    public boolean abonnementAJour;

    // Mois payés non terminés (mois en cours compris) : un module ajouté y est payé tout de suite.
    @Transient
    public int abonnementMoisPayesRestants;

    // Abonnement non activé, ou échéance impayée depuis 2 mois ou plus (hors version Free) :
    // l'accès est limité à la facturation, pour les utilisateurs du module Paramétrage.
    @Transient
    public boolean accesLimiteFacturation;

    // Mois d'abonnement, du plus récent au plus ancien : mois payés (y compris à venir) et mois à payer.
    @Transient
    public List<SocieteAbonnementMoisEntity> abonnementMois = new ArrayList<>();

    @OneToMany(mappedBy = "societe", cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    @OrderBy("date DESC")
    public List<SocietePaiementEntity> paiements = new ArrayList<>();

    // Liens de paiement externe (Stripe / PayPlug) configurables par l'administrateur.
    public String stripePaymentLinkMensuel;
    public String stripePaymentLinkAnnuel;
    public String payplugPaymentLinkMensuel;
    public String payplugPaymentLinkAnnuel;

    /** Société du chantier courant (une par chantier), ou null s'il n'y en a pas encore. */
    public static SocieteEntity courante() {
        return SocieteEntity.<SocieteEntity>findAll(Sort.ascending("id")).firstResult();
    }

}
