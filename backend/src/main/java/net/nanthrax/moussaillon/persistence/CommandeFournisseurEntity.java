package net.nanthrax.moussaillon.persistence;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;

@Entity
public class CommandeFournisseurEntity extends PanacheEntity {

    public enum Status {
        BROUILLON,
        EN_ATTENTE,
        CONFIRMEE,
        EXPEDIEE,
        RECUE,
        ANNULEE
    }

    @Enumerated(EnumType.STRING)
    public Status status;

    @ManyToOne
    public FournisseurEntity fournisseur;

    @ManyToOne
    @JsonbTypeAdapter(VenteSummaryAdapter.class)
    public VenteEntity vente;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp date;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateReception;

    public String reference;

    public String referenceFournisseur;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "commandeFournisseur_id")
    public List<CommandeFournisseurLigneEntity> lignes = new ArrayList<>();

    public double montantHT;

    public double tva;

    public double montantTVA;

    public double montantTTC;

    public double portTotal;

    public String notes;

    public boolean stockIncremented;

}
