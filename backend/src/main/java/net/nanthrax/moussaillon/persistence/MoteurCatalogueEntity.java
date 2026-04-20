package net.nanthrax.moussaillon.persistence;

import java.util.ArrayList;
import java.util.List;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.json.bind.annotation.JsonbTransient;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;

@Entity
public class MoteurCatalogueEntity extends PanacheEntity {

    @Column(nullable = false)
    public String modele;

    @Column(nullable = false)
    public String marque;

    @Column(nullable = false)
    public String type;

    public String description;

    public Integer anneeDebut;

    public Integer anneeFin;

    public double evaluation;

    public List<String> images = new ArrayList<>();

    public List<String> documents = new ArrayList<>();

    public double puissanceCv;

    public double puissanceKw;

    public String longueurArbre;

    public double arbre;

    public String demarrage;

    public String direction;

    public int cylindres;

    public int cylindree;

    public String regime;

    public String huileRecommandee;

    @ManyToMany
    @JoinTable(
        name = "moteur_helice",
        joinColumns = @JoinColumn(name = "moteur_id"),
        inverseJoinColumns = @JoinColumn(name = "helice_id")
    )
    @JsonbTransient
    public List<HeliceCatalogueEntity> helicesCompatibles = new ArrayList<>();

    public long stock;

    public long stockAlerte;

    public String emplacement;

    public double prixPublic;

    public double frais;

    public double tauxMarge;

    public double tauxMarque;

    public double prixVenteHT;

    public double tva;

    public double montantTVA;

    public double prixVenteTTC;

}
