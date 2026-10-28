package net.nanthrax.moussaillon.persistence;

import java.util.ArrayList;
import java.util.List;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;

@Entity
public class MoteurCatalogueEntity extends PanacheEntity {

    @jakarta.persistence.Transient
    public List<String> referencesFournisseurs;

    @Column(nullable = false)
    public String designation;

    public String ref;

    @Column(nullable = false)
    public String type;

    public String description;

    public Integer anneeDebut;

    public Integer anneeFin;

    public double evaluation;

    public List<String> images = new ArrayList<>();

    public List<String> documents = new ArrayList<>();

    public double puissanceCv;

    public double puissanceKw;

    public String longueurArbre;

    public double arbre;

    public String demarrage;

    public String direction;

    public int cylindres;

    public int cylindree;

    public String regime;

    public String huileRecommandee;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "moteur_helice",
        joinColumns = @JoinColumn(name = "moteur_id"),
        inverseJoinColumns = @JoinColumn(name = "helice_id")
    )
    public List<HeliceCatalogueEntity> helicesCompatibles = new ArrayList<>();

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
