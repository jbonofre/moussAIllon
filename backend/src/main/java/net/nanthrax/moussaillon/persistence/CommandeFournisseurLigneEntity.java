package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;

@Entity
public class CommandeFournisseurLigneEntity extends PanacheEntity {

    @ManyToOne
    public ProduitCatalogueEntity produit;

    @ManyToOne
    public BateauCatalogueEntity bateau;

    @ManyToOne
    public MoteurCatalogueEntity moteur;

    @ManyToOne
    public HeliceCatalogueEntity helice;

    @ManyToOne
    public RemorqueCatalogueEntity remorque;

    public int quantite;

    public double prixUnitaireHT;

    public double tva;

    public double montantTVA;

    public double prixTotalHT;

    public double prixTotalTTC;

}
