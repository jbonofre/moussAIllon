package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Entity;

@Entity
public class MainOeuvreEntity extends PanacheEntity {

    public String reference;

    public String nom;

    public String description;

    public double prixHT;

    public double tva;

    public double montantTVA;

    public double prixTTC;

}
