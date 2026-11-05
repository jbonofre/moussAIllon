package net.nanthrax.moussaillon.persistence;

import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.json.bind.annotation.JsonbTransient;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.sql.Timestamp;
import java.util.HashSet;
import java.util.Set;

@Entity
public class SocietePaiementEntity extends PanacheEntityChantier {

    // MODULES : modules ajoutés en cours de période, payés pour les mois déjà réglés.
    public enum Type { MENSUEL, ANNUEL, MODULES }

    public enum Mode { VIREMENT, CARTE, STRIPE, PAYPLUG }

    // En VARCHAR : un ENUM natif H2 refuserait les types ajoutés depuis la création de la colonne.
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    public Type type;

    public double montant;

    @Enumerated(EnumType.STRING)
    public Mode mode;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp date;

    // Frais d'activation compris dans le montant (premier paiement de l'abonnement).
    public Double montantActivation;

    // Période couverte : mois payés, ou mois auxquels les modules ajoutés sont payés.
    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp periodeDebut;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp periodeFin;

    // Base de calcul du montant au moment du paiement (reprise sur la facture d'abonnement).
    public Integer nombreUtilisateurs;

    public Integer nombreTechniciens;

    public Integer nombreClients;

    // Modules facturés (pour un ajout de modules : les modules ajoutés).
    @ElementCollection(fetch = FetchType.EAGER)
    @Enumerated(EnumType.STRING)
    public Set<ModuleApplication> modules = new HashSet<>();

    @ManyToOne
    @JsonbTransient
    public SocieteEntity societe;

}
