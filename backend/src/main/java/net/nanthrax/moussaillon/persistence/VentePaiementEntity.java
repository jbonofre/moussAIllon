package net.nanthrax.moussaillon.persistence;

import java.sql.Timestamp;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.json.bind.annotation.JsonbProperty;
import jakarta.json.bind.annotation.JsonbTransient;
import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.ManyToOne;

@Entity
public class VentePaiementEntity extends PanacheEntity {

    public enum Mode {
        CHEQUE,
        VIREMENT,
        CARTE,
        ESPÈCES,
        AVOIR
    }

    @Enumerated(EnumType.STRING)
    public Mode mode;

    public double montant;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp date;

    public String notes;

    @ManyToOne
    @JsonbTransient
    public AvoirEntity avoir;

    @JsonbProperty("avoirId")
    public Long getAvoirId() {
        return avoir != null ? avoir.id : null;
    }

    @JsonbProperty("avoirMotif")
    public String getAvoirMotif() {
        return avoir != null ? avoir.motif : null;
    }

    @JsonbProperty("avoirMontantTTC")
    public Double getAvoirMontantTTC() {
        return avoir != null ? avoir.montantTTC : null;
    }

    @JsonbProperty("avoirMontantUtilise")
    public Double getAvoirMontantUtilise() {
        return avoir != null ? avoir.montantUtilise : null;
    }

}
