package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

@Entity
public class EmailTemplateEntity extends PanacheEntity {

    public enum Type {
        // Relance de paiement 1 (RAPPEL, nom historique), 2 et 3
        RAPPEL,
        INCIDENT,
        FACTURE,
        AVOIR,
        PRET_A_RECUPERER,
        // Relance de devis/OR 1, 2 et 3
        RELANCE_DEVIS,
        RELANCE_2,
        RELANCE_3,
        RELANCE_DEVIS_2,
        RELANCE_DEVIS_3
    }

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, unique = true)
    public Type type;

    @Column(nullable = false)
    public String sujet;

    @Column(nullable = false, length = 10000)
    public String contenu;

    public String description;

    public static EmailTemplateEntity findByType(Type type) {
        return find("type", type).firstResult();
    }

}
