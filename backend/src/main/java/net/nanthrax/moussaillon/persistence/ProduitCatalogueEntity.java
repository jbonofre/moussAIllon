package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;

import java.util.ArrayList;
import java.util.List;

@Entity
public class ProduitCatalogueEntity extends PanacheEntity {

    @Column(nullable = false, unique = true)
    public String nom;

    public String marque;

    @Column(nullable = false)
    public String categorie;

    public String ref;

    public List<String> refs = new ArrayList<>();

    public List<String> images = new ArrayList<>();

    public List<String> documents = new ArrayList<>();

    public String description;

    public Integer anneeDebut;

    public Integer anneeFin;

    public double evaluation;

    public int stock;

    public int stockMini;

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
