package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

@Entity
public class RemorqueClientEntity extends PanacheEntity {

    public String immatriculation;

    public String dateMeS;

    public String dateAchat;

    public String dateFinDeGuarantie;

    public List<String> images = new ArrayList<>();

    public List<String> documents = new ArrayList<>();

    @ManyToOne
    public ClientEntity proprietaire;

    @ManyToOne
    public RemorqueCatalogueEntity modele;

    public Timestamp dateCreation;

    // Renseignée quand le client peut venir récupérer son matériel (prestation terminée)
    public Timestamp datePretRecuperation;

}