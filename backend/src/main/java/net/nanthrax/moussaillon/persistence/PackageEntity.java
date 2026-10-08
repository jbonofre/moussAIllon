package net.nanthrax.moussaillon.persistence;

import java.util.ArrayList;
import java.util.List;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;

/**
 * Regroupement d'articles du catalogue (produits, bateaux, moteurs, hélices, remorques).
 * Un package sert de modèle : l'ajouter à une vente y recopie ses lignes.
 */
@Entity
public class PackageEntity extends PanacheEntity {

    @Column(nullable = false)
    public String designation;

    public String ref;

    @Column(columnDefinition = "TEXT")
    public String description;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JoinColumn(name = "package_id")
    public List<PackageLigneEntity> lignes = new ArrayList<>();

}
