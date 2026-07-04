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

    // Abonnement : paiement « one-shot » d'activation du compte.
    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp abonnementActivationDate;

    public Double abonnementActivationMontant;

    // Abonnement : prochaine échéance (date prévue et valeur à payer).
    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp abonnementProchainPaiementDate;

    public Double abonnementProchainPaiementMontant;

}
