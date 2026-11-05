package net.nanthrax.moussaillon.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;

@Entity
public class VenteProduitEntity extends PanacheEntityChantier {

    @ManyToOne
    public ProduitCatalogueEntity produit;

    @Column(columnDefinition = "integer default 0")
    public double quantite;

    @Column(columnDefinition = "double default 0")
    public double remise;

    @Column(columnDefinition = "double default 0")
    public double remisePourcentage;

    // Marque une ligne produit ajoutee par le technicien depuis l'espace technicien
    @Column(columnDefinition = "boolean default false")
    public boolean ajouteParTechnicien;

}
