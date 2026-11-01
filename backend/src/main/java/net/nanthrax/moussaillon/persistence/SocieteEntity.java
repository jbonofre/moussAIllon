package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.persistence.*;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

@Entity
public class SocieteEntity extends PanacheEntity {

    @Column(nullable = false)
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

    // Date de création du compte (sert de date d'activation de l'abonnement).
    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateCreation;

    // Abonnement (informations en lecture seule, gérées par le serveur).
    // Paiement « one-shot » d'activation du compte.
    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp abonnementActivationDate;

    public Double abonnementActivationMontant;

    // Prochaine échéance (date prévue et valeur à payer).
    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp abonnementProchainPaiementDate;

    public Double abonnementProchainPaiementMontant;

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

    @OneToMany(mappedBy = "societe", cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    @OrderBy("date DESC")
    public List<SocietePaiementEntity> paiements = new ArrayList<>();

    // Liens de paiement externe (Stripe / PayPlug) configurables par l'administrateur.
    public String stripePaymentLinkMensuel;
    public String stripePaymentLinkAnnuel;
    public String payplugPaymentLinkMensuel;
    public String payplugPaymentLinkAnnuel;

}
