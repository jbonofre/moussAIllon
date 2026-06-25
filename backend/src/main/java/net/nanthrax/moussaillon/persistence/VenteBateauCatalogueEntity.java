package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;

@Entity
public class VenteBateauCatalogueEntity extends PanacheEntity {

    @ManyToOne
    public BateauCatalogueEntity bateau;

    @Column(columnDefinition = "integer default 0")
    public int quantite;

    @Column(columnDefinition = "double default 0")
    public double remise;

    @Column(columnDefinition = "double default 0")
    public double remisePourcentage;

}
