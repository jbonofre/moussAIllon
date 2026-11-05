package net.nanthrax.moussaillon.persistence;

import java.sql.Timestamp;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.json.bind.annotation.JsonbProperty;
import jakarta.json.bind.annotation.JsonbTransient;
import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.ManyToOne;

/**
 * Mouvement de stock d'un article du catalogue suivi en stock : produit, ou bateau, moteur, remorque.
 * Les entrées (réceptions, ajustements et écarts d'inventaire positifs) datent le stock, pour son ancienneté ; les sorties
 * des ventes figent le coût d'achat de l'article, pour la marge.
 */
@Entity
public class ProduitMouvementEntity extends PanacheEntity {

    public enum Type {
        VENTE,
        AJUSTEMENT_MANUEL,
        // Réception d'une commande fournisseur
        RECEPTION,
        // Écart constaté à la validation d'un inventaire
        INVENTAIRE
    }

    // Motif d'un ajustement manuel du stock
    public enum Motif {
        CASSE,
        PERTE,
        USAGE_INTERNE,
        CORRECTION,
        RETOUR_FOURNISSEUR,
        AUTRE
    }

    @ManyToOne
    @JsonbTransient
    public ProduitCatalogueEntity produit;

    @JsonbProperty("produitId")
    public Long getProduitId() {
        return produit != null ? produit.id : null;
    }

    @ManyToOne
    @JsonbTransient
    public BateauCatalogueEntity bateau;

    @JsonbProperty("bateauId")
    public Long getBateauId() {
        return bateau != null ? bateau.id : null;
    }

    @ManyToOne
    @JsonbTransient
    public MoteurCatalogueEntity moteur;

    @JsonbProperty("moteurId")
    public Long getMoteurId() {
        return moteur != null ? moteur.id : null;
    }

    @ManyToOne
    @JsonbTransient
    public RemorqueCatalogueEntity remorque;

    @JsonbProperty("remorqueId")
    public Long getRemorqueId() {
        return remorque != null ? remorque.id : null;
    }

    @Enumerated(EnumType.STRING)
    public Type type;

    // Positive pour une sortie de vente (négative pour un retour en stock) ; signée pour un ajustement ou un écart
    // d'inventaire ; positive pour une réception
    public double quantite;

    public double stockApres;

    // Coût d'achat unitaire HT : prix de réception (frais de port compris), ou coût de l'article à sa sortie pour une vente.
    // Null pour les mouvements antérieurs à son suivi.
    public Double prixUnitaireHT;

    @ManyToOne
    @JsonbTransient
    public VenteEntity vente;

    @JsonbProperty("venteId")
    public Long getVenteId() {
        return vente != null ? vente.id : null;
    }

    @ManyToOne
    @JsonbTransient
    public CommandeFournisseurEntity commandeFournisseur;

    @JsonbProperty("commandeFournisseurId")
    public Long getCommandeFournisseurId() {
        return commandeFournisseur != null ? commandeFournisseur.id : null;
    }

    @JsonbProperty("commandeFournisseurReference")
    public String getCommandeFournisseurReference() {
        return commandeFournisseur != null ? commandeFournisseur.reference : null;
    }

    @ManyToOne
    @JsonbTransient
    public InventaireEntity inventaire;

    @JsonbProperty("inventaireId")
    public Long getInventaireId() {
        return inventaire != null ? inventaire.id : null;
    }

    @JsonbProperty("inventaireReference")
    public String getInventaireReference() {
        return inventaire != null ? inventaire.reference : null;
    }

    // Null pour les ajustements antérieurs à son suivi (ou saisis depuis la fiche de l'article) et les autres mouvements.
    // En VARCHAR plutôt qu'en ENUM natif H2, figé sur les valeurs connues à sa création.
    @Enumerated(EnumType.STRING)
    @Column(columnDefinition = "varchar(32)")
    public Motif motif;

    public String commentaire;

    // Utilisateur du chantier qui a saisi l'ajustement ou validé l'inventaire
    public String utilisateur;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp date;

    // Mouvement à rattacher à son article (et à sa vente ou sa commande) avant d'être enregistré ; daté de maintenant sans date
    public static ProduitMouvementEntity nouveau(Type type, double quantite, double stockApres, Double prixUnitaireHT, Timestamp date) {
        ProduitMouvementEntity mouvement = new ProduitMouvementEntity();
        mouvement.type = type;
        mouvement.quantite = quantite;
        mouvement.stockApres = stockApres;
        mouvement.prixUnitaireHT = prixUnitaireHT;
        mouvement.date = date != null ? date : new Timestamp(System.currentTimeMillis());
        return mouvement;
    }

}
