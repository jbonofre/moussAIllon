package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.json.bind.annotation.JsonbTransient;
import jakarta.persistence.*;

import java.sql.Timestamp;

@Entity
public class SocietePaiementEntity extends PanacheEntity {

    public enum Type { MENSUEL, ANNUEL }

    public enum Mode { VIREMENT, CARTE, STRIPE, PAYPLUG }

    @Enumerated(EnumType.STRING)
    public Type type;

    public double montant;

    @Enumerated(EnumType.STRING)
    public Mode mode;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp date;

    @ManyToOne
    @JsonbTransient
    public SocieteEntity societe;

}
