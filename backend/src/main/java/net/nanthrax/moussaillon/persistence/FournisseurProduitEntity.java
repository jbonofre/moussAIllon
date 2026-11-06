package net.nanthrax.moussaillon.persistence;

import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;

@Entity
public class FournisseurProduitEntity extends PanacheEntityChantier {

    @ManyToOne
    public ProduitCatalogueEntity produit;

    @ManyToOne
    public FournisseurEntity fournisseur;

    public String reference;

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

}
