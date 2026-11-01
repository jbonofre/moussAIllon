package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

@Entity
public class BateauClientEntity extends PanacheEntity {

    public String name;

    public List<String> images = new ArrayList<>();

    public List<String> documents = new ArrayList<>();

    public String immatriculation;

    public String numeroSerie;

    public String numeroClef;

    public String dateMeS;

    public String dateAchat;

    public String dateFinDeGuarantie;

    // Dernier relevé des heures moteur (renseigné par les techniciens)
    public Double heuresMoteur;

    @ManyToMany
    public List<ClientEntity> proprietaires = new ArrayList<>();

    @ManyToOne
    public BateauCatalogueEntity modele;

    public String localisation;

    public String localisationGps;

    @ManyToMany
    public List<MoteurCatalogueEntity> moteurs = new ArrayList<>();

    @ManyToMany
    public List<HeliceCatalogueEntity> helices = new ArrayList<>();

    @ManyToMany
    public List<RemorqueCatalogueEntity> remorques = new ArrayList<>();

    public List<String> equipements = new ArrayList<>();

    @ManyToMany(fetch = FetchType.EAGER)
    public List<BateauOptionEntity> options = new ArrayList<>();

    public Timestamp dateCreation;

    // Renseignée quand le client peut venir récupérer son matériel (prestation terminée)
    public Timestamp datePretRecuperation;

}
