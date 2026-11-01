package net.nanthrax.moussaillon.persistence;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;

@Entity
public class MoteurClientEntity extends PanacheEntity {

    public List<String> images = new ArrayList<>();

    public List<String> documents = new ArrayList<>();

    public String numeroSerie;

    public String numeroClef;

    public String dateMeS;

    public String dateAchat;

    public String dateFinDeGuarantie;

    // Dernier relevé des heures moteur (renseigné par les techniciens)
    public Double heuresMoteur;

    @ManyToOne
    public ClientEntity proprietaire;

    @ManyToOne
    public MoteurCatalogueEntity modele;

    public Timestamp dateCreation;

    // Renseignée quand le client peut venir récupérer son matériel (prestation terminée)
    public Timestamp datePretRecuperation;

}
