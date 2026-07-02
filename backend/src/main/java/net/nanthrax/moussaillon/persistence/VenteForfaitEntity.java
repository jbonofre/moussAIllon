package net.nanthrax.moussaillon.persistence;

import java.sql.Date;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;

@Entity
public class VenteForfaitEntity extends PanacheEntity {

    @ManyToOne
    public ForfaitEntity forfait;

    public int quantite;

    @jakarta.persistence.Column(columnDefinition = "double default 0")
    public double remise;

    @jakarta.persistence.Column(columnDefinition = "double default 0")
    public double remisePourcentage;

    @ManyToMany(fetch = FetchType.EAGER)
    public List<TechnicienEntity> techniciens = new ArrayList<>();

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp datePlanification;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateDebut;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateFin;

    public enum Status {
        EN_ATTENTE,
        PLANIFIEE,
        EN_COURS,
        TERMINEE,
        INCIDENT,
        ANNULEE
    }

    public Status status;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp statusDate;

    public double dureeReelle;

    // Durée allouée à la planification (heures) ; à défaut on utilise la durée estimée du forfait
    public Double dureePlanifiee;

    public Date incidentDate;

    public String incidentDetails;

    public String notes;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = jakarta.persistence.FetchType.EAGER)
    @JoinColumn(name = "vente_forfait_id")
    public List<TaskEntity> taches = new ArrayList<>();

    public List<String> images = new ArrayList<>();

    public List<String> documents = new ArrayList<>();

}
