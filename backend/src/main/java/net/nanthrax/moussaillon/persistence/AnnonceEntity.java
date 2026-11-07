package net.nanthrax.moussaillon.persistence;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;

@Entity
public class AnnonceEntity extends PanacheEntityChantier {

    public enum Status {
        ACTIVE,
        VENDU,
        EXPIRE
    }

    public Status status = Status.ACTIVE;

    public String titre;

    /** Longueur maximale (caractères) de la description, mise en forme (HTML) depuis l'éditeur. */
    public static final int LONGUEUR_DESCRIPTION = 10000;

    @Column(length = LONGUEUR_DESCRIPTION)
    public String description;

    public double prix;

    public String contact;

    public String telephone;

    public List<String> photos = new ArrayList<>();

    public List<String> publications = new ArrayList<>();

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateCreation;

    // Transmise aux plateformes dans le flux : elles ne réimportent que les annonces modifiées
    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateModification;

    @ManyToOne
    public ClientEntity client;

    @ManyToOne
    public BateauClientEntity bateau;

    // Moteur client mis en vente : signalé « à vendre » dans la liste des moteurs tant que l'annonce est active
    @ManyToOne
    public MoteurClientEntity moteur;

}
