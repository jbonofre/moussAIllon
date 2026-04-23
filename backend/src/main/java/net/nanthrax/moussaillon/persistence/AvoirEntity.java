package net.nanthrax.moussaillon.persistence;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;

@Entity
public class AvoirEntity extends PanacheEntity {

    public enum Status {
        BROUILLON,
        EMIS,
        REMBOURSE,
        ANNULE
    }

    public enum ModeRemboursement {
        CHEQUE,
        VIREMENT,
        CARTE,
        ESPÈCES
    }

    @Enumerated(EnumType.STRING)
    public Status status = Status.BROUILLON;

    @ManyToOne
    public ClientEntity client;

    @ManyToOne
    public VenteEntity vente;

    @Column(length = 1000)
    public String motif;

    @Column(length = 2000)
    public String notes;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateCreation;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateEmission;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateRemboursement;

    public double montantHT;

    public double tva;

    public double montantTVA;

    public double montantTTC;

    @Enumerated(EnumType.STRING)
    public ModeRemboursement modeRemboursement;

    public double montantUtilise;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = jakarta.persistence.FetchType.EAGER)
    @JoinColumn(name = "avoir_id")
    public List<AvoirLigneEntity> lignes = new ArrayList<>();

}
