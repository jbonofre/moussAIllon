package net.nanthrax.moussaillon.persistence;

import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;

@Entity
public class FournisseurMoteurEntity extends PanacheEntityChantier {

    @ManyToOne
    public FournisseurEntity fournisseur;

    @ManyToOne
    public MoteurCatalogueEntity moteur;
    
    public double prixAchatHT;

    public double tva;

    public double montantTVA;

    public double prixAchatTTC;

    public double portForfaitaire;

    public double portParUnite;

    public int nombreMinACommander;

    @jakarta.persistence.Column(columnDefinition = "double default 0")
    public double tauxMarge;

    @jakarta.persistence.Column(columnDefinition = "double default 0")
    public double tauxMarque;

    public String reference;

    public String notes;
}
