package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;

@Entity
public class VentePrestationProduitEntity extends PanacheEntity {

    @ManyToOne
    public ProduitCatalogueEntity produit;

    public int quantite;

}
