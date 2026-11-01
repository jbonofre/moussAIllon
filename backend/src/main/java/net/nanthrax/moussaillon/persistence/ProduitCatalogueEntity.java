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
public class ProduitCatalogueEntity extends PanacheEntity {

    @jakarta.persistence.Transient
    public List<String> referencesFournisseurs;

    @Column(nullable = false)
    @FormatNom
    public String designation;

    @Column(nullable = false)
    public String categorie;

    public String ref;

    public List<String> refs = new ArrayList<>();

    public List<String> images = new ArrayList<>();

    public List<String> documents = new ArrayList<>();

    public String description;

    public Integer anneeDebut;

    public Integer anneeFin;

    public double evaluation;

    public int stock;

    public int stockMini;

    public String emplacement;

    public String emplacementMagasin;

    public double prixVenteHT;

    public double tva;

    public double montantTVA;

    public double prixVenteTTC;

    // Un article d'occasion est vendu sans TVA (voir appliquerTvaOccasion)
    @Column(columnDefinition = "boolean default false")
    public boolean occasion;

    // Ajouté automatiquement à toute prestation comportant une intervention (forfait ou service),
    // par exemple une participation au traitement des déchets
    @Column(columnDefinition = "boolean default false")
    public boolean ajoutAutomatiqueIntervention;

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
