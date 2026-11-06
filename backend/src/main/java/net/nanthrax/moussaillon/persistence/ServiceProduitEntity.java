package net.nanthrax.moussaillon.persistence;

import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;

@Entity
public class ServiceProduitEntity extends PanacheEntityChantier {

    @ManyToOne
    public ProduitCatalogueEntity produit;

    public double quantite;
}
