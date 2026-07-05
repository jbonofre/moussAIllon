package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;

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

    public List<String> images = new ArrayList<>();

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

}
