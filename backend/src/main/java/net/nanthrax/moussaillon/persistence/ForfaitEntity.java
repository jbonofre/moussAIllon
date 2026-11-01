package net.nanthrax.moussaillon.persistence;

import java.util.List;
import java.util.ArrayList;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.OneToMany;
import jakarta.persistence.JoinColumn;

@Entity
@EntityListeners(FormatNomListener.class)
public class ForfaitEntity extends PanacheEntity {

    @FormatNom
    public String nom;

    @ManyToMany
    public List<MoteurCatalogueEntity> moteursAssocies;
    @ManyToMany
    public List<BateauCatalogueEntity> bateauxAssocies;

    // Forfaits gérés directement depuis un bateau / moteur client (en plus des modèles du catalogue)
    @ManyToMany
    public List<BateauClientEntity> bateauxClientsAssocies = new ArrayList<>();
    @ManyToMany
    public List<MoteurClientEntity> moteursClientsAssocies = new ArrayList<>();
    
    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "forfait_id")
    public List<ForfaitProduitEntity> produits = new ArrayList<>();

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "forfait_id")
    public List<ForfaitMainOeuvreEntity> mainOeuvres = new ArrayList<>();
    
    public double dureeEstimee;

    public long heuresFonctionnement;
    public long joursFrequence;

    public double prixHT;

    public double tva;

    public double montantTVA;

    public double prixTTC;

    public String reference;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "forfait_id")
    public List<TaskEntity> taches = new ArrayList<>();

}
