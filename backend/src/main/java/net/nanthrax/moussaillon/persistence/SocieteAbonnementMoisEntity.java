package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.json.bind.annotation.JsonbTransient;
import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.sql.Timestamp;
import java.util.HashSet;
import java.util.Set;

/**
 * Mois d'abonnement payé : période d'un mois (à partir de la date d'activation), base de calcul
 * (utilisateurs, techniciens, clients du portail, modules) et part du paiement qui le couvre.
 * Les mois à payer ne sont pas enregistrés : ils sont calculés au prix en vigueur.
 */
@Entity
public class SocieteAbonnementMoisEntity extends PanacheEntity {

    public enum Statut { PAYE, A_PAYER, IMPAYE }

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp debut;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp fin;

    // Part du paiement (mensuel ou annuel) affectée au mois, plus les modules ajoutés en cours de mois.
    public double montant;

    public Integer nombreUtilisateurs;

    public Integer nombreTechniciens;

    public Integer nombreClients;

    @ElementCollection(fetch = FetchType.EAGER)
    @Enumerated(EnumType.STRING)
    public Set<ModuleApplication> modules = new HashSet<>();

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp payeLe;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    public SocietePaiementEntity.Type typePaiement;

    @ManyToOne
    @JsonbTransient
    public SocieteEntity societe;

    // Calculé : payé, à payer (mois en cours) ou impayé (mois échu).
    @Transient
    public Statut statut = Statut.PAYE;

}
