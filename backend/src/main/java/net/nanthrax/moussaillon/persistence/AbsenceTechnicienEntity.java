package net.nanthrax.moussaillon.persistence;

import java.time.LocalDate;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.json.bind.annotation.JsonbTransient;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.ManyToOne;

/**
 * Absence d'un technicien (congés, maladie, formation...), du premier au dernier jour inclus : ses jours travaillés
 * sont déduits de sa capacité de travail (KPIs atelier).
 */
@Entity
public class AbsenceTechnicienEntity extends PanacheEntity {

    public enum Type {
        CONGES,
        MALADIE,
        FORMATION,
        AUTRE
    }

    @ManyToOne(optional = false)
    @JsonbTransient
    public TechnicienEntity technicien;

    public LocalDate dateDebut;

    public LocalDate dateFin;

    @Enumerated(EnumType.STRING)
    public Type type;

    public String motif;

}
