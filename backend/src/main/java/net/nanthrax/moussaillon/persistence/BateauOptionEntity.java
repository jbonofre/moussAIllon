package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;

@Entity
@EntityListeners(FormatNomListener.class)
public class BateauOptionEntity extends PanacheEntity {

    @Column(nullable = false)
    @FormatNom
    public String nom;

    public String description;

    public double prixHT;

    public double tva;

    public double montantTVA;

    public double prixTTC;

}
