package net.nanthrax.moussaillon.persistence;

import java.sql.Timestamp;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.json.bind.annotation.JsonbProperty;
import jakarta.json.bind.annotation.JsonbTransient;
import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.ManyToOne;

@Entity
public class ProduitMouvementEntity extends PanacheEntity {

    public enum Type {
        VENTE,
        AJUSTEMENT_MANUEL
    }

    @ManyToOne
    @JsonbTransient
    public ProduitCatalogueEntity produit;

    @JsonbProperty("produitId")
    public Long getProduitId() {
        return produit != null ? produit.id : null;
    }

    @Enumerated(EnumType.STRING)
    public Type type;

    public int quantite;

    public int stockApres;

    @ManyToOne
    @JsonbTransient
    public VenteEntity vente;

    @JsonbProperty("venteId")
    public Long getVenteId() {
        return vente != null ? vente.id : null;
    }

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp date;

}
