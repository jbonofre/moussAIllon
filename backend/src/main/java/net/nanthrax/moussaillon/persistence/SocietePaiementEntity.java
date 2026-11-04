package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.json.bind.annotation.JsonbTransient;
import jakarta.persistence.*;

import java.sql.Timestamp;
import java.util.HashSet;
import java.util.Set;

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

    // Base de calcul du montant au moment du paiement (reprise sur la facture d'abonnement).
    public Integer nombreUtilisateurs;

    @ElementCollection(fetch = FetchType.EAGER)
    @Enumerated(EnumType.STRING)
    public Set<ModuleApplication> modules = new HashSet<>();

    @ManyToOne
    @JsonbTransient
    public SocieteEntity societe;

}
