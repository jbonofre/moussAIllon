package net.nanthrax.moussaillon.persistence;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;

/**
 * Inventaire physique du stock. Son lancement fige le stock théorique des articles de son périmètre ; les quantités
 * comptées sont enregistrées au fil du comptage, puis sa validation applique au stock l'écart de chaque article compté.
 */
@Entity
public class InventaireEntity extends PanacheEntityChantier {

    public enum Statut {
        EN_COURS,
        VALIDE
    }

    public String reference;

    public String libelle;

    // Périmètre choisi au lancement (null : sans filtre)
    public String typeArticle;

    public String categorie;

    public String emplacement;

    @Enumerated(EnumType.STRING)
    @Column(columnDefinition = "varchar(32)")
    public Statut statut = Statut.EN_COURS;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateCreation;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateValidation;

    public String creePar;

    public String validePar;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "inventaire_id")
    @OrderBy("designation")
    public List<InventaireLigneEntity> lignes = new ArrayList<>();

}
