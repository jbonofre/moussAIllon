package net.nanthrax.moussaillon.persistence;

import java.util.ArrayList;
import java.util.List;

import jakarta.json.bind.annotation.JsonbTransient;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;

@Entity
@EntityListeners(FormatNomListener.class)
public class HeliceCatalogueEntity extends PanacheEntity {

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

    public double evaluation;

    public double diametre;

    public String pas;

    public int pales;

    public int cannelures;

    @ManyToMany(mappedBy = "helicesCompatibles")
    @JsonbTransient
    public List<MoteurCatalogueEntity> moteursCompatibles = new ArrayList<>();

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
