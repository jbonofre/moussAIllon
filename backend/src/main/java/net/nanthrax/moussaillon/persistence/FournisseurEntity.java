package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;

import java.util.ArrayList;
import java.util.List;

@Entity
public class FournisseurEntity extends PanacheEntity {

    @Column(nullable = false, unique = true)
    public String nom;

    public String image;

    public String email;

    public String telephone;

    public String adresse;

    public double evaluation;

    public String siren;

    public String siret;

    public String tva;

    public String naf;

    public String connexion;

    public List<String> documents = new ArrayList<>();

    @Column(columnDefinition = "double default 0")
    public double portForfaitaireDefaut;

    @Column(columnDefinition = "double default 0")
    public double portParUniteDefaut;

    @Column(columnDefinition = "integer default 1")
    public int nombreMinACommanderDefaut = 1;

    @Column(columnDefinition = "double default 0")
    public double tauxMargeDefaut;

    @Column(columnDefinition = "double default 0")
    public double tauxMarqueDefaut;

}
