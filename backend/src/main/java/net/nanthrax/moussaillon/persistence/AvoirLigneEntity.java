package net.nanthrax.moussaillon.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;

@Entity
public class AvoirLigneEntity extends PanacheEntityChantier {

    public String reference;

    @Column(nullable = false)
    public String designation;

    public double quantite = 1;

    public double prixUnitaireHT;

    public double tva;

    public double montantTVA;

    public double totalTTC;

}
