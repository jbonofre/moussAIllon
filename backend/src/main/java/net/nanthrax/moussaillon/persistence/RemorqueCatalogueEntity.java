package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;

import java.util.ArrayList;
import java.util.List;

@Entity
@EntityListeners(FormatNomListener.class)
public class RemorqueCatalogueEntity extends PanacheEntity {

    @jakarta.persistence.Transient
    public List<String> referencesFournisseurs;

    @Column(nullable = false)
    @FormatNom
    public String designation;

    public String ref;

    public String description;

    public Integer anneeDebut;

    public Integer anneeFin;

    public List<String> images = new ArrayList<>();

    public List<String> documents = new ArrayList<>();

    public int evaluation;

    public long ptac;

    public long chargeAVide;

    public long chargeUtile;

    public long longueur;

    public long largeur;

    public long longueurMaxBateau;

    public long largeurMaxBateau;

    public String fleche;

    public String typeChassis;

    public String roues;

    public String equipement;

    public long stock;

    public long stockAlerte;

    public String emplacement;

    public double prixVenteHT;

    public double tva;

    public double montantTVA;

    public double prixVenteTTC;

    // Un article d'occasion est vendu sans TVA (voir appliquerTvaOccasion)
    @Column(columnDefinition = "boolean default false")
    public boolean occasion;

    // Appliqué à chaque enregistrement, quelle qu'en soit l'origine (formulaire, import CSV, conversion de type...)
    @PrePersist
    @PreUpdate
    void appliquerTvaOccasion() {
        if (occasion) {
            // Sans TVA, le prix TTC est le prix HT (repris du TTC si seul celui-ci est renseigné)
            if (prixVenteHT == 0) {
                prixVenteHT = prixVenteTTC;
            }
            prixVenteTTC = prixVenteHT;
            tva = 0;
            montantTVA = 0;
        }
    }

}
