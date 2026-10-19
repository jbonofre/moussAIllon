package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;

/** Ligne d'un package : un seul des articles du catalogue (ou un forfait) est renseigné. */
@Entity
public class PackageLigneEntity extends PanacheEntity {

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

    @ManyToOne
    @JsonbTypeAdapter(ForfaitSummaryAdapter.class)
    public ForfaitEntity forfait;

    @Column(columnDefinition = "integer default 1")
    public int quantite;

}
