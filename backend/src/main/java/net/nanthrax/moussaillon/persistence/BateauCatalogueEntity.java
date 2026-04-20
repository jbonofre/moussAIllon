package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.json.bind.annotation.JsonbTransient;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.OneToMany;

import java.util.ArrayList;
import java.util.List;

@Entity
public class BateauCatalogueEntity extends PanacheEntity {

    @Column(nullable = false)
    public String modele;

    @Column(nullable = false)
    public String marque;

    public List<String> images = new ArrayList<>();

    public List<String> documents = new ArrayList<>();

    @Column(nullable = false)
    public String type;

    public String description;

    public double evaluation;

    public Integer anneeDebut;

    public Integer anneeFin;

    public double longueurExterieure;

    public double longueurCoque;

    public double hauteur;

    public double largeur;

    public double tirantAir;

    public double tirantEau;

    public double poidsVide;

    public double poidsMoteurMax;

    public double chargeMax;

    public String longueurArbre;

    public String puissanceMax;

    public double reservoirEau;

    public double reservoirCarburant;

    public int nombrePassagersMax;

    public String categorieCe;

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

    @OneToMany
    @JsonbTransient
    public List<FournisseurEntity> fournisseurs = new ArrayList<>();

}