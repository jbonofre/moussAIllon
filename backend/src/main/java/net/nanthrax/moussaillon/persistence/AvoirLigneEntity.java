package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;

@Entity
public class AvoirLigneEntity extends PanacheEntity {

    @Column(nullable = false)
    public String designation;

    public int quantite = 1;

    public double prixUnitaireHT;

    public double tva;

    public double montantTVA;

    public double totalTTC;

}
