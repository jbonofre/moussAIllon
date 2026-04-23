package net.nanthrax.moussaillon.persistence;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.FetchType;

@Entity
public class VenteEntity extends PanacheEntity {

    public enum Status {
        DEVIS,
        FACTURE_EN_ATTENTE,
        FACTURE_PRETE,
        FACTURE_PAYEE
    }

    public Status status;

    public boolean bonPourAccord;

    public boolean ordreDeReparation;

    public boolean comptoir;

    @jakarta.persistence.Column(columnDefinition = "TEXT")
    public String signatureBonPourAccord;

    @ManyToOne
    public ClientEntity client;

    @ManyToOne
    public BateauClientEntity bateau;

    @ManyToOne
    public MoteurClientEntity moteur;

    @ManyToOne
    public RemorqueClientEntity remorque;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = jakarta.persistence.FetchType.EAGER)
    @JoinColumn(name = "vente_id")
    public List<VenteForfaitEntity> venteForfaits = new ArrayList<>();

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = jakarta.persistence.FetchType.EAGER)
    @JoinColumn(name = "vente_id")
    public List<VenteServiceEntity> venteServices = new ArrayList<>();

    @ManyToMany
    public List<ProduitCatalogueEntity> produits;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp date;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateDevis;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateBonPourAccord;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateFactureEnAttente;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateFacturePrete;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateFacturePayee;

    public double montantHT;

    public double remise;

    public double montantTTC;

    public double tva;

    public double montantTVA;

    public double prixVenteTTC;

    public enum ModePaiement {
        CHEQUE,
        VIREMENT,
        CARTE,
        ESPÈCES,
    }

    public ModePaiement modePaiement;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JoinColumn(name = "vente_paiement_vente_id")
    public List<VentePaiementEntity> paiements = new ArrayList<>();

    public List<String> images = new ArrayList<>();

    public List<String> documents = new ArrayList<>();

    public boolean stockDecremented;

    // Configuration des rappels (en jours avant la date de la vente)
    public Integer rappel1Jours;
    public Integer rappel2Jours;
    public Integer rappel3Jours;

    // Suivi des rappels envoyes
    public boolean rappel1Envoye;
    public boolean rappel2Envoye;
    public boolean rappel3Envoye;

}
