package net.nanthrax.moussaillon.persistence;

import jakarta.json.bind.annotation.JsonbProperty;
import jakarta.persistence.Entity;

/**
 * Article d'un inventaire : son stock théorique au lancement et la quantité comptée. L'article est repéré par son type
 * (produit, bateau, moteur, remorque) et son identifiant ; sa désignation est figée pour l'historique.
 */
@Entity
public class InventaireLigneEntity extends PanacheEntityChantier {

    public String typeArticle;

    public Long articleId;

    public String designation;

    public String ref;

    public String categorie;

    public String emplacement;

    public double stockTheorique;

    // Null tant que l'article n'est pas compté : il est alors laissé tel quel à la validation
    public Double stockCompte;

    // Coût d'achat unitaire HT au lancement, pour valoriser l'écart
    public double coutUnitaireHT;

    @JsonbProperty("ecart")
    public Double getEcart() {
        return stockCompte != null ? stockCompte - stockTheorique : null;
    }

    @JsonbProperty("valeurEcart")
    public Double getValeurEcart() {
        Double ecart = getEcart();
        return ecart != null ? Math.round(ecart * coutUnitaireHT * 100.0) / 100.0 : null;
    }

}
